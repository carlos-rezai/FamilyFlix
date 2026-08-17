import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import type { HomeQuery } from '@/types';
import { parseLibraryQuery } from '../parseLibraryQuery/parseLibraryQuery';

export interface UseLibraryQueryResult {
  /** The settled query the URL is currently carrying. */
  query: HomeQuery;
  /** Write the search text; the empty string takes `q` back off the URL. */
  setSearch: (value: string) => void;
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

  const setSearch = useCallback(
    (value: string) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === '') {
            next.delete('q');
          } else {
            next.set('q', value);
          }
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return { query, setSearch };
}
