import { describe, it, expect } from 'vitest';

import { range } from './range';

describe('range', () => {
  it('counts from zero up to one below the length', () => {
    expect(range(3)).toEqual([0, 1, 2]);
  });

  it('gives one index for a length of one', () => {
    expect(range(1)).toEqual([0]);
  });

  it('gives nothing for a length of zero', () => {
    expect(range(0)).toEqual([]);
  });

  it('gives nothing for a negative length, rather than throwing', () => {
    // "No placeholders" is a thing a screen can want; a crash is not.
    expect(range(-4)).toEqual([]);
  });

  it('is pure — the same length twice yields equal, separate lists', () => {
    const first = range(3);
    const second = range(3);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
  });
});
