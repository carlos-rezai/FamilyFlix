import type { SeriesDetail } from '@/types';

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
