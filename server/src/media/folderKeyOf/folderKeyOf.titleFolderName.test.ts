// @vitest-environment node
//
// 67, Export paths, Phase 3 (issue #646): a Source folder's Title folder.
//
// `titleFolderName(path)`, pure, beside `foldFolderKey`: the **Title folder**
// a **Source folder** names, its last non-empty segment, split on `/` and
// `\` alike, so a nested `Movies\Amelie (2001)` and a root-level
// `Amelie (2001)` answer the same **Folder key**.

import { describe, expect, it } from 'vitest';

import { titleFolderName } from './folderKeyOf';

describe('titleFolderName: the last non-empty segment', () => {
  it.each([
    ['one segment', 'Heat (1995)', 'Heat (1995)'],
    ['a forward slash', 'Movies/Heat (1995)', 'Heat (1995)'],
    ['a backslash', 'Movies\\Heat (1995)', 'Heat (1995)'],
    ['mixed separators', 'Library\\Movies/Heat (1995)', 'Heat (1995)'],
    ['a trailing forward slash', 'Movies/Heat (1995)/', 'Heat (1995)'],
    ['a trailing backslash', 'Movies\\Heat (1995)\\', 'Heat (1995)'],
    ['doubled separators', 'Movies//Heat (1995)\\\\', 'Heat (1995)'],
  ])('reads %s', (_, path, name) => {
    expect(titleFolderName(path)).toBe(name);
  });

  it('keeps a one-segment name as written, spaces and dots and all', () => {
    expect(titleFolderName('Mr. & Mrs. Smith (2005)')).toBe(
      'Mr. & Mrs. Smith (2005)'
    );
  });
});
