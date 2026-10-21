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

/** Why a Link add is refused: a found video lies under no listed folder. */
export const LINK_REFUSAL =
  'Link needs a file inside one of your library folders.';

/** What {@link placeFoundVideos} came to. */
export type PlacedVideos =
  | { kind: 'placed'; placed: (StoredVideo | null)[] }
  | { kind: 'refused'; error: string };

/**
 * The **Placed video** rule over a list, as an add places its videos: each
 * found path placed by {@link placeFoundVideo}, an `undefined` one — a picked
 * row's bytes — as `null`. In **Link**, a found path under no listed folder
 * refuses the whole list with {@link LINK_REFUSAL}.
 */
export function placeFoundVideos(
  folders: StoredLibraryFolder[],
  paths: readonly (string | undefined)[],
  mode: ImportMode
): PlacedVideos {
  const placed = paths.map((path) =>
    path === undefined ? null : placeFoundVideo(folders, path, mode)
  );
  const unlisted = paths.some(
    (path, index) => path !== undefined && placed[index] === null
  );
  return mode === 'link' && unlisted
    ? { kind: 'refused', error: LINK_REFUSAL }
    : { kind: 'placed', placed };
}
