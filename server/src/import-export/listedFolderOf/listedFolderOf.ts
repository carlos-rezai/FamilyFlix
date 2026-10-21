import type { StoredLibraryFolder } from '../../library';
import { folderOverlap } from '../../library/folders/folderOverlap/folderOverlap';

/**
 * The listed **Library folder** `path` lies strictly inside — of nested ones
 * the deepest — or `null` when it lies inside none. "Inside" is
 * `folderOverlap`'s reading, so the folder itself is not inside it.
 */
export function listedFolderOf(
  folders: readonly StoredLibraryFolder[],
  path: string
): StoredLibraryFolder | null {
  return folders
    .filter(
      (folder) => folderOverlap(path, [folder.path])?.overlap === 'inside'
    )
    .reduce<StoredLibraryFolder | null>(
      (deepest, folder) =>
        deepest === null || folder.path.length > deepest.path.length
          ? folder
          : deepest,
      null
    );
}
