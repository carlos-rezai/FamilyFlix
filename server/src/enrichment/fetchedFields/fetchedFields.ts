import type { TmdbMovieDetail } from '../tmdbClient/tmdbClient';
import { tmdbGenres } from '../tmdbGenres/tmdbGenres';

/**
 * What TMDB answered for a title, keyed by **Enrichment field** chip. `null`
 * — or an empty list — is what TMDB left blank. Poster and backdrop are
 * TMDB's image paths, what the image stream is asked for.
 */
export interface FetchedFields {
  synopsis: string | null;
  poster: string | null;
  backdrop: string | null;
  runtime: number | null;
  year: number | null;
  genres: readonly string[];
  director: string | null;
  cast: readonly string[];
  originalTitle: string | null;
  tmdbScore: number | null;
}

/** How many of the cast a Sync keeps, in billing order. */
const CAST_SIZE = 10;

/** A blank string as `null`, never an empty string. */
const text = (value: string | null | undefined): string | null =>
  value === null || value === undefined || value.trim() === '' ? null : value;

/** The year off an ISO date, `null` for none. */
function yearOf(date: string | null | undefined): number | null {
  const year = Number.parseInt((date ?? '').slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

/**
 * Pure: a TMDB movie detail, fetched with its credits → our columns. Director
 * is the first crew credit whose job is Director; cast the top ten; the score
 * `vote_average` to one decimal; genres onto the pool.
 */
export function fetchedFields(detail: TmdbMovieDetail): FetchedFields {
  const cast = [...detail.credits.cast]
    .sort((a, b) => a.order - b.order)
    .slice(0, CAST_SIZE)
    .map((member) => member.name);
  const director =
    detail.credits.crew.find((member) => member.job === 'Director')?.name ??
    null;
  return {
    synopsis: text(detail.overview),
    poster: text(detail.poster_path),
    backdrop: text(detail.backdrop_path),
    runtime: detail.runtime ? detail.runtime : null,
    year: yearOf(detail.release_date),
    genres: tmdbGenres(detail.genres.map((genre) => genre.name)),
    director,
    cast,
    originalTitle: text(detail.original_title),
    tmdbScore:
      typeof detail.vote_average === 'number'
        ? Math.round(detail.vote_average * 10) / 10
        : null,
  };
}
