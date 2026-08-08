import { describe, it, expect } from 'vitest';

import { formatClock } from './formatClock';

describe('formatClock', () => {
  it('renders a sub-hour duration as m:ss', () => {
    expect(formatClock(73)).toBe('1:13');
  });

  it('renders a duration past the hour as h:mm:ss', () => {
    expect(formatClock(4416)).toBe('1:13:36');
  });

  it('switches to h:mm:ss exactly at the hour', () => {
    expect(formatClock(3600)).toBe('1:00:00');
  });

  it('zero-pads seconds below ten', () => {
    expect(formatClock(65)).toBe('1:05');
  });

  it('zero-pads minutes below ten past the hour', () => {
    expect(formatClock(3665)).toBe('1:01:05');
  });

  it('floors a fractional second rather than rounding it up', () => {
    expect(formatClock(73.9)).toBe('1:13');
  });

  it('clamps a negative duration to zero', () => {
    expect(formatClock(-30)).toBe('0:00');
  });

  it('renders no elapsed time as 0:00', () => {
    expect(formatClock(0)).toBe('0:00');
  });
});
