import { DEFAULT_MOVIE_SORT, type HomeQuery } from '@/types';
import { isMovieSort, parseMinRating } from '@/utils';

/**
 * Turns the URL's query string into the **settled query** the browse home is
 * looking at. `?q=` is the wire name the app URL and `GET /api/home` share, and
 * this is the one place a stale, hand-edited or hostile URL is made safe: a
 * parameter that is absent falls back to its default, an empty value means the
 * same as absent, and anything this slice doesn't read is left alone rather
 * than rejected — a bookmark from an older build still opens.
 *
 * Pure, so the same URL always yields the same query.
 */
export function parseLibraryQuery(params: URLSearchParams): HomeQuery {
  const query: HomeQuery = { sort: DEFAULT_MOVIE_SORT };

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

  // Kept exactly as spelled, and matched by the server rather than here: a
  // genre the library does not hold is a URL worth passing on, because the
  // honest answer to it is simply no rows. An empty `?genre=` is "All Genres",
  // which is the absence of the filter.
  const genre = params.get('genre');
  if (genre !== null && genre !== '') {
    query.genre = genre;
  }

  // Only a cut-off the dropdown can produce reads as a minimum, so a
  // hand-edited `?rating=7` can never narrow the library behind a pill still
  // saying "All ratings" — the URL and the screen must agree. `rating` is the
  // wire name the app URL and the route share; `minRating` is the domain's.
  const minRating = parseMinRating(params.get('rating'));
  if (minRating !== undefined) {
    query.minRating = minRating;
  }

  return query;
}
