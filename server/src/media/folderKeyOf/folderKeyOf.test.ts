// @vitest-environment node
//
// 58, Folder layout, Phase 2 (issue #535): the Folder key.
//
// The **Folder key**, pure: a **Title folder**'s name in, `{ name, title,
// year }` out by `^(.+) \((\d{4})\)$`, or `null` for a name the **Folder
// layout** does not read. `spellFolderKey` is its counterpart, spelling
// `Title (Year)` from a title and a year, and the two round-trip. Prior art:
// `episodeTag`'s and `titleKey`'s tables.

import { describe, expect, it } from 'vitest';

import {
  foldFolderKey,
  folderKeyOf,
  sameFolderKey,
  spellFolderKey,
} from './folderKeyOf';

describe('folderKeyOf: a Title folder', () => {
  it('reads Heat (1995) as its title and year', () => {
    expect(folderKeyOf('Heat (1995)')).toEqual({
      name: 'Heat (1995)',
      title: 'Heat',
      year: 1995,
    });
  });

  it('keeps the title as written, dots and all', () => {
    expect(folderKeyOf('Mr. & Mrs. Smith (2005)')).toEqual({
      name: 'Mr. & Mrs. Smith (2005)',
      title: 'Mr. & Mrs. Smith',
      year: 2005,
    });
  });

  it('reads a series by its first year', () => {
    expect(folderKeyOf('Severance (2022)')).toMatchObject({
      title: 'Severance',
      year: 2022,
    });
  });
});

// 64, Rescan a folder, Phase 1 (issue #618): `folderKeyOf` always answers.
// A name ending in ` (YYYY)` or a range reads that title and the first year;
// any other name is the title, verbatim, year `null`. No title guess.

describe('folderKeyOf: a yearless name', () => {
  it('reads Heat as title Heat, year null', () => {
    expect(folderKeyOf('Heat')).toEqual({
      name: 'Heat',
      title: 'Heat',
      year: null,
    });
  });

  it.each([
    ['a trailing suffix', 'Heat (1995) [1080p]'],
    ['a trailing word', 'Heat (1995) Directors Cut'],
    ['a year in brackets', 'Heat [1995]'],
    ['a release name', 'Die.Hard.1988.1080p'],
    ['a genre shelf', 'Drama'],
  ])('reads %s verbatim, year null', (_label, name) => {
    expect(folderKeyOf(name)).toEqual({ name, title: name, year: null });
  });

  it('reads (1995) alone as a defined key', () => {
    const key = folderKeyOf('(1995)');

    expect(key).not.toBeNull();
    expect(key).toBeDefined();
    expect(key?.name).toBe('(1995)');
  });
});

describe('folderKeyOf: a series range', () => {
  it.each([
    ['an open en dash range', 'Severance (2022–)'],
    ['an open hyphen range', 'Severance (2022-)'],
    ['a closed hyphen range', 'Severance (2022-2025)'],
    ['a closed en dash range', 'Severance (2022–2025)'],
  ])('reads %s by its first year', (_label, name) => {
    expect(folderKeyOf(name)).toEqual({ name, title: 'Severance', year: 2022 });
  });
});

describe('spellFolderKey: the Title (Year) speller', () => {
  it('spells a title and a year as Title (Year)', () => {
    expect(spellFolderKey('Heat', 1995)).toBe('Heat (1995)');
  });

  // 64, Rescan a folder, Phase 5 (issue #622): a yearless title's Folder key
  // is its bare title, never `Heat ()`.
  it('spells the bare title for a null year', () => {
    expect(spellFolderKey('Heat', null)).toBe('Heat');
  });

  it.each([
    ['Heat', 1995],
    ['Mr. & Mrs. Smith', 2005],
    ['Birdman (or the Unexpected Virtue of Ignorance)', 2014],
  ])('round-trips %s (%i)', (title, year) => {
    const name = spellFolderKey(title, year);

    expect(folderKeyOf(name)).toEqual({ name, title, year });
  });
});

describe('sameFolderKey: two Folder keys compared', () => {
  it.each([
    ['Heat (1995)', 'Heat (1995)'],
    ['Heat (1995)', 'heat (1995)'],
    ['AMELIE (2001)', 'Amelie (2001)'],
  ])('reads %s and %s as one key', (a, b) => {
    expect(sameFolderKey(a, b)).toBe(true);
  });

  it.each([
    ['Heat (1995)', 'Heat (1996)'],
    ['Heat (1995)', 'Heat'],
    ['Heat (1995)', 'Heat  (1995)'],
  ])('reads %s and %s as two keys', (a, b) => {
    expect(sameFolderKey(a, b)).toBe(false);
  });
});

// 61, Export round trip, Phase 5 (issue #586): Folder keys fold NFC, then
// lower case. A folder copied from a Mac names `Amélie (2001)` decomposed
// (NFD); a row Excel saved spells it composed (NFC). Both are one key.

/** `Amélie (2001)` composed, as Windows and Excel spell it. */
const AMELIE_NFC = 'Am\u00e9lie (2001)';
/** `Amélie (2001)` decomposed, as a folder copied from a Mac names it. */
const AMELIE_NFD = 'Ame\u0301lie (2001)';

describe('foldFolderKey: one fold for every Folder key', () => {
  it('folds the NFD and NFC spellings of one name equal', () => {
    expect(AMELIE_NFC).not.toBe(AMELIE_NFD);
    expect(foldFolderKey(AMELIE_NFD)).toBe(foldFolderKey(AMELIE_NFC));
  });

  it('folds case', () => {
    expect(foldFolderKey('AM\u00c9LIE (2001)')).toBe(foldFolderKey(AMELIE_NFD));
    expect(foldFolderKey('Heat (1995)')).toBe(foldFolderKey('heat (1995)'));
  });

  it('keeps different names different', () => {
    expect(foldFolderKey(AMELIE_NFC)).not.toBe(foldFolderKey('Amelie (2001)'));
    expect(foldFolderKey('Heat (1995)')).not.toBe(foldFolderKey('Heat (1996)'));
  });
});

describe('sameFolderKey: compares two folds', () => {
  it.each([
    ['NFD and NFC', AMELIE_NFD, AMELIE_NFC],
    ['NFC and NFD upper case', AMELIE_NFC, 'AME\u0301LIE (2001)'],
  ])('reads %s of one name as one key', (_label, a, b) => {
    expect(sameFolderKey(a, b)).toBe(true);
  });

  it('reads an accented and an unaccented name as two keys', () => {
    expect(sameFolderKey(AMELIE_NFD, 'Amelie (2001)')).toBe(false);
  });
});
