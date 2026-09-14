import type {
  ImportProblemDetail,
  Movie,
  MovieFormFile,
  MovieFormValues,
} from '@/types';
import { toRatingPercent, toRatingUnits } from '@/utils';

import { castNames, castText } from '../castNames/castNames';

/**
 * How a **Stored path** is separated, everywhere it is stored: the media domain
 * writes them with forward slashes whatever the machine's own separator is, so
 * a basename is what follows the last one.
 */
const SEPARATOR = '/';

/**
 * What the form's own key for a **Stored file**'s row is prefixed with.
 *
 * The persisted subtitle id is what makes it unique, and the prefix is what
 * keeps it clear of the counter `useMovieForm` hands newly picked rows — two
 * rows sharing a key would hand a removed row's language to whatever moved up
 * into its place.
 */
const STORED_KEY = 'stored-';

/**
 * What the form's own key for a **Found file**'s row is prefixed with — the
 * row's place in the folder's list is what makes it unique, and the prefix is
 * what keeps it clear of the counter and of the stored keys beside it.
 */
const FOUND_KEY = 'found-';

/**
 * How a **Found file**'s path may be separated: it is the absolute path the
 * scan found it at, spelled the way the maintainer's own machine spells one,
 * which on Windows is the backslash.
 */
const NATIVE_SEPARATOR = '\\';

/** The name a **Stored path** shows in its slot — a browser gives no path either. */
const filenameOf = (path: string): string =>
  path.slice(path.lastIndexOf(SEPARATOR) + 1);

/** The name a **Found file** shows in its slot, after whichever separator is last. */
const foundFilenameOf = (path: string): string =>
  path.slice(
    Math.max(path.lastIndexOf(SEPARATOR), path.lastIndexOf(NATIVE_SEPARATOR)) +
      1
  );

/**
 * The **File slot** a stored path fills, or `null` for a slot with nothing in
 * it.
 *
 * `''` is an empty slot rather than a file: `video_path` is `NOT NULL`, so a row
 * written with no film behind it carries the empty string, and a slot showing
 * one would offer to send a path that names nothing.
 */
function storedFile(path: string | null): MovieFormFile | null {
  return path === null || path === ''
    ? null
    : { kind: 'stored', path, filename: filenameOf(path) };
}

/**
 * The **File slot** a **Picked file** fills — the other arm of the same union,
 * built beside {@link storedFile} so the two constructors that decide what a
 * slot holds live in one place. The name a browser gives the file is the name
 * the slot shows; there is no path to take one from.
 */
export function pickedFile(file: File): MovieFormFile {
  return { kind: 'picked', file, filename: file.name };
}

/**
 * A stored **Movie**, read back into the box it was typed into.
 *
 * Story 46: editing one field does not mean retyping the rest — and the fields
 * are the strings the form holds rather than the columns the row does, so the
 * year comes back as text and the cast as the one comma-separated line
 * `castText` writes it as.
 *
 * Every **File slot** comes back holding a **Stored file**: the relative path
 * the library already has, and the basename it shows. Nothing here reads a
 * byte, which is the whole point — see {@link movieFormData}.
 */
export function movieFormValues(movie: Movie): MovieFormValues {
  return {
    title: movie.title,
    // The field is text, so a year is text: a half-typed year is `'19'`, and a
    // film with no year at all is an empty box rather than the word "null".
    year: movie.year === null ? '' : String(movie.year),
    director: movie.director ?? '',
    // `description` is the form's word for it; `synopsis` is the column's.
    description: movie.synopsis ?? '',
    // The comma rule read backwards, called from the one folder that owns it.
    cast: castText(movie.cast),
    // In the order the record stores them: `genres[0]` is the primary tag the
    // repository has preserved since #3, and re-sorting them into the pool's
    // order would silently re-file the movie.
    genres: movie.genres.map((genre) => genre.name),
    // The column stores 0–10 units and every star strip in the app fills
    // against 0–100. `null` survives as `null`: "I have not decided" and
    // "nought out of five" are two different claims, and a prefill that
    // flattened one into the other would score every unrated film in the
    // library the moment its title was corrected.
    rating: toRatingPercent(movie.rating),
    video: storedFile(movie.videoPath),
    poster: storedFile(movie.posterPath),
    // In track order rather than in array order: `position` is what
    // `preferredSubtitle` falls back through, so the order the rows come back
    // in is the order the family already has.
    subtitles: [...movie.subtitles]
      .sort((a, b) => a.position - b.position)
      .map((track) => ({
        key: `${STORED_KEY}${track.id}`,
        file: {
          kind: 'stored' as const,
          path: track.path,
          filename: filenameOf(track.path),
        },
        language: track.language,
      })),
  };
}

/**
 * The **File slot** a **Found file** fills: the absolute path the scan found
 * it at, and the name after its last separator — which is all the slot shows
 * of it, exactly as it shows a stored file.
 */
function foundFile(path: string): MovieFormFile {
  return { kind: 'found', path, filename: foundFilenameOf(path) };
}

/**
 * A **Problem detail**, read into the box **Resolve** opens on.
 *
 * Stories 80 and 81: the **Sheet row** already said the title, the year, the
 * genres, the director, the cast, the synopsis and the rating, and the scan
 * already found the film, the artwork and the tracks — so the maintainer
 * corrects rather than retypes, and picks only what the folder did not have.
 * A row that carries no rating opens **Unrated**, for {@link movieFormValues}'s
 * reason; a folder with no video — or two — leaves the slot empty for the
 * maintainer to pick.
 *
 * Every filled **File slot** holds a **Found file**, which the wire sends as
 * its path: nothing the scan found is read on this end.
 */
export function problemFormValues(
  detail: ImportProblemDetail
): MovieFormValues {
  const { row, files } = detail;
  return {
    title: row.title,
    year: row.year === undefined ? '' : String(row.year),
    director: row.director ?? '',
    description: row.synopsis ?? '',
    cast: castText(row.cast ?? []),
    genres: [...row.genres],
    rating: toRatingPercent(row.rating ?? null),
    video: files.video === undefined ? null : foundFile(files.video),
    poster: files.poster === undefined ? null : foundFile(files.poster),
    // In the folder's order, which is the order the run would have stored
    // them in — and each in the language the scan read off its name.
    subtitles: files.subtitles.map((track, index) => ({
      key: `${FOUND_KEY}${index}`,
      file: foundFile(track.path),
      language: track.language,
    })),
  };
}

/**
 * Append one **File slot** to a body: a **Stored file** or a **Found file** as
 * the path it already has, a **Picked file** as its bytes, and an empty slot as
 * nothing at all.
 *
 * The two names travel together because the slot is one thing — `video` and
 * `videoPath` are the same slot answering in the only two ways it can. A found
 * file answers the way a stored one does: what the path *means* — a file the
 * library holds, or one under the **Library root** the resolve route may copy
 * from — is the route's to decide, and nothing about the encoding differs.
 */
function appendFile(
  body: FormData,
  name: string,
  slot: MovieFormFile | null
): void {
  if (slot === null) {
    return;
  }
  if (slot.kind !== 'picked') {
    body.append(`${name}Path`, slot.path);
  } else {
    // The `File` itself, so the platform streams the part rather than reading
    // it into the body — which is what keeps a 12 GB film out of memory on this
    // end of the wire.
    body.append(name, slot.file);
  }
}

/**
 * The body one save sends — the same encoding for the request that creates a
 * record and the one that amends it, because they are the same form.
 *
 * **The passthrough is the point.** A file the library already holds travels as
 * the relative path it already has — and from #130 a **Found file** travels as
 * the absolute path the scan found it at, in the same field — and only a file
 * the maintainer just picked travels as bytes. That is what makes an edit touching only the title carry no
 * bytes at all: on a 12 GB film, the difference between instant and minutes.
 *
 * No `Content-Type` is decided here and none should be: a multipart body is
 * nothing without its boundary, and only the platform knows the boundary it
 * generated.
 *
 * Every single-valued field travels, including an empty `year`, `director` or
 * `description` — the server reads `''` as "not given", and a field that
 * vanished when it was cleared could not say a year had been *removed*. The
 * **lists** are the exception, read the other way: one part per entry, in the
 * order it was picked, and no part at all for an empty one, because there is no
 * genre named `''` and no cast member with no name.
 *
 * The **rating** crosses its one boundary here: the form holds the 0–100
 * percent every star strip fills against, `toRatingUnits` maps it to the 0–10
 * the column stores, and **Unrated** travels as an empty field rather than as
 * no field — for `year`'s reason over the one column where getting it wrong
 * *scores* the film instead of erasing a word of it.
 *
 * The **tracks** are the only list that is both a list and files, and they
 * travel as three names in step: a `subtitleLanguage` and a `subtitlePath` for
 * every row, and a `subtitle` part for the picked ones. A picked row holds its
 * place with an **empty path** — fields and file parts are read back
 * separately, so a mixed list has no other way to keep the order `position` is
 * written from.
 */
export function movieFormData(values: MovieFormValues): FormData {
  const body = new FormData();

  body.append('title', values.title);
  body.append('year', values.year);
  body.append('director', values.director);
  body.append('description', values.description);
  body.append('rating', String(toRatingUnits(values.rating) ?? ''));

  for (const genre of values.genres) {
    body.append('genre', genre);
  }
  // The comma rule is resolved on the way out, so the wire carries the names
  // rather than the typing — and it exists in exactly one place in the app.
  for (const name of castNames(values.cast)) {
    body.append('cast', name);
  }

  appendFile(body, 'video', values.video);
  appendFile(body, 'poster', values.poster);

  for (const subtitle of values.subtitles) {
    body.append('subtitleLanguage', subtitle.language);
    body.append(
      'subtitlePath',
      subtitle.file.kind === 'picked' ? '' : subtitle.file.path
    );
    if (subtitle.file.kind === 'picked') {
      body.append('subtitle', subtitle.file.file);
    }
  }

  return body;
}
