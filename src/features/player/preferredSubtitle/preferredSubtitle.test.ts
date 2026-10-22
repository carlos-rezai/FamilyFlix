import { describe, expect, it } from 'vitest';

import type { Subtitle } from '@/types';

import { preferredSubtitle } from './preferredSubtitle';

/**
 * 10 — Video player, Phase 6: "subtitles" (issue #88).
 *
 * Which of a film's **Subtitles** becomes the **Subtitle track** when CC is
 * pressed. Preferred language first, then track order — and **nobody chooses**:
 * the prototype draws a plain CC toggle, and a picker behind it would be new UI
 * rather than a translation of one.
 *
 * That makes determinism the property under test. With no picker, a film that
 * opened in Portuguese yesterday and English today would have nothing the
 * family could do about it, so the answer has to be a pure function of the rows
 * and the preference.
 *
 * The preference itself has no source yet — the Settings default-language
 * dropdown is a later initiative — so the parameter is optional and today's
 * every call omits it. It is here rather than added later because the fallback
 * is the interesting half, and it only reads as a fallback if there is
 * something to fall back from.
 */
function track(overrides: Partial<Subtitle> = {}): Subtitle {
  return {
    id: 's1',
    path: 'Northwind (2018)/en.srt',
    language: 'en',
    position: 0,
    ...overrides,
  };
}

/** Three tracks, deliberately not in position order in the array. */
const TRACKS: Subtitle[] = [
  track({ id: 's3', path: 'nl.srt', language: 'nl', position: 2 }),
  track({ id: 's1', path: 'pt.srt', language: 'pt', position: 0 }),
  track({ id: 's2', path: 'en.srt', language: 'en', position: 1 }),
];

describe('preferredSubtitle', () => {
  it('picks the track in the preferred language', () => {
    expect(preferredSubtitle(TRACKS, 'en')?.id).toBe('s2');
  });

  it('falls back to track order when no language is preferred', () => {
    // Which is every call today: nothing in the app can express a preference
    // until the Settings dropdown ships, and the film still has to open with
    // one line rather than none.
    expect(preferredSubtitle(TRACKS)?.id).toBe('s1');
  });

  it('falls back to track order when the preferred language is not among them', () => {
    // A default of Portuguese on a film that only has English is still a film
    // with subtitles.
    expect(preferredSubtitle(TRACKS, 'de')?.id).toBe('s1');
  });

  it('reads track order from position, not from the order the rows arrived in', () => {
    // The array above is deliberately shuffled. Taking `subtitles[0]` would
    // pass on a film whose rows happened to come back sorted and fail on the
    // next one.
    expect(preferredSubtitle(TRACKS)?.language).toBe('pt');
  });

  it('picks the lowest-positioned track when the language matches more than one', () => {
    const twoEnglish: Subtitle[] = [
      track({ id: 'forced', language: 'en', position: 3 }),
      track({ id: 'full', language: 'en', position: 1 }),
    ];

    expect(preferredSubtitle(twoEnglish, 'en')?.id).toBe('full');
  });

  it('matches a language however either side is capitalised', () => {
    // The rows are whatever the importer wrote, and a preference is whatever a
    // dropdown will later hand over. `EN` and `en` are one language.
    expect(preferredSubtitle([track({ language: 'EN' })], 'en')?.language).toBe(
      'EN'
    );
  });

  it('answers the same track every time it is asked, for the same film', () => {
    // The deterministic-across-repeat-opens acceptance criterion, stated
    // directly: no picker means no way to correct a choice that wandered.
    const first = preferredSubtitle(TRACKS, 'en');
    const second = preferredSubtitle(TRACKS, 'en');
    const third = preferredSubtitle([...TRACKS].reverse(), 'en');

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it('answers nothing for a film with no subtitle files', () => {
    // Which is what the CC button not being drawn at all is decided from.
    expect(preferredSubtitle([])).toBeNull();
  });
});

/**
 * 50, Subtitle picker, Phase 6: "the choice, decided in the hook" (issue #440).
 *
 * A third argument, the **Subtitle choice** carried from an earlier player in
 * the sitting, as `preferredAudio` has: the first row in track order in the
 * choice's language, else the preference's, else the first. `null` and absent
 * are no choice, and the answer is as before.
 */
describe('preferredSubtitle: the Subtitle choice ahead of the preference', () => {
  it('picks the track the choice speaks, over the preference', () => {
    expect(preferredSubtitle(TRACKS, 'en', 'nl')?.id).toBe('s3');
  });

  it('falls to the preference when no row speaks the choice', () => {
    expect(preferredSubtitle(TRACKS, 'en', 'de')?.id).toBe('s2');
  });

  it('falls to track order when neither the choice nor the preference is spoken', () => {
    expect(preferredSubtitle(TRACKS, 'fr', 'de')?.id).toBe('s1');
  });

  it('picks the lowest-positioned of two rows in the choice', () => {
    const twoDutch: Subtitle[] = [
      ...TRACKS,
      track({ id: 'nl-forced', language: 'nl', position: 7 }),
      track({ id: 'nl-full', language: 'nl', position: 1.5 }),
    ];

    expect(preferredSubtitle(twoDutch, 'en', 'nl')?.id).toBe('nl-full');
  });

  it('matches a choice however either side is capitalised', () => {
    expect(preferredSubtitle(TRACKS, 'en', 'NL')?.id).toBe('s3');
  });

  it('reads a null choice as no choice', () => {
    expect(preferredSubtitle(TRACKS, 'en', null)?.id).toBe('s2');
    expect(preferredSubtitle(TRACKS, undefined, null)?.id).toBe('s1');
  });
});
