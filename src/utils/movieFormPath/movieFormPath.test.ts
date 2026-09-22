import { describe, it, expect } from 'vitest';

import { movieFormPath } from './movieFormPath';

/** The query the route carries, read back the way the form reads it. */
function queryOf(path: string): URLSearchParams {
  return new URLSearchParams(path.split('?')[1] ?? '');
}

describe('movieFormPath', () => {
  it('names the bare form for the add job', () => {
    expect(movieFormPath({})).toBe('/add');
  });

  it('names the edit job by the movie’s id', () => {
    expect(movieFormPath({ movie: 'm42' })).toBe('/add?movie=m42');
  });

  it('names the import context by the problem’s id', () => {
    expect(movieFormPath({ problem: 'p7' })).toBe('/add?problem=p7');
  });

  it('names the import context over the edit job, the movie first', () => {
    expect(movieFormPath({ movie: 'm42', problem: 'p7' })).toBe(
      '/add?movie=m42&problem=p7'
    );
  });

  it('carries an id with reserved characters back out as it went in', () => {
    // A raw `&` would start a second parameter, a raw `#` a fragment.
    const path = movieFormPath({ movie: 'm 2/y&z', problem: 'p#1?x=1' });

    expect(path.startsWith('/add?')).toBe(true);
    expect(path).not.toContain('#');
    expect(queryOf(path).get('movie')).toBe('m 2/y&z');
    expect(queryOf(path).get('problem')).toBe('p#1?x=1');
    expect([...queryOf(path).keys()]).toEqual(['movie', 'problem']);
  });
});
