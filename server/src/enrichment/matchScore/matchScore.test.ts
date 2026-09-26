// @vitest-environment node
//
// 23 — Enrichment, Phase 4: "ambiguous and missing Decisions" (issue #207).
//
// `matchScore` — pure: our title and year × a TMDB result → the **Match
// score**, 0–100, the _% match_ the candidate picker draws. 70 for the title
// (an equal **Title key** 70, else word overlap × 70) and 30 for the year
// (equal 30, one off 15, unknown 0).
//
// Word overlap is read as the distinct words the two Title keys share over
// the larger of the two word counts — symmetric, and 1 exactly when the keys
// are equal — and the sum is rounded to a whole percent.
//
// `confident` — **Confident**: the search answered exactly one candidate, its
// Title key equal to ours and, when our title has a year, its year equal too.
// A yearless title needs only the title.

import { describe, expect, it } from 'vitest';

import { confident, matchScore } from './matchScore';

describe('matchScore: the title’s 70', () => {
  it.each([
    ['an equal Title key', 'Harbor Lights', 'Harbor Lights', 70],
    ['an equal key spelled differently', 'Amélie', 'AMELIE', 70],
    ['no word shared', 'Harbor Lights', 'Sundial', 0],
    ['one word of two shared', 'Harbor Lights', 'Harbor Nights', 35],
  ])('%s', (_case, ours, theirs, points) => {
    // No year on either side, so the title is the whole score.
    expect(
      matchScore({ title: ours, year: null }, { title: theirs, year: null })
    ).toBe(points);
  });
});

describe('matchScore: the year’s 30', () => {
  it.each([
    ['an equal year', 1963, 1963, 100],
    ['one year off, later', 1963, 1964, 85],
    ['one year off, earlier', 1963, 1962, 85],
    ['two years off', 1963, 1965, 70],
    ['decades off', 1963, 2019, 70],
  ])('%s', (_case, ours, theirs, score) => {
    expect(
      matchScore(
        { title: 'Harbor Lights', year: ours },
        { title: 'Harbor Lights', year: theirs }
      )
    ).toBe(score);
  });

  it('gives nothing for a year we do not know', () => {
    expect(
      matchScore(
        { title: 'Harbor Lights', year: null },
        { title: 'Harbor Lights', year: 1963 }
      )
    ).toBe(70);
  });

  it('gives nothing for a year TMDB does not know', () => {
    expect(
      matchScore(
        { title: 'Harbor Lights', year: 1963 },
        { title: 'Harbor Lights', year: null }
      )
    ).toBe(70);
  });

  it('adds the two, a shared word and a year one off', () => {
    expect(
      matchScore(
        { title: 'Harbor Lights', year: 1963 },
        { title: 'Harbor Nights', year: 1964 }
      )
    ).toBe(50);
  });
});

describe('confident', () => {
  const lights = { title: 'Harbor Lights', year: 1963 };

  it('is one candidate with an equal Title key and an equal year', () => {
    expect(confident(lights, [{ title: 'Harbor Lights', year: 1963 }])).toBe(
      true
    );
  });

  it('is not one candidate whose year differs', () => {
    expect(confident(lights, [{ title: 'Harbor Lights', year: 1964 }])).toBe(
      false
    );
  });

  it('is not one candidate whose Title key differs', () => {
    expect(confident(lights, [{ title: 'Harbor Nights', year: 1963 }])).toBe(
      false
    );
  });

  it('is not one candidate with no year, when ours has one', () => {
    expect(confident(lights, [{ title: 'Harbor Lights', year: null }])).toBe(
      false
    );
  });

  it('is not several candidates, even when one of them is exact', () => {
    expect(
      confident(lights, [
        { title: 'Harbor Lights', year: 1963 },
        { title: 'Harbor Lights', year: 2019 },
      ])
    ).toBe(false);
  });

  it('is not no candidate at all', () => {
    expect(confident(lights, [])).toBe(false);
  });

  it('asks a yearless title for the title alone', () => {
    expect(
      confident({ title: 'Sundial', year: null }, [
        { title: 'Sundial', year: 2011 },
      ])
    ).toBe(true);
  });
});
