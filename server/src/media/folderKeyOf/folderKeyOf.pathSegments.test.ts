// @vitest-environment node
//
// 67, Export paths, refactor (issue #651): a path's segments, one rule.
//
// `pathSegments(path)`, pure, beside `titleFolderName`: a path's non-empty
// segments, `/` and `\` both separating, as a stored **Source folder**, a
// Folder cell and a **Folder path** are read.

import { describe, expect, it } from 'vitest';

import { pathSegments } from './folderKeyOf';

describe('pathSegments: the non-empty segments, either slash', () => {
  it.each([
    ['one segment', 'Heat (1995)', ['Heat (1995)']],
    [
      'both separators mixed',
      'Library\\Movies/Heat (1995)',
      ['Library', 'Movies', 'Heat (1995)'],
    ],
    ['a leading separator', '/Movies/Heat (1995)', ['Movies', 'Heat (1995)']],
    [
      'a trailing separator',
      'Movies\\Heat (1995)\\',
      ['Movies', 'Heat (1995)'],
    ],
    ['a doubled separator', 'Movies//Heat (1995)', ['Movies', 'Heat (1995)']],
    ['the empty path', '', []],
  ])('reads %s', (_, path, segments) => {
    expect(pathSegments(path)).toEqual(segments);
  });
});
