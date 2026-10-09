import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConflictChoices, EnrichmentRun, StartEnrichment } from '@/types';
import {
  applyChoices,
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

/**
 * The snapshot with Decision `id` settled: off the list, and — for a pick or
 * _Apply choices_, not a Skip — counted into _movies enriched_.
 */
function settled(
  run: EnrichmentRun | null,
  id: string,
  { counted }: { counted: boolean }
): EnrichmentRun | null {
  if (run === null) return run;
  return {
    ...run,
    enriched: counted ? run.enriched + 1 : run.enriched,
    decisions: run.decisions.filter((each) => each.id !== id),
  };
}

/**
 * Whether `run` belongs here: opened with no film every run does; opened for
 * a film, only a `single` run for that same film.
 */
function belongsHere(run: EnrichmentRun, movieId: string | null): boolean {
  return (
    movieId === null || (run.scope === 'single' && run.movieId === movieId)
  );
}

export interface EnrichmentRunState {
  /** The run as last read — `null` while none is held. */
  run: EnrichmentRun | null;
  /**
   * The **Waiting run**: a run in review that does not belong to the film the
   * screen was opened for, which Start would let go of — `null` while none.
   */
  waiting: EnrichmentRun | null;
  /**
   * Start a Sync and hold the snapshot it answered. A `409` is answered by
   * holding the run already going instead when it belongs here, and by
   * rejecting with `EnrichmentBusyError` when it does not. Rejects otherwise.
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
  /**
   * _Apply choices_ on a `conflict` row: the settled row leaves the list and
   * counts into _movies enriched_. Rejects when the route refuses.
   */
  apply: (id: string, choices: ConflictChoices) => Promise<void>;
  /** _Skip_: the row leaves the list. Rejects when the route refuses. */
  dismiss: (id: string) => Promise<void>;
}

/**
 * The run hook — `useImportRun`'s shape: the **Current enrichment run** read
 * once on mount, so a screen opened again re-attaches to a run already
 * going; then `GET /api/enrichment/current` every 500 ms while the run is
 * running, and not once more once it is in review.
 *
 * Opened with no film, every run re-attaches. Opened for a film, only that
 * film's own `single` run does; a run in review that is not its own is held
 * apart as the **Waiting run**, the run a Start would let go of.
 *
 * A read that lands after a newer start, a cancel, or the screen was left
 * puts back neither a run nor a Waiting run.
 */
export function useEnrichmentRun(movieId: string | null): EnrichmentRunState {
  const [run, setRun] = useState<EnrichmentRun | null>(null);
  const [waiting, setWaiting] = useState<EnrichmentRun | null>(null);
  /** Bumped by every start and cancel, so a read from before either is stale. */
  const generation = useRef(0);

  useEffect(() => {
    let left = false;
    const at = generation.current;
    fetchCurrentEnrichment()
      .then((held) => {
        if (left || at !== generation.current || held === null) return;
        if (belongsHere(held, movieId)) {
          setRun(held);
        } else if (held.phase === 'review') {
          setWaiting(held);
        }
      })
      .catch(() => {
        // Nothing to re-attach to: setup it is.
      });
    return () => {
      left = true;
    };
  }, [movieId]);

  const start = useCallback(
    async (options: StartEnrichment) => {
      generation.current += 1;
      try {
        setRun(await startEnrichment(options));
        setWaiting(null);
      } catch (error) {
        if (!(error instanceof EnrichmentBusyError)) {
          throw error;
        }
        const held = await fetchCurrentEnrichment();
        if (held !== null && !belongsHere(held, movieId)) {
          throw error;
        }
        setRun(held);
        setWaiting(null);
      }
    },
    [movieId]
  );

  const cancel = useCallback(() => {
    generation.current += 1;
    setRun(null);
    setWaiting(null);
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
    setRun((held) => settled(held, id, { counted: true }));
  }, []);

  const apply = useCallback(async (id: string, choices: ConflictChoices) => {
    await applyChoices(id, choices);
    setRun((held) => settled(held, id, { counted: true }));
  }, []);

  const dismiss = useCallback(async (id: string) => {
    await dismissDecision(id);
    setRun((held) => settled(held, id, { counted: false }));
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

  return { run, waiting, start, cancel, search, pick, apply, dismiss };
}
