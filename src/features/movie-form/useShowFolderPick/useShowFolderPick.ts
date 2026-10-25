import { useCallback, useRef, useState } from 'react';

import { fetchSeriesDetail } from '@/api/fetchSeriesDetail/fetchSeriesDetail';
import { folderBridge } from '@/api/folderBridge/folderBridge';
import type { EpisodeFormRow } from '@/types';
import { readShowFolder } from '../api/api';
import { showFolderRows } from '../formValues/formValues';

/** The refusal of a picked folder that is already a held series's Show folder. */
const heldShowFolderRefusal = (title: string): string =>
  `${title} is already in your library.`;

export interface UseShowFolderPickInput {
  /** Whether the screen is a plain add, the one place the pick is offered. */
  plainAdd: boolean;
  /** The episode list's: put the read's rows in, replacing an earlier pick's. */
  holdShowFolder: (rows: EpisodeFormRow[]) => void;
  /** The episode list's: take the folder's rows off, the hand-added ones stay. */
  removeShowFolder: () => void;
  /**
   * Fill the title with the read's **Title guess** when it is empty, or still
   * `picked`, the guess an earlier pick filled in (`null` before any); a
   * typed one stays.
   */
  prefillTitle: (guess: string, picked: string | null) => void;
  /** `useImportMode`'s: whether Link can be for the picked folder. */
  setShowLink: (available: boolean) => void;
}

export interface UseShowFolderPickResult {
  /**
   * Opens the **Folder bridge**'s one-folder dialog for a **Show folder
   * pick** — `null` where there is no bridge, or beside a plain add, and no
   * _＋ Add show folder_ is drawn.
   */
  addShowFolder: (() => void) | null;
  /** The picked **Show folder**, absolute, for its row — or `null`. */
  showFolder: string | null;
  /** The Show folder row's ✕: its rows go, the rows added by hand stay. */
  removeShowFolder: () => void;
  /** The sentence a refused Show folder read is drawn as, or `null`. */
  refusal: string | null;
  /** How many subtitles the picked Show folder matched to no episode. */
  straySubtitles: number;
}

/**
 * The series add's **Show folder pick**, a hook of its own on
 * `useEpisodeList`'s pattern: the folder the dialog answered, read by the
 * server, its rows after the held ones; an empty title takes the read's
 * **Title guess**, and its Library folder says whether Link can be. A cancel
 * changes nothing; a refusal — unreadable, empty, or a held series's own
 * folder, worded by that series's title — adds no rows. A second pick
 * replaces only the first pick's rows, and the title the first pick filled
 * in, never a typed one.
 */
export function useShowFolderPick({
  plainAdd,
  holdShowFolder,
  removeShowFolder: dropShowFolder,
  prefillTitle,
  setShowLink,
}: UseShowFolderPickInput): UseShowFolderPickResult {
  const [showFolder, setShowFolder] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [straySubtitles, setStraySubtitles] = useState(0);
  // The **Title guess** the last pick offered, so a new pick knows the title
  // it may replace.
  const pickedTitle = useRef<string | null>(null);
  const bridge = folderBridge();

  const pickShowFolder = useCallback(async () => {
    const path = await bridge?.pickOne();
    if (path === null || path === undefined) {
      return;
    }
    const answer = await readShowFolder(path).catch(() => null);
    if (answer === null) {
      return;
    }
    if (answer.kind === 'refused') {
      setRefusal(answer.sentence);
      return;
    }
    const { read } = answer;
    if (read.heldSeriesId !== null) {
      // Already a held series's **Show folder**: refused by that series's own
      // title, and no rows land.
      const held = await fetchSeriesDetail(read.heldSeriesId).catch(() => null);
      setRefusal(heldShowFolderRefusal(held?.series.title ?? read.titleGuess));
      return;
    }
    setRefusal(null);
    setShowFolder(read.path);
    setStraySubtitles(read.straySubtitles);
    setShowLink(read.libraryFolderId !== null);
    holdShowFolder(showFolderRows(read));
    prefillTitle(read.titleGuess, pickedTitle.current);
    pickedTitle.current = read.titleGuess;
  }, [bridge, holdShowFolder, prefillTitle, setShowLink]);

  const addShowFolder = useCallback(() => {
    void pickShowFolder();
  }, [pickShowFolder]);

  const removeShowFolder = useCallback(() => {
    setShowFolder(null);
    setStraySubtitles(0);
    setShowLink(true);
    dropShowFolder();
  }, [dropShowFolder, setShowLink]);

  return {
    addShowFolder: bridge !== null && plainAdd ? addShowFolder : null,
    showFolder,
    removeShowFolder,
    refusal,
    straySubtitles,
  };
}
