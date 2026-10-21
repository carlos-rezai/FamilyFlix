import { basename, dirname, relative } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { seasonOf } from '../groupShows/groupShows';
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

/**
 * The **Show folder** a found episode video says, as `groupShows` reads one —
 * its folder, or the folder above a Season folder — placed under its listed
 * **Library folder**: the folder's id and the show's path relative to it, or
 * `null` when the show lies under none. Read in both modes.
 */
export function placeShowFolder(
  folders: StoredLibraryFolder[],
  video: string
): { folderId: string; sourceFolder: string } | null {
  const dir = dirname(video);
  const show = seasonOf(basename(dir)) === null ? dir : dirname(dir);
  const listed = listedFolderOf(folders, show);
  return listed === null
    ? null
    : { folderId: listed.id, sourceFolder: relative(listed.path, show) };
}
