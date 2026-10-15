// 42 — Review at scale refactor (issue #366), Group 4: the **Kind filter**
// both reviews draw, graduated from `importView` and `enrichmentView` when the
// second review wrote it again. Each feature keeps its own words and order.

import { describe, expect, it } from 'vitest';

import { kindFilter } from './kindFilter';

type Kind = 'red' | 'green' | 'blue';

const ORDER: readonly Kind[] = ['red', 'green', 'blue'];
const LABELS: Record<Kind, string> = {
  red: 'Red',
  green: 'Green',
  blue: 'Blue',
};

const rows = (...kinds: Kind[]) => kinds.map((kind) => ({ kind }));

describe('kindFilter', () => {
  it('draws nothing under two kinds, and holds all', () => {
    expect(kindFilter([], ORDER, LABELS, 'all')).toEqual({
      options: [],
      value: 'all',
    });
    expect(kindFilter(rows('red', 'red'), ORDER, LABELS, 'red')).toEqual({
      options: [],
      value: 'all',
    });
  });

  it('draws All N, then each kind held with its count, in the order given', () => {
    const filter = kindFilter(
      rows('blue', 'red', 'blue', 'red', 'red'),
      ORDER,
      LABELS,
      'all'
    );

    expect(filter.options).toEqual([
      { value: 'all', label: 'All 5' },
      { value: 'red', label: 'Red 3' },
      { value: 'blue', label: 'Blue 2' },
    ]);
  });

  it('leaves a kind no row holds off the row', () => {
    const filter = kindFilter(rows('red', 'blue'), ORDER, LABELS, 'all');

    expect(filter.options.map((option) => option.value)).toEqual([
      'all',
      'red',
      'blue',
    ]);
  });

  it('holds a chosen kind while the list still holds it', () => {
    expect(kindFilter(rows('red', 'blue'), ORDER, LABELS, 'blue').value).toBe(
      'blue'
    );
  });

  it('falls back to all once the chosen kind is gone', () => {
    expect(kindFilter(rows('red', 'blue'), ORDER, LABELS, 'green').value).toBe(
      'all'
    );
  });
});
