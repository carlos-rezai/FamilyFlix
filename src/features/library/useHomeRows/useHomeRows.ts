import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import {
  DEFAULT_MOVIE_SORT,
  type ContinueCardMovie,
  type GenreRowModel,
  type HomeQuery,
} from '@/types';
import { isMovieSort, parseMinRating } from '@/utils';
import { fetchHomePayload, saveFavorite } from '../api/api';
import { continueView } from '../continueView/continueView';
import { toGenreRow } from '../toGenreRow/toGenreRow';
import { withFavorite } from '../withFavorite/withFavorite';

/** Where the load is: never both loading and errored, never rows without `ready`. */
export type HomeRowsStatus = 'loading' | 'ready' | 'error';

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
 * The query it loads is whatever the URL is carrying — the search text, the
 * genre, the minimum rating and the sort order alike, read straight from the
 * router as app-level state rather than a sibling feature's, which is why the
 * header's controls and this hook never speak to each other. Narrowing to one genre is the server's
 * answer to that query, not a filter applied to rows already here: one row
 * arrives because one row was built. It is already known on the first render, so a
 * shared link loads narrowed and in its order with no unfiltered library
 * flashing past first, and it refetches whenever the settled query changes.
 * Through that refetch the rows already on screen stay put: the skeleton is
 * for the first load only, because flashing the whole screen every time the
 * typing settles would be unreadable.
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
  // scroll offset or a tracking parameter changing is not a new query. An
  // order the app doesn't recognise reads as the default, so a hand-edited or
  // stale URL loads the plain home rather than asking the route for a 400.
  const search = searchParams.get('q') ?? '';
  const sortParam = searchParams.get('sort') ?? '';
  const sort = isMovieSort(sortParam) ? sortParam : DEFAULT_MOVIE_SORT;
  // An empty `?genre=` is "All Genres", so it reads as no genre and reloads
  // nothing — the same rule the parameter is written by.
  const genre = searchParams.get('genre') ?? '';
  // Only a cut-off the dropdown can produce reads as a minimum, so a
  // hand-edited `?rating=7` asks for the whole library — the same rule the pill
  // draws itself by, or the request would disagree with the header.
  const minRating = parseMinRating(searchParams.get('rating'));
  const query = useMemo<HomeQuery>(() => {
    const next: HomeQuery = { sort };
    if (search !== '') {
      next.search = search;
    }
    if (genre !== '') {
      next.genre = genre;
    }
    if (minRating !== undefined) {
      next.minRating = minRating;
    }
    return next;
  }, [search, sort, genre, minRating]);

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
