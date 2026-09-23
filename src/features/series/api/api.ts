import type { SeriesDetail } from '@/types';
import { postValue } from '@/api/postValue/postValue';

/** Where one series is loaded from, by the id in the URL. */
const seriesEndpoint = (id: string) => `/api/series/${encodeURIComponent(id)}`;

/**
 * Loads one series in full — its seasons, their episodes and the **Next
 * episode** the server derived. Resolves `null` on a 404, `fetchMovie`'s rule:
 * a series that is gone is an outcome with a screen, not a failure; anything
 * else unsuccessful rejects, and earns a Retry.
 */
export async function fetchSeriesDetail(
  id: string
): Promise<SeriesDetail | null> {
  const endpoint = seriesEndpoint(id);
  const response = await fetch(endpoint);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as SeriesDetail;
}

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
