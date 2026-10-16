import { describe, it, expect } from 'vitest';

import { shownRating, tmdbRating } from './shownRating';

/**
 * 26 — TMDB ratings (issue #370): the one client reading of the **Shown
 * rating**. The household Rating when one is stored — `0` included — else,
 * while the preference is on and a score is held, the **TMDB rating**
 * (`Math.round(score)` half-star units), else nothing.
 */
describe('shownRating', () => {
  it('gives the household Rating over any score', () => {
    expect(shownRating(6, 9.1, true)).toEqual({
      units: 6,
      source: 'household',
    });
  });

  it('gives a stored 0 as the household Rating, never falling through to TMDB', () => {
    expect(shownRating(0, 8.2, true)).toEqual({
      units: 0,
      source: 'household',
    });
  });

  it('gives the household Rating with the preference off too', () => {
    expect(shownRating(4, 8.2, false)).toEqual({
      units: 4,
      source: 'household',
    });
  });

  it('gives the rounded score from tmdb with no Rating, a score held and the preference on', () => {
    expect(shownRating(null, 7.4, true)).toEqual({ units: 7, source: 'tmdb' });
  });

  it('gives null with no Rating while the preference is off', () => {
    expect(shownRating(null, 7.4, false)).toBeNull();
  });

  it('gives null with no Rating and no score held', () => {
    expect(shownRating(null, null, true)).toBeNull();
  });

  it('rounds a half up', () => {
    expect(shownRating(null, 6.5, true)).toEqual({ units: 7, source: 'tmdb' });
  });
});

/**
 * The **TMDB rating** on its own: the score in half-star units, a half
 * rounding up, and nothing for no score — what the movie page's placeholder
 * reads, whatever the household's Rating.
 */
describe('tmdbRating', () => {
  it('gives null for no score held', () => {
    expect(tmdbRating(null)).toBeNull();
  });

  it('rounds a half up', () => {
    expect(tmdbRating(6.5)).toBe(7);
  });

  it('rounds below a half down', () => {
    expect(tmdbRating(7.4)).toBe(7);
  });

  it('keeps a whole score as it is', () => {
    expect(tmdbRating(8)).toBe(8);
  });
});
