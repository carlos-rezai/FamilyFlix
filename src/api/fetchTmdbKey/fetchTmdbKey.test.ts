import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchTmdbKey } from './fetchTmdbKey';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * The stored TMDB key, read off `GET /api/tmdb/key` — shared by the Settings
 * hub's Network group and the Import flow's _Also fetch from TMDB_ card.
 */

let fetchMock: ReturnType<
  typeof vi.fn<
    (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  >
>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTmdbKey', () => {
  it('asks GET /api/tmdb/key', async () => {
    fetchMock.mockResolvedValue(okResponse({ key: null }));

    await fetchTmdbKey();

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/tmdb/key');
    expect(fetchMock.mock.calls[0]?.[1]?.method ?? 'GET').toBe('GET');
  });

  it('answers the stored key', async () => {
    fetchMock.mockResolvedValue(okResponse({ key: '0123456789abcdef' }));

    expect(await fetchTmdbKey()).toBe('0123456789abcdef');
  });

  it('answers null when none is stored', async () => {
    fetchMock.mockResolvedValue(okResponse({ key: null }));

    expect(await fetchTmdbKey()).toBeNull();
  });

  it('rejects on a status that is not OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchTmdbKey()).rejects.toThrow();
  });
});
