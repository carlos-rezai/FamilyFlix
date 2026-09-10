// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 1: the pure coercers get folders
// and tests.
//
// `onlyField` shipped inside `routes/index.ts` and was reachable only by
// starting a listener and sending a multipart body. Nothing about it needs one:
// it is a read of a parsed body, and the rule it holds — **the last value of a
// repeated name wins** — is exactly the kind of thing a name does not say.
//
// The three answers below are the whole of it, and the third is the one worth
// having written down: an empty field is `''`, not absence. That distinction is
// what lets an edit say a field was *cleared* rather than left alone, and every
// coercer above this one is built on it.

import { describe, expect, it } from 'vitest';

import { onlyField } from './onlyField';

describe('onlyField', () => {
  it('answers the value a field was sent with', () => {
    expect(onlyField({ title: ['Northwind'] }, 'title')).toBe('Northwind');
  });

  it('keeps the last value when a client repeated the name', () => {
    expect(onlyField({ year: ['1994', '2018'] }, 'year')).toBe('2018');
  });

  it('answers undefined for a field nobody sent', () => {
    expect(onlyField({ title: ['Northwind'] }, 'director')).toBeUndefined();
  });

  it('answers undefined over a body with no fields at all', () => {
    expect(onlyField({}, 'title')).toBeUndefined();
  });

  // The distinction the whole form rests on: a cleared field arrives as a part
  // carrying nothing, which is not the same as no part at all.
  it('answers the empty string for a field that was cleared, not undefined', () => {
    expect(onlyField({ director: [''] }, 'director')).toBe('');
  });

  it('keeps a last value that is empty over an earlier one that is not', () => {
    expect(onlyField({ director: ['Ada Lovelace', ''] }, 'director')).toBe('');
  });
});
