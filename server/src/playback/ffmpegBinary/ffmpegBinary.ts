import { statSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

/**
 * The two binaries a **Playback component** is made of. They ship together and
 * are resolved together: one without the other can probe or convert but not
 * both, and a path chosen without a probe is a guess.
 */
export interface FfmpegBinaries {
  ffmpeg: string;
  ffprobe: string;
}

/**
 * The environment this resolver reads, named rather than inherited. Taking it
 * as an argument is what lets a test ask about a machine other than the one
 * running it — a resolver that reached for `process.env` could only ever be
 * asked about itself.
 */
export interface FfmpegEnvironment {
  /** The slot the installer fills, and the one an uploaded component occupies. */
  FAMILYFLIX_FFMPEG_PATH?: string;
  PATH?: string;
}

/** What an executable is called here — the one difference Windows makes. */
const EXE = process.platform === 'win32' ? '.exe' : '';

/** Whether there is a file at `candidate` — a directory is not a binary. */
function isFile(candidate: string): boolean {
  try {
    return statSync(candidate).isFile();
  } catch {
    // Nothing there, or nothing this process may look at. Both are "no".
    return false;
  }
}

/**
 * The pair in `directory`, if both halves of it are there. Half a component is
 * not a component, so this answers `null` rather than the half it found.
 */
function pairIn(directory: string): FfmpegBinaries | null {
  const ffmpeg = join(directory, `ffmpeg${EXE}`);
  const ffprobe = join(directory, `ffprobe${EXE}`);

  return isFile(ffmpeg) && isFile(ffprobe) ? { ffmpeg, ffprobe } : null;
}

/**
 * Resolve the **Playback component**: `FAMILYFLIX_FFMPEG_PATH`, then `PATH`,
 * then **absent**.
 *
 * **Absent is a state, not an error**, and that is the decision the whole
 * transcoding slice rests on. A machine with no FFmpeg on it still runs the
 * app, still direct-plays its MP4s, and still answers every request — it simply
 * says `cannot-play` for the films that would need converting. Nothing here
 * throws, because a throw at composition time would take the browse home down
 * with it over a film nobody has opened.
 *
 * The variable names the **ffmpeg** binary itself, and `ffprobe` is looked for
 * beside it: the two ship together, so the second is found where the first was
 * rather than asked for separately. A variable naming a binary that is not
 * there — a component uninstalled, a folder moved — falls through to `PATH`
 * rather than hiding a working FFmpeg the machine already has.
 */
export function ffmpegBinary(env: FfmpegEnvironment): FfmpegBinaries | null {
  const named = env.FAMILYFLIX_FFMPEG_PATH;
  if (named !== undefined && named !== '' && isFile(named)) {
    const beside = pairIn(dirname(named));
    if (beside !== null) {
      return { ffmpeg: named, ffprobe: beside.ffprobe };
    }
  }

  for (const entry of (env.PATH ?? '').split(delimiter)) {
    if (entry === '') {
      continue;
    }
    const found = pairIn(entry);
    if (found !== null) {
      return found;
    }
  }

  return null;
}
