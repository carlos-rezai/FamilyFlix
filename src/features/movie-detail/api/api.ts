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

/**
 * The movie both writes below hang off. The read that used to live here moved
 * to `src/api/fetchMovie/` when the player became its second caller; the two
 * saves have one caller each and stay.
 */
const movieEndpoint = (id: string) => `/api/movies/${encodeURIComponent(id)}`;

/** Where one movie's watched flag is saved. */
const watchedEndpoint = (id: string) => `${movieEndpoint(id)}/watched`;

/** Where one movie's rating is saved. */
const ratingEndpoint = (id: string) => `${movieEndpoint(id)}/rating`;

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
