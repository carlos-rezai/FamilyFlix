import { useCallback, useEffect, useRef, useState } from 'react';

import type { EnrichmentRun, StartEnrichment } from '@/types';
import {
  EnrichmentBusyError,
  fetchCurrentEnrichment,
  startEnrichment,
} from '../api/api';

/** How often the **Current enrichment run** is read while it is going. */
const POLL_INTERVAL_MS = 500;

export interface EnrichmentRunState {
  /** The run as last read — `null` before one is started on this screen. */
  run: EnrichmentRun | null;
  /**
   * Start a Sync and hold the snapshot it answered. A `409` is answered by
   * holding the run already going instead. Rejects otherwise.
   */
  start: (options: StartEnrichment) => Promise<void>;
  /** _Sync again_: let the finished run go from the screen, back to setup. */
  reset: () => void;
}

/**
 * The run hook — `useImportRun`'s shape: `GET /api/enrichment/current` every
 * 500 ms while the run is running, and not once more once it is in review.
 * A poll that lands after a newer start, a reset, or the screen was left
 * does not put its snapshot back.
 */
export function useEnrichmentRun(): EnrichmentRunState {
  const [run, setRun] = useState<EnrichmentRun | null>(null);
  /** Bumped by every start and reset, so a read from before either is stale. */
  const generation = useRef(0);

  const start = useCallback(async (options: StartEnrichment) => {
    generation.current += 1;
    try {
      setRun(await startEnrichment(options));
    } catch (error) {
      if (!(error instanceof EnrichmentBusyError)) {
        throw error;
      }
      setRun(await fetchCurrentEnrichment());
    }
  }, []);

  const reset = useCallback(() => {
    generation.current += 1;
    setRun(null);
  }, []);

  const live = run !== null && run.phase === 'running';
  useEffect(() => {
    if (!live) {
      return undefined;
    }

    let stopped = false;
    const timer = setInterval(async () => {
      const at = generation.current;
      try {
        const next = await fetchCurrentEnrichment();
        if (!stopped && at === generation.current) {
          setRun(next);
        }
      } catch {
        // One missed poll is nothing: the next is half a second away.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [live]);

  return { run, start, reset };
}
