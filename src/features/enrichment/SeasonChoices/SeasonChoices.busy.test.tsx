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
 * season's card as it was; once `shown` it dims, and an 18px `inline`
 * **Logo loader** reading _Saving poster…_ stands in its held-poster caption.
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
});

describe('SeasonChoices: one season shown', () => {
  it('reads Saving poster… in that season’s held-poster caption', () => {
    chosenTwo('shown');
    const two = pickerFor('S02');

    const loader = within(two).getByRole('status', { name: 'Saving poster…' });
    expect(loader.textContent).toContain('Saving poster…');
    expect(within(two).queryByText('No poster yet')).toBeNull();
    // The caption's slot: right after the held tile, `S02` on it.
    expect(loader.previousElementSibling?.textContent).toContain('S02');
    expect(Number(loader.querySelector('svg')?.getAttribute('width'))).toBe(18);
  });

  it('dims that season’s card to .75 under a progress cursor', () => {
    chosenTwo('shown');

    const card = busyCardOf(pickerFor('S02'));
    expect(card).not.toBeNull();
    const drawn = resolvedStyle(card as HTMLElement);
    expect(drawn.opacity).toBe('.75');
    expect(drawn.cursor).toBe('progress');
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
