import type { LeftOutVideo, StoredLibraryFolder } from '../../library';
import { placeFoundVideo } from '../placeFoundVideo/placeFoundVideo';

/**
 * The **Left-out video** entries a hand add's found videos would have: each
 * one under a listed Library folder, spelled as its Link placement. A picked
 * row's bytes (`undefined`) and a path under no listed folder have none.
 */
export function leftOutEntries(
  folders: StoredLibraryFolder[],
  paths: readonly (string | undefined)[]
): LeftOutVideo[] {
  return paths.flatMap((path) => {
    const placed =
      path === undefined ? null : placeFoundVideo(folders, path, 'link');
    return placed === null || placed.videoFolderId === null
      ? []
      : [{ folderId: placed.videoFolderId, videoPath: placed.videoPath }];
  });
}
