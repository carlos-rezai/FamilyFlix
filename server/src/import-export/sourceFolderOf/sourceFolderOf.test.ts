// @vitest-environment node
//
// 67, Export paths, Phase 4 (issue #647): one spelling for a Source folder.
//
// `sourceFolderOf(root, dir)` answers a folder's **Source folder**: its path
// relative to its **Library folder** `root`, with `/` on every platform, as a
// **Source file** already is. Pure, beside `placeTitleFolder`; every site that
// records or looks up a Source folder calls it, so no `relative(...)` spells
// one anywhere else. Paths are built with the platform's `join`, so on
// Windows the nested case is spelled with `\` and still answers `/`.

import { readFileSync } from 'node:fs';
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

/** The import-export domain's shipping units that record or look one up. */
const SITES = [
  'placeTitleFolder/placeTitleFolder.ts',
  'placeFilmFolder/placeFilmFolder.ts',
  'createImporter/createImporter.ts',
  'readShowFolder/readShowFolder.ts',
] as const;

const source = (site: string): string =>
  readFileSync(join(__dirname, '..', site), 'utf8');

/** A `relative(<folder>.path, …)` that spells a Source folder by hand. */
const HAND_SPELLED = /relative\(\s*\w+\.path,\s*(?!dirname\()/;

describe('sourceFolderOf: every recording and lookup site', () => {
  it.each(SITES)('%s spells its Source folder through it', (site) => {
    expect(source(site)).toMatch(/\bsourceFolderOf\(/);
  });

  it.each(SITES)('%s spells no Source folder with relative()', (site) => {
    expect(source(site)).not.toMatch(HAND_SPELLED);
  });
});
