import { basename, extname } from 'node:path';

import { detectSubtitleLanguage } from '../detectSubtitleLanguage/detectSubtitleLanguage';

/** The **Images folder**: `Images/` in a Title folder or a Season folder. */
export const IMAGES_FOLDER = 'Images';

/** The **Stills** of a Season folder: `Stills/` in its **Images folder**. */
export const STILLS_FOLDER = 'Stills';

/** The **Subtitles folder**: `Subtitles/` in a Title folder or a Season folder. */
export const SUBTITLES_FOLDER = 'Subtitles';

/** The **Meta folder**: `Meta/` in a Library folder's or an Export's root. */
export const META_FOLDER = 'Meta';

/**
 * The **Library sheet**'s name before its extension, in a Library folder's
 * **Meta folder** and an Export's alike.
 */
export const LIBRARY_SHEET_STEM = 'familyflix-library';

/** A filename's stem, case folded. */
const stemOf = (filename: string): string =>
  basename(filename, extname(filename)).toLowerCase();

/**
 * Whether an image is the art of `role` by the **Folder layout**'s rule: its
 * stem, case folded, ends in the role, so `heat-1995-poster.jpg` is a poster.
 * The scan reads art by it and the **Layout fill** writes none where it holds.
 */
export const endsInRole = (filename: string, role: string): boolean =>
  stemOf(filename).endsWith(role);

/**
 * A subtitle track's name in a **Subtitles folder**, before its extension:
 * the first of a language `English`, the next `English (2)`.
 */
export const spellTrackName = (language: string, count: number): string =>
  count === 1 ? language : `${language} (${count})`;

/** A track name's `(n)`, the number {@link spellTrackName} gives a second. */
const TRACK_NUMBER = / \(\d+\)$/;

/**
 * The language a track's filename says, its `(n)` set aside, so
 * `Dutch (2).srt` reads as Dutch.
 */
export const trackLanguageOf = (filename: string): string => {
  const extension = extname(filename);
  const stem = basename(filename, extension).replace(TRACK_NUMBER, '');
  return detectSubtitleLanguage(`${stem}${extension}`);
};
