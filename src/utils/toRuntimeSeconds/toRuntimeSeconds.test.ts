import { describe, it, expect } from 'vitest';

import { toRuntimeSeconds } from './toRuntimeSeconds';

describe('toRuntimeSeconds', () => {
  it('converts a known runtime from minutes to seconds', () => {
    expect(toRuntimeSeconds(90)).toBe(5400);
  });

  it('treats a runtime that was never recorded as unknown', () => {
    expect(toRuntimeSeconds(null)).toBeNull();
  });

  it('treats a zero runtime as unknown rather than as a zero-length movie', () => {
    // A movie of no length is not a thing; a 0 in the column means the import
    // never learned the real runtime.
    expect(toRuntimeSeconds(0)).toBeNull();
  });

  it('treats a negative runtime as unknown', () => {
    expect(toRuntimeSeconds(-30)).toBeNull();
  });

  it('keeps a fractional runtime rather than rounding it away', () => {
    // Callers divide by this, so precision belongs to them, not here.
    expect(toRuntimeSeconds(1.5)).toBe(90);
  });
});
