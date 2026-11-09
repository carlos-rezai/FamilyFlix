import type { SqliteDatabase } from '../../db';
import type { WatchStatus } from '@/types';
import { deriveStatus } from '../read/read';

/** Told the **Library folders** a write touched. */
export type ChangeListener = (folderIds: string[]) => void;

/** A write over one title or episode by its id. */
type IdWrite<A extends unknown[], R> = (id: string, ...rest: A) => R;

/** What a **Watch tick** is over: a film, or an episode. */
export type WatchedKind = 'movie' | 'episode';

/**
 * Who hears of a write that changes a **Library sheet** cell, and which write
 * touches which sheet: a Movie's or Series' recorded Library folder, an
 * Episode's through its series. A title with no folder lies in no sheet.
 */
export interface Changes {
  /** Subscribe a listener, answering its unsubscribe. */
  onChange(listener: ChangeListener): () => void;
  /** Tell every listener of the folders given, the absent ones dropped. */
  touch(folderIds: ReadonlyArray<string | null>): void;
  /** A Movie's or Series' Library folder, `null` for none. */
  folderOfTitle(id: string): string | null;
  /** A write over one Movie or Series, then its folder touched. */
  onTitle<A extends unknown[], R>(write: IdWrite<A, R>): IdWrite<A, R>;
  /** A delete or a clear: the folder read first, while the title is held. */
  beforeTitle<A extends unknown[], R>(write: IdWrite<A, R>): IdWrite<A, R>;
  /** A write over one Episode, then its series' folder touched. */
  onEpisode<A extends unknown[], R>(write: IdWrite<A, R>): IdWrite<A, R>;
  /**
   * A **Watch tick** over a film or an episode: its folder touched only when
   * it crosses a Status.
   */
  onCrossing(
    kind: WatchedKind,
    write: (id: string, seconds: number) => void
  ): (id: string, seconds: number) => void;
  /** A write answering the title it made, then that title's folder touched. */
  onCreated<A extends unknown[], R extends { id: string }>(
    write: (...args: A) => R
  ): (...args: A) => R;
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

  const touch = (folderIds: ReadonlyArray<string | null>): void => {
    const touched = [
      ...new Set(folderIds.filter((id): id is string => id !== null)),
    ];
    if (touched.length === 0) {
      return;
    }
    for (const listener of [...listeners]) {
      listener(touched);
    }
  };
  const folderOfTitle = (id: string): string | null =>
    selectTitleFolder.get(id, id)?.library_folder_id ?? null;
  const folderOfEpisode = (id: string): string | null =>
    selectEpisodeFolder.get(id)?.library_folder_id ?? null;
  /** Each watched kind's Status and folder reads. */
  const watched: Record<
    WatchedKind,
    {
      statusOf: (id: string) => WatchStatus | null;
      folderOf: (id: string) => string | null;
    }
  > = {
    movie: {
      statusOf: (id) => statusOf(selectMovieWatch.get(id)),
      folderOf: folderOfTitle,
    },
    episode: {
      statusOf: (id) => statusOf(selectEpisodeWatch.get(id)),
      folderOf: folderOfEpisode,
    },
  };

  return {
    onChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    touch,
    folderOfTitle,
    onTitle:
      (write) =>
      (id, ...rest) => {
        const result = write(id, ...rest);
        touch([folderOfTitle(id)]);
        return result;
      },
    beforeTitle:
      (write) =>
      (id, ...rest) => {
        const folder = folderOfTitle(id);
        const result = write(id, ...rest);
        touch([folder]);
        return result;
      },
    onEpisode:
      (write) =>
      (id, ...rest) => {
        const result = write(id, ...rest);
        touch([folderOfEpisode(id)]);
        return result;
      },
    onCrossing: (kind, write) => (id, seconds) => {
      const { statusOf: statusNow, folderOf } = watched[kind];
      const before = statusNow(id);
      write(id, seconds);
      if (statusNow(id) !== before) {
        touch([folderOf(id)]);
      }
    },
    onCreated:
      (write) =>
      (...args) => {
        const created = write(...args);
        touch([folderOfTitle(created.id)]);
        return created;
      },
  };
}
