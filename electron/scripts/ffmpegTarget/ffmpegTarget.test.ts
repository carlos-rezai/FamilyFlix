// @vitest-environment node
//
// Issue #514 — the Linux FFmpeg. `ffmpegTarget(platform)` is the **FFmpeg
// target**, pure: what differs between the two **FFmpeg pin** archives. On
// Windows gyan.dev's essentials zip, on Linux BtbN's linux64 GPL tar.xz; each
// answers its archive kind, the entries taken from under the archive's one
// top folder paired with the names shipped (the licence always as
// `LICENSE.txt`), and the README's `Build:` line. Any other platform is
// refused in a sentence. Each answer is asked on any machine by passing the
// platform in.

import { describe, expect, it } from 'vitest';

import { ffmpegTarget } from './ffmpegTarget';

/** The pairs in a stable order, so the assertion is not about order. */
function sorted(
  pairs: ReadonlyArray<readonly [string, string]>
): Array<[string, string]> {
  return pairs
    .map(([inner, shipped]): [string, string] => [inner, shipped])
    .sort(([a], [b]) => a.localeCompare(b));
}

describe('ffmpegTarget on Windows', () => {
  it('reads a zip', () => {
    expect(ffmpegTarget('win32').archive).toBe('zip');
  });

  it('takes ffmpeg.exe, ffprobe.exe and the licence, shipped as LICENSE.txt', () => {
    expect(sorted(ffmpegTarget('win32').wanted)).toEqual(
      sorted([
        ['bin/ffmpeg.exe', 'ffmpeg.exe'],
        ['bin/ffprobe.exe', 'ffprobe.exe'],
        ['LICENSE', 'LICENSE.txt'],
      ])
    );
  });

  it('names gyan.dev’s essentials build', () => {
    const { build } = ffmpegTarget('win32');

    expect(build).toMatch(/gyan\.dev/);
    expect(build).toMatch(/essentials/i);
    expect(build).toMatch(/Windows/);
  });
});

describe('ffmpegTarget on Linux', () => {
  it('reads a tar.xz', () => {
    expect(ffmpegTarget('linux').archive).toBe('tar.xz');
  });

  it('takes the extensionless ffmpeg and ffprobe and the licence, shipped as LICENSE.txt', () => {
    expect(sorted(ffmpegTarget('linux').wanted)).toEqual(
      sorted([
        ['bin/ffmpeg', 'ffmpeg'],
        ['bin/ffprobe', 'ffprobe'],
        ['LICENSE.txt', 'LICENSE.txt'],
      ])
    );
  });

  it('names BtbN’s linux64 GPL build', () => {
    const { build } = ffmpegTarget('linux');

    expect(build).toMatch(/BtbN/);
    expect(build).toMatch(/linux64/);
    expect(build).toMatch(/GPL/);
  });
});

describe('ffmpegTarget on any other platform', () => {
  it('refuses it in a sentence naming the platform', () => {
    expect(() => ffmpegTarget('darwin')).toThrow(/darwin.*\.$/);
  });
});
