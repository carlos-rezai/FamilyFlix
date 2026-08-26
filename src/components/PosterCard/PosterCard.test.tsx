import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { PosterCard } from './PosterCard';
import { theme } from '@/styles/theme';
import type { PosterCardMovie } from '@/types';

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
    onToggleFav?: () => void;
    movie?: PosterCardMovie;
  } = {}
) {
  return render(
    <ThemeProvider theme={theme}>
      <PosterCard
        movie={handlers.movie ?? movie}
        onOpen={handlers.onOpen ?? (() => undefined)}
        onToggleFav={handlers.onToggleFav ?? (() => undefined)}
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

  it('calls onToggleFav when the favorite heart is clicked', () => {
    const onToggleFav = vi.fn();
    const { getByTitle } = renderCard({ onToggleFav });

    fireEvent.click(getByTitle('Favorite'));

    expect(onToggleFav).toHaveBeenCalledTimes(1);
  });

  it('does not also open the card when the favorite heart is clicked (propagation stopped)', () => {
    const onOpen = vi.fn();
    const onToggleFav = vi.fn();
    const { getByTitle } = renderCard({ onOpen, onToggleFav });

    fireEvent.click(getByTitle('Favorite'));

    expect(onToggleFav).toHaveBeenCalledTimes(1);
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
