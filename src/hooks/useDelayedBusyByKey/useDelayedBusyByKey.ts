import { useCallback, useState } from 'react';

import type { BusyPhase } from '@/types';
import { onLoaderTiming } from '../useDelayedBusy/useDelayedBusy';

export interface DelayedBusyByKey {
  /** The phase of the work running under `key`; `idle` when none is. */
  phaseOf: (key: string) => BusyPhase;
  /**
   * Run `work` under `key` on the **Loader timing**, passing its result or
   * its error through after the hold.
   */
  run: <T>(key: string, work: () => Promise<T>) => Promise<T>;
}

/**
 * The **Loader timing** for many pieces of work at once, one per key, each
 * on its own clock: a row's press, timed apart from every other row's.
 * `onLoaderTiming` times each run; a key that is not running is `idle`, a
 * key done under 300ms is never shown, and a shown key holds 500ms from the
 * moment it was shown, whatever the other keys do. Shared because three run
 * hooks use it: `useEnrichmentRun`, `useImportRun`, `useLibraryFolders`.
 */
export function useDelayedBusyByKey(): DelayedBusyByKey {
  const [phases, setPhases] = useState<ReadonlyMap<string, BusyPhase>>(
    () => new Map()
  );

  const phaseOf = useCallback(
    (key: string): BusyPhase => phases.get(key) ?? 'idle',
    [phases]
  );

  const run = useCallback(
    <T>(key: string, work: () => Promise<T>): Promise<T> =>
      onLoaderTiming(work, (phase) =>
        setPhases((held) => {
          const next = new Map(held);
          if (phase === 'idle') {
            next.delete(key);
          } else {
            next.set(key, phase);
          }
          return next;
        })
      ),
    []
  );

  return { phaseOf, run };
}
