import { describe, it, expect } from 'vitest';

import { seriesCardView } from './seriesCardView';
import type { Series } from '@/types';

/**
 * 70, Video quality, Phase 4 (issue #669): `seriesCardView` takes the
 * **Card preferences**, `{ tmdbRatings, qualityTags }`, `view`'s signature.
 * `quality` is the **Series quality** while `qualityTags` is on and `null`
 * while it is off; `tmdbRatings` decides the **Shown rating** as the flag did.
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
    videoQuality: null,
    createdAt: '2026-09-23T00:00:00.000Z',
    updatedAt: '2026-09-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('seriesCardView: the Card preferences', () => {
  it('carries the Series quality while qualityTags is on, and null while off', () => {
    for (const rung of ['4K', '1080p', '720p', '480p', 'SD'] as const) {
      const series = makeSeries({ videoQuality: rung });
      for (const tmdbRatings of [true, false]) {
        expect(
          seriesCardView(series, { tmdbRatings, qualityTags: true }).quality
        ).toBe(rung);
        expect(
          seriesCardView(series, { tmdbRatings, qualityTags: false }).quality
        ).toBeNull();
      }
    }
    for (const qualityTags of [true, false]) {
      expect(
        seriesCardView(makeSeries({ videoQuality: null }), {
          tmdbRatings: true,
          qualityTags,
        }).quality
      ).toBeNull();
    }
  });

  it('fills an unrated series from TMDB while tmdbRatings is on, and not while off', () => {
    const series = makeSeries({ rating: null, tmdbScore: 7.4 });
    for (const qualityTags of [true, false]) {
      const on = seriesCardView(series, { tmdbRatings: true, qualityTags });
      expect(on.rating).toBe(70);
      expect(on.ratingSource).toBe('tmdb');

      const off = seriesCardView(series, { tmdbRatings: false, qualityTags });
      expect(off.rating).toBeNull();
      expect(off.ratingSource).toBeNull();
    }
  });

  it('gives the household Rating over a score under either tmdbRatings, and a rated series no TMDB fill', () => {
    const rated = makeSeries({ rating: 5, tmdbScore: 9 });
    for (const tmdbRatings of [true, false]) {
      const vm = seriesCardView(rated, { tmdbRatings, qualityTags: false });
      expect(vm.rating).toBe(50);
      expect(vm.ratingSource).toBe('household');
    }
    expect(
      seriesCardView(makeSeries({ rating: null, tmdbScore: 9 }), {
        tmdbRatings: false,
        qualityTags: false,
      }).ratingSource
    ).toBeNull();
  });
});
