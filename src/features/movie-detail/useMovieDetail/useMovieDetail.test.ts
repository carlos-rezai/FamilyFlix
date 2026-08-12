import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useMovieDetail } from './useMovieDetail';
import type { Movie } from '@/types';

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

const NORTHWIND = makeMovie({
  id: 'm1',
  title: 'Northwind',
  year: 1994,
  runtimeMinutes: 128,
  rating: 8,
  synopsis: 'A lighthouse keeper takes in a runaway girl.',
  director: 'Michael Rowe',
  cast: ['Ana Vega', 'Tomas Bell'],
  genres: [{ id: 'g1', name: 'Drama' }],
});

/** A different movie entirely — visible if a stale response ever wins. */
const IRONCLAD = makeMovie({
  id: 'm1',
  title: 'Ironclad',
  year: 2001,
  runtimeMinutes: 42,
});

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

function notFoundResponse(): Response {
  return {
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: 'Movie not found' }),
  } as unknown as Response;
}

function serverErrorResponse(): Response {
  return {
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error: 'boom' }),
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

/** Answer the movie request with `movie`; anything else is a request this hook shouldn't make. */
function serve(movie: Movie) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/movies/')) {
      return Promise.resolve(okResponse(movie));
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** Mount the hook for one id and wait for the initial load to settle. */
async function loadMovie(id = 'm1') {
  const view = renderHook(() => useMovieDetail(id));
  await waitFor(() => expect(view.result.current.status).not.toBe('loading'));
  return view;
}

describe('useMovieDetail — loading one movie', () => {
  it('starts out loading, holding no movie', () => {
    fetchMock.mockReturnValueOnce(new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useMovieDetail('m1'));

    expect(result.current.status).toBe('loading');
    expect(result.current.movie).toBeNull();
  });

  it('reports ready and hands back the movie mapped for the screen', async () => {
    serve(NORTHWIND);

    const { result } = await loadMovie();

    expect(result.current.status).toBe('ready');
    expect(result.current.movie?.title).toBe('Northwind');
    expect(result.current.movie?.year).toBe(1994);
    expect(result.current.movie?.runtimeLabel).toBe('2h 8m');
    expect(result.current.movie?.genres).toEqual(['Drama']);
  });

  it('asks for the movie whose id it was given, once', async () => {
    serve(NORTHWIND);

    await loadMovie('m1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/movies/m1');
  });
});

/**
 * Four states, because a movie that is gone and a movie that failed to load
 * want different buttons: `not-found` offers a way back to the library, and
 * Retry on a 404 is a button that can never work.
 */
describe('useMovieDetail — the load states', () => {
  it('reports not-found, not error, when the movie no longer exists', async () => {
    fetchMock.mockResolvedValue(notFoundResponse());

    const { result } = await loadMovie('gone');

    expect(result.current.status).toBe('not-found');
    expect(result.current.movie).toBeNull();
  });

  it('reports error when the request cannot be made at all', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const { result } = await loadMovie();

    expect(result.current.status).toBe('error');
    expect(result.current.movie).toBeNull();
  });

  it('reports error, not not-found, when the server fails', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const { result } = await loadMovie();

    expect(result.current.status).toBe('error');
  });

  it('recovers on retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { result } = await loadMovie();
    expect(result.current.status).toBe('error');

    serve(NORTHWIND);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.movie?.title).toBe('Northwind');
  });

  it('does not let a slow first load overwrite the newer one that replaced it', async () => {
    // The first request never settles until we say so; the retry lands first.
    let settleFirst: (response: Response) => void = () => undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          settleFirst = resolve;
        })
    );

    const { result } = renderHook(() => useMovieDetail('m1'));
    expect(result.current.status).toBe('loading');

    serve(NORTHWIND);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    // The abandoned load finally answers, with a movie that no longer applies.
    await act(async () => {
      settleFirst(okResponse(IRONCLAD));
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.movie?.title).toBe('Northwind');
  });
});
