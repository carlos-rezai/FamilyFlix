// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 1: the pure coercers get folders
// and tests.
//
// The most valuable test in the group, and the trap the refactor plan named:
// **an absent field, an empty field and a posted `0` are three different
// answers**. `Number('')` is `0`, and `0` is a real point on the half-star
// scale — so a function that folded the empty field into the absent one would
// leave a film scored nought instead of Unrated, silently, over the one column
// where getting it wrong invents data rather than dropping a word of it.
//
// Off-scale, fractional and non-numeric values answer the sentinel rather than
// `undefined` for the same reason: the caller replies 400 to a sentinel and
// *writes a clear* for `undefined`.

import { describe, expect, it } from 'vitest';

import { INVALID_RATING, optionalRating } from './optionalRating';

describe('optionalRating', () => {
  // The three answers that must stay three answers.
  it('answers undefined for a field nobody sent', () => {
    expect(optionalRating(undefined)).toBeUndefined();
  });

  it('answers undefined for a field the maintainer cleared', () => {
    expect(optionalRating('')).toBeUndefined();
  });

  it('answers nought for a posted nought, which is a real point on the scale', () => {
    expect(optionalRating('0')).toBe(0);
  });

  it('answers undefined for a field carrying only whitespace', () => {
    expect(optionalRating('   ')).toBeUndefined();
  });

  it('answers the units the column stores, not the stars on screen', () => {
    expect(optionalRating('7')).toBe(7);
    expect(optionalRating('10')).toBe(10);
  });

  it.each([
    ['above the scale', '11'],
    ['below the scale', '-1'],
    ['a half unit', '7.5'],
    ['not a number at all', 'four stars'],
    ['a number with something after it', '7 stars'],
  ])('refuses a rating %s with the sentinel', (_label, value) => {
    expect(optionalRating(value)).toBe(INVALID_RATING);
  });

  // The sentinel is not a rating and not an absence — the caller tells the two
  // apart to decide between a 400 and a clear.
  it('answers a sentinel that is neither a number nor undefined', () => {
    const answer = optionalRating('11');
    expect(typeof answer).toBe('symbol');
    expect(answer).not.toBeUndefined();
  });
});
