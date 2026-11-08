import { basename, dirname, relative, sep } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { folderKeyOf } from '../../media/folderKeyOf/folderKeyOf';
import { seasonNumberOf } from '../../media/readTitleFolder/readTitleFolder';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';

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
  const show = dirname(season);
  const listed = listedFolderOf(folders, show);
  if (listed === null) {
    return null;
  }
  const sourceFolder = relative(listed.path, show);
  if (sourceFolder.includes(sep) || folderKeyOf(sourceFolder) === null) {
    return null;
  }
  return {
    folderId: listed.id,
    sourceFolder,
    sourceFile: `${basename(season)}/${basename(video)}`,
  };
}
