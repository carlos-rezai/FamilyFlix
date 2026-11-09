// @vitest-environment node
//
// 58, Folder layout, Phase 2 (issue #535): the Library folder walk.
//
// The **Library folder** walk, against a real tree under `sandboxRoot`. It
// reads only the root's entries: each **Title folder** is read by
// `readTitleFolder`, and each root entry left out of the **Folder layout** is
// one **Layout warning**, its text as the run logs it; the root's loose videos
// are one line for the whole folder. `Meta/`, an **Export folder** (a folder
// holding `Meta/`) and system folders pass in silence, and nothing inside a
// Title folder the layout doesn't name warns. It answers `LayoutWalk {
// titles, warnings, sheet }`, `sheet` the `Meta/` sheet's path or `null`
// (found, not yet read).

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { walkLibraryFolder } from './walkLibraryFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** Files at the relative paths given under `root`, made. */
function filesAt(root: string, files: string[]): void {
  for (const file of files) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
}

/** A fresh Library folder holding the files given. */
function libraryWith(files: string[]): string {
  const root = join(sandboxRoot('familyflix-walk-'), 'Movies');
  mkdirSync(root);
  filesAt(root, files);
  return root;
}

/** The walk's titles, by folder name, sorted. */
const titleNames = (walk: { titles: Array<{ dir: string }> }) =>
  walk.titles.map((title) => basename(title.dir)).sort();

describe('walkLibraryFolder: root entries only', () => {
  it('reads a Title folder in the root as a film', async () => {
    const root = libraryWith(['Die Hard (1988)/Die Hard.mkv']);

    const walk = await walkLibraryFolder(root);

    expect(walk.titles).toEqual([
      expect.objectContaining({
        kind: 'film',
        dir: join(root, 'Die Hard (1988)'),
        videos: [join(root, 'Die Hard (1988)', 'Die Hard.mkv')],
      }),
    ]);
    expect(walk.warnings).toEqual([]);
  });

  it('does not descend a folder in the root to find a Title folder', async () => {
    const root = libraryWith([
      'Die Hard (1988)/Die Hard.mkv',
      'Drama/Amelie (2001)/Amelie.mp4',
      'Drama/Classics/Brazil (1985)/Brazil.avi',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(titleNames(walk)).toEqual(['Die Hard (1988)']);
  });

  it('tells onFound of each Title folder it reads', async () => {
    const root = libraryWith([
      'Die Hard (1988)/Die Hard.mkv',
      'Heat (1995)/Heat.mkv',
    ]);
    const found: Array<{ name: string; kind: string }> = [];

    await walkLibraryFolder(root, (title) =>
      found.push({ name: basename(title.dir), kind: title.kind })
    );

    expect(found.sort((a, b) => a.name.localeCompare(b.name))).toEqual([
      { name: 'Die Hard (1988)', kind: 'film' },
      { name: 'Heat (1995)', kind: 'film' },
    ]);
  });

  it('answers nothing for an empty root', async () => {
    const root = libraryWith([]);

    expect(await walkLibraryFolder(root)).toEqual({
      titles: [],
      warnings: [],
      sheet: null,
    });
  });
});

describe('walkLibraryFolder: the Layout warnings', () => {
  it('warns of a folder not named Title (Year)', async () => {
    const root = libraryWith(['Drama/Amelie (2001)/Amelie.mp4']);

    const walk = await walkLibraryFolder(root);

    expect(walk.titles).toEqual([]);
    expect(walk.warnings).toEqual([
      "⚠ Drama isn't named Title (Year), left out",
    ]);
  });

  it('warns of a Title folder holding no video or Season folder', async () => {
    const root = libraryWith(['Heat (1995)/Images/poster.jpg']);

    const walk = await walkLibraryFolder(root);

    expect(walk.titles).toEqual([]);
    expect(walk.warnings).toEqual([
      '⚠ Heat (1995) holds no video or Season folder, left out',
    ]);
  });

  it('warns of a Title folder holding loose videos and Season folders', async () => {
    const root = libraryWith([
      'Severance (2022)/Severance.mkv',
      'Severance (2022)/Season 01/Severance.S01E01.mkv',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(walk.titles).toEqual([]);
    expect(walk.warnings).toEqual([
      '⚠ Severance (2022) holds loose videos and Season folders, left out',
    ]);
  });

  it('warns of the root’s loose videos in one line', async () => {
    const root = libraryWith([
      'Heat.1995.mkv',
      'Amelie.2001.mp4',
      'Die Hard (1988)/Die Hard.mkv',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(titleNames(walk)).toEqual(['Die Hard (1988)']);
    expect(walk.warnings).toEqual([
      `⚠ 2 videos lie loose at the top of ${root}, left out`,
    ]);
  });

  it('warns once per root entry left out', async () => {
    const root = libraryWith([
      'Drama/Amelie (2001)/Amelie.mp4',
      'Comedy/Airplane (1980)/Airplane.mp4',
      'Die Hard (1988)/Die Hard.mkv',
    ]);

    const walk = await walkLibraryFolder(root);

    expect([...walk.warnings].sort()).toEqual([
      "⚠ Comedy isn't named Title (Year), left out",
      "⚠ Drama isn't named Title (Year), left out",
    ]);
  });
});

describe('walkLibraryFolder: what passes in silence', () => {
  it.each([
    ['Meta/', 'Meta/familyflix-library.csv'],
    [
      'an Export folder',
      'FamilyFlix Export 2026-11-08/Meta/familyflix-library.csv',
    ],
    ['a dot folder', '.thumbnails/cache.db'],
    ['a dollar folder', '$RECYCLE.BIN/desktop.ini'],
    [
      'System Volume Information',
      'System Volume Information/IndexerVolumeGuid',
    ],
  ])('passes %s in silence', async (_label, file) => {
    const root = libraryWith(['Die Hard (1988)/Die Hard.mkv', file]);

    const walk = await walkLibraryFolder(root);

    expect(titleNames(walk)).toEqual(['Die Hard (1988)']);
    expect(walk.warnings).toEqual([]);
  });

  it('warns of nothing inside a Title folder the layout does not name', async () => {
    const root = libraryWith([
      'Heat (1995)/Heat.mkv',
      'Heat (1995)/notes.txt',
      'Heat (1995)/Extras/making-of.mkv',
      'Heat (1995)/Images/random.jpg',
      'Heat (1995)/Subtitles/old/Heat.en.srt',
      'Heat (1995)/Scans/booklet.pdf',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(titleNames(walk)).toEqual(['Heat (1995)']);
    expect(walk.warnings).toEqual([]);
  });
});

describe('walkLibraryFolder: the sheet', () => {
  it('finds the Meta/ sheet', async () => {
    const root = libraryWith([
      'Die Hard (1988)/Die Hard.mkv',
      'Meta/familyflix-library.csv',
    ]);

    expect((await walkLibraryFolder(root)).sheet).toBe(
      join(root, 'Meta', 'familyflix-library.csv')
    );
  });

  it('answers null when Meta/ holds no sheet', async () => {
    const root = libraryWith(['Die Hard (1988)/Die Hard.mkv']);

    expect((await walkLibraryFolder(root)).sheet).toBeNull();
  });
});
