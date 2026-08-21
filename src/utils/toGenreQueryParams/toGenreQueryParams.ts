import { DEFAULT_MOVIE_SORT, type GenreQuery } from '@/types';

/**
 * Writes a settled {@link GenreQuery} back out as query parameters — the exact
 * inverse of `parseGenreQuery`, and a util for the same reason: the app URL and
 * `GET /api/genre/:name` share one vocabulary (`q`, `sort`), and the rules for
 * what appears in it must be written once. A parser and its inverse are one
 * unit of correctness even in two folders, which is what the round-trip test
 * beside this one says.
 *
 * Both parameters are omitted at their defaults, so a plain genre page is a
 * clean `/genre/Drama` with no query string to explain — the screen the parent
 * is looking at, rather than a longhand of it. `URLSearchParams` encodes the
 * values on the way out, which a search term with a space or an accent needs.
 *
 * It writes no `genre` — that travels in the path — and no `rating`, because
 * this screen has no control to show a cut-off with.
 *
 * Pure, so the same query always yields the same parameters.
 */
export function toGenreQueryParams(query: GenreQuery): URLSearchParams {
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

  return params;
}
