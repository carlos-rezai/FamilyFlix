// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 1: the pure coercers get folders
// and tests.
//
// The trap here is `Number('')`, which is `0` — a value that sorts and renders
// as a real year. The Year field is optional and a cleared one arrives as `''`
// rather than as an absent part, so the empty case is not an edge: it is what
// the field does every time a maintainer empties it.

import { describe, expect, it } from 'vitest';

import { optionalYear } from './optionalYear';

describe('optionalYear', () => {
  it('answers the year a maintainer typed', () => {
    expect(optionalYear('2018')).toBe(2018);
  });

  it('answers undefined for a field nobody sent', () => {
    expect(optionalYear(undefined)).toBeUndefined();
  });

  // `Number('')` is `0`. A cleared Year field must be no year, never year nought.
  it('answers undefined for a cleared field rather than the year nought', () => {
    expect(optionalYear('')).toBeUndefined();
  });

  it('answers undefined for a field carrying only whitespace', () => {
    expect(optionalYear('   ')).toBeUndefined();
  });

  it('refuses a year that is not a number', () => {
    expect(optionalYear('nineteen ninety-four')).toBeUndefined();
  });

  it('refuses a year that is not whole', () => {
    expect(optionalYear('1994.5')).toBeUndefined();
  });

  it('reads a year the field padded with spaces', () => {
    expect(optionalYear(' 1994 ')).toBe(1994);
  });
});
