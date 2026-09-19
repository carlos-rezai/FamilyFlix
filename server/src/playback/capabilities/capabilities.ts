import type { CodecCapability } from '@/types';

import {
  NATIVE_AUDIO_CODECS,
  NATIVE_VIDEO_CODECS,
} from '../choosePlaybackPath/choosePlaybackPath';
import type { PlaybackComponent } from '../ffmpegComponent/ffmpegComponent';

/**
 * One decoder line of `ffmpeg -decoders`: a six-character flag field opening
 * with the stream kind, then the codec's name.
 *
 * The legend above the `------` rule is shaped the same way as far as the flags
 * go — ` V..... = Video` — so the name is what separates a decoder from a key
 * to the columns, and `=` is not a name. A name begins with a letter: that is
 * what keeps `= Video` from being reported as a codec called `=`, and it
 * leaves out the handful ffmpeg names from a digit — `012v`, `4xm`, `8bps` —
 * which are uncompressed and game formats no family film is made of.
 */
const DECODER_LINE = /^\s([VA])[.A-Z]{5}\s+([A-Za-z][A-Za-z0-9_-]*)/;

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
 * What this machine can actually decode, as rows: Chromium's native set on its
 * own when there is no **Playback component**, and that set ∪ what the
 * component's `ffmpeg -decoders` reports when there is one.
 *
 * The rows alone, and not the whole **Codec report**: which component is live
 * — its source, its size, its two basenames — is the **Component slot**'s
 * answer and not something this function could know, so the report is
 * assembled in one place, `Playback.capabilities()`, from both halves.
 *
 * The native set is imported from `choosePlaybackPath` rather than listed again
 * here, and the component is the one handed over — the one the slot says is
 * live and the player converts with — rather than a second resolution of the
 * slot. Both are the same rule: this report is the truth about what the player
 * will do, not a second opinion about it. A separate list would drift, and a
 * separate lookup would quietly stop honouring the slot the day the live
 * component is replaced from Settings. Nothing here reads the environment.
 *
 * A codec both can decode is reported **once, as native**. Two rows would be
 * two rows for one format, and calling it via-component would be a lie that
 * costs the family a transcode they never needed: **Direct play** wants no
 * component at all.
 *
 * Nothing here throws. **Absent is a state, not an error** — the same decision
 * `choosePlaybackPath` rests on — so a machine whose installer has not run yet
 * gets a codec screen that says MP4s play and nothing else does, rather than a
 * Settings page that takes the app down with it. A component that is there
 * and will not say adds no rows.
 */
export function capabilities(
  component: PlaybackComponent | null
): CodecCapability[] {
  if (component === null) {
    return nativeRows();
  }

  const listed = component.decoders();
  const codecs = nativeRows();
  const reported = new Set(codecs.map((entry) => entry.codec));

  for (const row of listed === null ? [] : parseDecoders(listed)) {
    if (reported.has(row.codec)) {
      continue;
    }
    reported.add(row.codec);
    codecs.push(row);
  }

  return codecs;
}
