import { describe, it, expect } from 'vitest';

import { imageUrl } from './imageUrl';
import * as utils from '@/utils';
import { shippingSourcesMatching } from '@/test-support/shippingSources/shippingSources';

describe('imageUrl', () => {
  it('serves a Stored path from the image route', () => {
    expect(imageUrl('comet-season/poster.jpg')).toBe(
      '/api/images/comet-season/poster.jpg'
    );
  });

  it('gives null for a title with no image', () => {
    expect(imageUrl(null)).toBeNull();
  });

  it('is re-exported from the utils barrel', () => {
    expect(utils.imageUrl('a/poster.jpg')).toBe('/api/images/a/poster.jpg');
  });

  it('is the one shipping file that spells the image route', () => {
    // The six local copies — the library view, the series card view, the
    // detail view, the series view, the season view and the player — are gone.
    expect(shippingSourcesMatching('src', /\/api\/images\//)).toEqual([
      'src/utils/imageUrl/imageUrl.ts',
    ]);
  });
});
