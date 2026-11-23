import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { LibraryGrid } from './LibraryGrid';
import { theme } from '@/styles/theme';
import type { PosterCardMovie } from '@/types';
import { makePosterCardMovie } from '@/test-support/makePosterCardMovie/makePosterCardMovie';
import { stubImage } from '@/test-support/stubImage/stubImage';

/**
 * The **Warm start** through the grid: a card someone is about to open has its
 * **Detail backdrop** fetched and decoded ahead, so the page opens with it.
 * `warmArt` keeps what it warmed for the life of the page, so each test hovers
 * a film of its own.
 */
describe('LibraryGrid — the Warm start', () => {
  const images = stubImage();

  function film(id: string, title: string): PosterCardMovie {
    return {
      ...makePosterCardMovie({ id, title }),
      backdropUrl: `/api/images/${id}/backdrop.jpg`,
    } as PosterCardMovie;
  }

  function renderGrid(movies: PosterCardMovie[]) {
    render(
      <ThemeProvider theme={theme}>
        <LibraryGrid movies={movies} />
      </ThemeProvider>
    );
  }

  it('warms a hovered card’s backdrop, and only that card’s', () => {
    renderGrid([film('h1', 'Northwind'), film('h2', 'Ironclad')]);

    fireEvent.pointerEnter(screen.getByRole('button', { name: 'Ironclad' }));

    expect(images.sources()).toEqual(['/api/images/h2/backdrop.jpg']);
  });

  it('warms a focused card’s backdrop', () => {
    renderGrid([film('f1', 'Northwind'), film('f2', 'Ironclad')]);

    fireEvent.focus(screen.getByRole('button', { name: 'Northwind' }));

    expect(images.sources()).toEqual(['/api/images/f1/backdrop.jpg']);
  });
});
