import type { HomeRow } from '../../../../src/types';
import type { Browse } from '../browse/browse';

/**
 * How many movies a single home genre row carries. The row's `count` still
 * reports the genre's true total, so "View all {count}" stays honest when the
 * genre holds more than the carousel shows.
 */
export const HOME_ROW_LIMIT = 15;

/** The home-screen aggregate: the whole browse payload in one call. */
export interface Home {
  listHomeRows(): HomeRow[];
}

/**
 * Build the home aggregate over the {@link Browse} slice — one row per populated
 * genre (alphabetical, since `listGenres` already orders by name), each capped
 * at {@link HOME_ROW_LIMIT} movies newest-first. A genre with no movies never
 * reaches `listGenres`, so it simply produces no row; a movie tagged with
 * several genres appears in each of their rows.
 *
 * Composing the two existing browse queries keeps the aggregation in the
 * repository (one call for the route to serve) instead of leaving the client to
 * fan out a request per genre.
 */
export function createHome(browse: Browse): Home {
  function listHomeRows(): HomeRow[] {
    return browse.listGenres().map((genre) => ({
      genre: genre.name,
      count: genre.count,
      movies: browse.listMovies({
        genre: genre.name,
        sort: 'recently-added',
        limit: HOME_ROW_LIMIT,
      }),
    }));
  }

  return { listHomeRows };
}
