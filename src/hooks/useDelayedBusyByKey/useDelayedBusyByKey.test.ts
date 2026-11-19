import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { BusyPhase } from '@/types';
import { useDelayedBusyByKey } from './useDelayedBusyByKey';
import { advanceClock } from '@/test-support/advanceClock/advanceClock';

/**
 * 69, Silent waits, Phase 1 (issue #653): the **Loader timing** by key.
 *
 * `useDelayedBusyByKey` times many pieces of work at once, one per key, each
 * on the rule `useDelayedBusy` keeps: `waiting` at once, `shown` after 300ms,
 * and once shown held for at least 500ms, its result or its error passed
 * through only after the hold. A key not running is `idle`. Every test runs
 * on fake timers and settles work it holds itself.
 */

/** A piece of work the test settles itself, at a time of its choosing. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** How `run`'s promise stands: still running, or settled with what. */
function watch<T>(promise: Promise<T>) {
  const state: { settled: boolean; value?: T; error?: unknown } = {
    settled: false,
  };
  promise.then(
    (value) => {
      state.settled = true;
      state.value = value;
    },
    (error: unknown) => {
      state.settled = true;
      state.error = error;
    }
  );
  return state;
}

/** The hook, with every phase key `a` has answered, in order. */
function renderBusy() {
  const phasesOfA: BusyPhase[] = [];
  const view = renderHook(() => {
    const busy = useDelayedBusyByKey();
    phasesOfA.push(busy.phaseOf('a'));
    return busy;
  });
  return { ...view, phasesOfA };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDelayedBusyByKey', () => {
  it('answers idle for a key that is not running', () => {
    const { result } = renderBusy();
    const work = deferred<string>();

    expect(result.current.phaseOf('a')).toBe('idle');

    act(() => {
      void result.current.run('a', () => work.promise);
    });

    expect(result.current.phaseOf('a')).toBe('waiting');
    expect(result.current.phaseOf('never-run')).toBe('idle');
  });

  it('runs two keys independently, each on its own clock', async () => {
    const { result } = renderBusy();
    const a = deferred<string>();
    const b = deferred<string>();

    let runningA!: ReturnType<typeof watch<string>>;
    let runningB!: ReturnType<typeof watch<string>>;
    act(() => {
      runningA = watch(result.current.run('a', () => a.promise));
    });
    await advanceClock(200);
    act(() => {
      runningB = watch(result.current.run('b', () => b.promise));
    });

    // a started at 0, b at 200.
    await advanceClock(100);
    expect(result.current.phaseOf('a')).toBe('shown');
    expect(result.current.phaseOf('b')).toBe('waiting');

    await advanceClock(200);
    expect(result.current.phaseOf('b')).toBe('shown');

    // a lands at 600: held to 800, while b runs on untouched.
    await advanceClock(100);
    await act(async () => {
      a.resolve('first');
    });
    await advanceClock(199);
    expect(runningA.settled).toBe(false);
    expect(result.current.phaseOf('a')).toBe('shown');

    await advanceClock(1);
    expect(runningA.settled).toBe(true);
    expect(runningA.value).toBe('first');
    expect(result.current.phaseOf('a')).toBe('idle');
    expect(result.current.phaseOf('b')).toBe('shown');
    expect(runningB.settled).toBe(false);

    await act(async () => {
      b.resolve('second');
    });
    expect(runningB.settled).toBe(true);
    expect(runningB.value).toBe('second');
    expect(result.current.phaseOf('b')).toBe('idle');
  });

  it('settles a key done under 300ms at once, never having shown it', async () => {
    const { result, phasesOfA } = renderBusy();
    const work = deferred<string>();

    let running!: ReturnType<typeof watch<string>>;
    act(() => {
      running = watch(result.current.run('a', () => work.promise));
    });
    await advanceClock(100);
    await act(async () => {
      work.resolve('quick');
    });

    expect(running.settled).toBe(true);
    expect(running.value).toBe('quick');
    expect(result.current.phaseOf('a')).toBe('idle');

    await advanceClock(1000);
    expect(phasesOfA).not.toContain('shown');
  });

  it('holds a shown key until 500ms after it was shown', async () => {
    const { result } = renderBusy();
    const work = deferred<string>();

    let running!: ReturnType<typeof watch<string>>;
    act(() => {
      running = watch(result.current.run('a', () => work.promise));
    });
    await advanceClock(299);
    expect(result.current.phaseOf('a')).toBe('waiting');
    await advanceClock(1);
    expect(result.current.phaseOf('a')).toBe('shown');

    // Lands at 400; shown at 300, so the hold runs to 800.
    await advanceClock(100);
    await act(async () => {
      work.resolve('saved');
    });
    await advanceClock(399);
    expect(running.settled).toBe(false);
    expect(result.current.phaseOf('a')).toBe('shown');

    await advanceClock(1);
    expect(running.settled).toBe(true);
    expect(running.value).toBe('saved');
    expect(result.current.phaseOf('a')).toBe('idle');
  });

  it('passes an error through only after the hold', async () => {
    const { result } = renderBusy();
    const work = deferred<string>();
    const refusal = new Error('refused');

    let running!: ReturnType<typeof watch<string>>;
    act(() => {
      running = watch(result.current.run('a', () => work.promise));
    });
    await advanceClock(400);
    await act(async () => {
      work.reject(refusal);
    });

    await advanceClock(399);
    expect(running.settled).toBe(false);
    expect(result.current.phaseOf('a')).toBe('shown');

    await advanceClock(1);
    expect(running.settled).toBe(true);
    expect(running.error).toBe(refusal);
    expect(result.current.phaseOf('a')).toBe('idle');
  });
});
