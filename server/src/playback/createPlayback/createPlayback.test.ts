// @vitest-environment node
//
// 10 — Video player refactor, Group F: the four playback modules nothing named
// (issue #94).
//
// The injected domain itself. It is exercised end-to-end through
// `routes.test.ts`, which is real coverage — but its contract is stated in a
// docblock and asserted only as a side effect of HTTP, so the rules that are
// *its own* rather than a route's had nowhere to be read.
//
// Those are the four: a present file whose length nothing can determine answers
// `cannot-play` and not a duration of nought; `stream` refuses an offset past
// the end **before** the spawn rather than after it; the film's very last
// second is not past it; and a subtitle file that will not parse answers `[]`
// and never throws.
//
// Nothing here spawns anything. The component is a fake, which is the seam the
// whole slice was built around.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type {
  PlaybackComponent,
  PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';
import type { MediaProbe } from '../probe/probe';

import { createPlayback } from './createPlayback';

/**
 * An MKV of H.264 and AC-3: the film that needs the component. The video
 * stream is one Chromium reads and the audio is not, so this is a
 * **Transcode** rather than a remux.
 */
const MATROSKA: MediaProbe = {
  container: 'matroska',
  videoCodec: 'h264',
  audioCodec: 'ac3',
  durationSeconds: 4102.5,
};

/** An MP4 of H.264 and AAC: **Direct play**, component installed or not. */
const NATIVE: MediaProbe = {
  container: 'mp4',
  videoCodec: 'h264',
  audioCodec: 'aac',
  durationSeconds: 6832.5,
};

/** A component that answers a fixed probe and records what it was asked. */
interface FakeComponent extends PlaybackComponent {
  spawned: string[][];
}

function fakeComponent(probe: MediaProbe | null): FakeComponent {
  const component: FakeComponent = {
    spawned: [],
    hardwareEncoder: null,
    probe: () => probe,
    spawn: (args: string[]): PlaybackProcess => {
      component.spawned.push(args);
      return { stdout: Readable.from([]), kill: () => undefined };
    },
  };
  return component;
}

/** A managed media directory with the named file in it, and its path. */
function mediaWith(
  relativePath: string,
  contents: string | Buffer = 'film bytes'
): { media: string; file: string } {
  const media = sandboxRoot('familyflix-playback-');
  const file = join(media, relativePath);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, contents);
  return { media, file };
}

describe('createPlayback — resolving a stored path', () => {
  it('answers the absolute file under the managed media directory', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(
      createPlayback(media, null).videoFile('Northwind (2018)/northwind.mkv')
    ).toBe(file);
  });

  it('answers null for a file that is not there', () => {
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(createPlayback(media, null).videoFile('Gone/gone.mkv')).toBeNull();
  });

  it('answers null for a stored path that leaves the tree', () => {
    // A row is trusted no further than a URL would be.
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(
      createPlayback(media, null).videoFile('../elsewhere/secrets.mkv')
    ).toBeNull();
  });

  it('resolves a subtitle by the same rule, on a row from a different table', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.srt', '');
    const playback = createPlayback(media, null);

    expect(playback.subtitleFile('Northwind (2018)/northwind.srt')).toBe(file);
    expect(playback.subtitleFile('../elsewhere/notes.srt')).toBeNull();
  });
});

describe('createPlayback — the read, and a length that is not there', () => {
  it('answers the path and the length the probe reported', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(createPlayback(media, fakeComponent(MATROSKA)).read(file)).toEqual({
      path: 'transcode',
      durationSeconds: 4102.5,
    });
  });

  it('answers cannot-play for a film whose length nothing can determine', () => {
    // The rule this test exists for. The file is there and the path is
    // decidable — a native MP4 that would direct-play — but a duration of
    // nought is what a seek clamps against and what the finish threshold is a
    // percentage of, so a player handed it has nothing to work from.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mp4');
    const component = fakeComponent({ ...NATIVE, durationSeconds: 0 });

    expect(createPlayback(media, component).read(file)).toEqual({
      path: 'cannot-play',
      durationSeconds: 0,
    });
  });

  it('answers cannot-play with no duration at all, never a path with none', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    // No component: an MKV is not something Chromium reads, and there is
    // nothing here that could convert it.
    expect(createPlayback(media, null).read(file)).toEqual({
      path: 'cannot-play',
      durationSeconds: 0,
    });
  });

  it('reads the container’s own header when there is no component to probe', () => {
    // The machine with no FFmpeg on it, reading the one format it can parse
    // unaided — which is the state the PRD makes first-class.
    const { media, file } = mediaWith(
      'Northwind (2018)/northwind.mp4',
      mp4Of(600, 4_099_500)
    );

    expect(createPlayback(media, null).read(file)).toEqual({
      path: 'direct',
      durationSeconds: 6832.5,
    });
  });

  it('decides afresh rather than remembering, so a new component changes the answer', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(createPlayback(media, null).read(file).path).toBe('cannot-play');
    expect(createPlayback(media, fakeComponent(MATROSKA)).read(file).path).toBe(
      'transcode'
    );
  });
});

describe('createPlayback — the stream, and the second the film does not have', () => {
  it('sends a native file as it is, spawning nothing', () => {
    const { media, file } = mediaWith(
      'Northwind (2018)/northwind.mp4',
      mp4Of(600, 4_099_500)
    );
    const component = fakeComponent(NATIVE);

    expect(createPlayback(media, component).stream(file)).toEqual({
      path: 'direct',
    });
    expect(component.spawned).toEqual([]);
  });

  it('starts a conversion for a film that needs one', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent(MATROSKA);

    const plan = createPlayback(media, component).stream(file);

    expect(plan.path).toBe('converted');
    expect(component.spawned).toHaveLength(1);
  });

  it('refuses a second past the end before the spawn, not after it', () => {
    // A conversion started over an unreachable second reads to the end, writes
    // no frames and never exits on its own. Nothing must be started.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent(MATROSKA);

    expect(createPlayback(media, component).stream(file, 4102.6)).toEqual({
      path: 'past-end',
    });
    expect(component.spawned).toEqual([]);
  });

  it('does not treat the film’s very last second as past it', () => {
    // A **Scrubber** dragged to the far end asks for exactly the duration, and
    // refusing that would break the commonest scrub there is.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent(MATROSKA);

    expect(createPlayback(media, component).stream(file, 4102.5).path).toBe(
      'converted'
    );
  });

  it('answers cannot-play rather than asking a component that is not there', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(createPlayback(media, null).stream(file)).toEqual({
      path: 'cannot-play',
    });
  });
});

describe('createPlayback — the cues, and the file that will not parse', () => {
  it('parses a subtitle file into absolute-position cues', () => {
    const { media, file } = mediaWith(
      'Northwind (2018)/northwind.srt',
      '1\n00:00:01,000 --> 00:00:03,500\nGood evening.\n'
    );

    expect(createPlayback(media, null).cues(file)).toEqual([
      { start: 1, end: 3.5, text: 'Good evening.' },
    ]);
  });

  it('answers an empty list for a file that will not parse, and never throws', () => {
    // The row was there and the file was there, so there is nothing missing to
    // report: the film plays on with no subtitles, and a malformed file stays
    // distinguishable from a deleted one.
    const { media, file } = mediaWith(
      'Northwind (2018)/northwind.srt',
      'this is not a subtitle file'
    );

    expect(createPlayback(media, null).cues(file)).toEqual([]);
  });

  it('answers an empty list for a file that vanished before the read', () => {
    const { media } = mediaWith('Northwind (2018)/northwind.srt', '');

    expect(createPlayback(media, null).cues(join(media, 'gone.srt'))).toEqual(
      []
    );
  });
});

/**
 * The bytes of an MP4 that reports a length: `ftyp`, then a `moov` holding a
 * version-0 `mvhd`. Hand-built for the same reason `mediaDuration`'s fixtures
 * are — what is being asked is what the parser does with a header, not what
 * some encoder on this machine produces.
 */
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
