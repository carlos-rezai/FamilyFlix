import { useCallback, useEffect, useRef, useState } from 'react';

import type { EnrichmentRun, StartEnrichment } from '@/types';
import {
  cancelEnrichment,
  dismissDecision,
  EnrichmentBusyError,
  fetchCurrentEnrichment,
  pickCandidate,
  searchDecision,
  startEnrichment,
} from '../api/api';

/** How often the **Current enrichment run** is read while it is going. */
const POLL_INTERVAL_MS = 500;

export interface EnrichmentRunState {
  /** The run as last read — `null` while none is held. */
  run: EnrichmentRun | null;
  /**
   * Start a Sync and hold the snapshot it answered. A `409` is answered by
   * holding the run already going instead. Rejects otherwise.
   */
  start: (options: StartEnrichment) => Promise<void>;
  /**
   * _Stop_ and _Sync again_: drop the run — running or finished — on the
   * server and from the screen, back to setup. Every row written stays.
   */
  cancel: () => void;
  /**
   * Search TMDB for Decision `id` and draw the answer in its place. Rejects
   * when the route refuses.
   */
  search: (id: string, query: string) => Promise<void>;
  /**
   * Pick a candidate: the settled row leaves the list and counts into
   * _movies enriched_. Rejects when the route refuses.
   */
  pick: (id: string, tmdbId: number) => Promise<void>;
  /** _Skip_: the row leaves the list. Rejects when the route refuses. */
  dismiss: (id: string) => Promise<void>;
}

/**
 * The run hook — `useImportRun`'s shape: the **Current enrichment run** read
 * once on mount, so a screen opened again re-attaches to a run already
 * going; then `GET /api/enrichment/current` every 500 ms while the run is
 * running, and not once more once it is in review. A read that lands after a
 * newer start, a cancel, or the screen was left does not put its snapshot
 * back.
 */
export function useEnrichmentRun(): EnrichmentRunState {
  const [run, setRun] = useState<EnrichmentRun | null>(null);
  /** Bumped by every start and cancel, so a read from before either is stale. */
  const generation = useRef(0);

  useEffect(() => {
    let left = false;
    const at = generation.current;
    fetchCurrentEnrichment()
      .then((held) => {
        if (!left && at === generation.current && held !== null) {
          setRun(held);
        }
      })
      .catch(() => {
        // Nothing to re-attach to: setup it is.
      });
    return () => {
      left = true;
    };
  }, []);

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

  const cancel = useCallback(() => {
    generation.current += 1;
    setRun(null);
    cancelEnrichment().catch(() => {
      // The screen is back at setup either way; a start will say if one runs.
    });
  }, []);

  const search = useCallback(async (id: string, query: string) => {
    const answer = await searchDecision(id, query);
    setRun((held) =>
      held === null
        ? held
        : {
            ...held,
            decisions: held.decisions.map((each) =>
              each.id === id ? answer : each
            ),
          }
    );
  }, []);

  const pick = useCallback(async (id: string, tmdbId: number) => {
    await pickCandidate(id, tmdbId);
    setRun((held) =>
      held === null
        ? held
        : {
            ...held,
            enriched: held.enriched + 1,
            decisions: held.decisions.filter((each) => each.id !== id),
          }
    );
  }, []);

  const dismiss = useCallback(async (id: string) => {
    await dismissDecision(id);
    setRun((held) =>
      held === null
        ? held
        : {
            ...held,
            decisions: held.decisions.filter((each) => each.id !== id),
          }
    );
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

  return { run, start, cancel, search, pick, dismiss };
}
