// @vitest-environment node
//
// 44 — Episode stills, Phase 2: "the grab" (issue #383).
//
// `Playback.frame(video, signal)` takes one picture out of a video: the file
// through `videoFile`, its duration off the file (the probe, then the MP4's own
// `mvhd`), and the component the **Component slot** holds at the call spawned
// over `frameArgs(file, duration × FRAME_POINT)` through the existing `spawn`
// seam. Its stdout is collected and answered as `{ kind: 'frame', picture }`.
//
// Issue #390: every case with no picture answers `{ kind: 'none', reason }`
// rather than a bare `null`, so the Sync can log why — `no-component`, a
// `missing` or `unreachable` video, `no-duration`, `timed-out` at the **Frame
// budget** (20 s), `aborted`, and `failed` for a grab that ran and gave
// nothing (an empty stdout, a spawn or stdout error) — killing the process
// wherever one runs. It never rejects (`derivedRuntime`'s rule).
//
// The last block runs real ffmpeg — the Default component, else one on PATH —
// over a multi-frame video it makes itself, and skips on a machine with none.

import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PassThrough, type Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { StoredVideo } from '@/types';

import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ComponentSlot } from '../componentSlot/componentSlot';
import { EXE, ffmpegBinary } from '../ffmpegBinary/ffmpegBinary';
import {
  ffmpegComponent,
  type PlaybackComponent,
  type PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';
import { FRAME_POINT, frameArgs } from '../frameArgs/frameArgs';
import type { MediaProbe } from '../probe/probe';

import { createPlayback, type FrameOutcome } from './createPlayback';

/** What the scripted component's stdout does once spawned. */
type Script =
  | { kind: 'bytes'; bytes: Buffer }
  | { kind: 'empty' }
  | { kind: 'hang' }
  | { kind: 'stdout-error' }
  | { kind: 'spawn-throws' };

/** A component that answers a fixed probe and plays a script on spawn. */
interface ScriptedComponent extends PlaybackComponent {
  spawned: string[][];
  killed: number;
}

const MATROSKA: MediaProbe = {
  container: 'matroska',
  videoCodec: 'h264',
  audioStreams: [
    { codec: 'ac3', language: null, title: null, isDefault: false },
  ],
  durationSeconds: 4102.5,
};

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);

function scriptedComponent(
  script: Script,
  probe: MediaProbe | null = MATROSKA
): ScriptedComponent {
  const component: ScriptedComponent = {
    spawned: [],
    killed: 0,
    hardwareEncoder: null,
    decoders: () => null,
    probe: () => probe,
    spawn: (args: string[]): PlaybackProcess => {
      component.spawned.push(args);
      if (script.kind === 'spawn-throws') {
        throw new Error('spawn ENOENT');
      }
      const stdout = new PassThrough();
      if (script.kind === 'bytes') {
        stdout.end(script.bytes);
      } else if (script.kind === 'empty') {
        stdout.end();
      } else if (script.kind === 'stdout-error') {
        setImmediate(() => stdout.destroy(new Error('EPIPE')));
      }
      return {
        stdout,
        kill: () => {
          component.killed += 1;
          stdout.destroy();
        },
      };
    },
  };
  return component;
}

/** A slot whose live component the test replaces between two calls. */
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

const FOLDER_ID = 'folder-1';

/** A media root holding one managed episode, and the Library folder path. */
function sandbox(contents: string | Buffer = 'episode bytes'): {
  media: string;
  folder: string;
  file: string;
  video: StoredVideo;
} {
  const root = sandboxRoot('familyflix-frame-');
  const media = join(root, 'media');
  const folder = join(root, 'Shows');
  mkdirSync(join(media, 'mr-robot-2015', 'season-01'), { recursive: true });
  mkdirSync(folder);
  const file = join(media, 'mr-robot-2015', 'season-01', 'S01E01.mkv');
  writeFileSync(file, contents);
  return {
    media,
    folder,
    file,
    video: {
      videoPath: 'mr-robot-2015/season-01/S01E01.mkv',
      videoFolderId: null,
    },
  };
}

/** The picture of a `frame` outcome, failing the test for a `none`. */
function pictureOf(outcome: FrameOutcome): Readable {
  if (outcome.kind !== 'frame') {
    throw new Error(`no frame: ${outcome.reason}`);
  }
  return outcome.picture;
}

async function bytesOf(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks);
}

const live = (): AbortSignal => new AbortController().signal;

afterEach(() => {
  vi.useRealTimers();
});

describe('createPlayback.frame — a picture', () => {
  it("answers the component's stdout as a stream", async () => {
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'bytes', bytes: JPEG });

    const frame = await createPlayback(
      media,
      fixedSlot(component),
      () => null
    ).frame(video, live());

    expect(frame.kind).toBe('frame');
    expect(await bytesOf(pictureOf(frame))).toEqual(JPEG);
  });

  it('spawns frameArgs over the file at a third of its duration', async () => {
    const { media, file, video } = sandbox();
    const component = scriptedComponent({ kind: 'bytes', bytes: JPEG });

    await createPlayback(media, fixedSlot(component), () => null).frame(
      video,
      live()
    );

    expect(component.spawned).toEqual([frameArgs(file, 4102.5 * FRAME_POINT)]);
  });

  it("reads the duration off the MP4's own header when the probe says nothing", async () => {
    const { media, video } = sandbox();
    copyFileSync(FIXTURE_VIDEO, join(media, video.videoPath));
    const component = scriptedComponent({ kind: 'bytes', bytes: JPEG }, null);

    const frame = await createPlayback(
      media,
      fixedSlot(component),
      () => null
    ).frame(video, live());

    expect(frame.kind).toBe('frame');
    expect(component.spawned).toHaveLength(1);
    const args = component.spawned[0];
    expect(Number(args[args.indexOf('-ss') + 1])).toBeCloseTo(10 / 3, 3);
  });

  it('uses the component the slot holds at the call, an uploaded one included', async () => {
    const { media, video } = sandbox();
    const { slot, put } = changingSlot();
    const first = scriptedComponent({ kind: 'bytes', bytes: JPEG });
    const uploaded = scriptedComponent({ kind: 'bytes', bytes: JPEG });
    const playback = createPlayback(media, slot, () => null);

    put(first);
    await playback.frame(video, live());
    put(uploaded);
    await playback.frame(video, live());

    expect(first.spawned).toHaveLength(1);
    expect(uploaded.spawned).toHaveLength(1);
  });
});

describe('createPlayback.frame — no frame before a process runs', () => {
  it('answers no-component with no component in the slot', async () => {
    const { media, file, video } = sandbox();
    copyFileSync(FIXTURE_VIDEO, file);

    expect(
      await createPlayback(media, fixedSlot(null), () => null).frame(
        video,
        live()
      )
    ).toEqual({ kind: 'none', reason: 'no-component' });
  });

  it('answers missing for a missing video, spawning nothing', async () => {
    const { media } = sandbox();
    const component = scriptedComponent({ kind: 'bytes', bytes: JPEG });

    expect(
      await createPlayback(media, fixedSlot(component), () => null).frame(
        { videoPath: 'gone/S09E09.mkv', videoFolderId: null },
        live()
      )
    ).toEqual({ kind: 'none', reason: 'missing' });
    expect(component.spawned).toEqual([]);
  });

  it('answers unreachable for a linked video whose Library folder is unreachable, spawning nothing', async () => {
    const { media, folder } = sandbox();
    const component = scriptedComponent({ kind: 'bytes', bytes: JPEG });
    const unplugged = join(folder, 'not-plugged-in');

    expect(
      await createPlayback(media, fixedSlot(component), (id) =>
        id === FOLDER_ID ? unplugged : null
      ).frame(
        { videoPath: 'Show/S01E01.mkv', videoFolderId: FOLDER_ID },
        live()
      )
    ).toEqual({ kind: 'none', reason: 'unreachable' });
    expect(component.spawned).toEqual([]);
  });

  it('answers no-duration with no duration, spawning nothing', async () => {
    // Not an MP4, and a probe that says nothing: no Frame point.
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'bytes', bytes: JPEG }, null);

    expect(
      await createPlayback(media, fixedSlot(component), () => null).frame(
        video,
        live()
      )
    ).toEqual({ kind: 'none', reason: 'no-duration' });
    expect(component.spawned).toEqual([]);
  });
});

describe('createPlayback.frame — no frame once a process runs, killing it', () => {
  it('answers failed for an empty stdout, killing the process', async () => {
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'empty' });

    expect(
      await createPlayback(media, fixedSlot(component), () => null).frame(
        video,
        live()
      )
    ).toEqual({ kind: 'none', reason: 'failed' });
    expect(component.killed).toBeGreaterThan(0);
  });

  it('answers timed-out at the Frame budget (20 s), killing the process', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'hang' });

    const answer = createPlayback(
      media,
      fixedSlot(component),
      () => null
    ).frame(video, live());
    let settled = false;
    void answer.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(19_000);
    expect(settled).toBe(false);
    expect(component.killed).toBe(0);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await answer).toEqual({ kind: 'none', reason: 'timed-out' });
    expect(component.killed).toBeGreaterThan(0);
  });

  it('answers aborted on abort, killing the process', async () => {
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'hang' });
    const controller = new AbortController();

    const answer = createPlayback(
      media,
      fixedSlot(component),
      () => null
    ).frame(video, controller.signal);
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();

    expect(await answer).toEqual({ kind: 'none', reason: 'aborted' });
    expect(component.killed).toBeGreaterThan(0);
  });

  it('answers aborted for a signal already aborted, leaving no process running', async () => {
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'hang' });
    const controller = new AbortController();
    controller.abort();

    expect(
      await createPlayback(media, fixedSlot(component), () => null).frame(
        video,
        controller.signal
      )
    ).toEqual({ kind: 'none', reason: 'aborted' });
    expect(component.killed).toBe(component.spawned.length);
  });
});

describe('createPlayback.frame — never rejects', () => {
  it('answers failed when the spawn throws', async () => {
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'spawn-throws' });

    await expect(
      createPlayback(media, fixedSlot(component), () => null).frame(
        video,
        live()
      )
    ).resolves.toEqual({ kind: 'none', reason: 'failed' });
  });

  it('answers failed when stdout errors, killing the process', async () => {
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'stdout-error' });

    await expect(
      createPlayback(media, fixedSlot(component), () => null).frame(
        video,
        live()
      )
    ).resolves.toEqual({ kind: 'none', reason: 'failed' });
    expect(component.killed).toBeGreaterThan(0);
  });

  it('answers no-duration when the probe throws and the file has no header to read', async () => {
    const { media, video } = sandbox();
    const component = scriptedComponent({ kind: 'bytes', bytes: JPEG });
    component.probe = () => {
      throw new Error('ffprobe died');
    };

    await expect(
      createPlayback(media, fixedSlot(component), () => null).frame(
        video,
        live()
      )
    ).resolves.toEqual({ kind: 'none', reason: 'no-duration' });
  });
});

// The Default component `electron:ffmpeg` extracts, when it is there: the
// build the Installer ships, so the grab is proven against the binary the
// household will run, not only whatever a developer has on PATH.
const DEFAULT_COMPONENT = join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  'electron',
  '.ffmpeg',
  `ffmpeg${EXE}`
);

const realBinaries = ffmpegBinary({
  FAMILYFLIX_FFMPEG_PATH: DEFAULT_COMPONENT,
  PATH: process.env.PATH ?? process.env.Path,
});

describe.skipIf(realBinaries === null)(
  'createPlayback.frame — real ffmpeg',
  () => {
    // The fixture film is one frame held for ten seconds, so a seek a third of
    // the way in finds nothing to decode. A real episode has a picture at
    // every point: six seconds of test pattern, a keyframe every second, is
    // made with the same binary the grab runs.
    it('answers a JPEG a third of the way into a multi-frame video', async () => {
      const binaries = realBinaries as NonNullable<typeof realBinaries>;
      const { media, video } = sandbox();
      execFileSync(binaries.ffmpeg, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=6:size=320x180:rate=24',
        '-pix_fmt',
        'yuv420p',
        '-g',
        '24',
        '-f',
        'matroska',
        join(media, video.videoPath),
      ]);

      const frame = await createPlayback(
        media,
        fixedSlot(ffmpegComponent(binaries)),
        () => null
      ).frame(video, live());

      expect(frame.kind).toBe('frame');
      const bytes = await bytesOf(pictureOf(frame));
      expect(bytes.length).toBeGreaterThan(100);
      expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    }, 30_000);
  }
);
