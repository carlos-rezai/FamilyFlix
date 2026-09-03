import { spawnSync } from 'node:child_process';

import {
  NATIVE_AUDIO_CODECS,
  NATIVE_VIDEO_CODECS,
} from '../choosePlaybackPath/choosePlaybackPath';
import {
  ffmpegBinary,
  type FfmpegBinaries,
  type FfmpegEnvironment,
} from '../ffmpegBinary/ffmpegBinary';

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

/** One row of the CodecManager, as the machine actually is. */
export interface CodecCapability {
  codec: string;
  kind: CodecKind;
  support: CodecSupport;
}

/**
 * What this machine can decode, and whether a **Playback component** is part of
 * the answer.
 *
 * `component` is reported separately from the rows because the two are not the
 * same claim: a component that is installed and will not say what it decodes
 * adds no rows and is still installed, and a family told otherwise would go
 * looking for an installer they already ran.
 */
export interface PlaybackCapabilities {
  component: boolean;
  codecs: CodecCapability[];
}

/**
 * What `ffmpeg -decoders` printed, or `null` for every way of not knowing —
 * taken as an argument so the parsing can be asked about a listing rather than
 * about the machine running the test, which on CI has no FFmpeg on it.
 */
export type DecoderListing = (binaries: FfmpegBinaries) => string | null;

/** ffmpeg's decoder list is a few hundred lines; this is a ceiling. */
const DECODERS_BUFFER_BYTES = 4 * 1024 * 1024;

/**
 * One decoder line of `ffmpeg -decoders`: a six-character flag field opening
 * with the stream kind, then the codec's name.
 *
 * The legend above the `------` rule is shaped the same way as far as the flags
 * go — ` V..... = Video` — so the name is what separates a decoder from a key
 * to the columns, and `=` is not a name. Requiring the name to start
 * alphanumeric is what keeps `= Video` from being reported as a codec called
 * `=`.
 */
const DECODER_LINE = /^\s([VA])[.A-Z]{5}\s+([A-Za-z0-9][A-Za-z0-9_-]*)/;

/**
 * Ask a resolved **Playback component** what it decodes.
 *
 * `null` is every way of not knowing — a binary that will not start, a build
 * that answers nothing, output that will not parse — and they are one answer
 * because a caller cannot act differently on them: the component is there
 * either way, and it has added nothing either way.
 */
function ffmpegDecoders(binaries: FfmpegBinaries): string | null {
  const result = spawnSync(binaries.ffmpeg, ['-hide_banner', '-decoders'], {
    encoding: 'utf8',
    maxBuffer: DECODERS_BUFFER_BYTES,
    windowsHide: true,
  });

  if (result.error !== undefined || typeof result.stdout !== 'string') {
    return null;
  }

  return result.stdout;
}

/** Everything Chromium decodes unaided, as rows. */
function nativeRows(): CodecCapability[] {
  return [
    ...NATIVE_VIDEO_CODECS.map(
      (codec): CodecCapability => ({ codec, kind: 'video', support: 'native' })
    ),
    ...NATIVE_AUDIO_CODECS.map(
      (codec): CodecCapability => ({ codec, kind: 'audio', support: 'native' })
    ),
  ];
}

/** The video and audio decoders a listing names, in the order it named them. */
function parseDecoders(listed: string): CodecCapability[] {
  const rows: CodecCapability[] = [];

  for (const line of listed.split('\n')) {
    const match = DECODER_LINE.exec(line);
    if (match === null) {
      continue;
    }

    const [, flag, codec] = match;
    rows.push({
      codec,
      kind: flag === 'V' ? 'video' : 'audio',
      support: 'via-component',
    });
  }

  return rows;
}

/**
 * What this machine can actually decode: Chromium's native set on its own when
 * there is no **Playback component**, and that set ∪ what `ffmpeg -decoders`
 * reports when there is one.
 *
 * The native set is imported from `choosePlaybackPath` rather than listed again
 * here, and the component is resolved through `ffmpegBinary` rather than by a
 * second copy of the three-step lookup. Both are the same rule: this report is
 * the truth about what the player will do, not a second opinion about it — a
 * separate list would drift, and a separate lookup would quietly stop honouring
 * the slot the installer fills.
 *
 * A codec both can decode is reported **once, as native**. Two rows would be
 * two rows for one format, and calling it via-component would be a lie that
 * costs the family a transcode they never needed: **Direct play** wants no
 * component at all.
 *
 * Nothing here throws. **Absent is a state, not an error** — the same decision
 * `choosePlaybackPath` rests on — so a machine whose installer has not run yet
 * gets a codec screen that says MP4s play and nothing else does, rather than a
 * Settings page that takes the app down with it.
 */
export function capabilities(
  env: FfmpegEnvironment,
  listing: DecoderListing = ffmpegDecoders
): PlaybackCapabilities {
  const binaries = ffmpegBinary(env);
  if (binaries === null) {
    return { component: false, codecs: nativeRows() };
  }

  const listed = listing(binaries);
  const codecs = nativeRows();
  const reported = new Set(codecs.map((entry) => entry.codec));

  for (const row of listed === null ? [] : parseDecoders(listed)) {
    if (reported.has(row.codec)) {
      continue;
    }
    reported.add(row.codec);
    codecs.push(row);
  }

  return { component: true, codecs };
}
