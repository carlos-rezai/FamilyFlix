// @vitest-environment node
//
// 11 — Movie form, Phase 3: "the media domain" (issue #102).
//
// The name of a **Movie folder**, and half of the dangerous logic in this
// feature. It is a pure function for exactly that reason: what a title turns
// into on disk is the one decision here that a crafted input could turn into a
// path, and the cheapest place to prove it cannot is a table of strings.
//
// The rule it holds is that **every title produces a usable folder name** —
// there is no title this function may answer the empty string for, and none it
// may answer with a separator in. A film called "!!!" is a film the maintainer
// is allowed to add.

import { describe, expect, it } from 'vitest';

import { movieFolder } from './movieFolder';

/** Titles that carry nothing a folder name can be built out of. */
const NOTHING_TO_SLUG = ['!!!', '???', '---', '  ', '.', '/\\'];

/** Titles a crafted client could send in place of a real one. */
const CRAFTED = ['../../etc', '..', 'a/b', 'a\\b', 'Rear Window/../../..', ' '];

describe('movieFolder — an ordinary title', () => {
  it('joins the title and the year into one lowercase, hyphenated name', () => {
    expect(movieFolder('The Lantern Keeper', 2019)).toBe(
      'the-lantern-keeper-2019'
    );
  });

  it('leaves the year off a film whose year is not known', () => {
    // `year` is a nullable column, so a folder with no year in it is a normal
    // folder rather than a broken one — and it must not end in a stray hyphen.
    expect(movieFolder('The Lantern Keeper', null)).toBe('the-lantern-keeper');
  });

  it('drops the punctuation between the words it keeps', () => {
    expect(movieFolder("The Assassin's Creed: Part II", 2016)).toBe(
      'the-assassins-creed-part-ii-2016'
    );
  });

  it('collapses runs of whitespace and punctuation into one hyphen', () => {
    expect(movieFolder('  The   Lantern  --  Keeper!  ', 2019)).toBe(
      'the-lantern-keeper-2019'
    );
  });

  it('keeps the digits in a title that is a number', () => {
    expect(movieFolder('2001', 1968)).toBe('2001-1968');
  });
});

describe('movieFolder — a title with accents', () => {
  it('produces a readable name rather than a gapped one', () => {
    // Story 62: the **Managed media directory** stays browsable by hand. A
    // sanitiser that dropped every non-ASCII character would answer `am-lie`,
    // which is the folder the maintainer cannot find.
    expect(movieFolder('Amelie', 2001)).toBe('amelie-2001');
    expect(movieFolder('Amélie', 2001)).toBe('amelie-2001');
  });

  it('folds a whole accented title down to its letters', () => {
    expect(movieFolder('Le Fabuleux Destin d’Amélie', 2001)).toBe(
      'le-fabuleux-destin-damelie-2001'
    );
  });

  it('folds accents in every direction, not only the acute', () => {
    expect(movieFolder('Àéîõü Ñç', null)).toBe('aeiou-nc');
  });
});

describe('movieFolder — a title with nothing to build a name from', () => {
  it('still produces a usable folder for a film called "!!!"', () => {
    // Story 61. The alternative is `''`, which resolves to the media root
    // itself — a folder every such film would share and `mediaFilePath` would
    // refuse.
    expect(movieFolder('!!!', 2019)).toBe('movie-2019');
  });

  it('produces one with no year either', () => {
    expect(movieFolder('!!!', null)).toBe('movie');
  });

  it.each(NOTHING_TO_SLUG)(
    'never answers with an empty name for %j',
    (title) => {
      expect(movieFolder(title, null)).not.toBe('');
      expect(movieFolder(title, 2019)).not.toBe('');
    }
  );
});

describe('movieFolder — what it may never answer with', () => {
  it.each([...NOTHING_TO_SLUG, ...CRAFTED])(
    'carries no path separator for %j',
    (title) => {
      const folder = movieFolder(title, 2019);

      // The folder name is the first segment of every one of a movie's
      // **Stored paths**. A separator in it would be a second segment nobody
      // chose.
      expect(folder).not.toContain('/');
      expect(folder).not.toContain('\\');
    }
  );

  it.each(CRAFTED)('cannot walk out of the media root from %j', (title) => {
    const folder = movieFolder(title, 2019);

    expect(folder).not.toBe('..');
    expect(folder.split('-')).not.toContain('..');
  });

  it.each([...NOTHING_TO_SLUG, ...CRAFTED, 'Amélie', 'The Lantern Keeper'])(
    'answers in the one safe alphabet for %j',
    (title) => {
      // Lowercase letters, digits and single hyphens: what survives NTFS, a
      // case-sensitive filesystem, and the URL `/api/images/<stored path>`
      // alike.
      expect(movieFolder(title, 2019)).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  );
});

describe('movieFolder — the same title twice', () => {
  it('answers the same name both times', () => {
    // The suffixing that keeps two such films apart is `reserveFolder`'s, not
    // this one's: this function is pure, and a name that depended on what was
    // already on disk could not be.
    expect(movieFolder('The Lantern Keeper', 2019)).toBe(
      movieFolder('The Lantern Keeper', 2019)
    );
  });

  it('tells two films with the same title and different years apart', () => {
    expect(movieFolder('The Lantern Keeper', 2019)).not.toBe(
      movieFolder('The Lantern Keeper', 1998)
    );
  });
});
