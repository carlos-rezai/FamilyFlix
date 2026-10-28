import { describe, expect, it } from 'vitest';

import { enrichPath, parseEnrichQuery, type EnrichQuery } from './enrichPath';

describe('enrichPath', () => {
  it('answers the bare route with nothing asked', () => {
    expect(enrichPath()).toBe('/enrich');
    expect(enrichPath({})).toBe('/enrich');
  });

  // 54 — Scan new folders (issue #497): _Just what was added_.
  it('names the run’s start for Import’s hand-off', () => {
    expect(enrichPath({ added: '2026-10-28T09:00:00.000Z' })).toBe(
      '/enrich?added=2026-10-28T09%3A00%3A00.000Z'
    );
  });

  it('no longer writes a scope', () => {
    const asked = { scope: 'all' } as unknown as EnrichQuery;

    expect(enrichPath(asked)).toBe('/enrich');
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
    expect(enrichPath({ movie: 'm1' })).toBe('/enrich?movie=m1');
    expect(enrichPath({ series: 's1' })).toBe('/enrich?series=s1');
  });
});

/** The query a route written by {@link enrichPath} reads back as. */
const readBack = (path: string): EnrichQuery =>
  parseEnrichQuery(new URLSearchParams(path.split('?')[1] ?? ''));

describe('parseEnrichQuery', () => {
  it.each<EnrichQuery>([
    {},
    { added: '2026-10-28T09:00:00.000Z' },
    { movie: 'm1' },
    { series: 's1' },
    { movie: 'a&b #c' },
    { series: 'a&b #c' },
    { movie: 'm1', start: true },
    { series: 's1', start: true },
  ])('reads %o back from the route it writes', (query) => {
    expect(readBack(enrichPath(query))).toEqual(query);
  });

  it('ignores a parameter it does not read', () => {
    expect(readBack('/enrich?movie=m1&tab=series')).toEqual({ movie: 'm1' });
  });

  it('no longer reads a scope', () => {
    expect(readBack('/enrich?scope=all')).toEqual({});
    expect(readBack('/enrich?scope=missing')).toEqual({});
  });

  it('reads an added stamp back whole', () => {
    expect(readBack('/enrich?added=2026-10-28T09%3A00%3A00.000Z')).toEqual({
      added: '2026-10-28T09:00:00.000Z',
    });
  });

  it('ignores a start other than 1', () => {
    expect(readBack('/enrich?movie=m1&start=true')).toEqual({ movie: 'm1' });
    expect(readBack('/enrich?movie=m1&start=0')).toEqual({ movie: 'm1' });
  });

  it('keeps an empty id as an id', () => {
    expect(readBack('/enrich?movie=')).toEqual({ movie: '' });
  });
});
