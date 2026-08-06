import { useCallback, useEffect, useState } from 'react';

import type { GenreRowModel, HomeRow } from '../../../types';
import { view } from '../view/view';

/** The one aggregate the browse home loads — a row per populated genre. */
const HOME_ENDPOINT = '/api/home';

/** Where the load is: never both loading and errored, never rows without `ready`. */
export type HomeRowsStatus = 'loading' | 'ready' | 'error';

export interface UseHomeRowsResult {
  status: HomeRowsStatus;
  /** The genre rows to render; empty unless `status` is `ready`. */
  rows: GenreRowModel[];
  /** Re-run the load after a failure. */
  retry: () => void;
}

/** Map one payload row's movies through the card view mapper. */
function toGenreRow(row: HomeRow): GenreRowModel {
  return { genre: row.genre, count: row.count, movies: row.movies.map(view) };
}

/**
 * Loads the browse home in a single request and hands back render-ready genre
 * rows. One aggregate fetch means one loading transition — no per-genre fan-out
 * — and the payload's alphabetical order is preserved as it arrives.
 */
export function useHomeRows(): UseHomeRowsResult {
  const [status, setStatus] = useState<HomeRowsStatus>('loading');
  const [rows, setRows] = useState<GenreRowModel[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setStatus('loading');

    fetch(HOME_ENDPOINT)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`GET ${HOME_ENDPOINT} failed: ${response.status}`);
        }
        return (await response.json()) as HomeRow[];
      })
      .then((payload) => {
        if (!current) {
          return;
        }
        setRows(payload.map(toGenreRow));
        setStatus('ready');
      })
      .catch(() => {
        if (!current) {
          return;
        }
        setRows([]);
        setStatus('error');
      });

    // A retry that lands while an earlier load is still in flight must not have
    // the stale response overwrite it.
    return () => {
      current = false;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { status, rows, retry };
}
