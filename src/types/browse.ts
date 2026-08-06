/**
 * The repository's read contracts — how the library is queried and what comes
 * back. Every shape here is a way of asking for {@link Movie} records, not a
 * different record.
 */

import type { Movie } from './movie';

/**
 * The browse sort orders for `listMovies`. Each maps to one ORDER BY:
 * - `recently-added` — `created_at DESC` (newest first), `id` tiebreak.
 * - `a-z` — `title` ascending, case-insensitive.
 * - `year` — `year DESC` (newest first); unknown year (`null`) sorts last.
 * - `highest-rated` — `rating DESC`; unrated (`null`) sorts last.
 * - `unwatched-first` — unwatched, then in-progress, then watched; title A–Z within each.
 */
export type MovieSort =
  | 'recently-added'
  | 'a-z'
  | 'year'
  | 'highest-rated'
  | 'unwatched-first';

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
  /** Case-insensitive substring match on the title. */
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

/** A genre plus how many movies are tagged with it — for the home genre rows. */
export interface GenreCount {
  id: string;
  name: string;
  count: number;
}

/**
 * One genre row of the browse home, as `listHomeRows()` builds it and
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
