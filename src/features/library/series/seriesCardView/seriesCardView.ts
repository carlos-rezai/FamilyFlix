import type { PosterCardMovie, Series } from '@/types';
import {
  gradientFromId,
  imageUrl,
  shownRating,
  toRatingPercent,
} from '@/utils';

/**
 * Maps a **Series** to the `PosterCardMovie` an unchanged `PosterCard` renders
 * — `view`'s precedent for a movie. Gradient art off the series id when there
 * is no poster, the watched badge when every episode is watched, and never a
 * progress bar: a series has no resume position of its own. Its rating is the
 * **Shown rating** under `tmdbRatings`, `view`'s rule.
 */
export function seriesCardView(
  series: Series,
  tmdbRatings: boolean
): PosterCardMovie {
  const { g1, g2 } = gradientFromId(series.id);
  const shown = shownRating(series.rating, series.tmdbScore, tmdbRatings);
  return {
    id: series.id,
    title: series.title,
    posterUrl: imageUrl(series.posterPath),
    g1,
    g2,
    rating: toRatingPercent(shown?.units ?? null),
    ratingSource: shown?.source ?? null,
    watched: series.watched,
    progress: 0,
    favorite: series.isFavorite,
  };
}
