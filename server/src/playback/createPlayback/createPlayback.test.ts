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
//
// ---
//
// 12 — Movie form, Phase 6: "the runtime, derived" (issue #107) added the fifth,
// which is a method rather than a rule: `duration` asks the same two sources
// `read` asks and answers `null` where `read` answers a path with a nought on
// it. A film this machine cannot decode still has a length, and the runtime
// column is allowed to know it.
//
// ---
//
// 16 — Playback component upload, Phase 1: "the slot resolves what is live,
// and it has a row" (issue #152) changes what the domain is composed over. It
// is handed a **Component slot** rather than a component, and reads
// `slot.current()` inside `decide`, `duration` and `stream` — so a component
// swapped while the app runs is honoured by the next Play with nothing to
// invalidate. Every case below reaches it through `fixedSlot`, the double that
// answers one component and refuses to receive or remove; the cases that are
// *about* the swap use a slot whose component the test replaces between two
// calls. `capabilities()` assembles `{ component: slot.info(), codecs }`, so
// the `component` half is what the slot says rather than a boolean.
//
// 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143) added the sixth,
// `capabilities()`: what `capabilities` answers over the component this domain
// was composed with, so the route reads the one `main.ts` composed and never
// resolves a binary of its own. The fake gains `decoders()` — what
// `ffmpeg -decoders` would have printed — and answers `null` unless a test
// says otherwise.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ComponentSlot } from '../componentSlot/componentSlot';
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

function fakeComponent(
  probe: MediaProbe | null,
  decoders: string | null = null
): FakeComponent {
  const component: FakeComponent = {
    spawned: [],
    hardwareEncoder: null,
    decoders: () => decoders,
    probe: () => probe,
    spawn: (args: string[]): PlaybackProcess => {
      component.spawned.push(args);
      return { stdout: Readable.from([]), kill: () => undefined };
    },
  };
  return component;
}

/**
 * A **Component slot** whose live component the test replaces between two
 * calls — the machine an upload or a remove happened on while the app ran.
 * It receives and removes nothing: what is being asked here is what the domain
 * does with whatever `current()` says now.
 */
function changingSlot(): {
  slot: ComponentSlot;
  put(next: PlaybackComponent | null): void;
} {
  let live: PlaybackComponent | null = null;
  const refuse = (): never => {
    throw new Error('the changing slot neither receives nor removes');
  };

  return {
    slot: {
      current: () => live,
      info: () =>
        live === null
          ? null
          : { source: 'uploaded', bytes: 1000, files: ['ffmpeg', 'ffprobe'] },
      receive: refuse,
      remove: refuse,
    },
    put: (next) => {
      live = next;
    },
  };
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
      createPlayback(media, fixedSlot(null)).videoFile(
        'Northwind (2018)/northwind.mkv'
      )
    ).toBe(file);
  });

  it('answers null for a file that is not there', () => {
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(
      createPlayback(media, fixedSlot(null)).videoFile('Gone/gone.mkv')
    ).toBeNull();
  });

  it('answers null for a stored path that leaves the tree', () => {
    // A row is trusted no further than a URL would be.
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(
      createPlayback(media, fixedSlot(null)).videoFile(
        '../elsewhere/secrets.mkv'
      )
    ).toBeNull();
  });

  it('resolves a subtitle by the same rule, on a row from a different table', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.srt', '');
    const playback = createPlayback(media, fixedSlot(null));

    expect(playback.subtitleFile('Northwind (2018)/northwind.srt')).toBe(file);
    expect(playback.subtitleFile('../elsewhere/notes.srt')).toBeNull();
  });
});

describe('createPlayback — the read, and a length that is not there', () => {
  it('answers the path and the length the probe reported', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(
      createPlayback(media, fixedSlot(fakeComponent(MATROSKA))).read(file)
    ).toEqual({
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

    expect(createPlayback(media, fixedSlot(component)).read(file)).toEqual({
      path: 'cannot-play',
      durationSeconds: 0,
    });
  });

  it('answers cannot-play with no duration at all, never a path with none', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    // No component: an MKV is not something Chromium reads, and there is
    // nothing here that could convert it.
    expect(createPlayback(media, fixedSlot(null)).read(file)).toEqual({
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

    expect(createPlayback(media, fixedSlot(null)).read(file)).toEqual({
      path: 'direct',
      durationSeconds: 6832.5,
    });
  });

  it('decides afresh rather than remembering, so a new component changes the answer', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(createPlayback(media, fixedSlot(null)).read(file).path).toBe(
      'cannot-play'
    );
    expect(
      createPlayback(media, fixedSlot(fakeComponent(MATROSKA))).read(file).path
    ).toBe('transcode');
  });
});

describe('createPlayback — the duration, derived best-effort', () => {
  it('answers the seconds the probe reported', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(
      createPlayback(media, fixedSlot(fakeComponent(MATROSKA))).duration(file)
    ).toBe(4102.5);
  });

  it('reads the container’s own header when there is no component to probe', () => {
    // The machine with no FFmpeg on it, reading the one format it can parse
    // unaided — which is what lets a family who have not run the installer yet
    // still get a runtime for most of the folder.
    const { media, file } = mediaWith(
      'Northwind (2018)/northwind.mp4',
      mp4Of(600, 4_099_500)
    );

    expect(createPlayback(media, fixedSlot(null)).duration(file)).toBe(6832.5);
  });

  it('falls back to the header when the probe answered no duration', () => {
    // The whole reason this is a method of its own rather than `read`'s
    // `durationSeconds`: a probe that came back saying nothing about the length
    // has not exhausted the ways of asking, and `read` would have collapsed the
    // film to `cannot-play` with a nought on it.
    const { media, file } = mediaWith(
      'Northwind (2018)/northwind.mp4',
      mp4Of(600, 4_099_500)
    );
    const component = fakeComponent({ ...NATIVE, durationSeconds: 0 });

    expect(createPlayback(media, fixedSlot(component)).duration(file)).toBe(
      6832.5
    );
  });

  it('answers null, never nought, when neither can say', () => {
    // Nought is a length. Null is the absence of one, and the runtime column
    // this feeds draws a dash from it — which is the difference between the
    // catalogue not knowing how long a film is and it claiming the film is
    // instantaneous.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(createPlayback(media, fixedSlot(null)).duration(file)).toBeNull();
  });
});

describe('createPlayback — the stream, and the second the film does not have', () => {
  it('sends a native file as it is, spawning nothing', () => {
    const { media, file } = mediaWith(
      'Northwind (2018)/northwind.mp4',
      mp4Of(600, 4_099_500)
    );
    const component = fakeComponent(NATIVE);

    expect(createPlayback(media, fixedSlot(component)).stream(file)).toEqual({
      path: 'direct',
    });
    expect(component.spawned).toEqual([]);
  });

  it('starts a conversion for a film that needs one', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent(MATROSKA);

    const plan = createPlayback(media, fixedSlot(component)).stream(file);

    expect(plan.path).toBe('converted');
    expect(component.spawned).toHaveLength(1);
  });

  it('refuses a second past the end before the spawn, not after it', () => {
    // A conversion started over an unreachable second reads to the end, writes
    // no frames and never exits on its own. Nothing must be started.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent(MATROSKA);

    expect(
      createPlayback(media, fixedSlot(component)).stream(file, 4102.6)
    ).toEqual({
      path: 'past-end',
    });
    expect(component.spawned).toEqual([]);
  });

  it('does not treat the film’s very last second as past it', () => {
    // A **Scrubber** dragged to the far end asks for exactly the duration, and
    // refusing that would break the commonest scrub there is.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent(MATROSKA);

    expect(
      createPlayback(media, fixedSlot(component)).stream(file, 4102.5).path
    ).toBe('converted');
  });

  it('answers cannot-play rather than asking a component that is not there', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');

    expect(createPlayback(media, fixedSlot(null)).stream(file)).toEqual({
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

    expect(createPlayback(media, fixedSlot(null)).cues(file)).toEqual([
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

    expect(createPlayback(media, fixedSlot(null)).cues(file)).toEqual([]);
  });

  it('answers an empty list for a file that vanished before the read', () => {
    const { media } = mediaWith('Northwind (2018)/northwind.srt', '');

    expect(
      createPlayback(media, fixedSlot(null)).cues(join(media, 'gone.srt'))
    ).toEqual([]);
  });
});

/** What `ffmpeg -decoders` prints, trimmed to the lines these tests read. */
const DECODERS = [
  'Decoders:',
  ' V..... = Video',
  ' A..... = Audio',
  ' ------',
  ' VFS..D h264                 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
  ' VFS..D hevc                 HEVC (High Efficiency Video Coding)',
  ' A....D ac3                  ATSC A/52A (AC-3)',
].join('\n');

describe('createPlayback — the capabilities, assembled over the slot', () => {
  it('reports no component and the native rows alone for a slot holding none', () => {
    const { media } = mediaWith('Northwind (2018)/northwind.mp4');

    const reported = createPlayback(media, fixedSlot(null)).capabilities();

    expect(reported.component).toBeNull();
    expect(reported.codecs.length).toBeGreaterThan(0);
    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
    expect(reported.codecs.map((entry) => entry.codec)).toContain('h264');
  });

  it('reports the component and what its decoders add when composed over one', () => {
    // The rule this group exists for: the report is a property of the
    // component the player uses, so what Settings lists and what pressing
    // Play does cannot disagree.
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');

    const reported = createPlayback(
      media,
      fixedSlot(fakeComponent(MATROSKA, DECODERS))
    ).capabilities();

    expect(reported.component).not.toBeNull();
    expect(reported.codecs).toContainEqual({
      codec: 'hevc',
      kind: 'video',
      support: 'via-component',
    });
    expect(reported.codecs).toContainEqual({
      codec: 'ac3',
      kind: 'audio',
      support: 'via-component',
    });
    expect(
      reported.codecs.filter((entry) => entry.codec === 'h264')
    ).toHaveLength(1);
  });

  it('reports the component present over the native rows when it will not say', () => {
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');

    const reported = createPlayback(
      media,
      fixedSlot(fakeComponent(MATROSKA, null))
    ).capabilities();

    expect(reported.component).not.toBeNull();
    expect(reported.codecs.every((entry) => entry.support === 'native')).toBe(
      true
    );
  });

  it('answers the component the slot describes, whatever it describes', () => {
    // The `component` half of the report is the slot's answer rather than
    // anything `capabilities` could know: where the live component came from,
    // what the pair weighs, and what its two files are called. It is what the
    // **Component row** draws.
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');
    const info = {
      source: 'uploaded' as const,
      bytes: 98_765_432,
      files: ['ffmpeg.exe', 'ffprobe.exe'],
    };

    const reported = createPlayback(
      media,
      fixedSlot(fakeComponent(MATROSKA, DECODERS), info)
    ).capabilities();

    expect(reported.component).toEqual(info);
  });

  it('asks the component afresh on every read', () => {
    // Nothing is memoised: the day the upload initiative replaces the live
    // component, the next read must describe the new one.
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');
    const component = fakeComponent(MATROSKA, DECODERS);
    const asked = vi.spyOn(component, 'decoders');
    const playback = createPlayback(media, fixedSlot(component));

    playback.capabilities();
    playback.capabilities();

    expect(asked).toHaveBeenCalledTimes(2);
  });
});

describe('createPlayback — deciding over the slot at the time of the call', () => {
  it('answers cannot-play, then converted, for the same file', () => {
    // The whole of what the change is for: a component installed from Settings
    // while the app runs is honoured by the next press of Play, with nothing
    // to invalidate and no restart. The domain closed over a component could
    // not do this — it would answer the startup machine for the rest of the
    // evening.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const slot = changingSlot();
    const playback = createPlayback(media, slot.slot);

    expect(playback.stream(file)).toEqual({ path: 'cannot-play' });

    slot.put(fakeComponent(MATROSKA));

    expect(playback.stream(file).path).toBe('converted');
  });

  it('reads the film again over whatever the slot holds now', () => {
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const slot = changingSlot();
    const playback = createPlayback(media, slot.slot);

    expect(playback.read(file)).toEqual({
      path: 'cannot-play',
      durationSeconds: 0,
    });

    slot.put(fakeComponent(MATROSKA));

    expect(playback.read(file)).toEqual({
      path: 'transcode',
      durationSeconds: 4102.5,
    });
  });

  it('derives the runtime over whatever the slot holds now', () => {
    // The form's save and the importer both ask `duration`, and a film
    // imported after the upload must get the length the new component can
    // read off it.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const slot = changingSlot();
    const playback = createPlayback(media, slot.slot);

    expect(playback.duration(file)).toBeNull();

    slot.put(fakeComponent(MATROSKA));

    expect(playback.duration(file)).toBe(4102.5);
  });

  it('falls back to cannot-play when the slot loses its component', () => {
    // The other direction: a remove puts the machine back, and the next Play
    // says so rather than spawning a conversion through a binary that is gone.
    const { media, file } = mediaWith('Northwind (2018)/northwind.mkv');
    const slot = changingSlot();
    slot.put(fakeComponent(MATROSKA));
    const playback = createPlayback(media, slot.slot);

    expect(playback.stream(file).path).toBe('converted');

    slot.put(null);

    expect(playback.stream(file)).toEqual({ path: 'cannot-play' });
  });
});

describe('createPlayback — the slot’s write half, forwarded', () => {
  it('hands back the incoming component the slot answered', () => {
    // Phase 2 of `16-component-upload`. `receiveComponent` is deliberately
    // thin over the slot: the upload route reaches the **Component slot**
    // through the `playback` the router already holds, so nothing new is
    // injected into `createApiRouter` and no route learns there is a staging
    // directory behind any of it.
    const { media } = mediaWith('Northwind (2018)/northwind.mkv');
    const incoming = {
      take: () => Promise.resolve(),
      install: () => ({ ok: true }) as const,
      discard: () => undefined,
    };
    const slot: ComponentSlot = {
      current: () => null,
      info: () => null,
      receive: () => incoming,
      remove: () => {
        throw new Error('the receiving slot does not remove');
      },
    };

    expect(createPlayback(media, slot).receiveComponent()).toBe(incoming);
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
