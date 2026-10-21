// @vitest-environment node
//
// 48 — Add a show folder, refactor (issue #421): the series add's copies,
// out of the route.
//
// `copyFoundEpisodes(media, folder, episodes, placed, stored)` places each
// episode of a series add on disk: a **Placed video** kept where it lies, a
// found video copied into its season folder under the **Series folder**, a
// picked one's **Stored path**, and its found subtitles copied beside it. It
// rejects on the first copy that breaks; the route takes the folder back.
//
// Over a real `createMedia` and a temp Series folder under `sandboxRoot`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { copyFoundEpisodes } from './copyFoundEpisodes';
import { createMedia } from '../../media/createMedia/createMedia';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A file at `relative` under `root`, made, holding its own name. */
function fileAt(root: string, relative: string): string {
  const file = join(root, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, relative);
  return file;
}

/** A media root, a reserved Series folder in it, and a picked show beside. */
function freshSeries() {
  const root = sandboxRoot('familyflix-copy-found-');
  const mediaRoot = join(root, 'media');
  const media = createMedia(mediaRoot);
  const folder = media.reserveFolder('Harbor and Vine', 2019);
  return { root, mediaRoot, media, folder };
}

describe('copyFoundEpisodes', () => {
  it('copies a found video into its season folder, leaving the source', async () => {
    const { root, mediaRoot, media, folder } = freshSeries();
    const found = fileAt(root, join('Picked', 'Season 2', 'S02E01.mkv'));

    const [copied] = await copyFoundEpisodes(
      media,
      folder,
      [{ season: 2, videoPath: found }],
      [null],
      (path) => path
    );

    expect(copied.video.videoFolderId).toBeNull();
    expect(copied.video.videoPath).toMatch(/\/season-02\/S02E01\.mkv$/);
    expect(
      readFileSync(join(mediaRoot, copied.video.videoPath)).toString()
    ).toBe(join('Picked', 'Season 2', 'S02E01.mkv'));
    expect(existsSync(found)).toBe(true);
  });

  it('keeps a linked video where it lies, copying nothing', async () => {
    const { root, media, folder } = freshSeries();
    const found = fileAt(root, join('Shows', 'Harbor', 'S01E01.mkv'));
    const linked = { videoPath: 'Harbor/S01E01.mkv', videoFolderId: 'shows' };

    const [copied] = await copyFoundEpisodes(
      media,
      folder,
      [{ season: 1, videoPath: found }],
      [linked],
      (path) => path
    );

    expect(copied.video).toEqual(linked);
    expect(existsSync(join(folder, 'season-01', 'S01E01.mkv'))).toBe(false);
    expect(existsSync(found)).toBe(true);
  });

  it('answers a picked video’s stored path', async () => {
    const { media, folder } = freshSeries();

    const [copied] = await copyFoundEpisodes(
      media,
      folder,
      [{ season: 1, video: 'reserved/season-01/S01E01.mkv' }],
      [null],
      (path) => path.replace('reserved', 'Harbor and Vine (2019)')
    );

    expect(copied.video).toEqual({
      videoPath: 'Harbor and Vine (2019)/season-01/S01E01.mkv',
      videoFolderId: null,
    });
  });

  it('copies each found subtitle beside its video, in its language', async () => {
    const { root, mediaRoot, media, folder } = freshSeries();
    const found = fileAt(root, join('Picked', 'S02E01.mkv'));
    const track = fileAt(root, join('Picked', 'S02E01.pt.srt'));

    const [copied] = await copyFoundEpisodes(
      media,
      folder,
      [
        {
          season: 2,
          videoPath: found,
          storedSubtitles: [{ path: track, language: 'Portuguese' }],
        },
      ],
      [null],
      (path) => path
    );

    expect(copied.tracks).toEqual([
      {
        path: expect.stringMatching(/\/season-02\/S02E01\.pt\.srt$/),
        language: 'Portuguese',
      },
    ]);
    expect(dirname(copied.tracks[0].path)).toBe(
      dirname(copied.video.videoPath)
    );
    expect(existsSync(join(mediaRoot, copied.tracks[0].path))).toBe(true);
  });

  it('rejects when a found file is not there', async () => {
    const { root, media, folder } = freshSeries();

    await expect(
      copyFoundEpisodes(
        media,
        folder,
        [{ season: 1, videoPath: join(root, 'Gone', 'S01E01.mkv') }],
        [null],
        (path) => path
      )
    ).rejects.toThrow();
  });
});
