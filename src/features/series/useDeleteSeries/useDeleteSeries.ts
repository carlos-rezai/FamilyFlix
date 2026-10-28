import { useCallback, useState } from 'react';

import type { BusyPhase } from '@/types';
import { useDelayedBusy } from '@/hooks/useDelayedBusy/useDelayedBusy';
import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { seriesTabPath } from '@/utils';
import { deleteSeries as sendDelete } from '@/api/deleteSeries/deleteSeries';

/** Where a delete lands with nothing behind the page: the Series tab. */
const LANDING = seriesTabPath();

export interface DeleteSeries {
  /**
   * The delete's **Busy phase**, on the **Loader timing**: `waiting` from
   * the confirm, `shown` once it has run 300ms. Its outcome, the leaving or
   * the failure, lands only once the loader's hold is out.
   */
  deleting: BusyPhase;
  /** Whether the last delete failed; the next confirm clears it. */
  failed: boolean;
  /**
   * Sends the delete and, once the series is gone, leaves its page. Rejects
   * with the request's own error when the delete failed, nothing moved.
   */
  deleteSeries: () => Promise<void>;
}

/**
 * The hook behind the series Delete dialog's confirm, `useDeleteMovie`'s twin:
 * on resolution — a `404` included — it goes back through `useGoBack`, one
 * **History step**, or the Series tab, its **Landing**, when nothing is behind.
 */
export function useDeleteSeries(seriesId: string): DeleteSeries {
  const goBack = useGoBack(LANDING);
  const { phase: deleting, run } = useDelayedBusy();
  const [failed, setFailed] = useState(false);

  const deleteSeries = useCallback(async () => {
    setFailed(false);
    try {
      await run(() => sendDelete(seriesId));
    } catch (error: unknown) {
      setFailed(true);
      throw error;
    }
    goBack();
  }, [seriesId, goBack, run]);

  return { deleting, failed, deleteSeries };
}
