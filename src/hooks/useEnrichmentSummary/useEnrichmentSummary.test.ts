import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useEnrichmentSummary } from './useEnrichmentSummary';
import type { EnrichmentSummary } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 23 — Enrichment refactor (issue #214): the summary has a suite,
 * `useStorageReport`'s precedent.
 *
 * `useEnrichmentSummary()` → `{ summary, retry }` off `GET /api/enrichment`:
 * `null` until the read lands and `null` still if it never does; a read that
 * lands after the screen has gone draws nothing; _Retry_ keeps what is drawn
 * until the fresh read lands.
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
  lastSyncedAt: null,
  keySet: true,
  online: true,
  libraryRoot: null,
};

/** A read that answers only when the test says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  const pending = new Promise<Response>((resolve) => {
    settle = resolve;
  });
  return { pending, settle: (response: Response) => settle(response) };
}

describe('useEnrichmentSummary', () => {
  it('is null until the read lands, then the summary', async () => {
    const read = held();
    fetchMock.mockReturnValue(read.pending);
    const { result } = renderHook(() => useEnrichmentSummary());

    expect(result.current.summary).toBeNull();
    read.settle(okResponse(SUMMARY));

    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/enrichment');
  });

  it('stays null when the read is refused', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());
    const { result } = renderHook(() => useEnrichmentSummary());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await act(async () => undefined);

    expect(result.current.summary).toBeNull();
  });

  it('draws nothing from a read that lands after the screen has gone', async () => {
    const read = held();
    fetchMock.mockReturnValue(read.pending);
    const { result, unmount } = renderHook(() => useEnrichmentSummary());

    unmount();
    read.settle(okResponse(SUMMARY));
    await act(async () => undefined);

    expect(result.current.summary).toBeNull();
  });

  it('keeps the summary drawn on Retry until the fresh one lands', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(SUMMARY));
    const { result } = renderHook(() => useEnrichmentSummary());
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    const again = held();
    fetchMock.mockReturnValueOnce(again.pending);

    act(() => result.current.retry());

    expect(result.current.summary).toEqual(SUMMARY);
    again.settle(okResponse({ ...SUMMARY, online: false }));
    await waitFor(() => expect(result.current.summary?.online).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the summary drawn when a Retry is refused', async () => {
    fetchMock.mockResolvedValueOnce(okResponse(SUMMARY));
    const { result } = renderHook(() => useEnrichmentSummary());
    await waitFor(() => expect(result.current.summary).toEqual(SUMMARY));
    fetchMock.mockResolvedValueOnce(serverErrorResponse());

    act(() => result.current.retry());
    await act(async () => undefined);

    expect(result.current.summary).toEqual(SUMMARY);
  });
});
