import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useCapabilities } from './useCapabilities';
import type { PlaybackCapabilities } from '@/types';
import {
  okResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143).
 *
 * `useCapabilities()` → `{ capabilities }`: the **Codec report** the
 * `CodecManager` draws, fetched once on mount. **Blank until it lands** — the
 * Export summary's rule, and the shape every read on the Settings page
 * repeats: `null` until the read lands, the payload after, and `null` still if
 * it never does. No skeleton, no error face, no snackbar — the prototype draws
 * none, and a hook that did more would be a test suite written twice.
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

const REPORT: PlaybackCapabilities = {
  component: true,
  codecs: [
    { codec: 'h264', kind: 'video', support: 'native' },
    { codec: 'hevc', kind: 'video', support: 'via-component' },
  ],
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

describe('useCapabilities', () => {
  it('reads the capability route once, on mount', async () => {
    fetchMock.mockResolvedValue(okResponse(REPORT));

    const { rerender } = renderHook(() => useCapabilities());
    rerender();

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      '/api/playback/capabilities'
    );
  });

  it('holds null until the read lands', () => {
    holdRead();

    const { result } = renderHook(() => useCapabilities());

    expect(result.current.capabilities).toBeNull();
  });

  it('hands over the report once it lands', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useCapabilities());

    await act(async () => {
      read.settle(okResponse(REPORT));
    });

    await waitFor(() => expect(result.current.capabilities).toEqual(REPORT));
  });

  it('keeps null when the route refuses', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useCapabilities());

    await act(async () => {
      read.settle(serverErrorResponse());
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.capabilities).toBeNull();
  });

  it('keeps null when the request itself fails', async () => {
    const read = holdRead();
    const { result } = renderHook(() => useCapabilities());

    await act(async () => {
      read.refuse(new Error('offline'));
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.capabilities).toBeNull();
  });
});
