// @vitest-environment node
//
// 37 — Factory reset, Phase 1: "the reset wire" (issue #298).
//
// `resetDatabase` erases every row of every table but the genre pool, in one
// transaction, child-first. Two exported lists spell the rule — what is erased
// and what is kept — and a guard over a fully migrated database holds every
// table to one of them, so a table a future migration adds is never erased (or
// kept) without someone deciding it should be. Real SQLite throughout, the
// `seriesSeed` and migration suites' precedent.
//
// 39 — Season posters (issue #322): migration #10's `season_posters` joins the
// erased list, a child of `series`, and `fill` writes a row of it.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase, type SqliteDatabase } from '..';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { ERASED_TABLES, KEPT_TABLES, resetDatabase } from './resetDatabase';

const NOW = '2026-10-11T12:00:00.000Z';

/** Every table a migration made, SQLite's own bookkeeping left out. */
function tablesOf(db: SqliteDatabase): string[] {
  return (
    db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
      )
      .all() as Array<{ name: string }>
  ).map((row) => row.name);
}

/** The tables in neither list — what the guard refuses. */
function unlistedTables(db: SqliteDatabase): string[] {
  const listed = new Set<string>([...ERASED_TABLES, ...KEPT_TABLES]);
  return tablesOf(db).filter((table) => !listed.has(table));
}

function countOf(db: SqliteDatabase, table: string): number {
  return (
    db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }
  ).n;
}

function genresOf(db: SqliteDatabase): Array<{ id: string; name: string }> {
  return db.prepare('SELECT id, name FROM genres ORDER BY id').all() as Array<{
    id: string;
    name: string;
  }>;
}

/** A row in every erased table, linked the way the app links them. */
function fill(db: SqliteDatabase, n = 1): void {
  const genre = genresOf(db)[0].id;
  for (let i = 0; i < n; i += 1) {
    const folder = `folder-${i}`;
    db.prepare(
      'INSERT INTO library_folders (id, path, added_at) VALUES (?, ?, ?)'
    ).run(folder, `D:\\Films ${i}`, NOW);
    db.prepare(
      `INSERT INTO movies (id, title, video_path, synopsis, created_at, updated_at, library_folder_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      `movie-${i}`,
      `Film ${i}`,
      `film-${i}/film.mp4`,
      'A long synopsis. '.repeat(40),
      NOW,
      NOW,
      folder
    );
    db.prepare(
      'INSERT INTO movie_genres (movie_id, genre_id, position) VALUES (?, ?, 0)'
    ).run(`movie-${i}`, genre);
    db.prepare(
      'INSERT INTO subtitles (id, movie_id, path, language, position) VALUES (?, ?, ?, ?, 0)'
    ).run(`sub-${i}`, `movie-${i}`, `film-${i}/film.en.srt`, 'en');
    db.prepare(
      'INSERT INTO series (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    ).run(`series-${i}`, `Show ${i}`, NOW, NOW);
    db.prepare(
      'INSERT INTO series_genres (series_id, genre_id, position) VALUES (?, ?, 0)'
    ).run(`series-${i}`, genre);
    db.prepare(
      'INSERT INTO season_posters (series_id, season_number, poster_path) VALUES (?, 1, ?)'
    ).run(`series-${i}`, `show-${i}/S01-poster.jpg`);
    db.prepare(
      `INSERT INTO episodes (id, series_id, season_number, episode_number, video_path, created_at, updated_at)
       VALUES (?, ?, 1, 1, ?, ?, ?)`
    ).run(`episode-${i}`, `series-${i}`, `show-${i}/s01e01.mkv`, NOW, NOW);
    db.prepare(
      'INSERT INTO episode_subtitles (id, episode_id, path, language, position) VALUES (?, ?, ?, ?, 0)'
    ).run(`esub-${i}`, `episode-${i}`, `show-${i}/s01e01.en.srt`, 'en');
    db.prepare(
      'INSERT INTO left_out_videos (library_folder_id, video_path) VALUES (?, ?)'
    ).run(folder, `film-${i}/film.mp4`);
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
      `key-${i}`,
      'value'
    );
  }
}

describe('resetDatabase', () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('spells the two lists, erased child-first and the genre pool kept', () => {
    expect(ERASED_TABLES).toEqual([
      'movie_genres',
      'subtitles',
      'series_genres',
      'season_posters',
      'episode_subtitles',
      'episodes',
      'movies',
      'series',
      'left_out_videos',
      'library_folders',
      'settings',
    ]);
    expect(KEPT_TABLES).toEqual(['genres']);
  });

  it('empties every erased table over a filled database', () => {
    fill(db, 3);
    for (const table of ERASED_TABLES) {
      expect(countOf(db, table)).toBeGreaterThan(0);
    }

    resetDatabase(db);

    for (const table of ERASED_TABLES) {
      expect({ table, rows: countOf(db, table) }).toEqual({ table, rows: 0 });
    }
  });

  // Issue #382: migration #14's `still_source` goes with `episodes`, so the
  // erased list does not change and an episode holding a sourced still is
  // erased with the rest.
  it('erases an episode holding a still and its Still source', () => {
    fill(db);
    db.prepare(
      "UPDATE episodes SET still_path = ?, still_source = 'frame' WHERE id = ?"
    ).run('show-0/season-01/s01e01.frame.jpg', 'episode-0');

    resetDatabase(db);

    expect(countOf(db, 'episodes')).toBe(0);
  });

  it('keeps the twelve genres with the same ids', () => {
    const before = genresOf(db);
    fill(db);

    resetDatabase(db);

    expect(before).toHaveLength(12);
    expect(genresOf(db)).toEqual(before);
  });

  it('erases nothing at all when the last erased table refuses', () => {
    fill(db, 2);
    const last = ERASED_TABLES[ERASED_TABLES.length - 1];
    db.exec(
      `CREATE TRIGGER hold_${last} BEFORE DELETE ON ${last}
       BEGIN SELECT RAISE(ABORT, 'held'); END;`
    );
    const before = tablesOf(db).map((table) => [table, countOf(db, table)]);

    expect(() => resetDatabase(db)).toThrow();

    expect(tablesOf(db).map((table) => [table, countOf(db, table)])).toEqual(
      before
    );
  });

  it('leaves user_version where the migrations put it', () => {
    const version = Number(db.pragma('user_version', { simple: true }));
    fill(db);

    resetDatabase(db);

    expect(Number(db.pragma('user_version', { simple: true }))).toBe(version);
  });

  it('does not VACUUM — the freed pages stay on the free list', () => {
    fill(db, 200);
    expect(Number(db.pragma('freelist_count', { simple: true }))).toBe(0);

    resetDatabase(db);

    expect(
      Number(db.pragma('freelist_count', { simple: true }))
    ).toBeGreaterThan(0);
  });
});

describe('resetDatabase — the table guard', () => {
  let db: SqliteDatabase;

  beforeEach(() => {
    db = openDatabase(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('finds every table of a fully migrated database in one of the two lists', () => {
    expect(unlistedTables(db)).toEqual([]);
  });

  it('names a table a migration adds that neither list holds', () => {
    db.exec('CREATE TABLE collections (id TEXT PRIMARY KEY)');

    expect(unlistedTables(db)).toEqual(['collections']);
  });

  it('lists only tables a migration actually made', () => {
    const tables = new Set(tablesOf(db));
    for (const table of [...ERASED_TABLES, ...KEPT_TABLES]) {
      expect(tables.has(table)).toBe(true);
    }
  });
});

describe('LibraryStorage.reset', () => {
  let storage: LibraryStorage;

  beforeEach(() => {
    storage = createSqliteStorage(':memory:');
  });

  afterEach(() => {
    storage.close();
  });

  it('erases the library through the storage seam, the genre pool kept', () => {
    storage.addMovie(newMovie({ genres: ['Drama'] }));
    storage.addLibraryFolder('D:\\Films');
    storage.setTmdbKey('0123456789abcdef0123456789abcdef');
    const pool = storage.listGenrePool();

    storage.reset();

    expect(storage.countMovies()).toBe(0);
    expect(storage.libraryFolders()).toEqual([]);
    expect(storage.tmdbKey()).toBeNull();
    expect(storage.listGenrePool()).toEqual(pool);
  });
});
