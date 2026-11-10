import type { HeldTitle } from '../../library';
import type { Movie, Series, StoredVideo } from '@/types';

/** What the **Held video** rule reads of the library. */
export interface HoldingStorage {
  titleHolding(folderId: string, videoPath: string): HeldTitle | null;
  getMovie(id: string): Movie | null;
  getSeries(id: string): Series | null;
}

/**
 * The **Held video** rule's `409` sentence for an add: given its placed
 * videos, _<Title> already plays this file._ naming the holder of the first
 * one a held title plays, film or series, or `null` when none is held. A
 * copied video (`null`) and a stored one (no Library folder) are never held.
 * Both adds call it before anything is written.
 */
export function heldVideoRefusal(
  storage: HoldingStorage,
  placed: readonly (StoredVideo | null)[]
): string | null {
  for (const video of placed) {
    if (video?.videoFolderId == null) {
      continue;
    }
    const held = storage.titleHolding(video.videoFolderId, video.videoPath);
    if (held === null) {
      continue;
    }
    const holder =
      held.kind === 'movie'
        ? storage.getMovie(held.id)
        : storage.getSeries(held.id);
    return `${holder?.title ?? 'A title'} already plays this file.`;
  }
  return null;
}
