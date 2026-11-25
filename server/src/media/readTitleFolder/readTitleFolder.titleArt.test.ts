// @vitest-environment node
//
// 76, Whole add, Phase 2 (issue #717): the art reader lifted out.
//
// `readTitleArt(folder)` is the art reader `readTitleFolder` has always used,
// lifted out as its own export: a folder's **Poster** and **Backdrop** by role
// from `Images/`, the first of each by name order, `null` for none. The
// `readTitleFolder` suites stay unchanged and passing, which proves the lift.
//
// Against real folders under `sandboxRoot`.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { readTitleArt } from './readTitleFolder';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';

/** A folder named `name` holding the files at the relative paths given. */
function folderWith(name: string, files: string[]): string {
  const dir = join(sandboxRoot('familyflix-title-art-'), name);
  mkdirSync(dir, { recursive: true });
  for (const file of files) {
    const path = join(dir, file);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${file} bytes`);
  }
  return dir;
}

describe('readTitleArt', () => {
  it('answers a folder’s poster and backdrop by role from Images/', async () => {
    const dir = folderWith('The Show (2019)', [
      'Images/poster.jpg',
      'Images/backdrop.png',
    ]);

    expect(await readTitleArt(dir)).toEqual({
      poster: join(dir, 'Images', 'poster.jpg'),
      backdrop: join(dir, 'Images', 'backdrop.png'),
    });
  });

  it('answers the first of each by name order', async () => {
    const dir = folderWith('The Show (2019)', [
      'Images/b-poster.jpg',
      'Images/a-poster.jpg',
      'Images/z-backdrop.jpg',
      'Images/m-backdrop.jpg',
    ]);

    expect(await readTitleArt(dir)).toEqual({
      poster: join(dir, 'Images', 'a-poster.jpg'),
      backdrop: join(dir, 'Images', 'm-backdrop.jpg'),
    });
  });

  it('answers null for a role no image fills', async () => {
    const dir = folderWith('The Show (2019)', [
      'Images/poster.jpg',
      'Images/cover.jpg',
    ]);

    expect(await readTitleArt(dir)).toEqual({
      poster: join(dir, 'Images', 'poster.jpg'),
      backdrop: null,
    });
  });

  it('answers nulls for a folder with no Images/', async () => {
    const dir = folderWith('The Show (2019)', ['Season 01/S01E01.mkv']);

    expect(await readTitleArt(dir)).toEqual({ poster: null, backdrop: null });
  });
});
