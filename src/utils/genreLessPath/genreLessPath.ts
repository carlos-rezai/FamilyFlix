import {
  genreRouteSearch,
  type GenreRouteOptions,
} from '../genrePath/genrePath';

/**
 * The **Other row**'s _View all_, as a route: the Genre page's `other` mode at
 * its own `/genre-less`, never `/genre/Other`, carrying the sort and the tab as
 * `genrePath` does.
 *
 * Pure, so the same options always yield the same route.
 */
export function genreLessPath(options: GenreRouteOptions): string {
  return `/genre-less${genreRouteSearch(options)}`;
}
