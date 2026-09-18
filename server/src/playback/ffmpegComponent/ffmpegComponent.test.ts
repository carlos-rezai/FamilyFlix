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
// second parameter, which is `probe`'s seam too.
//
// 15 — Settings hub, Phase 1: "the tracer bullet" (issue #143) makes that
// parameter a pair — `encoders` and `decoders`, one seam for both spawns — and
// gives the component `decoders()`: what `ffmpeg -decoders` printed, raw, or
// `null` for every way of not knowing, the way `probe` hands over raw output.
// `capabilities` reads it off the component rather than resolving a binary of
// its own, which is what keeps the Settings page and the Play button on one
// answer. The encoder detection is unchanged.
//
// What no test here asserts is that a machine can actually *run* what its
// ffmpeg build lists — a laptop with no NVIDIA card still gets `h264_nvenc`
// from a full build. That is not something a test can pin, and the journal is
// right about it; the selection is the half that is ours.

import { describe, expect, it, vi } from 'vitest';

import type { FfmpegBinaries } from '../ffmpegBinary/ffmpegBinary';

import { ffmpegComponent, type FfmpegListing } from './ffmpegComponent';

/** A resolved pair, of the shape `ffmpegBinary` answers with. */
const BINARIES: FfmpegBinaries = {
  ffmpeg: '/opt/ffmpeg/bin/ffmpeg',
  ffprobe: '/opt/ffmpeg/bin/ffprobe',
};

/** What `ffmpeg -decoders` prints, trimmed to a few lines. */
const DECODERS = [
  'Decoders:',
  ' V..... = Video',
  ' A..... = Audio',
  ' ------',
  ' VFS..D h264                 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10',
  ' VFS..D hevc                 HEVC (High Efficiency Video Coding)',
  ' A....D ac3                  ATSC A/52A (AC-3)',
].join('\n');

/**
 * A pair over fixed answers — what each of the two spawns would have printed.
 * The decoder side answers `null` unless a test says otherwise, because the
 * encoder tests have nothing to say about it.
 */
function pair(
  encoders: string | null,
  decoders: string | null = null
): FfmpegListing {
  return { encoders: () => encoders, decoders: () => decoders };
}

/** What `ffmpeg -encoders` prints: a legend, a rule, then one line each. */
function listing(...encoders: string[]): FfmpegListing {
  const lines = [
    'Encoders:',
    ' V..... = Video',
    ' A..... = Audio',
    ' ------',
    ' V....D libx264              libx264 H.264 / AVC',
    ...encoders.map((name) => ` V....D ${name}          hardware H.264`),
    ' A....D aac                  AAC (Advanced Audio Coding)',
  ];
  return pair(lines.join('\n'));
}

/** The hardware encoder a component composed over that listing reports. */
function encoderFrom(listed: FfmpegListing): string | null {
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
    expect(encoderFrom(pair(''))).toBeNull();
  });

  it('answers null when the process could not be run', () => {
    // A binary that will not start: the component is still composed, and the
    // conversion it would have run falls back to software.
    expect(encoderFrom(pair(null))).toBeNull();
  });
});

describe('ffmpegComponent — what it decodes', () => {
  it('hands over what the decoder listing printed, raw', () => {
    // Raw rather than parsed: the parsing is `capabilities`' and it is asked
    // about a string, the way `probe` is asked about ffprobe's output.
    const component = ffmpegComponent(BINARIES, pair(null, DECODERS));

    expect(component.decoders()).toBe(DECODERS);
  });

  it('hands over null when the listing could not be read', () => {
    // Every way of not knowing is one answer: a binary that will not start, a
    // build that prints nothing usable. The component is there either way.
    const component = ffmpegComponent(BINARIES, pair(null, null));

    expect(component.decoders()).toBeNull();
  });

  it('asks the decoder side of the pair, on the ffmpeg it was handed', () => {
    const decoders = vi.fn<FfmpegListing['decoders']>(() => DECODERS);

    ffmpegComponent(BINARIES, { encoders: () => null, decoders }).decoders();

    expect(decoders).toHaveBeenCalledWith('/opt/ffmpeg/bin/ffmpeg');
  });

  it('never reads the decoder listing to choose an encoder', () => {
    // One seam, two spawns, and neither answer stands in for the other: a
    // decoder listing naming a hardware encoder is still not an encoder.
    const component = ffmpegComponent(
      BINARIES,
      pair(null, ' V....D h264_nvenc          NVIDIA NVENC H.264')
    );

    expect(component.hardwareEncoder).toBeNull();
  });
});

describe('ffmpegComponent — the seam and the composition', () => {
  it('asks the ffmpeg it was handed, not some ffmpeg on the path', () => {
    const encoders = vi.fn<FfmpegListing['encoders']>(() => null);

    ffmpegComponent(BINARIES, { encoders, decoders: () => null });

    expect(encoders).toHaveBeenCalledExactlyOnceWith('/opt/ffmpeg/bin/ffmpeg');
  });

  it('asks once, when the component is composed', () => {
    // It is a fact about the machine, and asking ffmpeg what it can encode
    // costs more than the film it would be asked about.
    const encoders = vi.fn<FfmpegListing['encoders']>(() => null);

    const component = ffmpegComponent(BINARIES, {
      encoders,
      decoders: () => null,
    });
    void component.hardwareEncoder;
    void component.hardwareEncoder;

    expect(encoders).toHaveBeenCalledOnce();
  });

  it('composes a component that can be asked the other three things', () => {
    const component = ffmpegComponent(BINARIES, pair(null));

    expect(typeof component.probe).toBe('function');
    expect(typeof component.spawn).toBe('function');
    expect(typeof component.decoders).toBe('function');
  });
});
