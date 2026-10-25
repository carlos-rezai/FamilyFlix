// @vitest-environment node
//
// 51, Library audit, Phase 10: "a title taken out stays out" (issue #453).
//
// Migration 15 adds `left_out_videos (library_folder_id, video_path)`: a
// **Left-out video** per row, its path relative to the Library folder with
// forward slashes, the primary key on both columns, `ON DELETE CASCADE` from
// `library_folders`. A library written at version 14 migrates in place and
// keeps its rows. Real SQLite on disk, so the database can be reopened.

import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openDatabase, type SqliteDatabase } from '.';
import { createSqliteStorage } from '../library';
import { closeTracked, track } from '../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

function tableNames(db: SqliteDatabase): string[] {
  return (
    db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

/** A database written before migration 15: its table dropped, its version wound back. */
function atVersion14(dbPath: string): void {
  const db = openDatabase(dbPath);
  try {
    db.prepare(
      'INSERT INTO library_folders (id, path, added_at) VALUES (?, ?, ?)'
    ).run('films', 'E:\\Movies', '2026-10-24T12:00:00.000Z');
    db.prepare('DROP TABLE IF EXISTS left_out_videos').run();
    db.pragma('user_version = 14');
  } finally {
    db.close();
  }
}

describe('db: migration 15, the left-out videos', () => {
  it('lands a fresh database at version 15 with the table', () => {
    const db = track(openDatabase(':memory:'));

    expect(Number(db.pragma('user_version', { simple: true }))).toBe(15);
    expect(tableNames(db)).toContain('left_out_videos');
  });

  it('keys the table on both columns', () => {
    const db = track(openDatabase(':memory:'));

    const columns = db
      .prepare('PRAGMA table_info(left_out_videos)')
      .all() as Array<{ name: string; pk: number }>;

    expect(
      columns
        .filter((column) => column.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((column) => column.name)
    ).toEqual(['library_folder_id', 'video_path']);
  });

  it('cascades from library_folders', () => {
    const db = track(openDatabase(':memory:'));

    const keys = db
      .prepare('PRAGMA foreign_key_list(left_out_videos)')
      .all() as Array<{ table: string; from: string; on_delete: string }>;

    expect(keys).toEqual([
      expect.objectContaining({
        table: 'library_folders',
        from: 'library_folder_id',
        on_delete: 'CASCADE',
      }),
    ]);
  });

  it('migrates a version-14 database in place, keeping its rows', () => {
    const dbPath = join(sandboxRoot('familyflix-migration-15-'), 'lib.db');
    atVersion14(dbPath);

    const storage = track(createSqliteStorage(dbPath));
    storage.leaveOut([
      { folderId: 'films', videoPath: 'Heat (1995)/Heat.mkv' },
    ]);

    expect(storage.libraryFolders().map((folder) => folder.id)).toEqual([
      'films',
    ]);
    expect([...storage.leftOut('films')]).toEqual(['Heat (1995)/Heat.mkv']);
    closeTracked();
    const db = track(openDatabase(dbPath));
    expect(Number(db.pragma('user_version', { simple: true }))).toBe(15);
  });
});
