import { describe, it, expect } from 'vitest';

import type { LibraryQuery } from '@/types';

import { honouredLibraryQuery } from './honouredLibraryQuery';

const FILTERED: LibraryQuery = {
  sort: 'a-z',
  search: 'hard',
  genre: 'Action',
  minRating: 8,
  minQuality: '1080p',
};

describe('honouredLibraryQuery', () => {
  it('honours the whole query while Show video quality is on', () => {
    expect(honouredLibraryQuery(FILTERED, true)).toEqual(FILTERED);
  });

  it('reads past the minimum quality while it is off, and nothing else', () => {
    const honoured = honouredLibraryQuery(FILTERED, false);

    expect(honoured).toEqual({
      sort: 'a-z',
      search: 'hard',
      genre: 'Action',
      minRating: 8,
    });
    expect('minQuality' in honoured).toBe(false);
  });

  it('leaves a query with no minimum quality as it is, either way', () => {
    const unfiltered: LibraryQuery = { sort: 'a-z', genre: 'Drama' };

    expect(honouredLibraryQuery(unfiltered, true)).toEqual(unfiltered);
    expect(honouredLibraryQuery(unfiltered, false)).toEqual(unfiltered);
  });
});
