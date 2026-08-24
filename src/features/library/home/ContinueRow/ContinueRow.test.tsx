import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { ContinueRow, type ContinueRowProps } from './ContinueRow';
import { theme } from '@/styles/theme';
import type { ContinueCardMovie } from '@/types';

function makeMovie(
  overrides: Partial<ContinueCardMovie> = {}
): ContinueCardMovie {
  return {
    id: 'm1',
    title: 'Comet Season',
    g1: '#1f2a3a',
    g2: '#3a6a8a',
    resumeLabel: 'Resume · 25:00 of 1:40:00',
    progress: 25,
    ...overrides,
  };
}

/** Two movies part-way through, each with its own label and progress. */
const STARTED: ContinueCardMovie[] = [
  makeMovie({
    id: 'a1',
    title: 'Northwind',
    resumeLabel: 'Resume · 25:00 of 1:40:00',
    progress: 25,
  }),
  makeMovie({
    id: 'a2',
    title: 'Ironclad',
    resumeLabel: 'Resume · 42:00',
    progress: 5,
  }),
];

function renderRow(props: Partial<ContinueRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <ContinueRow movies={props.movies ?? STARTED} {...props} />
    </ThemeProvider>
  );
}

describe('ContinueRow', () => {
  it('names the row region and its heading “Continue Watching”', () => {
    renderRow();

    expect(
      screen.getByRole('region', { name: 'Continue Watching' })
    ).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Continue Watching' })
    ).toBeDefined();
  });

  it('renders a resume tile per in-progress movie', () => {
    renderRow();

    expect(screen.getByText('Northwind')).toBeDefined();
    expect(screen.getByText('Ironclad')).toBeDefined();
  });

  it('shows each tile its own resume label', () => {
    renderRow();

    expect(screen.getByText('Resume · 25:00 of 1:40:00')).toBeDefined();
    expect(screen.getByText('Resume · 42:00')).toBeDefined();
  });

  it('renders nothing at all when nothing is in progress — no heading, no empty shelf', () => {
    const { container } = renderRow({ movies: [] });

    expect(container.innerHTML).toBe('');
    expect(screen.queryByText(/continue watching/i)).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('raises onOpenMovie with the id of the tile that was clicked', () => {
    const onOpenMovie = vi.fn();
    renderRow({ onOpenMovie });

    fireEvent.click(screen.getByText('Ironclad'));

    expect(onOpenMovie).toHaveBeenCalledWith('a2');
  });

  it('offers no “View all” — the row is not a genre and has no full page', () => {
    renderRow();

    expect(screen.queryByRole('button', { name: /view all/i })).toBeNull();
  });

  it('renders without an open callback, since it is optional', () => {
    renderRow();

    fireEvent.click(screen.getByText('Northwind'));

    expect(
      screen.getByRole('region', { name: 'Continue Watching' })
    ).toBeDefined();
  });
});
