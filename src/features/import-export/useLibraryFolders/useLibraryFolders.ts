import { useCallback, useEffect, useState } from 'react';

import type { LibraryFolder } from '@/types';
import {
  addLibraryFolder,
  fetchLibraryFolders,
  removeLibraryFolder,
} from '../api/api';

export interface LibraryFoldersState {
  /**
   * The listed folders, `null` until the read lands and still if it never
   * does.
   */
  folders: LibraryFolder[] | null;
  /**
   * Post one path, resolving whether it was added; never rejects — a refusal
   * lands in `refusal`.
   */
  add: (path: string) => Promise<boolean>;
  /** Delete one folder by id and drop its row; never rejects. */
  remove: (id: string) => Promise<void>;
  /** Whether an add is out. */
  adding: boolean;
  /**
   * The route's own sentence for the last refused add, `null` once one lands.
   */
  refusal: string | null;
}

/**
 * The **Library folders** the page draws: read once on mount — **Blank until
 * it lands** — then kept from the routes' echoes. An add appends the folder
 * the route answered and clears the refusal; refused, it holds the route's
 * sentence and keeps the list. A remove drops the row once the route agrees.
 */
export function useLibraryFolders(): LibraryFoldersState {
  const [folders, setFolders] = useState<LibraryFolder[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

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

  const add = useCallback(async (path: string) => {
    setAdding(true);
    try {
      const outcome = await addLibraryFolder(path);
      if (outcome.kind === 'refused') {
        setRefusal(outcome.sentence);
        return false;
      }
      setRefusal(null);
      setFolders((listed) => [...(listed ?? []), outcome.folder]);
      return true;
    } catch {
      // A failure the route did not word leaves the list as it was.
      return false;
    } finally {
      setAdding(false);
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    try {
      await removeLibraryFolder(id);
      setFolders(
        (listed) => listed?.filter((folder) => folder.id !== id) ?? null
      );
    } catch {
      // The row stays: the route did not take it off.
    }
  }, []);

  return { folders, add, remove, adding, refusal };
}
