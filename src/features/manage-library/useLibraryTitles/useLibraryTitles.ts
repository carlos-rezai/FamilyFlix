import { useCallback, useEffect, useState } from 'react';

import type { LibraryTitle, LibraryTitles } from '@/types';
import {
  clearMovieDetails,
  clearSeriesDetails,
  fetchLibraryTitles,
} from '../api/api';

export interface LibraryTitlesState {
  /** Both lists, `null` until the read lands and still if it never does. */
  titles: LibraryTitles | null;
  /**
   * **Clear details** on a title: `true` once its row is replaced in place by
   * the echo, `false` on any failure, the list as it was. Never rejects.
   */
  clearDetails: (title: LibraryTitle) => Promise<boolean>;
}

/**
 * The **Library titles** the Manage library page draws, read once on mount —
 * **Blank until it lands** — and the writes that redraw a row from its echo.
 */
export function useLibraryTitles(): LibraryTitlesState {
  const [titles, setTitles] = useState<LibraryTitles | null>(null);

  useEffect(() => {
    let live = true;
    fetchLibraryTitles()
      .then((read) => {
        if (live) {
          setTitles(read);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const clearDetails = useCallback(
    async (title: LibraryTitle): Promise<boolean> => {
      try {
        if (title.kind === 'movie') {
          const echo = await clearMovieDetails(title.id);
          setTitles((held) =>
            held === null
              ? held
              : {
                  ...held,
                  movies: held.movies.map((row) =>
                    row.id === echo.id ? echo : row
                  ),
                }
          );
        } else {
          const echo = await clearSeriesDetails(title.id);
          setTitles((held) =>
            held === null
              ? held
              : {
                  ...held,
                  series: held.series.map((row) =>
                    row.id === echo.id ? echo : row
                  ),
                }
          );
        }
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  return { titles, clearDetails };
}
