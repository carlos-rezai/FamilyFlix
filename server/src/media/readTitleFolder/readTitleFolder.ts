import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { detectSubtitleLanguage } from '../detectSubtitleLanguage/detectSubtitleLanguage';
import {
  isImageFilename,
  isSubtitleFilename,
  isVideoFilename,
} from '../fileKinds/fileKinds';
import { folderKeyOf, type FolderKey } from '../folderKeyOf/folderKeyOf';

/** One subtitle file a scan found, and the language its name says. */
export interface SubtitleFound {
  path: string;
  language: string;
}

/** A folder a scan read for videos: its path, its name, its videos and tracks. */
export interface FolderScan {
  /** The folder itself, absolute. */
  dir: string;
  /** Its own name. */
  name: string;
  videos: string[];
  subtitles: SubtitleFound[];
}

/** A folder read as a film's: its videos and tracks, its **Poster** and **Backdrop**. */
export interface FilmScan extends FolderScan {
  poster: string | null;
  backdrop: string | null;
}

/**
 * A film as its **Title folder** holds it: every video loose in the folder
 * (more than one is the `no-video` **Problem**, _more than one video_, so all
 * are answered rather than one picked), the **Poster** and **Backdrop** of
 * its **Images folder** and the tracks of its **Subtitles folder**.
 */
export interface FilmFolderScan extends FilmScan {
  kind: 'film';
  key: FolderKey;
}

/** One **Season folder** of a series: its videos and the tracks beside them. */
export type SeasonFolderScan = FolderScan;

/** A series as its **Title folder** holds it: its **Season folders**. */
export interface SeriesFolderScan {
  kind: 'series';
  dir: string;
  name: string;
  key: FolderKey;
  seasons: SeasonFolderScan[];
}

/**
 * Why a folder in the root is left out of the **Folder layout**: a name that
 * is no **Folder key**, neither a loose video nor a Season folder, or both.
 */
export type LeftOutReason = 'no-key' | 'empty' | 'mixed';

export interface LeftOutFolder {
  kind: 'left-out';
  dir: string;
  name: string;
  reason: LeftOutReason;
}

/** What one folder in a Library folder's root reads as. */
export type TitleFolderScan = FilmFolderScan | SeriesFolderScan | LeftOutFolder;

/** A **Season folder**'s name: `Season` and its number, case folded. */
const SEASON_FOLDER = /^season ?\d+$/i;

/** Whether a folder's name is a **Season folder**'s. */
export const isSeasonFolder = (name: string): boolean =>
  SEASON_FOLDER.test(name);

/** The name before the extension, lowercased. */
const stem = (filename: string): string =>
  basename(filename, extname(filename)).toLowerCase();

/** A folder's entries, none when it is not there or cannot be read. */
async function entriesOf(dir: string): Promise<Dirent[]> {
  try {
    return await readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

/** The names of the files directly in a folder's entries, in name order. */
const filesIn = (entries: Dirent[]): string[] =>
  entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

/** The subtitles among `files` in `dir`, each with its language. */
const subtitlesIn = (dir: string, files: string[]): SubtitleFound[] =>
  files.filter(isSubtitleFilename).map((file) => ({
    path: join(dir, file),
    language: detectSubtitleLanguage(file),
  }));

/** The first image in `dir` whose stem, case folded, ends in `role`. */
const imageByRole = (
  dir: string,
  images: string[],
  role: string
): string | null => {
  const found = images.find((file) => stem(file).endsWith(role));
  return found === undefined ? null : join(dir, found);
};

/**
 * Read one **Title folder** by the **Folder layout**. One loose video or more
 * and no **Season folder** is a film: its art read by role from `Images/` (a
 * stem, case folded, ending in `poster` or `backdrop`, the first by name
 * order), its tracks from `Subtitles/` under any name. Season folders and no
 * loose video is a series. Both, neither, or a name that is no **Folder key**
 * is left out. `Extras/` and anything else the layout doesn't name is passed
 * in silence.
 */
export async function readTitleFolder(dir: string): Promise<TitleFolderScan> {
  const name = basename(dir);
  const key = folderKeyOf(name);
  if (key === null) {
    return { kind: 'left-out', dir, name, reason: 'no-key' };
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const videos = filesIn(entries)
    .filter(isVideoFilename)
    .map((file) => join(dir, file));
  const seasons = entries
    .filter((entry) => entry.isDirectory() && isSeasonFolder(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  if (videos.length > 0 && seasons.length > 0) {
    return { kind: 'left-out', dir, name, reason: 'mixed' };
  }
  if (videos.length === 0 && seasons.length === 0) {
    return { kind: 'left-out', dir, name, reason: 'empty' };
  }

  if (seasons.length > 0) {
    const scans: SeasonFolderScan[] = [];
    for (const season of seasons) {
      const seasonDir = join(dir, season);
      const files = filesIn(await entriesOf(seasonDir));
      scans.push({
        dir: seasonDir,
        name: season,
        videos: files.filter(isVideoFilename).map((f) => join(seasonDir, f)),
        subtitles: subtitlesIn(seasonDir, files),
      });
    }
    return { kind: 'series', dir, name, key, seasons: scans };
  }

  const imagesDir = join(dir, 'Images');
  const images = filesIn(await entriesOf(imagesDir)).filter(isImageFilename);
  const subtitlesDir = join(dir, 'Subtitles');
  return {
    kind: 'film',
    dir,
    name,
    key,
    videos,
    poster: imageByRole(imagesDir, images, 'poster'),
    backdrop: imageByRole(imagesDir, images, 'backdrop'),
    subtitles: subtitlesIn(
      subtitlesDir,
      filesIn(await entriesOf(subtitlesDir))
    ),
  };
}
