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
 * - `cannot-play` — nothing installed can make these bytes playable.
 *
 * The fourth is the one that is not a route at all: the file is there and the
 * screen has to say so in different words from the ones it uses for a film it
 * cannot find, because the two have different remedies. It travels on the same
 * field as the other three so that a player asking "which path is this" gets
 * one answer rather than an answer and an exception to it.
 */
export type PlaybackPath = 'direct' | 'remux' | 'transcode' | 'cannot-play';

/** The playback read's payload: which path, and how long the film runs. */
export interface PlaybackRead {
  path: PlaybackPath;
  /** The film's length in seconds, read from the file rather than the record. */
  durationSeconds: number;
}

/**
 * One timed subtitle line — the single normalized shape every subtitle format
 * is parsed into, in **Absolute position** seconds.
 *
 * `start` and `end` are seconds into the *film*, never into the stream, which
 * is what lets a scrub be a pure lookup: the **Subtitle overlay** asks which
 * cue covers the position it is at, and nothing has to be re-stamped when that
 * position jumps.
 */
export interface Cue {
  start: number;
  end: number;
  text: string;
}
