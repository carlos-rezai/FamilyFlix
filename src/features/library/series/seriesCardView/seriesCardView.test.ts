import { describe, it, expect } from 'vitest';

import { seriesCardView } from './seriesCardView';
import type { Series } from '@/types';
import { gradientFromId } from '@/utils';

/**
 * 22 — Series (TV), Phase 1 (issue #190): _All series_ is the Library grid of
 * unchanged Poster cards, so each series is mapped to the `PosterCardMovie` a
 * card already renders — the `view` mapper's precedent. Gradient art off the
 * series id when there is no poster, the watched badge when every episode is
 * watched, no progress bar ever: a series carries no resume position.
 */

function makeSeries(overrides: Partial<Series> = {}): Series {
  return {
    id: 's1',
    tmdbId: null,
    title: 'Harbor & Vine',
    year: 2021,
    endYear: null,
    synopsis: null,
    creator: 'Mara Quinn',
    cast: [],
    rating: 8,
    isFavorite: false,
    posterPath: null,
    backdropPath: null,
    originalTitle: null,
    tmdbScore: null,
    genres: [],
    watched: false,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('seriesCardView', () => {
  it('carries the id and title through', () => {
    const card = seriesCardView(makeSeries({ id: 's7', title: 'Lighthouse' }));

    expect(card.id).toBe('s7');
    expect(card.title).toBe('Lighthouse');
  });

  it('falls back to Gradient art off the series id when there is no poster', () => {
    const card = seriesCardView(makeSeries({ id: 's9', posterPath: null }));

    expect(card.posterUrl).toBeNull();
    const { g1, g2 } = gradientFromId('s9');
    expect(card.g1).toBe(g1);
    expect(card.g2).toBe(g2);
  });

  it('points a held poster at the image route', () => {
    const card = seriesCardView(
      makeSeries({ posterPath: 'harbor-vine-2021/poster.jpg' })
    );

    expect(card.posterUrl).toBe('/api/images/harbor-vine-2021/poster.jpg');
  });

  it('is watched when every episode is watched, and not otherwise', () => {
    expect(seriesCardView(makeSeries({ watched: true })).watched).toBe(true);
    expect(seriesCardView(makeSeries({ watched: false })).watched).toBe(false);
  });

  it('draws no progress — a series has no resume position of its own', () => {
    expect(seriesCardView(makeSeries({ watched: false })).progress).toBe(0);
  });

  it('scales the rating to a percent, and keeps an unrated series unrated', () => {
    expect(seriesCardView(makeSeries({ rating: 8 })).rating).toBe(80);
    expect(seriesCardView(makeSeries({ rating: null })).rating).toBeNull();
  });

  it('carries the favorite flag as favorite', () => {
    expect(seriesCardView(makeSeries({ isFavorite: true })).favorite).toBe(
      true
    );
  });
});
