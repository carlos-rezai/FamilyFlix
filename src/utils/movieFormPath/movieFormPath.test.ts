import { describe, it, expect } from 'vitest';

import { movieFormPath, opensSeriesResolve } from './movieFormPath';

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

/**
 * 38 — Title editing, Slice 4 (issue #307): the **Series edit job**,
 * `/add?series=<id>`, the series ⋯ menu's _Edit details_.
 */
describe('movieFormPath — the Series edit job', () => {
  it('names the series edit job by the series’ id', () => {
    expect(movieFormPath({ series: 'harbor' })).toBe('/add?series=harbor');
  });

  it('carries a series id with reserved characters back out as it went in', () => {
    const path = movieFormPath({ series: 's 2/y&movie=m1#x' });

    expect(path.startsWith('/add?')).toBe(true);
    expect(path).not.toContain('#');
    expect(queryOf(path).get('series')).toBe('s 2/y&movie=m1#x');
    expect([...queryOf(path).keys()]).toEqual(['series']);
  });
});

/**
 * 38 — Title editing, the refactor (issue 311): the **Series Resolve**,
 * `/add?kind=series&problem=<id>`, the kind first, with the held series beside
 * it when the show joins one.
 */
describe('movieFormPath — the Series Resolve', () => {
  it('names the series kind first, then the problem', () => {
    expect(movieFormPath({ kind: 'series', problem: 'p1' })).toBe(
      '/add?kind=series&problem=p1'
    );
  });

  it('names the held series after the problem, for a join', () => {
    expect(
      movieFormPath({ kind: 'series', problem: 'p1', series: 'harbor' })
    ).toBe('/add?kind=series&problem=p1&series=harbor');
  });
});

// 42 — Review at scale refactor (issue #366): the rule for _does this Resolve
// open the Series Resolve_, spelled once beside the route both readers build.
describe('opensSeriesResolve', () => {
  it('opens it for an unplaced show, held or not', () => {
    expect(opensSeriesResolve({ kind: 'unplaced' })).toBe(true);
    expect(opensSeriesResolve({ kind: 'unplaced', seriesId: 's1' })).toBe(true);
  });

  it('opens it for a failed row once its series is held', () => {
    expect(opensSeriesResolve({ kind: 'failed', seriesId: 's1' })).toBe(true);
  });

  it('leaves a failed row with no held series to the movie form', () => {
    expect(opensSeriesResolve({ kind: 'failed' })).toBe(false);
  });

  it.each([
    'no-folder',
    'ambiguous',
    'no-video',
    'no-row',
    'missing-meta',
    'differs',
  ] as const)('leaves a %s row to the movie form, series or not', (kind) => {
    expect(opensSeriesResolve({ kind })).toBe(false);
    expect(opensSeriesResolve({ kind, seriesId: 's1' })).toBe(false);
  });
});
