import { postValue } from '@/api/postValue/postValue';

/** Where one series is loaded from, by the id in the URL. */
const seriesEndpoint = (id: string) => `/api/series/${encodeURIComponent(id)}`;

/** Where one season's watched mark is saved. */
const seasonWatchedEndpoint = (id: string, season: number) =>
  `${seriesEndpoint(id)}/seasons/${season}/watched`;

/** What the season route accepts as an echo of what it stored. */
function isWatchedEcho(echoed: unknown): echoed is boolean {
  return typeof echoed === 'boolean';
}

/**
 * Marks every episode of one season watched or unwatched and answers with the
 * value stored — a **Single-signal write** on `saveWatched`'s shape. Rejects if
 * the save did not succeed, the season page's cue to put every box back. One
 * caller, so it stays with the feature.
 */
export function saveSeasonWatched(
  id: string,
  season: number,
  watched: boolean
): Promise<boolean> {
  return postValue(seasonWatchedEndpoint(id, season), watched, isWatchedEcho);
}

/**
 * Deletes one series from the library — `deleteMovie`'s promise over the
 * series' own route: **gone is gone**, so a `204` and a `404` both resolve, and
 * anything else rejects. One caller, the Delete dialog, so it stays here.
 * Nothing reads the body: a `204` has none.
 */
export async function deleteSeries(id: string): Promise<void> {
  const endpoint = seriesEndpoint(id);
  const response = await fetch(endpoint, { method: 'DELETE' });

  if (!response.ok && response.status !== 404) {
    throw new Error(`DELETE ${endpoint} failed: ${response.status}`);
  }
}
