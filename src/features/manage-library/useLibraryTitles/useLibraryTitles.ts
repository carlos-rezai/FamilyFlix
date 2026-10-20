import { useCallback, useEffect, useState } from 'react';

import { deleteMovie } from '@/api/deleteMovie/deleteMovie';
import { deleteSeries } from '@/api/deleteSeries/deleteSeries';
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
  /**
   * Deletes a title over its unchanged route: `true` once its row is off its
   * list, with no re-read; `false` for a refusal or any failure, the list as
   * it was. Never rejects.
   */
  deleteTitle: (title: LibraryTitle) => Promise<boolean>;
  /**
   * The route's `409` sentence for the last refused delete, `null` until one
   * is refused; replaced by the next press's own answer.
   */
  deleteRefusal: string | null;
}

/**
 * The **Library titles** the Manage library page draws, read once on mount —
 * **Blank until it lands** — and the writes that redraw a row from its echo.
 */
export function useLibraryTitles(): LibraryTitlesState {
  const [titles, setTitles] = useState<LibraryTitles | null>(null);
  const [deleteRefusal, setDeleteRefusal] = useState<string | null>(null);

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

  const deleteTitle = useCallback(
    async (title: LibraryTitle): Promise<boolean> => {
      try {
        const outcome =
          title.kind === 'movie'
            ? await deleteMovie(title.id)
            : await deleteSeries(title.id);
        if (outcome.kind === 'refused') {
          setDeleteRefusal(outcome.sentence);
          return false;
        }
        setDeleteRefusal(null);
        const list = title.kind === 'movie' ? 'movies' : 'series';
        setTitles((held) =>
          held === null
            ? held
            : {
                ...held,
                [list]: held[list].filter((row) => row.id !== title.id),
              }
        );
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  return { titles, clearDetails, deleteTitle, deleteRefusal };
}
