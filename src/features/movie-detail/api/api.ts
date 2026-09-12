import { postValue } from '@/api/postValue/postValue';

/**
 * What the rating route accepts. `null` is in, because `null` is a rating this
 * route can genuinely store — a cleared one — so an echoed `null` is an answer
 * rather than the absence of one, and only a missing key falls back.
 */
function isRatingEcho(echoed: unknown): echoed is number | null {
  return typeof echoed === 'number' || echoed === null;
}

/**
 * Where one movie's rating is saved — one of the two calls this feature owns.
 * The read that used to live here moved to `src/api/fetchMovie/` when the
 * player became its second caller, and `saveWatched` followed it up to
 * `src/api/saveWatched/` when the player became *its* second caller. This one
 * has a single caller and stays, until that changes.
 */
const ratingEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/rating`;

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

/** Where one movie is deleted — the movie's own route, with nothing after it. */
const movieEndpoint = (id: string) => `/api/movies/${encodeURIComponent(id)}`;

/**
 * Deletes one movie from the library. Beside `saveRating` because it has one
 * caller — the Delete dialog — and CLAUDE.md's `api/` rule keeps a single-caller
 * call with its feature.
 *
 * What it promises is **gone is gone**: a `204` and a `404` both mean the movie
 * is not in the library, which is the whole goal of a Delete, so both resolve.
 * Rejecting on the `404` would leave a stale page whose only working button
 * re-asks a question already answered. Anything else is a failure the dialog
 * has to show.
 *
 * Nothing reads the body: a `204` has none, and a real `Response` would throw
 * on the empty one.
 */
export async function deleteMovie(id: string): Promise<void> {
  const endpoint = movieEndpoint(id);
  const response = await fetch(endpoint, { method: 'DELETE' });

  if (!response.ok && response.status !== 404) {
    throw new Error(`DELETE ${endpoint} failed: ${response.status}`);
  }
}
