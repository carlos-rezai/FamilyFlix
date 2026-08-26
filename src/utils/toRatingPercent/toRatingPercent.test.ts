import { describe, it, expect } from 'vitest';

import { toRatingPercent } from './toRatingPercent';

describe('toRatingPercent', () => {
  it('scales rating units to a 0–100 percent (units * 10)', () => {
    expect(toRatingPercent(8)).toBe(80);
    expect(toRatingPercent(10)).toBe(100);
    expect(toRatingPercent(4.5)).toBe(45);
  });

  it('passes an unrated movie (null) straight through as null', () => {
    // The flattening this used to do — `null` in, `0` out — is what made an
    // unrated movie indistinguishable from one someone actually scored nought.
    // Carrying the absence is what lets every caller below tell them apart.
    expect(toRatingPercent(null)).toBeNull();
  });

  it('maps a literal 0-unit rating to 0, which is not the same as null', () => {
    expect(toRatingPercent(0)).toBe(0);
  });
});
