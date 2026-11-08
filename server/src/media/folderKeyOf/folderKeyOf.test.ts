// @vitest-environment node
//
// 58, Folder layout, Phase 2: "one film in the layout" (issue #535).
//
// The **Folder key**, pure: a **Title folder**'s name in, `{ name, title,
// year }` out by `^(.+) \((\d{4})\)$`, or `null` for a name the **Folder
// layout** does not read. `spellFolderKey` is its counterpart, spelling
// `Title (Year)` from a title and a year, and the two round-trip. Prior art:
// `episodeTag`'s and `titleKey`'s tables.

import { describe, expect, it } from 'vitest';

import { folderKeyOf, spellFolderKey } from './folderKeyOf';

describe('folderKeyOf, a Title folder', () => {
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

describe('folderKeyOf, a name the layout does not read', () => {
  it.each([
    ['a year-less name', 'Drama'],
    ['a range', 'Severance (2022–)'],
    ['a release name', 'Heat.1995.1080p.BluRay.x264'],
    ['a trailing suffix', 'Heat (1995) [1080p]'],
    ['a trailing word', 'Heat (1995) Directors Cut'],
    ['a year in brackets', 'Heat [1995]'],
  ])('answers null for %s', (_label, name) => {
    expect(folderKeyOf(name)).toBeNull();
  });
});

describe('spellFolderKey, the Title (Year) speller', () => {
  it('spells a title and a year as Title (Year)', () => {
    expect(spellFolderKey('Heat', 1995)).toBe('Heat (1995)');
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
