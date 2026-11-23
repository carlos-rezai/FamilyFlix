// @vitest-environment node
//
// 72 — Seamless art, Phase 1: "one backdrop, end to end" (issue #686).
//
// `Playback.fitArt(picture, width, format)`, beside `frame`, fits one picture
// to a width: the component the **Component slot** holds at the call, spawned
// over `fitArgs(width, format)` with the picture handed in as its stdin
// (`spawn(args, input)`), its stdout collected. It answers
// `{ kind: 'fitted', picture }` once the process exits `0`, and otherwise
// `{ kind: 'none', reason }`: `no-component` with an empty slot, `failed` on a
// non-zero exit (the process says how it ended through `exited`, its exit
// code, `null` once killed), and `timed-out` past the **Fit budget** (10 s),
// the process killed. A `none` always means the caller keeps the picture as
// it is. It never rejects.
//
// The last block runs real ffmpeg (the Default component, else one on PATH)
// over pictures it makes itself, and skips on a machine with none.

import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { pictureSize } from '../../media/pictureSize/pictureSize';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { pngBytes } from '../../test-support/pictureBytes/pictureBytes';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { EXE, ffmpegBinary } from '../ffmpegBinary/ffmpegBinary';
import {
  ffmpegComponent,
  type PlaybackComponent,
  type PlaybackProcess,
} from '../ffmpegComponent/ffmpegComponent';
import { fitArgs } from '../fitArgs/fitArgs';

import { createPlayback } from './createPlayback';

/** What the scripted component's process does once spawned. */
type Script =
  | { kind: 'fits'; bytes: Buffer }
  | { kind: 'exits'; code: number; bytes: Buffer }
  | { kind: 'hang' }
  | { kind: 'spawn-throws' };

/** One spawn the scripted component saw: its argv and the stdin it was handed. */
interface Spawned {
  args: string[];
  input: Buffer | undefined;
}

interface ScriptedComponent extends PlaybackComponent {
  spawned: Spawned[];
  killed: number;
}

const BACKDROP = pngBytes(3840, 2160);
const FITTED = Buffer.from('the fitted picture');

function scriptedComponent(script: Script): ScriptedComponent {
  const component: ScriptedComponent = {
    spawned: [],
    killed: 0,
    hardwareEncoder: null,
    decoders: () => null,
    probe: () => null,
    spawn: (args: string[], input?: Buffer): PlaybackProcess => {
      component.spawned.push({ args, input });
      if (script.kind === 'spawn-throws') {
        throw new Error('spawn ENOENT');
      }
      const stdout = new PassThrough();
      let exit: (code: number | null) => void = () => undefined;
      const exited = new Promise<number | null>((resolve) => {
        exit = resolve;
      });
      if (script.kind === 'fits') {
        stdout.end(script.bytes);
        setImmediate(() => exit(0));
      } else if (script.kind === 'exits') {
        stdout.end(script.bytes);
        setImmediate(() => exit(script.code));
      }
      return {
        stdout,
        exited,
        kill: () => {
          component.killed += 1;
          stdout.destroy();
          exit(null);
        },
      };
    },
  };
  return component;
}

const playbackOver = (component: PlaybackComponent | null) =>
  createPlayback(
    join(sandboxRoot('familyflix-fit-'), 'media'),
    fixedSlot(component),
    () => null
  );

afterEach(() => {
  vi.useRealTimers();
});

describe('createPlayback.fitArt: a fitted picture', () => {
  it("answers fitted with the component's output", async () => {
    const component = scriptedComponent({ kind: 'fits', bytes: FITTED });

    expect(await playbackOver(component).fitArt(BACKDROP, 1920, 'png')).toEqual(
      { kind: 'fitted', picture: FITTED }
    );
  });

  it('spawns fitArgs for the width and format, the picture on its stdin', async () => {
    const component = scriptedComponent({ kind: 'fits', bytes: FITTED });

    await playbackOver(component).fitArt(BACKDROP, 780, 'jpeg');

    expect(component.spawned).toHaveLength(1);
    expect(component.spawned[0].args).toEqual(fitArgs(780, 'jpeg'));
    expect(component.spawned[0].input).toEqual(BACKDROP);
  });
});

describe('createPlayback.fitArt: no fit', () => {
  it('answers no-component with an empty slot', async () => {
    expect(await playbackOver(null).fitArt(BACKDROP, 1920, 'png')).toEqual({
      kind: 'none',
      reason: 'no-component',
    });
  });

  it('answers failed on a non-zero exit, whatever it wrote', async () => {
    const component = scriptedComponent({
      kind: 'exits',
      code: 1,
      bytes: Buffer.from('half a picture'),
    });

    expect(await playbackOver(component).fitArt(BACKDROP, 1920, 'png')).toEqual(
      { kind: 'none', reason: 'failed' }
    );
  });

  it('answers failed, never rejecting, when the spawn throws', async () => {
    const component = scriptedComponent({ kind: 'spawn-throws' });

    await expect(
      playbackOver(component).fitArt(BACKDROP, 1920, 'png')
    ).resolves.toEqual({ kind: 'none', reason: 'failed' });
  });

  it('answers timed-out at the Fit budget (10 s), killing the process', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const component = scriptedComponent({ kind: 'hang' });

    const answer = playbackOver(component).fitArt(BACKDROP, 1920, 'png');
    let settled = false;
    void answer.then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(9_000);
    expect(settled).toBe(false);
    expect(component.killed).toBe(0);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await answer).toEqual({ kind: 'none', reason: 'timed-out' });
    expect(component.killed).toBeGreaterThan(0);
  });
});

// The Default component `electron:ffmpeg` extracts, when it is there, else
// one on PATH: the fit is proven against the binary the household will run.
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
  'createPlayback.fitArt: real ffmpeg',
  () => {
    /** One real picture of the size, made by the same binary the fit runs. */
    const realPicture = (codec: 'png' | 'mjpeg'): Buffer => {
      const binaries = realBinaries as NonNullable<typeof realBinaries>;
      return execFileSync(binaries.ffmpeg, [
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'lavfi',
        '-i',
        'testsrc=size=800x400:rate=1',
        '-frames:v',
        '1',
        '-f',
        'image2pipe',
        '-c:v',
        codec,
        'pipe:1',
      ]);
    };

    const realPlayback = () =>
      playbackOver(
        ffmpegComponent(realBinaries as NonNullable<typeof realBinaries>)
      );

    it('fits a PNG to the width, the height following, still a PNG', async () => {
      const outcome = await realPlayback().fitArt(
        realPicture('png'),
        400,
        'png'
      );

      if (outcome.kind !== 'fitted') throw new Error(outcome.reason);
      expect([...outcome.picture.subarray(0, 4)]).toEqual([
        0x89, 0x50, 0x4e, 0x47,
      ]);
      expect(pictureSize(outcome.picture)).toEqual({ width: 400, height: 200 });
    }, 30_000);

    it('fits a JPEG to the width, the height following, still a JPEG', async () => {
      const outcome = await realPlayback().fitArt(
        realPicture('mjpeg'),
        200,
        'jpeg'
      );

      if (outcome.kind !== 'fitted') throw new Error(outcome.reason);
      expect([...outcome.picture.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
      expect(pictureSize(outcome.picture)).toEqual({ width: 200, height: 100 });
    }, 30_000);
  }
);
