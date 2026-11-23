// @vitest-environment node
//
// 72 — Seamless art, Phase 1: "one backdrop, end to end" (issue #686).
//
// `fitArgs(width, format)` is the argv one picture is fitted with, beside
// `frameArgs`: the picture on stdin, a Lanczos `scale=<width>:-2` (the height
// follows, kept even), and written to stdout in its own **ArtFormat**:
// `mjpeg -q:v 3` for a JPEG, `png` for a PNG, `libwebp` for a WebP.

import { describe, expect, it } from 'vitest';

import { fitArgs } from './fitArgs';

/** The value an argv gives a flag, or `undefined` for a flag it lacks. */
const valueOf = (args: string[], flag: string): string | undefined => {
  const at = args.indexOf(flag);
  return at === -1 ? undefined : args[at + 1];
};

describe('fitArgs: every format', () => {
  it.each(['jpeg', 'png', 'webp'] as const)(
    'reads the %s picture off stdin',
    (format) => {
      expect(valueOf(fitArgs(1920, format), '-i')).toBe('pipe:0');
    }
  );

  it.each(['jpeg', 'png', 'webp'] as const)(
    'writes the %s picture to stdout, last',
    (format) => {
      expect(fitArgs(1920, format).at(-1)).toBe('pipe:1');
    }
  );

  it.each(['jpeg', 'png', 'webp'] as const)(
    'scales the %s picture to the width with Lanczos, the height following',
    (format) => {
      expect(valueOf(fitArgs(780, format), '-vf')).toBe(
        'scale=780:-2:flags=lanczos'
      );
    }
  );

  it('scales to the width it is given', () => {
    expect(valueOf(fitArgs(1920, 'jpeg'), '-vf')).toBe(
      'scale=1920:-2:flags=lanczos'
    );
  });

  it('keeps the output quiet: no banner, errors only', () => {
    const args = fitArgs(1920, 'jpeg');

    expect(args).toContain('-hide_banner');
    expect(valueOf(args, '-loglevel')).toBe('error');
  });

  it('writes one picture', () => {
    expect(valueOf(fitArgs(1920, 'png'), '-frames:v')).toBe('1');
  });
});

describe('fitArgs: the encoder per format', () => {
  it('encodes a JPEG with mjpeg at -q:v 3', () => {
    const args = fitArgs(1920, 'jpeg');

    expect(valueOf(args, '-c:v')).toBe('mjpeg');
    expect(valueOf(args, '-q:v')).toBe('3');
  });

  it('encodes a PNG with png', () => {
    const args = fitArgs(1920, 'png');

    expect(valueOf(args, '-c:v')).toBe('png');
    expect(args).not.toContain('-q:v');
  });

  it('encodes a WebP with libwebp', () => {
    expect(valueOf(fitArgs(1920, 'webp'), '-c:v')).toBe('libwebp');
  });
});
