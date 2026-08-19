import { MOVIE_SORTS, type MovieSort } from '@/types';

/**
 * Whether a string is one of the orders in {@link MOVIE_SORTS}.
 *
 * A util rather than a feature-local helper because the sort arrives from the
 * URL, and two features read it from there independently: the search feature
 * parses the settled query, and the library feature builds the home request. A
 * URL is hand-editable and a bookmark outlives the build that wrote it, so
 * neither may treat what it finds as a `MovieSort` without asking here first.
 *
 * The list it checks against is the shared one, so this guard cannot come to
 * recognise a different set of orders than the type names.
 */
export function isMovieSort(value: string): value is MovieSort {
  return (MOVIE_SORTS as readonly string[]).includes(value);
}
