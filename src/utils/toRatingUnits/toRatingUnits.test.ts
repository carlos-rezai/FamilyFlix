import { describe, it, expect } from 'vitest';

import { toRatingUnits } from './toRatingUnits';
import { toRatingPercent } from '@/utils';

/**
 * Every point the scale can hold, as the `[percent, units]` pair it is on each
 * side of the conversion. Ten half-star steps and the empty end — the whole
 * domain, small enough to state rather than sample.
 */
const HALF_STAR_POINTS: ReadonlyArray<[number, number]> = [
  [0, 0],
  [10, 1],
  [20, 2],
  [30, 3],
  [40, 4],
  [50, 5],
  [60, 6],
  [70, 7],
  [80, 8],
  [90, 9],
  [100, 10],
];

describe('toRatingUnits', () => {
  it('scales a percent down to the units the column stores', () => {
    expect(toRatingUnits(100)).toBe(10);
    expect(toRatingUnits(50)).toBe(5);
    expect(toRatingUnits(80)).toBe(8);
  });

  it('maps 0 percent to a stored 0 — a real zero, not an absence', () => {
    expect(toRatingUnits(0)).toBe(0);
  });

  it('maps unrated to unrated, so a clear stays a clear on the way down', () => {
    // The one conversion that must not round: `null` here is the difference
    // between erasing a rating and scoring the movie nothing.
    expect(toRatingUnits(null)).toBeNull();
  });
});

/**
 * This util exists to be the pure inverse of `toRatingPercent` — the one place
 * the component layer's percent scale meets the domain's 0–10 units. If the two
 * ever disagree, a rating shown on screen and a rating stored in the column stop
 * being the same fact.
 */
describe('toRatingUnits — the inverse of toRatingPercent', () => {
  it('gives back the percent it was handed, at every half-star point', () => {
    for (const [percent] of HALF_STAR_POINTS) {
      expect(toRatingPercent(toRatingUnits(percent))).toBe(percent);
    }
  });

  it('gives back the stored units it was handed, at every half-star point', () => {
    for (const [, units] of HALF_STAR_POINTS) {
      expect(toRatingUnits(toRatingPercent(units))).toBe(units);
    }
  });

  it('round-trips an absent rating as an absence, in both directions', () => {
    // The half-star points above are the whole numeric domain; unrated is the
    // point outside it, and the only one where a round trip that "worked"
    // would silently rewrite an absence into a nought.
    expect(toRatingPercent(toRatingUnits(null))).toBeNull();
    expect(toRatingUnits(toRatingPercent(null))).toBeNull();
  });
});
