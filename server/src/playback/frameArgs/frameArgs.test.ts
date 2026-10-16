// @vitest-environment node
//
// 44 — Episode stills, Phase 2: "the grab" (issue #383).
//
// `frameArgs` is the argv one picture is taken with: input seeking — `-ss`
// before `-i`, so a 12 GB file is not decoded up to the **Frame point** — one
// video frame, no audio and no subtitles, written to stdout as a JPEG at the
// video's native resolution. `FRAME_POINT` is where in the video it is taken.

import { describe, expect, it } from 'vitest';

import { FRAME_POINT, frameArgs } from './frameArgs';

describe('frameArgs', () => {
  it('is the whole argv, in order, the time at the given seconds', () => {
    expect(frameArgs('D:\\Shows\\S01E03.mkv', 1367.5)).toEqual([
      '-hide_banner',
      '-loglevel',
      'error',
      '-ss',
      '1367.5',
      '-i',
      'D:\\Shows\\S01E03.mkv',
      '-frames:v',
      '1',
      '-an',
      '-sn',
      '-f',
      'image2pipe',
      '-c:v',
      'mjpeg',
      '-q:v',
      '3',
      'pipe:1',
    ]);
  });

  it('seeks on the input: -ss comes before -i', () => {
    const args = frameArgs('/films/a.mkv', 60);

    expect(args.indexOf('-ss')).toBeGreaterThanOrEqual(0);
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(args[args.indexOf('-ss') + 1]).toBe('60');
    expect(args[args.indexOf('-i') + 1]).toBe('/films/a.mkv');
  });

  it('keeps the native resolution: no scale filter', () => {
    const args = frameArgs('/films/a.mkv', 60);

    expect(args).not.toContain('-vf');
    expect(args).not.toContain('-s');
  });
});

describe('FRAME_POINT', () => {
  it('is a third of the way in', () => {
    expect(FRAME_POINT).toBe(1 / 3);
  });
});
