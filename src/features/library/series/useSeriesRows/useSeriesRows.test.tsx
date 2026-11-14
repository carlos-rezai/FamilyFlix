import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { useSeriesRows } from './useSeriesRows';
import type { PosterCardMovie, Series, SeriesRowsPayload } from '@/types';
import { okResponse } from '@/test-support/fakeResponse/fakeResponse';

/**
 * 63, Row view, the closing round (issue #616): a confirmed series heart
 * settles the By genre shelf as a movie heart does. A heart puts its card at
 * the shelf's front, which is not where the server's sort or its cap of 15
 * would, so once every save in flight has landed `/api/series/rows` is read
 * again. An un-heart and a refused heart reload nothing. `useMovieRows.test`'s
 * shape, over series.
 */

/** A series record, every field the type asks for, the given ones over it. */
function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2021,
    endYear: null,
    synopsis: null,
    creator: null,
    cast: [],
    rating: null,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    originalTitle: null,
    tmdbScore: null,
    genres: [],
    watched: false,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

/** `Lantern Road` on the shelf; `Northwind` and `Comet Season` in rows. */
const ROWS_PAYLOAD: SeriesRowsPayload = {
  continueWatching: [],
  favorites: [
    makeSeries({ id: 'f2', title: 'Lantern Road', isFavorite: true }),
  ],
  rows: [
    {
      genre: 'Drama',
      count: 2,
      series: [
        makeSeries({ id: 'a1', title: 'Northwind' }),
        makeSeries({ id: 'f2', title: 'Lantern Road', isFavorite: true }),
      ],
    },
    {
      genre: 'Comedy',
      count: 1,
      series: [makeSeries({ id: 'c1', title: 'Comet Season' })],
    },
  ],
  other: null,
};

/**
 * The same rows as the server answers them once `Northwind` is saved: on the
 * shelf and, in the server's sort, behind `Lantern Road`, so the reload is
 * visible as the shelf changing order.
 */
const SAVED_PAYLOAD: SeriesRowsPayload = {
  ...ROWS_PAYLOAD,
  favorites: [
    ROWS_PAYLOAD.favorites[0],
    makeSeries({ id: 'a1', title: 'Northwind', isFavorite: true }),
  ],
  rows: ROWS_PAYLOAD.rows.map((row) => ({
    ...row,
    series: row.series.map((series) =>
      series.id === 'a1' ? { ...series, isFavorite: true } : series
    ),
  })),
};

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
 * Serve the rows from `payloads` in turn (the nth read gets the nth, every
 * read after the last gets the last) and every favorite save from
 * `onFavorite`, handed the series' id and the value asked for.
 */
function serveInTurn(
  payloads: SeriesRowsPayload[],
  onFavorite: (id: string, value: boolean) => Promise<Response>
) {
  let served = 0;
  fetchMock.mockImplementation((input, init) => {
    const url = String(input);
    if (url.includes('/api/series/rows')) {
      const payload = payloads[Math.min(served, payloads.length - 1)];
      served += 1;
      return Promise.resolve(okResponse(payload));
    }
    const favorite = /\/api\/series\/(.+)\/favorite/.exec(url);
    if (favorite) {
      const { value } = JSON.parse(String(init?.body)) as { value: boolean };
      return onFavorite(decodeURIComponent(favorite[1]), value);
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
}

/** Every read of the series rows, as its URL. */
function rowsRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/api/series/rows'));
}

/** Every favorite save attempted, as its URL. */
function favoriteRequests(): string[] {
  return fetchMock.mock.calls
    .map(([input]) => String(input))
    .filter((url) => url.includes('/favorite'));
}

/** The ids the shelf draws, in its order. */
function shelved(favorites: PosterCardMovie[]): string[] {
  return favorites
    .filter((series) => series.favorite)
    .map((series) => series.id);
}

/** Give any reload every chance to land before reading the screen. */
async function settle() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

/** Mount the hook and wait for the first load to land. */
async function loadRows() {
  const view = renderHook(() => useSeriesRows(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={['/?tab=series']}>{children}</MemoryRouter>
    ),
  });
  await waitFor(() => expect(view.result.current.status).toBe('ready'));
  return view;
}

describe('useSeriesRows: a heart settles the shelf', () => {
  it('reads the rows again once the heart is confirmed, and takes the shelf in the server’s order', async () => {
    serveInTurn([ROWS_PAYLOAD, SAVED_PAYLOAD], () =>
      Promise.resolve(okResponse({ value: true }))
    );
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));
    expect(shelved(result.current.favorites)).toEqual(['a1', 'f2']);

    await waitFor(() => expect(rowsRequests()).toHaveLength(2));
    await waitFor(() =>
      expect(shelved(result.current.favorites)).toEqual(['f2', 'a1'])
    );
    await settle();
    expect(rowsRequests()).toHaveLength(2);
    expect(result.current.status).toBe('ready');
  });

  it('reads nothing again for an un-heart', async () => {
    serveInTurn([ROWS_PAYLOAD], () =>
      Promise.resolve(okResponse({ value: false }))
    );
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('f2', false));

    await waitFor(() => expect(favoriteRequests()).toHaveLength(1));
    await settle();
    expect(shelved(result.current.favorites)).toEqual([]);
    expect(rowsRequests()).toHaveLength(1);
  });

  it('reads nothing again for a refused heart', async () => {
    serveInTurn([ROWS_PAYLOAD], () =>
      Promise.reject(new Error('network down'))
    );
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));

    await waitFor(() =>
      expect(shelved(result.current.favorites)).toEqual(['f2'])
    );
    await settle();
    expect(rowsRequests()).toHaveLength(1);
  });

  it('reads the rows once for two quick hearts, after both have landed', async () => {
    let confirmComet: () => void = () => undefined;
    serveInTurn([ROWS_PAYLOAD], (id) =>
      id === 'c1'
        ? new Promise<Response>((resolve) => {
            confirmComet = () => resolve(okResponse({ value: true }));
          })
        : Promise.resolve(okResponse({ value: true }))
    );
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('c1', true));
    act(() => result.current.toggleFavorite('a1', true));

    await waitFor(() => expect(favoriteRequests()).toHaveLength(2));
    await settle();
    // Northwind is confirmed, but Comet Season is still on the wire.
    expect(rowsRequests()).toHaveLength(1);

    await act(async () => {
      confirmComet();
    });
    await waitFor(() => expect(rowsRequests()).toHaveLength(2));
    await settle();
    expect(rowsRequests()).toHaveLength(2);
  });

  it('keeps a heart in flight over a reload that lands before it', async () => {
    // Northwind's confirmed heart sends the reload; it is held at the server.
    // Comet Season is hearted while it is out, and its save never settles. The
    // reload then answers from before Comet Season was saved, and must not
    // empty a heart the family has just filled.
    let releaseReload: (payload: SeriesRowsPayload) => void = () => undefined;
    let rowsServed = 0;
    fetchMock.mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/series/rows')) {
        rowsServed += 1;
        if (rowsServed === 1) {
          return Promise.resolve(okResponse(ROWS_PAYLOAD));
        }
        return new Promise<Response>((resolve) => {
          releaseReload = (payload) => resolve(okResponse(payload));
        });
      }
      if (url.includes('/api/series/a1/favorite')) {
        return Promise.resolve(okResponse({ value: true }));
      }
      if (url.includes('/favorite')) {
        return new Promise<Response>(() => undefined);
      }
      return Promise.reject(new Error(`Unexpected request: ${url}`));
    });
    const { result } = await loadRows();

    act(() => result.current.toggleFavorite('a1', true));
    await waitFor(() => expect(rowsRequests()).toHaveLength(2));

    act(() => result.current.toggleFavorite('c1', true));
    await act(async () => {
      releaseReload(SAVED_PAYLOAD);
    });
    await settle();

    // The reload landed: Northwind sits where the server sorts it…
    expect(shelved(result.current.favorites)).toContain('a1');
    // …and Comet Season, still saving, kept its heart and its place.
    expect(shelved(result.current.favorites)).toContain('c1');
    expect(
      result.current.rows
        .find((row) => row.genre === 'Comedy')
        ?.movies.find((card) => card.id === 'c1')?.favorite
    ).toBe(true);
  });
});
