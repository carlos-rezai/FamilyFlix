import { describe, it, expect } from 'vitest';

import { toProgressPercent, NOMINAL_SLIVER_PERCENT } from './toProgressPercent';

describe('toProgressPercent', () => {
  it('computes progress as a percent of the runtime', () => {
    // 45 minutes (2700s) into a 90-minute movie → 50%.
    expect(toProgressPercent(2700, 90)).toBe(50);
  });

  it('returns 0 when no resume position has been recorded', () => {
    expect(toProgressPercent(0, 90)).toBe(0);
  });

  it('clamps to 100 when the resume position exceeds the runtime', () => {
    expect(toProgressPercent(10000, 90)).toBe(100);
  });

  it('never returns a negative percent', () => {
    expect(toProgressPercent(-30, 90)).toBe(0);
  });

  it('falls back to the nominal sliver when in-progress but the runtime is unknown (null)', () => {
    expect(toProgressPercent(2700, null)).toBe(NOMINAL_SLIVER_PERCENT);
  });

  it('shows no progress for an unwatched movie even when the runtime is unknown', () => {
    // No resume position → not in-progress → no sliver, regardless of runtime.
    expect(toProgressPercent(0, null)).toBe(0);
  });

  it('pins the nominal sliver at 5%', () => {
    expect(NOMINAL_SLIVER_PERCENT).toBe(5);
  });
});
