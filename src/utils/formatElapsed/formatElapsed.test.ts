import { describe, expect, it } from 'vitest';

import { formatElapsed } from './formatElapsed';

describe('formatElapsed', () => {
  it('formats seconds as m:ss, the seconds padded', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(7)).toBe('0:07');
    expect(formatElapsed(65)).toBe('1:05');
  });

  it('rounds to the nearest second rather than flooring', () => {
    expect(formatElapsed(4.4)).toBe('0:04');
    expect(formatElapsed(4.5)).toBe('0:05');
    expect(formatElapsed(59.6)).toBe('1:00');
  });

  it('clamps a negative to 0:00', () => {
    expect(formatElapsed(-12)).toBe('0:00');
  });

  it('never rolls minutes into hours', () => {
    expect(formatElapsed(3600)).toBe('60:00');
    expect(formatElapsed(7384)).toBe('123:04');
  });
});
