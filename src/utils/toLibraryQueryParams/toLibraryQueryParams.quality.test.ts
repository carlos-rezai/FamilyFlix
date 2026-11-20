import { describe, it, expect } from 'vitest';

import { toLibraryQueryParams } from './toLibraryQueryParams';
import { parseLibraryQuery } from '@/utils';
import type { VideoQuality } from '@/types';

/**
 * 70, Video quality, Phase 7 (issue #670): `minQuality` written back out as
 * `?quality=`, the rung lowercased, `parseLibraryQuery`'s exact inverse.
 */
const URL_VALUES: readonly (readonly [VideoQuality, string])[] = [
  ['4K', '4k'],
  ['1080p', '1080p'],
  ['720p', '720p'],
  ['480p', '480p'],
];

describe('toLibraryQueryParams — the minimum quality', () => {
  it('writes each rung lowercased as “quality”', () => {
    for (const [rung, value] of URL_VALUES) {
      expect(
        toLibraryQueryParams({
          sort: 'recently-added',
          minQuality: rung,
        }).toString()
      ).toBe(`quality=${value}`);
    }
  });

  it('round-trips through the parser', () => {
    for (const [rung] of URL_VALUES) {
      const query = {
        sort: 'a-z' as const,
        genre: 'Comedy',
        minRating: 8,
        minQuality: rung,
      };

      expect(parseLibraryQuery(toLibraryQueryParams(query))).toEqual(query);
    }
  });
});
