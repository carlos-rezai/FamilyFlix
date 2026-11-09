import { dirname, relative, sep } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { placeTitleFolder } from '../placeTitleFolder/placeTitleFolder';

/** Where a found film lies, as `setSourceFolder` records it. */
export interface FilmSource {
  folderId: string;
  /** The film's **Title folder**, its **Folder key**. */
  sourceFolder: string;
  /** A film's **Source file**, never set. */
  sourceFile: null;
}

/**
 * A video's **Source file**: its path relative to its **Source folder**
 * `dir`, with forward slashes whatever the platform spells, the one spelling
 * the scan, the **Series Resolve** and the add all record.
 */
export const sourceFileOf = (dir: string, video: string): string =>
  relative(dir, video).split(sep).join('/');

/**
 * A film's **Source folder** under its listed **Library folder** `folder`, as
 * the importer records it: its **Title folder** relative to it, and no
 * **Source file**.
 */
export const filmSourceOf = (
  folder: StoredLibraryFolder,
  scan: { dir: string }
): FilmSource => ({
  folderId: folder.id,
  sourceFolder: relative(folder.path, scan.dir),
  sourceFile: null,
});

/**
 * The **Source folder** a found film video says: a **Title folder** lying
 * directly in its listed **Library folder**, placed at its **Folder key**,
 * so a later **Folder scan** reads the film as **Already in library**.
 * `null` for a video anywhere else: under a folder not named `Title (Year)`,
 * in a Title folder deeper than the root, loose in the root, or under no
 * listed folder. Read in both modes.
 */
export function placeFilmFolder(
  folders: readonly StoredLibraryFolder[],
  video: string
): FilmSource | null {
  const placed = placeTitleFolder(folders, dirname(video));
  return placed === null ? null : { ...placed, sourceFile: null };
}
