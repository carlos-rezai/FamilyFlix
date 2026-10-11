import { useCallback, useState } from 'react';

import { useGoBack } from '@/hooks/useGoBack/useGoBack';
import { deleteSeries as sendDelete } from '../api/api';

/** Where a delete lands with nothing behind the page: the Series tab. */
const LANDING = '/?tab=series';

export interface DeleteSeries {
  /** True for the life of the request, false before and after. */
  deleting: boolean;
  /**
   * Sends the delete and, once the series is gone, leaves its page. Rejects
   * with the request's own error when the server refused, nothing moved.
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
  const [deleting, setDeleting] = useState(false);

  const deleteSeries = useCallback(async () => {
    setDeleting(true);
    try {
      await sendDelete(seriesId);
    } finally {
      setDeleting(false);
    }
    goBack();
  }, [seriesId, goBack]);

  return { deleting, deleteSeries };
}
