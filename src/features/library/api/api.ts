import {
  DEFAULT_MOVIE_SORT,
  type HomePayload,
  type LibraryQuery,
} from '@/types';

/** The one aggregate the browse home loads — every section in one payload. */
const HOME_ENDPOINT = '/api/home';

/** Where one movie's favorite flag is saved. */
const favoriteEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/favorite`;

/**
 * The home endpoint narrowed by a query. Every parameter is omitted at its
 * default, so an unfiltered home asks a clean `/api/home` — the request the
 * parent is looking at, rather than a longhand of it. `q` and `sort` are the
 * wire names the app URL and the route already share.
 */
function homeUrl(query: LibraryQuery): string {
  const params = new URLSearchParams();

  if (query.search !== undefined && query.search !== '') {
    params.set('q', query.search);
  }

  // Recently-added is what the route does when asked nothing; saying so would
  // add a parameter that changes no answer.
  if (query.sort !== DEFAULT_MOVIE_SORT) {
    params.set('sort', query.sort);
  }

  // "All Genres" is the absence of the filter, so it writes no parameter.
  // `URLSearchParams` encodes the name on the way out, which a genre with a
  // space in it needs.
  if (query.genre !== undefined && query.genre !== '') {
    params.set('genre', query.genre);
  }

  // "All ratings" is the absence of the filter, and so is a minimum of nought
  // — a literal floor of zero would exclude every unrated movie. `rating` is
  // the wire name; `minRating` is what the repository calls it.
  if (query.minRating !== undefined && query.minRating !== 0) {
    params.set('rating', String(query.minRating));
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
