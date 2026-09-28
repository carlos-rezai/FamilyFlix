import type { TmdbMovieDetail, TmdbTvDetail } from '../tmdbClient/tmdbClient';
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

/** A TV detail's fields, plus the last year it aired. */
export interface FetchedTvFields extends FetchedFields {
  endYear: number | null;
}

/** How many of the cast a Sync keeps, in billing order. */
const CAST_SIZE = 10;

/** A blank string as `null`, never an empty string. */
const text = (value: string | null | undefined): string | null =>
  value === null || value === undefined || value.trim() === '' ? null : value;

/** The year off a TMDB date — a release or an air date — `null` for none. */
export function releaseYear(date: string | null | undefined): number | null {
  const year = Number.parseInt((date ?? '').slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

/** The top of the billing, in order. */
function topCast(
  members: readonly { name: string; order: number }[]
): string[] {
  return [...members]
    .sort((a, b) => a.order - b.order)
    .slice(0, CAST_SIZE)
    .map((member) => member.name);
}

/** `vote_average` to one decimal, `null` for none. */
function score(voteAverage: number | undefined): number | null {
  return typeof voteAverage === 'number'
    ? Math.round(voteAverage * 10) / 10
    : null;
}

/**
 * Pure: a TMDB movie detail, fetched with its credits → our columns. Director
 * is the first crew credit whose job is Director; cast the top ten; the score
 * `vote_average` to one decimal; genres onto the pool.
 */
export function fetchedFields(detail: TmdbMovieDetail): FetchedFields {
  const cast = topCast(detail.credits.cast);
  const director =
    detail.credits.crew.find((member) => member.job === 'Director')?.name ??
    null;
  return {
    synopsis: text(detail.overview),
    poster: text(detail.poster_path),
    backdrop: text(detail.backdrop_path),
    runtime: detail.runtime ? detail.runtime : null,
    year: releaseYear(detail.release_date),
    genres: tmdbGenres(detail.genres.map((genre) => genre.name)),
    director,
    cast,
    originalTitle: text(detail.original_title),
    tmdbScore: score(detail.vote_average),
  };
}

/**
 * Pure: a TMDB TV detail, fetched with its credits → our columns at show
 * level. Where a film has its director a series has its creator —
 * `created_by`'s names joined with `, `; the year range comes off the first
 * and last air dates; a series has no runtime of its own.
 */
export function fetchedTvFields(detail: TmdbTvDetail): FetchedTvFields {
  const creators = detail.created_by.map((person) => person.name).join(', ');
  return {
    synopsis: text(detail.overview),
    poster: text(detail.poster_path),
    backdrop: text(detail.backdrop_path),
    runtime: null,
    year: releaseYear(detail.first_air_date),
    endYear: releaseYear(detail.last_air_date),
    genres: tmdbGenres(detail.genres.map((genre) => genre.name)),
    director: text(creators),
    cast: topCast(detail.credits.cast),
    originalTitle: text(detail.original_name),
    tmdbScore: score(detail.vote_average),
  };
}
