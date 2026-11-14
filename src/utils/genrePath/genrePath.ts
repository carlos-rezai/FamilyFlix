import { DEFAULT_MOVIE_SORT, type LibraryTab, type MovieSort } from '@/types';
import { toGenreQueryParams } from '../toGenreQueryParams/toGenreQueryParams';

/** What a Genre page route carries beside its path. */
export interface GenreRouteOptions {
  /** The **Carried sort**; the default when omitted, which writes nothing. */
  sort?: MovieSort;
  /** The **Library tab** the page serves. */
  tab: LibraryTab;
}

/**
 * The query string a Genre page route ends in, `?` and all, or nothing: the
 * sort through `toGenreQueryParams` (so the page reads it back by the same
 * rules), then `tab=series` when the page serves series. Movies is the page's
 * default, so it is never written.
 */
export function genreRouteSearch({
  sort = DEFAULT_MOVIE_SORT,
  tab,
}: GenreRouteOptions): string {
  const params = toGenreQueryParams({ sort });
  if (tab === 'series') {
    params.set('tab', 'series');
  }
  const search = params.toString();
  return search === '' ? '' : `?${search}`;
}

/**
 * A genre's **Genre page**, as a route, `seriesTabPath`'s precedent:
 * `/genre/Drama`, then the carried sort and the tab. At the default sort on
 * Movies it is a clean `/genre/Drama`. A genre name is user data on its way
 * into a URL, so it is encoded.
 *
 * Pure, so the same genre and options always yield the same route.
 */
export function genrePath(genre: string, options: GenreRouteOptions): string {
  return `/genre/${encodeURIComponent(genre)}${genreRouteSearch(options)}`;
}
