import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchLibraryTitles } from './api';
import type { LibraryTitles } from '@/types';
import {
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
