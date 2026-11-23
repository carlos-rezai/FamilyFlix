import { DEFAULT_MOVIE_SORT, type LibraryQuery } from '@/types';

/**
 * Writes a settled {@link LibraryQuery} back out as query parameters — the
 * exact inverse of `parseLibraryQuery`, and a util for the same reason: the app
 * URL and `GET /api/home` share one vocabulary (`q`, `sort`, `genre`,
 * `rating`), and the rules for what appears in it must be written once. A
 * parser and its inverse are one unit of correctness even in two folders, which
 * is what the round-trip test beside this one says.
 *
 * Every parameter is omitted at its default, so an unfiltered library is a
 * clean URL with no query string to explain — the request the parent is looking
 * at, rather than a longhand of it. `URLSearchParams` encodes the values on the
 * way out, which a genre with a space in it needs.
 *
 * Pure, so the same query always yields the same parameters.
 */
export function toLibraryQueryParams(query: LibraryQuery): URLSearchParams {
  const params = new URLSearchParams();

  // An empty search is no search at all, not a search for the empty string —
  // the same rule the parser reads `?q=` by.
  if (query.search !== undefined && query.search !== '') {
    params.set('q', query.search);
  }

  // The default order is what happens when nothing is asked; saying so would
  // add a parameter that changes no answer.
  if (query.sort !== DEFAULT_MOVIE_SORT) {
    params.set('sort', query.sort);
  }

  // "All Genres" is the absence of the filter, so it writes no parameter.
  if (query.genre !== undefined && query.genre !== '') {
    params.set('genre', query.genre);
  }

  // "All ratings" is the absence of the filter, and so is a minimum of nought
  // — a literal floor of zero would exclude every unrated movie. `rating` is
  // the wire name; `minRating` is what the repository calls it.
  if (query.minRating !== undefined && query.minRating !== 0) {
    params.set('rating', String(query.minRating));
  }

  return params;
}
