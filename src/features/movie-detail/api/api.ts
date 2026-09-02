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
 * Where one movie's rating is saved — the last call this feature still owns.
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
