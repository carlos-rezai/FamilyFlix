// @vitest-environment node
//
// 10 — Video player refactor, Group F: the four playback modules nothing named
// (issue #94).
//
// How long a film runs, read from the container's own header. This is the one
// of the four the dev journal singles out — "A 32-bit duration of all ones is
// the container saying it does not know, which is not a film that runs for 49
// days" — and nothing asserted that rule until now.
//
// Nothing here spawns anything, which is the property CI depends on. The
// fixtures are the bytes an MP4 actually carries, written to a file in a
// temporary directory: box headers and an `mvhd`, hand-built, because what is
// being asked is what this parser does with a given header and not whether some
// encoder on this machine produces one.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

import { mediaDuration } from './mediaDuration';

/** One ISO base media box: a 32-bit size, a four-letter type, the payload. */
function box(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
}

/**
 * A version-0 movie header: 32-bit times. `timescale` is units per second and
 * `duration` is the film's length in those units, which is why a film is
 * 4099500/600 seconds rather than a number anybody wrote down.
 */
function mvhdV0(timescale: number, duration: number): Buffer {
  const payload = Buffer.alloc(100);
  payload.writeUInt8(0, 0);
  payload.writeUInt32BE(timescale, 12);
  payload.writeUInt32BE(duration, 16);
  return box('mvhd', payload);
}

/**
 * A version-1 movie header: 64-bit creation, modification and duration.
 * `BigInt(…)` rather than an `n` literal — the server target is below ES2020.
 */
function mvhdV1(timescale: number, duration: bigint): Buffer {
  const payload = Buffer.alloc(108);
  payload.writeUInt8(1, 0);
  payload.writeUInt32BE(timescale, 20);
  payload.writeBigUInt64BE(duration, 24);
  return box('mvhd', payload);
}

/** Write the bytes to a file nobody else shares, and answer its path. */
function fileOf(...parts: Buffer[]): string {
  const path = join(sandboxRoot('familyflix-duration-'), 'film.mp4');
  writeFileSync(path, Buffer.concat(parts));
  return path;
}

/** What every real MP4 opens with, ahead of the `moov` this parser wants. */
const FTYP = box(
  'ftyp',
  Buffer.concat([
    Buffer.from('isom', 'latin1'),
    Buffer.from([0x00, 0x00, 0x02, 0x00]),
    Buffer.from('isomiso2avc1mp41', 'latin1'),
  ])
);

describe('mediaDuration — the film’s own length', () => {
  it('answers the seconds a version-0 header reports', () => {
    const file = fileOf(FTYP, box('moov', mvhdV0(600, 4_099_500)));

    // 600 units per second, 4,099,500 units: 1h53m52.5s.
    expect(mediaDuration(file)).toBe(6832.5);
  });

  it('answers the seconds a version-1 header reports', () => {
    const file = fileOf(FTYP, box('moov', mvhdV1(90_000, BigInt(614_925_000))));

    expect(mediaDuration(file)).toBe(6832.5);
  });

  it('finds the header when the moov is the first box in the file', () => {
    const file = fileOf(box('moov', mvhdV0(1000, 90_000)));

    expect(mediaDuration(file)).toBe(90);
  });

  it('walks past boxes it has no use for to reach the moov', () => {
    const file = fileOf(
      FTYP,
      box('free', Buffer.alloc(64)),
      box('mdat', Buffer.alloc(256)),
      box('moov', mvhdV0(1000, 30_000))
    );

    expect(mediaDuration(file)).toBe(30);
  });

  it('walks past boxes inside the moov to reach the mvhd', () => {
    const file = fileOf(
      FTYP,
      box('moov', Buffer.concat([box('udta', Buffer.alloc(16)), mvhdV0(1, 42)]))
    );

    expect(mediaDuration(file)).toBe(42);
  });
});

describe('mediaDuration — a length that would be a lie', () => {
  it('answers null for the 32-bit all-ones sentinel rather than 49 days', () => {
    // The container saying it does not know. Taken at face value against a
    // timescale of 1000 this is 49.7 days, and a scrubber drawn from it would
    // put a two-hour film in its first pixel.
    const file = fileOf(FTYP, box('moov', mvhdV0(1000, 0xffffffff)));

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null when the header reports no timescale', () => {
    // Dividing by it is the next thing that would happen.
    const file = fileOf(FTYP, box('moov', mvhdV0(0, 90_000)));

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null for a film of no length', () => {
    const file = fileOf(FTYP, box('moov', mvhdV0(1000, 0)));

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null for a header version it does not know', () => {
    const payload = Buffer.alloc(100);
    payload.writeUInt8(7, 0);
    const file = fileOf(FTYP, box('moov', box('mvhd', payload)));

    expect(mediaDuration(file)).toBeNull();
  });
});

describe('mediaDuration — files that will not say', () => {
  it('answers null when there is no moov at all', () => {
    const file = fileOf(FTYP, box('mdat', Buffer.alloc(128)));

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null when the moov holds no mvhd', () => {
    const file = fileOf(FTYP, box('moov', box('udta', Buffer.alloc(32))));

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null when the file stops mid-box', () => {
    // A moov header promising 4KB, followed by nothing — a copy that was
    // interrupted, which is a thing a family library really has in it.
    const truncated = Buffer.alloc(8);
    truncated.writeUInt32BE(4096, 0);
    truncated.write('moov', 4, 'latin1');
    const file = fileOf(FTYP, truncated);

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null when the mvhd stops mid-field', () => {
    const file = fileOf(FTYP, box('moov', box('mvhd', Buffer.alloc(12))));

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null for a file that is not this format at all', () => {
    const file = fileOf(Buffer.from('Matroska, actually', 'latin1'));

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null for an empty file', () => {
    const file = fileOf(Buffer.alloc(0));

    expect(mediaDuration(file)).toBeNull();
  });

  it('answers null for a file that will not open at all', () => {
    const missing = join(sandboxRoot('familyflix-duration-'), 'gone.mp4');

    expect(mediaDuration(missing)).toBeNull();
  });
});
