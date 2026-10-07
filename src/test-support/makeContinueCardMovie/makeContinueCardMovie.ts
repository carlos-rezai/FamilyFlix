import type { ContinueCardMovie } from '@/types';

/**
 * Build a complete `ContinueCardMovie` for a test, overriding only what that
 * test cares about — `makePosterCardMovie`'s rule for the resume tile.
 *
 * Three suites build this shape (ContinueCard, CardCarousel, ContinueRow), two
 * of them from the same specimen, and each had to grow `posterUrl` by hand when
 * the card learned to draw a poster. The defaults are that shared specimen,
 * adopted unchanged: a posterless film part-way through.
 */
export function makeContinueCardMovie(
  overrides: Partial<ContinueCardMovie> = {}
): ContinueCardMovie {
  return {
    id: 'm1',
    title: 'Comet Season',
    posterUrl: null,
    g1: '#1f2a3a',
    g2: '#3a6a8a',
    resumeLabel: 'Resume · 1:13 of 1:55',
    progress: 64,
    ...overrides,
  };
}
