import { describe, it, expect } from 'vitest';

import { parseLibraryQuery } from './parseLibraryQuery';

/**
 * 70, Video quality, Phase 7 (issue #670): `?quality=` read as the **Library
 * query**'s `minQuality`, the URL values the rungs lowercased. Only a value
 * the Quality pill can write reads as a minimum, the `?rating=` rule, so a
 * hand-edited URL never narrows behind a pill still saying _All qualities_.
 */
const URL_VALUES = [
  ['4k', '4K'],
  ['1080p', '1080p'],
  ['720p', '720p'],
  ['480p', '480p'],
] as const;

const parse = (search: string) =>
  parseLibraryQuery(new URLSearchParams(search));

describe('parseLibraryQuery — the minimum quality', () => {
  it('reads every value the pill writes as its rung, and only those', () => {
    for (const [value, rung] of URL_VALUES) {
      expect(parse(`?quality=${value}`).minQuality).toBe(rung);
    }
    for (const value of ['', 'sd', '8k', '1080', 'best']) {
      expect(parse(`?quality=${value}&rating=8`)).toEqual({
        sort: 'recently-added',
        minRating: 8,
      });
    }
  });

  it('takes the quality with the genre and the rating, as one query', () => {
    expect(parse('?genre=Comedy&rating=8&quality=1080p')).toEqual({
      sort: 'recently-added',
      genre: 'Comedy',
      minRating: 8,
      minQuality: '1080p',
    });
  });
});
