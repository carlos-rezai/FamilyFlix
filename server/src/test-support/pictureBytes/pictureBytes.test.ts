// @vitest-environment node
//
// 72 — Seamless art, Phase 1: "one backdrop, end to end" (issue #686).
//
// The minimal picture headers the `pictureSize` and `createMedia` suites hand
// over, checked byte for byte at the offsets each format's own spec puts its
// size, so a header read is proven against the format rather than against a
// builder that agrees with it.

import { describe, expect, it } from 'vitest';

import {
  jpegBytes,
  pngBytes,
  webpVp8Bytes,
  webpVp8lBytes,
  webpVp8xBytes,
} from './pictureBytes';

describe('pictureBytes', () => {
  it('writes a PNG signature and its IHDR, the size big-endian', () => {
    const bytes = pngBytes(3840, 2160);

    expect([...bytes.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(bytes.toString('ascii', 12, 16)).toBe('IHDR');
    expect(bytes.readUInt32BE(16)).toBe(3840);
    expect(bytes.readUInt32BE(20)).toBe(2160);
  });

  it('writes a JPEG from SOI to EOI, its frame header after the segments it steps over', () => {
    const bytes = jpegBytes(2000, 3000);
    const sof = bytes.indexOf(Buffer.from([0xff, 0xc0]));

    expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect([...bytes.subarray(-2)]).toEqual([0xff, 0xd9]);
    expect(sof).toBeGreaterThan(2 + 18);
    expect(bytes.readUInt16BE(sof + 5)).toBe(3000);
    expect(bytes.readUInt16BE(sof + 7)).toBe(2000);
  });

  it('writes a progressive JPEG under SOF2', () => {
    expect(jpegBytes(10, 20, 0xc2).includes(Buffer.from([0xff, 0xc2]))).toBe(
      true
    );
  });

  it('writes a RIFF WebP whose size counts everything after it', () => {
    const bytes = webpVp8Bytes(1280, 720);

    expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
    expect(bytes.readUInt32LE(4)).toBe(bytes.length - 8);
    expect(bytes.toString('ascii', 8, 12)).toBe('WEBP');
  });

  it('writes a VP8 key frame, the size little-endian after the start code', () => {
    const bytes = webpVp8Bytes(1280, 720);

    expect(bytes.toString('ascii', 12, 16)).toBe('VP8 ');
    expect([...bytes.subarray(23, 26)]).toEqual([0x9d, 0x01, 0x2a]);
    expect(bytes.readUInt16LE(26)).toBe(1280);
    expect(bytes.readUInt16LE(28)).toBe(720);
  });

  it('writes a VP8L signature, then width-1 and height-1 in 14 bits each', () => {
    const bytes = webpVp8lBytes(500, 750);
    const bits = bytes.readUInt32LE(21);

    expect(bytes.toString('ascii', 12, 16)).toBe('VP8L');
    expect(bytes[20]).toBe(0x2f);
    expect((bits & 0x3fff) + 1).toBe(500);
    expect(((bits >> 14) & 0x3fff) + 1).toBe(750);
  });

  it('writes a VP8X canvas, width-1 and height-1 in 24 bits each', () => {
    const bytes = webpVp8xBytes(3840, 1600);

    expect(bytes.toString('ascii', 12, 16)).toBe('VP8X');
    expect(bytes.readUIntLE(24, 3) + 1).toBe(3840);
    expect(bytes.readUIntLE(27, 3) + 1).toBe(1600);
  });
});
