// @vitest-environment node
//
// What the double promises, asserted the way `freshStorage.test.ts` asserts
// its own: the files it says it wrote are there, they are executable where a
// platform has such a bit, and nothing else is in the directory — a resolver
// asked "is there an ffprobe here" must be answered by the fixture and not by
// something the fixture left lying about.

import {
  accessSync,
  constants,
  existsSync,
  readdirSync,
  statSync,
} from 'node:fs';
import { describe, expect, it } from 'vitest';

import { EXE, componentDir, ffmpegIn, ffprobeIn } from './componentDir';

describe('componentDir', () => {
  it('writes both binaries by default', () => {
    const dir = componentDir();

    expect(statSync(ffmpegIn(dir)).isFile()).toBe(true);
    expect(statSync(ffprobeIn(dir)).isFile()).toBe(true);
  });

  it('writes only the binaries it was asked for', () => {
    const dir = componentDir(['ffmpeg']);

    expect(readdirSync(dir)).toEqual([`ffmpeg${EXE}`]);
  });

  it('holds nothing but the named binaries', () => {
    const dir = componentDir();

    expect(readdirSync(dir).sort()).toEqual(
      [`ffmpeg${EXE}`, `ffprobe${EXE}`].sort()
    );
  });

  it('can be asked for a directory with nothing in it at all', () => {
    // The absent-component case: a directory on PATH that has no component in
    // it is not the same as no directory.
    expect(readdirSync(componentDir([]))).toEqual([]);
  });

  it('marks the files executable where the platform has such a bit', () => {
    const dir = componentDir();

    if (process.platform === 'win32') {
      // Windows decides by extension, which is what EXE is for.
      expect(ffmpegIn(dir).endsWith('.exe')).toBe(true);
      return;
    }

    expect(() => accessSync(ffmpegIn(dir), constants.X_OK)).not.toThrow();
    expect(() => accessSync(ffprobeIn(dir), constants.X_OK)).not.toThrow();
  });

  it('hands out a fresh directory each time it is called', () => {
    expect(componentDir()).not.toBe(componentDir());
  });

  it('writes empty files — they are found, never run', () => {
    expect(statSync(ffmpegIn(componentDir())).size).toBe(0);
  });
});

/**
 * The property that let the cleanup move here rather than stay at the call
 * site: the module-scope `afterEach` is registered once per importing file, so
 * a directory a test made is gone by the next one. `freshStorage` recorded the
 * finding; this pins it for the two suites that now depend on it.
 */
describe('componentDir — the sandbox is swept between tests', () => {
  let left: string;

  it('makes a directory', () => {
    left = componentDir();

    expect(existsSync(left)).toBe(true);
  });

  it('and the next test does not find it', () => {
    expect(existsSync(left)).toBe(false);
  });
});
