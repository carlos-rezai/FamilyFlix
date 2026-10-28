import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

import { useFactoryReset } from './useFactoryReset';
import { stubLocation } from '@/test-support/stubLocation/stubLocation';
import {
  conflictResponse,
  noContentResponse,
  serverErrorResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 37 — Factory reset, the surface (issue #299).
 *
 * `useFactoryReset()` → `{ resetting, refusal, reset }`, the hook behind the
 * **Reset dialog**'s _Erase everything_. `resetting` is not `idle` while the
 * request is in flight (amended by 53, Loading states, issue #487: a **Busy
 * phase** now, not a boolean). A `reset` outcome reloads onto `/` with
 * `location.assign` — the third **Fresh home**: not `replace`, not a router
 * `navigate`, because every read in the app is stale once the library is
 * gone. A refusal is held until the next press is answered, the Export's
 * rule. A rejection leaves the state as it was with `resetting` `idle` again,
 * the Delete dialog's rule — `reset` itself never rejects.
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

const IMPORT_RUNNING =
  'An import is running. Stop it before erasing everything.';
const SYNC_RUNNING = 'A sync is running. Stop it before erasing everything.';

/** A request that answers only when the test says so. */
function held() {
  let settle: (response: Response) => void = () => undefined;
  let refuse: (reason: Error) => void = () => undefined;
  const pending = new Promise<Response>((resolve, reject) => {
    settle = resolve;
    refuse = reject;
  });
  return {
    pending,
    settle: (response: Response) => settle(response),
    refuse: (reason: Error) => refuse(reason),
  };
}

describe('useFactoryReset — before a press', () => {
  it('is neither resetting nor refused, and sends nothing', () => {
    const { result } = renderHook(() => useFactoryReset());

    expect(result.current.resetting).toBe('idle');
    expect(result.current.refusal).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('useFactoryReset — a reset', () => {
  const location = stubLocation();

  it('is resetting while the request is in flight', async () => {
    const request = held();
    fetchMock.mockReturnValue(request.pending);
    const { result } = renderHook(() => useFactoryReset());

    act(() => {
      void result.current.reset();
    });

    expect(result.current.resetting).toBe('waiting');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/reset');

    await act(async () => {
      request.settle(noContentResponse());
      await request.pending;
    });
  });

  it('reloads onto / with location.assign on a 204', async () => {
    fetchMock.mockResolvedValue(noContentResponse());
    const { result } = renderHook(() => useFactoryReset());

    await act(async () => {
      await result.current.reset();
    });

    expect(location.assigned()).toEqual(['/']);
  });

  it('reloads nowhere before the answer lands', () => {
    fetchMock.mockReturnValue(held().pending);
    const { result } = renderHook(() => useFactoryReset());

    act(() => {
      void result.current.reset();
    });

    expect(location.assigned()).toEqual([]);
  });
});

describe('useFactoryReset — a refusal', () => {
  const location = stubLocation();

  it('holds the route’s sentence, resetting false again, and reloads nowhere', async () => {
    fetchMock.mockResolvedValue(conflictResponse(IMPORT_RUNNING));
    const { result } = renderHook(() => useFactoryReset());

    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.refusal).toBe(IMPORT_RUNNING);
    expect(result.current.resetting).toBe('idle');
    expect(location.assigned()).toEqual([]);
  });

  it('keeps the refusal while the next press is in flight', async () => {
    fetchMock.mockResolvedValueOnce(conflictResponse(IMPORT_RUNNING));
    const { result } = renderHook(() => useFactoryReset());
    await act(async () => {
      await result.current.reset();
    });

    fetchMock.mockReturnValueOnce(held().pending);
    act(() => {
      void result.current.reset();
    });

    expect(result.current.resetting).toBe('waiting');
    expect(result.current.refusal).toBe(IMPORT_RUNNING);
  });

  it('replaces the refusal with the next press’s own', async () => {
    fetchMock.mockResolvedValueOnce(conflictResponse(IMPORT_RUNNING));
    const { result } = renderHook(() => useFactoryReset());
    await act(async () => {
      await result.current.reset();
    });

    fetchMock.mockResolvedValueOnce(conflictResponse(SYNC_RUNNING));
    await act(async () => {
      await result.current.reset();
    });

    expect(result.current.refusal).toBe(SYNC_RUNNING);
  });
});

describe('useFactoryReset — a rejection', () => {
  const location = stubLocation();

  it('never rejects, and leaves the state as it was with the button live', async () => {
    fetchMock.mockResolvedValue(serverErrorResponse());
    const { result } = renderHook(() => useFactoryReset());

    await act(async () => {
      await expect(result.current.reset()).resolves.toBeUndefined();
    });

    expect(result.current.resetting).toBe('idle');
    expect(result.current.refusal).toBeNull();
    expect(location.assigned()).toEqual([]);
  });

  it('keeps a refusal already held', async () => {
    fetchMock.mockResolvedValueOnce(conflictResponse(IMPORT_RUNNING));
    const { result } = renderHook(() => useFactoryReset());
    await act(async () => {
      await result.current.reset();
    });

    fetchMock.mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current.reset();
    });

    await waitFor(() => expect(result.current.resetting).toBe('idle'));
    expect(result.current.refusal).toBe(IMPORT_RUNNING);
  });
});

describe('useFactoryReset — the device', () => {
  stubLocation();

  afterEach(() => {
    localStorage.clear();
  });

  it('leaves the device’s volume and seen version where they were', async () => {
    const VOLUME = JSON.stringify({ level: 0.4, muted: false });
    localStorage.setItem('familyflix.player.volume', VOLUME);
    localStorage.setItem('familyflix.seenVersion', '0.3.0');
    fetchMock.mockResolvedValue(noContentResponse());
    const { result } = renderHook(() => useFactoryReset());

    await act(async () => {
      await result.current.reset();
    });

    expect(localStorage.getItem('familyflix.player.volume')).toBe(VOLUME);
    expect(localStorage.getItem('familyflix.seenVersion')).toBe('0.3.0');
  });
});
