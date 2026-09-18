import { useEffect, useState } from 'react';

import type { StorageReport } from '@/types';
import { fetchStorageReport } from '../api/api';

export interface StorageReportState {
  /**
   * The **Storage report**: `null` until the read lands, the payload after,
   * and `null` still if it never does.
   */
  report: StorageReport | null;
}

/**
 * The **Storage report** the `StorageSection` draws, fetched once on mount —
 * `useCapabilities`'s shape repeated.
 *
 * **Blank until it lands**: no skeleton, no error face, no snackbar. The
 * prototype draws none, and a refused read is a report that never arrived. A
 * report that lands after the screen has gone redraws nothing.
 */
export function useStorageReport(): StorageReportState {
  const [report, setReport] = useState<StorageReport | null>(null);

  useEffect(() => {
    let wanted = true;

    fetchStorageReport().then(
      (landed) => {
        if (wanted) {
          setReport(landed);
        }
      },
      () => undefined
    );

    return () => {
      wanted = false;
    };
  }, []);

  return { report };
}
