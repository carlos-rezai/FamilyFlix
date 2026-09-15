import type { Media } from '../../media/createMedia/createMedia';
import {
  isImageFilename,
  isSubtitleFilename,
} from '../../media/fileKinds/fileKinds';
import { onlyField } from '../onlyField/onlyField';
import {
  INVALID_RATING,
  optionalRating,
} from '../optionalRating/optionalRating';
import { optionalText } from '../optionalText/optionalText';
import { optionalYear } from '../optionalYear/optionalYear';
import type { OnFilePart } from '../readBody/readBody';

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
    if (name === 'poster' && !isImageFilename(filename)) {
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

/**
 * The fields of a **Movie form** body, coerced into the shapes the two writes
 * take — the add spreading the optional ones away and the edit sending `null`
 * in their place, which is the one thing they still disagree about after this.
 *
 * `synopsis` rather than `description`: the part is named after the caption the
 * maintainer typed under, and the row after what the detail page reads, and
 * this is the one place the two names are translated.
 */
export interface MovieFormValues {
  /** Never `''` — an untitled body is a refusal, not a record. */
  title: string;
  year?: number;
  director?: string;
  synopsis?: string;
  rating?: number;

  /**
   * The **Cast**, in billing order, one `cast` part per name. The form resolved
   * its typed line into these before sending them, which is why no comma rule
   * exists here.
   */
  cast: string[];

  /**
   * The genres, one `genre` part per chip, in the order they were picked and
   * staying in it: `genres[0]` is the primary tag. Every name is already known
   * to the **Genre pool** — an unknown one is a refusal.
   */
  genres: string[];

  /**
   * One `subtitleLanguage` field per track, in the order the rows are on
   * screen. The caller pairs them with paths, because what a path *is* differs
   * between the two saves and a language does not.
   */
  languages: string[];
}

/**
 * What the caller sends when a body cannot be turned into a record: a status
 * and the sentence that goes with it.
 *
 * A status and a message rather than a response, deliberately. A parser that
 * wrote to `res` could not be tested without a listener, and the status codes
 * would stop being visible in the handler where a reader looks for them.
 */
export interface Refusal {
  status: number;
  error: string;
}

/** Either the record a body describes, or the refusal it earns. */
export type MovieFormRead =
  | ({ ok: true } & MovieFormValues)
  | ({ ok: false } & Refusal);

/**
 * Read the fields of a **Movie form** body, having already read its parts.
 *
 * The whole of what the add and the edit agree about, in the order they agreed
 * about it — and the order is load-bearing. **A missing title is refused before
 * a rejected file**, so a body that is wrong in two ways gets the same sentence
 * whichever save it was sent to.
 *
 * `uploads` is here for the two rejections, which are decided while the parts
 * are still arriving and carried out only once the whole body has been read:
 * the video part is appended before the poster, so a refusal over a poster
 * always runs against bytes that are already on disk. That is what the caller's
 * rollback is for.
 *
 * `pool` is the **Genre pool**, as a set of the names it holds. Unreachable
 * from the form, which can only send back names the pool handed it, and checked
 * for the same reason the missing title is: this is the layer that forwards a
 * client-supplied list into a transactional write, and the write answers an
 * unknown name by throwing. Checked here rather than caught around the write,
 * so the refusal is a sentence rather than an exception, and so nothing is
 * attempted at all.
 */
export function readMovieFields(
  fields: Record<string, string[]>,
  uploads: Uploads,
  pool: ReadonlySet<string>
): MovieFormRead {
  const refuse = (error: string): MovieFormRead => ({
    ok: false,
    status: 400,
    error,
  });

  const title = onlyField(fields, 'title')?.trim() ?? '';
  if (title === '') {
    // `title` is `NOT NULL` and `''` satisfies that column, which would make a
    // corrupt row the cost of a client these routes did not write. The form's
    // own **Save gate** makes this unreachable from the app.
    return refuse('Body must carry a title');
  }

  if (uploads.rejectedPoster !== undefined) {
    return refuse(
      `Not a poster image: ${JSON.stringify(uploads.rejectedPoster)}`
    );
  }

  if (uploads.rejectedSubtitle !== undefined) {
    return refuse(
      `Not a subtitle file: ${JSON.stringify(uploads.rejectedSubtitle)}`
    );
  }

  // The one field on this wire that is neither text nor a list, and the one the
  // form has already converted: it sends the units the column stores, not the
  // percent its picker speaks. What is left to decide here is only what an
  // absent, an empty and an off-scale one mean.
  const postedRating = onlyField(fields, 'rating');
  const rating = optionalRating(postedRating);
  if (rating === INVALID_RATING) {
    return refuse(`Invalid rating: ${JSON.stringify(postedRating)}`);
  }

  const genres = fields.genre ?? [];
  const unknown = genres.find((name) => !pool.has(name));
  if (unknown !== undefined) {
    return refuse(`Unknown genre: ${unknown}`);
  }

  return {
    ok: true,
    title,
    year: optionalYear(onlyField(fields, 'year')),
    director: optionalText(onlyField(fields, 'director')),
    synopsis: optionalText(onlyField(fields, 'description')),
    rating,
    cast: fields.cast ?? [],
    genres,
    languages: fields.subtitleLanguage ?? [],
  };
}

/**
 * The language a track arrives with — the one the client sent for it, or
 * English for a track sent with none.
 *
 * Unreachable from the form, which sends a language with every row. It is here
 * because `subtitles.language` is `NOT NULL`, and a client these routes did not
 * write must not be able to make the column the reason a save fails — the
 * default is the same one the row lands in on screen.
 */
export const DEFAULT_SUBTITLE_LANGUAGE = 'English';

/**
 * One subtitle row of a **Movie form** body, as the pairing answers it: the
 * row's language and the one way its file arrived — `stored`, the **Stored
 * path** of the part this request wrote, or `path`, the `subtitlePath` field
 * exactly as it came.
 *
 * Both columns are answered and neither is interpreted, because what a path
 * *is* differs between the saves: the edit reads it as a **Stored path** the
 * library already holds, the resolve as a **Found file** under the **Current
 * run**'s root. The pairing does not know which and should not.
 */
export type SubtitleRow =
  | { language: string; stored: string }
  | { language: string; path: string };

/**
 * The tracks of a **Movie form** body, read pairwise off two fields with the
 * parts threaded through them: the i-th language belongs to the i-th
 * `subtitlePath`, and an **empty path** is a row whose file arrived as bytes
 * instead — the next `subtitle` part, in arrival order. Fields and file parts
 * are read back separately, so that placeholder is the only thing keeping a
 * mixed list in the order it was in on screen.
 *
 * A row that named no path and sent no bytes is not a track, and is left out.
 */
export function subtitleRows(
  fields: Record<string, string[]>,
  uploads: Uploads,
  languages: string[]
): SubtitleRow[] {
  const paths = fields.subtitlePath ?? [];
  const picked = uploads.subtitles.filter(
    (stored): stored is string => stored !== undefined
  );

  const rows: SubtitleRow[] = [];
  const count = Math.max(languages.length, paths.length, picked.length);
  for (let row = 0; row < count; row += 1) {
    const language = languages[row] ?? DEFAULT_SUBTITLE_LANGUAGE;
    const path = paths[row];
    if (path !== undefined && path !== '') {
      rows.push({ language, path });
      continue;
    }
    const stored = picked.shift();
    if (stored !== undefined) {
      rows.push({ language, stored });
    }
  }
  return rows;
}
