import { useEffect, useState } from 'react';

import type { GenreListPayload } from '@/types';
import { fetchGenreList } from '../api/api';

/** What the dropdown draws before — or instead of — a list: "All Genres" alone. */
const NO_GENRES: GenreListPayload = { total: 0, genres: [] };

/**
 * Loads the genre list the Genre dropdown is built from, **once per mount**.
 *
 * It deliberately does not read the settled query, so it cannot refetch as the
 * search settles or the sort changes: the counts describe the whole library,
 * and a list that reshuffled while it was being reached for would be unusable.
 * A reopened screen is a fresh mount, which is what keeps it from going stale.
 *
 * A failure resolves to an empty list rather than throwing. The prototype
 * designs no error state for this dropdown, so a broken endpoint is a Genre
 * pill offering "All Genres" alone — the way out of the filter is still there
 * to press — and the search, sort and rating controls beside it are untouched.
 * There is no retry: nothing on screen would change if it succeeded on the
 * second try, and hammering a broken endpoint helps no one.
 */
export function useGenreList(): GenreListPayload {
  const [list, setList] = useState<GenreListPayload>(NO_GENRES);

  useEffect(() => {
    let current = true;

    fetchGenreList()
      .then((loaded) => {
        if (current) {
          setList(loaded);
        }
      })
      .catch(() => {
        if (current) {
          setList(NO_GENRES);
        }
      });

    return () => {
      current = false;
    };
  }, []);

  return list;
}
