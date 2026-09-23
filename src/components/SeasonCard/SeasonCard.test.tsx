import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { SeasonCard } from './SeasonCard';
import { theme } from '@/styles/theme';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

/**
 * 22 — Series (TV), Phase 2 (issue #192): `mol.SeasonCard` 1:1.
 *
 * A 2:3 tile in the series' gradient, the season's `S02` numeral on it, the
 * StatusBadge top-right when every episode is watched and a ProgressBar along
 * the bottom when some are; under it _Season 2_ over "8 episodes" or
 * "3 of 8 watched". The whole card is one button that calls `onOpen`, and it
 * is a **Card** on `cardLift` (the tile) / `cardFocus` (the root).
 */

type Season = ComponentProps<typeof SeasonCard>['season'];

const G1 = '#1f2a3a';
const G2 = '#3a6a8a';

function makeSeason(overrides: Partial<Season> = {}): Season {
  return {
    number: 2,
    episodeCount: 8,
    watchedCount: 0,
    g1: G1,
    g2: G2,
    ...overrides,
  };
}

function renderCard(
  overrides: { season?: Partial<Season>; onOpen?: () => void } = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <SeasonCard
        season={makeSeason(overrides.season)}
        onOpen={overrides.onOpen ?? (() => undefined)}
      />
    </ThemeProvider>
  );
}

/** The card — one button, named for its season. */
function card(name = /\bSeason 2\b/): HTMLElement {
  return screen.getByRole('button', { name });
}

/** The 2:3 tile — the button's first child. */
function tile(): Element {
  const first = card().firstElementChild;
  if (first === null) throw new Error('the card has no tile');
  return first;
}

/** Every painted background under the tile, the tile's own included. */
function backgroundsUnder(root: Element): string[] {
  return [root, ...Array.from(root.querySelectorAll('*'))].map((element) => {
    const computed = window.getComputedStyle(element);
    return `${computed.backgroundImage} ${computed.background}`;
  });
}

describe('SeasonCard — the tile', () => {
  it('draws the season’s numeral on the tile, two digits at least', () => {
    renderCard();

    expect(within(tile() as HTMLElement).getByText('S02')).toBeDefined();
  });

  it('pads a single-digit season and leaves a two-digit one alone', () => {
    renderCard({ season: { number: 12 } });

    expect(screen.getByText('S12')).toBeDefined();
  });

  it('is a 2:3 tile on the poster’s radius', () => {
    renderCard();

    const style = resolvedStyle(tile());
    expect(style['aspect-ratio']).toBe(normCss('2 / 3'));
    expect(style['border-radius']).toBe(theme.radius.md);
  });

  it('paints the series’ gradient under the numeral', () => {
    renderCard();

    expect(
      backgroundsUnder(tile()).some((bg) => bg.includes('linear-gradient'))
    ).toBe(true);
  });
});

describe('SeasonCard — the two lines', () => {
  it('reads Season N over the episode count for a season nobody has started', () => {
    renderCard({ season: { number: 2, episodeCount: 8, watchedCount: 0 } });

    expect(screen.getByText('Season 2')).toBeDefined();
    expect(screen.getByText('8 episodes')).toBeDefined();
  });

  it('writes one episode in the singular', () => {
    renderCard({ season: { episodeCount: 1, watchedCount: 0 } });

    expect(screen.getByText('1 episode')).toBeDefined();
  });

  it('reads N of M watched for a season part-way through', () => {
    renderCard({ season: { episodeCount: 8, watchedCount: 3 } });

    expect(screen.getByText('3 of 8 watched')).toBeDefined();
    expect(screen.queryByText('8 episodes')).toBeNull();
  });

  it('goes back to the episode count once the season is finished', () => {
    renderCard({ season: { episodeCount: 8, watchedCount: 8 } });

    expect(screen.getByText('8 episodes')).toBeDefined();
    expect(screen.queryByText(/of 8 watched/)).toBeNull();
  });

  it('reads a label in place of Season N when it is given one', () => {
    renderCard({ season: { number: 2, label: 'Specials' } });

    expect(screen.getByText('Specials')).toBeDefined();
    expect(screen.queryByText('Season 2')).toBeNull();
  });
});

describe('SeasonCard — the badge and the bar', () => {
  it('draws neither for a season nobody has started', () => {
    renderCard({ season: { episodeCount: 8, watchedCount: 0 } });

    expect(screen.queryByRole('img', { name: 'Watched' })).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('draws the bar, filled to the watched share, for a season part-way through', () => {
    renderCard({ season: { episodeCount: 8, watchedCount: 3 } });

    const bar = within(tile() as HTMLElement).getByRole('progressbar');
    // 3 of 8 is 37.5%, rounded as the prototype rounds it.
    expect(bar.getAttribute('aria-valuenow')).toBe('38');
    expect(screen.queryByRole('img', { name: 'Watched' })).toBeNull();
  });

  it('draws the badge, and no bar, for a season whose every episode is watched', () => {
    renderCard({ season: { episodeCount: 8, watchedCount: 8 } });

    expect(
      within(tile() as HTMLElement).getByRole('img', { name: 'Watched' })
    ).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('calls a season with no episodes neither finished nor started', () => {
    renderCard({ season: { episodeCount: 0, watchedCount: 0 } });

    expect(screen.getByText('0 episodes')).toBeDefined();
    expect(screen.queryByRole('img', { name: 'Watched' })).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('SeasonCard — opening it', () => {
  it('is a real button, so Enter and Space open the season', () => {
    renderCard();

    expect(card().tagName).toBe('BUTTON');
    expect(card().hasAttribute('disabled')).toBe(false);
  });

  it('calls onOpen when it is pressed', () => {
    const onOpen = vi.fn();
    renderCard({ onOpen });

    fireEvent.click(card());

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('takes a tab stop', () => {
    renderCard();

    card().focus();

    expect(document.activeElement).toBe(card());
  });
});

/**
 * The **Card** vocabulary — `cardLift` on the tile, `cardFocus` on the root —
 * read through the cascade `resolvedStyle` runs, since jsdom computes no
 * `:hover`, `:active` or `:focus-visible`.
 */
describe('SeasonCard — hover, press and keyboard focus', () => {
  const c = theme.colors;

  it('rests the tile on the Card shadow, easing at durBase on easeOut', () => {
    renderCard();

    const resting = resolvedStyle(tile());
    expect(resting['box-shadow']).toBe(normCss('0 6px 20px rgba(0,0,0,.35)'));
    expect(resting.transition ?? '').toContain(
      normCss(`transform ${theme.motion.durBase} ${theme.motion.easeOut}`)
    );
  });

  it('lifts the tile 4px on hover, with the deeper shadow and an accent edge', () => {
    renderCard();

    const hover = resolvedStyle(tile(), { hover: true });
    expect(hover.transform).toBe(normCss('translateY(-4px)'));
    expect(hover['box-shadow']).toBe(normCss('0 14px 34px rgba(0,0,0,.5)'));
    expect(hover['border-color']).toBe(normCss(c.accentLine));
  });

  it('settles the tile to translateY(-1px) on press, in 70ms', () => {
    renderCard();

    const press = resolvedStyle(tile(), { hover: true, active: true });
    expect(press.transform).toBe(normCss('translateY(-1px)'));
    expect(press['transition-duration']).toBe('70ms');
  });

  it('draws the card outline clear of the tile under Tab, on the tile’s radius', () => {
    renderCard();

    const focus = resolvedStyle(card(), { focusVisible: true });
    expect(focus.outline).toBe(normCss(`2px solid ${c.focusRing}`));
    expect(focus['outline-offset']).toBe('4px');
    expect(focus['border-radius']).toBe(theme.radius.md);
  });
});
