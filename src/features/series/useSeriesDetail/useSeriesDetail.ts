import { useCallback } from 'react';

import type { SeriesPageModel } from '@/types';
import { saveSeriesFavorite } from '@/api/saveSeriesFavorite/saveSeriesFavorite';
import { seriesView } from '../seriesView/seriesView';
import { useSeriesRead } from '../useSeriesRead/useSeriesRead';

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
 * The series page's read — `useSeriesRead`'s load, mapped by `seriesView` per
 * render — and its one edit, the heart, optimistic and put back on refusal.
 */
export function useSeriesDetail(id: string): UseSeriesDetailResult {
  const read = useSeriesRead(id);
  const { detail, retry, editSeries } = read;

  /** Writes a favorite value into the series on screen, if it still holds one. */
  const applyFavorite = useCallback(
    (isFavorite: boolean) =>
      editSeries((held) => ({
        ...held,
        series: { ...held.series, isFavorite },
      })),
    [editSeries]
  );

  const seriesId = detail?.id ?? null;
  const isFavorite = detail?.series.isFavorite ?? false;

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

  const handlers = { retry, toggleFavorite };
  return read.status === 'ready'
    ? { status: 'ready', series: seriesView(read.detail), ...handlers }
    : { status: read.status, series: null, ...handlers };
}
