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

/**
 * Which stream a codec belongs to. Subtitle decoders are deliberately not one
 * of these: **Format support** is about what the family can watch, and every
 * subtitle format the app understands is parsed by us rather than decoded.
 */
export type CodecKind = 'video' | 'audio';

/**
 * How a codec is decoded — **native** or **via component**, and never
 * "unsupported": a codec nothing on this machine decodes is not reported at
 * all, because the absence of a row is the honest way to say so.
 */
export type CodecSupport = 'native' | 'via-component';

/** One row of the **Codec report**, as the machine actually is. */
export interface CodecCapability {
  codec: string;
  kind: CodecKind;
  support: CodecSupport;
}

/**
 * Where the live **Playback component** came from: the one the installer left
 * on the machine, or the one the maintainer uploaded from Settings.
 *
 * The two are not two components in a list — only one is live at a time, and
 * an **Uploaded component** is live *instead of* the default rather than
 * beside it. What the word buys is the **Status pill**'s word and the answer
 * to whether there is anything to take back out: the default is the
 * installer's and not the maintainer's, so only an uploaded pair is
 * removable.
 */
export type ComponentSource = 'default' | 'uploaded';

/**
 * The **Component info**: what the **Component row** draws about the pair the
 * player actually converts with — where it came from, what the two files
 * weigh together, and what they are called.
 *
 * It is the **Component slot**'s answer rather than anything the codec report
 * could work out, which is why it travels as its own half of
 * {@link PlaybackCapabilities} rather than as a row among the codecs. The
 * bytes are the pair's summed, so the row can be read against Explorer.
 */
export interface PlaybackComponentInfo {
  source: ComponentSource;
  /** The two files' sizes added together, in bytes. */
  bytes: number;
  /** Their basenames, in the order the row chips them: ffmpeg, then ffprobe. */
  files: string[];
}

/**
 * What this machine can decode, and which **Playback component** is part of
 * the answer — the contract of `GET /api/playback/capabilities`, read by both
 * build targets: the server answers it and the Settings page draws it.
 *
 * `component` is reported separately from the rows because the two are not
 * the same claim: a component that is installed and will not say what it
 * decodes adds no rows and is still installed, and a family told otherwise
 * would go looking for an installer they already ran. `null` is a machine
 * with no component at all — the fresh install before its installer has run.
 */
export interface PlaybackCapabilities {
  component: PlaybackComponentInfo | null;
  codecs: CodecCapability[];
}
