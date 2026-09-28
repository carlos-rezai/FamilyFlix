import type { Movie, Series } from '@/types';
import type { FetchedFields } from '../fetchedFields/fetchedFields';

/**
 * Pure: a movie's values now, in the fetched shape `planFields` compares —
 * each column under the chip that fills it.
 */
export function currentFields(movie: Movie): FetchedFields {
  return {
    synopsis: movie.synopsis,
    poster: movie.posterPath,
    backdrop: movie.backdropPath,
    runtime: movie.runtimeMinutes,
    year: movie.year,
    genres: movie.genres.map((genre) => genre.name),
    director: movie.director,
    cast: movie.cast,
    originalTitle: movie.originalTitle,
    tmdbScore: movie.tmdbScore,
  };
}

/**
 * Pure: a series' values now, in the same shape — its creator where a film's
 * director stands, and no runtime, since a series has none of its own.
 */
export function currentSeriesFields(series: Series): FetchedFields {
  return {
    synopsis: series.synopsis,
    poster: series.posterPath,
    backdrop: series.backdropPath,
    runtime: null,
    year: series.year,
    genres: series.genres.map((genre) => genre.name),
    director: series.creator,
    cast: series.cast,
    originalTitle: series.originalTitle,
    tmdbScore: series.tmdbScore,
  };
}
