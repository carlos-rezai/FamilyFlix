// @vitest-environment node
//
// 70 — Video quality, Phase 1: "one film, through the Movie form" (issue #664).
//
// The probe learns the picture's size, read off the same stream it already
// picks for `videoCodec`: the first video stream that is not an attached cover
// picture. A file with no picture stream, or one that will not say how big its
// picture is, has no size, which `qualityOf` reads as no rung.

import { describe, expect, it } from 'vitest';

import { probe, type ProbeOutput } from './probe';

/** ffprobe's `-print_format json`, as a function that never runs anything. */
function printing(streams: Array<Record<string, unknown>>): ProbeOutput {
  return () =>
    JSON.stringify({
      format: { format_name: 'matroska,webm', duration: '6832.500000' },
      streams,
    });
}

const AAC = { codec_type: 'audio', codec_name: 'aac' };

/** A cover picture a Matroska carries as a video stream of its own. */
const COVER = {
  codec_type: 'video',
  codec_name: 'mjpeg',
  width: 600,
  height: 900,
  disposition: { attached_pic: 1 },
};

describe('probe — the picture’s size', () => {
  it('reads the width and height of the picture stream', () => {
    const output = printing([
      { codec_type: 'video', codec_name: 'h264', width: 1920, height: 800 },
      AAC,
    ]);

    expect(probe('ffprobe', 'film.mkv', output)?.frameSize).toEqual({
      width: 1920,
      height: 800,
    });
  });

  it('skips an attached cover picture for the film’s own stream', () => {
    const output = printing([
      COVER,
      { codec_type: 'video', codec_name: 'hevc', width: 3840, height: 2160 },
      AAC,
    ]);

    expect(probe('ffprobe', 'film.mkv', output)?.frameSize).toEqual({
      width: 3840,
      height: 2160,
    });
  });

  it('answers null for a file with no video stream', () => {
    expect(probe('ffprobe', 'film.mkv', printing([AAC]))?.frameSize).toBeNull();
  });

  it('answers null when the only video stream is a cover picture', () => {
    expect(
      probe('ffprobe', 'film.mkv', printing([COVER, AAC]))?.frameSize
    ).toBeNull();
  });

  it('answers null for a picture stream that will not say its size', () => {
    const output = printing([{ codec_type: 'video', codec_name: 'h264' }, AAC]);

    const probed = probe('ffprobe', 'film.mkv', output);

    expect(probed).not.toBeNull();
    expect(probed?.frameSize).toBeNull();
  });
});
