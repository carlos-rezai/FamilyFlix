import { useCallback, useRef, useState } from 'react';

import { fetchSeriesDetail } from '@/api/fetchSeriesDetail/fetchSeriesDetail';
import { folderBridge } from '@/api/folderBridge/folderBridge';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import type { BusyPhase, EpisodeFormRow, FolderArt } from '@/types';
import { readShowFolder } from '../api/api';
import { type PickedKey, showFolderRows } from '../formValues/formValues';

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
   * Offer the form the read's **Folder key**, with `picked`, the key an
   * earlier pick offered (`null` before any), so a typed field stays.
   */
  prefillFolderKey: (key: PickedKey, picked: PickedKey | null) => void;
  /**
   * Offer the form the read's **Folder art**, with `picked`, the art an
   * earlier pick offered (`null` before any), so a slot picked by hand stays.
   */
  prefillFolderArt: (art: FolderArt, picked: FolderArt | null) => void;
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
  /**
   * The Show folder row's ✕: its rows go, the rows added by hand stay, and
   * each art slot still holding the pick's art empties.
   */
  removeShowFolder: () => void;
  /** The sentence a refused Show folder read is drawn as, or `null`. */
  refusal: string | null;
  /** How many subtitles the picked Show folder matched to no episode. */
  straySubtitles: number;
  /**
   * The read's **Busy phase** on the **Loader timing**: the folder read and
   * a held series' title read, never the dialog.
   */
  reading: BusyPhase;
}

/**
 * The series add's **Show folder pick**, a hook of its own on
 * `useEpisodeList`'s pattern: the folder the dialog answered, read by the
 * server, its rows after the held ones, each with its found **Still**; the
 * form is offered the read's **Folder key** and its **Folder art** (the
 * Poster, Backdrop and each **Season poster**), and its Library folder says
 * whether Link can be. A cancel changes nothing; a refusal — unreadable,
 * empty, or a held series's own folder, worded by that series's title — adds
 * no rows. A second pick replaces only the first pick's rows, and the title,
 * year and art the first pick filled in, never a typed field or a slot picked
 * by hand. The row's ✕ takes the rows and that art back.
 *
 * `reading` is the read's **Busy phase** on `useDelayedBusy`: it wraps the
 * folder read and the held series' title read, never the dialog, so it is
 * `idle` while the dialog is open, `waiting` from the folder chosen, and
 * `shown` past 300ms. A refusal settles it back to `idle`.
 */
export function useShowFolderPick({
  plainAdd,
  holdShowFolder,
  removeShowFolder: dropShowFolder,
  prefillFolderKey,
  prefillFolderArt,
  setShowLink,
}: UseShowFolderPickInput): UseShowFolderPickResult {
  const [showFolder, setShowFolder] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [straySubtitles, setStraySubtitles] = useState(0);
  // The **Folder key** the last pick offered, so a new pick knows the fields
  // it may replace.
  const pickedKey = useRef<PickedKey | null>(null);
  // The **Folder art** the last pick offered, so a new pick and the ✕ know the
  // slots they may replace.
  const pickedArt = useRef<FolderArt | null>(null);
  const bridge = folderBridge();
  const { phase: reading, run } = useDelayedBusy();

  const pickShowFolder = useCallback(async () => {
    const path = await bridge?.pickOne();
    if (path === null || path === undefined) {
      return;
    }
    // The read and a held series' title read, timed together; the dialog
    // above never is.
    const outcome = await run(async () => {
      const answer = await readShowFolder(path).catch(() => null);
      if (answer === null || answer.kind === 'refused') {
        return answer;
      }
      const { read } = answer;
      if (read.heldSeriesId === null) {
        return answer;
      }
      const held = await fetchSeriesDetail(read.heldSeriesId).catch(() => null);
      return { kind: 'held' as const, title: held?.series.title ?? read.title };
    });
    if (outcome === null) {
      return;
    }
    if (outcome.kind === 'refused') {
      setRefusal(outcome.sentence);
      return;
    }
    if (outcome.kind === 'held') {
      // Already a held series's **Show folder**: refused by that series's own
      // title, and no rows land.
      setRefusal(heldShowFolderRefusal(outcome.title));
      return;
    }
    const { read } = outcome;
    setRefusal(null);
    setShowFolder(read.path);
    setStraySubtitles(read.straySubtitles);
    setShowLink(read.libraryFolderId !== null);
    holdShowFolder(showFolderRows(read));
    const key: PickedKey = { title: read.title, year: read.year };
    prefillFolderKey(key, pickedKey.current);
    pickedKey.current = key;
    const art: FolderArt = {
      poster: read.poster,
      backdrop: read.backdrop,
      seasonPosters: Object.fromEntries(
        read.seasonPosters.map(({ season, path }) => [season, path])
      ),
    };
    prefillFolderArt(art, pickedArt.current);
    pickedArt.current = art;
  }, [
    bridge,
    run,
    holdShowFolder,
    prefillFolderKey,
    prefillFolderArt,
    setShowLink,
  ]);

  const addShowFolder = useCallback(() => {
    void pickShowFolder();
  }, [pickShowFolder]);

  const removeShowFolder = useCallback(() => {
    setShowFolder(null);
    setStraySubtitles(0);
    setShowLink(true);
    dropShowFolder();
    // The pick's art goes with it, from each slot that still holds it.
    if (pickedArt.current !== null) {
      prefillFolderArt(
        { poster: null, backdrop: null, seasonPosters: {} },
        pickedArt.current
      );
      pickedArt.current = null;
    }
  }, [dropShowFolder, setShowLink, prefillFolderArt]);

  return {
    addShowFolder: bridge !== null && plainAdd ? addShowFolder : null,
    showFolder,
    removeShowFolder,
    refusal,
    straySubtitles,
    reading,
  };
}
