import {
  DEFAULT_MOVIE_SORT,
  type HomePayload,
  type LibraryQuery,
  type HomeRow,
  type ListSort,
  type Movie,
} from '@/types';
import type { Browse } from '../browse/browse';

/**
 * How many movies a single home section carries — a genre row, the continue
 * section and the favorites shelf alike. A genre row's `count` still reports
 * the genre's true total, so "View all {count}" stays honest when the genre
 * holds more than the carousel shows.
 */
export const HOME_ROW_LIMIT = 15;

/**
 * The query an argument-less `getHome()` stands for — the unfiltered browse
 * home, in the recently-added order it has rendered in since 02.
 */
const DEFAULT_LIBRARY_QUERY: LibraryQuery = { sort: DEFAULT_MOVIE_SORT };

/**
 * What makes a flat home section that section rather than the other — the one
 * `MovieQuery` flag it adds to the caller's query. A third flat section arrives
 * as a third flag here.
 */
type SectionFlag = 'inProgressOnly' | 'favoritesOnly';

/**
 * The order the resume queue is always built in, whatever the header's Sort
 * says. Named here rather than written inline at the call, because it is the
 * one thing about the continue section that is not the caller's to set.
 */
const CONTINUE_SORT: ListSort = 'last-watched';

/** The home-screen aggregate: the whole browse payload in one call. */
export interface Home {
  getHome(query?: LibraryQuery): HomePayload;
}

/**
 * Build the home aggregate over the {@link Browse} slice — every section is a
 * composition of the two existing browse queries, so no new SQL and no new
 * repository primitive appear here.
 *
 * `rows` is one row per populated genre (busiest genre first, since
 * `listGenres` already orders by count), each capped at {@link HOME_ROW_LIMIT}
 * movies in the caller's own sort. Taking that order as given is what keeps the
 * rows and the Genre dropdown above them reading one list: a query narrows what
 * a row holds and can drop a row entirely, but never re-ranks the rows by how
 * much of each matched. A genre with no movies never reaches `listGenres`, so it
 * simply produces no row; a movie tagged with several genres appears in each of
 * their rows.
 *
 * A `genre` on the query is the one filter that does not merely narrow the
 * rows — it decides which rows exist at all. Choosing a genre is a narrowing of
 * the whole screen rather than a highlight within it, so exactly that genre's
 * row is built and every other one is left out. A genre the library does not
 * hold builds no row rather than an empty one.
 *
 * `continueWatching` is the same browse query narrowed to in-progress movies —
 * started but not finished, since `markWatched` zeroes the resume position —
 * under the same cap, but in its own {@link CONTINUE_SORT} order rather than
 * the caller's. It is built independently of the rows, so a movie part-way
 * through appears in both, and an untagged one appears here even though it
 * earns no row.
 *
 * `favorites` is that same shape again with a different flag: the caller's
 * query narrowed to `favoritesOnly`, in the caller's own sort, same cap. It too
 * is built independently, so a favorite still appears in each of its genre rows
 * and in the continue section if it is part-way through, and a favorite with no
 * genre tags is on the shelf even though it earns no row.
 *
 * Every section is **filtered** by the one {@link LibraryQuery}, so the top of
 * the screen can never disagree with the rest of it: each section adds only
 * what makes it that section (a `genre` for a row, `inProgressOnly` for
 * continue, `favoritesOnly` for the shelf, and the shared cap) on top of the
 * caller's filters. A filter answers *which* movies are on a shelf, and that
 * answer is the whole screen's to give.
 *
 * The **sort** is not quite so uniform, and deliberately so: the continue
 * section pins {@link CONTINUE_SORT} while every other section takes the
 * caller's. A resume queue's order is part of what that shelf *means* — it is
 * the queue — so it is not the header's to reorder. Nothing about a shelf of
 * favorites, or a row of a genre, implies an intrinsic order, so those keep
 * obeying Sort. A row whose movies all failed the query is dropped rather
 * than rendered blank — a screenful of empty rows is not an answer. Its `count`
 * still comes from `listGenres()`, so "View all {count}" keeps reporting the
 * genre's unfiltered total however far the query narrows the row.
 *
 * Aggregating here keeps the home a single call for the route to serve, instead
 * of leaving the client to fan out a request per section.
 */
export function createHome(browse: Browse): Home {
  function listRows(query: LibraryQuery): HomeRow[] {
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

  /**
   * One flat section: the caller's query, narrowed by the single flag that
   * makes it the section it is, in the order that section is built in, under
   * the shared cap. Both of them are that composition and nothing else, so it
   * is written once.
   *
   * The sort sits beside the flag because the two are the same kind of thing —
   * what makes this section that section — and the caller's own sort is only
   * one of the answers. The `sort` therefore overrides the one `query` carries
   * rather than merging with it.
   *
   * `listRows` is genuinely a different shape and stays its own function: it
   * fans out over genres and drops the ones that matched nothing.
   */
  function listSection(
    query: LibraryQuery,
    only: SectionFlag,
    sort: ListSort
  ): Movie[] {
    return browse.listMovies({
      ...query,
      [only]: true,
      sort,
      limit: HOME_ROW_LIMIT,
    });
  }

  function getHome(query: LibraryQuery = DEFAULT_LIBRARY_QUERY): HomePayload {
    return {
      // The two calls differ in their third argument, and that asymmetry is
      // the feature rather than an oversight. A resume queue's order is part of
      // what that shelf *means* — it is the queue — so it is not the header's
      // to reorder, and the continue section pins its own. Nothing about a
      // shelf of favorites implies an intrinsic order, so that one goes on
      // obeying Sort. Both take their *filters* from the same query either way;
      // see this module's contract above.
      continueWatching: listSection(query, 'inProgressOnly', CONTINUE_SORT),
      favorites: listSection(query, 'favoritesOnly', query.sort),
      rows: listRows(query),
    };
  }

  return { getHome };
}
