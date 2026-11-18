// @vitest-environment node
//
// 67, Export paths, Phase 4 (issue #647): one spelling for a Source folder.
//
// `sourceFolderOf(root, dir)` answers a folder's **Source folder**: its path
// relative to its **Library folder** `root`, with `/` on every platform, as a
// **Source file** already is. Paths are built with the platform's `join`, so
// on Windows the nested case is spelled with `\` and still answers `/`.

import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { sourceFolderOf } from './sourceFolderOf';

const ROOT = join('/', 'drive', 'Library');

describe('sourceFolderOf: one spelling', () => {
  it('answers a nested folder with forward slashes on every platform', () => {
    expect(sourceFolderOf(ROOT, join(ROOT, 'Movies', 'Heat'))).toBe(
      'Movies/Heat'
    );
  });

  it('answers a one-segment folder as before', () => {
    expect(sourceFolderOf(ROOT, join(ROOT, 'Heat (1995)'))).toBe('Heat (1995)');
  });
});
