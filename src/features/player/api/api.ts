import type { PlaybackRead } from '@/types';

/** Where one movie's playback read is fetched from. */
const playbackEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/playback`;

/**
 * The **Playback read** for one film: which **Playback path** its bytes take,
 * and how long it runs. Fetched once when the player opens, and the one place
 * the scrubber's duration comes from — never the record's rounded
 * `runtimeMinutes`, and never the element's `duration`, which is a lie on a
 * live transcode.
 *
 * Resolves `null` when the route answers 404. A film with no file behind it has
 * no duration to report, and the screen draws that rather than reporting a
 * failure; resolving keeps it apart from "the request went wrong" exactly as
 * `fetchMovie`'s `null` keeps `not-found` apart from `error`. A 500 is not a
 * film with no file, so it rejects — collapsing the two would tell the family
 * their film is missing every time the server hiccups.
 *
 * It stays with the player rather than moving up to `src/api/`: this is the one
 * feature that asks, which is the same rule read the other way round.
 */
export async function fetchPlayback(id: string): Promise<PlaybackRead | null> {
  const endpoint = playbackEndpoint(id);
  const response = await fetch(endpoint);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    throw new Error(`GET ${endpoint} failed: ${response.status}`);
  }

  return (await response.json()) as PlaybackRead;
}
