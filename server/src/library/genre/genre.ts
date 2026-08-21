import {
  DEFAULT_MOVIE_SORT,
  type GenrePayload,
  type GenreQuery,
} from '@/types';
import type { Browse } from '../browse/browse';

/** The genre-page aggregate: one genre in full, in one call. */
export interface GenreAggregate {
  getGenre(name: string, query?: Partial<GenreQuery>): GenrePayload;
}

/**
 * Build the genre aggregate over the {@link Browse} slice — like
 * `createHome(browse)` beside it, a composition of the two browse queries the
 * repository already has, so no new SQL and no new repository primitive appear
 * here.
 *
 * `movies` is `listMovies` narrowed to the genre and carrying **no `limit`**:
 * this screen *is* the "View all" a genre row's fifteen cards link to, so a cap
 * here would leave the rest of a genre unreachable by any route in the app.
 * Everything a caller asks for — the search term, the order — is passed
 * straight through, so the search arm, the sorts and the assembly are the ones
 * the whole library already browses by rather than a second set that could
 * disagree with them.
 *
 * `total` is the genre's count from `listGenres()`, deliberately not
 * `movies.length`: it is the number "View all 214" already promised on the row,
 * and it has to stay that number while a search narrows the grid beneath it, so
 * the count line can read "12 of 214 titles". It is also what tells an empty
 * genre apart from a search that found nothing in a full one.
 *
 * The name is matched exactly as the library spells it, the way `?genre=`
 * already is, and echoed back verbatim — a genre the library does not hold is
 * an ordinary `{ total: 0, movies: [] }` rather than an error, because a stale
 * bookmark for an emptied genre is a normal "nothing here" and the screen still
 * has a heading to fill.
 *
 * The query is partial because a caller may name only the part it cares about;
 * an omitted sort — or an omitted query altogether — is the genre in the
 * library's default order.
 */
export function createGenre(browse: Browse): GenreAggregate {
  function getGenre(
    name: string,
    query: Partial<GenreQuery> = {}
  ): GenrePayload {
    const genre = browse.listGenres().find((entry) => entry.name === name);

    return {
      genre: name,
      total: genre?.count ?? 0,
      movies: browse.listMovies({
        ...query,
        sort: query.sort ?? DEFAULT_MOVIE_SORT,
        genre: name,
      }),
    };
  }

  return { getGenre };
}
