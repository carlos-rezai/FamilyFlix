import { describe, expect, it } from 'vitest';

import type { AudioTrack } from '@/types';

import { preferredAudio } from './preferredAudio';

/**
 * 46 — Audio tracks, Phase 4: "the opening" (issue #402).
 *
 * Which of a file's offered **Audio tracks** the player opens on —
 * `preferredSubtitle`'s twin. The track the **Audio choice** speaks; else the
 * first track in the preferred language, compared without case; else the track the file marks default; else the
 * first; `null` for a file with none to offer.
 *
 * The tracks arrive in index order, labelled by the server, so a match is read
 * off `language` — the English name the server gave the tag — never the label.
 */
function audio(overrides: Partial<AudioTrack> = {}): AudioTrack {
  return {
    index: 0,
    language: 'English',
    label: 'English',
    fileDefault: false,
    path: 'direct',
    ...overrides,
  };
}

const ENGLISH = audio({ index: 0, language: 'English', label: 'English' });
const SPANISH = audio({
  index: 1,
  language: 'Spanish',
  label: 'Spanish',
  path: 'remux',
});
const FRENCH = audio({
  index: 2,
  language: 'French',
  label: 'French',
  path: 'remux',
});

describe('preferredAudio — the preferred language first', () => {
  it('opens on the track in the preferred language', () => {
    expect(preferredAudio([ENGLISH, SPANISH, FRENCH], 'Spanish')).toEqual(
      SPANISH
    );
  });

  it('treats Spanish and spanish as one language', () => {
    expect(preferredAudio([ENGLISH, SPANISH], 'spanish')).toEqual(SPANISH);
    expect(preferredAudio([ENGLISH, SPANISH], 'SPANISH')).toEqual(SPANISH);
  });

  it('takes the first of two tracks in the preferred language', () => {
    // A film with the feature and its commentary both in English opens on the
    // feature, which is the one that comes first.
    const commentary = audio({
      index: 2,
      language: 'English',
      label: 'English · Commentary',
      path: 'remux',
    });

    expect(preferredAudio([SPANISH, ENGLISH, commentary], 'English')).toEqual(
      ENGLISH
    );
  });

  it('wins over the track the file marks default', () => {
    const defaultEnglish = { ...ENGLISH, fileDefault: true };

    expect(preferredAudio([defaultEnglish, SPANISH], 'Spanish')).toEqual(
      SPANISH
    );
  });

  it('passes over a track with no language rather than matching it', () => {
    const untagged = audio({ index: 0, language: null, label: 'Track 1' });

    expect(preferredAudio([untagged, SPANISH], 'Spanish')).toEqual(SPANISH);
  });
});

describe('preferredAudio — no track in the preferred language', () => {
  it('opens on the track the file marks default', () => {
    const defaultFrench = { ...FRENCH, fileDefault: true };

    expect(preferredAudio([ENGLISH, SPANISH, defaultFrench], 'German')).toEqual(
      defaultFrench
    );
  });

  it('opens on the first track when the file marks none default', () => {
    expect(preferredAudio([ENGLISH, SPANISH], 'German')).toEqual(ENGLISH);
  });

  it('opens on the file default with no preference at all', () => {
    // A refused settings read is no preference — not English.
    const defaultSpanish = { ...SPANISH, fileDefault: true };

    expect(preferredAudio([ENGLISH, defaultSpanish], undefined)).toEqual(
      defaultSpanish
    );
  });

  it('opens on the first track with no preference and no default', () => {
    expect(preferredAudio([ENGLISH, SPANISH], undefined)).toEqual(ENGLISH);
  });

  it('opens on a track with no language when it is the first', () => {
    const untagged = audio({ index: 0, language: null, label: 'Track 1' });

    expect(preferredAudio([untagged, SPANISH], 'German')).toEqual(untagged);
  });
});

describe('preferredAudio — the Audio choice ahead of the preference', () => {
  it('opens on the track the choice speaks, over the preference', () => {
    expect(
      preferredAudio([ENGLISH, SPANISH, FRENCH], 'English', 'French')
    ).toEqual(FRENCH);
  });

  it('falls to the preference, not the file default, when no track speaks the choice', () => {
    const defaultFrench = { ...FRENCH, fileDefault: true };

    expect(
      preferredAudio([ENGLISH, SPANISH, defaultFrench], 'Spanish', 'German')
    ).toEqual(SPANISH);
  });

  it('reads a null choice as no choice', () => {
    expect(preferredAudio([ENGLISH, SPANISH], 'Spanish', null)).toEqual(
      SPANISH
    );
  });

  it('treats a choice differing only in case as the track’s language', () => {
    expect(preferredAudio([ENGLISH, SPANISH], 'English', 'spanish')).toEqual(
      SPANISH
    );
  });
});

describe('preferredAudio — nothing to offer', () => {
  it('answers null for a file with no tracks', () => {
    expect(preferredAudio([], 'English')).toBeNull();
    expect(preferredAudio([], undefined)).toBeNull();
  });
});
