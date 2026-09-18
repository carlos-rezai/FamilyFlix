import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useStorageReport } from './useStorageReport';
import type { StorageReport } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 4: "the Storage card" (issue #146).
 *
 * `useStorageReport()` → `{ report }`: the **Storage report** the
 * `StorageSection` draws, fetched once on mount. **Blank until it lands** —
 * the tracer bullet's shape repeated: `null` until the read lands, the payload
 * after, and `null` kept if it never does. No skeleton, no error face, no
 * snackbar — the prototype draws none.
 *
 * Everything is asserted as requests against a stubbed `fetch` and what the
 * hook hands back.
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

const REPORT: StorageReport = {
  mediaPath: 'D:\\FamilyFlix\\media',
  bytesUsed: 19_756_849_562,
  movieCount: 12,
};

/** A read that answers only when the test says so. */
function holdRead() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  const pending = new Promise<Response>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  fetchMock.mockImplementation(() => pending);
  return {
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

describe('useStorageReport', () => {
  it('reads the storage route once, on mount', async () => {
    fetchMock.mockResolvedValue(okResponse(REPORT));

    const { rerender } = renderHook(() => useStorageReport());
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/storage');
  });

  it('holds null until the read lands', () => {
    holdRead();

    const { result } = renderHook(() => useStorageReport());

    expect(result.current.report).toBeNull();
  });

  it('hands over the report once it lands', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useStorageReport());

    await act(async () => {
      read.settle(okResponse(REPORT));
    });

    await waitFor(() => expect(result.current.report).toEqual(REPORT));
  });

  it('hands over a fresh install’s report — zero bytes is a report, not an absence', async () => {
    const fresh: StorageReport = {
      mediaPath: 'C:\\Users\\Family\\AppData\\Roaming\\FamilyFlix\\media',
      bytesUsed: 0,
      movieCount: 0,
    };
    fetchMock.mockResolvedValue(okResponse(fresh));

    const { result } = renderHook(() => useStorageReport());

    await waitFor(() => expect(result.current.report).toEqual(fresh));
  });

  it('keeps null when the route refuses', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useStorageReport());

    await act(async () => {
      read.settle(serverErrorResponse());
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.report).toBeNull();
  });

  it('keeps null when the request itself fails', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useStorageReport());

    await act(async () => {
      read.refuse(new Error('offline'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.report).toBeNull();
  });
});
