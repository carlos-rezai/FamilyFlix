import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach } from 'vitest';

/**
 * A temporary directory a test may write into, removed when the test ends.
 *
 * **The ruling this re-takes.** #81 declined a shared helper because three
 * copies had three ownership models. At eight `mkdtemp` call sites the count
 * came out differently: five carried one shape —
 * `realpathSync(mkdtempSync(join(tmpdir(), prefix)))`, pushed onto a tracked
 * array, `rmSync`d in an `afterEach` — and three carry another. This is the
 * five. The other three (`db`, `write`, `genre`) mint database *file paths*
 * inside a lazily-created directory, and their teardown is entangled with
 * closing the connections holding those files open on Windows; they are a
 * different thing and stay where they are.
 *
 * **Why `realpathSync`.** A temporary directory is a symlink on macOS and an
 * 8.3 short name on Windows, so a path the code under test resolved would
 * otherwise disagree with the one the test built by hand — which is the whole
 * question `mediaFilePath` is about.
 *
 * The `afterEach` is registered at module scope, which under Vitest's default
 * isolation means once per importing test file. Vitest runs `afterEach` hooks
 * in reverse registration order, so an importing file's own hook runs *before*
 * this one — which is what lets a file close its databases first and still have
 * the directory holding them swept afterwards.
 *
 * The prefix is the caller's so a leaked directory still names the suite that
 * made it.
 */
export function sandboxRoot(prefix: string): string {
  const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
  roots.push(root);
  return root;
}

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});
