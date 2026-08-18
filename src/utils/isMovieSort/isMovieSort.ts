import type { MovieSort } from '@/types';

/**
 * Every sort order the API accepts, in the declaration order of
 * {@link MovieSort}. The dropdown draws its own list in the prototype's order,
 * which is deliberately not this one — this is the wire's vocabulary, not a
 * running order.
 */
export const MOVIE_SORTS: readonly MovieSort[] = [
  'recently-added',
  'a-z',
  'year',
  'highest-rated',
  'unwatched-first',
];

/**
 * Whether a string is one of those orders.
 *
 * A util rather than a feature-local helper because the sort arrives from the
 * URL, and two features read it from there independently: the search feature
 * parses the settled query, and the library feature builds the home request. A
 * URL is hand-editable and a bookmark outlives the build that wrote it, so
 * neither may treat what it finds as a `MovieSort` without asking here first.
 */
export function isMovieSort(value: string): value is MovieSort {
  return (MOVIE_SORTS as readonly string[]).includes(value);
}
