import type { Media } from '../../media/createMedia/createMedia';

/** A title's found **Poster** and **Backdrop**, absolute, `null` for none. */
export interface FoundArt {
  poster: string | null;
  backdrop: string | null;
}

/** A title's found art once copied: each file's **Stored path**, or `null`. */
export interface CopiedArt {
  poster: string | null;
  backdrop: string | null;
}

/**
 * A title's found **Poster** and **Backdrop** copied with `Media.copyIn` into
 * the **Media folder** `folder`'s root, copied, never moved, so the picked
 * folder is left as it was. Rejects on the first copy that breaks; the caller
 * takes the folder back.
 */
export async function copyFoundArt(
  media: Media,
  folder: string,
  art: FoundArt
): Promise<CopiedArt> {
  const copy = (path: string | null): Promise<string | null> =>
    path === null ? Promise.resolve(null) : media.copyIn(folder, path);
  const poster = await copy(art.poster);
  const backdrop = await copy(art.backdrop);
  return { poster, backdrop };
}
