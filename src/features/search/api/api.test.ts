import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchGenreList } from './api';
import type { GenreListPayload } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/** The list `GET /api/genres` answers with: the library total, then the genres. */
const GENRE_LIST: GenreListPayload = {
  total: 24,
  genres: [
    { id: 'g1', name: 'Action', count: 9 },
    { id: 'g2', name: 'Comedy', count: 4 },
  ],
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

/** The one request that was issued, as its URL. */
function onlyRequestUrl(): string {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return String(fetchMock.mock.calls[0][0]);
}

describe('fetchGenreList', () => {
  it('GETs the genre list and returns the payload it answers with', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_LIST));

    const list = await fetchGenreList();

    expect(onlyRequestUrl()).toBe('/api/genres');
    expect(list).toEqual(GENRE_LIST);
  });

  it('carries the library total alongside the genres', async () => {
    fetchMock.mockResolvedValue(okResponse(GENRE_LIST));

    const list = await fetchGenreList();

    // "All Genres" needs a count of movies, which no genre row can supply.
    expect(list.total).toBe(24);
    expect(list.genres.map((genre) => genre.name)).toEqual([
      'Action',
      'Comedy',
    ]);
  });

  it('asks with no query string — the list is deliberately unfiltered', async () => {
    // The counts must not move under a finger already reaching for them, so
    // this request never carries the settled query.
    fetchMock.mockResolvedValue(okResponse(GENRE_LIST));

    await fetchGenreList();

    expect(onlyRequestUrl()).not.toContain('?');
  });

  it('reads an empty library as an empty list rather than a failure', async () => {
    fetchMock.mockResolvedValue(okResponse({ total: 0, genres: [] }));

    await expect(fetchGenreList()).resolves.toEqual({ total: 0, genres: [] });
  });

  it('throws when the route does not answer with a 2xx', async () => {
    // Swallowing the failure is the hook's job, not this one's — the api layer
    // reports what happened.
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchGenreList()).rejects.toThrow(/500/);
  });
});
