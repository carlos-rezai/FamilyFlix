// @vitest-environment node
//
// 42 — Review at scale (issue #354): the **Search ladder**'s first two rungs.
//
// `searchLadder(title, year)` — pure: a title and its year → the rungs a
// look-up climbs, in order. The title with its year, then the title without
// it; a rung equal to one already listed is dropped, so a title with no year
// is one rung, not two.

import { describe, expect, it } from 'vitest';

import { searchLadder, type SearchRung } from './searchLadder';

describe('searchLadder', () => {
  it.each<[string, string, number | null, SearchRung[]]>([
    [
      'a title with a year: with it, then without it',
      'Heat',
      1995,
      [
        { query: 'Heat', year: 1995 },
        { query: 'Heat', year: null },
      ],
    ],
    [
      'a longer title with a year, the same two rungs',
      'Before Sunrise',
      1995,
      [
        { query: 'Before Sunrise', year: 1995 },
        { query: 'Before Sunrise', year: null },
      ],
    ],
    [
      'a title with no year: one rung, the repeat dropped',
      'Heat',
      null,
      [{ query: 'Heat', year: null }],
    ],
  ])('%s', (_, title, year, rungs) => {
    expect(searchLadder(title, year)).toEqual(rungs);
  });
});
