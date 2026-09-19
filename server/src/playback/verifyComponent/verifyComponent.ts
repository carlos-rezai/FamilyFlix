import { spawnSync } from 'node:child_process';

import type { FfmpegBinaries } from '../ffmpegBinary/ffmpegBinary';

/**
 * What asking a binary for its version answered: how it exited and what it
 * printed, or `null` for every way of not starting at all — the file is not
 * executable, it is the wrong architecture, the OS refused it.
 *
 * Injected for the reason `ffmpegComponent`'s `Listing` seam exists: a unit
 * that spawns must be assertable on a machine with no FFmpeg on it, which is
 * what CI is.
 */
export type VersionRun = (
  binary: string
) => { code: number; stdout: string } | null;

/** The pair that actually runs the binaries. */
const spawnVersion: VersionRun = (binary) => {
  const result = spawnSync(binary, ['-version'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.error !== undefined || typeof result.stdout !== 'string') {
    return null;
  }

  return { code: result.status ?? 1, stdout: result.stdout };
};

/** Whether one half exited cleanly and opened with its own word. */
function answersAsItsOwnHalf(
  binary: string,
  expected: string,
  run: VersionRun
): boolean {
  const answer = run(binary);

  // The banner is the *first* thing a build prints. A wrapper that echoes
  // something of its own first is not the build, and a text file that happened
  // to exit 0 through whatever read it says nothing about ffmpeg at all.
  return (
    answer !== null &&
    answer.code === 0 &&
    answer.stdout.startsWith(`${expected} version`)
  );
}

/**
 * Whether a staged pair is a **Verified component**: both binaries run, both
 * exit `0`, and both open with the word that says what they are.
 *
 * That single test is everything the slot knows about whether a drop is a
 * **Playback component**, and it is applied **before the live component is
 * touched** — which is what makes a bad drop cost the family nothing.
 *
 * A `.dll`, a text file renamed `ffmpeg.exe`, a macOS build on a Windows
 * machine and a binary that will not start at all all fail the same way, and
 * the family hears one sentence about all four. Naming the reason would be
 * naming an errno.
 *
 * **Both halves are asked, never just the first.** The pair is the unit: an
 * ffmpeg with no prober beside it can convert but never answer how long a film
 * is, which is half a component and not a working one — and two copies of
 * ffmpeg under two names is a pair that probes nothing, caught here because
 * each half is asked for its *own* word.
 */
export function verifyComponent(
  pair: FfmpegBinaries,
  run: VersionRun = spawnVersion
): boolean {
  const converts = answersAsItsOwnHalf(pair.ffmpeg, 'ffmpeg', run);
  const probes = answersAsItsOwnHalf(pair.ffprobe, 'ffprobe', run);

  return converts && probes;
}
