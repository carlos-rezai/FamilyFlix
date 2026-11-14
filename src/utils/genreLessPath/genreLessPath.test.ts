import { describe, it, expect } from 'vitest';

import { genreLessPath } from './genreLessPath';

/**
 * 63, Row view, the closing round (issue #616): the Other row's _View all_ as
 * a pure route, `genrePath`'s rules over `/genre-less`.
 */
describe('genreLessPath', () => {
  it('is a clean path at the default sort on Movies', () => {
    expect(genreLessPath({ tab: 'movies' })).toBe('/genre-less');
  });

  it('carries a sort other than the default', () => {
    expect(genreLessPath({ sort: 'a-z', tab: 'movies' })).toBe(
      '/genre-less?sort=a-z'
    );
  });

  it('writes the Series tab after the sort', () => {
    expect(genreLessPath({ tab: 'series' })).toBe('/genre-less?tab=series');
    expect(genreLessPath({ sort: 'a-z', tab: 'series' })).toBe(
      '/genre-less?sort=a-z&tab=series'
    );
  });
});
