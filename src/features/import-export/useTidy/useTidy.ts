import { useCallback, useEffect, useState } from 'react';

import type { BusyPhase, TidyPlan, TidyResult } from '@/types';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import { fetchTidyPlan, tidyFolder } from '../api/api';

export interface TidyState {
  /** The folder's **Tidy plan**; `null` until it lands, and on every open. */
  plan: TidyPlan | null;
  /** _Move N videos_' **Busy phase**, on the **Loader timing**. */
  moving: BusyPhase;
  /** The last move's result when any of it failed; `null` otherwise. */
  partial: TidyResult | null;
  /** The route's `409` sentence for the last move refused; `null` otherwise. */
  refusal: string | null;
  /** Post the drawn tidies' ids; never rejects. */
  move: () => Promise<void>;
}

/**
 * The **Tidy dialog**'s state: on each open, the folder's **Tidy plan**,
 * read afresh. A read that lands after the dialog closed, or for a folder
 * since swapped, is dropped; a failed read leaves the plan `null`. `move`
 * posts the ids drawn and hands every result that lands to `onMoved`; one
 * with failures is kept as `partial`, a `409` as `refusal`.
 */
export function useTidy(
  open: boolean,
  folderId: string,
  onMoved: (result: TidyResult) => void
): TidyState {
  const [plan, setPlan] = useState<TidyPlan | null>(null);
  const [partial, setPartial] = useState<TidyResult | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const { phase: moving, run } = useDelayedBusy();

  useEffect(() => {
    setPlan(null);
    setPartial(null);
    setRefusal(null);
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

  const move = useCallback(async () => {
    if (plan === null) {
      return;
    }
    try {
      const outcome = await run(() =>
        tidyFolder(
          folderId,
          plan.tidies.map((tidy) => tidy.id)
        )
      );
      if (outcome.kind === 'refused') {
        setRefusal(outcome.sentence);
        return;
      }
      setRefusal(null);
      setPartial(outcome.result.failed.length > 0 ? outcome.result : null);
      onMoved(outcome.result);
    } catch {
      // A failure the route did not word leaves the dialog as it was.
    }
  }, [plan, folderId, run, onMoved]);

  return { plan, moving, partial, refusal, move };
}
