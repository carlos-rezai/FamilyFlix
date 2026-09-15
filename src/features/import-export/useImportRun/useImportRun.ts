import { useCallback, useEffect, useRef, useState } from 'react';

import { dismissProblem } from '@/api/dismissProblem/dismissProblem';
import type { ImportRun } from '@/types';
import {
  cancelImport,
  fetchCurrentImport,
  ImportBusyError,
  startImport,
} from '../api/api';

/** How often the **Current run** is read while it is still going. */
const POLL_INTERVAL_MS = 500;

/** Whether a run at this phase is still going, and so still worth polling. */
const isLive = (run: ImportRun | null): boolean =>
  run !== null && run.phase !== 'review';

export interface ImportRunState {
  /** The **Current run** as last read — `null` when there is none. */
  run: ImportRun | null;
  /**
   * Whether the read made on mount has yet to answer. Until it has, the hook
   * does not know whether a run exists, and a screen that offered the setup
   * fields on a guess would be offering them while a run exists.
   */
  attaching: boolean;
  /**
   * Start a run over the two paths and hold the snapshot the start answered.
   * A `409` — a run already exists — is answered by reading that run and
   * holding it instead, so the start settles on exactly what the screen
   * should be showing. Rejects as `startImport` does otherwise — an
   * `ImportRefusedError` names the field — so the caller can draw the reason
   * where it belongs.
   */
  start: (sheetPath: string, rootPath: string) => Promise<void>;
  /** _Cancel import_: discard the run, and let it go from the screen. */
  cancel: () => Promise<void>;
  /**
   * _Skip_ on a **Problem**: dismiss it, and take its row off the snapshot
   * once the route has answered — on a `404` as on the `204`, because both
   * mean the problem is not there. Rejects as `dismissProblem` does when the
   * dismiss could not be made, and the row stays for another press.
   */
  skip: (id: string) => Promise<void>;
}

/**
 * The **Run hook** — what holds the **Current run** on the screen.
 *
 * Transport is polling: `GET /api/import/current` every 500 ms while the
 * phase is scanning or importing, and not once more once the run is in the
 * **Review step** — a hook that kept polling in review would be a request
 * every half second for as long as the maintainer reads the list. The same
 * endpoint is read once on mount, which is the re-attach: leaving the screen
 * and returning, reloading, or arriving with a run already going all show
 * the running step, and a `404` shows setup.
 *
 * Every read applies only if nothing has moved the run on since it was sent:
 * a poll that lands after a cancel, or after the screen was left, must not
 * put a snapshot back.
 *
 * A skip in review edits the snapshot in place rather than reading it again:
 * the run is not polled in review, and the route's answer already says the
 * problem is gone.
 */
export function useImportRun(): ImportRunState {
  const [run, setRun] = useState<ImportRun | null>(null);
  const [attaching, setAttaching] = useState(true);
  /** Bumped by every start and cancel, so a read from before either is stale. */
  const generation = useRef(0);

  useEffect(() => {
    let left = false;
    const at = generation.current;
    void fetchCurrentImport()
      .then((current) => {
        if (!left && at === generation.current) {
          setRun(current);
        }
      })
      .catch(() => {
        // Nothing could be read: the screen has no run to show, and the
        // maintainer can still start one.
      })
      .finally(() => {
        if (!left) {
          setAttaching(false);
        }
      });
    return () => {
      left = true;
    };
  }, []);

  const start = useCallback(async (sheetPath: string, rootPath: string) => {
    generation.current += 1;
    try {
      setRun(await startImport(sheetPath, rootPath));
    } catch (error) {
      if (!(error instanceof ImportBusyError)) {
        throw error;
      }
      setRun(await fetchCurrentImport());
    }
  }, []);

  const cancel = useCallback(async () => {
    generation.current += 1;
    await cancelImport();
    setRun(null);
  }, []);

  const skip = useCallback(async (id: string) => {
    await dismissProblem(id);
    setRun((current) =>
      current === null
        ? current
        : {
            ...current,
            problems: current.problems.filter((problem) => problem.id !== id),
          }
    );
  }, []);

  const live = isLive(run);
  useEffect(() => {
    if (!live) {
      return undefined;
    }

    let stopped = false;
    const timer = setInterval(async () => {
      const at = generation.current;
      try {
        const next = await fetchCurrentImport();
        // A poll that lands after the screen was left, after a cancel, or
        // after a later poll already moved the run on, must not put a stale
        // snapshot back.
        if (!stopped && at === generation.current) {
          setRun(next);
        }
      } catch {
        // One missed poll is nothing: the next one is half a second away, and
        // the snapshot on screen is still the last one that was read.
      }
    }, POLL_INTERVAL_MS);

    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [live]);

  return { run, attaching, start, cancel, skip };
}
