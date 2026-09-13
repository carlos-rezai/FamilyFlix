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

import { titleKey } from './titleKey';

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
