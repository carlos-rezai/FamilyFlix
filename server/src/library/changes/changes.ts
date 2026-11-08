import type { SqliteDatabase } from '../../db';
import type { WatchStatus } from '@/types';
import { deriveStatus } from '../read/read';

/** Told the **Library folders** a write touched. */
export type ChangeListener = (folderIds: string[]) => void;

/**
 * Who hears of a write that changes a **Library sheet** cell, and where each
 * title's sheet lies: a Movie's or Series' recorded Library folder, an
 * Episode's through its series. A title with no folder lies in no sheet.
 */
export interface Changes {
  /** Subscribe a listener, answering its unsubscribe. */
  onChange(listener: ChangeListener): () => void;
  /** Tell every listener of the folders given, the absent ones dropped. */
  touch(folderIds: ReadonlyArray<string | null>): void;
  /** A Movie's or Series' Library folder, `null` for none. */
  folderOfTitle(id: string): string | null;
  /** An Episode's series' Library folder, `null` for none. */
  folderOfEpisode(id: string): string | null;
  /** A film's watch status, `null` for an id not held as one. */
  movieStatus(id: string): WatchStatus | null;
  /** An episode's watch status, `null` for an id not held as one. */
  episodeStatus(id: string): WatchStatus | null;
}

interface FolderRow {
  library_folder_id: string | null;
}

interface WatchRow {
  watched: number;
  resume_position_seconds: number;
}

export function createChanges(db: SqliteDatabase): Changes {
  const listeners = new Set<ChangeListener>();
  const selectTitleFolder = db.prepare<[string, string], FolderRow>(
    `SELECT library_folder_id FROM movies WHERE id = ?
     UNION ALL SELECT library_folder_id FROM series WHERE id = ?`
  );
  const selectEpisodeFolder = db.prepare<[string], FolderRow>(
    `SELECT series.library_folder_id FROM episodes
       JOIN series ON series.id = episodes.series_id WHERE episodes.id = ?`
  );
  const selectMovieWatch = db.prepare<[string], WatchRow>(
    'SELECT watched, resume_position_seconds FROM movies WHERE id = ?'
  );
  const selectEpisodeWatch = db.prepare<[string], WatchRow>(
    'SELECT watched, resume_position_seconds FROM episodes WHERE id = ?'
  );

  const statusOf = (row: WatchRow | undefined): WatchStatus | null =>
    row ? deriveStatus(row.watched !== 0, row.resume_position_seconds) : null;

  return {
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    touch(folderIds) {
      const touched = [
        ...new Set(folderIds.filter((id): id is string => id !== null)),
      ];
      if (touched.length === 0) {
        return;
      }
      for (const listener of [...listeners]) {
        listener(touched);
      }
    },
    folderOfTitle: (id) =>
      selectTitleFolder.get(id, id)?.library_folder_id ?? null,
    folderOfEpisode: (id) =>
      selectEpisodeFolder.get(id)?.library_folder_id ?? null,
    movieStatus: (id) => statusOf(selectMovieWatch.get(id)),
    episodeStatus: (id) => statusOf(selectEpisodeWatch.get(id)),
  };
}
