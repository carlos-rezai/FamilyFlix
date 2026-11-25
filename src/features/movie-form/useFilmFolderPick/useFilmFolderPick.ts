import { useCallback, useRef } from 'react';

import { folderBridge } from '@/api/folderBridge/folderBridge';
import type { FilmFolderRead } from '@/types';
import { readFilmFolder } from '../api/api';

/** The read a pick's fills are taken back with: no art, no tracks. */
const NO_FILM: FilmFolderRead = { poster: null, backdrop: null, subtitles: [] };

export interface UseFilmFolderPickInput {
  /** Whether the screen is a plain add, the one place the folder is read. */
  plainAdd: boolean;
  /**
   * Offer the form a **Film folder read**, with `picked`, the read an earlier
   * pick offered (`null` before any), so only that pick's fills are replaced.
   */
  prefillFilmFolder: (
    read: FilmFolderRead,
    picked: FilmFolderRead | null
  ) => void;
}

export interface UseFilmFolderPickResult {
  /** A movie video was picked: in the shell, on a plain add, read its folder. */
  readFilm: (file: File) => void;
  /** The video's ✕: the pick's own fills go, and a late answer is dropped. */
  forgetFilm: () => void;
}

/**
 * The movie add's **Film folder read**, `useShowFolderPick`'s pattern: in the
 * shell, on a plain add, a picked video's path is read through the **Path
 * bridge** and its folder asked for its art and tracks, which the form is
 * offered by the one fill rule. A later pick replaces only the earlier fills,
 * the ✕ takes them back, and an answer that lands after either is dropped
 * (the `videoPick` counter's rule). No loader is drawn.
 */
export function useFilmFolderPick({
  plainAdd,
  prefillFilmFolder,
}: UseFilmFolderPickInput): UseFilmFolderPickResult {
  // The read the last pick offered, so a new pick and the ✕ know their fills.
  const picked = useRef<FilmFolderRead | null>(null);
  // Counts the picks, so an answer landing after a later one changes nothing.
  const filmPick = useRef(0);

  const readFilm = useCallback(
    (file: File) => {
      const shell = folderBridge();
      if (shell === null || !plainAdd) {
        return;
      }
      const pick = ++filmPick.current;
      const path = shell.pathOf(file);
      if (path === '') {
        return;
      }
      void readFilmFolder(path)
        .then((read) => {
          if (pick === filmPick.current) {
            prefillFilmFolder(read, picked.current);
            picked.current = read;
          }
        })
        .catch(() => undefined);
    },
    [plainAdd, prefillFilmFolder]
  );

  const forgetFilm = useCallback(() => {
    filmPick.current += 1;
    if (picked.current !== null) {
      prefillFilmFolder(NO_FILM, picked.current);
      picked.current = null;
    }
  }, [prefillFilmFolder]);

  return { readFilm, forgetFilm };
}
