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

import { openDatabase } from '../db';
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
let tempDir: string | null = null;

function track(db: TestDb): TestDb {
  openedDbs.push(db);
  return db;
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
  for (const db of openedDbs.splice(0)) {
    try {
      db.close();
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
  it('migrates a fresh :memory: database to user_version 1', () => {
    const db = track(open(':memory:'));
    expect(userVersion(db)).toBe(1);
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
    expect(userVersion(first)).toBe(1);
    first.close();

    // Re-opening the same file runs the migration runner again; it must detect
    // the DB is already at version 1 and apply nothing.
    const second = track(open(path));
    expect(userVersion(second)).toBe(1);

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
