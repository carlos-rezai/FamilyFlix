import type { StoredLibraryFolder } from '../../library';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';
import { sourceFolderOf } from '../sourceFolderOf/sourceFolderOf';

/** A **Title folder** placed in its listed **Library folder**. */
export interface PlacedTitleFolder {
  /** The listed **Library folder** holding it. */
  folderId: string;
  /** The Title folder, its **Folder key**: its path under the Library folder. */
  sourceFolder: string;
}

/**
 * Where a folder lies as a **Title folder** (log 58 Q22): directly in a listed
 * **Library folder**, whatever its name, its **Source folder** that name.
 * `null` for a folder deeper than the root, a folder under no listed folder,
 * or a listed folder itself.
 */
export function placeTitleFolder(
  folders: readonly StoredLibraryFolder[],
  dir: string
): PlacedTitleFolder | null {
  const listed = listedFolderOf(folders, dir);
  if (listed === null) {
    return null;
  }
  // Strictly inside, so never empty and never climbing: one segment is the
  // root's own child.
  const sourceFolder = sourceFolderOf(listed.path, dir);
  return sourceFolder.includes('/')
    ? null
    : { folderId: listed.id, sourceFolder };
}
