import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import type {
  ContinueCardMovie,
  GenreRowModel,
  HomeQuery,
  MovieSort,
} from '@/types';
import { fetchHomePayload, saveFavorite } from '../api/api';
import { continueView } from '../continueView/continueView';
import { toGenreRow } from '../toGenreRow/toGenreRow';
import { withFavorite } from '../withFavorite/withFavorite';

/** Where the load is: never both loading and errored, never rows without `ready`. */
export type HomeRowsStatus = 'loading' | 'ready' | 'error';

/** What the home rows are ordered by until a sort control writes another one. */
const DEFAULT_SORT: MovieSort = 'recently-added';

export interface UseHomeRowsResult {
  status: HomeRowsStatus;
  /** The genre rows to render; empty unless `status` is `ready`. */
  rows: GenreRowModel[];
  /** The resume tiles to render above them; empty unless `status` is `ready`. */
  continueWatching: ContinueCardMovie[];
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Save one movie's favorite flag, showing the new value immediately. */
  toggleFavorite: (id: string, favorite: boolean) => void;
}

/**
 * Loads the browse home in a single request and hands back both of its
 * render-ready sections — the resume tiles and the genre rows. One aggregate
 * fetch means one loading transition, so the screen paints at once and no
 * section pops in above rows that had already painted; the payload's
 * alphabetical order is preserved as it arrives.
 *
 * The query it loads is whatever the URL is carrying, read straight from the
 * router — app-level state rather than a sibling feature's, which is why the
 * header's search box and this hook never speak to each other. It is already
 * known on the first render, so a shared link loads narrowed with no
 * unfiltered library flashing past first, and it refetches whenever the
 * settled query changes. Through that refetch the rows already on screen stay
 * put: the skeleton is for the first load only, because flashing the whole
 * screen every time the typing settles would be unreadable.
 *
 * It also owns the one edit the browse home can make to those rows — the
 * favorite heart — because the optimistic value and the loaded rows are the
 * same state. The heart fills before the save is confirmed and reverts if the
 * save fails, so it never claims something is saved that isn't.
 */
export function useHomeRows(): UseHomeRowsResult {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<HomeRowsStatus>('loading');
  const [rows, setRows] = useState<GenreRowModel[]>([]);
  const [continueWatching, setContinueWatching] = useState<ContinueCardMovie[]>(
    []
  );
  const [attempt, setAttempt] = useState(0);

  // Only the parts of the URL this hook reads may reload the library — a
  // scroll offset or a tracking parameter changing is not a new query.
  const search = searchParams.get('q') ?? '';
  const query = useMemo<HomeQuery>(
    () =>
      search === '' ? { sort: DEFAULT_SORT } : { sort: DEFAULT_SORT, search },
    [search]
  );

  useEffect(() => {
    let current = true;
    // A query change with rows already on screen keeps them; only a load with
    // nothing to show falls back to the skeleton.
    setStatus((previous) => (previous === 'ready' ? 'ready' : 'loading'));

    fetchHomePayload(query)
      .then((payload) => {
        if (!current) {
          return;
        }
        setRows(payload.rows.map(toGenreRow));
        setContinueWatching(payload.continueWatching.map(continueView));
        setStatus('ready');
      })
      .catch(() => {
        if (!current) {
          return;
        }
        setRows([]);
        setContinueWatching([]);
        setStatus('error');
      });

    // A retry — or a newer query — that lands while an earlier load is still in
    // flight must not have the abandoned response overwrite it.
    return () => {
      current = false;
    };
  }, [query, attempt]);

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

  return { status, rows, continueWatching, retry, toggleFavorite };
}
