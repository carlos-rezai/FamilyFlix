import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from '../../db';

/**
 * A **Library folder** as the library holds it: its id, its path as typed,
 * and how many movies and series are recorded against it. Whether it can be
 * reached is the disk's answer, not the database's, so it is not here.
 */
export interface StoredLibraryFolder {
  id: string;
  path: string;
  titleCount: number;
}

/** The folders slice: the list, an add and a remove that keeps the titles. */
export interface FoldersRepository {
  libraryFolders(): StoredLibraryFolder[];
  addLibraryFolder(path: string): StoredLibraryFolder;
  removeLibraryFolder(id: string): boolean;
  linkedTitleCount(id: string): number;
}

export function createFolders(db: SqliteDatabase): FoldersRepository {
  // `rowid` breaks a tie between two folders added in the same millisecond.
  const selectFolders = db.prepare(`
    SELECT f.id, f.path,
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
    return { id, path, titleCount: 0 };
  }

  const removeLibraryFolder = db.transaction((id: string): boolean => {
    forgetMovies.run(id);
    forgetSeries.run(id);
    return deleteFolder.run(id).changes > 0;
  });

  function linkedTitleCount(id: string): number {
    return (selectLinked.get({ id }) as { count: number }).count;
  }

  return {
    libraryFolders,
    addLibraryFolder,
    removeLibraryFolder,
    linkedTitleCount,
  };
}
