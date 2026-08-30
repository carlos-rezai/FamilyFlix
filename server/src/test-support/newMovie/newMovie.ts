import type { NewMovie } from '@/types';

/**
 * The minimal valid input to `addMovie` — `title` and `videoPath` are the only
 * required fields — overridable per test.
 *
 * Seven `library/` test files carried this verbatim. It sits on the rung rather
 * than in `library/` because Add Movie and bulk import will want the same
 * builder, and neither of those is a `library/` test.
 */
export function newMovie(overrides: Partial<NewMovie> = {}): NewMovie {
  return {
    title: 'Northwind',
    videoPath: 'Northwind (2018)/northwind.mkv',
    ...overrides,
  };
}
