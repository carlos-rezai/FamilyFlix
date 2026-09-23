import { describe, it, expect } from 'vitest';

import { seriesPath } from './seriesPath';

/**
 * 22 — Series (TV), Phase 2 (issue #191): the **Series page** as a route,
 * `/series/<id>` — `moviePath`'s precedent. A Series tab poster opens it.
 */
describe('seriesPath', () => {
  it('names the series’ page for a plain id', () => {
    expect(seriesPath('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b')).toBe(
      '/series/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b'
    );
  });

  it('encodes a character that cannot travel in a path as it is', () => {
    // A `/` left raw would be a second path segment — the season page's shape.
    expect(seriesPath('a/b c')).toBe('/series/a%2Fb%20c');
  });

  it('names a route to nowhere for an empty id, never the library', () => {
    expect(seriesPath('')).toBe('/series/');
  });
});
