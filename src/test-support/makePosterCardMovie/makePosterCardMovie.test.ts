import { describe, it, expect } from 'vitest';

import { makePosterCardMovie } from './makePosterCardMovie';
import type { PosterCardMovie } from '@/types';

/** Every key `PosterCardMovie` declares, written out rather than derived. */
const POSTER_CARD_KEYS: Array<keyof PosterCardMovie> = [
  'id',
  'title',
  'posterUrl',
  'g1',
  'g2',
  'rating',
  'watched',
  'progress',
  'favorite',
];

describe('makePosterCardMovie — the default view model', () => {
  it('builds every field the tile renders from, none missing', () => {
    expect(Object.keys(makePosterCardMovie()).sort()).toEqual(
      [...POSTER_CARD_KEYS].sort()
    );
  });

  it('builds nothing the view model does not declare', () => {
    for (const key of Object.keys(makePosterCardMovie())) {
      expect(POSTER_CARD_KEYS).toContain(key);
    }
  });

  it('builds an unwatched, unfavorited, posterless tile', () => {
    const card = makePosterCardMovie();

    expect(card.watched).toBe(false);
    expect(card.favorite).toBe(false);
    expect(card.progress).toBe(0);
    expect(card.posterUrl).toBeNull();
  });
});

describe('makePosterCardMovie — overrides', () => {
  it('replaces exactly the field named', () => {
    const card = makePosterCardMovie({ favorite: true });

    expect(card).toEqual({ ...makePosterCardMovie(), favorite: true });
  });

  it('lets an override write the null that means unrated', () => {
    // The tile shows empty stars and no number for this, so a builder that
    // could not express it would hide the case the mapper exists to preserve.
    expect(makePosterCardMovie({ rating: null }).rating).toBeNull();
  });
});
