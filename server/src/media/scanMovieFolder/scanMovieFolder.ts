import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { detectSubtitleLanguage } from '../detectSubtitleLanguage/detectSubtitleLanguage';
import {
  isImageFilename,
  isSubtitleFilename,
  isVideoFilename,
} from '../fileKinds/fileKinds';

/** The names a folder gives its **Poster**, taken over the first image. */
const POSTER_NAMES = ['poster', 'folder', 'cover'];

/** The names a folder gives its **Backdrop** — by name, never by fallback. */
const BACKDROP_NAMES = ['fanart', 'backdrop'];

/** One subtitle file under a **Source folder**, and the language its name says. */
export interface SubtitleFound {
  path: string;
  language: string;
}

/**
 * What of a film is in one **Source folder**: every video by the fixed
 * extension list — more than one is a `no-video` **Problem**, so all are
 * reported rather than one picked — the **Poster**, the
 * **Backdrop**, and every subtitle with its language.
 */
export interface MovieFolderScan {
  /** The folder itself, absolute. */
  dir: string;
  /** Its own name, which is what matching reads. */
  name: string;
  videos: string[];
  poster: string | null;
  backdrop: string | null;
  subtitles: SubtitleFound[];
}

/** The name before the extension, lowercased — what `poster.JPG` is called. */
const stem = (filename: string): string =>
  basename(filename, extname(filename)).toLowerCase();

/**
 * Scan one directory for what of a film is in it. Only the files directly
 * inside are read — a folder within is the walker's business, and it does not
 * descend a folder that holds a video.
 *
 * The poster is the image named `poster.*`, `folder.*` or `cover.*`, case
 * folded, over the first image by name order; the backdrop is `fanart.*` or
 * `backdrop.*` and nothing else, because the **Movie form** has no backdrop
 * slot and the detail page draws the **Gradient fallback** — a still guessed
 * at would be worse than none. An image that is the backdrop is never the
 * poster's fallback either.
 */
export async function scanMovieFolder(dir: string): Promise<MovieFolderScan> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const images = files.filter(isImageFilename);
  const named = images.find((file) => POSTER_NAMES.includes(stem(file)));
  const backdrop = images.find((file) => BACKDROP_NAMES.includes(stem(file)));
  const poster =
    named ?? images.find((file) => !BACKDROP_NAMES.includes(stem(file)));

  const at = (file: string | undefined): string | null =>
    file === undefined ? null : join(dir, file);

  return {
    dir,
    name: basename(dir),
    videos: files.filter(isVideoFilename).map((file) => join(dir, file)),
    poster: at(poster),
    backdrop: at(backdrop),
    subtitles: files.filter(isSubtitleFilename).map((file) => ({
      path: join(dir, file),
      language: detectSubtitleLanguage(file),
    })),
  };
}
