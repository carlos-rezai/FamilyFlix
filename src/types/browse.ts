/**
 * The repository's read contracts — how the library is queried and what comes
 * back. Every shape here is a way of asking for {@link Movie} records, not a
 * different record.
 */

import type { Movie } from './movie';

/**
 * Every browse sort order `listMovies` offers, and the wire's vocabulary for
 * them. Each maps to one ORDER BY:
 * - `recently-added` — `created_at DESC` (newest first), `id` tiebreak.
 * - `a-z` — `title` ascending, case-insensitive.
 * - `year` — `year DESC` (newest first); unknown year (`null`) sorts last.
 * - `highest-rated` — `rating DESC`; unrated (`null`) sorts last.
 * - `unwatched-first` — unwatched, then in-progress, then watched; title A–Z within each.
 *
 * The list is a value rather than only a type because both build targets have
 * to *check* a sort at runtime as well as name one: a sort arrives from a
 * hand-editable URL, and a route, a URL parser and a dropdown each have to say
 * whether they recognise it. Declaring the union separately from that list is
 * how the two drift, so the union is derived from it below.
 *
 * This is the wire's order, not a running order — the dropdown draws the
 * prototype's, which deliberately is not this one.
 */
export const MOVIE_SORTS = [
  'recently-added',
  'a-z',
  'year',
  'highest-rated',
  'unwatched-first',
] as const;

/** One of the orders in {@link MOVIE_SORTS}, and never anything else. */
export type MovieSort = (typeof MOVIE_SORTS)[number];

/**
 * A parameterized browse query: one `sort` plus any combination of filters.
 * Every filter narrows the result; omitted filters are no-ops. Filters and sort
 * combine in a single query.
 */
export interface MovieQuery {
  sort: MovieSort;
  /** Restrict to movies tagged with this genre name (e.g. `'Action'`). */
  genre?: string;
  /** Keep only movies with `rating >= minRating`; unrated movies are excluded. */
  minRating?: number;
  /**
   * Case-insensitive substring match on the title, the synopsis, **or** a genre
   * name — a movie matching on several of those arms still comes back once.
   */
  search?: string;
  /** Keep only favorites. */
  favoritesOnly?: boolean;
  /** Keep only in-progress movies (`resumePositionSeconds > 0` and not watched). */
  inProgressOnly?: boolean;
  /**
   * Cap how many movies come back, applied after the filters and the sort (SQL
   * `LIMIT`). Omitted means no cap — every matching movie is returned.
   */
  limit?: number;
}

/**
 * The browse home's query: the filters and sort the header composes, threaded
 * into every section of the home payload so the top of the screen can never
 * disagree with the rest of it. A subset of {@link MovieQuery} — the
 * per-section additions (`genre` for a row, `inProgressOnly` for the continue
 * section, and the row `limit`) belong to `getHome`, not to the caller.
 */
export interface HomeQuery {
  sort: MovieSort;
  /** @see MovieQuery.search */
  search?: string;
  /** @see MovieQuery.genre */
  genre?: string;
  /** @see MovieQuery.minRating */
  minRating?: number;
}

/** A genre plus how many movies are tagged with it — for the home genre rows. */
export interface GenreCount {
  id: string;
  name: string;
  count: number;
}

/**
 * One genre row of the browse home, as `getHome()` builds it and
 * `GET /api/home` returns it: the genre name, its **true total** movie count,
 * and the capped, recently-added-first slice of movies the row displays
 * (`count` is therefore ≥ `movies.length`). The frontend maps each `Movie`
 * through `view()` before rendering it as a card.
 */
export interface HomeRow {
  genre: string;
  count: number;
  movies: Movie[];
}

/**
 * The whole browse home in one payload, as `getHome()` builds it and
 * `GET /api/home` returns it — named sections rather than a bare row array, so
 * a new section can join without breaking the ones already there.
 *
 * `continueWatching` holds the in-progress movies, recently-added-first and
 * capped at the same limit as a genre row; a movie part-way through appears
 * here **and** in each of its genre rows, since "what am I part-way through"
 * and "what Action do I own" are two different questions. Both sections are
 * `[]` for an empty library.
 */
export interface HomePayload {
  continueWatching: Movie[];
  rows: HomeRow[];
}

/**
 * The genre list `GET /api/genres` answers with — what the Genre dropdown is
 * built from. It has a different lifetime to {@link HomePayload}: fetched once
 * per mount and deliberately unfiltered, so the counts cannot reshuffle under a
 * finger already reaching for them.
 *
 * `total` is a count of **movies**, not the sum of `genres[].count` — a movie
 * tagged twice is still one movie on the shelf, and it includes the untagged
 * ones that earn no genre row at all.
 */
export interface GenreListPayload {
  total: number;
  genres: GenreCount[];
}
