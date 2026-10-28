import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

import type { BusyPhase } from '@/types';
import { MIN_SHOWN_MS, SHOW_AFTER_MS, useDelayedBusy } from './useDelayedBusy';

/**
 * 53 — Loading states, Phase 2 (issue #484): the **Loader timing**.
 *
 * Every action the household starts runs through `run`: the control locks at
 * once (`waiting`), the loader is drawn only after 300ms of work (`shown`),
 * and once drawn it is held for at least 500ms, the caller's outcome waiting
 * out the hold because it follows `run`'s promise. Every test here runs on
 * fake timers, and settles a piece of work the test holds itself.
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

/** The hook, with every phase it has ever answered, in order. */
function renderBusy() {
  const phases: BusyPhase[] = [];
  const view = renderHook(() => {
    const busy = useDelayedBusy();
    phases.push(busy.phase);
    return busy;
  });
  return { ...view, phases };
}

/** How `run`'s promise stands: still running, or settled with what. */
function watch<T>(promise: Promise<T>) {
  const state: {
    settled: boolean;
    value?: T;
    error?: unknown;
  } = { settled: false };
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

/** Move the clock on, and let every promise it frees settle. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDelayedBusy', () => {
  it('names the rule’s two numbers: shown after 300ms, held for 500ms', () => {
    expect(SHOW_AFTER_MS).toBe(300);
    expect(MIN_SHOWN_MS).toBe(500);
  });

  it('is idle before anything runs', () => {
    const { result } = renderBusy();

    expect(result.current.phase).toBe('idle');
  });

  it('is waiting the moment work starts', () => {
    const { result } = renderBusy();
    const work = deferred<string>();

    act(() => {
      void result.current.run(() => work.promise);
    });

    expect(result.current.phase).toBe('waiting');
  });

  it('settles work under 300ms at once, never having been shown', async () => {
    const { result, phases } = renderBusy();
    const work = deferred<string>();

    let running!: ReturnType<typeof watch<string>>;
    act(() => {
      running = watch(result.current.run(() => work.promise));
    });
    await advance(100);
    await act(async () => {
      work.resolve('done');
    });

    expect(running.settled).toBe(true);
    expect(running.value).toBe('done');
    expect(result.current.phase).toBe('idle');

    // Nothing more happens once the clock passes the 300ms mark.
    await advance(1000);
    expect(phases).not.toContain('shown');
  });

  it('is shown at 300ms while the work still runs, and not a moment before', async () => {
    const { result } = renderBusy();
    const work = deferred<string>();

    act(() => {
      void result.current.run(() => work.promise);
    });

    await advance(SHOW_AFTER_MS - 1);
    expect(result.current.phase).toBe('waiting');

    await advance(1);
    expect(result.current.phase).toBe('shown');

    await act(async () => {
      work.resolve('done');
    });
    await advance(MIN_SHOWN_MS);
  });

  it('holds a resolve after shown until 500ms after shown, then is idle', async () => {
    const { result } = renderBusy();
    const work = deferred<string>();

    let running!: ReturnType<typeof watch<string>>;
    act(() => {
      running = watch(result.current.run(() => work.promise));
    });
    await advance(400);
    await act(async () => {
      work.resolve('saved');
    });

    // Shown at 300ms, so the hold runs to 800ms: 399ms more from here.
    await advance(399);
    expect(running.settled).toBe(false);
    expect(result.current.phase).toBe('shown');

    await advance(1);
    expect(running.settled).toBe(true);
    expect(running.value).toBe('saved');
    expect(result.current.phase).toBe('idle');
  });

  it('holds a reject after shown until 500ms after shown, then is idle', async () => {
    const { result } = renderBusy();
    const work = deferred<string>();
    const refusal = new Error('refused');

    let running!: ReturnType<typeof watch<string>>;
    act(() => {
      running = watch(result.current.run(() => work.promise));
    });
    await advance(400);
    await act(async () => {
      work.reject(refusal);
    });

    await advance(399);
    expect(running.settled).toBe(false);
    expect(result.current.phase).toBe('shown');

    await advance(1);
    expect(running.settled).toBe(true);
    expect(running.error).toBe(refusal);
    expect(result.current.phase).toBe('idle');
  });

  it('settles work that outlasts the hold as soon as it lands', async () => {
    const { result } = renderBusy();
    const work = deferred<string>();

    let running!: ReturnType<typeof watch<string>>;
    act(() => {
      running = watch(result.current.run(() => work.promise));
    });
    await advance(2000);
    expect(running.settled).toBe(false);
    expect(result.current.phase).toBe('shown');

    await act(async () => {
      work.resolve('late');
    });

    expect(running.settled).toBe(true);
    expect(running.value).toBe('late');
    expect(result.current.phase).toBe('idle');
  });

  it('passes a quick reject’s error through, at once', async () => {
    const { result } = renderBusy();
    const work = deferred<string>();
    const refusal = new Error('gone');

    let running!: ReturnType<typeof watch<string>>;
    act(() => {
      running = watch(result.current.run(() => work.promise));
    });
    await advance(50);
    await act(async () => {
      work.reject(refusal);
    });

    expect(running.settled).toBe(true);
    expect(running.error).toBe(refusal);
    expect(result.current.phase).toBe('idle');
  });
});
