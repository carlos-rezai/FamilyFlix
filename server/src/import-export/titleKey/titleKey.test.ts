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

import { titleGuess, titleKey } from './titleKey';

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

// --- 13 — Bulk import, Phase 5: the per-kind openings (issue #131) -------------
//
// The title a `no-row` **Problem** opens the form with: the **Source folder**'s
// name with the **Title key**'s tail forms dropped — and *only* those. The key
// is for comparing and folds everything away; the guess is for typing into a
// title field, so the case, the accents and the punctuation the folder kept
// are kept, and a dot or an underscore is read as the space it stands for.

describe('titleGuess — the title a no-row folder name suggests', () => {
  it('reads Harbor.Lights.2019 as “Harbor Lights”', () => {
    expect(titleGuess('Harbor.Lights.2019')).toBe('Harbor Lights');
  });

  it.each([
    ['a year in parentheses', 'Die Hard (1988)'],
    ['a year in brackets', 'Die Hard [1988]'],
    ['a bare year', 'Die Hard 1988'],
    ['a quality tag', 'Die Hard 1080p'],
    ['a year and a quality tag together', 'Die.Hard.1988.1080p'],
    ['a year and 4K', 'Die Hard (1988) 4K'],
  ])('drops the tail forms the key drops — %s', (_, name) => {
    expect(titleGuess(name)).toBe('Die Hard');
  });

  it('reads dots and underscores as spaces', () => {
    expect(titleGuess('The_Lantern_Keeper_2019')).toBe('The Lantern Keeper');
    expect(titleGuess('The.Lantern.Keeper')).toBe('The Lantern Keeper');
  });

  it('keeps the case the folder has, unlike the key', () => {
    expect(titleGuess('die hard (1988)')).toBe('die hard');
    expect(titleGuess('DIE.HARD.1988')).toBe('DIE HARD');
  });

  it('keeps the accents and the punctuation the key folds away', () => {
    expect(titleGuess('Amélie (2001)')).toBe('Amélie');
    expect(titleGuess('Léon: The Professional (1994)')).toBe(
      'Léon: The Professional'
    );
    expect(titleGuess("Ocean's Eleven.2001")).toBe("Ocean's Eleven");
    expect(titleGuess('Spider-Man.2002')).toBe('Spider-Man');
  });

  it('keeps a number that is part of the title', () => {
    expect(titleGuess("Ocean's 11")).toBe("Ocean's 11");
    expect(titleGuess('Se7en.1995')).toBe('Se7en');
  });

  it('collapses the spacing', () => {
    expect(titleGuess('  Die   Hard  (1988) ')).toBe('Die Hard');
  });

  it('leaves a name with no tail as it is', () => {
    expect(titleGuess('Ironwood')).toBe('Ironwood');
  });

  it('agrees with the key: a guess and its folder name share one key', () => {
    for (const name of [
      'Harbor.Lights.2019',
      'Amélie (2001)',
      'Die.Hard.1988.1080p',
    ]) {
      expect(titleKey(titleGuess(name))).toBe(titleKey(name));
    }
  });
});
