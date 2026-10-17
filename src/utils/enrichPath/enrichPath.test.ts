import { describe, expect, it } from 'vitest';

import { enrichPath } from './enrichPath';

describe('enrichPath', () => {
  it('answers the bare route with nothing asked', () => {
    expect(enrichPath()).toBe('/enrich');
    expect(enrichPath({})).toBe('/enrich');
  });

  it('opens on Everything for Import’s hand-off', () => {
    expect(enrichPath({ scope: 'all' })).toBe('/enrich?scope=all');
  });

  it('names the one movie of a single-title Sync', () => {
    expect(enrichPath({ movie: 'm1' })).toBe('/enrich?movie=m1');
  });

  it('encodes an id so it reads back whole', () => {
    const path = enrichPath({ movie: 'a&b #c' });

    expect(path).toBe('/enrich?movie=a%26b+%23c');
    expect(new URLSearchParams(path.split('?')[1]).get('movie')).toBe('a&b #c');
  });

  // 38 — Title editing (issue #305): _Just this series_.
  it('names the one series of a single-title Sync', () => {
    expect(enrichPath({ series: 's1' })).toBe('/enrich?series=s1');
  });

  it('encodes a series id so it reads back whole', () => {
    const path = enrichPath({ series: 'a&b #c' });

    expect(path).toBe('/enrich?series=a%26b+%23c');
    expect(new URLSearchParams(path.split('?')[1]).get('series')).toBe(
      'a&b #c'
    );
  });
});

// 45 — Add and sync (issue #393): **Started on arrival**.
describe('enrichPath with start', () => {
  it('writes start=1 beside a movie', () => {
    const path = enrichPath({ movie: 'm1', start: true });

    expect(path).toBe('/enrich?movie=m1&start=1');
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('movie')).toBe('m1');
    expect(params.get('start')).toBe('1');
  });

  it('writes start=1 beside a series', () => {
    const path = enrichPath({ series: 's1', start: true });

    expect(path).toBe('/enrich?series=s1&start=1');
    const params = new URLSearchParams(path.split('?')[1]);
    expect(params.get('series')).toBe('s1');
    expect(params.get('start')).toBe('1');
  });

  it('reads every existing query back unchanged', () => {
    expect(enrichPath()).toBe('/enrich');
    expect(enrichPath({ scope: 'all' })).toBe('/enrich?scope=all');
    expect(enrichPath({ movie: 'm1' })).toBe('/enrich?movie=m1');
    expect(enrichPath({ series: 's1' })).toBe('/enrich?series=s1');
  });
});
