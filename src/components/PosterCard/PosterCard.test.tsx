import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PosterCard } from './PosterCard';
import { theme } from '@/styles/theme';
import type { PosterCardMovie } from '@/types';
import {
  normCss,
  resolvedStyle,
} from '@/test-support/resolvedStyle/resolvedStyle';

const movie: PosterCardMovie = {
  id: 'm1',
  title: 'Comet Season',
  posterUrl: null,
  g1: '#1f2a3a',
  g2: '#3a6a8a',
  rating: 80,
  watched: false,
  progress: 0,
  favorite: false,
};

function renderCard(
  handlers: {
    onOpen?: () => void;
    onToggleFavorite?: () => void;
    movie?: PosterCardMovie;
  } = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <PosterCard
        movie={handlers.movie ?? movie}
        onOpen={handlers.onOpen ?? (() => undefined)}
        onToggleFavorite={handlers.onToggleFavorite ?? (() => undefined)}
      />
    </ThemeProvider>
  );
}

describe('PosterCard', () => {
  it('calls onOpen when the card is clicked', () => {
    const onOpen = vi.fn();
    const { container } = renderCard({ onOpen });

    fireEvent.click(container.firstChild as Element);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('calls onToggleFavorite when the favorite heart is clicked', () => {
    const onToggleFavorite = vi.fn();
    const { getByTitle } = renderCard({ onToggleFavorite });

    fireEvent.click(getByTitle('Favorite'));

    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('does not also open the card when the favorite heart is clicked (propagation stopped)', () => {
    const onOpen = vi.fn();
    const onToggleFavorite = vi.fn();
    const { getByTitle } = renderCard({ onOpen, onToggleFavorite });

    fireEvent.click(getByTitle('Favorite'));

    expect(onToggleFavorite).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('reports an unfavorited movie as an unpressed heart', () => {
    const { getByTitle } = renderCard();

    expect(getByTitle('Favorite').getAttribute('aria-pressed')).toBe('false');
  });

  it('reports a favorited movie as a pressed heart', () => {
    const { getByTitle } = renderCard({
      movie: { ...movie, favorite: true },
    });

    expect(getByTitle('Favorite').getAttribute('aria-pressed')).toBe('true');
  });
});

describe('PosterCard — opening it without a mouse', () => {
  /** The card's own control, as distinct from the heart sitting inside it. */
  const cardControl = () =>
    screen.getByRole('button', { name: 'Comet Season' });

  it('exposes a control named for the movie', () => {
    renderCard();

    expect(cardControl()).toBeTruthy();
  });

  it('gives that control a tab stop, so it can be reached at all', () => {
    renderCard();
    const card = cardControl();

    card.focus();

    expect(document.activeElement).toBe(card);
  });

  it('opens the movie when Enter is pressed on the card', () => {
    const onOpen = vi.fn();
    renderCard({ onOpen });

    fireEvent.keyDown(cardControl(), { key: 'Enter' });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens the movie when Space is pressed on the card', () => {
    const onOpen = vi.fn();
    renderCard({ onOpen });

    fireEvent.keyDown(cardControl(), { key: ' ' });

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('ignores keys that are not activation keys', () => {
    const onOpen = vi.fn();
    renderCard({ onOpen });

    fireEvent.keyDown(cardControl(), { key: 'ArrowRight' });

    // Arrow keys scroll the carousel this card sits in — the card must not
    // swallow them by treating every key as "open".
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('keeps the favorite heart separately reachable', () => {
    const { getByTitle } = renderCard();
    const heart = getByTitle('Favorite');

    heart.focus();

    expect(document.activeElement).toBe(heart);
  });

  it('does not open the card when Enter is pressed on the favorite heart', () => {
    const onOpen = vi.fn();
    const { getByTitle } = renderCard({ onOpen });

    // The card's key handler sits on an ancestor of the heart, so without the
    // heart stopping the key too, favouriting from the keyboard would also open
    // the movie — the exact bug the click handler already guards against.
    fireEvent.keyDown(getByTitle('Favorite'), { key: 'Enter' });

    expect(onOpen).not.toHaveBeenCalled();
  });

  it('does not open the card when Space is pressed on the favorite heart', () => {
    const onOpen = vi.fn();
    const { getByTitle } = renderCard({ onOpen });

    fireEvent.keyDown(getByTitle('Favorite'), { key: ' ' });

    expect(onOpen).not.toHaveBeenCalled();
  });
});

/**
 * The card offers the heart and nothing else, on purpose. Ten **Half-star
 * segments** on a 210px tile is a mis-click hazard on the screen the parents
 * use most, so rating stays something you open a movie to do — a deliberate act
 * rather than something a scroll can trigger. The stars here are still a
 * reading, not a control.
 */
describe('PosterCard — what it deliberately does not offer', () => {
  it('holds exactly two controls: the card itself and the heart', () => {
    renderCard();

    const controls = screen
      .getAllByRole('button')
      .map((control) => control.getAttribute('title') ?? control.textContent);

    expect(controls).toHaveLength(2);
    expect(controls).toContain('Favorite');
  });

  it('draws its stars as a reading, with nothing on them to click', () => {
    renderCard({ movie: { ...movie, rating: 70 } });

    // A rating picker would put a control on every half-star; the card's row is
    // display-only, so the only button inside it is the heart.
    expect(screen.queryAllByRole('button', { name: '' })).toHaveLength(0);
  });

  // 14 — Export (issue #137): the export is the maintainer's, behind the gear.
  it('offers no export control', () => {
    renderCard();

    expect(screen.queryByRole('button', { name: /export/i })).toBeNull();
    expect(screen.queryByText(/export/i)).toBeNull();
  });
});

/**
 * The tile used to print `★★★★★ 0.0` for a movie nobody had rated, which is
 * character-for-character what it prints for a movie rated nought. The
 * ambiguity is closed by dropping the number rather than the stars: the star
 * row is fixed furniture in a fixed-height tile, and taking it away would leave
 * the cards in a carousel row sitting at different heights.
 */
describe('PosterCard — an unrated movie is not a zero-rated one', () => {
  it('shows five stars and no number for an unrated movie', () => {
    const { container } = renderCard({ movie: { ...movie, rating: null } });

    expect(container.textContent).toContain('★★★★★');
    expect(screen.queryByText('0.0')).toBeNull();
  });

  it('shows five stars and 0.0 for a movie genuinely rated zero', () => {
    const { container } = renderCard({ movie: { ...movie, rating: 0 } });

    expect(container.textContent).toContain('★★★★★');
    expect(screen.getByText('0.0')).toBeTruthy();
  });

  it('keeps the star row on an unrated card, so tiles stay the same height', () => {
    // jsdom measures nothing, so the height claim is asserted through a
    // documented proxy: the unrated card renders the same star markup as a
    // rated one, and only the numeric value differs between them.
    const unrated = renderCard({ movie: { ...movie, rating: null } });
    const rated = renderCard({ movie: { ...movie, rating: 80 } });

    const starsIn = (view: { container: HTMLElement }) =>
      (view.container.textContent ?? '').match(/★★★★★/g) ?? [];

    expect(starsIn(unrated).length).toBeGreaterThan(0);
    expect(starsIn(unrated)).toHaveLength(starsIn(rated).length);
  });
});

/**
 * 21 — Motion & interaction states, Phase 5 (issue #185): the poster on the
 * Card vocabulary — `cardLift` on the tile, `cardFocus` on the root — and the
 * heart on the Control's, as `mol.PosterCard.dc.html` draws them.
 *
 * jsdom computes no `:hover`, `:active` or `:focus-visible`, so each state is
 * what the injected stylesheet resolves to for the element in that state — the
 * cascade run by `resolvedStyle` — never a computed style.
 */
describe('PosterCard — hover, press and keyboard focus', () => {
  const c = theme.colors;

  /** The focusable root: the one element named for the movie. */
  function card(): HTMLElement {
    return screen.getByRole('button', { name: movie.title });
  }

  /** The 2:3 poster tile — the root's first child, the art's frame. */
  function tile(): Element {
    const first = card().firstElementChild;
    if (first === null) throw new Error('the card has no tile');
    return first;
  }

  function heart(): HTMLElement {
    return screen.getByRole('button', { name: 'Favorite' });
  }

  /**
   * Every rule that styles an element because an *ancestor* is hovered —
   * `:hover` followed by a combinator. `resolvedStyle` reads no combinator,
   * so a lift written that way is found here instead.
   */
  function descendantHoverRules(): string[] {
    const css = Array.from(document.querySelectorAll('style'))
      .map((tag) => tag.textContent ?? '')
      .join('\n');
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .filter(([, selector]) => /:hover[^,{]*?[\s>+~]\S/.test(selector.trim()))
      .map(([rule]) => rule);
  }

  it('rests the tile on the 0 6px 20px shadow, easing at durBase on easeOut', () => {
    renderCard();

    const resting = resolvedStyle(tile());
    expect(resting['box-shadow']).toBe(normCss('0 6px 20px rgba(0,0,0,.35)'));
    expect(resting.transition ?? '').toContain(
      normCss(`transform ${theme.motion.durBase} ${theme.motion.easeOut}`)
    );
    expect(resting.transition ?? '').not.toContain('.18s');
  });

  it('lifts the poster 4px on hover, with the deeper shadow and an accent edge', () => {
    renderCard();

    const hover = resolvedStyle(tile(), { hover: true });
    expect(hover.transform).toBe(normCss('translateY(-4px)'));
    expect(hover['box-shadow']).toBe(normCss('0 14px 34px rgba(0,0,0,.5)'));
    expect(hover['border-color']).toBe(normCss(c.accentLine));
  });

  it('settles the poster to translateY(-1px) on press, in 70ms', () => {
    renderCard();

    const press = resolvedStyle(tile(), { hover: true, active: true });
    expect(press.transform).toBe(normCss('translateY(-1px)'));
    expect(press['transition-duration']).toBe('70ms');
  });

  it('does not lift the poster when only its title is hovered', () => {
    renderCard();

    // The poster lifts under its own hover…
    expect(resolvedStyle(tile(), { hover: true })['border-color']).toBe(
      normCss(c.accentLine)
    );
    // …but the pointer on the title below hovers the root, not the tile: the
    // root and the title draw no lift, and no rule lifts the tile off an
    // ancestor's hover.
    const titles = screen.getAllByText(movie.title);
    const titleBelow = titles[titles.length - 1];
    expect(resolvedStyle(card(), { hover: true }).transform).toBeUndefined();
    expect(
      resolvedStyle(titleBelow, { hover: true }).transform
    ).toBeUndefined();
    expect(descendantHoverRules()).toEqual([]);
  });

  it('draws the card outline clear of the artwork under Tab, on the poster’s radius', () => {
    renderCard();

    const focus = resolvedStyle(card(), { focusVisible: true });
    expect(focus.outline).toBe(normCss(`2px solid ${c.focusRing}`));
    expect(focus['outline-offset']).toBe('4px');
    expect(focus['border-radius']).toBe(theme.radius.md);
  });

  it('draws the control ring, not the card outline, when Tab lands on the heart', () => {
    renderCard();

    // The card's own outline is there to be told apart from…
    expect(resolvedStyle(card(), { focusVisible: true }).outline).toBe(
      normCss(`2px solid ${c.focusRing}`)
    );
    // …and the heart wears the Control's ring instead.
    const focus = resolvedStyle(heart(), { focusVisible: true });
    expect(focus['box-shadow']).toBe(normCss(`0 0 0 3px ${c.focusRing}`));
    expect(focus.outline).toBe('none');
  });

  it('grows the heart and darkens its backing on hover', () => {
    renderCard();

    const hover = resolvedStyle(heart(), { hover: true });
    expect(hover.background).toBe(normCss('rgba(18,14,10,.82)'));
    expect(hover['border-color']).toBe(normCss('rgba(255,255,255,.45)'));
    expect(hover.transform).toBe(normCss('scale(1.08)'));
  });

  it('shrinks the heart to scale(.92) on press, in 60ms', () => {
    renderCard();

    const press = resolvedStyle(heart(), { hover: true, active: true });
    expect(press.transform).toBe(normCss('scale(.92)'));
    expect(press['transition-duration']).toBe('60ms');
  });
});
