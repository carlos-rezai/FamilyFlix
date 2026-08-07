import { useCallback, useEffect, useState } from 'react';

import type { GenreRowModel } from '@/types';
import { fetchHomePayload, saveFavorite } from '../api/api';
import { toGenreRow } from '../toGenreRow/toGenreRow';
import { withFavorite } from '../withFavorite/withFavorite';

/** Where the load is: never both loading and errored, never rows without `ready`. */
export type HomeRowsStatus = 'loading' | 'ready' | 'error';

export interface UseHomeRowsResult {
  status: HomeRowsStatus;
  /** The genre rows to render; empty unless `status` is `ready`. */
  rows: GenreRowModel[];
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Save one movie's favorite flag, showing the new value immediately. */
  toggleFavorite: (id: string, favorite: boolean) => void;
}

/**
 * Loads the browse home in a single request and hands back render-ready genre
 * rows. One aggregate fetch means one loading transition — no per-genre fan-out
 * — and the payload's alphabetical order is preserved as it arrives.
 *
 * It also owns the one edit the browse home can make to those rows — the
 * favorite heart — because the optimistic value and the loaded rows are the
 * same state. The heart fills before the save is confirmed and reverts if the
 * save fails, so it never claims something is saved that isn't.
 */
export function useHomeRows(): UseHomeRowsResult {
  const [status, setStatus] = useState<HomeRowsStatus>('loading');
  const [rows, setRows] = useState<GenreRowModel[]>([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setStatus('loading');

    fetchHomePayload()
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

  const toggleFavorite = useCallback((id: string, favorite: boolean) => {
    setRows((current) => withFavorite(current, id, favorite));

    saveFavorite(id, favorite)
      // The route echoes what it stored; trust that over what we assumed.
      .then((saved) => {
        if (saved !== favorite) {
          setRows((current) => withFavorite(current, id, saved));
        }
      })
      .catch(() => {
        setRows((current) => withFavorite(current, id, !favorite));
      });
  }, []);

  return { status, rows, retry, toggleFavorite };
}
