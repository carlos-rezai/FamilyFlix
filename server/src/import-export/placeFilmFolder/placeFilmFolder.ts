import { dirname, relative, sep } from 'node:path';

import type { StoredLibraryFolder } from '../../library';
import { listedFolderOf } from '../listedFolderOf/listedFolderOf';
import { scanMovieFolder } from '../../media/scanMovieFolder/scanMovieFolder';
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
 * The **Source folder** a found film video says, placed under its listed
 * **Library folder**: the film's folder relative to it and, when that folder
 * is a **Collection folder** as `splitCollections` reads one, the video's
 * **Source file** with forward slashes — so a later **Folder scan** reads the
 * film as **Already in library** and the collection's other films still come
 * in. `null` when the video lies under no listed folder. Read in both modes.
 */
export async function placeFilmFolder(
  folders: StoredLibraryFolder[],
  video: string
): Promise<FilmSource | null> {
  const listed = listedFolderOf(folders, video);
  if (listed === null) {
    return null;
  }
  const dir = dirname(video);
  const films = splitCollections([await scanMovieFolder(dir)]);
  const collection = films.some((film) => film.collection === true);
  return {
    folderId: listed.id,
    sourceFolder: relative(listed.path, dir),
    sourceFile: collection ? relative(dir, video).split(sep).join('/') : null,
  };
}
