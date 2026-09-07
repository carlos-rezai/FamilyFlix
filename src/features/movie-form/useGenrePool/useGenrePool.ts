import { useEffect, useState } from 'react';

import type { Genre } from '@/types';
import { fetchGenrePool } from '../api/api';

/** What the form draws before — or instead of — a pool: no chips at all. */
const NO_GENRES: Genre[] = [];

/**
 * Loads the **Genre pool** the chips are drawn from, **once per mount** — the
 * whole seeded vocabulary, including the genres no movie is tagged with yet.
 *
 * It is `useGenreList`'s shape, deliberately, down to the failure arm; the two
 * differ in what they ask for and in nothing else. The pool cannot change while
 * a form is open, so asking again would be a request per letter typed into the
 * title field, and a reopened form is a fresh mount, which is what keeps it
 * from going stale.
 *
 * **A failure resolves to an empty pool rather than throwing**, on that same
 * recorded precedent: the prototype designs no error state here, so a broken
 * endpoint is a caption with nothing under it — and a form that cannot draw its
 * chips must still be a form that saves a title, a year and a row. There is no
 * retry, because nothing on screen would change if the second try succeeded:
 * the chips are gone for this visit either way.
 */
export function useGenrePool(): Genre[] {
  const [pool, setPool] = useState<Genre[]>(NO_GENRES);

  useEffect(() => {
    let current = true;

    fetchGenrePool()
      .then((loaded) => {
        if (current) {
          setPool(loaded);
        }
      })
      .catch(() => {
        if (current) {
          setPool(NO_GENRES);
        }
      });

    return () => {
      current = false;
    };
  }, []);

  return pool;
}
