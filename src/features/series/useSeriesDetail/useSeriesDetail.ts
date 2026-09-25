import { useCallback } from 'react';

import type { SeriesPageModel } from '@/types';
import { saveSeriesFavorite } from '@/api/saveSeriesFavorite/saveSeriesFavorite';
import { useOptimisticEdit } from '@/hooks/useOptimisticEdit/useOptimisticEdit';
import { seriesView } from '../seriesView/seriesView';
import { useSeriesRead, type HeldSeries } from '../useSeriesRead/useSeriesRead';

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

/** The held read with the series' heart set to `isFavorite`. */
const withFavorite = (held: HeldSeries, isFavorite: boolean): HeldSeries => ({
  ...held,
  series: { ...held.series, isFavorite },
});

/**
 * The series page's read — `useSeriesRead`'s load, mapped by `seriesView` per
 * render — and its one edit, the heart, on `useOptimisticEdit`: shown at once,
 * the route's echo taken over what was assumed, put back on refusal.
 */
export function useSeriesDetail(id: string): UseSeriesDetailResult {
  const read = useSeriesRead(id);
  const { detail, retry, editSeries } = read;

  const edit = useOptimisticEdit(detail, editSeries);

  /** The heart — the movie page's heart, on the one bargain it keeps. */
  const toggleFavorite = useCallback(() => {
    if (detail === null) {
      return;
    }
    edit({
      next: !detail.series.isFavorite,
      capture: (held) => held.series.isFavorite,
      apply: withFavorite,
      restore: withFavorite,
      save: saveSeriesFavorite,
    });
  }, [detail, edit]);

  const handlers = { retry, toggleFavorite };
  return read.status === 'ready'
    ? { status: 'ready', series: seriesView(read.detail), ...handlers }
    : { status: read.status, series: null, ...handlers };
}
