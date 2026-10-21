import { dirname, relative, sep } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';
import {
  scanMovieFolder,
  type MovieFolderScan,
} from '../../media/scanMovieFolder/scanMovieFolder';
import { splitCollections } from '../splitCollections/splitCollections';

/** Where a found film lies, as `setSourceFolder` records it. */
export interface FilmSource {
  folderId: string;
  /** The film's folder, relative to its listed **Library folder**. */
  sourceFolder: string;
  /** Its **Source file**, set only when the folder is a **Collection folder**. */
  sourceFile: string | null;
}

/**
 * A video's **Source file**: its path relative to its **Source folder**
 * `dir`, with forward slashes whatever the platform spells — the one spelling
 * the scan, the **Series Resolve** and the add all record.
 */
export const sourceFileOf = (dir: string, video: string): string =>
  relative(dir, video).split(sep).join('/');

/**
 * A film's **Source folder** under its listed **Library folder** `folder`, as
 * the importer records it: the scan's folder relative to it and, for a
 * **Collection folder** film, its one video's **Source file**.
 */
export const filmSourceOf = (
  folder: StoredLibraryFolder,
  scan: MovieFolderScan
): FilmSource => ({
  folderId: folder.id,
  sourceFolder: relative(folder.path, scan.dir),
  sourceFile:
    scan.collection === true ? sourceFileOf(scan.dir, scan.videos[0]) : null,
});

/**
 * The **Source folder** a found film video says, placed under its listed
 * **Library folder** by {@link filmSourceOf} over its folder's scan, split as
 * `splitCollections` reads a **Collection folder** — so a later **Folder
 * scan** reads the film as **Already in library** and the collection's other
 * films still come in. `null` when the video lies under no listed folder.
 * Read in both modes.
 */
export async function placeFilmFolder(
  folders: readonly StoredLibraryFolder[],
  video: string
): Promise<FilmSource | null> {
  const listed = listedFolderOf(folders, video);
  if (listed === null) {
    return null;
  }
  const films = splitCollections([await scanMovieFolder(dirname(video))]);
  const film =
    films.find((each) =>
      each.videos.some((path) => relative(path, video) === '')
    ) ?? films[0];
  return filmSourceOf(listed, film);
}
