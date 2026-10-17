import { describe, expect, it } from 'vitest';

import { enrichPath, moviePath, seriesPath, seriesTabPath } from '@/utils';

import { addLeaving, formJob, formLanding, type FormJob } from './formJob';

/** The job the URL after `/add` opens. */
const jobAt = (query: string): FormJob => formJob(new URLSearchParams(query));

/**
 * Every URL the **Movie form** is opened on, read into one of its five jobs,
 * and the **Landing** each job answers.
 */
describe('formJob — the five jobs', () => {
  it.each<[string, FormJob]>([
    ['', { kind: 'add', formKind: 'movie' }],
    ['?kind=series', { kind: 'add', formKind: 'series' }],
    ['?kind=movie', { kind: 'add', formKind: 'movie' }],
    ['?kind=anything', { kind: 'add', formKind: 'movie' }],
    ['?movie=m1', { kind: 'edit', movie: 'm1' }],
    ['?series=s1', { kind: 'seriesEdit', series: 's1' }],
    [
      '?problem=p1',
      {
        kind: 'resolve',
        problem: 'p1',
        movie: null,
        asksSeries: false,
        joining: null,
      },
    ],
    [
      '?movie=m1&problem=p1',
      {
        kind: 'resolve',
        problem: 'p1',
        movie: 'm1',
        asksSeries: false,
        joining: null,
      },
    ],
    [
      '?kind=series&problem=p5',
      {
        kind: 'resolve',
        problem: 'p5',
        movie: null,
        asksSeries: true,
        joining: null,
      },
    ],
    [
      '?kind=series&problem=p6&series=s1',
      {
        kind: 'resolve',
        problem: 'p6',
        movie: null,
        asksSeries: true,
        joining: 's1',
      },
    ],
  ])('reads /add%s', (query, job) => {
    expect(jobAt(query)).toEqual(job);
  });
});

describe('formJob — precedence', () => {
  it('reads ?problem= over ?movie= and ?series=', () => {
    expect(jobAt('?series=s1&movie=m1&problem=p1')).toMatchObject({
      kind: 'resolve',
      problem: 'p1',
      movie: 'm1',
    });
  });

  it('reads ?movie= over ?series=', () => {
    expect(jobAt('?series=s1&movie=m1')).toEqual({ kind: 'edit', movie: 'm1' });
  });

  it('ignores ?kind= beside ?movie=', () => {
    expect(jobAt('?kind=series&movie=m1')).toEqual({
      kind: 'edit',
      movie: 'm1',
    });
  });

  it('ignores ?kind= beside ?series=', () => {
    expect(jobAt('?kind=series&series=s1')).toEqual({
      kind: 'seriesEdit',
      series: 's1',
    });
  });

  it('ignores ?kind= beside a problem over a movie, and ?series= with it', () => {
    expect(jobAt('?kind=series&movie=m1&problem=p1&series=s1')).toEqual({
      kind: 'resolve',
      problem: 'p1',
      movie: 'm1',
      asksSeries: false,
      joining: null,
    });
  });

  it('reads ?series= beside a problem only as the series a Series Resolve joins', () => {
    expect(jobAt('?problem=p1&series=s1')).toEqual({
      kind: 'resolve',
      problem: 'p1',
      movie: null,
      asksSeries: false,
      joining: null,
    });
  });
});

describe('formLanding', () => {
  it('lands an add on Settings, whichever kind', () => {
    expect(formLanding(jobAt(''))).toBe('/settings');
    expect(formLanding(jobAt('?kind=series'))).toBe('/settings');
  });

  it('lands an edit on the movie’s page', () => {
    expect(formLanding(jobAt('?movie=m1'))).toBe('/movie/m1');
  });

  it('lands a series edit on the series page', () => {
    expect(formLanding(jobAt('?series=s1'))).toBe('/series/s1');
  });

  it('lands every Resolve on the review', () => {
    expect(formLanding(jobAt('?problem=p1'))).toBe('/import');
    expect(formLanding(jobAt('?movie=m1&problem=p1'))).toBe('/import');
    expect(formLanding(jobAt('?kind=series&problem=p5&series=s1'))).toBe(
      '/import'
    );
  });
});

describe('addLeaving', () => {
  it('pushes a film’s Fresh home with the box off', () => {
    expect(addLeaving('movie', 'm 1', false)).toEqual({
      replace: null,
      push: '/',
    });
  });

  it('pushes a series’ Fresh home with the box off', () => {
    expect(addLeaving('series', 's 1', false)).toEqual({
      replace: null,
      push: seriesTabPath(),
    });
  });

  it('replaces with the film’s page, then pushes its Sync, with the box on', () => {
    expect(addLeaving('movie', 'm 1', true)).toEqual({
      replace: moviePath('m 1'),
      push: enrichPath({ movie: 'm 1', start: true }),
    });
  });

  it('replaces with the series’ page, then pushes its Sync, with the box on', () => {
    expect(addLeaving('series', 's 1', true)).toEqual({
      replace: seriesPath('s 1'),
      push: enrichPath({ series: 's 1', start: true }),
    });
  });
});
