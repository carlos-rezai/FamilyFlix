import { useCallback, useEffect, useState } from 'react';

import type { EditRecord } from '@/hooks/useOptimisticEdit/useOptimisticEdit';
import type { SeriesDetail } from '@/types';
import { fetchSeriesDetail } from '../api/api';

/**
 * The series read as the pages hold it: the `SeriesDetail`, addressed by its
 * series' id — which is what lets `useOptimisticEdit` save against it.
 */
export type HeldSeries = SeriesDetail & { id: string };

/** The **Load state**: status and the held read move together. */
type SeriesReadState =
  | { status: 'loading'; detail: null }
  | { status: 'not-found'; detail: null }
  | { status: 'error'; detail: null }
  | { status: 'ready'; detail: HeldSeries };

export type UseSeriesReadResult = SeriesReadState & {
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Write an update into the held read, if one is still held. */
  editSeries: EditRecord<HeldSeries>;
};

/**
 * Loads one series in full by the id in the page's URL — the one load the
 * series page and the season page both read, `useMovieDetail`'s precedent. A
 * 404 is `not-found`, anything else that fails is `error`, and a response
 * that answers after the id has moved on is dropped. Each page maps what it
 * holds per render — `seriesView`, `seasonView` — so an edit is written once,
 * into the raw read, and both pages see it.
 */
export function useSeriesRead(id: string): UseSeriesReadResult {
  const [state, setState] = useState<SeriesReadState>({
    status: 'loading',
    detail: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setState({ status: 'loading', detail: null });

    fetchSeriesDetail(id)
      .then((detail) => {
        if (!current) {
          return;
        }
        setState(
          detail === null
            ? { status: 'not-found', detail: null }
            : { status: 'ready', detail: { ...detail, id: detail.series.id } }
        );
      })
      .catch(() => {
        if (current) {
          setState({ status: 'error', detail: null });
        }
      });

    // A stale response must not overwrite a retry that already started.
    return () => {
      current = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  const editSeries = useCallback<EditRecord<HeldSeries>>((update) => {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, detail: update(current.detail) }
        : current
    );
  }, []);

  return { ...state, retry, editSeries };
}
