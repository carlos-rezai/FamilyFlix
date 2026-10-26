import type { LibraryStorage } from '../../library';
import {
  folderOverlap,
  type FolderClash,
} from '../../library/folders/folderOverlap/folderOverlap';
import { readableFolder } from '../../media/readableFolder/readableFolder';
import type { LibraryFolder } from '@/types';

/**
 * Why a typed path was not added: nothing typed, not absolute, no folder, or
 * a folder that overlaps the **Managed media directory**.
 */
export type FolderRefusal = 'empty' | 'relative' | 'missing' | 'media';

/** What {@link admitFolder} came to — the route words each kind its own way. */
export type FolderAdmission =
  | { kind: 'added'; folder: LibraryFolder }
  | { kind: 'refused'; refusal: FolderRefusal }
  | { kind: 'clash'; clash: FolderClash };

/**
 * Add a typed path to the **Library folders**, by the add's rules in order:
 * something typed, an absolute path, a readable directory, and no overlap
 * with a folder already listed, and no overlap with the **Managed media
 * directory** (the **Media directory refusal**). Answers a value and never throws — two adds
 * racing past the overlap check meet the schema's unique path, and the one
 * that loses is answered as the `same` clash it is.
 *
 * The folder answered is `reachable`: it has just been read.
 */
export async function admitFolder(
  storage: LibraryStorage,
  path: string,
  mediaPath: string
): Promise<FolderAdmission> {
  if (path.trim() === '') {
    return { kind: 'refused', refusal: 'empty' };
  }
  const reading = await readableFolder(path);
  if (reading === 'relative') {
    return { kind: 'refused', refusal: 'relative' };
  }
  if (reading !== 'readable') {
    return { kind: 'refused', refusal: 'missing' };
  }
  const clash = folderOverlap(
    path,
    storage.libraryFolders().map((folder) => folder.path)
  );
  if (clash !== null) {
    return { kind: 'clash', clash };
  }
  if (folderOverlap(path, [mediaPath]) !== null) {
    return { kind: 'refused', refusal: 'media' };
  }
  try {
    const added = storage.addLibraryFolder(path);
    return { kind: 'added', folder: { ...added, reachable: true } };
  } catch {
    return { kind: 'clash', clash: { overlap: 'same', folder: path } };
  }
}
