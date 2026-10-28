import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import { useFactoryReset } from './useFactoryReset';
import { stubLocation } from '@/test-support/stubLocation/stubLocation';
import {
  conflictResponse,
  noContentResponse,
} from '@/test-support/fakeResponse/fakeResponse';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';
import { heldFetch } from '@/test-support/heldFetch/heldFetch';

/**
 * 53, Loading states, Phase 5 (issue #487): `resetting` is a **Busy phase**
 * on the **Loader timing**: `waiting` from the press, `shown` once the reset
 * has run 300ms, and back to `idle` after a refusal only once the 500ms hold
 * is out. A reset that lands reloads onto `/` after the same hold.
 */

const { respond } = heldFetch();

afterEach(() => {
  vi.useRealTimers();
});

const IMPORT_RUNNING =
  'An import is running. Stop it before erasing everything.';

describe('useFactoryReset: on the Loader timing', () => {
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

    await advanceClock(299);
    expect(result.current.resetting).toBe('waiting');
    await advanceClock(1);
    expect(result.current.resetting).toBe('shown');

    await respond(conflictResponse(IMPORT_RUNNING));
    await advanceClock(499);
    expect(result.current.resetting).toBe('shown');
    await advanceClock(1);
    expect(result.current.resetting).toBe('idle');
    expect(result.current.refusal).toBe(IMPORT_RUNNING);
  });

  it('reloads onto / only after the hold', async () => {
    const { result } = renderHook(() => useFactoryReset());
    vi.useFakeTimers();

    act(() => {
      void result.current.reset();
    });
    await advanceClock(300);
    await respond(noContentResponse());
    await advanceClock(499);
    expect(location.assigned()).toEqual([]);

    await advanceClock(1);
    expect(location.assigned()).toEqual(['/']);
  });
});
