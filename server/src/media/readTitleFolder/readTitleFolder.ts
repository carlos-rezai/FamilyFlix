import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

import { detectSubtitleLanguage } from '../detectSubtitleLanguage/detectSubtitleLanguage';
import {
  isImageFilename,
  isSubtitleFilename,
  isVideoFilename,
} from '../fileKinds/fileKinds';
import { episodeTag, spellEpisodeTag } from '../episodeTag/episodeTag';
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

/**
 * One **Season folder** of a series: its number (`0` the specials), its
 * videos loose in name order, its **Season poster** from `Images/`, its
 * **Stills** from `Images/Stills/` by the **Episode tag** their names carry,
 * and each episode's tracks from `Subtitles/S01E01/`.
 */
export interface SeasonFolderScan extends FolderScan {
  number: number;
  poster: string | null;
  /** Each Still by the tag it carries, spelled `S01E01`. */
  stills: Record<string, string>;
}

/**
 * A series as its **Title folder** holds it: its own **Poster** and
 * **Backdrop** from `Images/`, and its **Season folders** in number order.
 */
export interface SeriesFolderScan {
  kind: 'series';
  dir: string;
  name: string;
  key: FolderKey;
  poster: string | null;
  backdrop: string | null;
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

/**
 * A **Season folder**'s name: `Season NN`, two digits or more, case folded;
 * `Season 00` the specials.
 */
const SEASON_FOLDER = /^season (\d{2,})$/i;

/** The season a folder's name says, or `null` for no **Season folder**. */
export const seasonNumberOf = (name: string): number | null => {
  const found = SEASON_FOLDER.exec(name);
  return found === null ? null : Number(found[1]);
};

/** Whether a folder's name is a **Season folder**'s. */
export const isSeasonFolder = (name: string): boolean =>
  seasonNumberOf(name) !== null;

/** A name read as an **Episode tag**'s folder or Still: the tag, spelled. */
const tagOf = (name: string): string | null => {
  const tag = episodeTag(name);
  return tag === null ? null : spellEpisodeTag(tag.season, tag.episode);
};

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
 * Read one **Season folder**: its videos loose in name order, its **Season
 * poster** by role from `Images/`, each **Still** in `Images/Stills/` by the
 * **Episode tag** its name carries (a name carrying none is passed), and the
 * tracks of each `Subtitles/` folder named by a tag (a track anywhere else is
 * passed).
 */
export async function readSeasonFolder(dir: string): Promise<SeasonFolderScan> {
  const name = basename(dir);
  const videos = filesIn(await entriesOf(dir))
    .filter(isVideoFilename)
    .map((file) => join(dir, file));

  const imagesDir = join(dir, 'Images');
  const images = filesIn(await entriesOf(imagesDir)).filter(isImageFilename);

  const stillsDir = join(imagesDir, 'Stills');
  const stills: Record<string, string> = {};
  for (const file of filesIn(await entriesOf(stillsDir))) {
    const tag = tagOf(file);
    if (isImageFilename(file) && tag !== null && !(tag in stills)) {
      stills[tag] = join(stillsDir, file);
    }
  }

  const subtitlesDir = join(dir, 'Subtitles');
  const subtitles: SubtitleFound[] = [];
  const tagFolders = (await entriesOf(subtitlesDir))
    .filter((entry) => entry.isDirectory() && tagOf(entry.name) !== null)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  for (const folder of tagFolders) {
    const tracksDir = join(subtitlesDir, folder);
    subtitles.push(
      ...subtitlesIn(tracksDir, filesIn(await entriesOf(tracksDir)))
    );
  }

  return {
    dir,
    name,
    number: seasonNumberOf(name) as number,
    videos,
    subtitles,
    poster: imageByRole(imagesDir, images, 'poster'),
    stills,
  };
}

/**
 * Read one **Title folder** by the **Folder layout**. One loose video or more
 * and no **Season folder** is a film: its art read by role from `Images/` (a
 * stem, case folded, ending in `poster` or `backdrop`, the first by name
 * order), its tracks from `Subtitles/` under any name. Season folders and no
 * loose video is a series. Both, neither, or a name that is no **Folder key**
 * is left out, with the reason the walk words as its **Layout warning**.
 * `Extras/` and anything else the layout doesn't name is passed
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

  const imagesDir = join(dir, 'Images');
  const images = filesIn(await entriesOf(imagesDir)).filter(isImageFilename);
  const poster = imageByRole(imagesDir, images, 'poster');
  const backdrop = imageByRole(imagesDir, images, 'backdrop');

  if (seasons.length > 0) {
    const scans: SeasonFolderScan[] = [];
    for (const season of seasons) {
      scans.push(await readSeasonFolder(join(dir, season)));
    }
    scans.sort((a, b) => a.number - b.number);
    return { kind: 'series', dir, name, key, poster, backdrop, seasons: scans };
  }

  const subtitlesDir = join(dir, 'Subtitles');
  return {
    kind: 'film',
    dir,
    name,
    key,
    videos,
    poster,
    backdrop,
    subtitles: subtitlesIn(
      subtitlesDir,
      filesIn(await entriesOf(subtitlesDir))
    ),
  };
}
