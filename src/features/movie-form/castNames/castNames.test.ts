import { describe, it, expect } from 'vitest';

import { castNames, castText } from './castNames';

/**
 * The pure unit either side of the comma — a typed **Cast** line to the list of
 * names the record stores, and back again.
 *
 * Both directions live here because the round trip is the unit: the form is the
 * one place in the app where a `string[]` column is filled in by typing, and an
 * edit has to put the stored list back into the same box the maintainer typed
 * it into. Splitting them across two folders would let the two halves disagree
 * about what a comma means.
 *
 * The prototype's caption is the whole specification — "separate with commas" —
 * so everything below is what that sentence has to survive being taken
 * literally by someone typing quickly.
 */
describe('castNames', () => {
  it('turns a comma-separated line into the names in it', () => {
    expect(castNames('Jane Doe, John Roe')).toEqual(['Jane Doe', 'John Roe']);
  });

  it('trims the whitespace around each name', () => {
    // A maintainer types a comma and then a space, or does not. Neither is the
    // name, and a leading space would sort and display as part of one.
    expect(castNames('Jane Doe ,John Roe , Ana Vega')).toEqual([
      'Jane Doe',
      'John Roe',
      'Ana Vega',
    ]);
  });

  it('keeps the spaces inside a name', () => {
    // The separator is the comma alone. Only a split on something else could
    // turn one person into two.
    expect(castNames('Jane Doe')).toEqual(['Jane Doe']);
  });

  it('drops the empty entry a trailing comma leaves', () => {
    // What the field holds mid-typing, the instant before the next name.
    expect(castNames('Jane Doe, John Roe,')).toEqual(['Jane Doe', 'John Roe']);
  });

  it('drops the empty entry a doubled comma leaves', () => {
    expect(castNames('Jane Doe,, John Roe')).toEqual(['Jane Doe', 'John Roe']);
  });

  it('drops an entry that is only whitespace', () => {
    expect(castNames('Jane Doe, , John Roe')).toEqual(['Jane Doe', 'John Roe']);
  });

  it('reads an untouched field as no cast at all', () => {
    // Not `['']`. A film whose cast the maintainer did not type is a movie with
    // an empty list, which is exactly what the detail page draws its "—" from.
    expect(castNames('')).toEqual([]);
  });

  it('reads a field holding only separators and spaces as no cast at all', () => {
    expect(castNames('   ')).toEqual([]);
    expect(castNames(',')).toEqual([]);
    expect(castNames(' , , ')).toEqual([]);
  });

  it('keeps the order the names were typed in', () => {
    // The billing order is the maintainer's, and the detail page's credits line
    // reads it back in the order it was given.
    expect(castNames('Ana Vega, Tomas Bell, Ruth Kerr')).toEqual([
      'Ana Vega',
      'Tomas Bell',
      'Ruth Kerr',
    ]);
  });
});

describe('castText', () => {
  it('writes the names back out as the line they were typed as', () => {
    expect(castText(['Jane Doe', 'John Roe'])).toBe('Jane Doe, John Roe');
  });

  it('writes an empty cast as an empty field', () => {
    // What the edit prefill puts in the box for a film with no cast stored: an
    // empty field, never a stray comma to delete.
    expect(castText([])).toBe('');
  });

  it('writes a single name as itself, with no separator', () => {
    expect(castText(['Jane Doe'])).toBe('Jane Doe');
  });
});

describe('castNames and castText together', () => {
  it('round-trips a stored cast back to the list it came from', () => {
    // The trip the edit slice makes: names out of the record, into the box, and
    // back to the record unchanged if nothing was touched.
    const stored = ['Ana Vega', 'Tomas Bell', 'Ruth Kerr'];

    expect(castNames(castText(stored))).toEqual(stored);
  });

  it('round-trips an empty cast', () => {
    expect(castNames(castText([]))).toEqual([]);
  });

  it('settles a carelessly typed line into one that round-trips', () => {
    // The second pass is what proves the two halves agree: whatever the typing
    // looked like, the names it resolved to are what the box would hold and
    // what the box would give back.
    const typed = ' Jane Doe ,, John Roe, ';

    expect(castText(castNames(typed))).toBe('Jane Doe, John Roe');
    expect(castNames(castText(castNames(typed)))).toEqual(castNames(typed));
  });
});
