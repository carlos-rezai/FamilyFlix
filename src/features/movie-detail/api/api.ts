import type { Movie } from '@/types';
import { postValue } from '@/api/postValue/postValue';

/** What the watched route accepts as an echo of what it stored. */
function isWatchedEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * What the rating route accepts. `null` is in, because `null` is a rating this
 * route can genuinely store — a cleared one — so an echoed `null` is an answer
 * rather than the absence of one, and only a missing key falls back.
 */
function isRatingEcho(echoed: unknown): echoed is number | null {
  return typeof echoed === 'number' || echoed === null;
}

/** Where one movie is loaded from, by the id in the page's URL. */
const movieEndpoint = (id: string) => `/api/movies/${encodeURIComponent(id)}`;

/** Where one movie's watched flag is saved. */
const watchedEndpoint = (id: string) => `${movieEndpoint(id)}/watched`;

/** Where one movie's rating is saved. */
const ratingEndpoint = (id: string) => `${movieEndpoint(id)}/rating`;

/**
 * Loads one movie by id — the whole record the detail page renders, synopsis,
 * credits, genres and subtitles included.
 *
 * Resolves `null` when the route answers 404: a movie that is gone is an
 * outcome the page has a screen for, not a failure, and keeping it separate
 * from a rejection is what makes `not-found` reachable. Every other
 * unsuccessful response, and a request that could not be made at all, rejects
 * — those earn a Retry rather than a way back to the library.
 */
export async function fetchMovie(id: string): Promise<Movie | null> {
  const endpoint = movieEndpoint(id);
  const response = await fetch(endpoint);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as Movie;
}

/**
 * Saves one movie's watched flag and answers with the value that was stored —
 * the wire contract in `postValue`, with a flag as its echo. Rejects if the
 * save did not succeed, which is the toggle's cue to revert rather than leave
 * the circle filled over nothing.
 */
export function saveWatched(id: string, watched: boolean): Promise<boolean> {
  return postValue(watchedEndpoint(id), watched, isWatchedEcho);
}

/**
 * Saves one movie's rating in stored units — 0–10, or `null` to clear it — and
 * answers with the value that was stored. The wire contract in `postValue`,
 * with `isRatingEcho` as the one thing this route does not share: a `null` here
 * is a cleared rating rather than a route answering with nothing, and confusing
 * the two would let a failed clear read as a successful one.
 *
 * Rejects if the save did not succeed, which is the picker's cue to put the old
 * stars back.
 */
export function saveRating(
  id: string,
  units: number | null
): Promise<number | null> {
  return postValue(ratingEndpoint(id), units, isRatingEcho);
}
