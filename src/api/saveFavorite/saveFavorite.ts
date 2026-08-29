import { postValue } from '../postValue/postValue';

/** Where one movie's favorite flag is saved. */
const favoriteEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/favorite`;

/** What the favorite route accepts as an echo of what it stored. */
function isFavoriteEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Saves one movie's favorite flag and answers with the value that was stored —
 * the wire contract in `postValue`, with a flag as its echo. Rejects if the
 * save did not succeed, which is the caller's cue to revert.
 *
 * It lives beside `postValue` rather than with the browse feature because two
 * features call it: the shelf and every genre row hand it their heart, and so
 * does the movie detail page. It is the one save with callers on both sides of
 * a feature boundary, which is the rule this rung was built for.
 */
export function saveFavorite(id: string, favorite: boolean): Promise<boolean> {
  return postValue(favoriteEndpoint(id), favorite, isFavoriteEcho);
}
