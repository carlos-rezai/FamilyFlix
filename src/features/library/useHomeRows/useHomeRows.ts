import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { ContinueCardMovie, GenreRowModel, LibraryQuery } from '@/types';
import { parseLibraryQuery, toLibraryQueryParams } from '@/utils';
import { fetchHomePayload, saveFavorite } from '../api/api';
import { continueView } from '../continueView/continueView';
import { toGenreRow } from '../toGenreRow/toGenreRow';
import { useBrowseLoad } from '../useBrowseLoad/useBrowseLoad';
import { useOptimisticSave } from '../useOptimisticSave/useOptimisticSave';
import { withFavorite } from '../withFavorite/withFavorite';

/** The home payload as the two sections render it, mapped once as it lands. */
interface HomeSections {
  rows: GenreRowModel[];
  continueWatching: ContinueCardMovie[];
}

/**
 * What the screen has before a load has succeeded. One frozen value rather than
 * a fresh `[]` per render, so a consumer memoised on these sections is not
 * re-rendered by a hook that has nothing new to tell it.
 */
const NO_SECTIONS: HomeSections = { rows: [], continueWatching: [] };

/** Both sections, render-ready, from one aggregate response. */
async function loadSections(query: LibraryQuery): Promise<HomeSections> {
  const payload = await fetchHomePayload(query);
  return {
    rows: payload.rows.map(toGenreRow),
    continueWatching: payload.continueWatching.map(continueView),
  };
}

/** Where the load is: never both loading and errored, never rows without `ready`. */
export type HomeRowsStatus = 'loading' | 'ready' | 'error';

export interface UseHomeRowsResult {
  status: HomeRowsStatus;
  /**
   * The settled query these rows were loaded for. Handed back so that anything
   * describing the result — the miss copy above all — reads the same query the
   * request was built from, rather than parsing the URL for itself and risking
   * naming a filter the request ignored.
   */
  query: LibraryQuery;
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
 * Through that refetch the rows already on screen stay put — the skeleton latch,
 * which {@link useBrowseLoad} owns and explains.
 *
 * It also owns the one edit the browse home can make to those rows — the
 * favorite heart — because the optimistic value and the loaded rows are the
 * same state. The heart fills before the save is confirmed and reverts if the
 * save fails, so it never claims something is saved that isn't.
 */
export function useHomeRows(): UseHomeRowsResult {
  const [searchParams] = useSearchParams();

  // The settled query written back out the way the URL spells it — the shared
  // parser's answer, so a stale, hand-edited or hostile URL is made safe here
  // by exactly the rules the header's pills read it by.
  //
  // Reducing it to that canonical string first is what decides when the library
  // reloads: only the parts this hook reads are in it, at their settled values,
  // so a scroll offset arriving, an empty `?genre=`, or a sort spelled at the
  // default it was already in all leave the string alone and reload nothing.
  const settled = toLibraryQueryParams(
    parseLibraryQuery(searchParams)
  ).toString();

  // Read back from that canonical form, so an unchanged query keeps one
  // identity for the load below. It yields what the URL says because the two
  // functions are inverses — a property their own test asserts.
  const query = useMemo(
    () => parseLibraryQuery(new URLSearchParams(settled)),
    [settled]
  );

  // The settled query string is what says which load this is: an unchanged
  // query is an unchanged string, and nothing else about a render can move it.
  const { status, data, setData, retry } = useBrowseLoad(
    () => loadSections(query),
    settled
  );

  // A failed or unfinished load has no sections; the screen shows its own copy
  // for that, never an empty grid pretending to be a loaded one.
  const { rows, continueWatching } = data ?? NO_SECTIONS;

  /** Applies a favorite value to the loaded rows, leaving nothing else moved. */
  const applyFavorite = useCallback(
    (id: string, favorite: boolean) =>
      setData((current) =>
        current === null
          ? current
          : { ...current, rows: withFavorite(current.rows, id, favorite) }
      ),
    [setData]
  );

  const toggleFavorite = useOptimisticSave(applyFavorite, saveFavorite);

  return { status, query, rows, continueWatching, retry, toggleFavorite };
}
