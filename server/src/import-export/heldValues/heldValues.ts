import type { Movie, Series, WatchStatus } from '@/types';

/**
 * A held title's values in the sheet's shape: a film's or a series' fields
 * the sheet can name, its genres by name, a series' creator as `director`.
 * `status` is a film's watch state; a series reads as `unwatched`. `endYear`
 * is a series' alone; a film's is `null`.
 */
export interface HeldValues {
  title: string;
  year: number | null;
  endYear: number | null;
  genres: string[];
  director: string | null;
  cast: string[];
  synopsis: string | null;
  rating: number | null;
  status: WatchStatus;
}

/**
 * Pure: a held movie's values now, in the shape `planSheetFields` compares a
 * **Sheet row** against — `currentFields`' twin on the import's side.
 */
export function heldValues(movie: Movie): HeldValues {
  return {
    title: movie.title,
    year: movie.year,
    endYear: null,
    genres: movie.genres.map((genre) => genre.name),
    director: movie.director,
    cast: movie.cast,
    synopsis: movie.synopsis,
    rating: movie.rating,
    status: movie.status,
  };
}

/**
 * Pure: a held series' values now, in the same shape — its creator where a
 * film's director stands, its **Year range** as `year` and `endYear`, and
 * `unwatched`, since a series has no watch state of its own.
 */
export function heldSeriesValues(series: Series): HeldValues {
  return {
    title: series.title,
    year: series.year,
    endYear: series.endYear,
    genres: series.genres.map((genre) => genre.name),
    director: series.creator,
    cast: series.cast,
    synopsis: series.synopsis,
    rating: series.rating,
    status: 'unwatched',
  };
}
