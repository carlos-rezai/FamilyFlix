import { chmodSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { EXE } from '../../playback/ffmpegBinary/ffmpegBinary';
import { sandboxRoot } from '../sandboxRoot/sandboxRoot';

/**
 * A **Playback component** on disk, for the two suites that ask where one is
 * and what it can do.
 *
 * `ffmpegBinary.test.ts` and `capabilities.test.ts` carried this verbatim: the
 * same tracked array and `afterEach`, the same factory, and the same
 * `ffmpegIn` / `ffprobeIn`. They
 * differed in the `mkdtemp` prefix and one word of a docblock — which is the
 * measurement `server/src/test-support/` exists for. It is a test double's
 * neighbour rather than backend logic, and nothing that ships imports it.
 *
 * The directory itself is `sandboxRoot`'s, so the sweep is written down once
 * for every suite that needs a temporary tree rather than once per fixture.
 */

/**
 * What an executable is called here, re-exported from the resolver that owns
 * it: what a platform calls a binary is one answer, which is what
 * `ffmpegBinary`'s `EXE` and the **Component slot**'s `pairIn` already claim.
 * A fixture writing files the resolver would not look for is the one way this
 * helper could lie.
 */
export { EXE };

/**
 * A directory holding the named binaries, and nothing else. They are empty and
 * never run: what is being asked is which files a resolver finds, not what they
 * would print — which is what an injected listing is for.
 */
export function componentDir(names: string[] = ['ffmpeg', 'ffprobe']): string {
  const dir = sandboxRoot('familyflix-component-');

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
