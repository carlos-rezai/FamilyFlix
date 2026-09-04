import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';

/**
 * A **Playback component** on disk, for the two suites that ask where one is
 * and what it can do.
 *
 * `ffmpegBinary.test.ts` and `capabilities.test.ts` carried this verbatim: the
 * same `EXE` constant with the same comment on it, the same tracked array and
 * `afterEach`, the same factory, and the same `ffmpegIn` / `ffprobeIn`. They
 * differed in the `mkdtemp` prefix and one word of a docblock — which is the
 * measurement `server/src/test-support/` exists for. It is a test double's
 * neighbour rather than backend logic, and nothing that ships imports it.
 *
 * The `afterEach` below is registered at module scope, which under Vitest's
 * default isolation means **once per importing test file** — each file gets its
 * own module registry, so each gets its own `sandboxes` array and its own
 * teardown. That is `freshStorage`'s recorded finding, and it is what lets the
 * cleanup move here rather than staying at the call site.
 */

/** What an executable is called here — the one difference Windows makes. */
export const EXE = process.platform === 'win32' ? '.exe' : '';

const sandboxes: string[] = [];

afterEach(() => {
  for (const root of sandboxes.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * A directory holding the named binaries, and nothing else. They are empty and
 * never run: what is being asked is which files a resolver finds, not what they
 * would print — which is what an injected listing is for.
 */
export function componentDir(names: string[] = ['ffmpeg', 'ffprobe']): string {
  const dir = mkdtempSync(join(tmpdir(), 'familyflix-component-'));
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
export const ffmpegIn = (dir: string) => join(dir, `ffmpeg${EXE}`);

/** Its neighbour, which is where the resolver looks for the prober. */
export const ffprobeIn = (dir: string) => join(dir, `ffprobe${EXE}`);
