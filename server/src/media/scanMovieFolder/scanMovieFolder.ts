import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { detectSubtitleLanguage } from '../detectSubtitleLanguage/detectSubtitleLanguage';

/**
 * What makes a folder a **Source folder**: a file with one of these
 * extensions in it. The list lives here and not in `uploadKinds`, because it is
 * a different rule with a different reason — the form's video slot accepts
 * anything so that `cannot-play` can be a state the player draws, while a
 * scanner deciding which folder on the shelf is a film has to draw a line.
 */
const VIDEO_EXTENSIONS = ['.mp4', '.mkv', '.avi', '.mov', '.webm'];

/** What an image on the shelf may be called — the same four a **Poster** may. */
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

/** The same four `parseSubtitle/` dispatches on and the picker offers. */
const SUBTITLE_EXTENSIONS = ['.srt', '.vtt', '.ass', '.sub'];

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
 * extension list — more than one is the `no-video` **Problem** of the review
 * slice, so all are reported rather than one picked — the **Poster**, the
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

const hasExtension = (filename: string, extensions: string[]): boolean =>
  extensions.includes(extname(filename).toLowerCase());

/** The name before the extension, lowercased — what `poster.JPG` is called. */
const stem = (filename: string): string =>
  basename(filename, extname(filename)).toLowerCase();

/** Whether a filename is one the scanner takes for a video. */
export function isVideoFilename(filename: string): boolean {
  return hasExtension(filename, VIDEO_EXTENSIONS);
}

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

  const images = files.filter((file) => hasExtension(file, IMAGE_EXTENSIONS));
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
    subtitles: files
      .filter((file) => hasExtension(file, SUBTITLE_EXTENSIONS))
      .map((file) => ({
        path: join(dir, file),
        language: detectSubtitleLanguage(file),
      })),
  };
}
