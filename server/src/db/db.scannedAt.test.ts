// @vitest-environment node
//
// 54, Scan new folders, Phase 2: "a folder knows it's new" (issue #493).
//
// Migration 16 adds `library_folders.scanned_at`, an ISO stamp, nullable, and
// backfills `scanned_at = added_at` for every folder holding a movie or a
// series; a folder holding none stays null, a **New folder**. A library
// written at version 15 migrates in place. Real SQLite on disk, so the
// database can be reopened.

import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { openDatabase, type SqliteDatabase } from '.';
import { createSqliteStorage } from '../library';
import { closeTracked, track } from '../test-support/freshStorage/freshStorage';
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const FILMS_ADDED = '2026-03-01T10:00:00.000Z';
const SHOWS_ADDED = '2026-04-02T11:00:00.000Z';
const EMPTY_ADDED = '2026-05-03T12:00:00.000Z';

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
}

const columnsOf = (db: SqliteDatabase): ColumnInfo[] =>
  db.prepare('PRAGMA table_info(library_folders)').all() as ColumnInfo[];

/**
 * A library written before migration 16: three folders, `films` holding a
 * movie, `shows` a series and `empty` nothing, then the column dropped (where
 * it is there) and the version wound back to 15.
 */
function atVersion15(dbPath: string): void {
  const storage = createSqliteStorage(dbPath);
  const db = openDatabase(dbPath);
  try {
    const insert = db.prepare(
      'INSERT INTO library_folders (id, path, added_at) VALUES (?, ?, ?)'
    );
    insert.run('films', 'E:\\Movies', FILMS_ADDED);
    insert.run('shows', 'E:\\Shows', SHOWS_ADDED);
    insert.run('empty', 'E:\\Empty', EMPTY_ADDED);
    const movie = storage.addMovie(newMovie({ title: 'Northwind' }));
    const show = storage.addSeries({ title: 'Harbor & Vine' });
    db.prepare('UPDATE movies SET library_folder_id = ? WHERE id = ?').run(
      'films',
      movie.id
    );
    db.prepare('UPDATE series SET library_folder_id = ? WHERE id = ?').run(
      'shows',
      show.id
    );
    if (columnsOf(db).some((column) => column.name === 'scanned_at')) {
      db.prepare('ALTER TABLE library_folders DROP COLUMN scanned_at').run();
    }
    db.pragma('user_version = 15');
  } finally {
    db.close();
    storage.close();
  }
}

function scannedAt(db: SqliteDatabase): Record<string, string | null> {
  const rows = db
    .prepare('SELECT id, scanned_at FROM library_folders')
    .all() as Array<{ id: string; scanned_at: string | null }>;
  return Object.fromEntries(rows.map((row) => [row.id, row.scanned_at]));
}

describe('db: migration 16, a folder’s scanned_at', () => {
  it('lands a fresh database at version 16 with a nullable TEXT scanned_at', () => {
    const db = track(openDatabase(':memory:'));

    expect(Number(db.pragma('user_version', { simple: true }))).toBe(16);
    expect(columnsOf(db)).toContainEqual(
      expect.objectContaining({ name: 'scanned_at', type: 'TEXT', notnull: 0 })
    );
  });

  it('backfills scanned_at = added_at over a version-15 library for a folder holding a movie or a series, and leaves one holding none null', () => {
    const dbPath = join(sandboxRoot('familyflix-migration-16-'), 'lib.db');
    atVersion15(dbPath);

    const db = track(openDatabase(dbPath));

    expect(Number(db.pragma('user_version', { simple: true }))).toBe(16);
    expect(scannedAt(db)).toEqual({
      films: FILMS_ADDED,
      shows: SHOWS_ADDED,
      empty: null,
    });
  });

  it('keeps every folder and its titles through the migration', () => {
    const dbPath = join(sandboxRoot('familyflix-migration-16-'), 'lib.db');
    atVersion15(dbPath);

    const storage = track(createSqliteStorage(dbPath));

    expect(
      storage
        .libraryFolders()
        .map((folder) => [folder.id, folder.titleCount, folder.scannedAt])
    ).toEqual([
      ['films', 1, FILMS_ADDED],
      ['shows', 1, SHOWS_ADDED],
      ['empty', 0, null],
    ]);
  });
});
