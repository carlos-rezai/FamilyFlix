import { describe, it, expect } from 'vitest';

import { toRatingPercent } from './toRatingPercent';

describe('toRatingPercent', () => {
  it('scales rating units to a 0–100 percent (units * 10)', () => {
    expect(toRatingPercent(8)).toBe(80);
    expect(toRatingPercent(10)).toBe(100);
    expect(toRatingPercent(4.5)).toBe(45);
  });

  it('maps an unrated movie (null) to 0', () => {
    expect(toRatingPercent(null)).toBe(0);
  });

  it('maps a literal 0-unit rating to 0', () => {
    expect(toRatingPercent(0)).toBe(0);
  });
});
