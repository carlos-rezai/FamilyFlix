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

// 42 — Review at scale (issue #355): the ladder's last two rungs. Rung 3 is
// the **Search query** without the year; rung 4 the part before a `:` or `-`
// subtitle, when that part is two words or more, without the year. Repeats
// are still dropped; at most four rungs.

describe('searchLadder — all four rungs', () => {
  it.each<[string, string, number | null, SearchRung[]]>([
    [
      'a subtitled title: all four rungs, the subtitle dropped last',
      'Star Wars: The Force Awakens',
      2015,
      [
        { query: 'Star Wars: The Force Awakens', year: 2015 },
        { query: 'Star Wars: The Force Awakens', year: null },
        { query: 'Star Wars The Force Awakens', year: null },
        { query: 'Star Wars', year: null },
      ],
    ],
    [
      'a subtitle after a dash is a subtitle too',
      'Mission Impossible - Fallout',
      2018,
      [
        { query: 'Mission Impossible - Fallout', year: 2018 },
        { query: 'Mission Impossible - Fallout', year: null },
        { query: 'Mission Impossible Fallout', year: null },
        { query: 'Mission Impossible', year: null },
      ],
    ],
    [
      'punctuation TMDB does not fold: the Search query is rung 3',
      "F'ck That's Delicious",
      2016,
      [
        { query: "F'ck That's Delicious", year: 2016 },
        { query: "F'ck That's Delicious", year: null },
        { query: 'F ck That s Delicious', year: null },
      ],
    ],
    [
      'a one-word part before a subtitle is not a rung',
      'Alien: Covenant',
      2017,
      [
        { query: 'Alien: Covenant', year: 2017 },
        { query: 'Alien: Covenant', year: null },
        { query: 'Alien Covenant', year: null },
      ],
    ],
    [
      'a one-word part before a hyphen is not a rung',
      'Spider-Man',
      2002,
      [
        { query: 'Spider-Man', year: 2002 },
        { query: 'Spider-Man', year: null },
        { query: 'Spider Man', year: null },
      ],
    ],
    [
      'release noise left in a title: the Search query drops it',
      'Heat 1080p BluRay x264-GRP',
      1995,
      [
        { query: 'Heat 1080p BluRay x264-GRP', year: 1995 },
        { query: 'Heat 1080p BluRay x264-GRP', year: null },
        { query: 'Heat', year: null },
      ],
    ],
    [
      'no year: the repeat dropped, three rungs left',
      'Star Wars: The Force Awakens',
      null,
      [
        { query: 'Star Wars: The Force Awakens', year: null },
        { query: 'Star Wars The Force Awakens', year: null },
        { query: 'Star Wars', year: null },
      ],
    ],
  ])('%s', (_, title, year, rungs) => {
    expect(searchLadder(title, year)).toEqual(rungs);
  });
});
