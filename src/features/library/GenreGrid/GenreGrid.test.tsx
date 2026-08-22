import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import { GenreGrid } from './GenreGrid';
import { GenreMoviesProvider } from '../GenreMovies/GenreMovies';
import { theme } from '@/styles/theme';
import type { GenrePayload, Movie } from '@/types';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Comet Season',
    year: 2018,
    runtimeMinutes: 90,
    synopsis: null,
    director: null,
    cast: [],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'Comet Season/comet.mp4',
    posterPath: null,
    backdropPath: null,
    genres: [],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Eighteen movies in one genre — more than the fifteen a home row caps at, so
 * "the grid shows what the row could not" is what the count proves.
 */
const ACTION: GenrePayload = {
  genre: 'Action',
  total: 18,
  movies: Array.from({ length: 18 }, (_, index) =>
    makeMovie({ id: `a${index}`, title: `Action ${index}` })
  ),
};

/** Three named movies, for the tests that click one of them. */
const NAMED: GenrePayload = {
  genre: 'Action',
  total: 3,
  movies: [
    makeMovie({ id: 'a1', title: 'Northwind' }),
    makeMovie({ id: 'a2', title: 'Ironclad' }),
    makeMovie({ id: 'a b/c', title: 'Deep Harbour' }),
  ],
};

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock =
    vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function serve(body: GenrePayload) {
  fetchMock.mockResolvedValue(okResponse(body));
}

/** Reports where the router is, so an opened card is asserted by destination. */
function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

/**
 * The grid under the provider it reads, on the real `/genre/:name` route — the
 * body half of the split, mounted the way the page mounts it.
 */
function renderGrid(url = '/genre/Action') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <Routes>
          <Route
            path="/genre/:name"
            element={
              <GenreMoviesProvider>
                <GenreGrid />
              </GenreMoviesProvider>
            }
          />
          <Route path="/movie/:id" element={<p>the movie detail page</p>} />
        </Routes>
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
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

describe('GenreGrid — the movies that came back', () => {
  it('renders one card per movie, uncapped', async () => {
    serve(ACTION);

    renderGrid();

    await screen.findByRole('button', { name: 'Action 0' });
    expect(cards()).toHaveLength(18);
    expect(screen.getByRole('button', { name: 'Action 17' })).toBeDefined();
  });

  it('renders the movies in the order the payload gave them', async () => {
    serve(NAMED);

    renderGrid();

    await screen.findByRole('button', { name: 'Northwind' });
    expect(cards().map((card) => card.getAttribute('aria-label'))).toEqual([
      'Northwind',
      'Ironclad',
      'Deep Harbour',
    ]);
  });

  it('shows no skeleton once the movies are on screen', async () => {
    serve(ACTION);

    renderGrid();

    await screen.findByRole('button', { name: 'Action 0' });
    expect(screen.queryByRole('status', { name: /loading/i })).toBeNull();
  });
});

describe('GenreGrid — the first load', () => {
  it('shows a twelve-card skeleton while the genre is still loading', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    renderGrid();

    const skeleton = screen.getByRole('status', { name: /loading/i });
    // Twelve placeholder tiles — enough to fill the fold before the real ones
    // land, each a direct child of the region that announces the load.
    expect(skeleton.children).toHaveLength(12);
  });

  it('shows no cards while the skeleton is up', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    renderGrid();

    expect(cards()).toHaveLength(0);
  });

  it('replaces the skeleton with the grid when the payload lands', async () => {
    serve(NAMED);

    renderGrid();

    expect(screen.getByRole('status', { name: /loading/i })).toBeDefined();

    await waitFor(() =>
      expect(screen.queryByRole('status', { name: /loading/i })).toBeNull()
    );
    expect(cards()).toHaveLength(3);
  });
});

describe('GenreGrid — opening a movie', () => {
  it('navigates to the detail page of the card that was clicked', async () => {
    serve(NAMED);

    renderGrid();

    fireEvent.click(await screen.findByRole('button', { name: 'Ironclad' }));

    expect(currentPath()).toBe('/movie/a2');
    expect(screen.getByText('the movie detail page')).toBeDefined();
  });

  it('encodes an id that would otherwise break the path', async () => {
    serve(NAMED);

    renderGrid();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Deep Harbour' })
    );

    expect(currentPath()).toBe('/movie/a%20b%2Fc');
    expect(screen.getByText('the movie detail page')).toBeDefined();
  });
});
