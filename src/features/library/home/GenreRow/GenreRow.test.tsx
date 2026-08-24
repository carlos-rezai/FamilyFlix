import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { GenreRow, type GenreRowProps } from './GenreRow';
import { theme } from '@/styles/theme';
import type { GenreRowModel, PosterCardMovie } from '@/types';

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

/**
 * Two cards, but a genre total of 214 — the row is handed the **true total**,
 * not the number of cards it happens to show.
 */
const ACTION: GenreRowModel = {
  genre: 'Action',
  count: 214,
  movies: [
    makeMovie({ id: 'a1', title: 'Northwind' }),
    makeMovie({ id: 'a2', title: 'Ironclad', favorite: true }),
  ],
};

function renderRow(props: Partial<GenreRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <GenreRow row={props.row ?? ACTION} {...props} />
    </ThemeProvider>
  );
}

/**
 * The favorite heart on the card for one movie title — found by walking up
 * from the title to the nearest ancestor that owns a heart, so it is always
 * that movie's own card and never a neighbour's.
 */
function heartFor(title: string) {
  let node: HTMLElement | null = screen.getAllByText(title)[0];
  while (node && node.querySelector('[title="Favorite"]') === null) {
    node = node.parentElement;
  }
  return within(node as HTMLElement).getByTitle('Favorite');
}

describe('GenreRow', () => {
  it('names the row region after its genre', () => {
    renderRow();

    expect(screen.getByRole('region', { name: 'Action' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Action' })
    ).toBeDefined();
  });

  it('shows the genre’s true total in “View all”, not the number of cards', () => {
    renderRow();

    expect(screen.getByRole('button', { name: /view all 214/i })).toBeDefined();
    expect(screen.queryByRole('button', { name: /view all 2\b/i })).toBeNull();
  });

  it('renders a card per movie in the row', () => {
    renderRow();

    expect(screen.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Ironclad').length).toBeGreaterThan(0);
  });

  it('raises onOpenAll when “View all” is used', () => {
    const onOpenAll = vi.fn();
    renderRow({ onOpenAll });

    fireEvent.click(screen.getByRole('button', { name: /view all 214/i }));

    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });

  it('raises onOpenMovie with the id of the card that was opened', () => {
    const onOpenMovie = vi.fn();
    renderRow({ onOpenMovie });

    fireEvent.click(screen.getAllByText('Ironclad')[0]);

    expect(onOpenMovie).toHaveBeenCalledWith('a2');
  });

  it('asks to make a non-favorite a favorite', () => {
    const onToggleFavorite = vi.fn();
    renderRow({ onToggleFavorite });

    fireEvent.click(heartFor('Northwind'));

    // The row inverts the card's current value on the way out, so what the
    // caller receives is the value to save — not "flip it".
    expect(onToggleFavorite).toHaveBeenCalledWith('a1', true);
  });

  it('asks to un-favorite an existing favorite', () => {
    const onToggleFavorite = vi.fn();
    renderRow({ onToggleFavorite });

    fireEvent.click(heartFor('Ironclad'));

    expect(onToggleFavorite).toHaveBeenCalledWith('a2', false);
  });

  it('renders without callbacks, since they are all optional', () => {
    renderRow();

    fireEvent.click(screen.getByRole('button', { name: /view all 214/i }));
    fireEvent.click(heartFor('Northwind'));

    expect(screen.getByRole('region', { name: 'Action' })).toBeDefined();
  });
});
