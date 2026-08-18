import type { HomeQuery, MovieSort } from '@/types';
import { isMovieSort } from '@/utils';

/** What the home rows are ordered by until a sort control writes another one. */
const DEFAULT_SORT: MovieSort = 'recently-added';

/**
 * Turns the URL's query string into the **settled query** the browse home is
 * looking at. `?q=` is the wire name the app URL and `GET /api/home` share, and
 * this is the one place a stale, hand-edited or hostile URL is made safe: a
 * parameter that is absent falls back to its default, an empty value means the
 * same as absent, and anything this slice doesn't read is left alone rather
 * than rejected — a bookmark from an older build still opens.
 *
 * Pure, so the same URL always yields the same query. The genre and rating
 * parameters join it as their controls ship.
 */
export function parseLibraryQuery(params: URLSearchParams): HomeQuery {
  const query: HomeQuery = { sort: DEFAULT_SORT };

  // A cleared box leaves `?q=` behind on some paths; it is not a search for
  // the empty string, it is no search at all.
  const search = params.get('q');
  if (search !== null && search !== '') {
    query.search = search;
  }

  // An order the app doesn't know is not a bad request here, only a URL worth
  // ignoring: the home opens in the order it has always opened in rather than
  // asking the route for something it would refuse.
  const sort = params.get('sort');
  if (sort !== null && isMovieSort(sort)) {
    query.sort = sort;
  }

  return query;
}
