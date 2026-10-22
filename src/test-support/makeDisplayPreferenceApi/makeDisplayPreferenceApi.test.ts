import { describe, it, expect } from 'vitest';

import { makeDisplayPreferenceApi } from './makeDisplayPreferenceApi';
import type { DisplayPreferenceApi } from '@/App/useDisplayPreference/useDisplayPreference';

/**
 * Every member `DisplayPreferenceApi` declares, written out by hand rather
 * than derived from the type: a type cannot be enumerated at runtime, and
 * deriving this list from the builder would only assert the builder against
 * itself.
 */
const API_KEYS: Array<keyof DisplayPreferenceApi> = [
  'ultrawideMargins',
  'setUltrawideMargins',
  'tmdbRatings',
  'setTmdbRatings',
  'startTab',
  'setStartTab',
];

describe('makeDisplayPreferenceApi: the blank state', () => {
  it('builds every member the type declares, and nothing else', () => {
    expect(Object.keys(makeDisplayPreferenceApi()).sort()).toEqual(
      [...API_KEYS].sort()
    );
  });

  it('holds every value blank, before any read lands', () => {
    const api = makeDisplayPreferenceApi();

    expect(api.ultrawideMargins).toBeNull();
    expect(api.tmdbRatings).toBeNull();
    expect(api.startTab).toBeNull();
  });

  it('resolves every setter, so a press never rejects', async () => {
    const api = makeDisplayPreferenceApi();

    await expect(api.setUltrawideMargins(true)).resolves.toBeUndefined();
    await expect(api.setTmdbRatings(true)).resolves.toBeUndefined();
    await expect(api.setStartTab('series')).resolves.toBeUndefined();
  });
});

describe('makeDisplayPreferenceApi: overrides', () => {
  it('replaces exactly the member named', () => {
    const api = makeDisplayPreferenceApi({ tmdbRatings: true });

    expect(api.tmdbRatings).toBe(true);
    expect(api.ultrawideMargins).toBeNull();
    expect(api.startTab).toBeNull();
  });
});
