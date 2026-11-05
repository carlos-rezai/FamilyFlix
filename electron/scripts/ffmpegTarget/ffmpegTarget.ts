/**
 * Pure: the **FFmpeg target**, what differs between the two **FFmpeg pin**
 * archives. `archive` is the kind of file the pin's URL serves, `wanted` the
 * entries under the archive's one top folder, each with the name shipped
 * (the licence always as `LICENSE.txt`) and whether it ships executable
 * (`ffmpeg` and `ffprobe` do, the licence not), `build` the README's
 * `Build:` line, and `builder`/`home` who built it and where its build
 * configuration is listed. Any platform but `win32` and `linux` is refused in a sentence.
 *
 * Written with erasable types only, so `fetchFfmpeg.mjs` imports it directly
 * under Node's own type stripping.
 */
export interface FfmpegEntry {
  /** The path under the archive's one top folder. */
  inner: string;
  /** The file's name in `electron/.ffmpeg/`. */
  shipped: string;
  /** Whether it is written executable: a program, not the licence. */
  executable: boolean;
}

export interface FfmpegTarget {
  archive: 'zip' | 'tar.xz';
  wanted: ReadonlyArray<FfmpegEntry>;
  build: string;
  builder: string;
  home: string;
}

export function ffmpegTarget(platform: NodeJS.Platform): FfmpegTarget {
  if (platform === 'win32') {
    return {
      archive: 'zip',
      wanted: [
        { inner: 'bin/ffmpeg.exe', shipped: 'ffmpeg.exe', executable: true },
        { inner: 'bin/ffprobe.exe', shipped: 'ffprobe.exe', executable: true },
        { inner: 'LICENSE', shipped: 'LICENSE.txt', executable: false },
      ],
      build: 'gyan.dev release essentials, Windows x64',
      builder: 'gyan.dev',
      home: 'https://www.gyan.dev/ffmpeg/builds/',
    };
  }
  if (platform === 'linux') {
    return {
      archive: 'tar.xz',
      wanted: [
        { inner: 'bin/ffmpeg', shipped: 'ffmpeg', executable: true },
        { inner: 'bin/ffprobe', shipped: 'ffprobe', executable: true },
        { inner: 'LICENSE.txt', shipped: 'LICENSE.txt', executable: false },
      ],
      build: 'BtbN FFmpeg-Builds linux64 GPL, Linux x64',
      builder: 'BtbN',
      home: 'https://github.com/BtbN/FFmpeg-Builds',
    };
  }
  throw new Error(
    `FFmpeg is fetched for Windows and Linux only, not for ${platform}.`
  );
}
