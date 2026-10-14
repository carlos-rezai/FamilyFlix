// @vitest-environment node
//
// The Media folder a row written without one is given: a Stored path some
// directories up, or nothing.

import { describe, expect, it } from 'vitest';

import { parentFolder } from './parentFolder';

describe('parentFolder', () => {
  it('reads one level up — a film’s Movie folder', () => {
    expect(parentFolder('heat-1995/heat.mkv', 1)).toBe('heat-1995');
  });

  it('reads two levels up — a series’ folder over its season', () => {
    expect(parentFolder('tidewater-2018/season-01/e01.mp4', 2)).toBe(
      'tidewater-2018'
    );
  });

  it('answers null for a path with too few segments', () => {
    expect(parentFolder('heat.mkv', 1)).toBeNull();
    expect(parentFolder('season-01/e01.mp4', 2)).toBeNull();
  });

  it('answers null for no path', () => {
    expect(parentFolder(undefined, 1)).toBeNull();
  });
});
