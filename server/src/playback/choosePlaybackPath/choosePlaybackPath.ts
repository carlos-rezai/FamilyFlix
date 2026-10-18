import type { MediaProbe } from '../probe/probe';

/**
 * What the machine can do, as far as the format policy is concerned — a value
 * rather than a binary, which is what keeps this function pure.
 *
 * `hardwareEncoder` is the encoder ffmpeg reported this machine has, or `null`
 * for a machine with none. Detecting it varies by machine and is not something
 * a test can pin, so it is somebody else's job and arrives here already
 * answered: the *selection* is the part worth asserting, and it is in the argv.
 */
export interface ComponentAvailability {
  available: boolean;
  hardwareEncoder: string | null;
}

/**
 * The **Playback path** a film takes, and what it takes to run it.
 *
 * Only the two converting paths carry an argv, and the other three carry none
 * at all rather than an empty one: `direct`, `cannot-play` and `no-track` run
 * nothing, and an empty array is a thing to accidentally spawn.
 */
export type PlaybackDecision =
  | { path: 'direct' }
  | { path: 'remux'; args: string[] }
  | { path: 'transcode'; args: string[] }
  | { path: 'cannot-play' }
  | { path: 'no-track' };

export interface PlaybackChoice {
  /** The film being decided about — absolute, and already containment-checked. */
  file: string;
  /** What **ffprobe** said the file is, or `null` when nothing could read it. */
  probe: MediaProbe | null;
  component: ComponentAvailability;
  /**
   * The **Stream offset** the conversion is to start at, in **Absolute
   * position** seconds — where the family let go of the knob.
   *
   * It reaches the format policy because this is the only place it can: a
   * stream path has no byte ranges to seek in, so where the film starts is an
   * argument to the conversion rather than something the element asks for
   * later. Nought — the fresh open, and every **Direct play** — asks for
   * nothing at all rather than for `-ss 0`.
   */
  offsetSeconds?: number;
  /**
   * The **Audio track index** to play — a place among the probe's audio
   * streams, 0 when none is named. The path is decided over that stream's
   * codec, and an index the probe does not hold is `no-track`.
   */
  audioTrack?: number;
}

/** Containers Chromium demuxes on its own. */
const NATIVE_CONTAINERS = ['mp4', 'webm'];

/**
 * Video codecs Chromium decodes on its own.
 *
 * Exported because `capabilities` reports the same set as **native**: this is
 * the list that decides **Direct play**, so a second copy of it over there
 * would be a codec screen giving a second opinion on what the player does.
 */
export const NATIVE_VIDEO_CODECS = ['h264', 'vp8', 'vp9', 'av1'];

/** Audio codecs Chromium decodes on its own — exported for the same reason. */
export const NATIVE_AUDIO_CODECS = ['aac', 'mp3', 'opus', 'vorbis', 'flac'];

/**
 * Extensions worth sending untouched when nothing read the file. The name is a
 * far weaker claim than a probe, and it is deliberately the only claim left:
 * this is the machine with no component on it, where an MP4 still has to play.
 */
const NATIVE_EXTENSIONS = ['.mp4', '.m4v', '.webm'];

/**
 * The one output format a live stream can be: an ordinary MP4 puts its index at
 * the end, so it cannot be written to a pipe — the element would be handed
 * bytes it can make no sense of until a file it will never see the end of has
 * ended.
 */
const FRAGMENTED_MP4 = 'frag_keyframe+empty_moov+default_base_moof';

/** The encoder a machine with no hardware one falls back to. */
const SOFTWARE_ENCODER = 'libx264';

/**
 * Everything before the output options: quiet, starting where it was asked to,
 * and reading one film.
 *
 * `-ss` goes **before** `-i`, which is what makes it an input seek: ffmpeg
 * opens the file at that second rather than decoding everything up to it and
 * throwing it away. On a two-hour film that is the difference between a scrub
 * that settles and one that spends minutes producing nothing.
 */
function inputArgs(file: string, offsetSeconds: number): string[] {
  const seek = offsetSeconds > 0 ? ['-ss', String(offsetSeconds)] : [];
  return ['-hide_banner', '-loglevel', 'error', ...seek, '-i', file];
}

/**
 * The one picture — `V` skips a cover picture — and the one voice; each `?`
 * lets a file without one still play. Mapping is also what keeps a subtitle
 * or data stream an MP4 cannot hold out of the output.
 */
function mapArgs(audioTrack: number): string[] {
  return ['-map', '0:V:0?', '-map', `0:a:${audioTrack}?`];
}

/** Everything after them: a fragmented MP4, down the pipe. */
function outputArgs(): string[] {
  return ['-movflags', FRAGMENTED_MP4, '-f', 'mp4', 'pipe:1'];
}

/** Rewrap the streams without touching them — I/O-bound, and nothing is lost. */
function remuxArgs(
  file: string,
  offsetSeconds: number,
  audioTrack: number
): string[] {
  return [
    ...inputArgs(file, offsetSeconds),
    ...mapArgs(audioTrack),
    '-c',
    'copy',
    ...outputArgs(),
  ];
}

/**
 * Re-encode to what Chromium reads. The audio is re-encoded whichever codec it
 * arrived as: a **Transcode** answers one shape, and a path that sometimes
 * copied the audio would be two paths wearing one name.
 *
 * The pixels are 8-bit 4:2:0 whatever the source was: from a 10-bit film
 * libx264 would keep the depth and write High 10, which Chromium cannot decode
 * (issue #388).
 */
function transcodeArgs(
  file: string,
  hardwareEncoder: string | null,
  offsetSeconds: number,
  audioTrack: number
): string[] {
  const video =
    hardwareEncoder === null
      ? ['-c:v', SOFTWARE_ENCODER, '-preset', 'veryfast', '-crf', '20']
      : ['-c:v', hardwareEncoder];
  const pixels = ['-pix_fmt', 'yuv420p'];

  return [
    ...inputArgs(file, offsetSeconds),
    ...mapArgs(audioTrack),
    ...video,
    ...pixels,
    '-c:a',
    'aac',
    '-b:a',
    '192k',
    '-ac',
    '2',
    ...outputArgs(),
  ];
}

/** Whether a codec is one Chromium decodes — an absent stream cannot fail to. */
function readable(codec: string | null, native: string[]): boolean {
  return codec === null || native.includes(codec);
}

/**
 * Whether the picture and the chosen voice are streams Chromium reads. A file
 * with no audio at all has no voice that could fail to decode.
 */
function codecsAreNative(probe: MediaProbe, audioTrack: number): boolean {
  return (
    readable(probe.videoCodec, NATIVE_VIDEO_CODECS) &&
    readable(probe.audioStreams[audioTrack]?.codec ?? null, NATIVE_AUDIO_CODECS)
  );
}

/**
 * Whether the file needs no help at all: right container, right codecs, and
 * its first voice — the one the element plays.
 */
function needsNothing(probe: MediaProbe, audioTrack: number): boolean {
  return (
    audioTrack === 0 &&
    NATIVE_CONTAINERS.includes(probe.container) &&
    codecsAreNative(probe, audioTrack)
  );
}

/**
 * Whether the file has the chosen voice. Index 0 always is — a file with no
 * audio, or one nothing probed, plays its first track or none.
 */
function hasTrack(probe: MediaProbe | null, audioTrack: number): boolean {
  return audioTrack === 0 || audioTrack < (probe?.audioStreams.length ?? 0);
}

/** The name's claim, for the case where there is no better one. */
function looksNative(file: string): boolean {
  return NATIVE_EXTENSIONS.some((extension) =>
    file.toLowerCase().endsWith(extension)
  );
}

/**
 * All of the format policy, in one pure function: a probe in, a **Playback
 * path** and the argv that runs it out.
 *
 * Nothing here does any I/O and nothing here can — which is the point. The
 * riskiest logic in the backend is also the cheapest to test, the **Playback
 * component**'s availability arrives as a value rather than as a question about
 * this machine, and **nothing else in `playback/` decides a path**.
 *
 * The order of the answers is the order they matter in:
 *
 * 1. An **Audio track index** the file does not have is `no-track`.
 * 2. A file nothing read is decided from its name — an MP4 goes out untouched,
 *    because a partial setup is not a dead app, and anything else is refused
 *    rather than sent as bytes no browser can read.
 * 3. A file Chromium already reads is **Direct play**, component or no
 *    component: the cheapest path there is, and the only one that seeks by
 *    byte range.
 * 4. With no component, everything left is `cannot-play`. The policy answers
 *    from what is installed now, never from what the probe implies once was.
 * 5. Otherwise only the container is wrong — **Remux**, `-c copy` — or a codec
 *    is, which is a **Transcode**. The difference is two hours of a pinned CPU
 *    on a film that only needed rewrapping.
 */
export function choosePlaybackPath({
  file,
  probe,
  component,
  offsetSeconds = 0,
  audioTrack = 0,
}: PlaybackChoice): PlaybackDecision {
  if (!hasTrack(probe, audioTrack)) {
    return { path: 'no-track' };
  }

  if (probe === null) {
    return looksNative(file) ? { path: 'direct' } : { path: 'cannot-play' };
  }

  if (needsNothing(probe, audioTrack)) {
    return { path: 'direct' };
  }

  if (!component.available) {
    return { path: 'cannot-play' };
  }

  return codecsAreNative(probe, audioTrack)
    ? { path: 'remux', args: remuxArgs(file, offsetSeconds, audioTrack) }
    : {
        path: 'transcode',
        args: transcodeArgs(
          file,
          component.hardwareEncoder,
          offsetSeconds,
          audioTrack
        ),
      };
}
