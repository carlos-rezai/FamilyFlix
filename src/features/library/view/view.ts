import type { Movie, PosterCardMovie } from '@/types';
import {
  gradientFromId,
  imageUrl,
  toRatingPercent,
  toProgressPercent,
} from '@/utils';

/**
 * Maps a canonical `Movie` record to the `PosterCardMovie` a `PosterCard`
 * renders. The pure seam between the domain model and the tile: it resolves the
 * poster path to an image-route URL (or `null` → the Default poster), always
 * computes deterministic gradient stops from the id, scales the rating and
 * resume position to percents, and carries the watched / favorite flags through
 * (`isFavorite` → `favorite`).
 *
 * An unrated movie stays unrated: `rating` comes through as `null` rather than
 * as a zero score, because those are different facts and the tile prints them
 * differently.
 */
export function view(movie: Movie): PosterCardMovie {
  const { g1, g2 } = gradientFromId(movie.id);
  return {
    id: movie.id,
    title: movie.title,
    posterUrl: imageUrl(movie.posterPath),
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
