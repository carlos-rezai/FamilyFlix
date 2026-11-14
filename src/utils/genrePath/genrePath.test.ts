import { describe, it, expect } from 'vitest';

import { genrePath } from './genrePath';

/**
 * 63, Row view, the closing round (issue #616): a genre's Genre page as a
 * pure route, built once for both tabs' _View all_.
 */
describe('genrePath', () => {
  it('is a clean path at the default sort on Movies', () => {
    expect(genrePath('Drama', { tab: 'movies' })).toBe('/genre/Drama');
    expect(genrePath('Drama', { sort: 'recently-added', tab: 'movies' })).toBe(
      '/genre/Drama'
    );
  });

  it('encodes the genre name', () => {
    expect(genrePath('Science Fiction', { tab: 'movies' })).toBe(
      '/genre/Science%20Fiction'
    );
  });

  it('carries a sort other than the default', () => {
    expect(genrePath('Drama', { sort: 'a-z', tab: 'movies' })).toBe(
      '/genre/Drama?sort=a-z'
    );
  });

  it('writes the Series tab after the sort', () => {
    expect(genrePath('Drama', { tab: 'series' })).toBe(
      '/genre/Drama?tab=series'
    );
    expect(genrePath('Drama', { sort: 'a-z', tab: 'series' })).toBe(
      '/genre/Drama?sort=a-z&tab=series'
    );
  });
});
