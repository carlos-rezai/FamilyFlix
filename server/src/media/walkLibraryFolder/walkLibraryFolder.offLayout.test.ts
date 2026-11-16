// @vitest-environment node
//
// 66, Missing videos, Phase 4 (issue #638): Off-layout folders.
//
// Beside its unchanged **Layout warnings**, the walk answers each root folder
// the **Folder layout** turns away as one `offLayout` entry, `{ dir, name,
// reason }`: an **Off-layout folder**, `empty` or `mixed`. The root's loose
// videos and a **Doubled place** stay warnings only.
//
// Against a real tree under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { walkLibraryFolder } from './walkLibraryFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/**
 * A fresh Library folder holding the files at the relative paths given, and
 * each empty folder named.
 */
function libraryWith(files: string[], emptyFolders: string[] = []): string {
  const root = join(sandboxRoot('familyflix-walk-off-layout-'), 'Films');
  mkdirSync(root);
  for (const file of files) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  for (const folder of emptyFolders) {
    mkdirSync(join(root, folder), { recursive: true });
  }
  return root;
}

describe('walkLibraryFolder: Off-layout folders', () => {
  it('answers an empty folder as one offLayout entry, its warning line unchanged', async () => {
    const root = libraryWith(['Die Hard (1988)/Die.Hard.1988.mp4'], ['Heat']);

    const walk = await walkLibraryFolder(root);

    expect(walk.offLayout).toEqual([
      { dir: join(root, 'Heat'), name: 'Heat', reason: 'empty' },
    ]);
    expect(walk.warnings).toEqual([
      '⚠ Heat holds no video or Season folder, left out',
    ]);
  });

  it('answers a mixed folder as one offLayout entry, its warning line unchanged', async () => {
    const root = libraryWith([
      'Tidewater (2018)/Season 01/Tidewater.S01E01.Low.Water.mp4',
      'Tidewater (2018)/Tidewater.S01E02.The.Crossing.mp4',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(walk.offLayout).toEqual([
      {
        dir: join(root, 'Tidewater (2018)'),
        name: 'Tidewater (2018)',
        reason: 'mixed',
      },
    ]);
    expect(walk.warnings).toEqual([
      '⚠ Tidewater (2018) holds loose videos and Season folders, left out',
    ]);
  });

  it('answers one entry per folder turned away, and none for a Title folder read', async () => {
    const root = libraryWith(
      [
        'Amelie (2001)/Amelie.mp4',
        'Tidewater (2018)/Season 01/Tidewater.S01E01.Low.Water.mp4',
        'Tidewater (2018)/Tidewater.S01E02.The.Crossing.mp4',
      ],
      ['Heat']
    );

    const walk = await walkLibraryFolder(root);

    expect(
      walk.offLayout
        .map((folder) => [folder.name, folder.reason])
        .sort(([a], [b]) => a.localeCompare(b))
    ).toEqual([
      ['Heat', 'empty'],
      ['Tidewater (2018)', 'mixed'],
    ]);
    expect(walk.titles.map((title) => title.name)).toEqual(['Amelie (2001)']);
  });

  it('answers no entry for the root’s loose videos, a warning only', async () => {
    const root = libraryWith(['Loose.Film.mp4', 'Amelie (2001)/Amelie.mp4']);

    const walk = await walkLibraryFolder(root);

    expect(walk.offLayout).toEqual([]);
    expect(walk.warnings).toEqual([
      `⚠ 1 video lies loose at the top of ${root}, left out`,
    ]);
  });

  it('answers no entry for a Doubled place, a warning only', async () => {
    const root = libraryWith([
      'Heat (1995)/Heat.mp4',
      'Heat (1995)/Images/poster.jpg',
      'Heat (1995)/Images/poster.png',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(walk.offLayout).toEqual([]);
    expect(walk.warnings).toHaveLength(1);
    expect(walk.warnings[0]).toMatch(/^⚠ Heat \(1995\) holds 2 posters, /);
  });

  it('answers an empty list when every folder is in the layout', async () => {
    const root = libraryWith(['Amelie (2001)/Amelie.mp4']);

    const walk = await walkLibraryFolder(root);

    expect(walk.offLayout).toEqual([]);
    expect(walk.warnings).toEqual([]);
  });
});
