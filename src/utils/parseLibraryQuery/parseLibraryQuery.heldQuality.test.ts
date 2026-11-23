import { describe, it, expect } from 'vitest';

import { parseLibraryQuery } from './parseLibraryQuery';

/**
 * 73, Header fit, Phase 3 (issue #696): the filter by quality is gone, so a
 * held `?quality=` is read past as any unknown parameter, whatever it holds.
 */
const parse = (search: string) =>
  parseLibraryQuery(new URLSearchParams(search));

describe('parseLibraryQuery — a held ?quality=', () => {
  it.each(['4k', '1080p', '720p', '480p'])(
    'reads past ?quality=%s, keeping the genre and the rating',
    (value) => {
      expect(parse(`?genre=Comedy&rating=8&quality=${value}`)).toEqual({
        sort: 'recently-added',
        genre: 'Comedy',
        minRating: 8,
      });
    }
  );
});
