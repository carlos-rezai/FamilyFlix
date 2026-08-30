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
 * back to 1, not 0, the runner applies only migration #2, so anything that
 * reappears demonstrably came from #2 rather than from `V1_SCHEMA`.
 */
function windBackToV1(path: string): void {
  const db = open(path);
  try {
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
    expect(userVersion(db)).toBe(2);
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
    expect(userVersion(first)).toBe(2);
    first.close();

    // Re-opening the same file runs the migration runner again; it must detect
    // the DB is already current and apply nothing.
    const second = track(open(path));
    expect(userVersion(second)).toBe(2);

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

  it('is a migration of its own — a fresh database reaching version 2 proves V1_SCHEMA never declared the column', () => {
    // If the column were added to V1_SCHEMA instead, migration #2's
    // `ALTER TABLE ... ADD COLUMN` would fail as a duplicate on every fresh
    // database and the runner would leave the version at 1.
    const db = track(open(':memory:'));

    expect(userVersion(db)).toBe(2);
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

    expect(userVersion(upgraded)).toBe(2);
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
