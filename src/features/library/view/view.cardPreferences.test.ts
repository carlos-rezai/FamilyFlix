import { describe, it, expect } from 'vitest';

import { view } from './view';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

/**
 * 70, Video quality, Phase 4 (issue #669): `view` takes the **Card
 * preferences**, `{ tmdbRatings, qualityTags }`, as one options object in
 * place of its positional flag. `quality` is the movie's `videoQuality` while
 * `qualityTags` is on and `null` while it is off; `tmdbRatings` decides the
 * **Shown rating** exactly as the flag did, whatever `qualityTags` says.
 */

describe('view: the Card preferences', () => {
  it('carries videoQuality while qualityTags is on, and null while off', () => {
    for (const rung of ['4K', '1080p', '720p', '480p', 'SD'] as const) {
      const movie = makeMovie({ videoQuality: rung });
      for (const tmdbRatings of [true, false]) {
        expect(view(movie, { tmdbRatings, qualityTags: true }).quality).toBe(
          rung
        );
        expect(
          view(movie, { tmdbRatings, qualityTags: false }).quality
        ).toBeNull();
      }
    }
    for (const qualityTags of [true, false]) {
      expect(
        view(makeMovie({ videoQuality: null }), {
          tmdbRatings: true,
          qualityTags,
        }).quality
      ).toBeNull();
    }
  });

  it('fills an unrated movie from TMDB while tmdbRatings is on, and not while off', () => {
    const movie = makeMovie({ rating: null, tmdbScore: 7.4 });
    for (const qualityTags of [true, false]) {
      const on = view(movie, { tmdbRatings: true, qualityTags });
      expect(on.rating).toBe(70);
      expect(on.ratingSource).toBe('tmdb');

      const off = view(movie, { tmdbRatings: false, qualityTags });
      expect(off.rating).toBeNull();
      expect(off.ratingSource).toBeNull();
    }
  });

  it('gives the household Rating over a score under either tmdbRatings, and a rated movie no TMDB fill', () => {
    const rated = makeMovie({ rating: 6, tmdbScore: 8.8 });
    for (const tmdbRatings of [true, false]) {
      const vm = view(rated, { tmdbRatings, qualityTags: false });
      expect(vm.rating).toBe(60);
      expect(vm.ratingSource).toBe('household');
    }
    // An unrated movie with tmdbRatings off stays unrated though the
    // options object itself is truthy: the flag is read, not the object.
    expect(
      view(makeMovie({ rating: null, tmdbScore: 8.8 }), {
        tmdbRatings: false,
        qualityTags: false,
      }).ratingSource
    ).toBeNull();
  });
});
