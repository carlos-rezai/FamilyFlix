import { useCallback, useEffect, useState } from 'react';

import { fetchCurrentImport, startImport } from '../api/api';
import type { ImportRun } from '@/types';

/** How often the **Current run** is read while it is still going. */
const POLL_INTERVAL_MS = 500;

/** Whether a run at this phase is still going, and so still worth polling. */
const isLive = (run: ImportRun | null): boolean =>
  run !== null && run.phase !== 'review';

export interface ImportRunState {
  /** The **Current run** as last read — `null` before one has started. */
  run: ImportRun | null;
  /**
   * Start a run over the two paths and hold the snapshot the start answered.
   * Rejects as `startImport` does — an `ImportRefusedError` names the field —
   * so the caller can draw the reason where it belongs.
   */
  start: (sheetPath: string, rootPath: string) => Promise<void>;
}

/**
 * The **Run hook** — what holds the **Current run** on the screen.
 *
 * Transport is polling: `GET /api/import/current` every 500 ms while the
 * phase is scanning or importing, and not once more once the run is in the
 * **Review step** — a hook that kept polling in review would be a request
 * every half second for as long as the maintainer reads the list. Nothing is
 * read on mount: re-attaching to a run already going is the next slice's, and
 * in this one a fresh screen is a fresh screen.
 */
export function useImportRun(): ImportRunState {
  const [run, setRun] = useState<ImportRun | null>(null);

  const start = useCallback(async (sheetPath: string, rootPath: string) => {
    setRun(await startImport(sheetPath, rootPath));
  }, []);

  const live = isLive(run);
  useEffect(() => {
    if (!live) {
      return undefined;
    }

    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const next = await fetchCurrentImport();
        // A poll that lands after the screen was left, or after a later poll
        // already moved the run on, must not put a stale snapshot back.
        if (!stopped) {
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

  return { run, start };
}
