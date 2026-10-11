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
