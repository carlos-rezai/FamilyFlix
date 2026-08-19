import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DEFAULT_MOVIE_SORT, type LibraryQuery, type MovieSort } from '@/types';
import { parseLibraryQuery } from '@/utils';

export interface UseLibraryQueryResult {
  /** The settled query the URL is currently carrying. */
  query: LibraryQuery;
  /** Write the search text; the empty string takes `q` back off the URL. */
  setSearch: (value: string) => void;
  /** Write the sort order; the default order takes `sort` back off the URL. */
  setSort: (value: MovieSort) => void;
  /** Write the genre; the empty string ("All Genres") takes `genre` back off. */
  setGenre: (value: string) => void;
  /** Write the minimum rating; nought ("All ratings") takes `rating` back off. */
  setRating: (value: number) => void;
}

/**
 * The browse home's query, read from and written to the URL — the only place
 * it lives. Reading it from the router rather than from component state is
 * what lets `LibraryPage` stay pure composition, and what makes Back from a
 * movie land on the *filtered* view: the query was never in a component to
 * lose.
 *
 * Each setter owns exactly one parameter, so the controls can't clobber each
 * other, and omits its parameter at its default value — an unfiltered home is
 * a clean `/` with no query string to explain.
 *
 * Every write is a `replace`. A search settles many times on its way to the
 * term the parent meant, and none of those may cost a press of Back on the way
 * out of a movie.
 */
export function useLibraryQuery(): UseLibraryQueryResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => parseLibraryQuery(searchParams), [searchParams]);

  // One parameter at a time, copied off whatever the URL currently holds, so a
  // setter can only ever add, replace or remove its own.
  const setParam = useCallback(
    (name: string, value: string, omitAt: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === omitAt) {
            next.delete(name);
          } else {
            next.set(name, value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setSearch = useCallback(
    (value: string) => setParam('q', value, ''),
    [setParam]
  );

  const setSort = useCallback(
    (value: MovieSort) => setParam('sort', value, DEFAULT_MOVIE_SORT),
    [setParam]
  );

  const setGenre = useCallback(
    (value: string) => setParam('genre', value, ''),
    [setParam]
  );

  // Nought is "All ratings", which is the absence of the filter rather than a
  // floor of zero — so it writes no parameter at all.
  const setRating = useCallback(
    (value: number) => setParam('rating', String(value), '0'),
    [setParam]
  );

  return { query, setSearch, setSort, setGenre, setRating };
}
