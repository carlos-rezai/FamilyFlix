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

// The version a fresh database migrates to — migration #5, Enrichment's
// columns (issue #204). Every "at the latest version" assertion reads it, so
// the next migration moves one number rather than seven.
const LATEST_VERSION = 5;

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
    dropMigration5Columns(db);
    db.pragma('user_version = 4');
  } finally {
    db.close();
  }
}

/** A table's columns less what migration #5 added — the v4 shape. */
function v4Columns(db: TestDb, table: keyof typeof MIGRATION_5_COLUMNS) {
  const added: readonly string[] = MIGRATION_5_COLUMNS[table];
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

  it('lands a fresh database at version 5', () => {
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBe(5);
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

    expect(userVersion(upgraded)).toBe(5);
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
