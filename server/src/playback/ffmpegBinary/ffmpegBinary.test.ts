// @vitest-environment node
//
// 10 — Video player, Phase 7: "the FFmpeg pipeline" (issue #89).
//
// Where the **Playback component** comes from before an installer exists:
// `FAMILYFLIX_FFMPEG_PATH`, then `PATH`, then **absent** — and absent is a state
// rather than an error, which is the decision the whole slice rests on. A
// machine with no FFmpeg on it still runs the app, still direct-plays its MP4s,
// and still passes this suite. CI is that machine.
//
// Nothing here spawns anything. Resolution is a question about which files are
// on disk, so the fixtures are empty files in a temporary directory and the
// environment arrives as an argument rather than as `process.env` — a resolver
// that read the ambient environment could not be asked about a machine other
// than the one running the test.

import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { ffmpegBinary } from './ffmpegBinary';

/** What an executable is called here — the one difference Windows makes. */
const EXE = process.platform === 'win32' ? '.exe' : '';

const sandboxes: string[] = [];

afterEach(() => {
  for (const root of sandboxes.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * A directory holding the named binaries, and nothing else. They are empty and
 * never run: what is being asked is which files a resolver finds, not what they
 * would print.
 */
function componentDir(names: string[] = ['ffmpeg', 'ffprobe']): string {
  const dir = mkdtempSync(join(tmpdir(), 'familyflix-ffmpeg-'));
  sandboxes.push(dir);

  for (const name of names) {
    const file = join(dir, `${name}${EXE}`);
    writeFileSync(file, '');
    if (process.platform !== 'win32') {
      chmodSync(file, 0o755);
    }
  }

  return dir;
}

/** The path the environment variable would carry: the ffmpeg binary itself. */
const ffmpegIn = (dir: string) => join(dir, `ffmpeg${EXE}`);
const ffprobeIn = (dir: string) => join(dir, `ffprobe${EXE}`);

describe('ffmpegBinary — the variable the installer will fill', () => {
  it('prefers FAMILYFLIX_FFMPEG_PATH over anything on PATH', () => {
    // The first slot is the one a maintainer's uploaded component occupies, so
    // it has to beat a system-wide install rather than lose to it — otherwise
    // replacing the component in Settings would change nothing.
    const chosen = componentDir();
    const ignored = componentDir();

    const component = ffmpegBinary({
      FAMILYFLIX_FFMPEG_PATH: ffmpegIn(chosen),
      PATH: ignored,
    });

    expect(component?.ffmpeg).toBe(ffmpegIn(chosen));
  });

  it('finds ffprobe beside the ffmpeg the variable names', () => {
    // The variable names one binary and the domain needs two. They ship
    // together, so the second is looked for where the first was found rather
    // than asked for separately.
    const dir = componentDir();

    const component = ffmpegBinary({ FAMILYFLIX_FFMPEG_PATH: ffmpegIn(dir) });

    expect(component?.ffprobe).toBe(ffprobeIn(dir));
  });

  it('falls through a variable naming a binary that is not there', () => {
    // A stale variable — an uninstalled component, a moved folder — must not be
    // able to hide a working FFmpeg the machine already has.
    const onPath = componentDir();

    const component = ffmpegBinary({
      FAMILYFLIX_FFMPEG_PATH: join(componentDir([]), `ffmpeg${EXE}`),
      PATH: onPath,
    });

    expect(component?.ffmpeg).toBe(ffmpegIn(onPath));
  });
});

describe('ffmpegBinary — the fallback to PATH', () => {
  it('finds a component installed on the machine when no variable is set', () => {
    const dir = componentDir();

    const component = ffmpegBinary({ PATH: dir });

    expect(component).toEqual({
      ffmpeg: ffmpegIn(dir),
      ffprobe: ffprobeIn(dir),
    });
  });

  it('looks along every entry of PATH, not only the first', () => {
    const empty = componentDir([]);
    const dir = componentDir();

    const component = ffmpegBinary({ PATH: [empty, dir].join(delimiter) });

    expect(component?.ffmpeg).toBe(ffmpegIn(dir));
  });
});

describe('ffmpegBinary — absent, which is a state and not an error', () => {
  it('answers absent when there is no component anywhere', () => {
    // The whole point of Q20: nothing hard-fails on a machine with no FFmpeg.
    // A throw here would take the browse home down with it.
    expect(ffmpegBinary({ PATH: componentDir([]) })).toBeNull();
  });

  it('answers absent rather than throwing when the environment says nothing', () => {
    expect(ffmpegBinary({})).toBeNull();
  });

  it('answers absent for half a component, which can probe or convert but not both', () => {
    // A directory with ffmpeg and no ffprobe cannot answer what a file is, and
    // a path chosen without a probe is a guess. Half is not a component.
    expect(ffmpegBinary({ PATH: componentDir(['ffmpeg']) })).toBeNull();
  });
});
