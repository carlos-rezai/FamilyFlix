// @vitest-environment node
//
// 76, Whole add, Phase 3 (issue #718): an episode's found Still, copied in.
//
// `copyFoundEpisodes` copies an episode's found `stillPath` through
// `Media.copyIn` beside its tracks, in its season folder under the **Series
// folder**, and answers its **Stored path** in `CopiedEpisode.still` (`null`
// for none). Copied, never moved.
//
// Over a real `createMedia` and a temp Series folder under `sandboxRoot`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { copyFoundEpisodes } from './copyFoundEpisodes';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
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
  const root = sandboxRoot('familyflix-copy-found-still-');
  const mediaRoot = join(root, 'media');
  const media = createMedia(mediaRoot, unfittedArt());
  const folder = media.reserveFolder('The Show', 2019);
  return { root, mediaRoot, media, folder };
}

describe('copyFoundEpisodes: the found Still', () => {
  it('copies a found Still into its season folder and answers it', async () => {
    const { root, mediaRoot, media, folder } = freshSeries();
    const video = fileAt(root, join('Picked', 'Season 02', 'S02E01.mkv'));
    const still = fileAt(
      root,
      join('Picked', 'Season 02', 'Images', 'Stills', 'S02E01.jpg')
    );

    const [copied] = await copyFoundEpisodes(
      media,
      folder,
      [{ season: 2, videoPath: video, stillPath: still }],
      [null],
      (path) => path
    );

    expect(copied.still).toMatch(/\/season-02\/S02E01\.jpg$/);
    expect(
      readFileSync(join(mediaRoot, copied.still as string)).toString()
    ).toBe(join('Picked', 'Season 02', 'Images', 'Stills', 'S02E01.jpg'));
    expect(existsSync(still)).toBe(true);
  });

  it('copies a found Still beside a linked video', async () => {
    const { root, media, folder } = freshSeries();
    const video = fileAt(root, join('Shows', 'Harbor', 'S01E01.mkv'));
    const still = fileAt(root, join('Shows', 'Harbor', 'Images', 'S01E01.jpg'));
    const linked = { videoPath: 'Harbor/S01E01.mkv', videoFolderId: 'shows' };

    const [copied] = await copyFoundEpisodes(
      media,
      folder,
      [{ season: 1, videoPath: video, stillPath: still }],
      [linked],
      (path) => path
    );

    expect(copied.video).toEqual(linked);
    expect(copied.still).toMatch(/\/season-01\/S01E01\.jpg$/);
  });

  it('answers null for an episode with no found Still', async () => {
    const { root, media, folder } = freshSeries();
    const video = fileAt(root, join('Picked', 'S01E01.mkv'));

    const [copied] = await copyFoundEpisodes(
      media,
      folder,
      [{ season: 1, videoPath: video }],
      [null],
      (path) => path
    );

    expect(copied.still).toBeNull();
  });

  it('rejects when a found Still is not there', async () => {
    const { root, media, folder } = freshSeries();
    const video = fileAt(root, join('Picked', 'S01E01.mkv'));

    await expect(
      copyFoundEpisodes(
        media,
        folder,
        [
          {
            season: 1,
            videoPath: video,
            stillPath: join(root, 'Gone', 'S01E01.jpg'),
          },
        ],
        [null],
        (path) => path
      )
    ).rejects.toThrow();
  });
});
