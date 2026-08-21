import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { DEFAULT_MOVIE_SORT, type GenreQuery, type MovieSort } from '@/types';
import { parseGenreQuery } from '@/utils';

export interface UseGenreQueryResult {
  /** The settled query the URL is currently carrying. */
  query: GenreQuery;
  /** Write the search text; the empty string takes `q` back off the URL. */
  setSearch: (value: string) => void;
  /** Write the sort order; the default order takes `sort` back off the URL. */
  setSort: (value: MovieSort) => void;
}

/**
 * One genre page's query, read from and written to the URL — the only place it
 * lives. `useLibraryQuery` with two setters instead of four: the genre is the
 * path this page is routed by rather than a filter within it, and there is no
 * rating control on the screen to write a cut-off from.
 *
 * Reading it from the router rather than from component state is what lets
 * `GenrePage` stay pure composition, and what makes Back from a movie land on
 * the *narrowed* grid: the query was never in a component to lose.
 *
 * Each setter owns exactly one parameter, so the two controls can't clobber
 * each other, and omits its parameter at its default value — a plain genre page
 * is a clean `/genre/Drama` with no query string to explain.
 *
 * Every write is a `replace`. A search settles many times on its way to the
 * term the parent meant, and none of those may cost a press of Back on the way
 * out of the genre.
 */
export function useGenreQuery(): UseGenreQueryResult {
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useMemo(() => parseGenreQuery(searchParams), [searchParams]);

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

  return { query, setSearch, setSort };
}
