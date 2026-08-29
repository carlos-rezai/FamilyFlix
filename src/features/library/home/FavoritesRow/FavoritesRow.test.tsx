import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';

import { FavoritesRow, type FavoritesRowProps } from './FavoritesRow';
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
    favorite: true,
    ...overrides,
  };
}

/** Two favorites — enough that "the card that was opened" is never ambiguous. */
const FAVORITES: PosterCardMovie[] = [
  makeMovie({ id: 'a1', title: 'Northwind' }),
  makeMovie({ id: 'a2', title: 'Ironclad' }),
];

function renderRow(props: Partial<FavoritesRowProps> = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <FavoritesRow movies={props.movies ?? FAVORITES} {...props} />
    </ThemeProvider>
  );
}

/** One movie's poster card, which is a button named after the movie. */
function cardFor(title: string) {
  return screen.getByRole('button', { name: title });
}

describe('FavoritesRow', () => {
  it('names the row region and its heading “Favorites”', () => {
    renderRow();

    expect(screen.getByRole('region', { name: 'Favorites' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Favorites' })
    ).toBeDefined();
  });

  it('renders one poster card per movie it is handed', () => {
    renderRow();

    const row = within(screen.getByRole('region', { name: 'Favorites' }));
    expect(row.getAllByText('Northwind').length).toBeGreaterThan(0);
    expect(row.getAllByText('Ironclad').length).toBeGreaterThan(0);
    expect(row.getAllByRole('button', { name: /^favorite$/i })).toHaveLength(2);
  });

  it('renders nothing at all when handed no movies — no heading, no region, no empty carousel', () => {
    const { container } = renderRow({ movies: [] });

    expect(container.innerHTML).toBe('');
    expect(screen.queryByText(/favorites/i)).toBeNull();
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('raises onOpenMovie with the id of the card that was opened', () => {
    const onOpenMovie = vi.fn();
    renderRow({ onOpenMovie });

    fireEvent.click(cardFor('Ironclad'));

    expect(onOpenMovie).toHaveBeenCalledWith('a2');
  });

  it('offers no “View all” — the prototype’s section has no trailing action and no page behind it', () => {
    renderRow();

    expect(screen.queryByRole('button', { name: /view all/i })).toBeNull();
  });

  it('sets its heading at a genre row’s 22px, not Continue Watching’s 24', () => {
    renderRow();

    const heading = screen.getByRole('heading', { name: 'Favorites' });
    expect(getComputedStyle(heading).fontSize).toBe('22px');
  });

  it('gives every card a heart and opens it from the keyboard, exactly as a genre row does', () => {
    const onOpenMovie = vi.fn();
    renderRow({ onOpenMovie });

    const card = cardFor('Northwind');
    expect(card.getAttribute('tabindex')).toBe('0');
    expect(
      within(card).getByRole('button', { name: /^favorite$/i })
    ).toBeDefined();

    fireEvent.keyDown(card, { key: 'Enter' });

    expect(onOpenMovie).toHaveBeenCalledWith('a1');
  });

  it('renders without an open callback, since it is optional', () => {
    renderRow();

    fireEvent.click(cardFor('Northwind'));

    expect(screen.getByRole('region', { name: 'Favorites' })).toBeDefined();
  });
});

/** The heading's heart, which is the only svg the heading holds. */
function headingHeart() {
  const heading = screen.getByRole('heading', { name: 'Favorites' });
  return heading.querySelector('svg') as SVGSVGElement;
}

describe('FavoritesRow — the accent heart in the heading', () => {
  it('draws a heart before the word “Favorites”', () => {
    renderRow();

    const heading = screen.getByRole('heading', { name: 'Favorites' });
    const heart = headingHeart();

    expect(heart).not.toBeNull();
    expect(heading.textContent).toBe('Favorites');
    // The mark leads the heading: the prototype's svg sits ahead of the text
    // node, not after it.
    expect(
      heart.compareDocumentPosition(heading.lastChild as Node) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('draws it at 20px', () => {
    renderRow();

    const heart = headingHeart();
    expect(heart.getAttribute('width')).toBe('20');
    expect(heart.getAttribute('height')).toBe('20');
  });

  it('paints it the accent colour, from the wrapper the heart inherits', () => {
    // `HeartIcon` fills with `currentColor`, so the accent is set as `color` on
    // the wrapper around it — and that wrapper is `FavoritesRow`'s, not
    // `RowSection`'s.
    renderRow();

    const wrapper = headingHeart().parentElement as HTMLElement;
    expect(getComputedStyle(wrapper).color).toBe('rgb(217, 122, 78)');
  });

  it('carries the prototype’s 2px optical nudge', () => {
    renderRow();

    const wrapper = headingHeart().parentElement as HTMLElement;
    expect(getComputedStyle(wrapper).marginTop).toBe('2px');
  });

  it('does not announce the heart — the row is still named “Favorites” alone', () => {
    renderRow();

    expect(headingHeart().getAttribute('aria-hidden')).toBe('true');
    expect(headingHeart().getAttribute('role')).toBeNull();
    expect(screen.getByRole('region', { name: 'Favorites' })).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Favorites' })
    ).toBeDefined();
  });

  it('matches the prototype’s heading: 22px serif, 10px gap', () => {
    renderRow();

    const heading = getComputedStyle(
      screen.getByRole('heading', { name: 'Favorites' })
    );
    expect(heading.fontSize).toBe('22px');
    // jsdom re-quotes family names, so match the face rather than the token
    // string character for character.
    expect(heading.fontFamily).toContain('Source Serif 4');
    expect(heading.gap).toBe('10px');
  });
});
