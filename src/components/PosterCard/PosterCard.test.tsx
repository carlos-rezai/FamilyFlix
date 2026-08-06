import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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
