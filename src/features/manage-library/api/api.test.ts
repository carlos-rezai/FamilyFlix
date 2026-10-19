import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  clearMovieDetails,
  clearSeriesDetails,
  fetchLibraryTitles,
} from './api';
import type { LibraryTitles } from '@/types';
import {
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
 * `fetchLibraryTitles`, the **Manage library page**'s one read: `GET
 * /api/library-titles` → `{ movies, series }` for both tabs at once. One
 * caller, so it lives with the feature. A refused read rejects; the hook
 * turns that into `null`.
 */

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

describe('fetchLibraryTitles', () => {
  it('asks GET /api/library-titles', async () => {
    fetchMock.mockResolvedValue(okResponse({ movies: [], series: [] }));

    await fetchLibraryTitles();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('/api/library-titles');
    expect(init?.method ?? 'GET').toBe('GET');
  });

  it('answers both lists as the route sent them', async () => {
    const titles: LibraryTitles = {
      movies: [makeLibraryMovie({ id: 'm1' })],
      series: [makeLibrarySeries({ id: 's1' })],
    };
    fetchMock.mockResolvedValue(okResponse(titles));

    await expect(fetchLibraryTitles()).resolves.toEqual(titles);
  });

  it('rejects a refused read', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchLibraryTitles()).rejects.toThrow();
  });
});

/**
 * 47 — Manage library, Phase 3: "Clear details" (issue #409).
 *
 * `clearMovieDetails(id)` and `clearSeriesDetails(id)`: `POST
 * /api/movies/:id/clear-details` and `POST /api/series/:id/clear-details`,
 * each answering the `200`'s **Library title**, the echo the row redraws
 * from, and rejecting on anything else — the hook never lets that reach the
 * page. One caller each, so they live with the feature.
 */
describe.each([
  [
    'clearMovieDetails',
    clearMovieDetails,
    'movies',
    makeLibraryMovie({ id: 'm 1', details: 'none' }),
  ],
  [
    'clearSeriesDetails',
    clearSeriesDetails,
    'series',
    makeLibrarySeries({ id: 'm 1', details: 'none' }),
  ],
] as const)('%s', (_name, clearDetails, route, echo) => {
  it(`posts to /api/${route}/:id/clear-details, the id encoded`, async () => {
    fetchMock.mockResolvedValue(okResponse(echo));

    await clearDetails('m 1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      `/api/${route}/m%201/clear-details`
    );
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('POST');
  });

  it('answers the echoed Library title', async () => {
    fetchMock.mockResolvedValue(okResponse(echo));

    await expect(clearDetails('m 1')).resolves.toEqual(echo);
  });

  it('rejects a 404', async () => {
    fetchMock.mockResolvedValue(notFoundResponse());

    await expect(clearDetails('m 1')).rejects.toThrow();
  });

  it('rejects a server error', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(clearDetails('m 1')).rejects.toThrow();
  });
});
