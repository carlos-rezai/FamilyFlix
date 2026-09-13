// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
//
// A subtitle's language, read off its filename tag onto the **Movie form**'s
// own seven names — the **Language pool** its dropdown offers, so an imported
// track is one the form could have attached by hand. Pure: a filename in, one
// of seven names out, `English` when nothing in the name says otherwise.

import { describe, expect, it } from 'vitest';

import { detectSubtitleLanguage } from './detectSubtitleLanguage';

/** The seven names, each with the tags a filename spells them by. */
const TAGS: [language: string, tags: string[]][] = [
  ['English', ['en', 'eng', 'english']],
  ['Spanish', ['es', 'spa', 'spanish']],
  ['French', ['fr', 'fre', 'fra', 'french']],
  ['German', ['de', 'ger', 'deu', 'german']],
  ['Portuguese', ['pt', 'por', 'portuguese']],
  ['Italian', ['it', 'ita', 'italian']],
  ['Dutch', ['nl', 'dut', 'nld', 'dutch']],
];

describe('detectSubtitleLanguage — each tag form onto each name', () => {
  describe.each(TAGS)('%s', (language, tags) => {
    it.each(tags)('from a dotted tag — die-hard.%s.srt', (tag) => {
      expect(detectSubtitleLanguage(`die-hard.${tag}.srt`)).toBe(language);
    });

    it.each(tags)('from an underscored tag — die-hard_%s.srt', (tag) => {
      expect(detectSubtitleLanguage(`die-hard_${tag}.srt`)).toBe(language);
    });

    it.each(tags)('from a hyphenated tag — die-hard-%s.srt', (tag) => {
      expect(detectSubtitleLanguage(`die-hard-${tag}.srt`)).toBe(language);
    });
  });

  it('reads the tag regardless of its case', () => {
    expect(detectSubtitleLanguage('Die.Hard.PT.srt')).toBe('Portuguese');
    expect(detectSubtitleLanguage('Die.Hard.German.srt')).toBe('German');
  });

  it('reads the tag on every subtitle extension', () => {
    expect(detectSubtitleLanguage('die-hard.fr.vtt')).toBe('French');
    expect(detectSubtitleLanguage('die-hard.fr.ass')).toBe('French');
    expect(detectSubtitleLanguage('die-hard.fr.sub')).toBe('French');
  });

  it('reads the tag off a bare filename as well as a path', () => {
    expect(
      detectSubtitleLanguage('/library/Die Hard (1988)/die-hard.it.srt')
    ).toBe('Italian');
    expect(
      detectSubtitleLanguage('C:\\Movies\\Die Hard (1988)\\die-hard.it.srt')
    ).toBe('Italian');
  });
});

describe('detectSubtitleLanguage — the English fallback', () => {
  it('answers English for a filename with no tag', () => {
    expect(detectSubtitleLanguage('die-hard.srt')).toBe('English');
    expect(detectSubtitleLanguage('Die.Hard.1988.1080p.srt')).toBe('English');
  });

  it('answers English for a tag the form does not offer', () => {
    // Japanese is not on the dropdown; the maintainer corrects it on the form
    // rather than the importer inventing an eighth name.
    expect(detectSubtitleLanguage('die-hard.ja.srt')).toBe('English');
    expect(detectSubtitleLanguage('die-hard.swedish.srt')).toBe('English');
  });

  it('does not read a word of the title as a tag', () => {
    // "it" is Italian's tag and "Nl" could be Dutch's, but neither is the
    // last piece before the extension here.
    expect(detectSubtitleLanguage('it-follows.srt')).toBe('English');
    expect(detectSubtitleLanguage('de-lift.1983.srt')).toBe('English');
  });
});
