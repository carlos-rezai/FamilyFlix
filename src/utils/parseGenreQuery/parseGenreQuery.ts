import { DEFAULT_MOVIE_SORT, type GenreQuery } from '@/types';
import { isMovieSort } from '@/utils';

/**
 * Turns the URL's query string into the **settled query** one genre page is
 * looking at. Two parameters where `parseLibraryQuery` reads four, under the
 * same wire names the app URL and `GET /api/genre/:name` share, and with the
 * same rules for a stale, hand-edited or hostile URL: a parameter that is
 * absent falls back to its default, an empty value means the same as absent,
 * and anything this screen doesn't read is ignored rather than rejected — an
 * old bookmark still opens.
 *
 * Pure, so the same URL always yields the same query.
 *
 * Deliberately **not** `parseLibraryQuery` with the extra parts made optional.
 * A single parametrised parser would happily read a `genre` and a `rating` here
 * — the genre contradicting the path the page is routed by, the rating
 * narrowing a grid that has no control to show a cut-off with. That does not
 * surface as a crash; it surfaces as a screen quietly disagreeing with itself.
 * Ignoring both is the contract, not an omission, so both are tested for.
 *
 * `isMovieSort` is shared with its library-query sibling for the reason that
 * guard exists: two parsers that each decide what a sort is are two sets of
 * rules that can come to disagree.
 */
export function parseGenreQuery(params: URLSearchParams): GenreQuery {
  const query: GenreQuery = { sort: DEFAULT_MOVIE_SORT };

  // A cleared box leaves `?q=` behind on some paths; it is not a search for
  // the empty string, it is no search within the genre at all.
  const search = params.get('q');
  if (search !== null && search !== '') {
    query.search = search;
  }

  // An order the app doesn't know is not a bad request here, only a URL worth
  // ignoring: the genre opens in the order it has always opened in rather than
  // asking the route for something it would refuse.
  const sort = params.get('sort');
  if (sort !== null && isMovieSort(sort)) {
    query.sort = sort;
  }

  // `genre` and `rating` are read by neither branch above, on purpose. The
  // genre is the route; a rating has nothing on this screen to show it with.
  return query;
}
