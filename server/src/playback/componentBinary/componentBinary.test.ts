// @vitest-environment node
//
// 16 — Playback component upload, Phase 2: "an upload changes what the next
// Play decides" (issue #153).
//
// **Component binary**: which half of a **Playback component** a file is, by
// its name and nothing else. This feature's security boundary, the way
// `fileKinds` is media's — the client sorts nothing and labels nothing, the
// server tells the two halves apart, and a part that is neither half never
// becomes a file on disk.
//
// Two rules, and they pull in opposite directions on purpose. What a maintainer
// downloads from a build site is called `ffmpeg-7.1.exe` as often as `ffmpeg`,
// so a version in the name must not make a real component unrecognisable; but
// `myffmpeg.exe` and `ffmpeg.dll` are not halves of anything, and a `.dll` in
// the drop is exactly the mistake the parent makes. The name says which half;
// the **platform** says what that half is called once it is stored, which is
// why what the client called it is never kept.

import { describe, expect, it } from 'vitest';

import { componentBinary } from './componentBinary';

describe('componentBinary — the ffmpeg half', () => {
  it('takes the bare name a POSIX build carries', () => {
    expect(componentBinary('ffmpeg')).toBe('ffmpeg');
  });

  it('takes the Windows build’s .exe', () => {
    expect(componentBinary('ffmpeg.exe')).toBe('ffmpeg');
  });

  it('reads the name case-insensitively', () => {
    // A file dialog on Windows hands back whatever the disk spells, and a
    // maintainer's own rename is not a judgement about the build.
    expect(componentBinary('FFMPEG.EXE')).toBe('ffmpeg');
    expect(componentBinary('FFmpeg')).toBe('ffmpeg');
  });

  it('takes a build that carries its version in the name', () => {
    // What a build site actually hands over. The bytes are stored under the
    // platform's own name afterwards, so the version in the filename costs
    // nothing and refusing it would refuse the commonest download there is.
    expect(componentBinary('ffmpeg-7.1.exe')).toBe('ffmpeg');
    expect(componentBinary('ffmpeg-n6.0-win64-gpl.exe')).toBe('ffmpeg');
  });
});

describe('componentBinary — the ffprobe half', () => {
  it('takes the bare name, the .exe and either casing', () => {
    expect(componentBinary('ffprobe')).toBe('ffprobe');
    expect(componentBinary('ffprobe.exe')).toBe('ffprobe');
    expect(componentBinary('FFprobe.EXE')).toBe('ffprobe');
  });

  it('takes a prober that carries its version in the name', () => {
    expect(componentBinary('ffprobe-7.1.exe')).toBe('ffprobe');
  });
});

describe('componentBinary — what may not be added', () => {
  it('refuses a file that is not a binary at all', () => {
    // The parent's mistake, and the whole reason this unit is a boundary
    // rather than a convenience: a `.dll` is a codec pack in the old sense
    // and nothing this app can run.
    expect(componentBinary('avcodec-60.dll')).toBeNull();
    expect(componentBinary('ffmpeg.dll')).toBeNull();
    expect(componentBinary('ffprobe.dll')).toBeNull();
  });

  it('refuses a document, an image and an archive', () => {
    expect(componentBinary('poster.jpg')).toBeNull();
    expect(componentBinary('readme.txt')).toBeNull();
    expect(componentBinary('ffmpeg.txt')).toBeNull();
    expect(componentBinary('codecs.zip')).toBeNull();
  });

  it('refuses a name that merely ends in one of the two', () => {
    // The rule is which binary this *is*, not which one it mentions.
    expect(componentBinary('myffmpeg.exe')).toBeNull();
    expect(componentBinary('notffprobe')).toBeNull();
  });

  it('refuses a part that arrived with no filename at all', () => {
    expect(componentBinary('')).toBeNull();
  });
});
