import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useLibraryTitles } from './useLibraryTitles';
import type { LibraryTitles } from '@/types';
import {
  noContentResponse,
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import {
  makeLibraryMovie,
  makeLibrarySeries,
} from '@/test-support/makeLibraryTitle/makeLibraryTitle';

/**
 * 47 — Manage library, Phase 1: "the list, read-only" (issue #407).
 *
 * `useLibraryTitles()` → `{ titles }`: the **Library titles** the page draws,
 * read once on mount — **Blank until it lands**, `null` until then and `null`
 * still on a failed read, every Settings read's rule. Its writes, the delete
 * and Clear details, come with their phases.
 *
 * Asserted as requests against a stubbed `fetch` and what the hook hands
 * back, `useLibraryFolders`' precedent.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let fetchMock: ReturnType<typeof vi.fn<FetchFn>>;

beforeEach(() => {
  fetchMock = vi.fn<FetchFn>();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const TITLES: LibraryTitles = {
  movies: [makeLibraryMovie({ id: 'm1', title: 'Coco' })],
  series: [makeLibrarySeries({ id: 's1', title: 'Bluey' })],
};

describe('useLibraryTitles — the read', () => {
  it('reads the list route once, on mount', async () => {
    fetchMock.mockResolvedValue(okResponse(TITLES));

    const { rerender } = renderHook(() => useLibraryTitles());
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/library-titles');
  });

  it('holds titles null until the read lands', () => {
    fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

    const { result } = renderHook(() => useLibraryTitles());

    expect(result.current.titles).toBeNull();
  });

  it('hands over both lists once the read lands', async () => {
    fetchMock.mockResolvedValue(okResponse(TITLES));

    const { result } = renderHook(() => useLibraryTitles());

    await waitFor(() => expect(result.current.titles).toEqual(TITLES));
  });

  it('holds titles null still when the read fails', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    const { result } = renderHook(() => useLibraryTitles());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // Give the refused read its chance to settle before reading the state.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.titles).toBeNull();
  });

  it('holds titles null when the wire itself rejects', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));

    const { result } = renderHook(() => useLibraryTitles());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.titles).toBeNull();
  });
});

/**
 * 47 — Manage library, Phase 3: "Clear details" (issue #409).
 *
 * `clearDetails(title)` posts the clear for the title's kind — `POST
 * /api/movies/:id/clear-details` or `/series/` — and on the `200` replaces
 * that row in its list with the echo, in place. It never rejects: it resolves
 * `true` once the row is redrawn and `false` for anything else, the list left
 * as it was.
 */
const CLEARED_MOVIE = makeLibraryMovie({
  id: 'm1',
  title: 'Coco',
  year: null,
  details: 'none',
});
const CLEARED_SERIES = makeLibrarySeries({
  id: 's1',
  title: 'Bluey',
  year: null,
  details: 'none',
});

const LISTED: LibraryTitles = {
  movies: [
    makeLibraryMovie({ id: 'm0', title: 'Alien', details: 'synced' }),
    makeLibraryMovie({
      id: 'm1',
      title: 'Coco',
      year: 2017,
      details: 'synced',
    }),
    makeLibraryMovie({ id: 'm2', title: 'Heat', details: 'own' }),
  ],
  series: [makeLibrarySeries({ id: 's1', title: 'Bluey', details: 'synced' })],
};

/** The list read answered, then each write by `answer`. */
async function loadedHook(answer: () => Promise<Response>) {
  fetchMock.mockImplementation((input) =>
    String(input) === '/api/library-titles'
      ? Promise.resolve(okResponse(LISTED))
      : answer()
  );
  const hook = renderHook(() => useLibraryTitles());
  await waitFor(() => expect(hook.result.current.titles).not.toBeNull());
  return hook;
}

describe('useLibraryTitles — clearDetails', () => {
  it('posts a film’s clear to the movie route', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(okResponse(CLEARED_MOVIE))
    );

    await act(() => result.current.clearDetails(LISTED.movies[1]!));

    const write = fetchMock.mock.calls.find(
      ([input]) => String(input) !== '/api/library-titles'
    );
    expect(String(write?.[0])).toBe('/api/movies/m1/clear-details');
    expect(write?.[1]?.method).toBe('POST');
  });

  it('posts a show’s clear to the series route', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(okResponse(CLEARED_SERIES))
    );

    await act(() => result.current.clearDetails(LISTED.series[0]!));

    const write = fetchMock.mock.calls.find(
      ([input]) => String(input) !== '/api/library-titles'
    );
    expect(String(write?.[0])).toBe('/api/series/s1/clear-details');
  });

  it('replaces the film’s row with the echo, in place', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(okResponse(CLEARED_MOVIE))
    );

    await act(() => result.current.clearDetails(LISTED.movies[1]!));

    expect(result.current.titles?.movies).toEqual([
      LISTED.movies[0],
      CLEARED_MOVIE,
      LISTED.movies[2],
    ]);
    expect(result.current.titles?.series).toEqual(LISTED.series);
  });

  it('replaces the show’s row with the echo', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(okResponse(CLEARED_SERIES))
    );

    await act(() => result.current.clearDetails(LISTED.series[0]!));

    expect(result.current.titles?.series).toEqual([CLEARED_SERIES]);
    expect(result.current.titles?.movies).toEqual(LISTED.movies);
  });

  it('runs clearing waiting, then shown after 300ms, then idle after the hold', async () => {
    let answer: (response: Response) => void = () => undefined;
    const { result } = await loadedHook(
      () => new Promise<Response>((resolve) => (answer = resolve))
    );
    expect(result.current.clearing).toBe('idle');

    vi.useFakeTimers();
    try {
      let pending: Promise<boolean> | undefined;
      act(() => {
        pending = result.current.clearDetails(LISTED.movies[1]!);
      });
      expect(result.current.clearing).toBe('waiting');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      expect(result.current.clearing).toBe('shown');

      await act(async () => {
        answer(okResponse(CLEARED_MOVIE));
        await vi.advanceTimersByTimeAsync(500);
        await pending;
      });
      expect(result.current.clearing).toBe('idle');
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves true once the row is redrawn', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(okResponse(CLEARED_MOVIE))
    );

    let cleared: boolean | undefined;
    await act(async () => {
      cleared = await result.current.clearDetails(LISTED.movies[1]!);
    });

    expect(cleared).toBe(true);
  });

  it.each([
    ['a 404', () => Promise.resolve(notFoundResponse())],
    ['a server error', () => Promise.resolve(serverErrorResponse())],
    ['a network failure', () => Promise.reject(new TypeError('offline'))],
  ])(
    'never rejects on %s: false, and the list as it was',
    async (_, answer) => {
      const { result } = await loadedHook(answer);

      let cleared: boolean | undefined;
      await act(async () => {
        cleared = await result.current.clearDetails(LISTED.movies[1]!);
      });

      expect(cleared).toBe(false);
      expect(result.current.titles).toEqual(LISTED);
    }
  );
});

/**
 * 47 — Manage library, Phase 4: "delete a copied title" (issue #410).
 *
 * `deleteTitle(title)` sends the title's delete over the unchanged route —
 * `DELETE /api/movies/:id` or `/api/series/:id`, through the shared
 * `deleteMovie` / `deleteSeries` — and on `deleted` takes that row off its
 * list with no re-read, so the tab's count and the summary follow at once.
 * It never rejects: `true` once the row is gone, `false` for anything else,
 * the list as it was.
 */
describe('useLibraryTitles — deleteTitle', () => {
  const writesOf = () =>
    fetchMock.mock.calls.filter(
      ([input]) => String(input) !== '/api/library-titles'
    );

  it('sends a film’s delete to the movie route, with no body', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(noContentResponse())
    );

    await act(() => result.current.deleteTitle(LISTED.movies[1]!));

    expect(writesOf()).toHaveLength(1);
    const [input, init] = writesOf()[0]!;
    expect(String(input)).toBe('/api/movies/m1');
    expect(init?.method?.toUpperCase()).toBe('DELETE');
    expect(init?.body).toBeUndefined();
  });

  it('sends a show’s delete to the series route', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(noContentResponse())
    );

    await act(() => result.current.deleteTitle(LISTED.series[0]!));

    expect(String(writesOf()[0]?.[0])).toBe('/api/series/s1');
  });

  it('takes the film’s row off its list, the others kept in order', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(noContentResponse())
    );

    await act(() => result.current.deleteTitle(LISTED.movies[1]!));

    expect(result.current.titles?.movies).toEqual([
      LISTED.movies[0],
      LISTED.movies[2],
    ]);
    expect(result.current.titles?.series).toEqual(LISTED.series);
  });

  it('takes the show’s row off its list', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(noContentResponse())
    );

    await act(() => result.current.deleteTitle(LISTED.series[0]!));

    expect(result.current.titles?.series).toEqual([]);
    expect(result.current.titles?.movies).toEqual(LISTED.movies);
  });

  it('reads the list only once, the delete redrawn without a re-read', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(noContentResponse())
    );

    await act(() => result.current.deleteTitle(LISTED.movies[1]!));

    expect(
      fetchMock.mock.calls.filter(
        ([input]) => String(input) === '/api/library-titles'
      )
    ).toHaveLength(1);
  });

  it('holds deleting busy for the life of the request, idle after', async () => {
    let answer: (response: Response) => void = () => undefined;
    const { result } = await loadedHook(
      () => new Promise<Response>((resolve) => (answer = resolve))
    );
    expect(result.current.deleting).toBe('idle');

    let pending: Promise<boolean> | undefined;
    act(() => {
      pending = result.current.deleteTitle(LISTED.movies[1]!);
    });
    expect(result.current.deleting).toBe('waiting');

    await act(async () => {
      answer(noContentResponse());
      await pending;
    });
    expect(result.current.deleting).toBe('idle');
  });

  it('resolves true once the row is gone', async () => {
    const { result } = await loadedHook(() =>
      Promise.resolve(noContentResponse())
    );

    let deleted: boolean | undefined;
    await act(async () => {
      deleted = await result.current.deleteTitle(LISTED.movies[1]!);
    });

    expect(deleted).toBe(true);
  });

  it.each([
    ['a server error', () => Promise.resolve(serverErrorResponse())],
    ['a network failure', () => Promise.reject(new TypeError('offline'))],
  ])(
    'never rejects on %s: false, and the list as it was',
    async (_, answer) => {
      const { result } = await loadedHook(answer);

      let deleted: boolean | undefined;
      await act(async () => {
        deleted = await result.current.deleteTitle(LISTED.movies[1]!);
      });

      expect(deleted).toBe(false);
      expect(result.current.titles).toEqual(LISTED);
    }
  );
});
