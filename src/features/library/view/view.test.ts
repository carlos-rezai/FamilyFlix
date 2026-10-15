import { describe, it, expect } from 'vitest';

import { view } from './view';
import { gradientFromId, NOMINAL_SLIVER_PERCENT } from '@/utils';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

describe('view — Movie → PosterCardMovie mapper', () => {
  it('passes id and title straight through', () => {
    const vm = view(makeMovie({ id: 'abc', title: 'Northwind' }), false);

    expect(vm.id).toBe('abc');
    expect(vm.title).toBe('Northwind');
  });

  it('maps rating units to a 0–100 percent', () => {
    expect(view(makeMovie({ rating: 8 }), false).rating).toBe(80);
  });

  it('carries an unrated movie through as an absence, not as a zero score', () => {
    // The card reads this to decide whether to print a number at all, so a
    // flattened 0 here is what made "unrated" and "rated nought" the same tile.
    expect(view(makeMovie({ rating: null }), false).rating).toBeNull();
  });

  it('maps a movie genuinely rated zero to 0, beside the unrated null', () => {
    expect(view(makeMovie({ rating: 0 }), false).rating).toBe(0);
  });

  it('builds a poster URL through the image route when a poster path exists', () => {
    const vm = view(makeMovie({ posterPath: 'abc/poster.jpg' }), false);

    expect(vm.posterUrl).not.toBeNull();
    expect(vm.posterUrl).toContain('/api/images/abc/poster.jpg');
  });

  it('falls back to a gradient (null posterUrl) when there is no poster path', () => {
    const vm = view(makeMovie({ id: 'm1', posterPath: null }), false);

    expect(vm.posterUrl).toBeNull();
    expect(vm.g1).toBe(gradientFromId('m1').g1);
    expect(vm.g2).toBe(gradientFromId('m1').g2);
  });

  it('computes progress as a percent of runtime for an in-progress movie', () => {
    const vm = view(
      makeMovie({ resumePositionSeconds: 2700, runtimeMinutes: 90 }),
      false
    );

    expect(vm.progress).toBe(50);
  });

  it('uses the nominal sliver for an in-progress movie with unknown runtime', () => {
    const vm = view(
      makeMovie({ resumePositionSeconds: 2700, runtimeMinutes: null }),
      false
    );

    expect(vm.progress).toBe(NOMINAL_SLIVER_PERCENT);
  });

  it('passes watched and favorite flags through (isFavorite → favorite)', () => {
    const vm = view(makeMovie({ watched: true, isFavorite: true }), false);

    expect(vm.watched).toBe(true);
    expect(vm.favorite).toBe(true);
  });
});

/**
 * 26 — TMDB ratings (issue #370): the card's rating is the **Shown rating** —
 * the household Rating when one is stored, else the **TMDB rating** while the
 * preference is on — and the card is told which, as its `ratingSource`.
 */
describe('view — the Shown rating under the TMDB ratings preference', () => {
  it('gives the household Rating and its source over a score, preference on', () => {
    const vm = view(makeMovie({ rating: 6, tmdbScore: 8.8 }), true);

    expect(vm.rating).toBe(60);
    expect(vm.ratingSource).toBe('household');
  });

  it('gives the household Rating and its source with the preference off', () => {
    const vm = view(makeMovie({ rating: 6, tmdbScore: 8.8 }), false);

    expect(vm.rating).toBe(60);
    expect(vm.ratingSource).toBe('household');
  });

  it('gives a stored 0 as the household Rating, never TMDB', () => {
    const vm = view(makeMovie({ rating: 0, tmdbScore: 8.8 }), true);

    expect(vm.rating).toBe(0);
    expect(vm.ratingSource).toBe('household');
  });

  it('gives the TMDB rating for an unrated movie with a score, preference on', () => {
    const vm = view(makeMovie({ rating: null, tmdbScore: 7.4 }), true);

    expect(vm.rating).toBe(70);
    expect(vm.ratingSource).toBe('tmdb');
  });

  it('leaves an unrated movie unrated with the preference off', () => {
    const vm = view(makeMovie({ rating: null, tmdbScore: 7.4 }), false);

    expect(vm.rating).toBeNull();
    expect(vm.ratingSource).toBeNull();
  });

  it('leaves an unrated movie with no score unrated, preference on', () => {
    const vm = view(makeMovie({ rating: null, tmdbScore: null }), true);

    expect(vm.rating).toBeNull();
    expect(vm.ratingSource).toBeNull();
  });
});
