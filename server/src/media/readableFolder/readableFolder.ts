import { statSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

/**
 * What {@link readableFolder} found at a path: an existing directory, a path
 * that is something else, a path nothing is at, or one that is not absolute
 * and so was never looked at.
 */
export type FolderReading =
  | 'readable'
  | 'not-a-folder'
  | 'missing'
  | 'relative';

/**
 * Is this absolute path an existing directory the app can read? Answered as a
 * value, never a throw, so each caller words the answer its own way: the
 * folder add, the importer's root check, the per-folder `reachable` read, and
 * the Sync's write check and summary.
 */
export async function readableFolder(path: string): Promise<FolderReading> {
  if (!isAbsolute(path)) {
    return 'relative';
  }
  try {
    return (await stat(path)).isDirectory() ? 'readable' : 'not-a-folder';
  } catch {
    return 'missing';
  }
}

/**
 * {@link readableFolder}'s twin for a caller that cannot wait — Playback's
 * `videoFile`, which reads a Linked video's reach on every call so a folder
 * that comes back plays again with nothing cached. Same answers, same rules.
 */
export function readableFolderSync(path: string): FolderReading {
  if (!isAbsolute(path)) {
    return 'relative';
  }
  try {
    return statSync(path).isDirectory() ? 'readable' : 'not-a-folder';
  } catch {
    return 'missing';
  }
}
