// @vitest-environment node
//
// 72 — Seamless art, Phase 1: "one backdrop, end to end" (issue #686).
//
// `pictureSize(bytes)` reads a picture's **Picture size**, `{ width, height }`,
// off its header: a JPEG's SOF marker, a PNG's IHDR, a WebP's VP8, VP8L or
// VP8X chunk. A header read is a few KB and no ffprobe. Anything it cannot
// read (truncated, an unknown format, not a picture at all) is `null`, and
// such a picture is kept as given.

import { describe, expect, it } from 'vitest';

import {
  jpegBytes,
  pngBytes,
  webpVp8Bytes,
  webpVp8lBytes,
  webpVp8xBytes,
} from '../../test-support/pictureBytes/pictureBytes';

import { pictureSize } from './pictureSize';

describe('pictureSize: the sizes a header gives', () => {
  it("reads a PNG's IHDR", () => {
    expect(pictureSize(pngBytes(3840, 2160))).toEqual({
      width: 3840,
      height: 2160,
    });
  });

  it("reads a JPEG's SOF0, stepping over the segments before it", () => {
    expect(pictureSize(jpegBytes(2000, 3000))).toEqual({
      width: 2000,
      height: 3000,
    });
  });

  it("reads a progressive JPEG's SOF2", () => {
    expect(pictureSize(jpegBytes(3840, 2160, 0xc2))).toEqual({
      width: 3840,
      height: 2160,
    });
  });

  it("reads a lossy WebP's VP8 frame", () => {
    expect(pictureSize(webpVp8Bytes(1280, 720))).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("reads a lossless WebP's VP8L header", () => {
    expect(pictureSize(webpVp8lBytes(500, 750))).toEqual({
      width: 500,
      height: 750,
    });
  });

  it("reads an extended WebP's VP8X canvas", () => {
    expect(pictureSize(webpVp8xBytes(3840, 1600))).toEqual({
      width: 3840,
      height: 1600,
    });
  });

  it('reads the header of a picture that goes on past it', () => {
    const picture = Buffer.concat([pngBytes(1920, 1080), Buffer.alloc(4096)]);

    expect(pictureSize(picture)).toEqual({ width: 1920, height: 1080 });
  });
});

describe('pictureSize: nothing it can read is null', () => {
  it('is null for a PNG cut off inside its IHDR', () => {
    expect(pictureSize(pngBytes(3840, 2160).subarray(0, 20))).toBeNull();
  });

  it('is null for a JPEG cut off before its frame header', () => {
    const whole = jpegBytes(2000, 3000);
    const sof = whole.indexOf(Buffer.from([0xff, 0xc0]));

    expect(pictureSize(whole.subarray(0, sof + 6))).toBeNull();
  });

  it('is null for a JPEG with no frame header at all', () => {
    expect(pictureSize(Buffer.from([0xff, 0xd8, 0xff, 0xd9]))).toBeNull();
  });

  it('is null for a WebP cut off inside its chunk', () => {
    expect(pictureSize(webpVp8Bytes(1280, 720).subarray(0, 26))).toBeNull();
    expect(pictureSize(webpVp8lBytes(500, 750).subarray(0, 22))).toBeNull();
    expect(pictureSize(webpVp8xBytes(3840, 1600).subarray(0, 26))).toBeNull();
  });

  it('is null for a format it does not read: a GIF', () => {
    const gif = Buffer.from([
      ...Buffer.from('GIF89a', 'ascii'),
      0x80,
      0x07,
      0x38,
      0x04,
      0,
      0,
      0,
    ]);

    expect(pictureSize(gif)).toBeNull();
  });

  it('is null for a RIFF that is not a WebP', () => {
    const wave = Buffer.from(webpVp8Bytes(1280, 720));
    wave.write('WAVE', 8, 'ascii');

    expect(pictureSize(wave)).toBeNull();
  });

  it('is null for bytes that are not a picture', () => {
    expect(
      pictureSize(Buffer.from('image bytes of /backdrop-1.jpg'))
    ).toBeNull();
  });

  it('is null for no bytes at all', () => {
    expect(pictureSize(Buffer.alloc(0))).toBeNull();
  });
});
