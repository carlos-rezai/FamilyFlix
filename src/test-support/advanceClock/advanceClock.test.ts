import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEffect, useState } from 'react';

import { advanceClock } from './advanceClock';

/**
 * 53, Loading states (issue #490).
 *
 * The claims the busy suites lean on: a timer due inside the step has fired
 * and the state it set has rendered, through a promise it freed; one due
 * after has not.
 */

/** `true` once `ms` have passed, set after a promise the timer frees. */
function useLater(ms: number): boolean {
  const [done, setDone] = useState(false);
  useEffect(() => {
    void new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    }).then(() => {
      setDone(true);
    });
  }, [ms]);
  return done;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('advanceClock', () => {
  it('renders what a timer due inside the step set, and nothing after', async () => {
    const { result } = renderHook(() => ({
      soon: useLater(100),
      later: useLater(200),
    }));

    await advanceClock(100);

    expect(result.current).toEqual({ soon: true, later: false });
  });

  it('carries on from where the last step left the clock', async () => {
    const { result } = renderHook(() => useLater(200));

    await advanceClock(199);
    expect(result.current).toBe(false);

    await advanceClock(1);
    expect(result.current).toBe(true);
  });
});
