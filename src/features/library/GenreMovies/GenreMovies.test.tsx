import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { GenreMoviesProvider, useGenreMovies } from './GenreMovies';
import { gradientFromId } from '@/utils';
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
 * Action as the route answers it: 214 movies on the shelf and 214 in the
 * payload, because this screen *is* "View all" and the route caps nothing.
 */
const ACTION: GenrePayload = {
  genre: 'Action',
  total: 214,
  movies: Array.from({ length: 214 }, (_, index) =>
    makeMovie({ id: `a${index}`, title: `Action ${index}` })
  ),
};

/** The same genre with a search narrowing the list — the total does not move. */
const NARROWED: GenrePayload = {
  genre: 'Action',
  total: 214,
  movies: [
    makeMovie({ id: 'a1', title: 'Northwind' }),
    makeMovie({ id: 'a2', title: 'Northern Star' }),
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

/**
 * Serve the genre aggregate from `payload`. Any other request is a fan-out this
 * provider has no business making.
 */
function serve(payload: GenrePayload) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/genre/')) {
      return Promise.resolve(okResponse(payload));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** Every genre request the provider has issued, as its URL. */
function genreRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/genre/'));
}

/** The path of the nth genre request, with the query string cut off. */
function requestedPath(index = 0): string {
  return genreRequests()[index].split('?')[0];
}

/** The query string of the nth genre request, parsed rather than matched. */
function requestedQuery(index = 0): URLSearchParams {
  return new URLSearchParams(genreRequests()[index].split('?')[1] ?? '');
}

/**
 * Mounts the provider under the real `/genre/:name` route, so the genre it
 * loads is the one the URL is carrying — the same way a deep link arrives.
 */
function providerAt(url: string) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route
            path="/genre/:name"
            element={<GenreMoviesProvider>{children}</GenreMoviesProvider>}
          />
        </Routes>
      </MemoryRouter>
    );
  };
}

/** Mount the hook on a genre URL, without waiting for anything. */
function mountGenre(url = '/genre/Action') {
  return renderHook(() => useGenreMovies(), { wrapper: providerAt(url) });
}

/** Mount the hook and wait for the first load to settle. */
async function loadGenre(url = '/genre/Action') {
  const view = mountGenre(url);
  await waitFor(() => expect(view.result.current.status).not.toBe('loading'));
  return view;
}

describe('GenreMovies — loading one genre', () => {
  it('is loading until the payload arrives, and ready once it has', async () => {
    serve(ACTION);

    const { result } = mountGenre();
    expect(result.current.status).toBe('loading');

    await waitFor(() => expect(result.current.status).toBe('ready'));
  });

  it('asks the route for the genre the URL is carrying', async () => {
    serve(ACTION);

    await loadGenre('/genre/Action');

    expect(requestedPath()).toBe('/api/genre/Action');
  });

  it('names the routed genre before the payload arrives, so the header can paint', () => {
    // The heading is the genre the parent asked for, which the URL already
    // knows — it does not have to wait on a request to say so.
    serve(ACTION);

    const { result } = mountGenre('/genre/Action');

    expect(result.current.status).toBe('loading');
    expect(result.current.genre).toBe('Action');
  });

  it('reports every movie the genre holds, uncapped', async () => {
    // A row caps at 15; this screen is what "View all" opens, so a cap here
    // would leave movies unreachable by any route in the app.
    serve(ACTION);

    const { result } = await loadGenre();

    expect(result.current.movies).toHaveLength(214);
    expect(result.current.movies[213].title).toBe('Action 213');
  });

  it('reports the unfiltered total while a search narrows the movies', async () => {
    serve(NARROWED);

    const { result } = await loadGenre('/genre/Action?q=north');

    expect(result.current.movies).toHaveLength(2);
    expect(result.current.total).toBe(214);
  });

  it('hands back the settled query the movies were loaded for', async () => {
    // The same value the request was built from, so nothing describing the
    // result can name a filter the request ignored.
    serve(NARROWED);

    const { result } = await loadGenre('/genre/Action?q=north&sort=a-z');

    expect(result.current.query).toEqual({ sort: 'a-z', search: 'north' });
  });

  it('holds no movies while the first load is still in flight', () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => undefined));

    const { result } = mountGenre();

    expect(result.current.movies).toEqual([]);
  });
});

describe('GenreMovies — the movies it reports', () => {
  it('reports them as the view models a poster card renders', async () => {
    serve({
      genre: 'Action',
      total: 1,
      movies: [
        makeMovie({
          id: 'a1',
          title: 'Northwind',
          posterPath: 'Northwind/poster.jpg',
          rating: 8,
          isFavorite: true,
          watched: true,
        }),
      ],
    });

    const { result } = await loadGenre();

    expect(result.current.movies[0]).toMatchObject({
      id: 'a1',
      title: 'Northwind',
      posterUrl: '/api/images/Northwind/poster.jpg',
      rating: 80,
      favorite: true,
      watched: true,
    });
  });

  it('gives a movie with no poster the gradient stops its id hashes to', async () => {
    serve({
      genre: 'Action',
      total: 1,
      movies: [makeMovie({ id: 'a1', posterPath: null })],
    });

    const { result } = await loadGenre();

    const { g1, g2 } = gradientFromId('a1');
    expect(result.current.movies[0].posterUrl).toBeNull();
    expect(result.current.movies[0].g1).toBe(g1);
    expect(result.current.movies[0].g2).toBe(g2);
  });

  it('keeps the order the route returned them in', async () => {
    // The server owns the order; nothing is re-sorted after it lands.
    serve({
      genre: 'Action',
      total: 3,
      movies: [
        makeMovie({ id: 'a1', title: 'Zephyr' }),
        makeMovie({ id: 'a2', title: 'Ironclad' }),
        makeMovie({ id: 'a3', title: 'Northwind' }),
      ],
    });

    const { result } = await loadGenre('/genre/Action?sort=a-z');

    expect(result.current.movies.map((movie) => movie.title)).toEqual([
      'Zephyr',
      'Ironclad',
      'Northwind',
    ]);
  });
});

describe('GenreMovies — the genre in the path', () => {
  it('loads a genre whose name has a space in it, decoded out of the path', async () => {
    serve({ genre: 'Science Fiction', total: 4, movies: [] });

    const { result } = await loadGenre('/genre/Science%20Fiction');

    expect(result.current.genre).toBe('Science Fiction');
    expect(requestedPath()).toBe('/api/genre/Science%20Fiction');
  });

  it('never sends the genre as a query parameter', async () => {
    serve(ACTION);

    await loadGenre('/genre/Action?q=north');

    expect(requestedQuery().has('genre')).toBe(false);
  });
});

describe('GenreMovies — the query in the URL', () => {
  it('asks already narrowed and ordered when the URL arrives carrying both', async () => {
    // A deep link loads the screen it names, with no unnarrowed genre flashing
    // past first: the query is known on the very first render.
    serve(NARROWED);

    await loadGenre('/genre/Action?q=north&sort=a-z');

    expect(genreRequests()).toHaveLength(1);
    expect(requestedQuery().get('q')).toBe('north');
    expect(requestedQuery().get('sort')).toBe('a-z');
  });

  it('asks a clean URL for a genre nothing is narrowing', async () => {
    serve(ACTION);

    await loadGenre('/genre/Action');

    expect(genreRequests()[0]).toBe('/api/genre/Action');
  });

  it('ignores a rating the URL is carrying, having no control for one', async () => {
    // The URL and the screen must agree: a hand-edited cut-off can never narrow
    // a grid behind a control that isn't there.
    serve(ACTION);

    await loadGenre('/genre/Action?rating=7');

    expect(requestedQuery().has('rating')).toBe(false);
    expect(genreRequests()[0]).toBe('/api/genre/Action');
  });
});

describe('GenreMovies — one request for the whole screen', () => {
  /** A consumer that prints what it reads, so two of them can be told apart. */
  function Consumer({ label }: { label: string }) {
    const { status, genre, total, movies } = useGenreMovies();
    return (
      <p data-testid={label}>
        {status} · {genre} · {total} · {movies.length}
      </p>
    );
  }

  function readingOf(label: string) {
    return screen.getByTestId(label).textContent;
  }

  it('serves the heading and the grid from one request, not one each', async () => {
    // The header and the body are two subtrees over one payload. A hook called
    // in both would be two requests for one screen.
    serve(NARROWED);

    render(
      <MemoryRouter initialEntries={['/genre/Action?q=north']}>
        <Routes>
          <Route
            path="/genre/:name"
            element={
              <GenreMoviesProvider>
                <Consumer label="heading" />
                <Consumer label="grid" />
              </GenreMoviesProvider>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(readingOf('heading')).toContain('ready'));

    expect(genreRequests()).toHaveLength(1);
    expect(readingOf('heading')).toBe('ready · Action · 214 · 2');
    expect(readingOf('grid')).toBe(readingOf('heading'));
  });
});
