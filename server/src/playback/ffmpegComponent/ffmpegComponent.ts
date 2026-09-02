import { spawn, spawnSync } from 'node:child_process';
import type { Readable } from 'node:stream';

import type { FfmpegBinaries } from '../ffmpegBinary/ffmpegBinary';
import { probe as probeFile, type MediaProbe } from '../probe/probe';

/**
 * A conversion that is running: the bytes it is producing, and the one thing
 * anybody ever needs to do to it besides read them.
 *
 * It is deliberately not a `ChildProcess`. What the route holds has to be
 * something a test can be, and everything the route does with a conversion is
 * in these two members — a family movie night must not leave transcodes
 * running, and that is the whole of the contract.
 */
export interface PlaybackProcess {
  stdout: Readable;
  /** Stop it. Safe to call on one that has already finished. */
  kill(): void;
}

/**
 * The **Playback component** as the domain sees it: what this machine can be
 * asked to do, rather than which binaries do it.
 *
 * This is the seam the whole slice is injected through. The route tests hand
 * over a fake and exercise every converting arm without a binary being spawned
 * anywhere; `main.ts` hands over {@link ffmpegComponent}. Nothing above it
 * knows there is an FFmpeg.
 */
export interface PlaybackComponent {
  /**
   * The hardware encoder this machine reports, or `null` for one with none.
   * Read once when the component is composed rather than per request: it is a
   * fact about the machine, and asking ffmpeg what it can encode costs more
   * than the film it would be asked about.
   */
  hardwareEncoder: string | null;
  /** What a file is, or `null` for every way of not knowing. */
  probe(file: string): MediaProbe | null;
  /** Start a conversion over the given argv. */
  spawn(args: string[]): PlaybackProcess;
}

/**
 * The hardware H.264 encoders worth asking for, in the order they are
 * preferred. A machine reporting none falls back to software, which is slower
 * and always there.
 */
const HARDWARE_ENCODERS = [
  'h264_nvenc',
  'h264_qsv',
  'h264_amf',
  'h264_videotoolbox',
  'h264_vaapi',
];

/** ffmpeg's encoder list is a few hundred lines; this is a ceiling. */
const ENCODERS_BUFFER_BYTES = 4 * 1024 * 1024;

/**
 * Which hardware encoder this build of ffmpeg was compiled with, if any.
 *
 * A build listing an encoder is not a machine that can run it — a laptop with
 * no NVIDIA card still gets `h264_nvenc` from a full build — so the fallback
 * that matters is at the other end: a conversion that will not start leaves the
 * film unplayable, and the next slice's error handling is where that is caught.
 * What is asserted here is the *selection*, and it is in the argv.
 */
function detectHardwareEncoder(ffmpeg: string): string | null {
  const result = spawnSync(ffmpeg, ['-hide_banner', '-encoders'], {
    encoding: 'utf8',
    maxBuffer: ENCODERS_BUFFER_BYTES,
    windowsHide: true,
  });

  if (result.error !== undefined || typeof result.stdout !== 'string') {
    return null;
  }

  const listed = result.stdout;
  return HARDWARE_ENCODERS.find((name) => listed.includes(name)) ?? null;
}

/**
 * Compose a **Playback component** over a resolved pair of binaries.
 *
 * `stderr` is discarded rather than piped: ffmpeg narrates every conversion,
 * and a stream nobody reads fills its pipe and stops the film. What matters
 * when a conversion fails is that the bytes stop, which the element sees on its
 * own.
 */
export function ffmpegComponent(binaries: FfmpegBinaries): PlaybackComponent {
  return {
    hardwareEncoder: detectHardwareEncoder(binaries.ffmpeg),
    probe: (file) => probeFile(binaries.ffprobe, file),
    spawn: (args) => {
      const child = spawn(binaries.ffmpeg, args, {
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
      });

      return {
        stdout: child.stdout,
        kill: () => {
          child.kill();
        },
      };
    },
  };
}
