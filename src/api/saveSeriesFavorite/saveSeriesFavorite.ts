import { postValue } from '../postValue/postValue';

/** Where one series' favorite flag is saved. */
const seriesFavoriteEndpoint = (id: string) =>
  `/api/series/${encodeURIComponent(id)}/favorite`;

/** What the favorite route accepts as an echo of what it stored. */
function isFavoriteEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Saves one series' favorite flag and answers with the value that was stored —
 * `saveFavorite`'s shape over the series route. Rejects if the save did not
 * succeed, which is the caller's cue to revert.
 *
 * It lives in `api/` because two features call it: the Series tab's Poster
 * card and the series page.
 */
export function saveSeriesFavorite(
  id: string,
  favorite: boolean
): Promise<boolean> {
  return postValue(seriesFavoriteEndpoint(id), favorite, isFavoriteEcho);
}
