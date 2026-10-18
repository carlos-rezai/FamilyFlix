// @vitest-environment node
//
// 46 — Audio tracks, Phase 2: "the track on the wire" (issue #400).
//
// A stream's language tag → its base language named in English, or `null`
// for a tag that names no language a family would choose between. Pure, over
// `Intl`, and never `detectSubtitleLanguage`'s seven-language table: a file can
// carry any language, and the label is whatever its tag says.

import { describe, expect, it } from 'vitest';

import { trackLanguage } from './trackLanguage';

describe('trackLanguage — a tag it can name', () => {
  it.each([
    ['eng', 'English'],
    ['fre', 'French'],
    ['fra', 'French'],
    ['ger', 'German'],
    ['deu', 'German'],
    ['dut', 'Dutch'],
    ['jpn', 'Japanese'],
  ])('names %s as %s', (tag, name) => {
    expect(trackLanguage(tag)).toBe(name);
  });

  it('names a regional tag by its base language alone', () => {
    expect(trackLanguage('pt-BR')).toBe('Portuguese');
  });
});

describe('trackLanguage — a tag that names no language', () => {
  it('answers null for no tag', () => {
    expect(trackLanguage(null)).toBeNull();
  });

  it.each(['und', 'mul', 'zxx', 'mis', 'qaa'])('answers null for %s', (tag) => {
    expect(trackLanguage(tag)).toBeNull();
  });

  it('answers null for a malformed tag, and never throws', () => {
    expect(trackLanguage('not a tag!')).toBeNull();
  });
});
