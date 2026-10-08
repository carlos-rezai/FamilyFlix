// @vitest-environment node
//
// 30 — Library folders, Phase 1 (issue #268).
//
// `folderOverlap(candidate, listed, platform)` — pure: whether a path the
// maintainer is adding clashes with a **Library folder** already listed, and
// with which. `'same'` is the folder itself, `'inside'` a folder under a
// listed one, `'contains'` a folder holding a listed one; `null` is no clash.
// Paths are compared resolved, case-insensitively on Windows, by whole path
// segments — so `E:\Movies2` is not inside `E:\Movies`.

import { describe, expect, it } from 'vitest';

import { clashSentence, folderOverlap } from './folderOverlap';

const LISTED = ['E:\\Movies', 'D:\\Kids\\Cartoons'];

describe('folderOverlap — on Windows', () => {
  it.each([
    ['the same folder', 'E:\\Movies', 'same', 'E:\\Movies'],
    [
      'a folder inside a listed one',
      'E:\\Movies\\Kids',
      'inside',
      'E:\\Movies',
    ],
    [
      'a folder deep inside',
      'D:\\Kids\\Cartoons\\Old\\1990s',
      'inside',
      'D:\\Kids\\Cartoons',
    ],
    [
      'a folder containing a listed one',
      'D:\\Kids',
      'contains',
      'D:\\Kids\\Cartoons',
    ],
    [
      'a drive containing a listed one',
      'D:\\',
      'contains',
      'D:\\Kids\\Cartoons',
    ],
    [
      'the same folder with a trailing separator',
      'E:\\Movies\\',
      'same',
      'E:\\Movies',
    ],
    ['the same folder in another case', 'e:\\MOVIES', 'same', 'E:\\Movies'],
    [
      'a folder inside, in another case',
      'e:\\movies\\kids',
      'inside',
      'E:\\Movies',
    ],
    [
      'the same folder spelled with . and ..',
      'E:\\Movies\\Kids\\..',
      'same',
      'E:\\Movies',
    ],
  ] as const)('%s', (_case, candidate, overlap, folder) => {
    expect(folderOverlap(candidate, LISTED, 'win32')).toEqual({
      overlap,
      folder,
    });
  });

  it.each([
    ['an unrelated sibling', 'E:\\Series'],
    ['a shared name prefix', 'E:\\Movies2'],
    ['a shared name prefix under the other', 'D:\\Kids\\Cartoons Extra'],
    ['another drive', 'F:\\Movies'],
  ])('answers null for %s', (_case, candidate) => {
    expect(folderOverlap(candidate, LISTED, 'win32')).toBeNull();
  });

  it('answers null against an empty list', () => {
    expect(folderOverlap('E:\\Movies', [], 'win32')).toBeNull();
  });

  it('names a listed path that was itself saved with a trailing separator', () => {
    expect(
      folderOverlap('E:\\Movies\\Kids', ['E:\\Movies\\'], 'win32')
    ).toEqual({
      overlap: 'inside',
      folder: 'E:\\Movies\\',
    });
  });
});

describe('folderOverlap — elsewhere, where case is a difference', () => {
  it('reads two spellings in different case as two folders', () => {
    expect(folderOverlap('/srv/movies', ['/srv/Movies'], 'linux')).toBeNull();
  });

  it('still finds the same folder, inside and containing', () => {
    expect(folderOverlap('/srv/Movies/', ['/srv/Movies'], 'linux')).toEqual({
      overlap: 'same',
      folder: '/srv/Movies',
    });
    expect(folderOverlap('/srv/Movies/Kids', ['/srv/Movies'], 'linux')).toEqual(
      {
        overlap: 'inside',
        folder: '/srv/Movies',
      }
    );
    expect(folderOverlap('/srv', ['/srv/Movies'], 'linux')).toEqual({
      overlap: 'contains',
      folder: '/srv/Movies',
    });
    expect(folderOverlap('/srv/Movies2', ['/srv/Movies'], 'linux')).toBeNull();
  });
});

describe('clashSentence — one sentence per clash', () => {
  it('words the same folder', () => {
    expect(clashSentence({ overlap: 'same', folder: 'E:/Movies' })).toBe(
      'That folder is already in your library folders.'
    );
  });

  it('words a folder inside a listed one', () => {
    expect(clashSentence({ overlap: 'inside', folder: 'E:/Movies' })).toBe(
      'That folder is inside E:/Movies, which is already a library folder.'
    );
  });

  it('words a folder holding a listed one', () => {
    expect(clashSentence({ overlap: 'contains', folder: 'E:/Movies' })).toBe(
      'That folder holds E:/Movies, which is already a library folder.'
    );
  });
});
