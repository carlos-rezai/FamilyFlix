/**
 * What the player is told about a film before a byte of it arrives — the
 * contract of the **Playback read**, `GET /api/movies/:id/playback`.
 *
 * It is fetched once when the screen opens, and it is the one place the
 * scrubber's duration and the chosen **Playback path** come from: never the
 * movie record's rounded (and nullable) `runtimeMinutes`, and never the
 * element's own `duration`, which is `NaN` on a live transcode.
 */

/**
 * How a film's bytes reach the element.
 *
 * - `direct` — the file goes out untouched, and the element seeks by Range.
 * - `remux` — only the container was wrong, so it is rewrapped on the way out.
 * - `transcode` — a codec the browser cannot decode, re-encoded live.
 *
 * Only `direct` is chosen today. The vocabulary is whole from the start because
 * it is what tells the player whether the stream is anchored at nought or at
 * the second it was requested from.
 */
export type PlaybackPath = 'direct' | 'remux' | 'transcode';

/** The playback read's payload: which path, and how long the film runs. */
export interface PlaybackRead {
  path: PlaybackPath;
  /** The film's length in seconds, read from the file rather than the record. */
  durationSeconds: number;
}
