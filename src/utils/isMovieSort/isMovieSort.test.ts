import { describe, it, expect } from 'vitest';

import { isMovieSort, MOVIE_SORTS } from './isMovieSort';

describe('isMovieSort', () => {
  it('accepts every sort order the API offers', () => {
    for (const sort of MOVIE_SORTS) {
      expect(isMovieSort(sort)).toBe(true);
    }
  });

  it('knows the five orders and no others', () => {
    expect(MOVIE_SORTS).toEqual([
      'recently-added',
      'a-z',
      'year',
      'highest-rated',
      'unwatched-first',
    ]);
  });

  it('rejects a value that is no sort at all', () => {
    // A hand-edited URL, or a bookmark from a build that spelled it otherwise.
    expect(isMovieSort('by-vibes')).toBe(false);
    expect(isMovieSort('')).toBe(false);
  });

  it('rejects a value that only looks like one', () => {
    expect(isMovieSort('A-Z')).toBe(false);
    expect(isMovieSort('a-z ')).toBe(false);
  });
});
