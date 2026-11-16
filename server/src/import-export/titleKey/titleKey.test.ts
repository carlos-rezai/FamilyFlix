// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
//
// The **Title key**: the normalised form of a title or a **Source folder** name
// that matching compares. It is the heuristic that will be tuned against the
// real folder names, which is exactly why it is a pure function with a table
// of examples rather than a regular expression inside the matcher — every
// spelling the family's shelves turn out to use becomes one more row here.

import { describe, expect, it } from 'vitest';

import * as titleKeyUnit from './titleKey';
import { RELEASE_NOISE, searchQuery, titleKey } from './titleKey';

describe('titleKey — the fixture’s own pair', () => {
  it('reads Die.Hard.1988.1080p as “Die Hard”', () => {
    expect(titleKey('Die.Hard.1988.1080p')).toBe('die hard');
    expect(titleKey('Die Hard')).toBe('die hard');
  });

  it('gives a title and its folder spelling the same key', () => {
    expect(titleKey('Amélie')).toBe(titleKey('Amelie (2001)'));
    expect(titleKey('The Lantern Keeper')).toBe(
      titleKey('The_Lantern_Keeper_2019')
    );
  });
});

describe('titleKey — each normalisation on its own', () => {
  it('lowers the case', () => {
    expect(titleKey('DIE HARD')).toBe('die hard');
  });

  it('strips diacritics', () => {
    expect(titleKey('Amélie')).toBe('amelie');
    expect(titleKey('Léon')).toBe('leon');
    expect(titleKey('Ådalen')).toBe('adalen');
  });

  it('reads dots and underscores as spaces', () => {
    expect(titleKey('Die.Hard')).toBe('die hard');
    expect(titleKey('Die_Hard')).toBe('die hard');
  });

  it.each([
    ['in parentheses', 'Die Hard (1988)'],
    ['in brackets', 'Die Hard [1988]'],
    ['bare', 'Die Hard 1988'],
    ['dotted', 'Die.Hard.1988'],
  ])('drops a trailing year %s', (_, name) => {
    expect(titleKey(name)).toBe('die hard');
  });

  it.each([
    ['1080p', 'Die Hard 1080p'],
    ['720p', 'Die Hard 720p'],
    ['2160p', 'Die Hard 2160p'],
    ['4K', 'Die Hard 4K'],
  ])('drops a trailing quality tag — %s', (_, name) => {
    expect(titleKey(name)).toBe('die hard');
  });

  it('drops a year and a quality tag together, in either spelling', () => {
    expect(titleKey('Die Hard (1988) 1080p')).toBe('die hard');
    expect(titleKey('Die.Hard.1988.720p')).toBe('die hard');
  });

  it('drops punctuation', () => {
    expect(titleKey('Léon: The Professional')).toBe('leon the professional');
    expect(titleKey("Ocean's Eleven")).toBe('oceans eleven');
  });

  it('collapses the spacing', () => {
    expect(titleKey('  Die   Hard ')).toBe('die hard');
  });

  it('keeps letters and digits that are part of the title', () => {
    expect(titleKey('Se7en')).toBe('se7en');
    expect(titleKey('Ocean’s 11')).toBe('oceans 11');
  });
});

// --- 42 — Review at scale: a messy title is found (issue #355) -----------------
//
// The **Search query**: a title as TMDB is asked it. The Title key's tail strip,
// **Release noise** dropped — whole words, and everything after the first of
// them — curly quotes and dashes folded to ASCII, `&` read as `and`, and every
// other non-letter-or-digit a space. Not the **Title key**: the case and the
// accents stay, because TMDB is the one comparing.

describe('RELEASE_NOISE — the whole-word tags no title carries', () => {
  it('lists the tags a release name lays down, lower-cased', () => {
    expect([...RELEASE_NOISE]).toEqual(
      expect.arrayContaining(['bluray', 'x264', 'remux'])
    );
  });
});

describe('searchQuery — a title as TMDB is asked it', () => {
  it.each<[string, string, string]>([
    [
      'an apostrophe TMDB does not fold becomes a space',
      "F'ck That's Delicious",
      'F ck That s Delicious',
    ],
    [
      'a colon becomes a space',
      'Léon: The Professional',
      'Léon The Professional',
    ],
    ['a hyphen becomes a space', 'Spider-Man', 'Spider Man'],
    ['a title with nothing to fold stays as it is', 'Heat', 'Heat'],
    ['a number that is part of the title stays', 'Se7en', 'Se7en'],
    [
      'the tail strip: a year and a quality tag',
      'Die.Hard.1988.1080p',
      'Die Hard',
    ],
    [
      'a whole release name: noise and the group after it dropped',
      'Heat.1995.1080p.BluRay.x264-GRP',
      'Heat',
    ],
    ['BluRay and what follows', 'Heat 1995 BluRay GRP', 'Heat'],
    ['x264 and what follows', 'Heat.1995.x264-GRP', 'Heat'],
    ['WEB-DL and what follows', 'Heat.2160p.WEB-DL.x265-GRP', 'Heat'],
    ['REMUX and what follows', 'Heat.1995.REMUX.GRP', 'Heat'],
    ['noise in any case', 'Heat.1995.bluray', 'Heat'],
    [
      'noise only as a whole word: a word that contains a tag stays',
      'Remuxed Dreams',
      'Remuxed Dreams',
    ],
    [
      'a curly apostrophe folds as the straight one does',
      'Ocean’s Eleven',
      'Ocean s Eleven',
    ],
    ['curly double quotes fold away', '“Heat”', 'Heat'],
    ['an en dash folds as a hyphen does', 'Spider–Man', 'Spider Man'],
    ['an em dash folds as a hyphen does', 'Spider—Man', 'Spider Man'],
    ['& reads as and', 'Fast & Furious', 'Fast and Furious'],
    ['the spacing collapses', '  Die   Hard  ', 'Die Hard'],
  ])('%s', (_, title, query) => {
    expect(searchQuery(title)).toBe(query);
  });

  it('folds a curly spelling and its ASCII twin to one query', () => {
    expect(searchQuery('Ocean’s Eleven')).toBe(searchQuery("Ocean's Eleven"));
    expect(searchQuery('Spider–Man')).toBe(searchQuery('Spider-Man'));
  });
});

// --- 65 — Show folder title: the guess retires (issue #631) --------------------
//
// A picked Show folder reads its title by the **Folder key**, so the unit keeps
// only the key and the **Search query**: nothing else a folder name suggests.

describe('the titleKey unit — the key and the Search query, nothing more', () => {
  it('exports the Title key, the Search query and what they share', () => {
    expect(Object.keys(titleKeyUnit).sort()).toEqual([
      'DASHES',
      'RELEASE_NOISE',
      'searchQuery',
      'titleKey',
    ]);
  });
});
