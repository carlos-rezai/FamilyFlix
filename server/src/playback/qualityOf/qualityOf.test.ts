// @vitest-environment node
//
// 70 — Video quality, Phase 1: "one film, through the Movie form" (issue #664).
//
// A frame size read as a rung of the **Quality ladder**, by its **Nominal
// height**: the larger of the height and the width × 9/16, so a widescreen
// crop and a 4:3 frame land on the rung their picture was made for. Each
// floor sits halfway between two rungs. One case per example frame of design
// log 70 Q4, each floor's two edges, and no rung for a frame with a missing
// or nought dimension.

import { describe, expect, it } from 'vitest';

import { qualityOf } from './qualityOf';

describe('qualityOf — the example frames of each rung', () => {
  it.each([
    [3840, 2160, '4K'],
    [3840, 1600, '4K'],
    [4096, 1716, '4K'],
    [1920, 1080, '1080p'],
    [1920, 800, '1080p'],
    [2560, 1440, '1080p'],
    [1600, 900, '1080p'],
    [1440, 1080, '1080p'],
    [1280, 720, '720p'],
    [1280, 544, '720p'],
    [720, 480, '480p'],
    [720, 576, '480p'],
    [960, 540, '480p'],
    [640, 360, 'SD'],
    [480, 270, 'SD'],
  ])('reads %ix%i as %s', (width, height, rung) => {
    expect(qualityOf({ width, height })).toBe(rung);
  });
});

describe('qualityOf — each floor’s edges, by height', () => {
  it.each([
    [1620, '4K'],
    [1619, '1080p'],
    [900, '1080p'],
    [899, '720p'],
    [600, '720p'],
    [599, '480p'],
    [420, '480p'],
    [419, 'SD'],
  ])('reads a nominal height of %i as %s', (height, rung) => {
    // A narrow width, so the height alone is the nominal height.
    expect(qualityOf({ width: 400, height })).toBe(rung);
  });
});

describe('qualityOf — each floor’s edges, by width', () => {
  it.each([
    [2880, '4K'],
    [2879, '1080p'],
    [1600, '1080p'],
    [1599, '720p'],
    [1067, '720p'],
    [1066, '480p'],
    [747, '480p'],
    [746, 'SD'],
  ])('reads a width of %i over a short frame as %s', (width, rung) => {
    // A short height, so the width × 9/16 is the nominal height.
    expect(qualityOf({ width, height: 100 })).toBe(rung);
  });
});

describe('qualityOf — no rung', () => {
  it('answers null for a frame nothing could size', () => {
    expect(qualityOf(null)).toBeNull();
  });

  it('answers null for a nought width', () => {
    expect(qualityOf({ width: 0, height: 1080 })).toBeNull();
  });

  it('answers null for a nought height', () => {
    expect(qualityOf({ width: 1920, height: 0 })).toBeNull();
  });

  it('answers null for a dimension that is not a number', () => {
    expect(qualityOf({ width: Number.NaN, height: 1080 })).toBeNull();
  });
});
