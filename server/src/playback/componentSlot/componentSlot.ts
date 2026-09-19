import {
  chmodSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { basename, join } from 'node:path';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import type { PlaybackComponentInfo } from '@/types';

import type { ComponentBinary } from '../componentBinary/componentBinary';
import {
  EXE,
  ffmpegBinary,
  pairIn,
  type FfmpegBinaries,
  type FfmpegEnvironment,
} from '../ffmpegBinary/ffmpegBinary';
import {
  ffmpegComponent,
  type PlaybackComponent,
} from '../ffmpegComponent/ffmpegComponent';
import { verifyComponent } from '../verifyComponent/verifyComponent';

/**
 * What an install answered. **A value, never a throw**: the route maps reason
 * to status, and nothing above the slot reasons about errno — which is the
 * whole reason the classification lives in here.
 */
export type InstallOutcome =
  | { ok: true }
  | { ok: false; reason: InstallRefusal };

/**
 * Why a drop did not go live.
 *
 * The three the wire names — `incomplete` is a half a pair, `not-a-component`
 * is a pair that will not run, `in-use` is the **In-use refusal**. `failed` is
 * the fourth, and the honest one: a swap stopped by something that is neither
 * the lock nor the pair — a full disk, a directory gone from under it. It is
 * not `in-use`, because sending the maintainer to stop a film that is not the
 * problem would be worse than saying nothing useful; and it is a value rather
 * than a throw, because an install that threw would be the one outcome the
 * route could not answer.
 */
export type InstallRefusal =
  | 'incomplete'
  | 'not-a-component'
  | 'in-use'
  | 'failed';

/**
 * A drop being staged: the **Incoming component**, under `<slot>/incoming/`
 * and nowhere near the component the family's films are playing through.
 *
 * Its three members are the whole of an upload's life. Nothing here inspects
 * bytes — {@link IncomingComponent.install} is where a drop is found out, by
 * being run.
 */
export interface IncomingComponent {
  /**
   * Write one half's bytes, **under the platform's own name for it** rather
   * than whatever the client called the file — which is what makes a build
   * downloaded as `ffmpeg-7.1.exe` resolve as a component once it is live.
   * Executable on POSIX, where a file without the bit will not start.
   */
  take(binary: ComponentBinary, bytes: Readable): Promise<void>;

  /**
   * Verify the staged pair and, if it runs, swear it in. Either way the
   * staging folder is gone afterwards, so a retry is a fresh attempt and not a
   * repair.
   */
  install(): InstallOutcome;

  /** Take the staging folder back, having installed nothing. */
  discard(): void;
}

/**
 * The **Component slot**: the writable directory an **Uploaded component**
 * lives in, and the object over it.
 *
 * Everything hard about replacing a **Playback component** — the resolution
 * order, the staging, the verification, the swap — lives behind this one
 * object, so that nothing above it reasons about directories or errno.
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
   * Begin an upload: an emptied `<slot>/incoming/` and the object over it.
   * Emptied rather than reused, because half of yesterday's drop must not be
   * able to complete today's pair.
   */
  receive(): IncomingComponent;

  /**
   * The remove half, which is Phase 4's of `16-component-upload`. It is
   * declared here because the contract is one object rather than two, and
   * `never` is the honest return until that half exists: nothing may call it
   * yet, and the doubles that stand in for a slot refuse it for the same
   * reason.
   */
  remove(): never;
}

/**
 * The seams a slot is composed over: running two binaries, and moving a
 * directory. Both are injected for the reason the environment is — a unit that
 * spawns or renames must be assertable on a machine that has neither an FFmpeg
 * on it nor a Windows lock to reproduce.
 */
export interface ComponentSlotSeams {
  verify?: (pair: FfmpegBinaries) => boolean;
  rename?: (from: string, to: string) => void;
}

/** The two staging folders a crashed run can leave behind. */
const LEFTOVERS = ['incoming', 'previous'];

/**
 * The errno codes that mean the live component is being held open — a
 * conversion running over `ffmpeg.exe` on Windows. This is the whole of "is
 * the component in use?", and it is asked of **one** failing syscall.
 */
const LOCKED = new Set(['EBUSY', 'EPERM', 'EACCES']);

/** Whether a thrown thing is that lock. */
function isLocked(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string' &&
    LOCKED.has(error.code)
  );
}

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
  env: FfmpegEnvironment,
  { verify = verifyComponent, rename = renameSync }: ComponentSlotSeams = {}
): ComponentSlot {
  const currentDir = join(slotDir, 'current');
  const incomingDir = join(slotDir, 'incoming');
  const previousDir = join(slotDir, 'previous');

  for (const leftover of LEFTOVERS) {
    rmSync(join(slotDir, leftover), { recursive: true, force: true });
  }

  // Composed here rather than per call: the component is the value `current()`
  // answers until an install replaces it, and only an install does.
  let live: PlaybackComponent | null = null;
  let description: PlaybackComponentInfo | null = null;

  const resolveLive = (): void => {
    const uploaded = pairIn(currentDir);
    const pair = uploaded ?? ffmpegBinary(env);

    live = pair === null ? null : ffmpegComponent(pair);
    description =
      pair === null
        ? null
        : describe(pair, uploaded === null ? 'default' : 'uploaded');
  };

  resolveLive();

  /** As idempotent as `rm -f`: a refusal may settle a folder twice. */
  const discard = (): void => {
    rmSync(incomingDir, { recursive: true, force: true });
  };

  /**
   * The **Component swap**: three directory renames — `current/` →
   * `previous/`, `incoming/` → `current/`, `previous/` removed. A rename
   * rather than a file overwrite is what makes a mixed pair impossible: either
   * both binaries moved or neither did.
   */
  const swap = (): InstallOutcome => {
    // A `previous/` a crash left mid-swap is in the way of this one, and it is
    // the component *before* the one that is live now — nothing to keep.
    rmSync(previousDir, { recursive: true, force: true });

    let moved = 0;
    try {
      if (existsSync(currentDir)) {
        rename(currentDir, previousDir);
        moved += 1;
      }
      rename(incomingDir, currentDir);
      moved += 1;
    } catch (error) {
      if (moved > 0) {
        // The live component is the one thing that must be back where it was.
        try {
          rename(previousDir, currentDir);
        } catch {
          // Nothing left to try, and a throw here would lose the outcome.
        }
      }
      discard();

      // The **In-use refusal** is a *first* rename that failed the way a lock
      // fails, and nothing moved. Anything else — a full disk, a directory
      // gone from under it — is not a film to go and stop.
      return {
        ok: false,
        reason: moved === 0 && isLocked(error) ? 'in-use' : 'failed',
      };
    }

    rmSync(previousDir, { recursive: true, force: true });
    resolveLive();
    return { ok: true };
  };

  return {
    current: () => live,
    info: () => description,
    receive: () => {
      discard();
      mkdirSync(incomingDir, { recursive: true });

      return {
        take: async (binary, bytes) => {
          const file = join(incomingDir, `${binary}${EXE}`);
          await pipeline(bytes, createWriteStream(file));
          if (process.platform !== 'win32') {
            chmodSync(file, 0o755);
          }
        },
        install: () => {
          // Half a component is not a component — `pairIn`'s rule, read here
          // so the slot and the resolver cannot disagree about what a pair is.
          const staged = pairIn(incomingDir);
          if (staged === null) {
            discard();
            return { ok: false, reason: 'incomplete' };
          }

          // Over `incoming/`, before anything moves: that is what "before the
          // live component is touched" means concretely.
          if (!verify(staged)) {
            discard();
            return { ok: false, reason: 'not-a-component' };
          }

          return swap();
        },
        discard,
      };
    },
    remove: () => {
      throw new Error('the component slot cannot be removed from yet');
    },
  };
}
