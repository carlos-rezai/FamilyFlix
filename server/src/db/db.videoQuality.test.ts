// @vitest-environment node
//
// 70 — Video quality, Phase 1: "one film, through the Movie form" (issue #664).
//
// Migration 17 adds a nullable `video_quality TEXT` to `movies` and to
// `episodes`, and backfills nothing: a row written before it has no rung until
// something measures its file. Real SQLite on disk, so a version-16 library
// can be wound back and migrated in place.

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

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
}

const columnsOf = (db: SqliteDatabase, table: string): ColumnInfo[] =>
  db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[];

/**
 * A library written before migration 17: one movie and one episode, then the
 * columns dropped (where they are there) and the version wound back to 16.
 */
function atVersion16(dbPath: string): void {
  const storage = createSqliteStorage(dbPath);
  const db = openDatabase(dbPath);
  try {
    storage.addMovie(newMovie({ title: 'Northwind' }));
    const show = storage.addSeries({ title: 'Harbor & Vine' });
    storage.addEpisode(show.id, {
      season: 1,
      number: 1,
      videoPath: 'Harbor & Vine/Season 01/e01.mkv',
    });
    for (const table of ['movies', 'episodes']) {
      if (columnsOf(db, table).some((c) => c.name === 'video_quality')) {
        db.prepare(`ALTER TABLE ${table} DROP COLUMN video_quality`).run();
      }
    }
    db.pragma('user_version = 16');
  } finally {
    db.close();
    storage.close();
  }
}

describe('db: migration 17, a video’s quality', () => {
  it('lands a fresh database at version 17 with a nullable TEXT video_quality on movies and episodes', () => {
    const db = track(openDatabase(':memory:'));

    expect(Number(db.pragma('user_version', { simple: true }))).toBe(17);
    for (const table of ['movies', 'episodes']) {
      expect(columnsOf(db, table)).toContainEqual(
        expect.objectContaining({
          name: 'video_quality',
          type: 'TEXT',
          notnull: 0,
        })
      );
    }
  });

  it('leaves video_quality NULL on the rows of a version-16 library', () => {
    const dbPath = join(sandboxRoot('familyflix-migration-17-'), 'lib.db');
    atVersion16(dbPath);

    const db = track(openDatabase(dbPath));

    expect(Number(db.pragma('user_version', { simple: true }))).toBe(17);
    expect(db.prepare('SELECT video_quality FROM movies').all()).toEqual([
      { video_quality: null },
    ]);
    expect(db.prepare('SELECT video_quality FROM episodes').all()).toEqual([
      { video_quality: null },
    ]);
  });
});
