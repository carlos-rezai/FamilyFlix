import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { spellEpisodeTag } from '../episodeTag/episodeTag';
import { isVideoFilename } from '../fileKinds/fileKinds';
import { LIBRARY_SHEET_STEM, META_FOLDER } from '../folderLayout/folderLayout';
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
 * each **Layout warning**'s text, and the `Meta/` sheet's path, or `null`.
 */
export interface LayoutWalk {
  titles: WalkedTitle[];
  warnings: string[];
  sheet: string | null;
}

/** The `Meta/` sheets a walk reads, the **Library sheet** first. */
const SHEETS = [`${LIBRARY_SHEET_STEM}.csv`, `${LIBRARY_SHEET_STEM}.xlsx`];

/** A **Layout warning**'s text for a root folder left out. */
const WARNING: Record<LeftOutReason, (name: string) => string> = {
  'no-key': (name) => `⚠ ${name} isn't named Title (Year), left out`,
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

/** Whether a folder holds a `Meta/` folder: an **Export folder**. */
async function holdsMeta(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.some(
      (entry) => entry.isDirectory() && entry.name === META_FOLDER
    );
  } catch {
    return false;
  }
}

/**
 * The root's `Meta/` sheet, the `.csv` when there, else the `.xlsx`, or
 * `null` when there is neither.
 */
async function sheetIn(root: string): Promise<string | null> {
  try {
    const entries = await readdir(join(root, META_FOLDER), {
      withFileTypes: true,
    });
    const sheet = SHEETS.find((name) =>
      entries.some((entry) => entry.isFile() && entry.name === name)
    );
    return sheet === undefined ? null : join(root, META_FOLDER, sheet);
  } catch {
    return null;
  }
}

/**
 * Walk a **Library folder** by the **Folder layout**: only the root's entries
 * are read, each folder by `readTitleFolder`, a **Title folder** when its
 * name is a **Folder key**. A folder left out of the layout is one **Layout
 * warning**, and the root's loose videos one line for the whole folder.
 * Each **Doubled place** a Title folder's read reports is one Layout warning
 * too. `Meta/`, an **Export folder** (a folder holding `Meta/`) and system
 * folders pass in silence; nothing else inside a Title folder warns.
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

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const dir = join(root, entry.name);
    if (
      entry.name === META_FOLDER ||
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

  return { titles, warnings, sheet: await sheetIn(root) };
}
