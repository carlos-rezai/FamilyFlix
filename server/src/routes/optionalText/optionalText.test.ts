// @vitest-environment node
//
// 11 — Movie form refactor (issue #109), Group 1: the pure coercers get folders
// and tests.
//
// Why this is not `onlyField`: the detail page draws its "—" from `null` and
// would draw an empty gap from `''`, so a cleared Director field has to come
// back as absence rather than as an empty string. That is the whole reason the
// function exists separately, and it had never been asserted on its own.

import { describe, expect, it } from 'vitest';

import { optionalText } from './optionalText';

describe('optionalText', () => {
  it('answers the text a maintainer typed', () => {
    expect(optionalText('Ada Lovelace')).toBe('Ada Lovelace');
  });

  it('answers undefined for a field nobody sent', () => {
    expect(optionalText(undefined)).toBeUndefined();
  });

  // The reason this is not `onlyField`: `''` would render as a gap where the
  // detail page means to render a dash.
  it('answers undefined for a cleared field rather than the empty string', () => {
    expect(optionalText('')).toBeUndefined();
  });

  it('answers undefined for a field carrying only whitespace', () => {
    expect(optionalText('   ')).toBeUndefined();
  });

  it('trims the text it answers with', () => {
    expect(optionalText('  Ada Lovelace  ')).toBe('Ada Lovelace');
  });

  it('keeps a synopsis with newlines in it', () => {
    expect(optionalText('One line.\nAnd another.')).toBe(
      'One line.\nAnd another.'
    );
  });
});
