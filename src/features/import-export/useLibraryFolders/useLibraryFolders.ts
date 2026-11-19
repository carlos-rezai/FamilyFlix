import { useCallback, useEffect, useState } from 'react';

import type { BusyPhase, LibraryFolderView } from '@/types';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import { useDelayedBusyByKey } from '@/hooks/useDelayedBusyByKey/useDelayedBusyByKey';
import {
  addLibraryFolder,
  bringBackLeftOut,
  fetchLibraryFolders,
  removeLibraryFolder,
} from '../api/api';

export interface LibraryFoldersState {
  /**
   * The listed folders, `null` until the read lands and still if it never
   * does.
   */
  folders: LibraryFolderView[] | null;
  /**
   * Post one path, resolving whether it was added; never rejects — a refusal
   * lands in `refusal`.
   */
  add: (path: string) => Promise<boolean>;
  /** Delete one folder by id and drop its row; never rejects. */
  remove: (id: string) => Promise<void>;
  /**
   * **Bring back** one folder's **Left-out videos** and zero its count once the
   * route agrees; never rejects.
   */
  bringBack: (id: string) => Promise<void>;
  /**
   * The add's **Busy phase**, on the **Loader timing**. Its outcome, the new
   * row or the refusal, lands only once the loader's hold is out.
   */
  adding: BusyPhase;
  /**
   * One folder's ✕ or **Bring back** as a **Busy phase**, on the **Loader
   * timing** and keyed by the folder; its outcome lands once the hold is out.
   */
  rowPhase: (id: string) => BusyPhase;
  /**
   * The route's own sentence for the last refused add, `null` once one lands.
   */
  refusal: string | null;
  /**
   * The route's own sentence for the last refused remove, by the folder it
   * was about; `null` until one is refused and once a remove lands.
   */
  removeRefusal: { id: string; sentence: string } | null;
}

/**
 * The **Library folders** the page draws: read once on mount — **Blank until
 * it lands** — then kept from the routes' echoes. An add appends the folder
 * the route answered and clears the refusal; refused, it holds the route's
 * sentence and keeps the list. A remove drops the row once the route agrees.
 *
 * A row's remove and _Bring back_ run on the **Loader timing** under the
 * folder's id (`useDelayedBusyByKey`), answered as `rowPhase(id)`: the row
 * locks at once, says _Removing…_ or _Bringing back…_ past 300ms, and drops
 * or redraws only once the hold is out. A refused remove settles back to
 * `idle` and holds its sentence, as before.
 */
export function useLibraryFolders(): LibraryFoldersState {
  const [folders, setFolders] = useState<LibraryFolderView[] | null>(null);
  const { phase: adding, run } = useDelayedBusy();
  const { phaseOf: rowPhase, run: runRow } = useDelayedBusyByKey();
  const [refusal, setRefusal] = useState<string | null>(null);
  const [removeRefusal, setRemoveRefusal] = useState<{
    id: string;
    sentence: string;
  } | null>(null);

  useEffect(() => {
    let live = true;
    fetchLibraryFolders()
      .then((listed) => {
        if (live) {
          setFolders(listed);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const add = useCallback(
    async (path: string) => {
      try {
        const outcome = await run(() => addLibraryFolder(path));
        if (outcome.kind === 'refused') {
          setRefusal(outcome.sentence);
          return false;
        }
        setRefusal(null);
        // A folder just listed has nothing left out yet.
        setFolders((listed) => [
          ...(listed ?? []),
          { ...outcome.folder, leftOut: 0 },
        ]);
        return true;
      } catch {
        // A failure the route did not word leaves the list as it was.
        return false;
      }
    },
    [run]
  );

  const remove = useCallback(
    async (id: string) => {
      try {
        const outcome = await runRow(id, () => removeLibraryFolder(id));
        if (outcome.kind === 'refused') {
          setRemoveRefusal({ id, sentence: outcome.sentence });
          return;
        }
        setRemoveRefusal(null);
        setFolders(
          (listed) => listed?.filter((folder) => folder.id !== id) ?? null
        );
      } catch {
        // The row stays: the route did not take it off.
      }
    },
    [runRow]
  );

  const bringBack = useCallback(
    async (id: string) => {
      try {
        await runRow(id, () => bringBackLeftOut(id));
        setFolders(
          (listed) =>
            listed?.map((folder) =>
              folder.id === id ? { ...folder, leftOut: 0 } : folder
            ) ?? null
        );
      } catch {
        // The line stays: the route did not forget them.
      }
    },
    [runRow]
  );

  return {
    folders,
    add,
    remove,
    bringBack,
    adding,
    rowPhase,
    refusal,
    removeRefusal,
  };
}
