import { useEffect, useState } from 'react';

import type { LibraryTitles } from '@/types';
import { fetchLibraryTitles } from '../api/api';

export interface LibraryTitlesState {
  /** Both lists, `null` until the read lands and still if it never does. */
  titles: LibraryTitles | null;
}

/**
 * The **Library titles** the Manage library page draws, read once on mount —
 * **Blank until it lands**.
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

  return { titles };
}
