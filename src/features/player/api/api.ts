import { postValue, type PostOptions } from '@/api/postValue/postValue';
import type { PlaybackRead } from '@/types';

/** Where one movie's playback read is fetched from. */
const playbackEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/playback`;

/** Where one movie's **Resume position** is saved. */
const resumeEndpoint = (id: string) =>
  `/api/movies/${encodeURIComponent(id)}/resume`;

/**
 * What the resume route accepts as an echo of what it stored — a number, and
 * not the one that was sent: the route stores whole seconds and the player
 * reports the **Absolute position** with the fraction the element gave it.
 */
function isResumeEcho(echoed: unknown): echoed is number {
  return typeof echoed === 'number';
}

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

/**
 * Saves where the film had got to — one **Watch tick** on the wire — and
 * answers with the second the route says it stored. The same contract
 * `saveFavorite` and `saveWatched` keep, with one addition nothing else needs:
 * the caller may ask for `keepalive`, so the write the player makes on its way
 * out survives the screen being torn down around it.
 *
 * It stays here rather than moving up beside `saveWatched`: the player is the
 * only thing in the app that can know where a film is, which is CLAUDE.md's
 * `api/` rule read the other way round.
 *
 * Rejects if the save did not succeed. Nothing above it acts on that — a
 * backend hiccup must never interrupt the film — but a save that quietly
 * resolved would make a broken write indistinguishable from a stored one.
 */
export function saveResume(
  id: string,
  seconds: number,
  options?: PostOptions
): Promise<number> {
  return postValue(resumeEndpoint(id), seconds, isResumeEcho, options);
}
