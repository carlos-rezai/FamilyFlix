import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useFactoryReset } from './useFactoryReset';
import { stubLocation } from '@/test-support/stubLocation/stubLocation';
import {
  conflictResponse,
  noContentResponse,
} from '@/test-support/fakeResponse/fakeResponse';

/**
 * 53 — Loading states, Phase 4 (issue #487): `resetting` is a **Busy phase**
 * on the **Loader timing**: `waiting` from the press, `shown` once the reset
 * has run 300ms, and back to `idle` after a refusal only once the 500ms hold
 * is out. A reset that lands reloads onto `/` after the same hold.
 */

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

let answer: (response: Response) => void;

beforeEach(() => {
  answer = () => undefined;
  const fetchMock = vi.fn<FetchFn>();
  fetchMock.mockImplementation(
    () =>
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
  );
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const IMPORT_RUNNING =
  'An import is running. Stop it before erasing everything.';

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function respond(response: Response) {
  await act(async () => {
    answer(response);
  });
}

describe('useFactoryReset — on the Loader timing', () => {
  const location = stubLocation();

  it('is idle before a press', () => {
    const { result } = renderHook(() => useFactoryReset());

    expect(result.current.resetting).toBe('idle');
  });

  it('is waiting at once, shown at 300ms, and idle after a refusal’s hold', async () => {
    const { result } = renderHook(() => useFactoryReset());
    vi.useFakeTimers();

    act(() => {
      void result.current.reset();
    });
    expect(result.current.resetting).toBe('waiting');

    await advance(299);
    expect(result.current.resetting).toBe('waiting');
    await advance(1);
    expect(result.current.resetting).toBe('shown');

    await respond(conflictResponse(IMPORT_RUNNING));
    await advance(499);
    expect(result.current.resetting).toBe('shown');
    await advance(1);
    expect(result.current.resetting).toBe('idle');
    expect(result.current.refusal).toBe(IMPORT_RUNNING);
  });

  it('reloads onto / only after the hold', async () => {
    const { result } = renderHook(() => useFactoryReset());
    vi.useFakeTimers();

    act(() => {
      void result.current.reset();
    });
    await advance(300);
    await respond(noContentResponse());
    await advance(499);
    expect(location.assigned()).toEqual([]);

    await advance(1);
    expect(location.assigned()).toEqual(['/']);
  });
});
