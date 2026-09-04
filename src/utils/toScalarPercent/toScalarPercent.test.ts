import { describe, it, expect } from 'vitest';

import { toScalarPercent } from './toScalarPercent';

describe('toScalarPercent', () => {
  it('draws an empty bar at nought', () => {
    expect(toScalarPercent(0)).toBe('0%');
  });

  it('draws a full bar at one', () => {
    expect(toScalarPercent(1)).toBe('100%');
  });

  it('reads as a percent, not a fraction', () => {
    expect(toScalarPercent(0.5)).toBe('50%');
  });

  it('rounds a repeating fraction to one decimal place', () => {
    // A third of the way through a film is the shape CSS was being handed ten
    // times a second: 33.33333333333333%.
    expect(toScalarPercent(1 / 3)).toBe('33.3%');
  });

  it('keeps a tenth of a percent rather than rounding to whole percents', () => {
    expect(toScalarPercent(0.1234)).toBe('12.3%');
  });

  it('rounds a half up at the decimal it keeps', () => {
    expect(toScalarPercent(0.12345)).toBe('12.3%');
    expect(toScalarPercent(0.5555)).toBe('55.6%');
  });

  it('drops a trailing zero rather than writing 50.0%', () => {
    expect(toScalarPercent(0.5001)).toBe('50%');
  });
});
