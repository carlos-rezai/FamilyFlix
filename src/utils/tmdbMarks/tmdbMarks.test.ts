// 43 — TMDB ratings refactor (issue #375), Group 2: the **TMDB-marked stars**
// spelled once, for the poster card and the series page's meta line alike.

import { describe, expect, it } from 'vitest';

import { TMDB_TAG, tmdbMarks } from './tmdbMarks';

describe('tmdbMarks', () => {
  it('mutes and tags a TMDB-drawn rating', () => {
    expect(tmdbMarks('tmdb')).toEqual({ muted: true, tag: 'TMDB' });
  });

  it('leaves the household’s Rating plain', () => {
    expect(tmdbMarks('household')).toEqual({ muted: false, tag: undefined });
  });

  it('leaves unrated stars plain', () => {
    expect(tmdbMarks(null)).toEqual({ muted: false, tag: undefined });
  });

  it('spells the tag TMDB', () => {
    expect(TMDB_TAG).toBe('TMDB');
  });
});
