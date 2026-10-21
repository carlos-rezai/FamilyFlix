import { dirname, relative } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { showFolderOf } from '../groupShows/groupShows';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';

/**
 * The **Show folder** a found episode video says, by `groupShows`' own
 * `showFolderOf` — its folder, or the folder above a Season folder — placed
 * under its listed **Library folder**: the folder's id and the show's path
 * relative to it, or `null` when the show lies under none. Read in both modes.
 */
export function placeShowFolder(
  folders: readonly StoredLibraryFolder[],
  video: string
): { folderId: string; sourceFolder: string } | null {
  const show = showFolderOf(dirname(video));
  const listed = listedFolderOf(folders, show);
  return listed === null
    ? null
    : { folderId: listed.id, sourceFolder: relative(listed.path, show) };
}
