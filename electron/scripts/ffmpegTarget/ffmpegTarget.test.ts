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
//
// Issue #522: each wanted entry says whether it ships executable, so the
// executable bit is a fact a Windows test reads, not a name the fetch
// script compares.

import { describe, expect, it } from 'vitest';

import { ffmpegTarget, type FfmpegEntry } from './ffmpegTarget';

/** The entries in a stable order, so the assertion is not about order. */
function sorted(entries: ReadonlyArray<FfmpegEntry>): FfmpegEntry[] {
  return [...entries].sort((a, b) => a.inner.localeCompare(b.inner));
}

describe('ffmpegTarget on Windows', () => {
  it('reads a zip', () => {
    expect(ffmpegTarget('win32').archive).toBe('zip');
  });

  it('takes ffmpeg.exe and ffprobe.exe, executable, and the licence as LICENSE.txt, not', () => {
    expect(sorted(ffmpegTarget('win32').wanted)).toEqual(
      sorted([
        { inner: 'bin/ffmpeg.exe', shipped: 'ffmpeg.exe', executable: true },
        { inner: 'bin/ffprobe.exe', shipped: 'ffprobe.exe', executable: true },
        { inner: 'LICENSE', shipped: 'LICENSE.txt', executable: false },
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

  it('takes the extensionless ffmpeg and ffprobe, executable, and the licence as LICENSE.txt, not', () => {
    expect(sorted(ffmpegTarget('linux').wanted)).toEqual(
      sorted([
        { inner: 'bin/ffmpeg', shipped: 'ffmpeg', executable: true },
        { inner: 'bin/ffprobe', shipped: 'ffprobe', executable: true },
        { inner: 'LICENSE.txt', shipped: 'LICENSE.txt', executable: false },
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
