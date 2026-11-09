import { basename, dirname } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { seasonNumberOf } from '../../media/seasonNumberOf/seasonNumberOf';
import { placeTitleFolder } from '../placeTitleFolder/placeTitleFolder';

/** Where a found episode lies in the **Folder layout**. */
export interface PlacedShowFolder {
  /** The listed **Library folder** holding the series. */
  folderId: string;
  /** The series' **Title folder**, its **Folder key**. */
  sourceFolder: string;
  /** The episode's **Source file**: `Season NN/<video>`, forward slashes. */
  sourceFile: string;
}

/**
 * Where a found episode video lies in the **Folder layout**: its series'
 * **Title folder**, the parent of the `Season NN` folder holding it, lying
 * directly in a listed **Library folder** and named by a **Folder key**, and
 * the episode's **Source file**, its path inside the Title folder. A video in
 * no Season folder, a loose tagged one at a show's root included, a Title
 * folder deeper than the root or under no listed folder answers `null`. Read
 * in both modes.
 */
export function placeShowFolder(
  folders: readonly StoredLibraryFolder[],
  video: string
): PlacedShowFolder | null {
  const season = dirname(video);
  if (seasonNumberOf(basename(season)) === null) {
    return null;
  }
  const placed = placeTitleFolder(folders, dirname(season));
  if (placed === null) {
    return null;
  }
  return {
    ...placed,
    sourceFile: `${basename(season)}/${basename(video)}`,
  };
}
