// @vitest-environment node
//
// 16 — Playback component upload, Phase 2: "an upload changes what the next
// Play decides" (issue #153).
//
// A **Verified component**: a staged pair that has actually been run. Both
// binaries are asked for their version, both must exit `0`, and both must open
// with the word that says what they are — `ffmpeg version` / `ffprobe version`.
// That single test is everything the slot knows about whether a drop is a
// **Playback component**, and it is applied **before the live component is
// touched**, which is what makes a bad drop cost the family nothing.
//
// A `.dll`, a text file renamed `ffmpeg.exe`, a macOS build on a Windows
// machine and a binary that will not start at all all fail the same way, and
// the family hears one sentence about all four. Naming the reason would be
// naming an errno.
//
// `VersionRun` is the injected seam, for the reason `ffmpegComponent`'s
// `Listing` seam exists: a unit that spawns must be assertable on a machine
// with no FFmpeg on it — which is what CI is. `null` is every way of not
// starting: the file is not executable, it is the wrong architecture, the OS
// refused it.

import { describe, expect, it } from 'vitest';

import type { FfmpegBinaries } from '../ffmpegBinary/ffmpegBinary';

import { verifyComponent } from './verifyComponent';

/** The staged pair, as `incoming/` holds it while the check runs. */
const PAIR: FfmpegBinaries = {
  ffmpeg: '/slot/incoming/ffmpeg',
  ffprobe: '/slot/incoming/ffprobe',
};

/** What a working build prints first, and keeps printing for pages after. */
const FFMPEG_BANNER =
  'ffmpeg version 7.1 Copyright (c) 2000-2024 the FFmpeg developers\nbuilt with gcc 14';
const FFPROBE_BANNER =
  'ffprobe version 7.1 Copyright (c) 2007-2024 the FFmpeg developers\nbuilt with gcc 14';

type Answer = { code: number; stdout: string } | null;

/** A run that answers per binary, and `null` for anything it was not told about. */
function runs(answers: Partial<Record<string, Answer>>) {
  return (binary: string): Answer => answers[binary] ?? null;
}

/** Both halves answering the way a working build does. */
const workingRun = runs({
  [PAIR.ffmpeg]: { code: 0, stdout: FFMPEG_BANNER },
  [PAIR.ffprobe]: { code: 0, stdout: FFPROBE_BANNER },
});

describe('verifyComponent — a working pair', () => {
  it('accepts two binaries that exit 0 and open with their own word', () => {
    expect(verifyComponent(PAIR, workingRun)).toBe(true);
  });

  it('reads both halves, not just the first', () => {
    // The pair is the unit: an ffmpeg with no prober beside it can convert but
    // never answer how long a film is, which is half a component and not a
    // working one.
    const asked: string[] = [];

    verifyComponent(PAIR, (binary) => {
      asked.push(binary);
      return workingRun(binary);
    });

    expect(asked).toHaveLength(2);
    expect(asked).toContain(PAIR.ffmpeg);
    expect(asked).toContain(PAIR.ffprobe);
  });
});

describe('verifyComponent — a pair that does not run', () => {
  it('refuses a non-zero exit from ffmpeg', () => {
    expect(
      verifyComponent(
        PAIR,
        runs({
          [PAIR.ffmpeg]: { code: 1, stdout: '' },
          [PAIR.ffprobe]: { code: 0, stdout: FFPROBE_BANNER },
        })
      )
    ).toBe(false);
  });

  it('refuses a non-zero exit from ffprobe', () => {
    expect(
      verifyComponent(
        PAIR,
        runs({
          [PAIR.ffmpeg]: { code: 0, stdout: FFMPEG_BANNER },
          [PAIR.ffprobe]: { code: 127, stdout: '' },
        })
      )
    ).toBe(false);
  });

  it('refuses a text file renamed after a binary', () => {
    // Exits 0 through the shell that read it, and says nothing about ffmpeg.
    expect(
      verifyComponent(
        PAIR,
        runs({
          [PAIR.ffmpeg]: { code: 0, stdout: 'these are my notes about codecs' },
          [PAIR.ffprobe]: { code: 0, stdout: FFPROBE_BANNER },
        })
      )
    ).toBe(false);
  });

  it('refuses output that mentions the word without opening on it', () => {
    // The banner is the first thing a build prints. A wrapper script that
    // echoes something of its own first is not the build.
    expect(
      verifyComponent(
        PAIR,
        runs({
          [PAIR.ffmpeg]: {
            code: 0,
            stdout: `starting up…\n${FFMPEG_BANNER}`,
          },
          [PAIR.ffprobe]: { code: 0, stdout: FFPROBE_BANNER },
        })
      )
    ).toBe(false);
  });

  it('refuses a binary that will not start at all', () => {
    // A macOS build on a Windows machine, a `.dll`, a file with no execute
    // bit: the run answers `null` and the sentence the family reads is the
    // same one.
    expect(
      verifyComponent(
        PAIR,
        runs({ [PAIR.ffprobe]: { code: 0, stdout: FFPROBE_BANNER } })
      )
    ).toBe(false);

    expect(
      verifyComponent(
        PAIR,
        runs({ [PAIR.ffmpeg]: { code: 0, stdout: FFMPEG_BANNER } })
      )
    ).toBe(false);
  });

  it('refuses a pair whose halves are each other', () => {
    // Two copies of ffmpeg under two names is a pair that probes nothing. Each
    // half is asked for its own word, so the swap is caught rather than
    // installed.
    expect(
      verifyComponent(
        PAIR,
        runs({
          [PAIR.ffmpeg]: { code: 0, stdout: FFPROBE_BANNER },
          [PAIR.ffprobe]: { code: 0, stdout: FFMPEG_BANNER },
        })
      )
    ).toBe(false);
  });
});
