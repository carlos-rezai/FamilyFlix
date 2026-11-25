import { basename } from 'node:path';

import type { LibraryStorage } from '../../library';
import type { Media } from '../../media/createMedia/createMedia';

/** The title a **Late reserve** gives a **Media folder** to. */
export interface ReservedTitle {
  id: string;
  title: string;
  year: number | null;
}

/**
 * A title's **Media folder** as a lazy, memoised getter: the **Late reserve**.
 *
 * Asked, it answers the recorded folder when `media.openFolder` opens it;
 * otherwise it reserves one by title and year through `Media.reserveFolder`,
 * records the new name on the title, and answers that. It reserves at most
 * once and nothing until it is first asked, so a pass that stores no image
 * makes no folder. It throws whatever `reserveFolder` throws.
 */
export function lateReserve(
  {
    storage,
    media,
  }: {
    storage: Pick<LibraryStorage, 'mediaFolderOf' | 'recordMediaFolder'>;
    media: Media;
  },
  kind: 'movie' | 'series',
  { id, title, year }: ReservedTitle
): () => string {
  let answered: string | undefined;
  function settle(): string {
    const recorded = storage.mediaFolderOf(kind, id);
    if (recorded !== null && media.openFolder(recorded) !== null) {
      return recorded;
    }
    const reserved = basename(media.reserveFolder(title, year));
    storage.recordMediaFolder(kind, id, reserved);
    return reserved;
  }
  return () => (answered ??= settle());
}
