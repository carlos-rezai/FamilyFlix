import type { StoredLibraryTitles } from '../../library';

/**
 * Each stored title's **Source folder** by its id: every title recorded
 * against a **Library folder** with a Source folder, only `folderId`'s when
 * one is given and every folder's otherwise. A title with no Source folder,
 * or in no Library folder, is absent.
 */
export function sourceFoldersOf(
  titles: StoredLibraryTitles,
  folderId?: string
): Map<string, string> {
  const sourceFolders = new Map<string, string>();
  for (const title of [...titles.movies, ...titles.series]) {
    if (
      title.libraryFolderId !== null &&
      title.sourceFolder !== null &&
      (folderId === undefined || title.libraryFolderId === folderId)
    ) {
      sourceFolders.set(title.id, title.sourceFolder);
    }
  }
  return sourceFolders;
}
