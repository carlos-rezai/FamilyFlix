import { useCallback } from 'react';

import type { Episode, SeriesPageModel } from '@/types';
import { saveSeriesFavorite } from '@/api/saveSeriesFavorite/saveSeriesFavorite';
import { useTmdbRatings } from '@/App/useTmdbRatings/useTmdbRatings';
import { useOptimisticEdit } from '@/hooks/useOptimisticEdit/useOptimisticEdit';
import { saveSeriesWatched } from '../api/api';
import { marked, patchEpisodes } from '../markEpisodes/markEpisodes';
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
  /**
   * Mark every episode watched, or every one unwatched when all already are —
   * the season page's mark over the whole series, shown at once, put back if
   * the save is refused.
   */
  toggleWatched: () => void;
};

/** The held read with the series' heart set to `isFavorite`. */
const withFavorite = (held: HeldSeries, isFavorite: boolean): HeldSeries => ({
  ...held,
  series: { ...held.series, isFavorite },
});

/** The held read with every episode as `snapshot` holds it, else as it was. */
const restoreEpisodes = (held: HeldSeries, snapshot: Episode[]): HeldSeries => {
  const byId = new Map(snapshot.map((episode) => [episode.id, episode]));
  return patchEpisodes(held, (episode) => byId.get(episode.id) ?? episode);
};

/**
 * The series page's read — `useSeriesRead`'s load, mapped by `seriesView` per
 * render — and its two edits, the heart and the watched circle, on
 * `useOptimisticEdit`: shown at once, the route's echo taken over what was
 * assumed, put back on refusal.
 */
export function useSeriesDetail(id: string): UseSeriesDetailResult {
  const read = useSeriesRead(id);
  const tmdbRatings = useTmdbRatings();
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

  /** The watched circle — the movie page's tick, over every episode. */
  const toggleWatched = useCallback(() => {
    if (detail === null) {
      return;
    }
    const episodes = detail.seasons.flatMap((season) => season.episodes);
    if (episodes.length === 0) {
      return;
    }
    edit({
      next: !episodes.every((episode) => episode.watched),
      capture: () => episodes,
      apply: (held, value) =>
        patchEpisodes(held, (episode) => marked(episode, value)),
      restore: restoreEpisodes,
      save: saveSeriesWatched,
    });
  }, [detail, edit]);

  const handlers = { retry, toggleFavorite, toggleWatched };
  return read.status === 'ready'
    ? {
        status: 'ready',
        series: seriesView(read.detail, tmdbRatings),
        ...handlers,
      }
    : { status: read.status, series: null, ...handlers };
}
