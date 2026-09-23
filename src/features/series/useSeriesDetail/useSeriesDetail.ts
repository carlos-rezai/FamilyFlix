import { useCallback, useEffect, useState } from 'react';

import type { SeriesDetailModel } from '@/types';
import { fetchSeriesDetail } from '../api/api';
import { seriesView } from '../seriesView/seriesView';

/** The movie page's **Load state**: status and series move together. */
type SeriesDetailState =
  | { status: 'loading'; series: null }
  | { status: 'not-found'; series: null }
  | { status: 'error'; series: null }
  | { status: 'ready'; series: SeriesDetailModel };

export type UseSeriesDetailResult = SeriesDetailState & {
  /** Re-run the load after a failure. */
  retry: () => void;
};

/**
 * Loads one series by the id in the page's URL and hands it back mapped for
 * the screen — `useMovieDetail`'s load, without its edits: this slice writes
 * nothing. A 404 is `not-found`, anything else that fails is `error`.
 */
export function useSeriesDetail(id: string): UseSeriesDetailResult {
  const [state, setState] = useState<SeriesDetailState>({
    status: 'loading',
    series: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    setState({ status: 'loading', series: null });

    fetchSeriesDetail(id)
      .then((detail) => {
        if (!current) {
          return;
        }
        setState(
          detail === null
            ? { status: 'not-found', series: null }
            : { status: 'ready', series: seriesView(detail) }
        );
      })
      .catch(() => {
        if (current) {
          setState({ status: 'error', series: null });
        }
      });

    // A stale response must not overwrite a retry that already started.
    return () => {
      current = false;
    };
  }, [id, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, retry };
}
