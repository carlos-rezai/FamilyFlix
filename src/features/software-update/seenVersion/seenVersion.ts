/**
 * Where the **Seen version** is kept. A contract with machines already in the
 * house: renaming it would congratulate every one of them again.
 */
const KEY = 'familyflix.seenVersion';

/**
 * The **App version** this machine last ran, or `null` on a fresh install.
 * A storage that throws reads as absent — the launch goes on.
 */
export function readSeenVersion(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Remember the version this machine is running; a refused write is swallowed. */
export function writeSeenVersion(version: string): void {
  try {
    localStorage.setItem(KEY, version);
  } catch {
    // Nothing to do — at worst the congratulation is said again next launch.
  }
}
