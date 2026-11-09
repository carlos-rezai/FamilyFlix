// @vitest-environment node
//
// 58, Folder layout (issue #545): the two rules a reader and a writer of the
// **Folder layout** share. `endsInRole` is what is already a poster or a
// backdrop in an **Images folder** (log 58 Q8): the scan reads art by it and
// the **Layout fill** writes none where it holds. `spellTrackName` names a
// second track of one language `<Language> (2)` (Q17), and `trackLanguageOf`
// reads such a name back as its language. Prior art: `folderKeyOf`'s tables.

import { describe, expect, it } from 'vitest';

import { endsInRole, spellTrackName, trackLanguageOf } from './folderLayout';

describe('endsInRole: the art of a role', () => {
  it.each([
    ['poster.png', 'poster'],
    ['moviea-2012-poster.jpg', 'poster'],
    ['heat-1995-poster.jpg', 'poster'],
    ['POSTER.JPG', 'poster'],
    ['backdrop.webp', 'backdrop'],
    ['Heat Backdrop.png', 'backdrop'],
  ])('reads %s as the %s', (filename, role) => {
    expect(endsInRole(filename, role)).toBe(true);
  });

  it.each([
    ['posterior.jpg', 'poster'],
    ['poster-old.jpg', 'poster'],
    ['poster.jpg', 'backdrop'],
    ['still.jpg', 'poster'],
  ])('reads %s as no %s', (filename, role) => {
    expect(endsInRole(filename, role)).toBe(false);
  });
});

describe('spellTrackName: a track named by its language', () => {
  it('names the first track of a language by the language alone', () => {
    expect(spellTrackName('English', 1)).toBe('English');
  });

  it.each([
    [2, 'English (2)'],
    [3, 'English (3)'],
  ])('numbers track %i of one language as %s', (count, name) => {
    expect(spellTrackName('English', count)).toBe(name);
  });
});

describe('trackLanguageOf: a track name read back', () => {
  it.each([
    ['English.srt', 'English'],
    ['English (2).srt', 'English'],
    ['Dutch.srt', 'Dutch'],
    ['Dutch (2).srt', 'Dutch'],
    ['French (12).vtt', 'French'],
    ['heat.pt.srt', 'Portuguese'],
  ])('reads %s as %s', (filename, language) => {
    expect(trackLanguageOf(filename)).toBe(language);
  });

  it.each(['Dutch', 'French', 'German'])(
    'reads a spelled second %s track back as %s',
    (language) => {
      expect(trackLanguageOf(`${spellTrackName(language, 2)}.srt`)).toBe(
        language
      );
    }
  );
});
