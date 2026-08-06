import type { Movie, PosterCardMovie } from '@/types';
import { gradientFromId, toRatingPercent, toProgressPercent } from '@/utils';

/** Path prefix for the Express route that streams managed poster images. */
const IMAGE_ROUTE = '/api/images/';

/**
 * Maps a canonical `Movie` record to the `PosterCardMovie` a `PosterCard`
 * renders. The pure seam between the domain model and the tile: it resolves the
 * poster path to an image-route URL (or `null` → gradient fallback), always
 * computes deterministic gradient stops from the id, scales the rating and
 * resume position to percents, and carries the watched / favorite flags through
 * (`isFavorite` → `favorite`).
 */
export function view(movie: Movie): PosterCardMovie {
  const { g1, g2 } = gradientFromId(movie.id);
  return {
    id: movie.id,
    title: movie.title,
    posterUrl: movie.posterPath ? `${IMAGE_ROUTE}${movie.posterPath}` : null,
    g1,
    g2,
    rating: toRatingPercent(movie.rating),
    watched: movie.watched,
    progress: toProgressPercent(
      movie.resumePositionSeconds,
      movie.runtimeMinutes
    ),
    favorite: movie.isFavorite,
  };
}
