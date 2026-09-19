// @vitest-environment node
//
// 16 — Playback component upload, Phase 1: "the slot resolves what is live,
// and it has a row" (issue #152).
//
// The **Component slot**: the writable directory an **Uploaded component**
// lives in, and the object over it. This phase is its **read** half —
// `current()`, the component the player actually converts with, and `info()`,
// what the **Component row** draws.
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

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  EXE,
  componentDir,
  ffmpegIn,
} from '../../test-support/componentDir/componentDir';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

import { createComponentSlot } from './componentSlot';

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
