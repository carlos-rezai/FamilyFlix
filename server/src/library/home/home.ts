import type { HomePayload, HomeQuery, HomeRow, Movie } from '@/types';
import type { Browse } from '../browse/browse';

/**
 * How many movies a single home section carries — a genre row or the continue
 * section alike. A genre row's `count` still reports the genre's true total, so
 * "View all {count}" stays honest when the genre holds more than the carousel
 * shows.
 */
export const HOME_ROW_LIMIT = 15;

/**
 * The query an argument-less `getHome()` stands for — the unfiltered browse
 * home, in the recently-added order it has rendered in since 02.
 */
const DEFAULT_HOME_QUERY: HomeQuery = { sort: 'recently-added' };

/** The home-screen aggregate: the whole browse payload in one call. */
export interface Home {
  getHome(query?: HomeQuery): HomePayload;
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
 * A `genre` on the query is the one filter that does not merely narrow the
 * rows — it decides which rows exist at all. Choosing a genre is a narrowing of
 * the whole screen rather than a highlight within it, so exactly that genre's
 * row is built and every other one is left out. A genre the library does not
 * hold builds no row rather than an empty one.
 *
 * `continueWatching` is the same browse query narrowed to in-progress movies —
 * started but not finished, since `markWatched` zeroes the resume position — in
 * the same recently-added order and under the same cap. It is built
 * independently of the rows, so a movie part-way through appears in both, and
 * an untagged one appears here even though it earns no row.
 *
 * Both sections are built from the one {@link HomeQuery}, so the top of the
 * screen can never disagree with the rest of it: each section adds only what
 * makes it that section (a `genre` for a row, `inProgressOnly` for continue,
 * and the shared cap) on top of the caller's filters and sort. A row whose
 * movies all failed the query is dropped rather than rendered blank — a
 * screenful of empty rows is not an answer. Its `count` still comes from
 * `listGenres()`, so "View all {count}" keeps reporting the genre's unfiltered
 * total however far the query narrows the row.
 *
 * Aggregating here keeps the home a single call for the route to serve, instead
 * of leaving the client to fan out a request per section.
 */
export function createHome(browse: Browse): Home {
  function listRows(query: HomeQuery): HomeRow[] {
    const genres =
      query.genre === undefined
        ? browse.listGenres()
        : browse.listGenres().filter((genre) => genre.name === query.genre);

    return genres
      .map((genre) => ({
        genre: genre.name,
        count: genre.count,
        movies: browse.listMovies({
          ...query,
          genre: genre.name,
          limit: HOME_ROW_LIMIT,
        }),
      }))
      .filter((row) => row.movies.length > 0);
  }

  function listContinueWatching(query: HomeQuery): Movie[] {
    return browse.listMovies({
      ...query,
      inProgressOnly: true,
      limit: HOME_ROW_LIMIT,
    });
  }

  function getHome(query: HomeQuery = DEFAULT_HOME_QUERY): HomePayload {
    return {
      continueWatching: listContinueWatching(query),
      rows: listRows(query),
    };
  }

  return { getHome };
}
