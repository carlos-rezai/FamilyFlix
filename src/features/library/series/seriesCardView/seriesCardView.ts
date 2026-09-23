import type { PosterCardMovie, Series } from '@/types';
import { gradientFromId, toRatingPercent } from '@/utils';

/** Path prefix for the Express route that streams managed poster images. */
const IMAGE_ROUTE = '/api/images/';

/**
 * Maps a **Series** to the `PosterCardMovie` an unchanged `PosterCard` renders
 * — `view`'s precedent for a movie. Gradient art off the series id when there
 * is no poster, the watched badge when every episode is watched, and never a
 * progress bar: a series has no resume position of its own.
 */
export function seriesCardView(series: Series): PosterCardMovie {
  const { g1, g2 } = gradientFromId(series.id);
  return {
    id: series.id,
    title: series.title,
    posterUrl: series.posterPath ? `${IMAGE_ROUTE}${series.posterPath}` : null,
    g1,
    g2,
    rating: toRatingPercent(series.rating),
    watched: series.watched,
    progress: 0,
    favorite: series.isFavorite,
  };
}
