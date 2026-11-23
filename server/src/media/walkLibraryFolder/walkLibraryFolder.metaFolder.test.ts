// @vitest-environment node
//
// 74, Sheet in sight, Phase 1 (issue #701): the walk reads both names.
//
// The **Meta folder** is `_meta/` and the **Old Meta folder** `Meta/`. At a
// **Library folder**'s root the walk passes either in silence and never
// offers either as a title, and a folder holding either is an **Export
// folder**, passed in silence too. Its `sheet` comes from `_meta/` when that
// holds one, else from `Meta/`, the `.csv` before the `.xlsx` in each, and is
// `null` when neither holds a sheet. Against a real tree under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { walkLibraryFolder } from './walkLibraryFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A fresh Library folder holding the files given, at their relative paths. */
function libraryWith(files: string[]): string {
  const root = join(sandboxRoot('familyflix-walk-meta-'), 'Movies');
  mkdirSync(root);
  for (const file of files) {
    const path = join(root, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return root;
}

/** The walk's titles, by folder name, sorted. */
const titleNames = (walk: { titles: Array<{ dir: string }> }) =>
  walk.titles.map((title) => basename(title.dir)).sort();

const FILM = 'Die Hard (1988)/Die Hard.mkv';

describe('walkLibraryFolder: either Meta folder passes in silence', () => {
  it.each([
    ['_meta/', '_meta/familyflix-library.csv'],
    ['_meta/ holding a video', '_meta/stray.mkv'],
    ['Meta/', 'Meta/familyflix-library.csv'],
    ['Meta/ holding a video', 'Meta/stray.mkv'],
    [
      'an Export folder holding _meta/',
      'FamilyFlix Export 2026-11-23/_meta/familyflix-library.csv',
    ],
    [
      'an Export folder holding Meta/',
      'FamilyFlix Export 2026-11-08/Meta/familyflix-library.csv',
    ],
  ])('passes %s in silence, never a title', async (_label, file) => {
    const root = libraryWith([FILM, file]);

    const walk = await walkLibraryFolder(root);

    expect(titleNames(walk)).toEqual(['Die Hard (1988)']);
    expect(walk.warnings).toEqual([]);
  });

  it('passes an Export folder holding _meta/ and its title folders in silence', async () => {
    const root = libraryWith([
      FILM,
      'FamilyFlix Export 2026-11-23/_meta/familyflix-library.csv',
      'FamilyFlix Export 2026-11-23/Heat (1995)/Images/poster.jpg',
    ]);

    const walk = await walkLibraryFolder(root);

    expect(titleNames(walk)).toEqual(['Die Hard (1988)']);
    expect(walk.warnings).toEqual([]);
  });
});

describe('walkLibraryFolder: the sheet from either Meta folder', () => {
  it.each([
    [
      '_meta/ csv',
      ['_meta/familyflix-library.csv'],
      '_meta/familyflix-library.csv',
    ],
    [
      '_meta/ xlsx',
      ['_meta/familyflix-library.xlsx'],
      '_meta/familyflix-library.xlsx',
    ],
    [
      'the csv before the xlsx in _meta/',
      ['_meta/familyflix-library.xlsx', '_meta/familyflix-library.csv'],
      '_meta/familyflix-library.csv',
    ],
    [
      '_meta/ before Meta/',
      ['Meta/familyflix-library.csv', '_meta/familyflix-library.csv'],
      '_meta/familyflix-library.csv',
    ],
    [
      "_meta/'s xlsx before Meta/'s csv",
      ['Meta/familyflix-library.csv', '_meta/familyflix-library.xlsx'],
      '_meta/familyflix-library.xlsx',
    ],
    [
      'Meta/ when _meta/ holds no sheet',
      ['_meta/notes.txt', 'Meta/familyflix-library.csv'],
      'Meta/familyflix-library.csv',
    ],
    [
      'the csv before the xlsx in Meta/',
      ['Meta/familyflix-library.xlsx', 'Meta/familyflix-library.csv'],
      'Meta/familyflix-library.csv',
    ],
  ])('reads %s', async (_label, files, sheet) => {
    const root = libraryWith([FILM, ...files]);

    expect((await walkLibraryFolder(root)).sheet).toBe(
      join(root, ...sheet.split('/'))
    );
  });

  it('answers null when neither _meta/ nor Meta/ holds a sheet', async () => {
    const root = libraryWith([FILM, '_meta/notes.txt', 'Meta/notes.txt']);

    expect((await walkLibraryFolder(root)).sheet).toBeNull();
  });
});
