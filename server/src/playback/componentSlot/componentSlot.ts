import { rmSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { PlaybackComponentInfo } from '@/types';

import {
  ffmpegBinary,
  pairIn,
  type FfmpegBinaries,
  type FfmpegEnvironment,
} from '../ffmpegBinary/ffmpegBinary';
import {
  ffmpegComponent,
  type PlaybackComponent,
} from '../ffmpegComponent/ffmpegComponent';

/**
 * The **Component slot**: the writable directory an **Uploaded component**
 * lives in, and the object over it.
 *
 * Everything hard about replacing a **Playback component** — the resolution
 * order, the staging, the verification, the swap — lives behind this one
 * object, so that nothing above it reasons about directories or errno. This
 * phase is its **read** half: what is live, and what to say about it.
 *
 * **The slot is read first**, ahead of `FAMILYFLIX_FFMPEG_PATH` and ahead of
 * `PATH`. That order is the whole initiative: an uploaded component has to
 * beat the installer's build and a system-wide ffmpeg, or replacing the
 * component from Settings would change nothing about what pressing Play does.
 * It is also why the **Default component** is never overwritten — a remove
 * falls back to it.
 */
export interface ComponentSlot {
  /**
   * The live component: the pair at `<slot>/current/` composed through
   * `ffmpegComponent`, else the resolver's, else `null` for a machine with no
   * FFmpeg on it at all.
   *
   * **Resolved when the slot is created and again after every install and
   * remove, never per call.** `hardwareEncoder` costs a spawn, and a component
   * is a fact about the machine that only those two writes change — composing
   * it again per call would ask ffmpeg what it can encode on every press of
   * Play.
   */
  current(): PlaybackComponent | null;

  /**
   * The **Component info** for that component — where it came from, what the
   * pair weighs and what its two files are called — or `null` when there is
   * none. It is what the **Component row** draws.
   */
  info(): PlaybackComponentInfo | null;

  /**
   * The write half, which is Phase 2's and Phase 4's of
   * `16-component-upload`. They are declared here because the contract is one
   * object rather than two, and `never` is the honest return until the halves
   * exist: nothing may call them yet, and the doubles that stand in for a slot
   * refuse them for the same reason.
   */
  receive(): never;
  remove(): never;
}

/** The two staging folders a crashed run can leave behind. */
const LEFTOVERS = ['incoming', 'previous'];

/** The pair's summed bytes, counting a file that will not stat as nothing. */
function bytesOf(pair: FfmpegBinaries): number {
  return [pair.ffmpeg, pair.ffprobe].reduce((total, file) => {
    try {
      return total + statSync(file).size;
    } catch {
      // Gone between the resolve and the read, or unreadable. A size the row
      // draws is not worth a Settings page that refuses to load.
      return total;
    }
  }, 0);
}

/** What a resolved pair is, as the screen says it. */
function describe(
  pair: FfmpegBinaries,
  source: PlaybackComponentInfo['source']
): PlaybackComponentInfo {
  return {
    source,
    bytes: bytesOf(pair),
    files: [basename(pair.ffmpeg), basename(pair.ffprobe)],
  };
}

/**
 * Compose a **Component slot** over a directory and an environment.
 *
 * The environment arrives as an argument the way `ffmpegBinary` takes it, so a
 * slot can be asked about a machine other than the one running the code — a
 * slot that reached for `process.env` could only ever be asked about itself.
 *
 * Creating the slot sweeps the two staging folders a crashed upload can leave
 * behind and resolves what is live once. Neither throws: a directory that is
 * not there yet is every fresh install, and **absent is a state, not an
 * error** — the app starts, the library browses, and MP4s still direct-play.
 */
export function createComponentSlot(
  slotDir: string,
  env: FfmpegEnvironment
): ComponentSlot {
  for (const leftover of LEFTOVERS) {
    rmSync(join(slotDir, leftover), { recursive: true, force: true });
  }

  const uploaded = pairIn(join(slotDir, 'current'));
  const pair = uploaded ?? ffmpegBinary(env);

  // Composed once, here: the component is the value `current()` answers for
  // the life of the slot, and an install or a remove is what replaces it.
  const live = pair === null ? null : ffmpegComponent(pair);
  const description =
    pair === null
      ? null
      : describe(pair, uploaded === null ? 'default' : 'uploaded');

  const refuse = (): never => {
    throw new Error('the component slot cannot be written to yet');
  };

  return {
    current: () => live,
    info: () => description,
    receive: refuse,
    remove: refuse,
  };
}
