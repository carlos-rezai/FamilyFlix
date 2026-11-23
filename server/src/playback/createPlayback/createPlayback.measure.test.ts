// @vitest-environment node
//
// 70 — Video quality, Phase 1: "one film, through the Movie form" (issue #664).
//
// `measure` replaces `duration`: how long the film runs and its rung of the
// **Quality ladder**, from one ffprobe call. The duration keeps its MP4 `mvhd`
// fallback for a machine with no component; the quality has no header
// fallback, so a film only the header could measure has a runtime and no rung.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../probe/probe';

import { createPlayback } from './createPlayback';

/** A widescreen 1080p MKV: 1920 wide, cropped to 800 high. */
const WIDESCREEN: MediaProbe = {
  container: 'matroska',
  videoCodec: 'h264',
  frameSize: { width: 1920, height: 800 },
  audioStreams: [
    { codec: 'aac', language: null, title: null, isDefault: false },
  ],
  durationSeconds: 4102.5,
};

/** A component that answers a fixed probe through a spy. */
function fakeComponent(probe: MediaProbe | null): PlaybackComponent & {
  probe: ReturnType<typeof vi.fn>;
} {
  return {
    hardwareEncoder: null,
    decoders: () => null,
    probe: vi.fn(() => probe),
    spawn: (): PlaybackProcess => ({
      stdout: Readable.from([]),
      exited: Promise.resolve(0),
      kill: () => undefined,
    }),
  };
}

/** A managed media directory with the named file in it, and its path. */
function mediaWith(
  relativePath: string,
  contents: string | Buffer = 'film bytes'
): { media: string; file: string } {
  const media = sandboxRoot('familyflix-measure-');
  const file = join(media, relativePath);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, contents);
  return { media, file };
}

describe('createPlayback — measuring a film', () => {
  it('answers the duration and the quality from one probe', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent(WIDESCREEN);

    expect(
      createPlayback(media, fixedSlot(component), () => null).measure(file)
    ).toEqual({ durationSeconds: 4102.5, quality: '1080p' });
    expect(component.probe).toHaveBeenCalledTimes(1);
  });

  it('answers a null quality for a picture that will not say its size', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent({ ...WIDESCREEN, frameSize: null });

    expect(
      createPlayback(media, fixedSlot(component), () => null).measure(file)
    ).toEqual({ durationSeconds: 4102.5, quality: null });
  });

  it('still reads the duration off the mvhd header with no component, and no quality', () => {
    const { media, file } = mediaWith(
      'Northwind (2018)/northwind.mp4',
      mp4Of(600, 4_099_500)
    );

    expect(
      createPlayback(media, fixedSlot(null), () => null).measure(file)
    ).toEqual({ durationSeconds: 6832.5, quality: null });
  });

  it('answers a null duration and quality when nothing can say', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(
      createPlayback(media, fixedSlot(null), () => null).measure(file)
    ).toEqual({ durationSeconds: null, quality: null });
  });

  it('no longer offers duration, which measure replaces', () => {
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(
      'duration' in createPlayback(media, fixedSlot(null), () => null)
    ).toBe(false);
  });
});

/** The bytes of an MP4 whose `mvhd` reports a length. */
function mp4Of(timescale: number, duration: number): Buffer {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt8(0, 0);
  mvhd.writeUInt32BE(timescale, 12);
  mvhd.writeUInt32BE(duration, 16);

  return Buffer.concat([
    box('ftyp', Buffer.from('isom')),
    box('moov', box('mvhd', mvhd)),
  ]);
}

/** One ISO base media box: a 32-bit size, a four-letter type, the payload. */
function box(type: string, payload: Buffer): Buffer {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + payload.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, payload]);
}
