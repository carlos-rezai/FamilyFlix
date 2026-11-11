import type { LibraryStorage } from '../../library';
import type { StoredVideo } from '@/types';

/**
 * The **Held video** rule's `409` sentence for an add: given its placed
 * videos, _<Title> already plays this file._ naming the holder of the first
 * one a held title plays, film or series, or `null` when none is held. A
 * copied video (`null`) and a stored one (no Library folder) are never held.
 * Both adds call it before anything is written.
 */
export function heldVideoRefusal(
  storage: Pick<LibraryStorage, 'titleHolding' | 'getMovie' | 'getSeries'>,
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
