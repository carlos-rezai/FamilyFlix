import { useCallback, useEffect, useState } from 'react';

import type { SeriesPageModel } from '@/types';
import { saveSeriesFavorite } from '@/api/saveSeriesFavorite/saveSeriesFavorite';
import { fetchSeriesDetail } from '../api/api';
import { seriesView } from '../seriesView/seriesView';

/** The movie page's **Load state**: status and series move together. */
type SeriesDetailState =
  | { status: 'loading'; series: null }
  | { status: 'not-found'; series: null }
  | { status: 'error'; series: null }
  | { status: 'ready'; series: SeriesPageModel };

export type UseSeriesDetailResult = SeriesDetailState & {
  /** Re-run the load after a failure. */
  retry: () => void;
  /** Flip the series' heart: shown at once, put back if the save is refused. */
  toggleFavorite: () => void;
};

/**
 * Loads one series by the id in the page's URL and hands it back mapped for
 * the screen — `useMovieDetail`'s load. A 404 is `not-found`, anything else
 * that fails is `error`. Its one edit is the heart, optimistic and put back
 * on refusal.
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

  /** Writes a favorite value into the series on screen, if it still holds one. */
  const applyFavorite = useCallback((isFavorite: boolean) => {
    setState((current) =>
      current.status === 'ready'
        ? { ...current, series: { ...current.series, isFavorite } }
        : current
    );
  }, []);

  const seriesId = state.series?.id ?? null;
  const isFavorite = state.series?.isFavorite ?? false;

  const toggleFavorite = useCallback(() => {
    if (seriesId === null) {
      return;
    }
    const next = !isFavorite;
    applyFavorite(next);
    saveSeriesFavorite(seriesId, next)
      // The route echoes what it stored; trust that over what we assumed.
      .then((saved) => {
        if (saved !== next) {
          applyFavorite(saved);
        }
      })
      .catch(() => applyFavorite(!next));
  }, [seriesId, isFavorite, applyFavorite]);

  return { ...state, retry, toggleFavorite };
}
