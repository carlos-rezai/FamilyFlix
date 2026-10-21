import type { StoredLibraryFolder } from '../../library';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';
import { spellLinkedVideo } from '../../playback/linkedVideoPath/linkedVideoPath';
import type { ImportMode, StoredVideo } from '@/types';

/**
 * The **Placed video** rule: a found video in **Link** under a listed
 * **Library folder** → the **Linked video** it records, relative to that
 * folder with forward slashes. `null` in **Copy**, or for a path under no
 * listed folder — the caller copies.
 */
export function placeFoundVideo(
  folders: StoredLibraryFolder[],
  path: string,
  mode: ImportMode
): StoredVideo | null {
  if (mode !== 'link') {
    return null;
  }
  const listed = listedFolderOf(folders, path);
  return listed === null
    ? null
    : {
        videoPath: spellLinkedVideo(listed.path, path),
        videoFolderId: listed.id,
      };
}
