import { isAbsolute, relative, resolve } from 'node:path';

import type { LinkedFiles } from '@/types';

/** What {@link linkedFiles} reads off one title, every path absolute. */
export interface LinkedFilesInput {
  /** The title's linked videos — `[]` for a copied title. */
  videos: readonly string[];
  /** Whether every video the title holds is linked: a show may be mixed. */
  allLinked: boolean;
  /** The title's **Source folder**, `null` when none is recorded. */
  sourceFolder: string | null;
  /** The title's **Library folder** and whether it could be read just now. */
  libraryFolder: { path: string; reachable: boolean } | null;
  /** Every other held title's linked videos. */
  others: readonly string[];
}

/** A title's **Linked files**: the kind, and the absolute paths to trash. */
export interface LinkedFilesAnswer {
  kind: LinkedFiles;
  paths: string[];
}

const fold = (path: string): string =>
  process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);

/** Whether `path` is `folder` or lies under it, by whole segments. */
function within(folder: string, path: string): boolean {
  const between = relative(fold(folder), fold(path));
  return between === '' || (!between.startsWith('..') && !isAbsolute(between));
}

/**
 * Pure: a title's **Linked files**. `folder` when its Source folder holds
 * every one of its videos, no other held title's, and is not a Library folder
 * itself; `videos` when the folder is shared or the title is only partly
 * linked; `unreachable`, with no paths, while its Library folder can't be
 * read; `null` for a title with no linked video.
 */
export function linkedFiles({
  videos,
  allLinked,
  sourceFolder,
  libraryFolder,
  others,
}: LinkedFilesInput): LinkedFilesAnswer | null {
  if (videos.length === 0) return null;
  if (libraryFolder === null || !libraryFolder.reachable) {
    return { kind: 'unreachable', paths: [] };
  }
  const wholeFolder =
    allLinked &&
    sourceFolder !== null &&
    fold(sourceFolder) !== fold(libraryFolder.path) &&
    videos.every((video) => within(sourceFolder, video)) &&
    !others.some((other) => within(sourceFolder, other));
  return wholeFolder && sourceFolder !== null
    ? { kind: 'folder', paths: [sourceFolder] }
    : { kind: 'videos', paths: [...videos] };
}
