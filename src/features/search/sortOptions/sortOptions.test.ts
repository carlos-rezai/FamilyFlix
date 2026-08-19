import { describe, it, expect, vi } from 'vitest';

import { sortLabel, sortOptions } from './sortOptions';
import { DEFAULT_MOVIE_SORT, MOVIE_SORTS, type MovieSort } from '@/types';

/** The panel's rows in the prototype's order (`FamilyFlix.dc.html:160`). */
const SORT_ROWS = [
  'Recently Added',
  'Title (A–Z)',
  'Year',
  'Unwatched First',
  'Highest Rated',
];

/** The rows paired with the order each one reports on the wire. */
const ROW_ORDERS = [
  ['Recently Added', 'recently-added'],
  ['Title (A–Z)', 'a-z'],
  ['Year', 'year'],
  ['Unwatched First', 'unwatched-first'],
  ['Highest Rated', 'highest-rated'],
] as const;

/** The options built for a given order, with nothing listening. */
const optionsFor = (selected: MovieSort) =>
  sortOptions(selected, () => undefined);

describe('sortOptions — the rows', () => {
  it('lists every order in the panel’s order, which is not the wire’s', () => {
    // Unwatched First sits above Highest Rated: "what have we not seen yet" is
    // asked more often than "what's best".
    expect(
      optionsFor(DEFAULT_MOVIE_SORT).map((option) => option.label)
    ).toEqual(SORT_ROWS);
  });

  it('offers every order the library can be in, and no others', () => {
    expect(optionsFor(DEFAULT_MOVIE_SORT)).toHaveLength(MOVIE_SORTS.length);
  });

  it('has no row for the absence of a sort, unlike its two siblings', () => {
    // The library is always in some order; there is nothing to opt out of.
    const labels = optionsFor(DEFAULT_MOVIE_SORT).map((option) => option.label);

    expect(labels).not.toContain('All sorts');
    expect(labels).not.toContain('None');
  });

  it('carries no count, since an order is not a shelf', () => {
    for (const option of optionsFor(DEFAULT_MOVIE_SORT)) {
      expect(option.count).toBeUndefined();
    }
  });
});

describe('sortOptions — which row reads as chosen', () => {
  it('marks exactly one row for every order the URL can carry', () => {
    for (const sort of MOVIE_SORTS) {
      const chosen = optionsFor(sort).filter((option) => option.selected);

      expect(chosen).toHaveLength(1);
    }
  });

  it('marks the row whose words match the order it was given', () => {
    for (const [label, sort] of ROW_ORDERS) {
      const chosen = optionsFor(sort).find((option) => option.selected);

      expect(chosen?.label).toBe(label);
    }
  });
});

describe('sortOptions — what selecting a row reports', () => {
  it('reports the slug the wire uses, not the words on the row', () => {
    for (const [label, sort] of ROW_ORDERS) {
      const onSelect = vi.fn();
      const option = sortOptions(DEFAULT_MOVIE_SORT, onSelect).find(
        (candidate) => candidate.label === label
      );

      option?.onSelect();

      expect(onSelect).toHaveBeenCalledWith(sort);
    }
  });

  it('reports the row already chosen, rather than doing nothing', () => {
    // Choosing the current order is a write like any other; it is the URL's
    // job to omit the parameter at the default, not this list's.
    const onSelect = vi.fn();
    const options = sortOptions(DEFAULT_MOVIE_SORT, onSelect);

    options.find((option) => option.selected)?.onSelect();

    expect(onSelect).toHaveBeenCalledWith(DEFAULT_MOVIE_SORT);
  });
});

describe('sortLabel', () => {
  it('writes every order the way the panel writes it', () => {
    for (const [label, sort] of ROW_ORDERS) {
      expect(sortLabel(sort)).toBe(label);
    }
  });

  it('never falls back to showing a slug', () => {
    for (const sort of MOVIE_SORTS) {
      expect(sortLabel(sort)).not.toBe(sort);
    }
  });
});
