import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ContinueCard } from './ContinueCard';
import { theme } from '@/styles/theme';
import type { ContinueCardMovie } from '@/types';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';
import { makeContinueCardMovie } from '@/test-support/makeContinueCardMovie/makeContinueCardMovie';

const movie = makeContinueCardMovie();

function renderCard(
  overrides: { onOpen?: () => void; movie?: ContinueCardMovie } = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <ContinueCard
        movie={overrides.movie ?? movie}
        onOpen={overrides.onOpen ?? (() => undefined)}
      />
    </ThemeProvider>
  );
}

describe('ContinueCard', () => {
  it('shows the movie title', () => {
    const { getByText } = renderCard();

    expect(getByText('Comet Season')).toBeTruthy();
  });

  it('shows the resume label exactly as the mapper built it', () => {
    const { getByText } = renderCard();

    expect(getByText('Resume · 1:13 of 1:55')).toBeTruthy();
  });

  it('fills the progress track to the model percent', () => {
    const { getByRole } = renderCard();

    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('64');
  });

  it('clamps a percent past the end of the movie to 100', () => {
    const { getByRole } = renderCard({ movie: { ...movie, progress: 150 } });

    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  });

  it('clamps a negative percent to an empty track', () => {
    const { getByRole } = renderCard({ movie: { ...movie, progress: -20 } });

    expect(getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
  });

  it('calls onOpen when the tile is clicked', () => {
    const onOpen = vi.fn();
    const { container } = renderCard({ onOpen });

    fireEvent.click(container.firstChild as Element);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('offers no favorite control anywhere on the tile', () => {
    const { queryByTitle, queryByLabelText } = renderCard();

    expect(queryByTitle('Favorite')).toBeNull();
    expect(queryByLabelText(/favorite/i)).toBeNull();
  });
});

describe('ContinueCard — opening it without a mouse', () => {
  it('exposes a control named for the movie', () => {
    renderCard();

    expect(screen.getByRole('button', { name: 'Comet Season' })).toBeTruthy();
  });

  it('gives that control a tab stop, so it can be reached at all', () => {
    renderCard();
    const tile = screen.getByRole('button', { name: 'Comet Season' });

    tile.focus();

    // jsdom only moves focus to an element the focus rules say is focusable, so
    // this fails for a bare div exactly as tabbing to one would.
    expect(document.activeElement).toBe(tile);
  });

  it('is a real button, so Enter and Space open the movie', () => {
    const onOpen = vi.fn();
    renderCard({ onOpen });
    const tile = screen.getByRole('button', { name: 'Comet Season' });

    // The tile holds no other control, so it can be a button outright and let
    // the platform do the keyboard work: browsers synthesise a click from Enter
    // and from Space on a button, which is strictly better than re-implementing
    // that by hand. jsdom does not simulate that synthesis, so the assertion
    // that carries the guarantee is that this really is a button rather than a
    // div wearing a role — and that the click it would synthesise opens the
    // movie.
    expect(tile.tagName).toBe('BUTTON');
    expect(tile.hasAttribute('disabled')).toBe(false);

    fireEvent.click(tile);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});

/**
 * 21 — Motion & interaction states, Phase 5 (issue #185): the Continue card on
 * the same two Card fragments as the poster — `cardLift` on the tile,
 * `cardFocus` on the root — so it lifts, settles and outlines exactly as a
 * poster does, and no longer fades.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * what the injected stylesheet resolves to for the element in that state — the
 * cascade run by `resolvedStyle` — never a computed style.
 */
describe('ContinueCard — hover, press and keyboard focus', () => {
  const c = theme.colors;

  function card(): HTMLElement {
    return screen.getByRole('button', { name: movie.title });
  }

  /** The 16:10 tile — the button's one child. */
  function tile(): Element {
    const first = card().firstElementChild;
    if (first === null) throw new Error('the card has no tile');
    return first;
  }

  it('gives the tile the resting shadow it never had, easing at durBase on easeOut', () => {
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

  it('no longer fades on hover', () => {
    renderCard();

    expect(resolvedStyle(card(), { hover: true }).opacity).toBeUndefined();
    expect(resolvedStyle(tile(), { hover: true }).opacity).toBeUndefined();
  });

  it('draws the card outline clear of the tile under Tab, on the tile’s radius', () => {
    renderCard();

    const focus = resolvedStyle(card(), { focusVisible: true });
    expect(focus.outline).toBe(normCss(`2px solid ${c.focusRing}`));
    expect(focus['outline-offset']).toBe('4px');
    expect(focus['border-radius']).toBe(theme.radius.md);
  });
});

/**
 * 28 — Default poster, Phase 3 (issue #256): the card draws the film's own
 * poster, cropped to the key art at `center 25%` under the existing scrim, and
 * the **Default poster** when there is none — matching its card in the rows.
 */
describe('ContinueCard — the poster on the tile', () => {
  const POSTER_URL = '/api/images/solo/poster.jpg';

  /** The art layer — the tile's first child, under the scrim. */
  function art(): Element {
    const tile = screen.getByRole('button', {
      name: movie.title,
    }).firstElementChild;
    const layer = tile?.firstElementChild ?? null;
    if (layer === null) throw new Error('the tile has no art layer');
    return layer;
  }

  it('holds the movie’s poster in its art layer', () => {
    renderCard({ movie: { ...movie, posterUrl: POSTER_URL } });

    expect(window.getComputedStyle(art()).backgroundImage).toContain(
      POSTER_URL
    );
  });

  it('crops that poster to the key art, covering the tile at center 25%', () => {
    renderCard({ movie: { ...movie, posterUrl: POSTER_URL } });

    const layer = resolvedStyle(art());
    expect(layer['background-position']).toBe(normCss('center 25%'));
    expect(layer['background-size']).toBe('cover');
  });

  it('draws no Wordmark over a real poster', () => {
    renderCard({ movie: { ...movie, posterUrl: POSTER_URL } });

    expect(screen.queryByText('Flix')).toBeNull();
  });

  it('draws the Wordmark on a movie with no poster, hidden from the accessibility tree', () => {
    renderCard({ movie: { ...movie, posterUrl: null } });

    expect(screen.getByText('Flix')).toBeTruthy();
    expect(screen.getByText('Flix').closest('[aria-hidden="true"]')).not.toBe(
      null
    );
    expect(screen.getByRole('button', { name: 'Comet Season' })).toBeTruthy();
  });

  it('keeps the title and the resume label over a real poster', () => {
    renderCard({ movie: { ...movie, posterUrl: POSTER_URL } });

    expect(screen.getByText('Comet Season')).toBeTruthy();
    expect(screen.getByText('Resume · 1:13 of 1:55')).toBeTruthy();
  });

  it('keeps the title and the resume label over the Default poster', () => {
    renderCard({ movie: { ...movie, posterUrl: null } });

    expect(screen.getByText('Comet Season')).toBeTruthy();
    expect(screen.getByText('Resume · 1:13 of 1:55')).toBeTruthy();
  });
});
