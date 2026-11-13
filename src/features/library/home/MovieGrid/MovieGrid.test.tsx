import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { MemoryRouter } from 'react-router-dom';

import { MovieGrid } from './MovieGrid';
import { theme } from '@/styles/theme';
import type { Movie, MovieGridPayload } from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import {
  LocationProbe,
  pathname,
} from '@/test-support/LocationProbe/LocationProbe';
import { comesBefore } from '@/test-support/comesBefore/comesBefore';

/**
 * 63, Row view, Phase 3 (issue #610): Movies under **All**.
 *
 * `MovieGrid` is `SeriesHome`'s shape in films over `GET /api/movies`: the
 * Continue row, the **Favorites row** read off the grid through
 * `shelvedFavorites` (at most 15, the grid's order), _All movies_, the count
 * line `N movies` / `1 movie`, and the **Library grid**. A card opens the
 * film's page; a heart in the grid reaches the shelf.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

/** Serve one grid payload for `/api/movies`; echo every write. */
function serve(payload: MovieGridPayload) {
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if ((init?.method ?? 'GET').toUpperCase() !== 'GET') {
      const body = JSON.parse(String(init?.body)) as { value: unknown };
      return Promise.resolve(okResponse({ value: body.value }));
    }
    if (url.includes('/api/movies')) {
      return Promise.resolve(okResponse(payload));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

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

function renderGrid(url = '/') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ThemeProvider theme={theme}>
        <MovieGrid />
      </ThemeProvider>
      <LocationProbe />
    </MemoryRouter>
  );
}

const heading = () =>
  screen.findByRole('heading', { name: 'All movies', level: 2 });

const favoritesRegion = () =>
  screen.findByRole('region', { name: 'Favorites' });

const twoFilms: Movie[] = [
  makeMovie({ id: 'm1', title: 'Die Hard' }),
  makeMovie({ id: 'm2', title: 'Amelie' }),
];

describe('MovieGrid: the sections', () => {
  it('asks GET /api/movies for the query the URL carries, not /api/home', async () => {
    serve({ movies: twoFilms, continueWatching: [] });

    renderGrid('/?q=die&sort=a-z');
    await heading();

    const requested = fetchMock.mock.calls.map(([input]) => String(input));
    const grid = requested.find((url) => url.includes('/api/movies'));
    expect(grid).toBeDefined();
    expect(grid).toContain('q=die');
    expect(grid).toContain('sort=a-z');
    expect(requested.some((url) => url.includes('/api/home'))).toBe(false);
  });

  it('draws Continue Watching, Favorites, All movies and the count line, in that order', async () => {
    serve({
      movies: [
        makeMovie({ id: 'm1', title: 'Die Hard', isFavorite: true }),
        makeMovie({ id: 'm2', title: 'Amelie' }),
      ],
      continueWatching: [
        makeMovie({
          id: 'm2',
          title: 'Amelie',
          resumePositionSeconds: 600,
          status: 'in-progress',
        }),
      ],
    });

    renderGrid();

    const continueRow = await screen.findByRole('region', {
      name: 'Continue Watching',
    });
    const shelf = await favoritesRegion();
    const all = await heading();
    const count = screen.getByText('2 movies');
    expect(comesBefore(continueRow, shelf)).toBe(true);
    expect(comesBefore(shelf, all)).toBe(true);
    expect(comesBefore(all, count)).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Amelie' }).length).toBe(2);
  });

  it('reads the count line in the plural', async () => {
    serve({ movies: twoFilms, continueWatching: [] });

    renderGrid();

    expect(await screen.findByText('2 movies')).toBeDefined();
  });

  it('reads one film in the singular', async () => {
    serve({ movies: [twoFilms[0]], continueWatching: [] });

    renderGrid();

    expect(await screen.findByText('1 movie')).toBeDefined();
  });
});

describe('MovieGrid: the Favorites row', () => {
  it('holds the grid’s hearted films in the grid’s order, and no other', async () => {
    serve({
      movies: [
        makeMovie({ id: 'm1', title: 'Zodiac', isFavorite: true }),
        makeMovie({ id: 'm2', title: 'Amelie' }),
        makeMovie({ id: 'm3', title: 'Brazil', isFavorite: true }),
      ],
      continueWatching: [],
    });

    renderGrid();

    const shelf = await favoritesRegion();
    const titles = within(shelf)
      .getAllByRole('button', { name: /^(Zodiac|Amelie|Brazil)$/ })
      .map((card) => card.getAttribute('aria-label') ?? card.textContent);
    expect(titles).toEqual(['Zodiac', 'Brazil']);
  });

  it('caps the shelf at 15, the first of the grid', async () => {
    const movies = Array.from({ length: 17 }, (_, i) =>
      makeMovie({ id: `m${i}`, title: `Film ${i}`, isFavorite: true })
    );
    serve({ movies, continueWatching: [] });

    renderGrid();

    const shelf = await favoritesRegion();
    expect(
      within(shelf).getAllByRole('button', { name: /^Film \d+$/ })
    ).toHaveLength(15);
    expect(within(shelf).getByRole('button', { name: 'Film 0' })).toBeDefined();
    expect(within(shelf).queryByRole('button', { name: 'Film 15' })).toBeNull();
  });

  it('puts a film on the shelf the moment its heart is pressed in the grid', async () => {
    serve({ movies: twoFilms, continueWatching: [] });

    renderGrid();
    await heading();
    expect(screen.queryByRole('region', { name: 'Favorites' })).toBeNull();
    fireEvent.click(
      within(await screen.findByRole('button', { name: 'Amelie' })).getByRole(
        'button',
        { name: 'Favorite' }
      )
    );

    const shelf = await favoritesRegion();
    expect(within(shelf).getByRole('button', { name: 'Amelie' })).toBeDefined();
  });
});

describe('MovieGrid: opening a film', () => {
  it('opens the film’s page when its grid card is pressed', async () => {
    serve({ movies: twoFilms, continueWatching: [] });

    renderGrid();
    fireEvent.click(await screen.findByRole('button', { name: 'Amelie' }));

    expect(pathname()).toBe('/movie/m2');
  });
});
