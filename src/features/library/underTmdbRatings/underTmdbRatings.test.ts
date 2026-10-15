import { describe, it, expect } from 'vitest';

import { underTmdbRatings } from './underTmdbRatings';
import { makePosterCardMovie } from '@/test-support/makePosterCardMovie/makePosterCardMovie';

const household = makePosterCardMovie({
  id: 'h',
  rating: 60,
  ratingSource: 'household',
});
const tmdb = makePosterCardMovie({ id: 't', rating: 70, ratingSource: 'tmdb' });

describe('underTmdbRatings', () => {
  it('passes the cards through untouched while on', () => {
    const cards = [household, tmdb];
    expect(underTmdbRatings(cards, true)).toBe(cards);
  });

  it('takes TMDB ratings back to unrated while off, the household one kept', () => {
    expect(underTmdbRatings([household, tmdb], false)).toEqual([
      household,
      { ...tmdb, rating: null, ratingSource: null },
    ]);
  });
});
