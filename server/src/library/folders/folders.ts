import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from '../../db';

/**
 * A **Library folder** as the library holds it: its id, its path as typed,
 * how many movies and series are recorded against it, and when a run last
 * read it. Whether it can be reached is the disk's answer, not the
 * database's, so it is not here.
 */
export interface StoredLibraryFolder {
  id: string;
  path: string;
  titleCount: number;
  /** The ISO moment a run last read it; `null` for a **New folder**. */
  scannedAt: string | null;
}

/**
 * What a remove answers: `removed`; `not-found` for an id the list does not
 * hold; `in-use` for a folder a **Linked video** plays from, with how many
 * titles do — films, plus series with a linked episode there, each series
 * once — and nothing removed.
 */
export type FolderRemoval =
  | { kind: 'removed' }
  | { kind: 'not-found' }
  | { kind: 'in-use'; titles: number };

/**
 * The folders slice: the list, an add, a remove that keeps the titles, and
 * the mark a run sets on the folders it read.
 */
export interface FoldersRepository {
  libraryFolders(): StoredLibraryFolder[];
  addLibraryFolder(path: string): StoredLibraryFolder;
  removeLibraryFolder(id: string): FolderRemoval;
  markScanned(ids: readonly string[], at: string): void;
}

export function createFolders(db: SqliteDatabase): FoldersRepository {
  // `rowid` breaks a tie between two folders added in the same millisecond.
  const selectFolders = db.prepare(`
    SELECT f.id, f.path, f.scanned_at AS scannedAt,
      (SELECT COUNT(*) FROM movies m WHERE m.library_folder_id = f.id)
      + (SELECT COUNT(*) FROM series s WHERE s.library_folder_id = f.id)
        AS titleCount
    FROM library_folders f
    ORDER BY f.added_at, f.rowid
  `);
  const insertFolder = db.prepare(
    'INSERT INTO library_folders (id, path, added_at) VALUES (?, ?, ?)'
  );
  const forgetMovies = db.prepare(
    'UPDATE movies SET library_folder_id = NULL, source_folder = NULL WHERE library_folder_id = ?'
  );
  const forgetSeries = db.prepare(
    'UPDATE series SET library_folder_id = NULL, source_folder = NULL WHERE library_folder_id = ?'
  );
  const deleteFolder = db.prepare('DELETE FROM library_folders WHERE id = ?');
  const stampFolder = db.prepare(
    'UPDATE library_folders SET scanned_at = ? WHERE id = ?'
  );
  // A series is one title however many of its episodes play from the folder.
  const selectLinked = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM movies WHERE video_folder_id = @id)
      + (SELECT COUNT(DISTINCT series_id) FROM episodes WHERE video_folder_id = @id)
        AS count
  `);

  function libraryFolders(): StoredLibraryFolder[] {
    return selectFolders.all() as StoredLibraryFolder[];
  }

  /** Throws on a path already listed: the schema holds it unique. */
  function addLibraryFolder(path: string): StoredLibraryFolder {
    const id = randomUUID();
    insertFolder.run(id, path, new Date().toISOString());
    return { id, path, titleCount: 0, scannedAt: null };
  }

  // The count and the delete in one transaction, so nothing can link a video
  // into the folder between the two.
  const removeLibraryFolder = db.transaction((id: string): FolderRemoval => {
    const { count } = selectLinked.get({ id }) as { count: number };
    if (count > 0) {
      return { kind: 'in-use', titles: count };
    }
    forgetMovies.run(id);
    forgetSeries.run(id);
    return deleteFolder.run(id).changes > 0
      ? { kind: 'removed' }
      : { kind: 'not-found' };
  });

  /** Stamp exactly the folders named with `at`, in one transaction. */
  const markScanned = db.transaction((ids: readonly string[], at: string) => {
    for (const id of ids) {
      stampFolder.run(at, id);
    }
  });

  return {
    libraryFolders,
    addLibraryFolder,
    removeLibraryFolder,
    markScanned,
  };
}
