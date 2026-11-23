/** The formats a picture is fitted in, each written back in its own. */
export type ArtFormat = 'jpeg' | 'png' | 'webp';

/** The encoder flags each **ArtFormat** is written with. */
const ENCODERS: Record<ArtFormat, string[]> = {
  jpeg: ['-c:v', 'mjpeg', '-q:v', '3'],
  png: ['-c:v', 'png'],
  webp: ['-c:v', 'libwebp'],
};

/**
 * The argv one picture is fitted with, beside `frameArgs`: the picture on
 * stdin, a Lanczos `scale=<width>:-2` (the height follows, kept even), and
 * one picture written to stdout in its own **ArtFormat**.
 */
export function fitArgs(width: number, format: ArtFormat): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    'pipe:0',
    '-vf',
    `scale=${width}:-2:flags=lanczos`,
    '-frames:v',
    '1',
    '-f',
    'image2pipe',
    ...ENCODERS[format],
    'pipe:1',
  ];
}
