import type { HomePayload, HomeRow, Movie } from '@/types';
import type { Browse } from '../browse/browse';

/**
 * How many movies a single home section carries — a genre row or the continue
 * section alike. A genre row's `count` still reports the genre's true total, so
 * "View all {count}" stays honest when the genre holds more than the carousel
 * shows.
 */
export const HOME_ROW_LIMIT = 15;

/** The home-screen aggregate: the whole browse payload in one call. */
export interface Home {
  getHome(): HomePayload;
}

/**
 * Build the home aggregate over the {@link Browse} slice — every section is a
 * composition of the two existing browse queries, so no new SQL and no new
 * repository primitive appear here.
 *
 * `rows` is one row per populated genre (alphabetical, since `listGenres`
 * already orders by name), each capped at {@link HOME_ROW_LIMIT} movies
 * newest-first. A genre with no movies never reaches `listGenres`, so it simply
 * produces no row; a movie tagged with several genres appears in each of their
 * rows.
 *
 * `continueWatching` is the same browse query narrowed to in-progress movies —
 * started but not finished, since `markWatched` zeroes the resume position — in
 * the same recently-added order and under the same cap. It is built
 * independently of the rows, so a movie part-way through appears in both, and
 * an untagged one appears here even though it earns no row.
 *
 * Aggregating here keeps the home a single call for the route to serve, instead
 * of leaving the client to fan out a request per section.
 */
export function createHome(browse: Browse): Home {
  function listRows(): HomeRow[] {
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

  function listContinueWatching(): Movie[] {
    return browse.listMovies({
      inProgressOnly: true,
      sort: 'recently-added',
      limit: HOME_ROW_LIMIT,
    });
  }

  function getHome(): HomePayload {
    return { continueWatching: listContinueWatching(), rows: listRows() };
  }

  return { getHome };
}
