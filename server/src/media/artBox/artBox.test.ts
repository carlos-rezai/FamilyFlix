// @vitest-environment node
//
// 72 — Seamless art, Phase 1: "one backdrop, end to end" (issue #686).
//
// `artBox(size)` answers the width a picture is fitted to, or `null` when it
// is within its **Art box**. By shape, not role, because the media domain
// writes by filename: a picture at least as wide as it is tall is landscape
// (`LANDSCAPE_BOX`, 1920), any other portrait (`PORTRAIT_BOX`, 780, the 300px
// detail poster frame at 2.6x). Never enlarged; the height follows.

import { describe, expect, it } from 'vitest';

import { artBox, LANDSCAPE_BOX, PORTRAIT_BOX } from './artBox';

describe('artBox: the boxes', () => {
  it('is 1920 wide for a landscape picture and 780 for a portrait one', () => {
    expect(LANDSCAPE_BOX).toBe(1920);
    expect(PORTRAIT_BOX).toBe(780);
  });
});

describe('artBox: a landscape picture', () => {
  it('over its box is fitted to 1920 wide', () => {
    expect(artBox({ width: 3840, height: 2160 })).toBe(1920);
  });

  it('just over its box is fitted too', () => {
    expect(artBox({ width: 1921, height: 1080 })).toBe(1920);
  });

  it('at its box is kept', () => {
    expect(artBox({ width: 1920, height: 1080 })).toBeNull();
  });

  it('under its box is kept, never enlarged', () => {
    expect(artBox({ width: 1280, height: 720 })).toBeNull();
  });
});

describe('artBox: a portrait picture', () => {
  it('over its box is fitted to 780 wide', () => {
    expect(artBox({ width: 2000, height: 3000 })).toBe(780);
  });

  it('just over its box is fitted too', () => {
    expect(artBox({ width: 781, height: 1170 })).toBe(780);
  });

  it('at its box is kept', () => {
    expect(artBox({ width: 780, height: 1170 })).toBeNull();
  });

  it('under its box is kept, never enlarged', () => {
    expect(artBox({ width: 500, height: 750 })).toBeNull();
  });
});

describe('artBox: a square picture', () => {
  it('counts as landscape: 1000 square is within 1920 and kept', () => {
    expect(artBox({ width: 1000, height: 1000 })).toBeNull();
  });

  it('counts as landscape: 2000 square is fitted to 1920', () => {
    expect(artBox({ width: 2000, height: 2000 })).toBe(1920);
  });
});
