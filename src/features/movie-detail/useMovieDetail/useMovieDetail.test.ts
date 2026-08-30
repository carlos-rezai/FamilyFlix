import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

import { useMovieDetail } from './useMovieDetail';
import type { Movie } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

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

/** The saves that went to one of the three write routes. */
function savesTo(
  saves: PendingSave[],
  route: 'watched' | 'favorite' | 'rating'
) {
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

/**
 * The third optimistic write, and the first one that is not a flag. It keeps
 * the identical bargain the two toggles keep — show the new value at once,
 * take the route’s echo over what was assumed, put the old value back if the
 * save is refused — hand-rolled rather than through `useOptimisticSave`,
 * because that hook reverts by negating a boolean and a rating has eleven
 * values plus an absence. What it goes back to has to be captured, not derived.
 *
 * It speaks percent on the way in and stored units on the wire: the picker
 * above it is a molecule that knows nothing about the domain, and the column
 * below it stores 0–10.
 */
describe('useMovieDetail — the rating', () => {
  it('shows the new rating immediately, before the save is confirmed', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();
    expect(result.current.movie?.ratingPercent).toBe(80);

    act(() => result.current.rate(100));

    // The save is still in flight — nothing has confirmed anything yet.
    expect(result.current.movie?.ratingPercent).toBe(100);
    expect(savesTo(saves, 'rating')).toHaveLength(1);
  });

  it('saves the new rating to the movie’s rating route, in stored units', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie('m1');

    act(() => result.current.rate(60));

    const [save] = savesTo(saves, 'rating');
    expect(save.url).toBe('/api/movies/m1/rating');
    expect(save.method).toBe('POST');
    // 60% on screen is 6 in the column — the one place the scales meet.
    expect(save.body).toEqual({ value: 6 });
  });

  it('takes the server’s echo when it differs from what was assumed', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.rate(100));
    await savesTo(saves, 'rating')[0].answer(okResponse({ value: 9 }));

    expect(result.current.movie?.ratingPercent).toBe(90);
  });

  it('takes a null echo as the movie having been cleared', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.rate(100));
    await savesTo(saves, 'rating')[0].answer(okResponse({ value: null }));

    // Unrated, not zero — the distinction the whole feature exists to keep.
    expect(result.current.movie?.ratingPercent).toBeNull();
  });

  it('clears the rating optimistically and sends null', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.rate(null));

    expect(result.current.movie?.ratingPercent).toBeNull();
    expect(savesTo(saves, 'rating')[0].body).toEqual({ value: null });
  });

  it('puts the previous rating back when the save is refused', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.rate(20));
    expect(result.current.movie?.ratingPercent).toBe(20);

    await savesTo(saves, 'rating')[0].fail(new Error('network down'));

    expect(result.current.movie?.ratingPercent).toBe(80);
  });

  it('puts an unrated movie back to unrated when the save is refused', async () => {
    // The revert has to restore an absence, which is exactly what a boolean
    // toggle’s `!value` could never express.
    const saves = serveWithPendingSaves(makeMovie({ rating: null }));
    const { result } = await loadMovie();
    expect(result.current.movie?.ratingPercent).toBeNull();

    act(() => result.current.rate(80));
    expect(result.current.movie?.ratingPercent).toBe(80);

    await savesTo(saves, 'rating')[0].fail(new Error('network down'));

    expect(result.current.movie?.ratingPercent).toBeNull();
  });

  it('puts the rating back when a clear is refused', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.rate(null));
    await savesTo(saves, 'rating')[0].fail(new Error('network down'));

    expect(result.current.movie?.ratingPercent).toBe(80);
  });

  it('costs the rating and nothing else when the save is refused', async () => {
    const saves = serveWithPendingSaves(
      makeMovie({ watched: true, isFavorite: true })
    );
    const { result } = await loadMovie();

    act(() => result.current.rate(20));
    await savesTo(saves, 'rating')[0].fail(new Error('network down'));

    // A failed save is not a failed page: the movie is still here, still
    // watched, still favorited, and the page never went to `error`.
    expect(result.current.status).toBe('ready');
    expect(result.current.movie?.title).toBe('Comet Season');
    expect(result.current.movie?.isWatched).toBe(true);
    expect(result.current.movie?.isFavorite).toBe(true);
  });

  it('discards a response that lands after the page has moved on', async () => {
    const saves = serveWithPendingSaves(NORTHWIND);
    const { result } = await loadMovie();

    act(() => result.current.rate(100));

    // The page moves on — a retry whose own load has not answered yet.
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    act(() => result.current.retry());
    expect(result.current.status).toBe('loading');

    await savesTo(saves, 'rating')[0].answer(okResponse({ value: 4 }));

    // The `editMovie` guard drops it: a save must never resurrect a movie the
    // state has already let go of.
    expect(result.current.status).toBe('loading');
    expect(result.current.movie).toBeNull();
  });

  it('does nothing at all before the movie is ready', async () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));
    const { result } = renderHook(() => useMovieDetail('m1'));
    expect(result.current.status).toBe('loading');

    act(() => result.current.rate(80));

    // The load, and no write — there is nothing yet to rate.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('leaves the two toggles alone — one click writes one value', async () => {
    const saves = serveWithPendingSaves(makeMovie({ watched: true }));
    const { result } = await loadMovie();

    act(() => result.current.rate(40));

    expect(result.current.movie?.ratingPercent).toBe(40);
    expect(result.current.movie?.isWatched).toBe(true);
    expect(savesTo(saves, 'watched')).toHaveLength(0);
    expect(savesTo(saves, 'favorite')).toHaveLength(0);
  });
});
