import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { LibraryGrid, type LibraryGridProps } from './LibraryGrid';
import { CARD_WIDTH } from '../CardCarousel/CardCarousel.styles';
import { theme } from '@/styles/theme';
import type { PosterCardMovie } from '@/types';

function makeMovie(overrides: Partial<PosterCardMovie> = {}): PosterCardMovie {
  return {
    id: 'm1',
    title: 'Comet Season',
    posterUrl: null,
    g1: '#1f2a3a',
    g2: '#3a6a8a',
    rating: 80,
    watched: false,
    progress: 0,
    favorite: false,
    ...overrides,
  };
}

/** Three of a genre's movies — the grid is handed the whole set, never a cap. */
const MOVIES: PosterCardMovie[] = [
  makeMovie({ id: 'a1', title: 'Northwind' }),
  makeMovie({ id: 'a2', title: 'Ironclad', favorite: true }),
  makeMovie({ id: 'a3', title: 'Deep Harbour', watched: true }),
];

function renderGrid(props: Partial<LibraryGridProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LibraryGrid movies={props.movies ?? MOVIES} {...props} />
    </ThemeProvider>
  );
}

/**
 * The grid element itself — the single container the component renders, found
 * from the container rather than by a test id, so the test says nothing about
 * how the element is marked up.
 */
function grid(container: HTMLElement) {
  return container.firstElementChild as HTMLElement;
}

/**
 * The favorite heart on the card for one movie title — found by walking up from
 * the title to the nearest ancestor that owns a heart, so it is always that
 * movie's own card and never a neighbour's.
 */
function heartFor(title: string) {
  let node: HTMLElement | null = screen.getAllByText(title)[0];
  while (node && node.querySelector('[title="Favorite"]') === null) {
    node = node.parentElement;
  }
  return within(node as HTMLElement).getByTitle('Favorite');
}

/**
 * Every poster card on screen — the buttons the cards take for their own tiles,
 * with the favorite hearts inside them filtered back out.
 */
function cards() {
  return screen
    .queryAllByRole('button')
    .filter((button) => button.getAttribute('aria-label') !== 'Favorite');
}

describe('LibraryGrid', () => {
  it('renders one card per movie', () => {
    renderGrid();

    expect(cards()).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Northwind' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ironclad' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Deep Harbour' })).toBeDefined();
  });

  it('renders no chrome of its own — no heading, no section, no “View all”', () => {
    renderGrid();

    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.queryByText(/view all/i)).toBeNull();
  });

  it('reports the id of the card that was opened', () => {
    const onOpenMovie = vi.fn();
    renderGrid({ onOpenMovie });

    fireEvent.click(screen.getByRole('button', { name: 'Ironclad' }));

    expect(onOpenMovie).toHaveBeenCalledWith('a2');
  });

  it('renders no cards for an empty list', () => {
    const { container } = renderGrid({ movies: [] });

    expect(cards()).toHaveLength(0);
    expect(grid(container).children).toHaveLength(0);
  });

  it('asks to make a non-favorite a favorite', () => {
    const onToggleFavorite = vi.fn();
    renderGrid({ onToggleFavorite });

    fireEvent.click(heartFor('Northwind'));

    // The grid inverts the card's current value on the way out, so what the
    // caller receives is the value to save — not "flip it".
    expect(onToggleFavorite).toHaveBeenCalledWith('a1', true);
  });

  it('asks to un-favorite an existing favorite', () => {
    const onToggleFavorite = vi.fn();
    renderGrid({ onToggleFavorite });

    fireEvent.click(heartFor('Ironclad'));

    expect(onToggleFavorite).toHaveBeenCalledWith('a2', false);
  });

  it('sizes its columns from the shared card width', () => {
    const { container } = renderGrid();

    // The carousels' own column width, imported rather than repeated, so the
    // grid and the rows cannot drift apart.
    expect(getComputedStyle(grid(container)).gridTemplateColumns).toContain(
      `${CARD_WIDTH}px`
    );
  });

  it('gains columns on a wide window and reflows on a narrow one', () => {
    const { container } = renderGrid();

    const style = getComputedStyle(grid(container));

    expect(style.display).toBe('grid');
    // `auto-fill` is what adds a column when there is room for one; the `1fr`
    // maximum is what makes a too-narrow track share the width it has instead
    // of overflowing the screen. A fixed column count would do neither.
    expect(style.gridTemplateColumns).toBe(
      `repeat(auto-fill, minmax(${CARD_WIDTH}px, 1fr))`
    );
  });

  it('fills each cell with a poster card, not a one-off tile', () => {
    renderGrid();

    // The card's full surface: its title below the poster, its star rating, its
    // favorite heart, and the watched badge on the one movie that has been seen.
    const watched = screen.getByRole('button', { name: 'Deep Harbour' });

    // A poster-less card carries its title twice — overlaid on the gradient
    // placeholder and again as the label below it — so this asks that the card
    // named it, not that it named it once.
    expect(within(watched).getAllByText('Deep Harbour').length).toBeGreaterThan(
      0
    );
    expect(within(watched).getByTitle('Favorite')).toBeDefined();
    expect(within(watched).getByText('4.0')).toBeDefined();
    expect(within(watched).getByRole('img', { name: 'Watched' })).toBeDefined();
  });

  it('renders without callbacks, since they are all optional', () => {
    renderGrid();

    fireEvent.click(screen.getByRole('button', { name: 'Northwind' }));
    fireEvent.click(heartFor('Northwind'));

    expect(cards()).toHaveLength(3);
  });
});
