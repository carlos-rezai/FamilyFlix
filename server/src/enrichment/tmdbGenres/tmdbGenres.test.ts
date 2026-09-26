// @vitest-environment node
//
// 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204).
//
// `tmdbGenres` — pure: TMDB's genre names → the **Genre pool**. A name the
// pool already holds is kept, _Science Fiction_ is Sci-Fi, and everything
// else is dropped: the pool is twelve names and a Sync never grows it. (The
// TV compounds — _Action & Adventure_, _Sci-Fi & Fantasy_ — are the series
// phase's.)

import { describe, expect, it } from 'vitest';

import { tmdbGenres } from './tmdbGenres';

describe('tmdbGenres: TMDB names onto the Genre pool', () => {
  it.each([
    ['Action'],
    ['Comedy'],
    ['Drama'],
    ['Horror'],
    ['Thriller'],
    ['Romance'],
    ['Documentary'],
    ['Animation'],
    ['Family'],
    ['Adventure'],
    ['Crime'],
  ])('keeps %s, a name the pool already holds', (name) => {
    expect(tmdbGenres([name])).toEqual([name]);
  });

  it('reads Science Fiction as Sci-Fi', () => {
    expect(tmdbGenres(['Science Fiction'])).toEqual(['Sci-Fi']);
  });

  it.each([
    ['Fantasy'],
    ['Mystery'],
    ['History'],
    ['Music'],
    ['War'],
    ['Western'],
    ['TV Movie'],
  ])('drops %s — the pool never grows', (name) => {
    expect(tmdbGenres([name])).toEqual([]);
  });

  it('keeps TMDB’s order, dropping what the pool lacks from among the rest', () => {
    expect(
      tmdbGenres(['Drama', 'Fantasy', 'Science Fiction', 'Mystery', 'Family'])
    ).toEqual(['Drama', 'Sci-Fi', 'Family']);
  });

  it('answers nothing for nothing', () => {
    expect(tmdbGenres([])).toEqual([]);
  });
});
