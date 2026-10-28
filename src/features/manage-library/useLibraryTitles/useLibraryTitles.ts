import { useCallback, useEffect, useState } from 'react';

import { deleteMovie } from '@/api/deleteMovie/deleteMovie';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import { deleteSeries } from '@/api/deleteSeries/deleteSeries';
import type { BusyPhase, LibraryTitle, LibraryTitles } from '@/types';
import {
  clearMovieDetails,
  clearSeriesDetails,
  fetchLibraryTitles,
} from '../api/api';

export interface LibraryTitlesState {
  /** Both lists, `null` until the read lands and still if it never does. */
  titles: LibraryTitles | null;
  /** A clear's **Busy phase**, on the **Loader timing**. */
  clearing: BusyPhase;
  /**
   * **Clear details** on a title: `true` once its row is replaced in place by
   * the echo, `false` on any failure, the list as it was. Settles only once
   * the loader's hold is out. Never rejects.
   */
  clearDetails: (title: LibraryTitle) => Promise<boolean>;
  /** True for the life of a delete's request, false before and after. */
  deleting: boolean;
  /**
   * Deletes a title with a plain `DELETE`: `true` once its row is off its
   * list, with no re-read; `false` for any failure, the list as it was.
   * Never rejects.
   */
  deleteTitle: (title: LibraryTitle) => Promise<boolean>;
}

/** The list a title of each kind sits on. */
const listOf = (title: LibraryTitle) =>
  title.kind === 'movie' ? 'movies' : 'series';

/**
 * The **Library titles** the Manage library page draws, read once on mount —
 * **Blank until it lands** — and the writes that redraw a row from its echo,
 * each with its in-flight state, the bargain `useDeleteMovie` and
 * `useFactoryReset` keep. Neither write rejects.
 */
export function useLibraryTitles(): LibraryTitlesState {
  const [titles, setTitles] = useState<LibraryTitles | null>(null);
  const { phase: clearing, run: runClear } = useDelayedBusy();
  const [deleting, setDeleting] = useState(false);

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
      try {
        const echo = await runClear<LibraryTitle>(() =>
          title.kind === 'movie'
            ? clearMovieDetails(title.id)
            : clearSeriesDetails(title.id)
        );
        replaced(listOf(title), echo);
        return true;
      } catch {
        return false;
      }
    },
    [replaced, runClear]
  );

  const deleteTitle = useCallback(
    async (title: LibraryTitle): Promise<boolean> => {
      setDeleting(true);
      try {
        if (title.kind === 'movie') {
          await deleteMovie(title.id);
        } else {
          await deleteSeries(title.id);
        }
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
  };
}
