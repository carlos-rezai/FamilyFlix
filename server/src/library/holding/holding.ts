import type { SqliteDatabase } from '../../db';

/** The title a **Held video** belongs to. */
export interface HeldVideo {
  kind: 'movie' | 'series';
  id: string;
}

/** The holding slice: the **Held video** rule's read. */
export interface HoldingRepository {
  titleHolding(folderId: string, videoPath: string): HeldVideo | null;
}

export function createHolding(db: SqliteDatabase): HoldingRepository {
  // A film's or an episode's Linked video, then an episode's Source file
  // under its series' Source folder; both spelled with forward slashes, as a
  // Linked video is. `char(92)` is a backslash. No unique index: a double an
  // older library holds answers one of its titles.
  const selectHolding = db.prepare(`
    SELECT 'movie' AS kind, id FROM movies
      WHERE video_folder_id = @folderId AND video_path = @videoPath
    UNION ALL
    SELECT 'series' AS kind, series_id AS id FROM episodes
      WHERE video_folder_id = @folderId AND video_path = @videoPath
    UNION ALL
    SELECT 'series' AS kind, s.id FROM episodes e
      JOIN series s ON s.id = e.series_id
      WHERE s.library_folder_id = @folderId
        AND s.source_folder IS NOT NULL AND e.source_file IS NOT NULL
        AND replace(s.source_folder, char(92), '/') || '/'
          || replace(e.source_file, char(92), '/') = @videoPath
    LIMIT 1
  `);

  return {
    titleHolding(folderId, videoPath) {
      const row = selectHolding.get({ folderId, videoPath }) as
        | HeldVideo
        | undefined;
      return row === undefined ? null : { kind: row.kind, id: row.id };
    },
  };
}
