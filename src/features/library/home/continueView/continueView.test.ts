import { describe, it, expect } from 'vitest';

import { continueView } from './continueView';
import { gradientFromId, NOMINAL_SLIVER_PERCENT } from '@/utils';
import type { Movie } from '@/types';

function makeMovie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 'm1',
    tmdbId: null,
    title: 'Comet Season',
    year: 2018,
    runtimeMinutes: 115,
    synopsis: null,
    director: null,
    cast: [],
    rating: 8,
    isFavorite: false,
    watched: false,
    resumePositionSeconds: 4380,
    status: 'in-progress',
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

describe('continueView — Movie → ContinueCardMovie mapper', () => {
  it('passes id and title straight through', () => {
    const vm = continueView(makeMovie({ id: 'abc', title: 'Northwind' }));

    expect(vm.id).toBe('abc');
    expect(vm.title).toBe('Northwind');
  });

  it('builds the full resume label from the resume position and the runtime', () => {
    // The prototype's own example: 1:13 into a 1:55 total.
    const vm = continueView(
      makeMovie({ resumePositionSeconds: 73, runtimeMinutes: 115 / 60 })
    );

    expect(vm.resumeLabel).toBe('Resume · 1:13 of 1:55');
  });

  it('renders both halves of the label past the hour for a feature-length movie', () => {
    const vm = continueView(
      makeMovie({ resumePositionSeconds: 4380, runtimeMinutes: 115 })
    );

    expect(vm.resumeLabel).toBe('Resume · 1:13:00 of 1:55:00');
  });

  it('drops the total from the label when the runtime is unknown', () => {
    const vm = continueView(
      makeMovie({ resumePositionSeconds: 73, runtimeMinutes: null })
    );

    expect(vm.resumeLabel).toBe('Resume · 1:13');
  });

  it('shows no "of --" placeholder when the runtime is unknown', () => {
    const vm = continueView(
      makeMovie({ resumePositionSeconds: 73, runtimeMinutes: null })
    );

    expect(vm.resumeLabel).not.toContain('of');
    expect(vm.resumeLabel).not.toContain('--');
  });

  it('computes progress as a percent of the runtime', () => {
    const vm = continueView(
      makeMovie({ resumePositionSeconds: 2700, runtimeMinutes: 90 })
    );

    expect(vm.progress).toBe(50);
  });

  it('uses the nominal sliver for an in-progress movie with unknown runtime', () => {
    const vm = continueView(
      makeMovie({ resumePositionSeconds: 73, runtimeMinutes: null })
    );

    expect(vm.progress).toBe(NOMINAL_SLIVER_PERCENT);
  });

  it('derives the gradient stops deterministically from the movie id', () => {
    const vm = continueView(makeMovie({ id: 'm1' }));

    expect(vm.g1).toBe(gradientFromId('m1').g1);
    expect(vm.g2).toBe(gradientFromId('m1').g2);
  });

  it('gives two different movies two different gradients', () => {
    const first = continueView(makeMovie({ id: 'm1' }));
    const second = continueView(makeMovie({ id: 'm2' }));

    expect(first.g1).not.toBe(second.g1);
  });
});
