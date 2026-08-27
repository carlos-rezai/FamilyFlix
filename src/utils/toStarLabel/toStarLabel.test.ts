import { describe, it, expect } from 'vitest';

import { toStarLabel } from './toStarLabel';

describe('toStarLabel', () => {
  it('names every half-star point on the scale', () => {
    // The ten a `RatingPicker` segment can ask for, plus the nought a movie
    // can genuinely be scored. Unrated is `null` and never reaches here.
    expect(toStarLabel(0)).toBe('0.0');
    expect(toStarLabel(10)).toBe('0.5');
    expect(toStarLabel(20)).toBe('1.0');
    expect(toStarLabel(30)).toBe('1.5');
    expect(toStarLabel(40)).toBe('2.0');
    expect(toStarLabel(50)).toBe('2.5');
    expect(toStarLabel(60)).toBe('3.0');
    expect(toStarLabel(70)).toBe('3.5');
    expect(toStarLabel(80)).toBe('4.0');
    expect(toStarLabel(90)).toBe('4.5');
    expect(toStarLabel(100)).toBe('5.0');
  });

  it('always prints one decimal, so a whole star reads 4.0 and not 4', () => {
    // The trailing nought is the point: it is what keeps the meta line from
    // jittering in width as the rating changes.
    expect(toStarLabel(80)).toBe('4.0');
    expect(toStarLabel(20)).toBe('1.0');
  });

  it('rounds a percent between two half-stars to the nearest one', () => {
    expect(toStarLabel(74)).toBe('3.5');
    expect(toStarLabel(76)).toBe('4.0');
    expect(toStarLabel(1)).toBe('0.0');
    expect(toStarLabel(9)).toBe('0.5');
  });

  it('rounds a percent sitting exactly between them upwards', () => {
    // 75% is half a half-star from both 3.5 and 4.0. `Math.round` breaks the
    // tie away from zero, and this pins that rather than leaving it to chance.
    expect(toStarLabel(75)).toBe('4.0');
    expect(toStarLabel(5)).toBe('0.5');
    expect(toStarLabel(95)).toBe('5.0');
  });
});
