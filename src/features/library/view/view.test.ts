import { describe, it, expect } from 'vitest';

import { view } from './view';
import { gradientFromId, NOMINAL_SLIVER_PERCENT } from '@/utils';
import type { Movie } from '@/types';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Comet Season',
    year: 2018,
    runtimeMinutes: 90,
    synopsis: null,
    director: null,
    cast: [],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 0,
    status: 'unwatched',
    videoPath: 'Comet Season/comet.mp4',
    posterPath: null,
    backdropPath: null,
    genres: [],
    subtitles: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    lastWatchedAt: null,
    ...overrides,
  };
}

describe('view — Movie → PosterCardMovie mapper', () => {
  it('passes id and title straight through', () => {
    const vm = view(makeMovie({ id: 'abc', title: 'Northwind' }));

    expect(vm.id).toBe('abc');
    expect(vm.title).toBe('Northwind');
  });

  it('maps rating units to a 0–100 percent', () => {
    expect(view(makeMovie({ rating: 8 })).rating).toBe(80);
  });

  it('carries an unrated movie through as an absence, not as a zero score', () => {
    // The card reads this to decide whether to print a number at all, so a
    // flattened 0 here is what made "unrated" and "rated nought" the same tile.
    expect(view(makeMovie({ rating: null })).rating).toBeNull();
  });

  it('maps a movie genuinely rated zero to 0, beside the unrated null', () => {
    expect(view(makeMovie({ rating: 0 })).rating).toBe(0);
  });

  it('builds a poster URL through the image route when a poster path exists', () => {
    const vm = view(makeMovie({ posterPath: 'abc/poster.jpg' }));

    expect(vm.posterUrl).not.toBeNull();
    expect(vm.posterUrl).toContain('/api/images/abc/poster.jpg');
  });

  it('falls back to a gradient (null posterUrl) when there is no poster path', () => {
    const vm = view(makeMovie({ id: 'm1', posterPath: null }));

    expect(vm.posterUrl).toBeNull();
    expect(vm.g1).toBe(gradientFromId('m1').g1);
    expect(vm.g2).toBe(gradientFromId('m1').g2);
  });

  it('computes progress as a percent of runtime for an in-progress movie', () => {
    const vm = view(
      makeMovie({ resumePositionSeconds: 2700, runtimeMinutes: 90 })
    );

    expect(vm.progress).toBe(50);
  });

  it('uses the nominal sliver for an in-progress movie with unknown runtime', () => {
    const vm = view(
      makeMovie({ resumePositionSeconds: 2700, runtimeMinutes: null })
    );

    expect(vm.progress).toBe(NOMINAL_SLIVER_PERCENT);
  });

  it('passes watched and favorite flags through (isFavorite → favorite)', () => {
    const vm = view(makeMovie({ watched: true, isFavorite: true }));

    expect(vm.watched).toBe(true);
    expect(vm.favorite).toBe(true);
  });
});
