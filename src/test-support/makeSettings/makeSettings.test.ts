import { describe, it, expect } from 'vitest';

import { makeSettings } from './makeSettings';
import type { Settings } from '@/types';

/**
 * Every key `Settings` declares, written out by hand rather than derived from
 * the type: a type cannot be enumerated at runtime, and deriving this list
 * from the builder would only assert the builder against itself.
 */
const SETTINGS_KEYS: Array<keyof Settings> = [
  'subtitleLanguage',
  'audioLanguage',
  'ultrawideMargins',
  'tmdbRatings',
  'startTab',
];

describe('makeSettings: the default household', () => {
  it('builds every preference the type declares, and nothing else', () => {
    expect(Object.keys(makeSettings()).sort()).toEqual(
      [...SETTINGS_KEYS].sort()
    );
  });

  it('builds the household a fresh database answers', () => {
    expect(makeSettings()).toEqual({
      subtitleLanguage: 'English',
      audioLanguage: 'English',
      ultrawideMargins: false,
      tmdbRatings: true,
      startTab: 'movies',
    });
  });
});

describe('makeSettings: overrides', () => {
  it('replaces exactly the preference named', () => {
    expect(makeSettings({ startTab: 'series' })).toEqual({
      ...makeSettings(),
      startTab: 'series',
    });
  });
});
