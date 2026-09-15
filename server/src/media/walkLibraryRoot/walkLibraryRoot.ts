import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { isVideoFilename } from '../fileKinds/fileKinds';
import {
  scanMovieFolder,
  type MovieFolderScan,
} from '../scanMovieFolder/scanMovieFolder';

/**
 * Walk a **Library root** for its **Source folders**, in the order they are
 * found: a folder holding a video file is a Source folder and is not descended
 * — an `Extras/` inside a film's own folder is not a second film on the shelf
 * — and one holding none is descended, so `Drama/Amelie (2001)` is reached
 * through `Drama/`.
 *
 * The root itself is a shelf, never a film: it is always descended, so a
 * video lying loose beside the folders is not the whole library.
 *
 * What a video file is, is the scanner's fixed extension list, asked here only
 * to decide whether to descend; the folder's full scan is the scanner's.
 * `onFound` is told of each Source folder as it is found, which is what lets
 * a run count "Found N movies so far" while the walk is still going.
 *
 * A folder under the root that cannot be read — permissions, most often — is
 * told to `onUnreadable` and skipped, so one locked directory never ends the
 * walk. The root itself is not skipped: a root that cannot be read is the
 * caller's to refuse.
 */
export async function walkLibraryRoot(
  root: string,
  onFound: (scan: MovieFolderScan) => void = () => undefined,
  onUnreadable: (dir: string) => void = () => undefined
): Promise<MovieFolderScan[]> {
  const scans: MovieFolderScan[] = [];

  const descend = async (dir: string): Promise<void> => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        await visit(join(dir, entry.name));
      }
    }
  };

  const visit = async (dir: string): Promise<void> => {
    let entries: Dirent[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      onUnreadable(dir);
      return;
    }
    const holdsVideo = entries.some(
      (entry) => entry.isFile() && isVideoFilename(entry.name)
    );

    if (holdsVideo) {
      const scan = await scanMovieFolder(dir);
      scans.push(scan);
      onFound(scan);
      return;
    }
    await descend(dir);
  };

  await descend(root);
  return scans;
}
