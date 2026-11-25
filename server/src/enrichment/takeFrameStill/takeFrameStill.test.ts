// @vitest-environment node
//
// 76, Whole add, Phase 5 (issue #720): one Frame still, taken and stored.
//
// `takeFrameStill` is the one place a **Frame still** is named: it asks
// `playback.frame` for a picture of the episode's own video and stores it as
// `<stem>.frame.jpg` in the **Series folder**'s `season-NN/`. It is lifted
// out of the Sync's episode writer, so the Sync and the **Frame fill** share
// it. It answers what became of the take: `stored` with the name and the
// **Stored path**, `none` with the reason no picture came (or `aborted` once
// the signal is), or `unstored` when the picture could not be written. The
// Series folder is asked for only once a picture is in hand, so a take that
// gets none reserves nothing.
//
// Over a real `Media` on a sandbox root and a scripted `frame`.

import { readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import type { StoredVideo } from '@/types';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { takeFrameStill } from './takeFrameStill';

type Frame = Playback['frame'];

const FRAME_BYTES = 'a frame off the video';

const pictured: Frame = async () => ({
  kind: 'frame',
  picture: Readable.from([Buffer.from(FRAME_BYTES)]),
});

/** An episode of a copied show: its video in the Series folder. */
const COPIED = {
  videoPath: 'The Hollow Coast (2018)/season-02/S02E05.mkv',
  videoFolderId: null,
  season: 2,
};

/** A sandbox media root holding one reserved Series folder, and a take. */
function world(
  frame: Frame = pictured,
  swap: (real: Media) => Media = (real) => real
) {
  const root = sandboxRoot('familyflix-take-frame-still-');
  const real = createMedia(root, unfittedArt());
  const folder = basename(real.reserveFolder('The Hollow Coast', 2018));
  const frameMock = vi.fn<Frame>(frame);
  const seriesFolder = vi.fn(() => folder);
  const deps = {
    playback: framelessPlayback(frameMock),
    media: swap(real),
  };

  const take = (
    episode: StoredVideo & { season: number } = COPIED,
    signal: AbortSignal = new AbortController().signal
  ) => takeFrameStill(deps, episode, seriesFolder, signal);

  return { root, folder, frame: frameMock, seriesFolder, take };
}

/** The files in the Series folder's season folder, sorted. */
function seasonFiles(root: string, folder: string, season: string): string[] {
  try {
    return readdirSync(join(root, folder, season)).sort();
  } catch {
    return [];
  }
}

describe('takeFrameStill: a frame that comes', () => {
  it('stores it as <stem>.frame.jpg in the Series folder’s season folder', async () => {
    const { root, folder, take } = world();

    const taken = await take();

    expect(taken).toEqual({
      kind: 'stored',
      name: 'S02E05.frame.jpg',
      stored: `${folder}/season-02/S02E05.frame.jpg`,
    });
    expect(
      readFileSync(join(root, folder, 'season-02', 'S02E05.frame.jpg'), 'utf8')
    ).toBe(FRAME_BYTES);
  });

  it('names a Linked video’s frame by the video’s own stem, in the Series folder', async () => {
    const { root, folder, take } = world();

    const taken = await take({
      videoPath: 'The Hollow Coast/Season 01/Hollow.Coast.S01E01.Pilot.mp4',
      videoFolderId: 'a-library-folder',
      season: 1,
    });

    expect(taken).toEqual({
      kind: 'stored',
      name: 'Hollow.Coast.S01E01.Pilot.frame.jpg',
      stored: `${folder}/season-01/Hollow.Coast.S01E01.Pilot.frame.jpg`,
    });
    expect(seasonFiles(root, folder, 'season-01')).toEqual([
      'Hollow.Coast.S01E01.Pilot.frame.jpg',
    ]);
  });

  it('asks the frame of the episode’s own video, under the signal handed', async () => {
    const { frame, take } = world();
    const signal = new AbortController().signal;

    await take(COPIED, signal);

    expect(frame).toHaveBeenCalledTimes(1);
    const [video, asked] = frame.mock.calls[0] as [StoredVideo, AbortSignal];
    expect(video).toMatchObject({
      videoPath: COPIED.videoPath,
      videoFolderId: null,
    });
    expect(asked).toBe(signal);
  });
});

describe('takeFrameStill: a frame that does not land', () => {
  it.each([
    'no-component',
    'missing',
    'unreachable',
    'no-duration',
    'timed-out',
    'failed',
    'aborted',
  ] as const)(
    'answers the reason, storing nothing and asking no folder: %s',
    async (reason) => {
      const { root, folder, seriesFolder, take } = world(async () => ({
        kind: 'none',
        reason,
      }));

      expect(await take()).toEqual({ kind: 'none', reason });
      expect(seriesFolder).not.toHaveBeenCalled();
      expect(seasonFiles(root, folder, 'season-02')).toEqual([]);
    }
  );

  it('answers aborted and stores nothing when the signal is aborted as the picture comes', async () => {
    const controller = new AbortController();
    const { root, folder, seriesFolder, take } = world(async () => {
      controller.abort();
      return {
        kind: 'frame',
        picture: Readable.from([Buffer.from(FRAME_BYTES)]),
      };
    });

    expect(await take(COPIED, controller.signal)).toEqual({
      kind: 'none',
      reason: 'aborted',
    });
    expect(seriesFolder).not.toHaveBeenCalled();
    expect(seasonFiles(root, folder, 'season-02')).toEqual([]);
  });

  it('answers unstored when the picture cannot be written', async () => {
    const { take } = world(pictured, (real) => ({
      ...real,
      storeNamed: () => Promise.reject(new Error('disk full')),
    }));

    await expect(take()).resolves.toEqual({ kind: 'unstored' });
  });
});
