import { useCallback, useState } from 'react';

import type { BusyPhase } from '@/types';

/** How long work runs before its loader is drawn. */
export const SHOW_AFTER_MS = 300;

/** How long a drawn loader is held, at the least, so it never flickers. */
export const MIN_SHOWN_MS = 500;

export interface DelayedBusy {
  phase: BusyPhase;
  /**
   * Run `work` on the **Loader timing**, passing its result or its error
   * through. The caller's outcome (a leaving, a close) follows this promise,
   * so it waits out the hold.
   */
  run: <T>(work: () => Promise<T>) => Promise<T>;
}

/**
 * The **Loader timing** (log 53): an action locks at once (`waiting`), draws
 * its loader only once its work has run 300ms (`shown`), and once drawn holds
 * it for at least 500ms. Work done in under 300ms settles at once, never
 * having been shown.
 */
export function useDelayedBusy(): DelayedBusy {
  const [phase, setPhase] = useState<BusyPhase>('idle');

  const run = useCallback(async <T>(work: () => Promise<T>): Promise<T> => {
    setPhase('waiting');
    let shownAt: number | null = null;
    const showing = setTimeout(() => {
      shownAt = Date.now();
      setPhase('shown');
    }, SHOW_AFTER_MS);

    const finish = async () => {
      clearTimeout(showing);
      if (shownAt !== null) {
        const left = shownAt + MIN_SHOWN_MS - Date.now();
        if (left > 0) {
          await new Promise<void>((resolve) => setTimeout(resolve, left));
        }
      }
      setPhase('idle');
    };

    try {
      const value = await work();
      await finish();
      return value;
    } catch (error: unknown) {
      await finish();
      throw error;
    }
  }, []);

  return { phase, run };
}
