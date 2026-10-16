// @vitest-environment node
//
// Phase 1 — "Database opens, migrates, and seeds" (issue #2).
//
// These tests exercise a REAL in-memory / on-disk SQLite database through the
// `db/` connection + migration layer. Nothing is mocked: the actual pragmas,
// the hand-rolled `PRAGMA user_version` migration runner, the v1 schema, and
// the 12-genre seed are all exercised for real. The repository's movie methods
// do not exist yet this slice, so a fresh DB cannot be inspected through the
// `LibraryStorage` interface (`listGenres()` only returns genres with >= 1
// movie). The verification seam is therefore `openDatabase(dbPath)` from
// `server/src/db`, which returns the migrated raw handle.
//
// 15 — Settings hub, Phase 2: "the Subtitles rows" (issue #144) adds
// migration #3. The household's one preference lives in the library's
// database beside the movies, so it travels with the backup: a `settings`
// table of `key TEXT PRIMARY KEY, value TEXT NOT NULL`, one row today
// (`subtitle-language`). Nothing is seeded — the default is applied by the
// repository when the row is absent, not written down as if someone chose it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { openDatabase } from '.';
import { createSqliteStorage } from '../library';

// The exact 12-genre pool seeded by migration #1 (canonical source:
// docs/handoff/FamilyFlix.dc.html `genrePool`).
const EXPECTED_GENRES = [
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Thriller',
  'Sci-Fi',
  'Romance',
  'Documentary',
  'Animation',
  'Family',
  'Adventure',
  'Crime',
];

// The version a fresh database migrates to — migration #14, an episode's
// **Still source** (issue #382). Every "at the latest version" assertion reads
// it, so the next migration moves one number rather than ten.
const LATEST_VERSION = 14;

// What migration #5 adds, by table: the three columns a Sync writes on a movie
// and a series, and the episode's still. Additive, nullable, nothing seeded.
const MIGRATION_5_COLUMNS = {
  movies: ['original_title', 'tmdb_score', 'source_folder'],
  series: ['original_title', 'tmdb_score', 'source_folder'],
  episodes: ['still_path'],
} as const;

// The four tables migration #4 adds, children first — the order they can be
// dropped in without a foreign key refusing.
const SERIES_TABLES = [
  'episode_subtitles',
  'series_genres',
  'episodes',
  'series',
] as const;

// Minimal structural view of the better-sqlite3 handle the db layer returns.
// Declared locally so the test never imports better-sqlite3 directly and never
// uses `any`.
interface TestDb {
  pragma(source: string, options?: { simple?: boolean }): unknown;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    get(...params: unknown[]): unknown;
    run(...params: unknown[]): unknown;
  };
  close(): void;
}

const open = openDatabase as unknown as (dbPath: string) => TestDb;

// --- per-test resource tracking ------------------------------------------------

const openedDbs: TestDb[] = [];
const openedStorages: Array<{ close(): void }> = [];
let tempDir: string | null = null;

function track(db: TestDb): TestDb {
  openedDbs.push(db);
  return db;
}

/** Track a repository handle (not a raw one) so it is closed with the rest. */
function trackStorage<T extends { close(): void }>(storage: T): T {
  openedStorages.push(storage);
  return storage;
}

/** A throwaway on-disk DB path (needed for WAL + reopen tests; `:memory:`
 *  reports `journal_mode=memory` and cannot be reopened). */
function tempDbPath(): string {
  if (!tempDir) {
    tempDir = mkdtempSync(join(tmpdir(), 'familyflix-db-'));
  }
  return join(tempDir, `lib-${Math.random().toString(36).slice(2)}.db`);
}

beforeEach(() => {
  delete process.env.DEBUG_SQL;
});

afterEach(() => {
  for (const resource of [
    ...openedStorages.splice(0),
    ...openedDbs.splice(0),
  ]) {
    try {
      resource.close();
    } catch {
      // already closed by the test — fine.
    }
  }
  vi.restoreAllMocks();
  delete process.env.DEBUG_SQL;
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

// --- helpers -------------------------------------------------------------------

function userVersion(db: TestDb): number {
  return Number(db.pragma('user_version', { simple: true }));
}

function genreNames(db: TestDb): string[] {
  const rows = db.prepare('SELECT name FROM genres').all() as Array<{
    name: string;
  }>;
  return rows.map((r) => r.name);
}

function tableNames(db: TestDb): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

interface IndexDescriptor {
  columns: string[];
  partial: boolean;
}

/** Explicitly-declared indexes on a table, described by their columns (in
 *  order) and whether they are partial — by shape, not by index name. */
function explicitIndexes(db: TestDb, table: string): IndexDescriptor[] {
  const list = db.pragma(`index_list(${table})`) as Array<{
    name: string;
    origin: string;
    partial: number;
  }>;
  return list
    .filter((idx) => idx.origin === 'c') // 'c' = created via CREATE INDEX
    .map((idx) => {
      const info = db.pragma(`index_info(${idx.name})`) as Array<{
        seqno: number;
        name: string;
      }>;
      const columns = [...info]
        .sort((a, b) => a.seqno - b.seqno)
        .map((c) => c.name);
      return { columns, partial: idx.partial === 1 };
    });
}

/** The declared columns of a table, in declaration order. */
function columnNames(db: TestDb, table: string): string[] {
  const info = db.pragma(`table_info(${table})`) as Array<{
    cid: number;
    name: string;
  }>;
  return [...info].sort((a, b) => a.cid - b.cid).map((column) => column.name);
}

/** The names of every index whose definition mentions `column`. */
function indexesReferencing(db: TestDb, column: string): string[] {
  const rows = db
    .prepare(
      "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL"
    )
    .all() as Array<{ name: string; sql: string }>;
  return rows.filter((row) => row.sql.includes(column)).map((row) => row.name);
}

/**
 * What migration #8 added, dropped: `episodes.source_file`, only where it
 * exists, so every wind-back reads the same before #8 is written as after.
 */
function dropMigration8(db: TestDb): void {
  // Every wind-back to before #8 is also one to before #9.
  dropMigration9(db);
  if (
    tableNames(db).includes('episodes') &&
    columnNames(db, 'episodes').includes('source_file')
  ) {
    db.prepare('ALTER TABLE episodes DROP COLUMN source_file').run();
  }
}

/**
 * What migration #9 added, dropped: `movies.source_file`, only where it
 * exists, so every wind-back reads the same before #9 is written as after.
 */
function dropMigration9(db: TestDb): void {
  // Every wind-back to before #9 is also one to before #10.
  dropMigration10(db);
  if (columnNames(db, 'movies').includes('source_file')) {
    db.prepare('ALTER TABLE movies DROP COLUMN source_file').run();
  }
}

/**
 * What migration #10 added, dropped: the `season_posters` table, only where it
 * exists, so every wind-back reads the same before #10 is written as after.
 */
function dropMigration10(db: TestDb): void {
  // Every wind-back to before #10 is also one to before #11.
  dropMigration11(db);
  db.prepare('DROP TABLE IF EXISTS season_posters').run();
}

/**
 * What migration #11 added, dropped: `media_folder` on movies and series, only
 * where it exists, so every wind-back reads the same before #11 is written as
 * after.
 */
function dropMigration11(db: TestDb): void {
  // Every wind-back to before #11 is also one to before #12.
  dropMigration12(db);
  for (const table of ['movies', 'series']) {
    if (
      tableNames(db).includes(table) &&
      columnNames(db, table).includes('media_folder')
    ) {
      db.prepare(`ALTER TABLE ${table} DROP COLUMN media_folder`).run();
    }
  }
}

/**
 * What migration #12 added, dropped: `video_folder_id` on movies and episodes,
 * only where it exists, so every wind-back reads the same before #12 is
 * written as after.
 */
function dropMigration12(db: TestDb): void {
  // Every wind-back to before #12 is also one to before #14.
  dropMigration14(db);
  for (const table of ['movies', 'episodes']) {
    if (
      tableNames(db).includes(table) &&
      columnNames(db, table).includes('video_folder_id')
    ) {
      db.prepare(`ALTER TABLE ${table} DROP COLUMN video_folder_id`).run();
    }
  }
}

/**
 * What migration #14 added, dropped: `episodes.still_source`, only where it
 * exists, so every wind-back reads the same before #14 is written as after.
 */
function dropMigration14(db: TestDb): void {
  if (
    tableNames(db).includes('episodes') &&
    columnNames(db, 'episodes').includes('still_source')
  ) {
    db.prepare('ALTER TABLE episodes DROP COLUMN still_source').run();
  }
}

/**
 * Leave the database at `path` looking exactly like one written before
 * migration #2 existed: open it (which migrates it to the latest), then undo
 * what #2 added and wind `user_version` back to 1.
 *
 * Un-doing a v2 database rather than importing better-sqlite3 to run
 * `migrations[0].up` by hand keeps this file's rule that the only seam it knows
 * is `openDatabase`. Re-opening the file afterwards is the exact upgrade path a
 * developer's existing dev database takes — and because the version is wound
 * back to 1, not 0, the runner applies only migrations #2 and #3, so anything
 * that reappears demonstrably came from those rather than from `V1_SCHEMA`.
 */
function windBackToV1(path: string): void {
  const db = open(path);
  try {
    dropMigration8(db);
    dropMigration6(db);
    dropMigration5Columns(db);
    dropSeriesTables(db);
    // What #3 added: a v1 database has no settings table.
    db.prepare('DROP TABLE settings').run();
    for (const name of indexesReferencing(db, 'last_watched_at')) {
      db.prepare(`DROP INDEX ${name}`).run();
    }
    db.prepare('ALTER TABLE movies DROP COLUMN last_watched_at').run();
    db.pragma('user_version = 1');
  } finally {
    // Closed even on the way out, so a failure here does not leave a handle
    // open on the temp file and turn one red test into a cascade of EPERMs.
    db.close();
  }
}

/**
 * Leave the database at `path` looking exactly like one written before
 * migration #3 existed: open it (which migrates it to the latest), drop what
 * #3 added and wind `user_version` back to 2. Re-opening it afterwards is the
 * upgrade every dev database from the export slice takes.
 */
function windBackToV2(path: string): void {
  const db = open(path);
  try {
    dropMigration8(db);
    dropMigration6(db);
    dropMigration5Columns(db);
    dropSeriesTables(db);
    db.prepare('DROP TABLE settings').run();
    db.pragma('user_version = 2');
  } finally {
    db.close();
  }
}

/**
 * What migration #4 added, dropped. `IF EXISTS`, so the wind-backs above read
 * the same on a database from before #4 was written as on one after.
 */
function dropSeriesTables(db: TestDb): void {
  for (const table of SERIES_TABLES) {
    db.prepare(`DROP TABLE IF EXISTS ${table}`).run();
  }
}

/**
 * Leave the database at `path` looking exactly like one written before
 * migration #4 existed: drop the series tables and wind `user_version` back to
 * 3. Re-opening it is the upgrade every dev database from the motion slice
 * takes.
 */
function windBackToV3(path: string): void {
  const db = open(path);
  try {
    dropMigration8(db);
    dropMigration6(db);
    dropMigration5Columns(db);
    dropSeriesTables(db);
    db.pragma('user_version = 3');
  } finally {
    db.close();
  }
}

/**
 * What migration #5 added, dropped — each column only where it exists, so the
 * wind-backs read the same on a database from before #5 was written as on one
 * after.
 */
function dropMigration5Columns(db: TestDb): void {
  for (const [table, columns] of Object.entries(MIGRATION_5_COLUMNS)) {
    if (!tableNames(db).includes(table)) {
      continue;
    }
    const present = columnNames(db, table);
    for (const column of columns) {
      if (present.includes(column)) {
        db.prepare(`ALTER TABLE ${table} DROP COLUMN ${column}`).run();
      }
    }
  }
}

/**
 * Leave the database at `path` looking exactly like one written before
 * migration #5 existed: drop its columns and wind `user_version` back to 4.
 * Re-opening it is the upgrade every dev database from the series slice takes.
 */
function windBackToV4(path: string): void {
  const db = open(path);
  try {
    dropMigration8(db);
    dropMigration6(db);
    dropMigration5Columns(db);
    db.pragma('user_version = 4');
  } finally {
    db.close();
  }
}

/**
 * What migration #6 added, dropped: the two `library_folder_id` columns, then
 * the table they reference. Each only where it exists, so every wind-back
 * reads the same before #6 is written as after.
 */
function dropMigration6(db: TestDb): void {
  for (const table of ['movies', 'series']) {
    if (
      tableNames(db).includes(table) &&
      columnNames(db, table).includes('library_folder_id')
    ) {
      db.prepare(`ALTER TABLE ${table} DROP COLUMN library_folder_id`).run();
    }
  }
  db.prepare('DROP TABLE IF EXISTS library_folders').run();
}

/**
 * Leave the database at `path` looking exactly like one written before
 * migration #6 existed: drop what it added and wind `user_version` back to 5.
 * Re-opening it is the upgrade every installed library from v0.2 takes.
 */
function windBackToV5(path: string): void {
  const db = open(path);
  try {
    dropMigration8(db);
    dropMigration6(db);
    db.pragma('user_version = 5');
  } finally {
    db.close();
  }
}

/** A table's columns less what migrations #5 onwards added — the v4 shape. */
function v4Columns(db: TestDb, table: keyof typeof MIGRATION_5_COLUMNS) {
  const added: readonly string[] = [
    ...MIGRATION_5_COLUMNS[table],
    'library_folder_id',
    'source_file',
    'media_folder',
    'video_folder_id',
    'still_source',
  ];
  return columnNames(db, table).filter((column) => !added.includes(column));
}

/** One table's declared columns as `table_info` reports them. */
function columnInfo(
  db: TestDb,
  table: string
): Array<{ name: string; type: string; notnull: number; pk: number }> {
  return db.pragma(`table_info(${table})`) as Array<{
    name: string;
    type: string;
    notnull: number;
    pk: number;
  }>;
}

// --- tests ---------------------------------------------------------------------

describe('db: connection pragmas', () => {
  it('opens with foreign_keys ON, WAL journal mode, and a busy_timeout', () => {
    const db = track(open(tempDbPath()));

    expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    expect(
      String(db.pragma('journal_mode', { simple: true })).toLowerCase()
    ).toBe('wal');
    expect(Number(db.pragma('busy_timeout', { simple: true }))).toBeGreaterThan(
      0
    );
  });
});

describe('db: migration runner', () => {
  it('migrates a fresh :memory: database to the latest user_version', () => {
    const db = track(open(':memory:'));
    expect(userVersion(db)).toBe(LATEST_VERSION);
  });

  it('seeds exactly the 12 canonical genres', () => {
    const db = track(open(':memory:'));
    const names = genreNames(db);

    expect(names).toHaveLength(12);
    expect([...names].sort()).toEqual([...EXPECTED_GENRES].sort());
  });

  it('re-running migrations on a current database is a no-op', () => {
    const path = tempDbPath();

    const first = track(open(path));
    expect(userVersion(first)).toBe(LATEST_VERSION);
    first.close();

    // Re-opening the same file runs the migration runner again; it must detect
    // the DB is already current and apply nothing.
    const second = track(open(path));
    expect(userVersion(second)).toBe(LATEST_VERSION);

    const names = genreNames(second);
    expect(names).toHaveLength(12);
    expect(new Set(names).size).toBe(12); // no duplicate seeds
  });
});

describe('db: v1 schema', () => {
  it('creates all four tables', () => {
    const db = track(open(':memory:'));
    const tables = tableNames(db);

    for (const table of ['movies', 'genres', 'movie_genres', 'subtitles']) {
      expect(tables).toContain(table);
    }
  });

  it('creates the declared indexes on movies', () => {
    const db = track(open(':memory:'));
    const firstColumns = explicitIndexes(db, 'movies').map((i) => i.columns[0]);

    for (const column of ['title', 'year', 'created_at', 'rating', 'tmdb_id']) {
      expect(firstColumns).toContain(column);
    }
  });

  it('creates a PARTIAL index on movies(is_favorite)', () => {
    const db = track(open(':memory:'));
    const favoriteIndex = explicitIndexes(db, 'movies').find(
      (i) => i.columns.includes('is_favorite') && i.partial
    );

    expect(favoriteIndex).toBeDefined();
  });

  it('creates the genre-link and subtitle child indexes', () => {
    const db = track(open(':memory:'));

    const genreLink = explicitIndexes(db, 'movie_genres').map(
      (i) => i.columns[0]
    );
    expect(genreLink).toContain('genre_id');

    const subtitleLink = explicitIndexes(db, 'subtitles').map(
      (i) => i.columns[0]
    );
    expect(subtitleLink).toContain('movie_id');
  });
});

describe('db: migration #2 — last_watched_at', () => {
  it('adds a nullable last_watched_at column to movies', () => {
    const db = track(open(':memory:'));

    expect(columnNames(db, 'movies')).toContain('last_watched_at');
  });

  it('creates a PARTIAL index on movies(last_watched_at)', () => {
    // Same shape as idx_movies_is_favorite: only the rows that have a value are
    // indexed, so ordering the resume shelf stays cheap as the library grows.
    const db = track(open(':memory:'));
    const stampIndex = explicitIndexes(db, 'movies').find(
      (i) => i.columns.includes('last_watched_at') && i.partial
    );

    expect(stampIndex).toBeDefined();
  });

  it('is a migration of its own — a fresh database reaching the latest version proves V1_SCHEMA never declared the column', () => {
    // If the column were added to V1_SCHEMA instead, migration #2's
    // `ALTER TABLE ... ADD COLUMN` would fail as a duplicate on every fresh
    // database and the runner would leave the version at 1.
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBeGreaterThanOrEqual(2);
    expect(columnNames(db, 'movies')).toContain('last_watched_at');
  });

  it('upgrades a database already at version 1 in place, keeping its rows', () => {
    const path = tempDbPath();

    const before = trackStorage(createSqliteStorage(path));
    const added = before.addMovie({
      title: 'Northwind',
      videoPath: 'Northwind (2018)/northwind.mkv',
      genres: ['Action'],
    });
    before.close();
    windBackToV1(path);

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(columnNames(upgraded, 'movies')).toContain('last_watched_at');
    // Migration #1 is skipped rather than re-run: the genre pool is seeded once.
    expect(genreNames(upgraded)).toHaveLength(12);
    upgraded.close();

    const storage = trackStorage(createSqliteStorage(path));
    const movie = storage.getMovie(added.id);
    expect(movie?.title).toBe('Northwind');
    expect(movie?.genres.map((g) => g.name)).toEqual(['Action']);
  });

  it('backfills nothing — every pre-existing row reads back as never watched', () => {
    const path = tempDbPath();

    const before = trackStorage(createSqliteStorage(path));
    // A movie edited long after it was added: `updated_at` moves, which is
    // exactly the value a backfill would be tempted to borrow.
    const added = before.addMovie({
      title: 'Ironclad Sky',
      videoPath: 'Ironclad Sky (2021)/ironclad-sky.mkv',
    });
    before.updateMovie(added.id, { title: 'Ironclad Sky (Remastered)' });
    before.close();
    windBackToV1(path);

    const storage = trackStorage(createSqliteStorage(path));

    expect(storage.getMovie(added.id)?.lastWatchedAt).toBeNull();
    expect(
      storage.listMovies({ sort: 'a-z' }).map((m) => m.lastWatchedAt)
    ).toEqual([null]);
  });
});

describe('db: migration #3 — settings', () => {
  it('creates the settings table', () => {
    const db = track(open(':memory:'));

    expect(tableNames(db)).toContain('settings');
  });

  it('keys the table on a TEXT primary key with a TEXT value that cannot be null', () => {
    const db = track(open(':memory:'));
    const columns = columnInfo(db, 'settings');

    expect(columns.map((column) => column.name)).toEqual(['key', 'value']);
    expect(columns.find((column) => column.name === 'key')).toMatchObject({
      type: 'TEXT',
      pk: 1,
    });
    expect(columns.find((column) => column.name === 'value')).toMatchObject({
      type: 'TEXT',
      notnull: 1,
      pk: 0,
    });
  });

  it('seeds no row — a fresh table is empty', () => {
    const db = track(open(':memory:'));
    const rows = db.prepare('SELECT key, value FROM settings').all();

    expect(rows).toEqual([]);
  });

  it('is a migration of its own — a fresh database lands at the latest version', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBe(LATEST_VERSION);
    expect(tableNames(db)).toContain('settings');
  });

  it('upgrades a database already at version 2 in place, keeping its rows', () => {
    const path = tempDbPath();

    const before = trackStorage(createSqliteStorage(path));
    const added = before.addMovie({
      title: 'Northwind',
      videoPath: 'Northwind (2018)/northwind.mkv',
      genres: ['Drama'],
    });
    before.markWatched(added.id);
    before.close();
    windBackToV2(path);

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(tableNames(upgraded)).toContain('settings');
    // Migrations #1 and #2 are skipped rather than re-run: the pool is seeded
    // once and the stamp column is added once.
    expect(genreNames(upgraded)).toHaveLength(12);
    expect(columnNames(upgraded, 'movies')).toContain('last_watched_at');
    upgraded.close();

    const storage = trackStorage(createSqliteStorage(path));
    const movie = storage.getMovie(added.id);
    expect(movie?.title).toBe('Northwind');
    expect(movie?.status).toBe('watched');
    expect(movie?.lastWatchedAt).not.toBeNull();
  });

  it('refuses a second row under the same key — the shape an upsert relies on', () => {
    const db = track(open(':memory:'));
    const insert = db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?)'
    );
    insert.run('subtitle-language', 'English');

    expect(() => insert.run('subtitle-language', 'Spanish')).toThrow();
  });

  it('refuses a null value', () => {
    const db = track(open(':memory:'));

    expect(() =>
      db
        .prepare('INSERT INTO settings (key, value) VALUES (?, ?)')
        .run('subtitle-language', null)
    ).toThrow(/NOT NULL/);
  });
});

// 22 — Series (TV), Phase 1 (issue #189) adds migration #4: a `series`, its
// `episodes` carrying the movie's watch trio exactly, and the two children
// that mirror the movie's — `series_genres` and `episode_subtitles`. There is
// no `seasons` table: a season is `season_number` on its episodes. `movies`
// is not touched, which is the proof the whole initiative is additive.

/** The columns `movies` had before migration #4 — V1_SCHEMA plus #2's stamp. */
const MOVIE_COLUMNS = [
  'id',
  'tmdb_id',
  'title',
  'year',
  'runtime_minutes',
  'synopsis',
  'director',
  'cast',
  'rating',
  'is_favorite',
  'watched',
  'resume_position_seconds',
  'video_path',
  'poster_path',
  'backdrop_path',
  'created_at',
  'updated_at',
  'last_watched_at',
];

const NOW = '2026-09-23T12:00:00.000Z';

/** A series row with every NOT NULL column the test does not care about. */
function insertSeries(db: TestDb, id: string, rating: number | null = null) {
  db.prepare(
    'INSERT INTO series (id, title, rating, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, `Series ${id}`, rating, NOW, NOW);
}

/** An episode row of `seriesId`, numbered. */
function insertEpisode(
  db: TestDb,
  id: string,
  seriesId: string,
  season: number,
  episode: number
) {
  db.prepare(
    `INSERT INTO episodes
       (id, series_id, season_number, episode_number, video_path, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, seriesId, season, episode, `s/${id}.mkv`, NOW, NOW);
}

describe('db: migration #4 — series', () => {
  it('creates the series, episodes, series_genres and episode_subtitles tables', () => {
    const db = track(open(':memory:'));

    expect(tableNames(db)).toEqual(expect.arrayContaining([...SERIES_TABLES]));
  });

  it('creates no seasons table — a season is a number on its episodes', () => {
    const db = track(open(':memory:'));

    expect(tableNames(db)).not.toContain('seasons');
  });

  it('gives series its columns, and no watch columns', () => {
    const db = track(open(':memory:'));

    expect([...v4Columns(db, 'series')].sort()).toEqual(
      [
        'id',
        'tmdb_id',
        'title',
        'year',
        'end_year',
        'synopsis',
        'creator',
        'cast',
        'rating',
        'is_favorite',
        'poster_path',
        'backdrop_path',
        'created_at',
        'updated_at',
      ].sort()
    );
  });

  it('gives episodes the movie’s watch trio', () => {
    const db = track(open(':memory:'));

    expect([...v4Columns(db, 'episodes')].sort()).toEqual(
      [
        'id',
        'series_id',
        'season_number',
        'episode_number',
        'title',
        'air_date',
        'runtime_minutes',
        'watched',
        'resume_position_seconds',
        'last_watched_at',
        'video_path',
        'created_at',
        'updated_at',
      ].sort()
    );
  });

  it('mirrors the movie’s children in series_genres and episode_subtitles', () => {
    const db = track(open(':memory:'));

    expect([...columnNames(db, 'series_genres')].sort()).toEqual(
      ['series_id', 'genre_id', 'position'].sort()
    );
    expect([...columnNames(db, 'episode_subtitles')].sort()).toEqual(
      ['id', 'episode_id', 'path', 'language', 'position'].sort()
    );
  });

  it('holds a series rating to the movie’s 0–10', () => {
    const db = track(open(':memory:'));

    insertSeries(db, 'rated', 10);
    expect(() => insertSeries(db, 'over', 11)).toThrow(/CHECK/);
  });

  it('refuses a second episode under one series, season and number', () => {
    const db = track(open(':memory:'));
    insertSeries(db, 'a');
    insertEpisode(db, 'e1', 'a', 1, 3);

    expect(() => insertEpisode(db, 'e2', 'a', 1, 3)).toThrow(/UNIQUE/);
    // The same number in another season, or another series, is its own.
    insertSeries(db, 'b');
    insertEpisode(db, 'e3', 'a', 2, 3);
    insertEpisode(db, 'e4', 'b', 1, 3);
  });

  it('starts an episode unwatched at zero, never watched', () => {
    const db = track(open(':memory:'));
    insertSeries(db, 'a');
    insertEpisode(db, 'e1', 'a', 1, 1);

    expect(
      db
        .prepare(
          'SELECT watched, resume_position_seconds, last_watched_at FROM episodes'
        )
        .get()
    ).toEqual({
      watched: 0,
      resume_position_seconds: 0,
      last_watched_at: null,
    });
  });

  it('takes a series’ episodes and their subtitles with it when it goes', () => {
    const db = track(open(':memory:'));
    insertSeries(db, 'a');
    insertEpisode(db, 'e1', 'a', 1, 1);
    db.prepare(
      'INSERT INTO episode_subtitles (id, episode_id, path, language, position) VALUES (?, ?, ?, ?, ?)'
    ).run('t1', 'e1', 's/e1.en.srt', 'English', 0);

    db.prepare('DELETE FROM series WHERE id = ?').run('a');

    expect(db.prepare('SELECT id FROM episodes').all()).toEqual([]);
    expect(db.prepare('SELECT id FROM episode_subtitles').all()).toEqual([]);
  });

  it('leaves movies exactly as it was', () => {
    const db = track(open(':memory:'));

    expect(v4Columns(db, 'movies')).toEqual(MOVIE_COLUMNS);
  });

  it('lands a fresh database at version 4 or later', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBeGreaterThanOrEqual(4);
  });

  it('upgrades a database already at version 3 in place, keeping its rows', () => {
    const path = tempDbPath();

    const before = trackStorage(createSqliteStorage(path));
    const added = before.addMovie({
      title: 'Northwind',
      videoPath: 'Northwind (2018)/northwind.mkv',
      genres: ['Drama'],
    });
    before.markWatched(added.id);
    before.setSubtitleLanguage('Spanish');
    before.close();
    windBackToV3(path);

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(tableNames(upgraded)).toEqual(
      expect.arrayContaining([...SERIES_TABLES])
    );
    expect(genreNames(upgraded)).toHaveLength(12);
    expect(v4Columns(upgraded, 'movies')).toEqual(MOVIE_COLUMNS);
    upgraded.close();

    const storage = trackStorage(createSqliteStorage(path));
    const movie = storage.getMovie(added.id);
    expect(movie?.title).toBe('Northwind');
    expect(movie?.status).toBe('watched');
    expect(storage.settings().subtitleLanguage).toBe('Spanish');
  });
});

// 23 — Enrichment, Phase 2: "the tracer — Just this movie" (issue #204) adds
// migration #5: what a **Sync** writes and where a title came from —
// `original_title`, `tmdb_score` and `source_folder` on `movies` and on
// `series`, and `still_path` on `episodes`. Additive and nullable: nothing is
// seeded and nothing is backfilled, so every title a library already holds
// reads back with none of them until a Sync or an import says otherwise.

describe('db: migration #5 — enrichment columns', () => {
  it.each(Object.entries(MIGRATION_5_COLUMNS))(
    'adds its nullable columns to %s',
    (table, columns) => {
      const db = track(open(':memory:'));

      const info = columnInfo(db, table);
      for (const column of columns) {
        const declared = info.find((c) => c.name === column);
        expect(declared, `${table}.${column}`).toBeDefined();
        expect(declared?.notnull).toBe(0);
      }
    }
  );

  it('types the score as REAL and the rest as TEXT', () => {
    const db = track(open(':memory:'));

    for (const table of ['movies', 'series'] as const) {
      const info = columnInfo(db, table);
      const typeOf = (name: string) =>
        info.find((c) => c.name === name)?.type.toUpperCase();
      expect(typeOf('original_title')).toBe('TEXT');
      expect(typeOf('tmdb_score')).toBe('REAL');
      expect(typeOf('source_folder')).toBe('TEXT');
    }
    expect(
      columnInfo(db, 'episodes')
        .find((c) => c.name === 'still_path')
        ?.type.toUpperCase()
    ).toBe('TEXT');
  });

  it('lands a fresh database at the latest version', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBe(LATEST_VERSION);
  });

  it('seeds nothing — a fresh database still holds no movies and no series', () => {
    const db = track(open(':memory:'));

    expect(db.prepare('SELECT id FROM movies').all()).toEqual([]);
    expect(db.prepare('SELECT id FROM series').all()).toEqual([]);
    expect(genreNames(db)).toHaveLength(12);
  });

  it('upgrades a database already at version 4 in place, keeping its rows', () => {
    const path = tempDbPath();

    const before = trackStorage(createSqliteStorage(path));
    const added = before.addMovie({
      title: 'Northwind',
      year: 2018,
      videoPath: 'Northwind (2018)/northwind.mkv',
      synopsis: 'Ours.',
      genres: ['Drama'],
    });
    before.setRating(added.id, 7);
    before.close();
    windBackToV4(path);

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    for (const [table, columns] of Object.entries(MIGRATION_5_COLUMNS)) {
      expect(columnNames(upgraded, table)).toEqual(
        expect.arrayContaining([...columns])
      );
    }
    expect(genreNames(upgraded)).toHaveLength(12);
    upgraded.close();

    const storage = trackStorage(createSqliteStorage(path));
    const movie = storage.getMovie(added.id);
    expect(movie?.title).toBe('Northwind');
    expect(movie?.synopsis).toBe('Ours.');
    expect(movie?.rating).toBe(7);
  });

  it('backfills nothing — a title from before reads back with none of them', () => {
    const path = tempDbPath();

    const before = trackStorage(createSqliteStorage(path));
    const added = before.addMovie({
      title: 'Northwind',
      videoPath: 'Northwind (2018)/northwind.mkv',
    });
    before.close();
    windBackToV4(path);

    const upgraded = track(open(path));
    expect(
      upgraded
        .prepare(
          'SELECT original_title, tmdb_score, source_folder FROM movies WHERE id = ?'
        )
        .get(added.id)
    ).toEqual({ original_title: null, tmdb_score: null, source_folder: null });
    upgraded.close();

    const storage = trackStorage(createSqliteStorage(path));
    const movie = storage.getMovie(added.id);
    expect(movie?.originalTitle).toBeNull();
    expect(movie?.tmdbScore).toBeNull();
  });
});

// 30 — Library folders, Phase 1 (issue #268) adds migration #6: the list of
// **Library folders** — `library_folders (id, path, added_at)` — and a
// `library_folder_id` on `movies` and `series` that a folder's removal sets to
// null. It inserts no folder: the carry-over of `library-root` is #7's.

describe('db: migration #6 — library folders', () => {
  it('creates the library_folders table with its three columns', () => {
    const db = track(open(':memory:'));

    expect(tableNames(db)).toContain('library_folders');
    const info = columnInfo(db, 'library_folders');
    const column = (name: string) => info.find((c) => c.name === name);
    expect(info.map((c) => c.name)).toEqual(['id', 'path', 'added_at']);
    expect(column('id')?.pk).toBe(1);
    expect(column('path')?.notnull).toBe(1);
    expect(column('added_at')?.notnull).toBe(1);
  });

  it('refuses a second folder under the same path', () => {
    const db = track(open(':memory:'));
    const insert = db.prepare(
      'INSERT INTO library_folders (id, path, added_at) VALUES (?, ?, ?)'
    );
    insert.run('a', 'E:\\Movies', '2026-10-08T00:00:00.000Z');

    expect(() =>
      insert.run('b', 'E:\\Movies', '2026-10-08T00:00:01.000Z')
    ).toThrow();
  });

  it.each(['movies', 'series'])(
    'adds a nullable library_folder_id to %s, set to null when its folder goes',
    (table) => {
      const db = track(open(':memory:'));

      const declared = columnInfo(db, table).find(
        (c) => c.name === 'library_folder_id'
      );
      expect(declared?.notnull).toBe(0);
      const keys = db.pragma(`foreign_key_list(${table})`) as Array<{
        table: string;
        from: string;
        to: string;
        on_delete: string;
      }>;
      expect(keys).toContainEqual(
        expect.objectContaining({
          table: 'library_folders',
          from: 'library_folder_id',
          to: 'id',
          on_delete: 'SET NULL',
        })
      );
    }
  );

  it('lands a fresh database at version 6 holding no folder', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBeGreaterThanOrEqual(6);
    expect(db.prepare('SELECT id FROM library_folders').all()).toEqual([]);
  });

  it('upgrades a version-5 database in place: no folder, its titles unchanged', () => {
    const path = tempDbPath();

    const before = trackStorage(createSqliteStorage(path));
    const added = before.addMovie({
      title: 'Northwind',
      year: 2018,
      videoPath: 'Northwind (2018)/northwind.mkv',
      synopsis: 'Ours.',
      genres: ['Drama'],
    });
    before.setRating(added.id, 7);
    before.close();
    windBackToV5(path);

    const before5 = track(open(path));
    const rowBefore = before5
      .prepare('SELECT * FROM movies WHERE id = ?')
      .get(added.id);
    before5.close();

    const upgraded = track(open(path));
    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(tableNames(upgraded)).toContain('library_folders');
    expect(columnNames(upgraded, 'movies')).toContain('library_folder_id');
    expect(columnNames(upgraded, 'series')).toContain('library_folder_id');
    expect(upgraded.prepare('SELECT id FROM library_folders').all()).toEqual(
      []
    );
    expect(
      upgraded.prepare('SELECT * FROM movies WHERE id = ?').get(added.id)
    ).toEqual({ ...(rowBefore as object), library_folder_id: null });
  });
});

// 30 — Library folders, Phase 4 (issue #271) adds migration #7: the
// carry-over. A library an earlier import remembered a single root for —
// `settings.library-root` — gains that root as a **Library folder**, unless it
// is already listed (Phase 3's spreadsheet start lists its root), and every
// movie and series with a `source_folder` is linked to it. Then the key goes:
// one place remembers folders.

const ROOT_KEY = 'library-root';

/**
 * A version-6 library at `path`, as v0.3 left it: a movie and a series an
 * import recorded a Source folder for, a movie added by hand with none, and —
 * when `root` is given — the remembered root under `library-root`. Answers the
 * ids by role.
 */
function versionSixLibrary(
  path: string,
  { root, listed = false }: { root: string | null; listed?: boolean }
) {
  const storage = trackStorage(createSqliteStorage(path));
  const imported = storage.addMovie({
    title: 'Northwind',
    year: 2018,
    videoPath: 'Northwind (2018)/northwind.mkv',
  }).id;
  const byHand = storage.addMovie({
    title: 'Sundial',
    videoPath: 'Sundial/sundial.mkv',
  }).id;
  const show = storage.addSeries({ title: 'Harbor & Vine' }).id;
  const listedId =
    listed && root !== null ? storage.addLibraryFolder(root).id : null;
  storage.close();

  const db = open(path);
  try {
    dropMigration8(db);
    db.prepare('UPDATE movies SET source_folder = ? WHERE id = ?').run(
      'Northwind (2018)',
      imported
    );
    db.prepare('UPDATE series SET source_folder = ? WHERE id = ?').run(
      'Harbor & Vine',
      show
    );
    if (root !== null) {
      db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
        ROOT_KEY,
        root
      );
    }
    db.pragma('user_version = 6');
  } finally {
    db.close();
  }
  return { imported, byHand, show, listedId };
}

const folderOf = (db: TestDb, table: 'movies' | 'series', id: string) =>
  (
    db
      .prepare(`SELECT library_folder_id FROM ${table} WHERE id = ?`)
      .get(id) as { library_folder_id: string | null }
  ).library_folder_id;

const listedFolders = (db: TestDb) =>
  db.prepare('SELECT id, path FROM library_folders').all() as Array<{
    id: string;
    path: string;
  }>;

const rootKeyRow = (db: TestDb) =>
  db.prepare('SELECT value FROM settings WHERE key = ?').get(ROOT_KEY);

describe('db: migration #7 — library-root carried over', () => {
  it('lands a fresh database at the latest version', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBe(LATEST_VERSION);
  });

  it('lists the remembered root as the one folder, links exactly the titles with a source folder, and drops the key', () => {
    const path = tempDbPath();
    const root = join(tmpdir(), 'familyflix-carried-root');
    const { imported, byHand, show } = versionSixLibrary(path, { root });

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    const folders = listedFolders(upgraded);
    expect(folders.map((folder) => folder.path)).toEqual([root]);
    const [folder] = folders;
    expect(folderOf(upgraded, 'movies', imported)).toBe(folder.id);
    expect(folderOf(upgraded, 'series', show)).toBe(folder.id);
    expect(folderOf(upgraded, 'movies', byHand)).toBeNull();
    expect(rootKeyRow(upgraded)).toBeUndefined();
  });

  it('does not list a root twice that is already a library folder', () => {
    const path = tempDbPath();
    const root = join(tmpdir(), 'familyflix-carried-root');
    const { imported, show, listedId } = versionSixLibrary(path, {
      root,
      listed: true,
    });

    const upgraded = track(open(path));

    expect(listedFolders(upgraded)).toEqual([{ id: listedId, path: root }]);
    expect(folderOf(upgraded, 'movies', imported)).toBe(listedId);
    expect(folderOf(upgraded, 'series', show)).toBe(listedId);
    expect(rootKeyRow(upgraded)).toBeUndefined();
  });

  it('lists nothing and links nothing with no root remembered', () => {
    const path = tempDbPath();
    const { imported, show } = versionSixLibrary(path, { root: null });

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(listedFolders(upgraded)).toEqual([]);
    expect(folderOf(upgraded, 'movies', imported)).toBeNull();
    expect(folderOf(upgraded, 'series', show)).toBeNull();
  });
});

// 38 — Title editing, Slice 5 (issue #308) adds migration #8: an episode's
// **Source file** — `episodes.source_file`, the video's path relative to its
// series' **Source folder**, with forward slashes. Additive and nullable:
// nothing is backfilled, so every episode a library already holds reads back
// with none until a scan or a Resolve records one.

describe('db: migration #8 — an episode’s Source file', () => {
  it('adds a nullable TEXT source_file to episodes', () => {
    const db = track(open(':memory:'));

    const declared = columnInfo(db, 'episodes').find(
      (c) => c.name === 'source_file'
    );
    expect(declared).toBeDefined();
    expect(declared?.type.toUpperCase()).toBe('TEXT');
    expect(declared?.notnull).toBe(0);
  });

  it('lands a fresh database at version 8 or later', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBeGreaterThanOrEqual(8);
  });

  it('upgrades a version-7 library in place, its episodes kept with no Source file', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    const series = before.addSeries({ title: 'Harbor & Vine' }, [
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: 'harbor-vine/season-01/S01E01.mp4',
      },
    ]);
    before.close();
    const db = open(path);
    try {
      dropMigration8(db);
      db.pragma('user_version = 7');
    } finally {
      db.close();
    }

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(
      upgraded
        .prepare('SELECT title, source_file FROM episodes WHERE series_id = ?')
        .all(series.id)
    ).toEqual([{ title: 'Pilot', source_file: null }]);
  });
});

// "A collection film's poster is named after its video" (issue #316) adds
// migration #9: a **Collection folder** film's **Source file** —
// `movies.source_file`, the video's path relative to its **Source folder**.
// Additive and nullable: a film in a folder of its own never has one, and
// nothing is backfilled.

describe('db: migration #9 — a collection film’s Source file', () => {
  it('adds a nullable TEXT source_file to movies', () => {
    const db = track(open(':memory:'));

    const declared = columnInfo(db, 'movies').find(
      (c) => c.name === 'source_file'
    );
    expect(declared).toBeDefined();
    expect(declared?.type.toUpperCase()).toBe('TEXT');
    expect(declared?.notnull).toBe(0);
  });

  it('lands a fresh database at version 9 or later', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBeGreaterThanOrEqual(9);
  });

  it('upgrades a version-8 library in place, its films kept with no Source file', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    const movie = before.addMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'heat-1995/video.mp4',
    });
    before.close();
    const db = open(path);
    try {
      dropMigration9(db);
      db.pragma('user_version = 8');
    } finally {
      db.close();
    }

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(
      upgraded
        .prepare('SELECT title, source_file FROM movies WHERE id = ?')
        .all(movie.id)
    ).toEqual([{ title: 'Heat', source_file: null }]);
  });
});

// 39 — Season posters, Slice 2 (issue #322) adds migration #10: the **Season
// poster** — `season_posters`, one row per season that has a poster, keyed on
// `(series_id, season_number)`, cascading away with its series. No `seasons`
// table: a season stays a number. Nothing is backfilled.

describe('db: migration #10 — season posters', () => {
  it('adds season_posters keyed on (series_id, season_number), every column not null', () => {
    const db = track(open(':memory:'));

    const columns = columnInfo(db, 'season_posters');
    expect(columns.map((c) => c.name).sort()).toEqual([
      'poster_path',
      'season_number',
      'series_id',
    ]);
    for (const column of columns) {
      expect(column.notnull).toBe(1);
    }
    const key = db.pragma('table_info(season_posters)') as Array<{
      name: string;
      pk: number;
    }>;
    expect(
      key
        .filter((c) => c.pk > 0)
        .sort((a, b) => a.pk - b.pk)
        .map((c) => c.name)
    ).toEqual(['series_id', 'season_number']);
  });

  it('references series, cascading on delete', () => {
    const db = track(open(':memory:'));

    const keys = db.pragma('foreign_key_list(season_posters)') as Array<{
      table: string;
      from: string;
      to: string;
      on_delete: string;
    }>;
    expect(keys).toEqual([
      expect.objectContaining({
        table: 'series',
        from: 'series_id',
        on_delete: 'CASCADE',
      }),
    ]);
  });

  it('lands a fresh database at version 10, with no season poster', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBeGreaterThanOrEqual(10);
    expect(db.prepare('SELECT * FROM season_posters').all()).toEqual([]);
  });

  it('upgrades a version-9 library in place, every row kept and none added', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    const movie = before.addMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'heat-1995/video.mp4',
    });
    const series = before.addSeries({ title: 'Harbor & Vine' }, [
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: 'harbor-vine/season-01/S01E01.mp4',
      },
    ]);
    before.close();
    const db = open(path);
    try {
      dropMigration10(db);
      db.pragma('user_version = 9');
    } finally {
      db.close();
    }

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(
      upgraded.prepare('SELECT title FROM movies WHERE id = ?').all(movie.id)
    ).toEqual([{ title: 'Heat' }]);
    expect(
      upgraded
        .prepare('SELECT title FROM episodes WHERE series_id = ?')
        .all(series.id)
    ).toEqual([{ title: 'Pilot' }]);
    expect(upgraded.prepare('SELECT * FROM season_posters').all()).toEqual([]);
  });
});

// 41 — Link or copy, Slice 2 (issue #341) adds migration #11: the **Media
// folder** — `media_folder` on `movies` and `series`, the title's **Movie
// folder** or **Series folder** relative to the **Managed media directory**.
// It is backfilled: a film's from its video's directory, a series' from any
// episode's path two directories up, the `__seed__/series/` prefix included.
// A series with no episodes has no video to read it off, so it is read off its
// poster, which sits in the Series folder — and with neither, it is `NULL`
// rather than a guess.

describe('db: migration #11 — the Media folder', () => {
  it('adds a nullable TEXT media_folder to movies and to series', () => {
    const db = track(open(':memory:'));

    for (const table of ['movies', 'series']) {
      const declared = columnInfo(db, table).find(
        (c) => c.name === 'media_folder'
      );
      expect(declared).toBeDefined();
      expect(declared?.type.toUpperCase()).toBe('TEXT');
      expect(declared?.notnull).toBe(0);
    }
  });

  it('lands a fresh database at version 11 or later', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBeGreaterThanOrEqual(11);
  });

  /** A library written at the latest version, then wound back to before #11. */
  function windBackToV10(path: string): void {
    const db = open(path);
    try {
      dropMigration11(db);
      db.pragma('user_version = 10');
    } finally {
      db.close();
    }
  }

  const mediaFolders = (db: TestDb, table: 'movies' | 'series') =>
    db.prepare(`SELECT title, media_folder FROM ${table} ORDER BY title`).all();

  it('backfills a film’s Media folder from its video’s directory', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    before.addMovie({
      title: 'Heat',
      year: 1995,
      videoPath: 'heat-1995/video.mp4',
      posterPath: 'heat-1995/poster.jpg',
    });
    before.close();
    windBackToV10(path);

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(mediaFolders(upgraded, 'movies')).toEqual([
      { title: 'Heat', media_folder: 'heat-1995' },
    ]);
  });

  it('backfills a series’ Media folder from an episode’s path two directories up', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    before.addSeries({ title: 'Harbor & Vine' }, [
      {
        season: 1,
        number: 1,
        title: 'Pilot',
        videoPath: 'harbor-vine-2019/season-01/S01E01.mp4',
      },
      {
        season: 2,
        number: 1,
        title: 'Spring Tide',
        videoPath: 'harbor-vine-2019/season-02/S02E01.mp4',
      },
    ]);
    before.close();
    windBackToV10(path);

    const upgraded = track(open(path));

    expect(mediaFolders(upgraded, 'series')).toEqual([
      { title: 'Harbor & Vine', media_folder: 'harbor-vine-2019' },
    ]);
  });

  it('backfills a seeded series with its __seed__/series/ prefix', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    before.addSeries({ title: 'The Hollow Coast' }, [
      {
        season: 1,
        number: 1,
        videoPath: '__seed__/series/the-hollow-coast/season-01/S01E01.mp4',
      },
    ]);
    before.close();
    windBackToV10(path);

    const upgraded = track(open(path));

    expect(mediaFolders(upgraded, 'series')).toEqual([
      {
        title: 'The Hollow Coast',
        media_folder: '__seed__/series/the-hollow-coast',
      },
    ]);
  });

  it('records a series with no episodes off its poster, and one with neither as NULL', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    before.addSeries({
      title: 'Aftermath',
      posterPath: 'aftermath-2021/poster.jpg',
    });
    before.addSeries({ title: 'Bare' });
    before.close();
    windBackToV10(path);

    const upgraded = track(open(path));

    expect(mediaFolders(upgraded, 'series')).toEqual([
      { title: 'Aftermath', media_folder: 'aftermath-2021' },
      { title: 'Bare', media_folder: null },
    ]);
  });

  it('reads the backfilled folder back through storage.mediaFolderOf', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    const movie = before.addMovie({
      title: 'Heat',
      videoPath: 'heat-1995/video.mp4',
    });
    const series = before.addSeries({ title: 'Harbor & Vine' }, [
      {
        season: 1,
        number: 1,
        videoPath: 'harbor-vine-2019/season-01/S01E01.mp4',
      },
    ]);
    before.close();
    windBackToV10(path);

    const upgraded = trackStorage(createSqliteStorage(path));

    expect(upgraded.mediaFolderOf('movie', movie.id)).toBe('heat-1995');
    expect(upgraded.mediaFolderOf('series', series.id)).toBe(
      'harbor-vine-2019'
    );
  });
});

// 41 — Link or copy, Phase 2 (issue #342) adds migration #12: the **Linked
// video** — `video_folder_id` on `movies` and `episodes`, a reference to
// `library_folders(id)` with **no `ON DELETE`**. `NULL` means `video_path` is a
// **Stored path**, and every row that exists is one; set, `video_path` is
// relative to that **Library folder**. With no `ON DELETE`, the database
// itself refuses to forget a folder a video plays from.

describe('db: migration #12 — the Linked video', () => {
  it('adds a nullable TEXT video_folder_id to movies and to episodes', () => {
    const db = track(open(':memory:'));

    for (const table of ['movies', 'episodes']) {
      const declared = columnInfo(db, table).find(
        (c) => c.name === 'video_folder_id'
      );
      expect(declared).toBeDefined();
      expect(declared?.type.toUpperCase()).toBe('TEXT');
      expect(declared?.notnull).toBe(0);
    }
  });

  /** A library written at the latest version, then wound back to before #12. */
  function windBackToV11(path: string): void {
    const db = open(path);
    try {
      dropMigration12(db);
      db.pragma('user_version = 11');
    } finally {
      db.close();
    }
  }

  it('leaves video_folder_id NULL on every existing film and episode', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    before.addMovie({ title: 'Heat', videoPath: 'heat-1995/video.mp4' });
    before.addSeries({ title: 'Harbor & Vine' }, [
      {
        season: 1,
        number: 1,
        videoPath: 'harbor-vine-2019/season-01/S01E01.mp4',
      },
      {
        season: 1,
        number: 2,
        videoPath: 'harbor-vine-2019/season-01/S01E02.mp4',
      },
    ]);
    before.close();
    windBackToV11(path);

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(
      upgraded.prepare('SELECT video_folder_id FROM movies').all()
    ).toEqual([{ video_folder_id: null }]);
    expect(
      upgraded.prepare('SELECT video_folder_id FROM episodes').all()
    ).toEqual([{ video_folder_id: null }, { video_folder_id: null }]);
  });

  it('reads a film’s and an episode’s videoFolderId back, null when managed', () => {
    const storage = trackStorage(createSqliteStorage(':memory:'));
    const folder = storage.addLibraryFolder('D:\Movies');
    const linked = storage.addMovie({
      title: 'Heat',
      videoPath: 'Heat (1995)/Heat.1995.mkv',
      videoFolderId: folder.id,
    });
    const managed = storage.addMovie({
      title: 'Ronin',
      videoPath: 'ronin-1998/video.mp4',
    });
    const series = storage.addSeries({ title: 'Harbor & Vine' }, [
      {
        season: 1,
        number: 1,
        videoPath: 'Harbor & Vine/Season 01/S01E01.mkv',
        videoFolderId: folder.id,
      },
    ]);

    expect(storage.getMovie(linked.id)?.videoFolderId).toBe(folder.id);
    expect(storage.getMovie(managed.id)?.videoFolderId).toBeNull();
    expect(storage.listEpisodes(series.id)[0]?.videoFolderId).toBe(folder.id);
  });

  it('refuses deleting a Library folder a film or an episode plays from', () => {
    const db = track(open(':memory:'));
    const addFolder = db.prepare(
      'INSERT INTO library_folders (id, path, added_at) VALUES (?, ?, ?)'
    );
    addFolder.run('folder-1', 'D:\Movies', NOW);
    addFolder.run('folder-2', 'D:\Shows', NOW);
    db.prepare(
      `INSERT INTO movies
         (id, title, video_path, video_folder_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run('m1', 'Heat', 'Heat (1995)/Heat.1995.mkv', 'folder-1', NOW, NOW);
    insertSeries(db, 's1');
    insertEpisode(db, 'e1', 's1', 1, 1);
    db.prepare('UPDATE episodes SET video_folder_id = ? WHERE id = ?').run(
      'folder-2',
      'e1'
    );

    const remove = (id: string) =>
      db.prepare('DELETE FROM library_folders WHERE id = ?').run(id);

    expect(() => remove('folder-1')).toThrow(/FOREIGN KEY/);
    expect(() => remove('folder-2')).toThrow(/FOREIGN KEY/);
  });
});

// Issue #374: a TMDB `vote_average` of 0 means nobody voted, yet past Syncs
// stored it as a score of 0 — which the Shown rating reads as zero TMDB stars.
// Migration #13 turns every stored 0 back into NULL, on films and on series,
// and touches no other score.
describe('db: migration #13 — a score of 0 is no score', () => {
  it('lands a fresh database at version 13 or later', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBeGreaterThanOrEqual(13);
  });

  /**
   * A library written at the latest version, its scores set by hand as a past
   * Sync stored them, then wound back to before #13. Nothing in the schema
   * moved, so the wind-back is the version alone.
   */
  function writtenAtV12(
    path: string,
    scores: {
      movies: Record<string, number | null>;
      series: Record<string, number | null>;
    }
  ): void {
    const db = open(path);
    try {
      for (const [table, byId] of Object.entries(scores)) {
        for (const [id, score] of Object.entries(byId)) {
          db.prepare(`UPDATE ${table} SET tmdb_score = ? WHERE id = ?`).run(
            score,
            id
          );
        }
      }
      dropMigration14(db);
      db.pragma('user_version = 12');
    } finally {
      db.close();
    }
  }

  it('turns a stored 0 into NULL on movies and series, every other score untouched', () => {
    const path = tempDbPath();
    const db = open(path);
    const insertMovie = db.prepare(
      'INSERT INTO movies (id, title, video_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    insertMovie.run('m-zero', 'Zero', 'zero/video.mp4', NOW, NOW);
    insertMovie.run('m-scored', 'Scored', 'scored/video.mp4', NOW, NOW);
    insertMovie.run('m-low', 'Low', 'low/video.mp4', NOW, NOW);
    insertMovie.run('m-none', 'None', 'none/video.mp4', NOW, NOW);
    insertSeries(db, 's-zero');
    insertSeries(db, 's-scored');
    insertSeries(db, 's-none');
    db.close();
    writtenAtV12(path, {
      movies: { 'm-zero': 0, 'm-scored': 7.4, 'm-low': 0.1, 'm-none': null },
      series: { 's-zero': 0, 's-scored': 8.1, 's-none': null },
    });

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(
      upgraded.prepare('SELECT id, tmdb_score FROM movies ORDER BY id').all()
    ).toEqual([
      { id: 'm-low', tmdb_score: 0.1 },
      { id: 'm-none', tmdb_score: null },
      { id: 'm-scored', tmdb_score: 7.4 },
      { id: 'm-zero', tmdb_score: null },
    ]);
    expect(
      upgraded.prepare('SELECT id, tmdb_score FROM series ORDER BY id').all()
    ).toEqual([
      { id: 's-none', tmdb_score: null },
      { id: 's-scored', tmdb_score: 8.1 },
      { id: 's-zero', tmdb_score: null },
    ]);
  });

  it('draws a title whose stored score was 0 as Unrated, sorted with the titles that have no score', () => {
    const path = tempDbPath();
    const before = trackStorage(createSqliteStorage(path));
    before.setTmdbRatings(true);
    const low = before.addMovie({
      title: 'Low',
      videoPath: 'low/video.mp4',
      rating: 1,
    });
    const alpha = before.addMovie({
      title: 'Alpha',
      videoPath: 'alpha/video.mp4',
    });
    const zero = before.addMovie({
      title: 'Zero',
      videoPath: 'zero/video.mp4',
    });
    const lowShow = before.addSeries({ title: 'Low Show', rating: 1 }, [
      { season: 1, number: 1, videoPath: 'low-show/S01E01.mp4' },
    ]);
    const alphaShow = before.addSeries({ title: 'Alpha Show' }, [
      { season: 1, number: 1, videoPath: 'alpha-show/S01E01.mp4' },
    ]);
    const zeroShow = before.addSeries({ title: 'Zero Show' }, [
      { season: 1, number: 1, videoPath: 'zero-show/S01E01.mp4' },
    ]);
    before.close();
    writtenAtV12(path, {
      movies: { [low.id]: null, [alpha.id]: null, [zero.id]: 0 },
      series: { [lowShow.id]: null, [alphaShow.id]: null, [zeroShow.id]: 0 },
    });

    const after = trackStorage(createSqliteStorage(path));

    // Unrated: no household Rating and no score, so nothing for the stars.
    expect(after.getMovie(zero.id)?.rating).toBeNull();
    expect(after.getMovie(zero.id)?.tmdbScore).toBeNull();
    expect(after.getSeries(zeroShow.id)?.tmdbScore).toBeNull();

    // Sorted as no score: below a household ½ ★, among the unrated by title —
    // not above Alpha as a TMDB zero would sort.
    expect(
      after.listMovies({ sort: 'highest-rated' }).map((m) => m.title)
    ).toEqual(['Low', 'Alpha', 'Zero']);
    expect(
      after.getSeriesHome({ sort: 'highest-rated' }).series.map((s) => s.title)
    ).toEqual(['Low Show', 'Alpha Show', 'Zero Show']);
  });
});

// 44 — Episode stills, Phase 1 (issue #382) adds migration #14: an episode's
// **Still source** — `'tmdb'`, `'frame'` or `'picked'` — beside its still,
// `NULL` exactly when the still is. No frames exist before it, so a held still
// is backfilled by name: the series form's `-still.` is `'picked'`, any other
// `'tmdb'`.
describe('db: migration #14 — an episode’s Still source', () => {
  it('lands a fresh database at version 14', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBe(14);
  });

  it('adds a nullable still_source TEXT column to episodes', () => {
    const db = track(open(':memory:'));

    expect(
      columnInfo(db, 'episodes').find(
        (column) => column.name === 'still_source'
      )
    ).toMatchObject({ type: 'TEXT', notnull: 0 });
  });

  it('backfills a version-13 library by name: -still. picked, any other still tmdb, none NULL', () => {
    const path = tempDbPath();
    const db = open(path);
    try {
      insertSeries(db, 's1');
      insertEpisode(db, 'e-picked', 's1', 1, 1);
      insertEpisode(db, 'e-tmdb', 's1', 1, 2);
      insertEpisode(db, 'e-none', 's1', 1, 3);
      const setStill = db.prepare(
        'UPDATE episodes SET still_path = ? WHERE id = ?'
      );
      setStill.run('Show (2018)/season-01/S01E01-still.jpg', 'e-picked');
      setStill.run('Show (2018)/season-01/S01E02.still.jpg', 'e-tmdb');
      dropMigration14(db);
      db.pragma('user_version = 13');
    } finally {
      db.close();
    }

    const upgraded = track(open(path));

    expect(userVersion(upgraded)).toBe(LATEST_VERSION);
    expect(
      upgraded
        .prepare('SELECT id, still_source FROM episodes ORDER BY id')
        .all()
    ).toEqual([
      { id: 'e-none', still_source: null },
      { id: 'e-picked', still_source: 'picked' },
      { id: 'e-tmdb', still_source: 'tmdb' },
    ]);
  });
});

describe('db: DEBUG_SQL verbose logging', () => {
  it('logs SQL via console.info when DEBUG_SQL === "1"', () => {
    process.env.DEBUG_SQL = '1';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const db = track(open(':memory:'));
    db.prepare('SELECT 1').get();

    expect(spy).toHaveBeenCalled();
    expect(
      spy.mock.calls.some((call) =>
        call.some((arg) => typeof arg === 'string' && /select/i.test(arg))
      )
    ).toBe(true);
  });

  it('does not log SQL when DEBUG_SQL is unset', () => {
    delete process.env.DEBUG_SQL;
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const db = track(open(':memory:'));
    db.prepare('SELECT 1').get();

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not log SQL when DEBUG_SQL is set to something other than "1"', () => {
    process.env.DEBUG_SQL = '0';
    const spy = vi.spyOn(console, 'info').mockImplementation(() => undefined);

    const db = track(open(':memory:'));
    db.prepare('SELECT 1').get();

    expect(spy).not.toHaveBeenCalled();
  });
});

describe('library: createSqliteStorage factory shell', () => {
  it('opens and migrates an in-memory database without throwing', () => {
    // AC #8: behaviour is verifiable through the real factory over `:memory:`.
    expect(() => createSqliteStorage(':memory:')).not.toThrow();
  });
});

// Issue #216 — the window over the server. Under the Desktop shell the server
// runs on Electron's own Node, whose ABI the package's own binding does not
// match, so main points `FAMILYFLIX_SQLITE_BINDING` at the Electron-ABI
// prebuild `electron:native` fetched and the opener hands it to
// `better-sqlite3` as `nativeBinding`. Unset, the package's own binding is
// used — which is every other suite in this file, on Node's ABI.
describe('db: the SQLite binding', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('loads the binding FAMILYFLIX_SQLITE_BINDING names when it is set', () => {
    // A path holding no binding at all: loaded, it fails naming the path;
    // ignored, the package's own binding opens the database as if unset.
    const missing = join(
      tmpdir(),
      'familyflix-no-binding',
      'better_sqlite3.node'
    );
    vi.stubEnv('FAMILYFLIX_SQLITE_BINDING', missing);

    expect(() => openDatabase(':memory:')).toThrow(/familyflix-no-binding/);
  });
});
