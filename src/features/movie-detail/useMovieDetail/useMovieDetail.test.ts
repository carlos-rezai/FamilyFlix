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

/** A save this test settles by hand, so the optimistic value is observable. */
interface PendingSave {
  url: string;
  method: string;
  body: unknown;
  answer: (response: Response) => Promise<void>;
  fail: (reason: unknown) => Promise<void>;
}

/**
 * Answer the movie request with `movie`, and hold every write open until the
 * test settles it. A save that resolved on its own would make "the toggle
 * showed the new value *before* it was confirmed" untestable — the confirmation
 * would already have landed.
 */
function serveWithPendingSaves(movie: Movie): PendingSave[] {
  const saves: PendingSave[] = [];

  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'GET') {
      return Promise.resolve(okResponse(movie));
    }

    let settle!: (response: Response) => void;
    let reject!: (reason: unknown) => void;
    const pending = new Promise<Response>((resolvePending, rejectPending) => {
      settle = resolvePending;
      reject = rejectPending;
    });

    saves.push({
      url,
      method,
      body:
        init?.body === undefined ? undefined : JSON.parse(String(init.body)),
      answer: (response) => act(async () => settle(response)),
      fail: async (reason) => {
        await act(async () => {
          reject(reason);
          // Let the rejection propagate through the hook's catch before the
          // assertion that follows reads the reverted state.
          await Promise.resolve();
        });
      },
    });

    return pending;
  });

  return saves;
}

/** The saves that went to one of the two write routes. */
function savesTo(saves: PendingSave[], route: 'watched' | 'favorite') {
  return saves.filter((save) => save.url.endsWith(`/${route}`));
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

/**
 * The two toggles. Both keep the same bargain: show the new value at once, take
 * the server's echo over what was assumed, and put it back if the save fails —
 * so the page never claims something is saved that isn't.
 */
describe('useMovieDetail — the watched toggle', () => {
  it('shows the movie watched immediately, before the save is confirmed', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();
    expect(result.current.movie?.isWatched).toBe(false);

    act(() => result.current.toggleWatched());

    // The save is still in flight — nothing has confirmed anything yet.
    expect(result.current.movie?.isWatched).toBe(true);
    expect(savesTo(saves, 'watched')).toHaveLength(1);
  });

  it('saves the new value to the movie’s watched route', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie('m1');

    act(() => result.current.toggleWatched());

    const [save] = savesTo(saves, 'watched');
    expect(save.url).toBe('/api/movies/m1/watched');
    expect(save.method).toBe('POST');
    expect(save.body).toEqual({ value: true });
  });

  it('un-marks a movie marked by mistake, and says so on the way out', async () => {
    const saves = serveWithPendingSaves(makeMovie({ watched: true }));
    const { result } = await loadMovie();
    expect(result.current.movie?.isWatched).toBe(true);

    act(() => result.current.toggleWatched());

    expect(result.current.movie?.isWatched).toBe(false);
    expect(savesTo(saves, 'watched')[0].body).toEqual({ value: false });
  });

  it('takes the server’s echo when it differs from what was assumed', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.toggleWatched());
    await savesTo(saves, 'watched')[0].answer(okResponse({ value: false }));

    expect(result.current.movie?.isWatched).toBe(false);
  });

  it('reverts when the save fails', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.toggleWatched());
    expect(result.current.movie?.isWatched).toBe(true);

    await savesTo(saves, 'watched')[0].fail(new Error('network down'));

    expect(result.current.movie?.isWatched).toBe(false);
    // A failed save is not a failed page — the movie is still on screen.
    expect(result.current.status).toBe('ready');
  });

  /**
   * Marking watched clears the resume position — a documented repository
   * convention every caller shares, accepted here rather than worked around,
   * and flagged for the watch-tracking grill. The button has to stop offering a
   * resume point the server has already discarded.
   */
  it('drops the resume offer from the play button when the movie is marked watched', async () => {
    const started = makeMovie({
      watched: false,
      resumePositionSeconds: 3120,
      status: 'in-progress',
    });
    serveWithPendingSaves(started);
    const { result } = await loadMovie();
    expect(result.current.movie?.playLabel).toBe('Resume · 52:00');

    act(() => result.current.toggleWatched());

    expect(result.current.movie?.playLabel).toBe('Play');
  });

  it('does not hand the 52 minutes back when the movie is un-marked again', async () => {
    const started = makeMovie({
      watched: false,
      resumePositionSeconds: 3120,
      status: 'in-progress',
    });
    const saves = serveWithPendingSaves(started);
    const { result } = await loadMovie();

    act(() => result.current.toggleWatched());
    await savesTo(saves, 'watched')[0].answer(okResponse({ value: true }));
    act(() => result.current.toggleWatched());

    expect(result.current.movie?.isWatched).toBe(false);
    expect(result.current.movie?.playLabel).toBe('Play');
  });
});

describe('useMovieDetail — the favorite toggle', () => {
  it('arrives already filled for a movie favorited on the shelf', async () => {
    serve(makeMovie({ isFavorite: true }));

    const { result } = await loadMovie();

    expect(result.current.movie?.isFavorite).toBe(true);
  });

  it('shows the new value immediately, before the save is confirmed', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();
    expect(result.current.movie?.isFavorite).toBe(false);

    act(() => result.current.toggleFavorite());

    expect(result.current.movie?.isFavorite).toBe(true);
    expect(savesTo(saves, 'favorite')).toHaveLength(1);
  });

  it('saves through the same favorite route the shelf writes to', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie('m1');

    act(() => result.current.toggleFavorite());

    // One route, one flag — which is what makes the shelf agree when the
    // parent goes back to it.
    const [save] = savesTo(saves, 'favorite');
    expect(save.url).toBe('/api/movies/m1/favorite');
    expect(save.method).toBe('POST');
    expect(save.body).toEqual({ value: true });
  });

  it('takes the server’s echo when it differs from what was assumed', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.toggleFavorite());
    await savesTo(saves, 'favorite')[0].answer(okResponse({ value: false }));

    expect(result.current.movie?.isFavorite).toBe(false);
  });

  it('reverts when the save fails', async () => {
    const saves = serveWithPendingSaves(makeMovie({ isFavorite: true }));
    const { result } = await loadMovie();

    act(() => result.current.toggleFavorite());
    expect(result.current.movie?.isFavorite).toBe(false);

    await savesTo(saves, 'favorite')[0].fail(new Error('network down'));

    expect(result.current.movie?.isFavorite).toBe(true);
    expect(result.current.status).toBe('ready');
  });

  it('leaves the watched state alone, and the other way round', async () => {
    const saves = serveWithPendingSaves(makeMovie({ watched: true }));
    const { result } = await loadMovie();

    act(() => result.current.toggleFavorite());

    expect(result.current.movie?.isFavorite).toBe(true);
    expect(result.current.movie?.isWatched).toBe(true);
    expect(savesTo(saves, 'watched')).toHaveLength(0);
  });
});
