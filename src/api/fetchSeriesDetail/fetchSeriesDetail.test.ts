import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchSeriesDetail } from './fetchSeriesDetail';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import {
  notFoundResponse,
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 38 — Title editing (issue #305): the promotion. The series pages and the
 * Enrichment flow both load one series, so the call moved up to this rung.
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

describe('fetchSeriesDetail', () => {
  it('reads the series from its own route, the id encoded', async () => {
    const detail = makeSeriesDetail([['unwatched']], { id: 'a/b' });
    fetchMock.mockResolvedValue(okResponse(detail));

    await expect(fetchSeriesDetail('a/b')).resolves.toEqual(detail);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/series/a%2Fb');
  });

  it('resolves null for a series that is gone', async () => {
    fetchMock.mockResolvedValue(notFoundResponse('No such series'));

    await expect(fetchSeriesDetail('gone')).resolves.toBeNull();
  });

  it('rejects for any other failure', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchSeriesDetail('s1')).rejects.toThrow();
  });
});
