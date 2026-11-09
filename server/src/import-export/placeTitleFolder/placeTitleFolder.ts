import { basename, dirname, relative } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { folderKeyOf } from '../../media/folderKeyOf/folderKeyOf';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';

/** A **Title folder** placed in its listed **Library folder**. */
export interface PlacedTitleFolder {
  /** The listed **Library folder** holding it. */
  folderId: string;
  /** The Title folder, its **Folder key**: its path under the Library folder. */
  sourceFolder: string;
}

/**
 * Where a folder lies as a **Title folder** (log 58 Q22): directly in a listed
 * **Library folder** and named by a **Folder key**, its **Source folder** that
 * name. `null` for a folder deeper than the root, a name that is no Folder
 * key, a folder under no listed folder, or a listed folder itself.
 */
export function placeTitleFolder(
  folders: readonly StoredLibraryFolder[],
  dir: string
): PlacedTitleFolder | null {
  const listed = listedFolderOf(folders, dir);
  if (
    listed === null ||
    relative(listed.path, dirname(dir)) !== '' ||
    folderKeyOf(basename(dir)) === null
  ) {
    return null;
  }
  return { folderId: listed.id, sourceFolder: relative(listed.path, dir) };
}
