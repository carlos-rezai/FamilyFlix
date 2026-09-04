// @vitest-environment node
//
// 10 — Video player refactor, Group F: the four playback modules nothing named
// (issue #94).
//
// What this machine can be asked to do. The part that is ours is the
// *selection*: five hardware H.264 encoders in a preference order, picked from
// what a build of ffmpeg says it was compiled with, and software when it says
// none of them.
//
// Nothing here spawns anything. The listing arrives through `ffmpegComponent`'s
// second parameter, which is `capabilities`' seam and `probe`'s.
//
// What no test here asserts is that a machine can actually *run* what its
// ffmpeg build lists — a laptop with no NVIDIA card still gets `h264_nvenc`
// from a full build. That is not something a test can pin, and the journal is
// right about it; the selection is the half that is ours.

import { describe, expect, it, vi } from 'vitest';

import type { FfmpegBinaries } from '../ffmpegBinary/ffmpegBinary';

import { ffmpegComponent, type EncoderListing } from './ffmpegComponent';

/** A resolved pair, of the shape `ffmpegBinary` answers with. */
const BINARIES: FfmpegBinaries = {
  ffmpeg: '/opt/ffmpeg/bin/ffmpeg',
  ffprobe: '/opt/ffmpeg/bin/ffprobe',
};

/** What `ffmpeg -encoders` prints: a legend, a rule, then one line each. */
function listing(...encoders: string[]): EncoderListing {
  const lines = [
    'Encoders:',
    ' V..... = Video',
    ' A..... = Audio',
    ' ------',
    ' V....D libx264              libx264 H.264 / AVC',
    ...encoders.map((name) => ` V....D ${name}          hardware H.264`),
    ' A....D aac                  AAC (Advanced Audio Coding)',
  ];
  return () => lines.join('\n');
}

/** The hardware encoder a component composed over that listing reports. */
function encoderFrom(listed: EncoderListing): string | null {
  return ffmpegComponent(BINARIES, listed).hardwareEncoder;
}

describe('ffmpegComponent — which hardware encoder is chosen', () => {
  it('takes the only one a build lists', () => {
    expect(encoderFrom(listing('h264_qsv'))).toBe('h264_qsv');
  });

  it('prefers NVENC over everything else', () => {
    expect(
      encoderFrom(listing('h264_vaapi', 'h264_amf', 'h264_qsv', 'h264_nvenc'))
    ).toBe('h264_nvenc');
  });

  it('prefers Quick Sync when there is no NVENC', () => {
    expect(
      encoderFrom(listing('h264_vaapi', 'h264_videotoolbox', 'h264_qsv'))
    ).toBe('h264_qsv');
  });

  it('prefers AMF when there is neither', () => {
    expect(encoderFrom(listing('h264_vaapi', 'h264_amf'))).toBe('h264_amf');
  });

  it('prefers VideoToolbox over VAAPI', () => {
    expect(encoderFrom(listing('h264_vaapi', 'h264_videotoolbox'))).toBe(
      'h264_videotoolbox'
    );
  });

  it('falls back to VAAPI, the last of the five', () => {
    expect(encoderFrom(listing('h264_vaapi'))).toBe('h264_vaapi');
  });

  it('reads the preference order and not the order the build printed', () => {
    // The whole point of a preference order: ffmpeg lists alphabetically, and
    // taking the first line would make `h264_amf` beat `h264_nvenc` forever.
    expect(encoderFrom(listing('h264_amf', 'h264_nvenc'))).toBe('h264_nvenc');
  });
});

describe('ffmpegComponent — when there is no hardware encoder', () => {
  it('answers null for a build with software encoding only', () => {
    // Software is slower and always there, which is why this is a state and
    // not a failure.
    expect(encoderFrom(listing())).toBeNull();
  });

  it('answers null for a build that lists nothing at all', () => {
    expect(encoderFrom(() => '')).toBeNull();
  });

  it('answers null when the process could not be run', () => {
    // A binary that will not start: the component is still composed, and the
    // conversion it would have run falls back to software.
    expect(encoderFrom(() => null)).toBeNull();
  });
});

describe('ffmpegComponent — the seam and the composition', () => {
  it('asks the ffmpeg it was handed, not some ffmpeg on the path', () => {
    const listed = vi.fn<EncoderListing>(() => null);

    ffmpegComponent(BINARIES, listed);

    expect(listed).toHaveBeenCalledExactlyOnceWith('/opt/ffmpeg/bin/ffmpeg');
  });

  it('asks once, when the component is composed', () => {
    // It is a fact about the machine, and asking ffmpeg what it can encode
    // costs more than the film it would be asked about.
    const listed = vi.fn<EncoderListing>(() => null);

    const component = ffmpegComponent(BINARIES, listed);
    void component.hardwareEncoder;
    void component.hardwareEncoder;

    expect(listed).toHaveBeenCalledOnce();
  });

  it('composes a component that can be asked the other two things', () => {
    const component = ffmpegComponent(BINARIES, () => null);

    expect(typeof component.probe).toBe('function');
    expect(typeof component.spawn).toBe('function');
  });
});
