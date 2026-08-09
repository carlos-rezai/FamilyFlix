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
