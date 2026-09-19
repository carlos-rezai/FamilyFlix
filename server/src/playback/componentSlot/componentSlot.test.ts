// @vitest-environment node
//
// 16 — Playback component upload, Phase 1: "the slot resolves what is live,
// and it has a row" (issue #152), Phase 2: "an upload changes what the
// next Play decides" (issue #153), and Phase 4: "the ✕ takes it back"
// (issue #155).
//
// The **Component slot**: the writable directory an **Uploaded component**
// lives in, and the object over it. Phase 1 is its **read** half —
// `current()`, the component the player actually converts with, and `info()`,
// what the **Component row** draws. Phase 2, from _an upload begun_ below, is
// its **write** half: the **Incoming component**, the **Verified component**
// and the **Component swap**. Phase 4, from _the uploaded pair taken back_, is
// that write half's inverse: `remove()` and the fall-back under it.
//
// The rule the whole initiative rests on is a resolution order: the slot is
// read **first**, ahead of `FAMILYFLIX_FFMPEG_PATH` and ahead of `PATH`. An
// **Uploaded component** therefore wins over the **Default component**, and a
// remove can fall back to it — which is why the default is never overwritten.
//
// The environment arrives as an argument, the way `ffmpegBinary` takes it, so
// a slot can be asked about a machine other than the one running the test.
// The fixtures are files in a temporary directory: what is being asked is
// which pair a slot resolves and what it says about it, never what a binary
// would print.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import {
  EXE,
  componentDir,
  ffmpegIn,
} from '../../test-support/componentDir/componentDir';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type {
  FfmpegBinaries,
  FfmpegEnvironment,
} from '../ffmpegBinary/ffmpegBinary';

import { createComponentSlot, type ComponentSlot } from './componentSlot';

/** A slot directory, empty — the machine before anything was uploaded. */
const emptySlot = () => sandboxRoot('familyflix-slot-');

/**
 * A slot directory whose `current/` holds a pair of the given weights: an
 * **Uploaded component**. The bytes differ from the resolver's fixtures so
 * `info()` says which pair the slot actually read.
 */
function slotWithUploaded(ffmpegBytes = 3, ffprobeBytes = 5): string {
  const dir = emptySlot();
  const current = join(dir, 'current');
  mkdirSync(current, { recursive: true });
  writeFileSync(join(current, `ffmpeg${EXE}`), Buffer.alloc(ffmpegBytes, 1));
  writeFileSync(join(current, `ffprobe${EXE}`), Buffer.alloc(ffprobeBytes, 1));
  return dir;
}

/** A directory the resolver finds a pair in, weighed so `info()` can be read. */
function defaultPair(ffmpegBytes = 11, ffprobeBytes = 13): string {
  const dir = componentDir();
  writeFileSync(join(dir, `ffmpeg${EXE}`), Buffer.alloc(ffmpegBytes, 1));
  writeFileSync(join(dir, `ffprobe${EXE}`), Buffer.alloc(ffprobeBytes, 1));
  return dir;
}

describe('createComponentSlot — what is live', () => {
  it('answers the resolver’s component when nothing is uploaded', () => {
    const dir = defaultPair();

    const slot = createComponentSlot(emptySlot(), {
      FAMILYFLIX_FFMPEG_PATH: ffmpegIn(dir),
    });

    expect(slot.current()).not.toBeNull();
    expect(slot.info()?.source).toBe('default');
  });

  it('answers the pair in current/ when one is there', () => {
    const slot = createComponentSlot(slotWithUploaded(), {});

    expect(slot.current()).not.toBeNull();
    expect(slot.info()?.source).toBe('uploaded');
  });

  it('reads the slot ahead of FAMILYFLIX_FFMPEG_PATH and ahead of PATH', () => {
    // The whole point of the initiative: an uploaded component beats the
    // installer's build and beats a system-wide ffmpeg, or replacing the
    // component from Settings would change nothing about what Play does.
    const installed = defaultPair();

    const slot = createComponentSlot(slotWithUploaded(3, 5), {
      FAMILYFLIX_FFMPEG_PATH: ffmpegIn(installed),
      PATH: installed,
    });

    expect(slot.info()).toMatchObject({ source: 'uploaded', bytes: 8 });
  });

  it('falls back to the resolver when only half a pair is in current/', () => {
    // Half a component is not a component — the rule `pairIn` already keeps,
    // read here by the same function so the slot and the resolver cannot
    // disagree about what a pair is.
    const dir = emptySlot();
    mkdirSync(join(dir, 'current'), { recursive: true });
    writeFileSync(join(dir, 'current', `ffmpeg${EXE}`), Buffer.alloc(3, 1));
    const installed = defaultPair();

    const slot = createComponentSlot(dir, {
      FAMILYFLIX_FFMPEG_PATH: ffmpegIn(installed),
    });

    expect(slot.info()?.source).toBe('default');
  });

  it('answers null for a machine with no component at all', () => {
    // Absent is a state rather than an error: the app starts, the library
    // browses, and MP4s still direct-play.
    const slot = createComponentSlot(emptySlot(), { PATH: '' });

    expect(slot.current()).toBeNull();
    expect(slot.info()).toBeNull();
  });

  it('does not throw over a slot directory that is not there yet', () => {
    // The default is `./playback-component`, which no fresh install has.
    const installed = defaultPair();

    const slot = createComponentSlot(join(emptySlot(), 'never-made'), {
      FAMILYFLIX_FFMPEG_PATH: ffmpegIn(installed),
    });

    expect(slot.info()?.source).toBe('default');
  });
});

describe('createComponentSlot — the component info', () => {
  it('sums the uploaded pair’s bytes and names their basenames', () => {
    const slot = createComponentSlot(slotWithUploaded(400, 600), {});

    expect(slot.info()).toEqual({
      source: 'uploaded',
      bytes: 1000,
      files: [`ffmpeg${EXE}`, `ffprobe${EXE}`],
    });
  });

  it('describes the resolver’s pair as the default component', () => {
    const dir = defaultPair(120, 80);

    const slot = createComponentSlot(emptySlot(), {
      FAMILYFLIX_FFMPEG_PATH: ffmpegIn(dir),
    });

    expect(slot.info()).toEqual({
      source: 'default',
      bytes: 200,
      files: [`ffmpeg${EXE}`, `ffprobe${EXE}`],
    });
  });
});

describe('createComponentSlot — resolved once, not per call', () => {
  it('answers the same component on a second call', () => {
    // `hardwareEncoder` costs a spawn, and a component is a fact about the
    // machine that only an install or a remove changes. Composing it again per
    // call would ask ffmpeg what it can encode on every press of Play.
    const slot = createComponentSlot(slotWithUploaded(), {});

    expect(slot.current()).toBe(slot.current());
  });
});

describe('createComponentSlot — the leftovers of a crashed run', () => {
  it('clears an incoming/ left behind by a previous attempt', () => {
    const dir = slotWithUploaded();
    mkdirSync(join(dir, 'incoming'), { recursive: true });
    writeFileSync(join(dir, 'incoming', `ffmpeg${EXE}`), Buffer.alloc(3, 1));

    createComponentSlot(dir, {});

    expect(existsSync(join(dir, 'incoming'))).toBe(false);
  });

  it('clears a previous/ left behind mid-swap', () => {
    const dir = slotWithUploaded();
    mkdirSync(join(dir, 'previous'), { recursive: true });
    writeFileSync(join(dir, 'previous', `ffmpeg${EXE}`), Buffer.alloc(3, 1));

    createComponentSlot(dir, {});

    expect(existsSync(join(dir, 'previous'))).toBe(false);
  });

  it('leaves the live component where it is', () => {
    // Only the two staging folders are swept. `current/` is the component the
    // family's films play through.
    const dir = slotWithUploaded(7, 9);
    mkdirSync(join(dir, 'incoming'), { recursive: true });

    const slot = createComponentSlot(dir, {});

    expect(existsSync(join(dir, 'current', `ffmpeg${EXE}`))).toBe(true);
    expect(slot.info()).toMatchObject({ source: 'uploaded', bytes: 16 });
  });
});

// --- the write half: an upload begun, verified, and sworn in -------------------
//
// Phase 2. The **Incoming component** stages a drop under `<slot>/incoming/`,
// the **Verified component** is the only test applied before anything moves,
// and the **Component swap** is three directory renames — `current/` →
// `previous/`, `incoming/` → `current/`, `previous/` removed. A rename rather
// than a file overwrite is what makes a mixed pair impossible: either both
// binaries moved or neither did.
//
// Both seams are injected for the same reason the environment is. `verify`
// stands in for running two binaries on a machine that has none, and `rename`
// for a Windows lock that cannot be reproduced on CI or on POSIX at all — the
// **In-use refusal** is a single failing syscall, and a test has to be able to
// make it fail.
//
// Outcomes are **values, never throws**: `{ ok: true }` or
// `{ ok: false, reason }`. Nothing above the slot reasons about errno, which is
// the whole reason the classification lives in here.

/** One part's bytes, as the route hands them to `take`. */
const partOf = (size: number, fill = 1): Readable =>
  Readable.from([Buffer.alloc(size, fill)]);

/**
 * A slot over `dir` whose verification and renaming the test decides, on a
 * machine with no component of its own unless the test names one — which is
 * what a remove falls back to.
 */
function slotOver(
  dir: string,
  seams: {
    verify?: (pair: FfmpegBinaries) => boolean;
    rename?: (from: string, to: string) => void;
  } = {},
  env: FfmpegEnvironment = {}
): ComponentSlot {
  return createComponentSlot(dir, env, { verify: () => true, ...seams });
}

/** A pair staged through the slot, ready to install. */
async function stage(
  slot: ComponentSlot,
  ffmpegBytes = 400,
  ffprobeBytes = 600
) {
  const incoming = slot.receive();
  await incoming.take('ffmpeg', partOf(ffmpegBytes));
  await incoming.take('ffprobe', partOf(ffprobeBytes));
  return incoming;
}

/**
 * A rename whose **first** call fails the way a Windows lock on a running
 * `ffmpeg.exe` fails, and which does the real thing afterwards — so a test can
 * assert that the first failure stopped the swap dead rather than that renaming
 * is broken here.
 */
function lockedRename(code: string) {
  const attempts: [from: string, to: string][] = [];

  return {
    attempts,
    rename: (from: string, to: string): void => {
      attempts.push([from, to]);
      if (attempts.length === 1) {
        throw Object.assign(new Error(`${code}: rename '${from}' -> '${to}'`), {
          code,
        });
      }
      renameSync(from, to);
    },
  };
}

describe('createComponentSlot — an upload begun', () => {
  it('stages each half under the platform’s own name', async () => {
    // Whatever the client called the file, what lands on disk is what
    // `pairIn` will look for afterwards — which is what makes a build
    // downloaded as `ffmpeg-7.1.exe` resolve as a component once it is live.
    const dir = emptySlot();

    await stage(slotOver(dir), 4, 6);

    expect(readFileSync(join(dir, 'incoming', `ffmpeg${EXE}`))).toHaveLength(4);
    expect(readFileSync(join(dir, 'incoming', `ffprobe${EXE}`))).toHaveLength(
      6
    );
  });

  it('empties an incoming/ left behind by an earlier attempt', () => {
    // A retry is a fresh attempt and not a repair: half of yesterday's drop
    // must not be able to complete today's pair.
    const dir = emptySlot();
    const slot = slotOver(dir);
    mkdirSync(join(dir, 'incoming'), { recursive: true });
    writeFileSync(join(dir, 'incoming', 'notes.txt'), 'left behind');

    slot.receive();

    expect(existsSync(join(dir, 'incoming', 'notes.txt'))).toBe(false);
  });

  it('takes the staged folder back on discard', async () => {
    const dir = emptySlot();
    const incoming = await stage(slotOver(dir));

    incoming.discard();

    expect(existsSync(join(dir, 'incoming'))).toBe(false);
  });
});

describe('createComponentSlot — what will not go live', () => {
  it('refuses half a pair as incomplete, and stages nothing', async () => {
    const dir = slotWithUploaded(3, 5);
    const slot = slotOver(dir);
    const incoming = slot.receive();
    await incoming.take('ffmpeg', partOf(400));

    expect(incoming.install()).toEqual({ ok: false, reason: 'incomplete' });
    expect(existsSync(join(dir, 'incoming'))).toBe(false);
    expect(slot.info()).toMatchObject({ source: 'uploaded', bytes: 8 });
  });

  it('refuses a pair the verification will not pass', async () => {
    // A `.dll`, a renamed text file, a build for another platform: one
    // sentence covers all of them, and the live component never moved.
    const dir = slotWithUploaded(3, 5);
    const slot = slotOver(dir, { verify: () => false });
    const live = slot.current();
    const incoming = await stage(slot);

    expect(incoming.install()).toEqual({
      ok: false,
      reason: 'not-a-component',
    });
    expect(existsSync(join(dir, 'incoming'))).toBe(false);
    expect(slot.info()).toMatchObject({ source: 'uploaded', bytes: 8 });
    expect(slot.current()).toBe(live);
  });

  it('verifies the staged pair, before the live one is touched', async () => {
    // The check runs over `incoming/` — which is what "before anything is
    // swapped" means concretely, and why a bad drop costs the family nothing.
    const dir = slotWithUploaded(3, 5);
    const verified: FfmpegBinaries[] = [];
    const slot = slotOver(dir, {
      verify: (pair) => {
        verified.push(pair);
        return false;
      },
    });

    (await stage(slot)).install();

    expect(verified).toHaveLength(1);
    expect(verified[0].ffmpeg).toBe(join(dir, 'incoming', `ffmpeg${EXE}`));
    expect(verified[0].ffprobe).toBe(join(dir, 'incoming', `ffprobe${EXE}`));
    expect(readFileSync(join(dir, 'current', `ffmpeg${EXE}`))).toHaveLength(3);
  });
});

describe('createComponentSlot — the component swap', () => {
  it('puts a verified pair live and recomposes what is current', async () => {
    const dir = slotWithUploaded(3, 5);
    const slot = slotOver(dir);
    const before = slot.current();

    expect((await stage(slot, 400, 600)).install()).toEqual({ ok: true });

    expect(slot.info()).toEqual({
      source: 'uploaded',
      bytes: 1000,
      files: [`ffmpeg${EXE}`, `ffprobe${EXE}`],
    });
    expect(slot.current()).not.toBe(before);
    expect(readFileSync(join(dir, 'current', `ffmpeg${EXE}`))).toHaveLength(
      400
    );
  });

  it('installs onto a machine that has never had a component', async () => {
    // The fresh install: nothing in `current/`, nothing on PATH, and a drop
    // that makes this machine able to convert for the first time.
    const dir = emptySlot();
    const slot = slotOver(dir);

    expect(slot.current()).toBeNull();
    expect((await stage(slot)).install()).toEqual({ ok: true });

    expect(slot.current()).not.toBeNull();
    expect(slot.info()?.source).toBe('uploaded');
  });

  it('leaves neither staging folder behind', async () => {
    const dir = slotWithUploaded(3, 5);

    (await stage(slotOver(dir))).install();

    expect(existsSync(join(dir, 'incoming'))).toBe(false);
    expect(existsSync(join(dir, 'previous'))).toBe(false);
  });

  it('replaces the live pair when the same drop comes twice', async () => {
    // A maintainer who is not sure whether it worked drops it again. Nothing
    // accumulates and nothing is half-replaced.
    const dir = emptySlot();
    const slot = slotOver(dir);

    (await stage(slot, 400, 600)).install();
    expect((await stage(slot, 700, 900)).install()).toEqual({ ok: true });

    expect(slot.info()).toMatchObject({ source: 'uploaded', bytes: 1600 });
    expect(existsSync(join(dir, 'previous'))).toBe(false);
  });

  it('is not blocked by a previous/ a crash left mid-swap', async () => {
    const dir = slotWithUploaded(3, 5);
    const slot = slotOver(dir);
    mkdirSync(join(dir, 'previous'), { recursive: true });
    writeFileSync(join(dir, 'previous', `ffmpeg${EXE}`), Buffer.alloc(9, 1));

    expect((await stage(slot, 400, 600)).install()).toEqual({ ok: true });

    expect(slot.info()).toMatchObject({ source: 'uploaded', bytes: 1000 });
  });
});

describe('createComponentSlot — the in-use refusal', () => {
  for (const code of ['EBUSY', 'EPERM', 'EACCES']) {
    it(`calls a first rename failing with ${code} in use, nothing moved`, async () => {
      // A conversion is holding the live `ffmpeg.exe` open. The refusal is the
      // whole answer — the family's film is not stopped by the maintainer's
      // drop — and that one failing syscall is all "is it in use?" ever means.
      const dir = slotWithUploaded(3, 5);
      const locked = lockedRename(code);
      const slot = slotOver(dir, { rename: locked.rename });
      const live = slot.current();

      expect((await stage(slot, 400, 600)).install()).toEqual({
        ok: false,
        reason: 'in-use',
      });

      expect(locked.attempts).toHaveLength(1);
      expect(existsSync(join(dir, 'incoming'))).toBe(false);
      expect(readFileSync(join(dir, 'current', `ffmpeg${EXE}`))).toHaveLength(
        3
      );
      expect(slot.info()).toMatchObject({ source: 'uploaded', bytes: 8 });
      expect(slot.current()).toBe(live);
    });
  }

  it('answers a full disk as failed, not as in use', async () => {
    // A full disk is not a lock, and answering the in-use line for it would
    // send the maintainer to stop a film that is not the problem. It is a
    // value rather than a throw — the rule the route depends on, since an
    // install that threw would be the one outcome it could not answer.
    const dir = slotWithUploaded(3, 5);
    const slot = slotOver(dir, { rename: lockedRename('ENOSPC').rename });
    const incoming = await stage(slot, 400, 600);

    expect(incoming.install()).toEqual({ ok: false, reason: 'failed' });
  });
});

// --- the remove half: the ✕ takes the upload back -----------------------------
//
// Phase 4. `remove()` is the inverse of the **Component swap**: the
// **Uploaded component** goes out of `current/` and the **Default component**
// is resolved again underneath it — which is the whole reason the default was
// never overwritten. On a machine that never had one, what comes back is
// `null`, and that is a state rather than a failure: MP4s still direct-play.
//
// Outcomes are values here too — `{ ok: true }`, or `nothing-uploaded` for a
// slot holding no upload to take back, or `in-use` for a pair a conversion is
// holding open. The **In-use refusal** is the same single failing rename the
// install classifies, asked of the one syscall that moved the live pair.

describe('createComponentSlot — the uploaded pair taken back', () => {
  it('falls back to the default component', () => {
    // The point of the fall-back: the installer's build is still there, so
    // the machine converts films a moment after the upload is gone.
    const installed = defaultPair(120, 80);
    const dir = slotWithUploaded(400, 600);
    const slot = slotOver(
      dir,
      {},
      { FAMILYFLIX_FFMPEG_PATH: ffmpegIn(installed) }
    );
    const uploaded = slot.current();

    expect(slot.remove()).toEqual({ ok: true });

    expect(slot.info()).toEqual({
      source: 'default',
      bytes: 200,
      files: [`ffmpeg${EXE}`, `ffprobe${EXE}`],
    });
    expect(slot.current()).not.toBe(uploaded);
    expect(slot.current()).not.toBeNull();
  });

  it('takes the pair out of the slot directory, leaving no staging behind', () => {
    const dir = slotWithUploaded(400, 600);

    expect(slotOver(dir).remove()).toEqual({ ok: true });

    expect(existsSync(join(dir, 'current', `ffmpeg${EXE}`))).toBe(false);
    expect(existsSync(join(dir, 'previous'))).toBe(false);
  });

  it('answers null on a machine whose only component was the upload', () => {
    // There is no default underneath: the **Component row** goes with the
    // pair, and the app is the reduced one it was before the drop.
    const slot = slotOver(slotWithUploaded(400, 600), {}, { PATH: '' });

    expect(slot.remove()).toEqual({ ok: true });

    expect(slot.current()).toBeNull();
    expect(slot.info()).toBeNull();
  });

  it('is not blocked by a previous/ a crash left behind', () => {
    const dir = slotWithUploaded(400, 600);
    mkdirSync(join(dir, 'previous'), { recursive: true });
    writeFileSync(join(dir, 'previous', `ffmpeg${EXE}`), Buffer.alloc(9, 1));

    expect(slotOver(dir).remove()).toEqual({ ok: true });

    expect(slotOver(dir).info()).toBeNull();
  });
});

describe('createComponentSlot — nothing to take back', () => {
  it('refuses to remove the default component', () => {
    // A fact about ownership rather than an error: the **Default component**
    // is the installer's, not the maintainer's to take away. The row that
    // offers no ✕ and the slot that refuses say the same thing.
    const installed = defaultPair(120, 80);
    const slot = slotOver(
      emptySlot(),
      {},
      {
        FAMILYFLIX_FFMPEG_PATH: ffmpegIn(installed),
      }
    );

    expect(slot.remove()).toEqual({ ok: false, reason: 'nothing-uploaded' });

    expect(slot.info()?.source).toBe('default');
  });

  it('refuses the same way on a machine with no component at all', () => {
    const slot = slotOver(emptySlot(), {}, { PATH: '' });

    expect(slot.remove()).toEqual({ ok: false, reason: 'nothing-uploaded' });

    expect(slot.current()).toBeNull();
  });
});

describe('createComponentSlot — a remove the lock refuses', () => {
  for (const code of ['EBUSY', 'EPERM', 'EACCES']) {
    it(`calls a rename failing with ${code} in use, the pair still live`, async () => {
      // A conversion is holding the live `ffmpeg.exe` open. The maintainer's
      // ✕ does not stop the family's film — the same refusal the drop gets,
      // off the same one failing syscall.
      const dir = slotWithUploaded(400, 600);
      const locked = lockedRename(code);
      const slot = slotOver(dir, { rename: locked.rename });
      const live = slot.current();

      expect(slot.remove()).toEqual({ ok: false, reason: 'in-use' });

      expect(locked.attempts).toHaveLength(1);
      expect(readFileSync(join(dir, 'current', `ffmpeg${EXE}`))).toHaveLength(
        400
      );
      expect(slot.info()).toMatchObject({ source: 'uploaded', bytes: 1000 });
      expect(slot.current()).toBe(live);
    });
  }

  it('answers a full disk as failed, not as in use', async () => {
    // A full disk is not a lock, and sending the maintainer to stop a film
    // that is not the problem would be worse than saying nothing useful. A
    // value, never a throw — the rule the install keeps, and the reason
    // nothing above the slot reasons about errno.
    const dir = slotWithUploaded(400, 600);
    const slot = slotOver(dir, { rename: lockedRename('ENOSPC').rename });

    expect(slot.remove()).toEqual({ ok: false, reason: 'failed' });
  });
});
