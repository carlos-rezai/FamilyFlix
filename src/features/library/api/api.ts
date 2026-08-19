import type { HomePayload, LibraryQuery } from '@/types';
import { toLibraryQueryParams } from '@/utils';

/** The one aggregate the browse home loads — every section in one payload. */
const HOME_ENDPOINT = '/api/home';

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

/**
 * Saves one movie's favorite flag and answers with the value that was stored.
 * The route echoes what it wrote, and that echo is the truth — `favorite` is
 * only the fallback for a route that answers without one. Rejects if the save
 * did not succeed, which is the caller's cue to revert.
 */
export async function saveFavorite(
  id: string,
  favorite: boolean
): Promise<boolean> {
  const response = await fetch(favoriteEndpoint(id), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: favorite }),
  });

  if (!response.ok) {
    throw new Error(`Saving favorite failed: ${response.status}`);
  }

  const saved = (await response.json()) as { value?: unknown };
  return typeof saved.value === 'boolean' ? saved.value : favorite;
}
