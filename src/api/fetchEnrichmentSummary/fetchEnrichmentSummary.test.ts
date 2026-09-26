import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { fetchEnrichmentSummary } from './fetchEnrichmentSummary';
import type { EnrichmentSummary } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment, Phase 3: "setup's readiness" (issue #206).
 *
 * The `EnrichmentSummary`, read off `GET /api/enrichment`. It lives on this
 * rung because two features call it: the Settings hub's _Sync metadata &
 * posters_ row, and the Enrichment setup. `fetchSettings`' style: what was
 * asked for, what the caller is handed, and a rejection on any status that is
 * not OK.
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

const SUMMARY: EnrichmentSummary = {
  total: 30,
  complete: 18,
  lastSyncedAt: '2026-09-26T09:30:00.000Z',
  keySet: true,
  online: false,
  libraryRoot: null,
};

describe('fetchEnrichmentSummary', () => {
  it('GETs the enrichment route', async () => {
    fetchMock.mockResolvedValue(okResponse(SUMMARY));

    await fetchEnrichmentSummary();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(String(input)).toBe('/api/enrichment');
    expect(init?.method === undefined || init.method === 'GET').toBe(true);
  });

  it('resolves the summary the route answered', async () => {
    fetchMock.mockResolvedValue(okResponse(SUMMARY));

    await expect(fetchEnrichmentSummary()).resolves.toEqual(SUMMARY);
  });

  it('rejects when the route answers a status that is not OK', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());

    await expect(fetchEnrichmentSummary()).rejects.toThrow();
  });
});
