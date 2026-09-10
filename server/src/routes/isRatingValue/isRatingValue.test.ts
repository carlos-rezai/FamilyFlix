// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 1: the pure coercers get folders
// and tests.
//
// The stored rating scale, stated once. It is an **allow-list** rather than a
// rejection of non-numbers, and the tests below are written to fail if it is
// ever rewritten as one: `null` is the clear, and a clear is the single write
// in this API that erases data, so every value that is not a point on the scale
// has to be refused rather than swept into it.

import { describe, expect, it } from 'vitest';

import { isRatingValue, MAX_RATING } from './isRatingValue';

describe('isRatingValue', () => {
  it('accepts every whole point on the half-star scale', () => {
    for (let value = 0; value <= MAX_RATING; value += 1) {
      expect(isRatingValue(value)).toBe(true);
    }
  });

  // The clear, and the reason this is an allow-list.
  it('accepts null, which is the clear', () => {
    expect(isRatingValue(null)).toBe(true);
  });

  it('refuses a rating above the top of the scale', () => {
    expect(isRatingValue(MAX_RATING + 1)).toBe(false);
  });

  it('refuses a negative rating', () => {
    expect(isRatingValue(-1)).toBe(false);
  });

  it('refuses a half-unit, which the column has no room for', () => {
    expect(isRatingValue(7.5)).toBe(false);
  });

  // The values a `typeof value !== 'number'` rejection would let through as a
  // clear, which is what the allow-list exists to stop.
  it.each([
    ['undefined', undefined],
    ['a string', '7'],
    ['a boolean', true],
    ['an object', {}],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('refuses %s rather than reading it as a clear', (_label, value) => {
    expect(isRatingValue(value)).toBe(false);
  });
});
