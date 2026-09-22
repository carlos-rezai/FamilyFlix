import { describe, it, expect } from 'vitest';

import { moviePath } from './moviePath';

describe('moviePath', () => {
  it('names the film’s page for a plain id', () => {
    expect(moviePath('3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b')).toBe(
      '/movie/3f2b8c1e-5d4a-4e6f-9a7b-1c2d3e4f5a6b'
    );
  });

  it('encodes a character that cannot travel in a path as it is', () => {
    // A `/` left raw would be a second path segment — a different route.
    expect(moviePath('a/b c')).toBe('/movie/a%2Fb%20c');
  });

  it('names a route to nowhere for an empty id, never the library', () => {
    expect(moviePath('')).toBe('/movie/');
  });
});
