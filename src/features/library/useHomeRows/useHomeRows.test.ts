import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useHomeRows } from './useHomeRows';
import type { GenreRowModel, HomePayload, Movie } from '@/types';

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

/** One movie per row, so "the favorite in Action" is never ambiguous. */
const HOME_PAYLOAD: HomePayload = {
  continueWatching: [],
  rows: [
    {
      genre: 'Action',
      count: 3,
      movies: [makeMovie({ id: 'a1', title: 'Northwind', isFavorite: false })],
    },
    {
      genre: 'Comedy',
      count: 2,
      movies: [
        makeMovie({ id: 'c1', title: 'Comet Season', isFavorite: true }),
      ],
    },
  ],
};

/**
 * The same payload with the continue section populated — the movie is
 * part-way through and so appears in both sections, exactly as the aggregate
 * builds it.
 */
const STARTED_PAYLOAD: HomePayload = {
  continueWatching: [
    makeMovie({
      id: 'a1',
      title: 'Northwind',
      resumePositionSeconds: 4380,
      status: 'in-progress',
    }),
  ],
  rows: HOME_PAYLOAD.rows,
};

/** The same movie tagged with two genres — it earns a card in both rows. */
const SHARED_MOVIE_PAYLOAD: HomePayload = {
  continueWatching: [],
  rows: [
    {
      genre: 'Action',
      count: 1,
      movies: [makeMovie({ id: 'x1', title: 'Ironclad', isFavorite: false })],
    },
    {
      genre: 'Thriller',
      count: 1,
      movies: [makeMovie({ id: 'x1', title: 'Ironclad', isFavorite: false })],
    },
  ],
};

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
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

/**
 * Serve the home aggregate from `payload`, and every favorite save from
 * `onFavorite`. Any other request is a fan-out this hook shouldn't make.
 */
function serve(
  payload: HomePayload,
  onFavorite: () => Promise<Response> = () =>
    Promise.resolve(okResponse({ value: true }))
) {
  fetchMock.mockImplementation((input) => {
    const url = String(input);
    if (url.includes('/api/home')) {
      return Promise.resolve(okResponse(payload));
    }
    if (url.includes('/favorite')) {
      return onFavorite();
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** Mount the hook and wait for the initial load to settle. */
async function loadRows() {
  const view = renderHook(() => useHomeRows());
  await waitFor(() => expect(view.result.current.status).not.toBe('loading'));
  return view;
}

/** Whether one movie reads as a favorite in one genre's row. */
function favoriteIn(rows: GenreRowModel[], genre: string, id: string) {
  return rows
    .find((row) => row.genre === genre)
    ?.movies.find((movie) => movie.id === id)?.favorite;
}

interface FavoriteRequest {
  url: string;
  method: string | undefined;
  contentType: string | null;
  body: unknown;
}

function contentTypeOf(init?: RequestInit): string | null {
  const headers = init?.headers;
  if (!headers) {
    return null;
  }
  if (Array.isArray(headers)) {
    const pair = headers.find(([key]) => key.toLowerCase() === 'content-type');
    return pair ? pair[1] : null;
  }
  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('content-type');
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find(
    (name) => name.toLowerCase() === 'content-type'
  );
  return key === undefined ? null : record[key];
}

/** Every favorite save the hook has attempted, in order. */
function favoriteRequests(): FavoriteRequest[] {
  return fetchMock.mock.calls
    .filter(([input]) => String(input).includes('/favorite'))
    .map(([input, init]) => ({
      url: String(input),
      method: init?.method,
      contentType: contentTypeOf(init),
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    }));
}

describe('useHomeRows — loading the library', () => {
  it('maps the payload into render-ready rows and reports ready', async () => {
    serve(HOME_PAYLOAD);

    const { result } = await loadRows();

    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);

    const [action] = result.current.rows;
    // The true total survives; the movies are narrowed to card view models.
    expect(action.count).toBe(3);
    expect(action.movies).toHaveLength(1);
    expect(action.movies[0].title).toBe('Northwind');
    expect(action.movies[0].favorite).toBe(false);
  });

  it('loads the whole home in one request, never one per genre', async () => {
    serve(HOME_PAYLOAD);

    await loadRows();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('renders the genre rows unchanged when a continue section arrives too', async () => {
    // The section is fetched in the same request but has no surface yet; the
    // screen must look exactly as it does today, and one request still means
    // one loading transition.
    serve(STARTED_PAYLOAD);

    const { result } = await loadRows();

    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
    expect(result.current.rows[0].movies.map((movie) => movie.title)).toEqual([
      'Northwind',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports error and holds no rows when the load fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));

    const { result } = await loadRows();

    expect(result.current.status).toBe('error');
    expect(result.current.rows).toEqual([]);
  });

  it('recovers on retry', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    const { result } = await loadRows();
    expect(result.current.status).toBe('error');

    serve(HOME_PAYLOAD);
    act(() => result.current.retry());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
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

    const { result } = renderHook(() => useHomeRows());
    expect(result.current.status).toBe('loading');

    serve(HOME_PAYLOAD);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('ready'));

    // The abandoned load finally answers, with a library that no longer applies.
    await act(async () => {
      settleFirst(okResponse(SHARED_MOVIE_PAYLOAD));
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.rows.map((row) => row.genre)).toEqual([
      'Action',
      'Comedy',
    ]);
  });
});

describe('useHomeRows — the favorite flag', () => {
  it('shows the new value immediately, before the save has come back', async () => {
    // A save that never settles: anything set here is optimistic, not confirmed.
    serve(HOME_PAYLOAD, () => new Promise<Response>(() => undefined));
    const { result } = await loadRows();

    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(false);

    act(() => result.current.toggleFavorite('a1', true));

    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(true);
  });

  it('saves the new value to POST /api/movies/:id/favorite', async () => {
    serve(HOME_PAYLOAD);
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));

    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));

    const [request] = favoriteRequests();
    expect(request.url).toContain('/api/movies/a1/favorite');
    expect(request.method?.toUpperCase()).toBe('POST');
    expect(request.contentType).toMatch(/application\/json/i);
    expect(request.body).toEqual({ value: true });
  });

  it('saves `false` when an existing favorite is un-favorited', async () => {
    serve(HOME_PAYLOAD, () => Promise.resolve(okResponse({ value: false })));
    const { result } = await loadRows();

    expect(favoriteIn(result.current.rows, 'Comedy', 'c1')).toBe(true);

    act(() => result.current.toggleFavorite('c1', false));

    expect(favoriteIn(result.current.rows, 'Comedy', 'c1')).toBe(false);
    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
    expect(favoriteRequests()[0].url).toContain('/api/movies/c1/favorite');
    expect(favoriteRequests()[0].body).toEqual({ value: false });
  });

  it('keeps the new value once the save succeeds', async () => {
    serve(HOME_PAYLOAD);
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));

    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(true);
  });

  it('adopts what the route echoes back when it disagrees with what was asked', async () => {
    // The route reports it stored `false`; that is the truth, not our assumption.
    serve(HOME_PAYLOAD, () => Promise.resolve(okResponse({ value: false })));
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));
    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(true);

    await waitFor(() =>
      expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(false)
    );
  });

  it('reverts when the save fails, so it never claims something is saved', async () => {
    serve(HOME_PAYLOAD, () => Promise.reject(new Error('network down')));
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));
    expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(true);

    await waitFor(() =>
      expect(favoriteIn(result.current.rows, 'Action', 'a1')).toBe(false)
    );
  });

  it('reverts when the server rejects the save', async () => {
    serve(HOME_PAYLOAD, () => Promise.resolve(serverErrorResponse()));
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('c1', false));
    expect(favoriteIn(result.current.rows, 'Comedy', 'c1')).toBe(false);

    await waitFor(() =>
      expect(favoriteIn(result.current.rows, 'Comedy', 'c1')).toBe(true)
    );
  });

  it('sets the same movie in every genre row it appears in', async () => {
    serve(SHARED_MOVIE_PAYLOAD);
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('x1', true));

    expect(favoriteIn(result.current.rows, 'Action', 'x1')).toBe(true);
    expect(favoriteIn(result.current.rows, 'Thriller', 'x1')).toBe(true);

    // One movie, one save — not one per card.
    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
  });

  it('reverts the same movie in every genre row when the save fails', async () => {
    serve(SHARED_MOVIE_PAYLOAD, () =>
      Promise.reject(new Error('network down'))
    );
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('x1', true));

    await waitFor(() =>
      expect(favoriteIn(result.current.rows, 'Action', 'x1')).toBe(false)
    );
    expect(favoriteIn(result.current.rows, 'Thriller', 'x1')).toBe(false);
  });
});
