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

  it('encodes each segment, so a Still named after its video loads', () => {
    // A Still is `<video stem>.frame.jpg`, and a stem keeps its spaces.
    expect(
      imageUrl('fck-thats-delicious/season-04/Episode 5 - #1 50% off?.jpg')
    ).toBe(
      '/api/images/fck-thats-delicious/season-04/Episode%205%20-%20%231%2050%25%20off%3F.jpg'
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
