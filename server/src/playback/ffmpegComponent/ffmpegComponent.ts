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
   * The hardware encoder this machine can run, or `null` for one with none.
   * Read once when the component is composed rather than per request: it is a
   * fact about the machine, and asking ffmpeg what it can encode costs more
   * than the film it would be asked about.
   */
  hardwareEncoder: string | null;
  /**
   * What `ffmpeg -decoders` printed, raw, or `null` for every way of not
   * knowing — a binary that will not start, a build that answers nothing.
   * Raw rather than parsed, the way {@link probe} hands over raw output: the
   * parsing is `capabilities`', which is asked about a string rather than
   * about the machine running the test. Asked afresh on every call, so the
   * day the live component is replaced the next read describes the new one.
   */
  decoders(): string | null;
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

/** ffmpeg's encoder and decoder lists are a few hundred lines; a ceiling. */
const LISTING_BUFFER_BYTES = 4 * 1024 * 1024;

/**
 * How long one trial encode is given. A working encoder opens in well under a
 * second; one whose driver is missing fails faster still.
 */
const TRIAL_TIMEOUT_MS = 10_000;

/**
 * What one of ffmpeg's listings printed, or `null` for every way of not
 * knowing — taken as an argument so the selection can be asked about a
 * listing rather than about the machine running the test, the way `probe`
 * takes its output: one answer in this domain to how a spawning module is
 * tested.
 */
export type Listing = (ffmpeg: string) => string | null;

/**
 * Whether a build of ffmpeg can actually encode with the named encoder on this
 * machine — a trial run, `true` only for one that exited cleanly.
 */
export type EncoderTrial = (ffmpeg: string, encoder: string) => boolean;

/**
 * What a component is composed over — `ffmpeg -encoders`, read once for the
 * hardware encoders a build lists, a trial of each in turn, and
 * `ffmpeg -decoders`, read on demand for the **Codec report**. One seam for
 * every spawn, and no answer stands in for another.
 */
export interface FfmpegListing {
  encoders: Listing;
  decoders: Listing;
  runs: EncoderTrial;
}

/** Ask a build of ffmpeg for one of its listings. */
function listing(flag: '-encoders' | '-decoders'): Listing {
  return (ffmpeg) => {
    const result = spawnSync(ffmpeg, ['-hide_banner', flag], {
      encoding: 'utf8',
      maxBuffer: LISTING_BUFFER_BYTES,
      windowsHide: true,
    });

    if (result.error !== undefined || typeof result.stdout !== 'string') {
      return null;
    }

    return result.stdout;
  };
}

/**
 * One tenth of a second of a flat colour through the encoder, thrown away — in
 * the pixel format every **Transcode** asks for, so an encoder that cannot take
 * it fails here rather than on a film.
 */
const runs: EncoderTrial = (ffmpeg, encoder) => {
  const result = spawnSync(
    ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=size=256x256:duration=0.1',
      '-c:v',
      encoder,
      '-pix_fmt',
      'yuv420p',
      '-f',
      'null',
      '-',
    ],
    { stdio: 'ignore', timeout: TRIAL_TIMEOUT_MS, windowsHide: true }
  );

  return result.error === undefined && result.status === 0;
};

/** The set that actually runs ffmpeg: what `main.ts` composes over. */
const FFMPEG_LISTING: FfmpegListing = {
  encoders: listing('-encoders'),
  decoders: listing('-decoders'),
  runs,
};

/**
 * The first hardware encoder, in preference order, that this build of ffmpeg
 * lists **and** this machine can run, if any.
 *
 * A build listing an encoder is not a machine that can run it — a full build
 * lists `h264_nvenc` on an AMD machine, where it cannot load `nvcuda.dll` and
 * every transcode wrote nothing (issue #388) — so each listed candidate is
 * tried before it is chosen, and the trials stop at the first that runs. None
 * running is software, slower and always there.
 */
function detectHardwareEncoder(
  ffmpeg: string,
  listed: FfmpegListing
): string | null {
  const printed = listed.encoders(ffmpeg);
  if (printed === null) {
    return null;
  }
  return (
    HARDWARE_ENCODERS.find(
      (name) => printed.includes(name) && listed.runs(ffmpeg, name)
    ) ?? null
  );
}

/**
 * Compose a **Playback component** over a resolved pair of binaries.
 *
 * `stderr` is discarded rather than piped: ffmpeg narrates every conversion,
 * and a stream nobody reads fills its pipe and stops the film. What matters
 * when a conversion fails is that the bytes stop — and the route reads that off
 * `stdout` alone, because a process that ends having written nothing is the one
 * signal every way of failing has in common.
 *
 * `listed` is the seam: what `ffmpeg -encoders` and `ffmpeg -decoders` would
 * have printed and what a trial encode would have answered, defaulting to
 * running them. It is what lets the encoder
 * preference order be asserted on a machine that has no hardware encoder and
 * no ffmpeg either, and the **Codec report** on one with no FFmpeg at all.
 */
export function ffmpegComponent(
  binaries: FfmpegBinaries,
  listed: FfmpegListing = FFMPEG_LISTING
): PlaybackComponent {
  return {
    hardwareEncoder: detectHardwareEncoder(binaries.ffmpeg, listed),
    decoders: () => listed.decoders(binaries.ffmpeg),
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
