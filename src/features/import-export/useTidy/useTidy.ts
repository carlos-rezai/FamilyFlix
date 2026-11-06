import { useEffect, useState } from 'react';

import type { TidyPlan } from '@/types';
import { fetchTidyPlan } from '../api/api';

export interface TidyState {
  /** The folder's **Tidy plan**; `null` until it lands, and on every open. */
  plan: TidyPlan | null;
}

/**
 * The **Tidy dialog**'s state: on each open, the folder's **Tidy plan**,
 * read afresh. A read that lands after the dialog closed, or for a folder
 * since swapped, is dropped; a failed read leaves the plan `null`.
 */
export function useTidy(open: boolean, folderId: string): TidyState {
  const [plan, setPlan] = useState<TidyPlan | null>(null);

  useEffect(() => {
    setPlan(null);
    if (!open) {
      return;
    }
    let live = true;
    fetchTidyPlan(folderId).then(
      (read) => {
        if (live) setPlan(read);
      },
      () => undefined
    );
    return () => {
      live = false;
    };
  }, [open, folderId]);

  return { plan };
}
