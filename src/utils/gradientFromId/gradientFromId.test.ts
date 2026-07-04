import { describe, it, expect } from 'vitest';

import { gradientFromId } from './gradientFromId';

describe('gradientFromId', () => {
  it('is deterministic — the same id always yields the same two stops', () => {
    expect(gradientFromId('movie-42')).toEqual(gradientFromId('movie-42'));
  });

  it('returns two distinct, non-empty color stops', () => {
    const { g1, g2 } = gradientFromId('movie-42');

    expect(typeof g1).toBe('string');
    expect(typeof g2).toBe('string');
    expect(g1.length).toBeGreaterThan(0);
    expect(g2.length).toBeGreaterThan(0);
    expect(g1).not.toBe(g2);
  });

  it('spreads across ids — different ids mostly produce different gradients', () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const stops = new Set(
      ids.map((id) => {
        const { g1, g2 } = gradientFromId(id);
        return `${g1}|${g2}`;
      })
    );

    // A hashed fallback should not collapse many ids onto the same gradient.
    expect(stops.size).toBeGreaterThan(ids.length / 2);
  });
});
