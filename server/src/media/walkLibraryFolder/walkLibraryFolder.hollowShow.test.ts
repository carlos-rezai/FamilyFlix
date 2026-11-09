// @vitest-environment node
//
// 59, Rebuild whole, Phase 10 (issue #557): hollow shows.
//
// A **Title folder** whose **Season folders** all hold no video is one
// **Layout warning**, _holds no video or Season folder_, and is left out of
// the walk's titles; an empty Season folder beside full ones passes in
// silence, its series read.
//
// Against a real tree under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { walkLibraryFolder } from './walkLibraryFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A fresh Library folder holding the files at the relative paths given. */
function libraryWith(files: string[]): string {
  const root = join(sandboxRoot('familyflix-walk-hollow-'), 'Shows');
  mkdirSync(root);
  for (const file of files) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return root;
}

describe('walkLibraryFolder: a hollow show', () => {
  it('warns once for a show whose Season folders hold no video, and passes an empty Season folder beside full ones', async () => {
    const root = libraryWith([
      'Hollow Show (2020)/Images/poster.jpg',
      'Hollow Show (2020)/Season 01/Images/poster.jpg',
      'Hollow Show (2020)/Season 02/Images/Stills/Hollow.Show.S02E01.jpg',
      'Tidewater (2018)/Season 01/Tidewater.S01E01.Low.Water.mp4',
      'Tidewater (2018)/Season 02/Images/poster.jpg',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(walk.warnings).toEqual([
      '⚠ Hollow Show (2020) holds no video or Season folder, left out',
    ]);
    expect(walk.titles.map((title) => basename(title.dir))).toEqual([
      'Tidewater (2018)',
    ]);
  });
});
