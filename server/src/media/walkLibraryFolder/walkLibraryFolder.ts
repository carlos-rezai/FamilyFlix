import type { Dirent } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { isVideoFilename } from '../fileKinds/fileKinds';
import {
  readTitleFolder,
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

/** The folder holding a Library folder's own sheet, and an Export's. */
const META = 'Meta';

/** The `Meta/` sheets a walk reads, the **Library sheet** first. */
const SHEETS = ['familyflix-library.csv', 'familyflix-library.xlsx'];

/** A **Layout warning**'s text for a root folder left out. */
const WARNING: Record<LeftOutReason, (name: string) => string> = {
  'no-key': (name) => `⚠ ${name} isn't named Title (Year), left out`,
  empty: (name) => `⚠ ${name} holds no video or Season folder, left out`,
  mixed: (name) => `⚠ ${name} holds loose videos and Season folders, left out`,
};

/** A system folder: a dot or dollar name, or `System Volume Information`. */
const isSystemFolder = (name: string): boolean =>
  name.startsWith('.') ||
  name.startsWith('$') ||
  name === 'System Volume Information';

/** Whether a folder holds a `Meta/` folder: an **Export folder**. */
async function holdsMeta(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory() && entry.name === META);
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
    const entries = await readdir(join(root, META), { withFileTypes: true });
    const sheet = SHEETS.find((name) =>
      entries.some((entry) => entry.isFile() && entry.name === name)
    );
    return sheet === undefined ? null : join(root, META, sheet);
  } catch {
    return null;
  }
}

/**
 * Walk a **Library folder** by the **Folder layout**: only the root's entries
 * are read, each folder by `readTitleFolder`. A folder left out of the layout
 * is one **Layout warning**, and the root's loose videos one line for the
 * whole folder. `Meta/`, an **Export folder** (a folder holding `Meta/`) and
 * system folders pass in silence; nothing inside a Title folder warns.
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
      entry.name === META ||
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
