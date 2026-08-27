import type {
  GenrePayload,
  GenreQuery,
  HomePayload,
  LibraryQuery,
} from '@/types';
import { toGenreQueryParams, toLibraryQueryParams } from '@/utils';
import { postValue } from '@/api/postValue/postValue';

/** The one aggregate the browse home loads — every section in one payload. */
const HOME_ENDPOINT = '/api/home';

/**
 * Where one genre is loaded from. The name travels in the path because it is
 * which screen this is, not a filter within it — the same way the app URL
 * spells it — and it is user data on its way into a URL, so it is encoded.
 */
const genreEndpoint = (name: string) =>
  `/api/genre/${encodeURIComponent(name)}`;

/** Where one movie's favorite flag is saved. */
const favoriteEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/favorite`;

/**
 * The home endpoint narrowed by a query. The parameters are the settled
 * query's own — written by the same util the app URL is written by, so the
 * request can only ever ask for what the header is showing. An unfiltered home
 * asks a clean `/api/home`, because every part is omitted at its default.
 */
function homeUrl(query: LibraryQuery): string {
  const search = toLibraryQueryParams(query).toString();
  return search === '' ? HOME_ENDPOINT : `${HOME_ENDPOINT}?${search}`;
}

/**
 * Loads the home payload for one query: the in-progress movies as
 * `continueWatching`, plus a `rows` entry per populated genre, each capped at
 * 15 movies with the genre's true total alongside. Both sections are narrowed
 * by the same query, so the top of the screen can never disagree with the rest
 * of it. One request, never one per section. Rejects if the route answers with
 * anything but a 2xx.
 */
export async function fetchHomePayload(
  query: LibraryQuery
): Promise<HomePayload> {
  const response = await fetch(homeUrl(query));
  if (!response.ok) {
    throw new Error(`GET ${HOME_ENDPOINT} failed: ${response.status}`);
  }
  return (await response.json()) as HomePayload;
}

/** What the favorite route accepts as an echo of what it stored. */
function isFavoriteEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Saves one movie's favorite flag and answers with the value that was stored —
 * the wire contract in `postValue`, with a flag as its echo. Rejects if the
 * save did not succeed, which is the caller's cue to revert.
 */
export function saveFavorite(id: string, favorite: boolean): Promise<boolean> {
  return postValue(favoriteEndpoint(id), favorite, isFavoriteEcho);
}

/**
 * The genre endpoint narrowed by a query. The parameters are the settled
 * query's own — written by the same util the app URL is written by, so the
 * request can only ever ask for what the genre header is showing. It carries no
 * `genre`, which is in the path, and no `rating`, which this screen has no
 * control for; a plain genre asks a clean `/api/genre/Action`, because both
 * parts are omitted at their defaults.
 */
function genreUrl(name: string, query: GenreQuery): string {
  const search = toGenreQueryParams(query).toString();
  const endpoint = genreEndpoint(name);
  return search === '' ? endpoint : `${endpoint}?${search}`;
}

/**
 * Loads one genre in full: the name as it was asked for, the genre's
 * **unfiltered** total, and the **uncapped** list of movies matching the query.
 * The whole screen in one answer, so the heading can never disagree with the
 * grid underneath it — and uncapped because this is what "View all" opens, so a
 * cap here would leave movies unreachable by any route in the app. Rejects if
 * the route answers with anything but a 2xx.
 */
export async function fetchGenrePayload(
  name: string,
  query: GenreQuery
): Promise<GenrePayload> {
  const url = genreUrl(name, query);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GET ${genreEndpoint(name)} failed: ${response.status}`);
  }
  return (await response.json()) as GenrePayload;
}
