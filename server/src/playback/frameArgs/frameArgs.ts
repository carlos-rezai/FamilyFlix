/**
 * The **Frame point**: where in a video its one picture is taken, as a share
 * of its duration — a third of the way in, past any opening titles and well
 * short of the credits.
 */
export const FRAME_POINT = 1 / 3;

/**
 * The argv one picture is taken with, `atSeconds` into `file`.
 *
 * **Input seeking** — `-ss` before `-i` — so ffmpeg jumps to the nearest
 * keyframe rather than decoding a 12 GB file up to the Frame point. One video
 * frame, no audio and no subtitles, written to stdout as a JPEG at the video's
 * native resolution: no scale filter, and no temp file.
 */
export function frameArgs(file: string, atSeconds: number): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-ss',
    String(atSeconds),
    '-i',
    file,
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
  ];
}
