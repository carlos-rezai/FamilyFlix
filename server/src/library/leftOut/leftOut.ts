import type { SqliteDatabase } from '../../db';

/**
 * One **Left-out video**: a Library folder's id and a path relative to it
 * with forward slashes, spelled as a **Linked video**'s `video_path`.
 */
export interface LeftOutVideo {
  folderId: string;
  videoPath: string;
}

/** The left-out slice: the videos a Folder scan and a sheet run skip. */
export interface LeftOutRepository {
  leaveOut(entries: readonly LeftOutVideo[]): void;
  leftOut(folderId: string): ReadonlySet<string>;
  clearLeftOut(entries: readonly LeftOutVideo[]): void;
  bringBack(folderId: string): number;
}

export function createLeftOut(db: SqliteDatabase): LeftOutRepository {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO left_out_videos (library_folder_id, video_path)
     VALUES (?, ?)`
  );
  const select = db.prepare(
    'SELECT video_path FROM left_out_videos WHERE library_folder_id = ?'
  );
  const remove = db.prepare(
    'DELETE FROM left_out_videos WHERE library_folder_id = ? AND video_path = ?'
  );
  const removeFolder = db.prepare(
    'DELETE FROM left_out_videos WHERE library_folder_id = ?'
  );
  const leaveOut = db.transaction((entries: readonly LeftOutVideo[]) => {
    for (const entry of entries) {
      insert.run(entry.folderId, entry.videoPath);
    }
  });
  const clearLeftOut = db.transaction((entries: readonly LeftOutVideo[]) => {
    for (const entry of entries) {
      remove.run(entry.folderId, entry.videoPath);
    }
  });

  return {
    leaveOut(entries) {
      leaveOut(entries);
    },
    leftOut(folderId) {
      const rows = select.all(folderId) as Array<{ video_path: string }>;
      return new Set(rows.map((row) => row.video_path));
    },
    clearLeftOut(entries) {
      clearLeftOut(entries);
    },
    bringBack(folderId) {
      return removeFolder.run(folderId).changes;
    },
  };
}
