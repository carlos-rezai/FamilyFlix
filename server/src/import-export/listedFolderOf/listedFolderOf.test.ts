// @vitest-environment node
//
// 48 — Add a show folder, refactor (issue #421): "under a listed folder",
// spelled once.
//
// `listedFolderOf(folders, path)` answers the listed **Library folder** a path
// lies strictly inside — of nested ones the deepest — or `null`. "Inside" is
// `folderOverlap`'s reading, as `linkedFiles` and `admitFolder` read it:
// resolved, by whole segments, so the folder itself is not inside it and a
// sibling whose name only starts like it is not either.

import { join, parse } from 'node:path';
import { describe, expect, it } from 'vitest';

import { listedFolderOf } from './listedFolderOf';
import type { StoredLibraryFolder } from '../../library';

const root = join(parse(process.cwd()).root, 'familyflix-listed');

/** A listed Library folder at `relative` under `root`. */
const listed = (id: string, relative: string): StoredLibraryFolder => ({
  id,
  path: join(root, relative),
  titleCount: 0,
});

describe('listedFolderOf', () => {
  const shows = listed('shows', 'Shows');

  it('answers the listed folder a path lies inside', () => {
    expect(
      listedFolderOf([shows], join(root, 'Shows', 'Harbor and Vine'))
    ).toBe(shows);
  });

  it('answers null for the listed folder itself', () => {
    expect(listedFolderOf([shows], join(root, 'Shows'))).toBeNull();
  });

  it('answers null for a path outside every listed folder', () => {
    expect(
      listedFolderOf([shows], join(root, 'Downloads', 'x.mp4'))
    ).toBeNull();
  });

  it('answers null for a sibling whose name only starts like the folder', () => {
    expect(
      listedFolderOf([shows], join(root, 'Shows Old', 'x.mp4'))
    ).toBeNull();
  });

  it('answers null for a path climbing out through ..', () => {
    expect(
      listedFolderOf([shows], `${join(root, 'Shows')}/../Movies/x.mp4`)
    ).toBeNull();
  });

  it('answers null for a path on another drive', () => {
    expect(listedFolderOf([shows], join('Z:\\', 'Shows', 'x.mp4'))).toBeNull();
  });

  it('answers the deepest of two nested listed folders, in either order', () => {
    const outer = listed('outer', 'Family');
    const inner = listed('inner', join('Family', 'Shows'));
    const pilot = join(root, 'Family', 'Shows', 'Harbor and Vine', 'x.mp4');

    expect(listedFolderOf([outer, inner], pilot)).toBe(inner);
    expect(listedFolderOf([inner, outer], pilot)).toBe(inner);
  });
});
