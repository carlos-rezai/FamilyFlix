import { describe, it, expect } from 'vitest';

import { seasonPath } from './seasonPath';

/**
 * 22 — Series (TV), Phase 2 (issue #192): the **Season page** as a route,
 * `/series/<id>/season/<n>` — beneath the series' own page, `seriesPath`'s
 * precedent. A Season card opens it.
 */
describe('seasonPath', () => {
  it('names a season beneath its series’ page', () => {
    expect(seasonPath('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b', 2)).toBe(
      '/series/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b/season/2'
    );
  });

  it('writes the season number bare — no padding', () => {
    expect(seasonPath('harbor', 12)).toBe('/series/harbor/season/12');
    expect(seasonPath('harbor', 1)).toBe('/series/harbor/season/1');
  });

  it('encodes a series id that cannot travel in a path as it is', () => {
    expect(seasonPath('a/b c', 1)).toBe('/series/a%2Fb%20c/season/1');
  });
});
