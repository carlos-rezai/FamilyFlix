import type { Media } from '../../media/createMedia/createMedia';
import type { OnFilePart } from '../readBody/readBody';
import {
  isPosterFilename,
  isSubtitleFilename,
} from '../uploadKinds/uploadKinds';

/**
 * Where the bytes of this request go — the **Movie folder** the two saves
 * disagree about, and the only thing about a file part they disagree about at
 * all.
 *
 * An add reserves one from whatever the body has said so far; an edit opens the
 * movie's own and only reserves when there is no film behind the row to name
 * one. Both are answered the moment there are bytes that need somewhere to go,
 * which is why `before` is handed over: `busboy` will not reach the fields
 * after a file until that file has been consumed, so the title a folder might
 * be named from is only knowable if it had already arrived.
 */
export type ResolveFolder = (before: Record<string, string[]>) => string;

/**
 * What one request put on disk, filled in as its parts arrive.
 *
 * A record rather than a return value because a file part is an event: the
 * caller hands {@link collectUploads}' `onFile` to `readBody` and reads this
 * afterwards, and everything in it is `undefined` until the part that fills it
 * turns up.
 */
export interface Uploads {
  /** The folder this request wrote into, or `null` if it wrote nothing. */
  folder: string | null;

  /** The **Stored path** of the film this request wrote, if it wrote one. */
  video?: string;

  /** The **Stored path** of the poster this request wrote, if it wrote one. */
  poster?: string;

  /**
   * The tracks this request wrote, in the order their **parts arrived** —
   * which is the order they are stored in, because `position` is what
   * `preferredSubtitle` falls back through.
   *
   * The slot is taken when the part arrives and filled when its bytes land,
   * rather than appended once the write resolves: two writes can be in flight
   * at once, and the one that finishes first is not necessarily the one that
   * started first — which would swap two tracks' positions on the family's
   * player, intermittently and with nothing on screen to say why.
   *
   * A slot still `undefined` once the body has been read is no track.
   */
  subtitles: (string | undefined)[];

  /** The name of a poster part this route will not store, if one arrived. */
  rejectedPoster?: string;

  /** The name of a subtitle part this route will not store, if one arrived. */
  rejectedSubtitle?: string;
}

/**
 * The file half of a **Movie form** body, which the add and the edit read
 * identically.
 *
 * Both dispatch three ways, both drain a part they do not know about rather
 * than refusing over it, both re-check what a poster and a subtitle may be
 * called, and both take a subtitle's slot at arrival. The one thing they
 * disagree about arrives as {@link ResolveFolder}.
 *
 * **A rejected part is remembered, not thrown over.** Its bytes are drained so
 * the parser can reach `close`, and the refusal is carried out by the caller on
 * the whole body — which is what lets a save that is going to be refused still
 * roll back the bytes that landed before the refusal was knowable.
 */
export function collectUploads(
  media: Media,
  resolveFolder: ResolveFolder
): { onFile: OnFilePart; uploads: Uploads } {
  const uploads: Uploads = { folder: null, subtitles: [] };

  const onFile: OnFilePart = async (name, filename, part, before) => {
    // Every other part is drained rather than stored: a part these routes do
    // not know about is not a reason to refuse the save.
    if (name !== 'video' && name !== 'poster' && name !== 'subtitle') {
      part.resume();
      return;
    }

    // A poster this route will not serve is not written at all — its bytes are
    // drained so the parser can reach `close`, and the refusal is carried out
    // on the whole body.
    if (name === 'poster' && !isPosterFilename(filename)) {
      part.resume();
      uploads.rejectedPoster = filename;
      return;
    }

    // The same rule at the third slot, for the same reason.
    if (name === 'subtitle' && !isSubtitleFilename(filename)) {
      part.resume();
      uploads.rejectedSubtitle = filename;
      return;
    }

    uploads.folder ??= resolveFolder(before);

    // The slot is taken here, before the write is awaited: this is the one part
    // that arrives any number of times, and the order it arrives in is the
    // track order the movie is stored with.
    const slot =
      name === 'subtitle' ? uploads.subtitles.push(undefined) - 1 : -1;
    const stored = await media.storeUpload(uploads.folder, filename, part);

    if (name === 'video') {
      uploads.video = stored;
    } else if (name === 'poster') {
      uploads.poster = stored;
    } else {
      uploads.subtitles[slot] = stored;
    }
  };

  return { onFile, uploads };
}
