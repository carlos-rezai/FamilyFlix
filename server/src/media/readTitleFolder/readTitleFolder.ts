import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { detectSubtitleLanguage } from '../detectSubtitleLanguage/detectSubtitleLanguage';
import {
  isImageFilename,
  isSubtitleFilename,
  isVideoFilename,
} from '../fileKinds/fileKinds';
import { episodeTag, spellEpisodeTag } from '../episodeTag/episodeTag';
import { folderKeyOf, type FolderKey } from '../folderKeyOf/folderKeyOf';
import {
  endsInRole,
  IMAGES_FOLDER,
  STILLS_FOLDER,
  SUBTITLES_FOLDER,
} from '../folderLayout/folderLayout';
import {
  isSeasonFolder,
  seasonNumberOf,
} from '../seasonNumberOf/seasonNumberOf';

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

/** A name read as an **Episode tag**'s folder or Still: the tag, spelled. */
const tagOf = (name: string): string | null => {
  const tag = episodeTag(name);
  return tag === null ? null : spellEpisodeTag(tag.season, tag.episode);
};

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

/** A folder's loose videos and tracks by its entries, in name order. */
const looseFilesIn = (dir: string, entries: Dirent[]): FolderScan => {
  const files = filesIn(entries);
  return {
    dir,
    name: basename(dir),
    videos: files.filter(isVideoFilename).map((file) => join(dir, file)),
    subtitles: files.filter(isSubtitleFilename).map((file) => ({
      path: join(dir, file),
      language: detectSubtitleLanguage(file),
    })),
  };
};

/**
 * A folder's loose files: the videos and tracks directly in it, in name
 * order, each track with the language its name says. None when the folder is
 * not there or cannot be read.
 */
export async function readLooseFiles(dir: string): Promise<FolderScan> {
  return looseFilesIn(dir, await entriesOf(dir));
}

/** The first image in `dir` that is the art of `role` by its name. */
const imageByRole = (
  dir: string,
  images: string[],
  role: string
): string | null => {
  const found = images.find((file) => endsInRole(file, role));
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
  const { name, videos } = await readLooseFiles(dir);

  const imagesDir = join(dir, IMAGES_FOLDER);
  const images = filesIn(await entriesOf(imagesDir)).filter(isImageFilename);

  const stillsDir = join(imagesDir, STILLS_FOLDER);
  const stills: Record<string, string> = {};
  for (const file of filesIn(await entriesOf(stillsDir))) {
    const tag = tagOf(file);
    if (isImageFilename(file) && tag !== null && !(tag in stills)) {
      stills[tag] = join(stillsDir, file);
    }
  }

  const subtitlesDir = join(dir, SUBTITLES_FOLDER);
  const subtitles: SubtitleFound[] = [];
  const tagFolders = (await entriesOf(subtitlesDir))
    .filter((entry) => entry.isDirectory() && tagOf(entry.name) !== null)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  for (const folder of tagFolders) {
    subtitles.push(
      ...(await readLooseFiles(join(subtitlesDir, folder))).subtitles
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
 * Read a folder's **Season folders**, and nothing else in it, in number order:
 * the one reader of a show, shared by the scan and the **Show folder read**.
 * A folder the layout does not read as a Season folder (`Season 1`,
 * `Extras`) is passed in silence. Throws when the folder cannot be read.
 */
export async function readSeasonFolders(
  dir: string
): Promise<SeasonFolderScan[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const scans: SeasonFolderScan[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && isSeasonFolder(entry.name)) {
      scans.push(await readSeasonFolder(join(dir, entry.name)));
    }
  }
  return scans.sort((a, b) => a.number - b.number);
}

/**
 * Read one **Title folder** by the **Folder layout**. One loose video or more
 * and no **Season folder** is a film: its art read by role from `Images/` (a
 * stem, case folded, ending in `poster` or `backdrop`, the first by name
 * order), its tracks from `Subtitles/` under any name. Season folders and no
 * loose video is a series. Both, neither, or a name that is no **Folder key**
 * is left out, with the reason the walk words as its **Layout warning**;
 * Season folders that all hold no video are as good as none, `empty`.
 * `Extras/` and anything else the layout doesn't name is passed in silence.
 */
export async function readTitleFolder(dir: string): Promise<TitleFolderScan> {
  const name = basename(dir);
  const key = folderKeyOf(name);
  if (key === null) {
    return { kind: 'left-out', dir, name, reason: 'no-key' };
  }
  const entries = await readdir(dir, { withFileTypes: true });
  const { videos } = looseFilesIn(dir, entries);
  const seasons = await readSeasonFolders(dir);

  if (videos.length > 0 && seasons.length > 0) {
    return { kind: 'left-out', dir, name, reason: 'mixed' };
  }
  if (
    videos.length === 0 &&
    seasons.every((season) => season.videos.length === 0)
  ) {
    return { kind: 'left-out', dir, name, reason: 'empty' };
  }

  const imagesDir = join(dir, IMAGES_FOLDER);
  const images = filesIn(await entriesOf(imagesDir)).filter(isImageFilename);
  const poster = imageByRole(imagesDir, images, 'poster');
  const backdrop = imageByRole(imagesDir, images, 'backdrop');

  if (seasons.length > 0) {
    return { kind: 'series', dir, name, key, poster, backdrop, seasons };
  }

  return {
    kind: 'film',
    dir,
    name,
    key,
    videos,
    poster,
    backdrop,
    subtitles: (await readLooseFiles(join(dir, SUBTITLES_FOLDER))).subtitles,
  };
}
