import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { theme } from '@/styles/theme';
import type { BusyPhase, SeasonChoice } from '@/types';
import { resolvedStyle } from '@/test-support/resolvedStyle/resolvedStyle';
import { SeasonChoices } from './SeasonChoices';

/**
 * 69, Silent waits, Phase 2 (issue #654): a **Season choice** as a **Busy
 * row**.
 *
 * The review hands the section `seasonPhase(season)`, the run hook's. From
 * `waiting` that season's card is `inert` and `aria-busy`, every other
 * season's card as it was. Once `shown` it draws its **Busy overlay** last in
 * the card (71, issue #681), the 18px `inline` **Logo loader** reading
 * _Saving poster…_ centred over the card, the held-poster caption kept in its
 * 112px slot under it: the loader never takes the caption's place.
 */

const tmdb = (path: string) => `https://image.tmdb.org/t/p/w342${path}`;

const choice = (path: string, source: 'season' | 'series') => ({
  path,
  url: tmdb(path),
  source,
});

const SEASON_ONE: SeasonChoice = {
  season: 1,
  posterUrl: '/api/images/the-hollow-coast-2018/S01-poster.jpg',
  choices: [choice('/s01-a.jpg', 'season'), choice('/show-1.jpg', 'series')],
};

const SEASON_TWO: SeasonChoice = {
  season: 2,
  posterUrl: null,
  choices: [choice('/show-1.jpg', 'series'), choice('/show-2.jpg', 'series')],
};

function tree(two: BusyPhase) {
  const seasonPhase = (season: number): BusyPhase =>
    season === 2 ? two : 'idle';
  return (
    <ThemeProvider theme={theme}>
      <SeasonChoices
        seasons={[SEASON_ONE, SEASON_TWO]}
        onChoose={vi.fn()}
        seasonPhase={seasonPhase}
      />
    </ThemeProvider>
  );
}

/** Season 2's Series poster 1 pressed, then the section handed `busy`. */
function chosenTwo(busy: BusyPhase) {
  const view = render(tree('idle'));
  fireEvent.click(
    screen.getByRole('button', { name: 'Series poster 1 for S02' })
  );
  view.rerender(tree(busy));
  return view;
}

const pickerFor = (label: string) =>
  screen.getByRole('group', { name: `Posters for ${label}` });

/** A season's card: the picker's parent, the **Busy row**'s root. */
const cardOf = (label: string) => pickerFor(label).parentElement as HTMLElement;

const busyCardOf = (element: HTMLElement) =>
  element.closest<HTMLElement>('[aria-busy="true"]');

describe('SeasonChoices: one season waiting', () => {
  it('locks that season’s card alone, inert and aria-busy', () => {
    chosenTwo('waiting');

    const card = busyCardOf(pickerFor('S02'));
    expect(card).not.toBeNull();
    expect(card?.hasAttribute('inert')).toBe(true);
    expect(busyCardOf(pickerFor('S01'))).toBeNull();
    expect(pickerFor('S01').closest('[inert]')).toBeNull();
  });

  it('draws no loader yet: the caption stays', () => {
    chosenTwo('waiting');

    expect(screen.queryByRole('status')).toBeNull();
    expect(within(pickerFor('S02')).getByText('No poster yet')).toBeTruthy();
  });

  it.each<BusyPhase>(['idle', 'waiting'])('draws no overlay at %s', (busy) => {
    chosenTwo(busy);
    const card = cardOf('S02');

    expect(screen.queryByRole('status', { hidden: true })).toBeNull();
    expect(screen.queryByText('Saving poster…')).toBeNull();
    expect(
      resolvedStyle(card.lastElementChild as HTMLElement).position
    ).not.toBe('absolute');
  });
});

describe('SeasonChoices: one season shown', () => {
  it('stays inert and aria-busy once shown', () => {
    chosenTwo('shown');

    const card = busyCardOf(pickerFor('S02'));
    expect(card).not.toBeNull();
    expect(card?.hasAttribute('inert')).toBe(true);
  });

  it('keeps the held-poster caption alongside Saving poster…', () => {
    chosenTwo('shown');
    const card = cardOf('S02');

    const loader = within(card).getByRole('status', { name: 'Saving poster…' });
    expect(loader.textContent).toContain('Saving poster…');
    expect(within(card).getByText('No poster yet')).toBeTruthy();
    expect(within(card).getByText('Saving poster…')).toBeTruthy();
  });

  it('draws no slot loader: the held tile and its caption hold no status', () => {
    chosenTwo('shown');
    const tile = within(pickerFor('S02')).getByText('S02');
    const held = tile.parentElement?.parentElement as HTMLElement;

    expect(within(held).queryByRole('status', { hidden: true })).toBeNull();
    // The caption's slot, right after the held tile, is still the caption.
    const slot = tile.parentElement?.nextElementSibling;
    expect(slot?.textContent).toBe('No poster yet');
    expect(slot?.getAttribute('role')).not.toBe('status');
    expect(within(pickerFor('S02')).queryByRole('status')).toBeNull();
  });

  it('draws the overlay last in the card, over it', () => {
    chosenTwo('shown');
    const card = cardOf('S02');
    const loader = within(card).getByRole('status', { name: 'Saving poster…' });

    const overlay = card.lastElementChild as HTMLElement;
    expect(overlay.contains(loader)).toBe(true);
    expect(overlay.contains(pickerFor('S02'))).toBe(false);
    expect(resolvedStyle(overlay).position).toBe('absolute');
    expect(Number(loader.querySelector('svg')?.getAttribute('width'))).toBe(18);
  });

  it('lays out its held poster and caption once shown as at idle', () => {
    const idle = render(tree('idle'));
    const held = () =>
      within(pickerFor('S02')).getByText('S02').parentElement?.parentElement
        ?.innerHTML;
    const before = held();
    idle.unmount();

    chosenTwo('shown');
    expect(held()).toBe(before);
  });

  it('no longer dims that season’s card, a containing block for its overlay', () => {
    chosenTwo('shown');

    const card = busyCardOf(pickerFor('S02'));
    expect(card).not.toBeNull();
    const drawn = resolvedStyle(card as HTMLElement);
    // 71, issue #677: `busyRow` drops the dim and the cursor; the root
    // is `position: relative` so the overlay can cover it.
    expect(drawn.opacity).not.toBe('.75');
    expect(drawn.cursor).not.toBe('progress');
    expect(drawn.position).toBe('relative');
  });

  it('leaves every other season as it was', () => {
    chosenTwo('shown');
    const one = pickerFor('S01');

    expect(within(one).getByText('Current poster')).toBeTruthy();
    expect(within(one).queryByRole('status')).toBeNull();
    expect(busyCardOf(one)).toBeNull();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });
});

describe('SeasonChoices: a locked season refuses a press', () => {
  it.each<BusyPhase>(['waiting', 'shown'])(
    'reports no choice for a %s season, and marks none picked',
    (busy) => {
      const onChoose = vi.fn();
      render(
        <ThemeProvider theme={theme}>
          <SeasonChoices
            seasons={[SEASON_ONE, SEASON_TWO]}
            onChoose={onChoose}
            seasonPhase={(season) => (season === 2 ? busy : 'idle')}
          />
        </ThemeProvider>
      );
      const choice = screen.getByRole('button', {
        name: 'Series poster 2 for S02',
      });

      fireEvent.click(choice);

      expect(onChoose).not.toHaveBeenCalled();
      expect(choice.getAttribute('aria-pressed')).toBe('false');
    }
  );
});
