// @vitest-environment node
//
// 59, Rebuild whole, Phase 10 (issue #557): one reader of a show, and hollow
// shows.
//
// `readSeasonFolders(dir)` reads a folder's **Season folders**, and nothing
// else in it, in number order: the one reader shared by `readTitleFolder` and
// `readShowFolder`. A **Title folder** whose Season folders all hold no video
// is left out as `empty`, the reason its **Layout warning** words.
//
// Against real folders under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readSeasonFolders, readTitleFolder } from './readTitleFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A Title folder named `name` holding the files at the relative paths given. */
function titleFolder(name: string, files: string[]): string {
  const dir = join(sandboxRoot('familyflix-season-folders-'), name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return dir;
}

describe('readSeasonFolders', () => {
  it('answers a folder’s Season folders in number order, and nothing else in it', async () => {
    const dir = titleFolder('Severance (2022)', [
      'Season 10/Severance.S10E01.mkv',
      'Season 02/Severance.S02E01.mkv',
      'Season 00/Severance.S00E01.mkv',
      'Season 1/Severance.S01E01.mkv',
      'Extras/making-of.mkv',
    ]);

    const seasons = await readSeasonFolders(dir);

    expect(
      seasons.map((season) => [season.number, season.dir, season.videos])
    ).toEqual([
      [
        0,
        join(dir, 'Season 00'),
        [join(dir, 'Season 00', 'Severance.S00E01.mkv')],
      ],
      [
        2,
        join(dir, 'Season 02'),
        [join(dir, 'Season 02', 'Severance.S02E01.mkv')],
      ],
      [
        10,
        join(dir, 'Season 10'),
        [join(dir, 'Season 10', 'Severance.S10E01.mkv')],
      ],
    ]);
  });
});

describe('readTitleFolder: a hollow show', () => {
  it('leaves out a Title folder whose Season folders all hold no video as empty', async () => {
    const dir = titleFolder('Hollow Show (2020)', [
      'Images/poster.jpg',
      'Season 01/Images/poster.jpg',
      'Season 02/Subtitles/S02E01/Hollow.Show.S02E01.en.srt',
    ]);

    expect(await readTitleFolder(dir)).toEqual({
      kind: 'left-out',
      dir,
      name: 'Hollow Show (2020)',
      reason: 'empty',
    });
  });
});
