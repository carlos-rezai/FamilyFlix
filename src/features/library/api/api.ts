import type { HomePayload, HomeQuery } from '@/types';

/** The one aggregate the browse home loads — every section in one payload. */
const HOME_ENDPOINT = '/api/home';

/** Where one movie's favorite flag is saved. */
const favoriteEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/favorite`;

/**
 * The home endpoint narrowed by a query. Every parameter is omitted at its
 * default, so an unfiltered home asks a clean `/api/home` — the request the
 * parent is looking at, rather than a longhand of it. `q` is the wire name the
 * app URL and the route already share.
 */
function homeUrl(query: HomeQuery): string {
  const params = new URLSearchParams();

  if (query.search !== undefined && query.search !== '') {
    params.set('q', query.search);
  }

  const search = params.toString();
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
export async function fetchHomePayload(query: HomeQuery): Promise<HomePayload> {
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
