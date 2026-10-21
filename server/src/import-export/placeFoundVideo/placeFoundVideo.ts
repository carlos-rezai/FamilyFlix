import { basename, dirname, isAbsolute, relative } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { seasonOf } from '../groupShows/groupShows';
import { spellLinkedVideo } from '../../playback/linkedVideoPath/linkedVideoPath';
import type { ImportMode, StoredVideo } from '@/types';

/**
 * Whether `path` lies strictly under `folder` — not the folder itself, not a
 * path climbing out of it through `..`, and not one on another drive.
 */
const isUnder = (folder: string, path: string): boolean => {
  const under = relative(folder, path);
  return under !== '' && !under.startsWith('..') && !isAbsolute(under);
};

/**
 * The listed **Library folder** `path` lies under — of nested ones the
 * deepest — or `null` when it lies under none.
 */
export function listedFolderOf(
  folders: StoredLibraryFolder[],
  path: string
): StoredLibraryFolder | null {
  return folders
    .filter((folder) => isUnder(folder.path, path))
    .reduce<StoredLibraryFolder | null>(
      (deepest, folder) =>
        deepest === null || folder.path.length > deepest.path.length
          ? folder
          : deepest,
      null
    );
}

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
