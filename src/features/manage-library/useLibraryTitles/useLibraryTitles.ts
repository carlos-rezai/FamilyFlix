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
  /** True for the life of a clear's request, false before and after. */
  clearing: boolean;
  /**
   * **Clear details** on a title: `true` once its row is replaced in place by
   * the echo, `false` on any failure, the list as it was. Never rejects.
   */
  clearDetails: (title: LibraryTitle) => Promise<boolean>;
  /** True for the life of a delete's request, false before and after. */
  deleting: boolean;
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
  refusal: string | null;
}

/** The list a title of each kind sits on. */
const listOf = (title: LibraryTitle) =>
  title.kind === 'movie' ? 'movies' : 'series';

/**
 * The **Library titles** the Manage library page draws, read once on mount —
 * **Blank until it lands** — and the writes that redraw a row from its echo,
 * each with its in-flight state and the delete with its refusal, the bargain
 * `useDeleteMovie` and `useFactoryReset` keep. Neither write rejects.
 */
export function useLibraryTitles(): LibraryTitlesState {
  const [titles, setTitles] = useState<LibraryTitles | null>(null);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  /** `echo` in place of the row it redraws, on the list its kind sits on. */
  const replaced = useCallback(
    (list: 'movies' | 'series', echo: LibraryTitle) =>
      setTitles((held) =>
        held === null
          ? held
          : {
              ...held,
              [list]: held[list].map((row) =>
                row.id === echo.id ? echo : row
              ),
            }
      ),
    []
  );

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
      setClearing(true);
      try {
        replaced(
          listOf(title),
          title.kind === 'movie'
            ? await clearMovieDetails(title.id)
            : await clearSeriesDetails(title.id)
        );
        return true;
      } catch {
        return false;
      } finally {
        setClearing(false);
      }
    },
    [replaced]
  );

  const deleteTitle = useCallback(
    async (title: LibraryTitle): Promise<boolean> => {
      setDeleting(true);
      try {
        const outcome =
          title.kind === 'movie'
            ? await deleteMovie(title.id)
            : await deleteSeries(title.id);
        if (outcome.kind === 'refused') {
          setRefusal(outcome.sentence);
          return false;
        }
        setRefusal(null);
        const list = listOf(title);
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
      } finally {
        setDeleting(false);
      }
    },
    []
  );

  return {
    titles,
    clearing,
    clearDetails,
    deleting,
    deleteTitle,
    refusal,
  };
}
