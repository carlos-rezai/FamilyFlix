import { describe, it, expect } from 'vitest';

import { episodePlayPath } from './episodePlayPath';
import { episodePlayPath as fromBarrel } from '@/utils';

/**
 * 22 — Series (TV), Phase 4 (issue #194): the player on an episode, as a
 * route — `/episode/<id>/play`. `moviePath`'s precedent: the id encoded so it
 * travels as one path segment however it is spelled.
 */
describe('episodePlayPath', () => {
  it('names the player on an episode for a plain id', () => {
    expect(episodePlayPath('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b')).toBe(
      '/episode/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b/play'
    );
  });

  it('encodes a character that cannot travel in a path as it is', () => {
    // A `/` left raw would be a second path segment — a different route.
    expect(episodePlayPath('a/b c')).toBe('/episode/a%2Fb%20c/play');
  });

  it('is re-exported by the utils barrel', () => {
    expect(fromBarrel('e1')).toBe('/episode/e1/play');
  });
});
