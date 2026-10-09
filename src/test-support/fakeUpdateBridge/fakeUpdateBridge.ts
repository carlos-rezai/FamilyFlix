import { afterEach, beforeEach } from 'vitest';

import type { UpdateBridge, UpdateCheck, UpdateStatus } from '@/types/update';

/** No offer, no check yet, nothing installing — a fresh launch's status. */
export const IDLE_STATUS: UpdateStatus = {
  offered: null,
  lastCheckedAt: null,
  installing: false,
};

/**
 * A controllable `window.familyflix.updates` — the bridge the **Desktop
 * shell**'s preload defines and a browser does not have.
 *
 * Call this inside the `describe` that needs it, and for the length of that
 * block the global is installed: `current()` answers what `setCurrent` last
 * set (the idle status by default), `check()` what `setCheck` last set
 * (`none` by default — a promise holds the check open for as long as the
 * test wants), `emit(status)` pushes a status to every subscriber, and each
 * `install()` is recorded. After the block the global is deleted, so every
 * later file in the worker is a browser again.
 *
 * It follows `stubScrollTo` in shape.
 */
export function fakeUpdateBridge() {
  let current: UpdateStatus = IDLE_STATUS;
  let answer: () => Promise<UpdateCheck> = () => Promise.resolve('none');
  const listeners = new Set<(status: UpdateStatus) => void>();
  let checks = 0;
  let installs = 0;

  const updates: UpdateBridge = {
    current: () => Promise.resolve(current),
    onStatus(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    check() {
      checks += 1;
      return answer();
    },
    install() {
      installs += 1;
    },
  };

  beforeEach(() => {
    current = IDLE_STATUS;
    answer = () => Promise.resolve('none');
    listeners.clear();
    checks = 0;
    installs = 0;
    window.familyflix = { ...window.familyflix, updates } as NonNullable<
      Window['familyflix']
    >;
  });

  afterEach(() => {
    delete window.familyflix;
  });

  return {
    /** The bridge itself, as `window.familyflix.updates` holds it. */
    updates,
    /** What `current()` answers from now on. */
    setCurrent(status: UpdateStatus): void {
      current = status;
    },
    /** What `check()` answers from now on; a promise holds the check open. */
    setCheck(outcome: UpdateCheck | Promise<UpdateCheck>): void {
      answer = () => Promise.resolve(outcome);
    },
    /** Push a status to every subscriber, as main does on every change. */
    emit(status: UpdateStatus): void {
      current = status;
      for (const listener of [...listeners]) listener(status);
    },
    /** How many subscribers are listening now. */
    subscribers: (): number => listeners.size,
    /** How many times `check()` was called. */
    checks: (): number => checks,
    /** How many times `install()` was called. */
    installs: (): number => installs,
  };
}
