import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { spellEpisodeTag } from '../episodeTag/episodeTag';
import { isVideoFilename } from '../fileKinds/fileKinds';
import {
  isMetaFolder,
  LIBRARY_SHEET_STEM,
  META_FOLDER,
  OLD_META_FOLDER,
} from '../folderLayout/folderLayout';
import {
  readTitleFolder,
  type DoubledPlace,
  type FilmFolderScan,
  type LeftOutReason,
  type SeriesFolderScan,
  type TitleFolderScan,
} from '../readTitleFolder/readTitleFolder';

/** A **Title folder** the walk read: a film or a series. */
export type WalkedTitle = FilmFolderScan | SeriesFolderScan;

/**
 * What a walk of one **Library folder** answers: the **Title folders** read,
 * each **Layout warning**'s text, each **Off-layout folder** the walk turned
 * away, and the path of the sheet in the root's **Meta folder**, either name,
 * or `null`.
 */
export interface LayoutWalk {
  titles: WalkedTitle[];
  warnings: string[];
  offLayout: OffLayoutFolder[];
  sheet: string | null;
}

/**
 * An **Off-layout folder**: a root folder the **Folder layout** turns away,
 * its path, its name and why.
 */
export interface OffLayoutFolder {
  dir: string;
  name: string;
  reason: LeftOutReason;
}

/** The sheets a walk reads in a Meta folder, the **Library sheet** first. */
const SHEETS = [`${LIBRARY_SHEET_STEM}.csv`, `${LIBRARY_SHEET_STEM}.xlsx`];

/** A **Layout warning**'s text for a root folder left out. */
const WARNING: Record<LeftOutReason, (name: string) => string> = {
  empty: (name) => `⚠ ${name} holds no video or Season folder, left out`,
  mixed: (name) => `⚠ ${name} holds loose videos and Season folders, left out`,
};

/** A **Doubled place**'s noun, plural, and where in the title it lies. */
const doubledWhere = (place: DoubledPlace): [string, string] => {
  switch (place.place) {
    case 'poster':
      return ['posters', ''];
    case 'backdrop':
      return ['backdrops', ''];
    case 'season':
      return [`Season ${place.season} folders`, ''];
    case 'season-poster':
      return ['posters', ` Season ${place.season}`];
    case 'still':
      return ['Stills', ` ${spellEpisodeTag(place.season, place.episode)}`];
    case 'track':
      return [
        `${place.language} tracks`,
        'season' in place
          ? ` ${spellEpisodeTag(place.season, place.episode)}`
          : '',
      ];
  }
};

/** A **Layout warning**'s text for a **Doubled place** of title `name`. */
const doubledWarning = (name: string, place: DoubledPlace): string => {
  const [noun, where] = doubledWhere(place);
  return `⚠ ${name}${where} holds ${place.count} ${noun}, ${basename(place.read)} read`;
};

/** Each **Doubled place** of a title, its seasons' after its own. */
const doubledIn = (title: WalkedTitle): DoubledPlace[] =>
  title.kind === 'series'
    ? [...title.doubled, ...title.seasons.flatMap((season) => season.doubled)]
    : title.doubled;

/** A system folder: a dot or dollar name, or `System Volume Information`. */
const isSystemFolder = (name: string): boolean =>
  name.startsWith('.') ||
  name.startsWith('$') ||
  name === 'System Volume Information';

/**
 * Whether a folder holds a `_meta/` or `Meta/` folder: an **Export folder**.
 */
async function holdsMeta(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.some(
      (entry) => entry.isDirectory() && isMetaFolder(entry.name)
    );
  } catch {
    return false;
  }
}

/**
 * A Meta folder's sheet, the `.csv` when there, else the `.xlsx`, or `null`
 * when there is neither.
 */
async function sheetInFolder(folder: string): Promise<string | null> {
  try {
    const entries = await readdir(folder, { withFileTypes: true });
    const sheet = SHEETS.find((name) =>
      entries.some((entry) => entry.isFile() && entry.name === name)
    );
    return sheet === undefined ? null : join(folder, sheet);
  } catch {
    return null;
  }
}

/**
 * The root's sheet: from `_meta/` when it holds one, else from `Meta/`, the
 * `.csv` before the `.xlsx` in each, or `null` when neither holds a sheet.
 */
async function sheetIn(root: string): Promise<string | null> {
  return (
    (await sheetInFolder(join(root, META_FOLDER))) ??
    (await sheetInFolder(join(root, OLD_META_FOLDER)))
  );
}

/**
 * Walk a **Library folder** by the **Folder layout**: only the root's entries
 * are read, each folder by `readTitleFolder`, a **Title folder** whatever its
 * name (`Heat` as well as `Heat (1995)`): no folder is ever warned about its
 * name or its missing year. A folder left out of the layout (`empty`,
 * `mixed`) is one **Layout warning** and one `offLayout` entry, which the
 * importer files as an `off-layout` **Problem**; the root's loose videos one
 * line for the whole folder. Each **Doubled place** a Title folder's read
 * reports, a doubled season (`Death Note holds 2 Season 1 folders, Season 01
 * read`) among them, is one Layout warning too. `_meta/` and `Meta/`, an
 * **Export folder** (a folder holding either) and system folders pass in
 * silence; nothing else inside a Title folder warns.
 *
 * `onFound` is told of each Title folder as it is read. A Title folder that
 * cannot be read is told to `onUnreadable` and skipped; the root itself is
 * the caller's to refuse.
 */
export async function walkLibraryFolder(
  root: string,
  onFound: (title: WalkedTitle) => void = () => undefined,
  onUnreadable: (dir: string) => void = () => undefined
): Promise<LayoutWalk> {
  const entries: Dirent[] = await readdir(root, { withFileTypes: true });
  const titles: WalkedTitle[] = [];
  const warnings: string[] = [];
  const offLayout: OffLayoutFolder[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const dir = join(root, entry.name);
    if (
      isMetaFolder(entry.name) ||
      isSystemFolder(entry.name) ||
      (await holdsMeta(dir))
    ) {
      continue;
    }
    let scan: TitleFolderScan;
    try {
      scan = await readTitleFolder(dir);
    } catch {
      onUnreadable(dir);
      continue;
    }
    if (scan.kind === 'left-out') {
      warnings.push(WARNING[scan.reason](scan.name));
      offLayout.push({ dir, name: scan.name, reason: scan.reason });
      continue;
    }
    for (const place of doubledIn(scan)) {
      warnings.push(doubledWarning(scan.name, place));
    }
    titles.push(scan);
    onFound(scan);
  }

  const loose = entries.filter(
    (entry) => entry.isFile() && isVideoFilename(entry.name)
  ).length;
  if (loose > 0) {
    warnings.push(
      loose === 1
        ? `⚠ 1 video lies loose at the top of ${root}, left out`
        : `⚠ ${loose} videos lie loose at the top of ${root}, left out`
    );
  }

  return { titles, warnings, offLayout, sheet: await sheetIn(root) };
}
