/**
 * Pure: the **FFmpeg target**, what differs between the two **FFmpeg pin**
 * archives. `archive` is the kind of file the pin's URL serves, `wanted` the
 * entries under the archive's one top folder paired with the names shipped
 * (the licence always as `LICENSE.txt`), `build` the README's `Build:` line,
 * and `builder`/`home` who built it and where its build configuration is
 * listed. Any platform but `win32` and `linux` is refused in a sentence.
 *
 * Written with erasable types only, so `fetchFfmpeg.mjs` imports it directly
 * under Node's own type stripping.
 */
export interface FfmpegTarget {
  archive: 'zip' | 'tar.xz';
  wanted: ReadonlyArray<readonly [string, string]>;
  build: string;
  builder: string;
  home: string;
}

export function ffmpegTarget(platform: string): FfmpegTarget {
  if (platform === 'win32') {
    return {
      archive: 'zip',
      wanted: [
        ['bin/ffmpeg.exe', 'ffmpeg.exe'],
        ['bin/ffprobe.exe', 'ffprobe.exe'],
        ['LICENSE', 'LICENSE.txt'],
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
        ['bin/ffmpeg', 'ffmpeg'],
        ['bin/ffprobe', 'ffprobe'],
        ['LICENSE.txt', 'LICENSE.txt'],
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
