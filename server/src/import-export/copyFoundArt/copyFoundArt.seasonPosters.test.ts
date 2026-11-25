// @vitest-environment node
//
// 76, Whole add, Phase 3 (issue #718): a show's found Season posters, copied in.
//
// `copyFoundArt` takes `seasonPosters: { season, path }[]` beside the poster
// and backdrop, copies each through `Media.copyIn` into `season-NN/` of the
// **Media folder** (`media.seasonFolder`), and answers each one's **Stored
// path** by season in `CopiedArt.seasonPosters`. Copied, never moved.
//
// Over a real `createMedia` and a temp Media folder under `sandboxRoot`.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { copyFoundArt } from './copyFoundArt';
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

/** A media root, a reserved Media folder in it, and a picked show beside. */
function freshFolder() {
  const root = sandboxRoot('familyflix-copy-season-posters-');
  const mediaRoot = join(root, 'media');
  const media = createMedia(mediaRoot, unfittedArt());
  const folder = media.reserveFolder('The Show', 2019);
  return { root, mediaRoot, media, folder };
}

describe('copyFoundArt: Season posters', () => {
  it('copies each found Season poster into its season-NN folder', async () => {
    const { root, mediaRoot, media, folder } = freshFolder();
    const one = fileAt(
      root,
      join('The Show (2019)', 'Season 01', 'Images', 'poster.jpg')
    );
    const three = fileAt(
      root,
      join('The Show (2019)', 'Season 03', 'Images', 'poster.jpg')
    );

    const copied = await copyFoundArt(media, folder, {
      poster: null,
      backdrop: null,
      seasonPosters: [
        { season: 1, path: one },
        { season: 3, path: three },
      ],
    });

    expect(copied.seasonPosters).toEqual([
      {
        season: 1,
        path: expect.stringMatching(/^[^/]+\/season-01\/poster\.jpg$/),
      },
      {
        season: 3,
        path: expect.stringMatching(/^[^/]+\/season-03\/poster\.jpg$/),
      },
    ]);
    expect(
      readFileSync(join(mediaRoot, copied.seasonPosters[0].path)).toString()
    ).toBe(join('The Show (2019)', 'Season 01', 'Images', 'poster.jpg'));
    expect(existsSync(one)).toBe(true);
    expect(existsSync(three)).toBe(true);
  });

  it('answers no Season posters when none were found', async () => {
    const { media, folder } = freshFolder();

    const copied = await copyFoundArt(media, folder, {
      poster: null,
      backdrop: null,
      seasonPosters: [],
    });

    expect(copied.seasonPosters).toEqual([]);
  });

  it('rejects when a found Season poster is not there', async () => {
    const { root, media, folder } = freshFolder();

    await expect(
      copyFoundArt(media, folder, {
        poster: null,
        backdrop: null,
        seasonPosters: [{ season: 1, path: join(root, 'Gone', 'poster.jpg') }],
      })
    ).rejects.toThrow();
  });
});
