// @vitest-environment node
//
// Phase 2 — the write path: transactional `addMovie` and its constraints (issue #3).
//
// These tests exercise a REAL SQLite database through the `library/` repository's
// public `LibraryStorage` interface — `addMovie` (read back via `getMovie`).
// Nothing is mocked: the transactional multi-table insert, the CHECK constraints,
// and the genre-name resolution are all exercised for real, per the PRD's "real
// in-memory SQLite, not a mock" testing decision.
//
// `:memory:` is used for the behavioural cases (a fresh, isolated DB per test).
// The atomicity case uses a throwaway on-disk file so a SECOND connection
// (`openDatabase`) can independently inspect the committed table contents and
// prove a failed insert left no half-written rows.

import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSqliteStorage } from '..';
import { openDatabase, type SqliteDatabase } from '../../db';
import type { NewMovie } from '../../../../src/types';

// RFC-4122 v4 UUID, as produced by crypto.randomUUID().
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// --- per-test resource tracking ------------------------------------------------

interface Closeable {
  close(): void;
}

const closeables: Closeable[] = [];
let tempDir: string | null = null;

function track<T extends Closeable>(resource: T): T {
  closeables.push(resource);
  return resource;
}

/** A fresh, fully-migrated in-memory repository, closed automatically. */
function freshStorage(): ReturnType<typeof createSqliteStorage> {
  return track(createSqliteStorage(':memory:'));
}

/** A throwaway on-disk DB path (lets a second connection inspect committed
 *  rows; `:memory:` databases are private to their single connection). */
function tempDbPath(): string {
  if (!tempDir) {
    tempDir = mkdtempSync(join(tmpdir(), 'familyflix-lib-'));
  }
  return join(tempDir, `lib-${Math.random().toString(36).slice(2)}.db`);
}

afterEach(() => {
  for (const resource of closeables.splice(0)) {
    try {
      resource.close();
    } catch {
      // already closed by the test — fine.
    }
  }
  if (tempDir && existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

// --- helpers -------------------------------------------------------------------

/** A minimal valid NewMovie (title + videoPath are the only required fields),
 *  overridable per test. */
function newMovie(overrides: Partial<NewMovie> = {}): NewMovie {
  return {
    title: 'Northwind',
    videoPath: 'Northwind (2018)/northwind.mkv',
    ...overrides,
  };
}

/** Row count of a table, read through an independent raw connection. */
function countRows(db: SqliteDatabase, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
    n: number;
  };
  return row.n;
}

// --- tests ---------------------------------------------------------------------

describe('library: addMovie round-trip', () => {
  it('returns the persisted full model from addMovie (no second read needed)', () => {
    const storage = freshStorage();

    const added = storage.addMovie(
      newMovie({
        cast: ['Alice Stone'],
        genres: ['Drama', 'Crime'],
        subtitles: [{ path: 'en.srt', language: 'English' }],
      })
    );

    expect(storage.getMovie(added.id)).toEqual(added);
  });

  it('generates a UUID id and equal UTC ISO-8601 timestamps at insert', () => {
    const storage = freshStorage();

    const before = Date.now();
    const added = storage.addMovie(newMovie());

    expect(added.id).toMatch(UUID_RE);

    // created_at and updated_at are set to the same instant on insert...
    expect(added.createdAt).toBe(added.updatedAt);
    // ...are canonical UTC ISO-8601 (round-trips, ends in 'Z')...
    expect(new Date(added.createdAt).toISOString()).toBe(added.createdAt);
    expect(added.createdAt.endsWith('Z')).toBe(true);
    // ...and reflect "now", not SQLite CURRENT_TIMESTAMP.
    const stamp = Date.parse(added.createdAt);
    expect(stamp).toBeGreaterThanOrEqual(before - 1000);
    expect(stamp).toBeLessThanOrEqual(Date.now() + 1000);
  });
});

describe('library: rating', () => {
  it('round-trips the rating across the 0–10 range', () => {
    const storage = freshStorage();

    const lo = storage.addMovie(newMovie({ rating: 0 }));
    const hi = storage.addMovie(newMovie({ rating: 10 }));

    expect(storage.getMovie(lo.id)?.rating).toBe(0);
    expect(storage.getMovie(hi.id)?.rating).toBe(10);
  });

  it('reads an omitted rating back as null (unrated), distinct from a stored 0', () => {
    const storage = freshStorage();

    const unrated = storage.addMovie(newMovie());
    const zero = storage.addMovie(newMovie({ rating: 0 }));

    expect(unrated.rating).toBeNull();
    expect(zero.rating).toBe(0);
    expect(unrated.rating).not.toBe(zero.rating);
  });

  it('rejects a rating outside 0–10 via the CHECK constraint', () => {
    const storage = freshStorage();

    // A baseline in-range rating must persist...
    expect(storage.addMovie(newMovie({ rating: 5 })).rating).toBe(5);
    // ...while out-of-range values are rejected by the DB CHECK.
    expect(() => storage.addMovie(newMovie({ rating: 11 }))).toThrow();
    expect(() => storage.addMovie(newMovie({ rating: -1 }))).toThrow();
  });
});

describe('library: required and optional paths', () => {
  it('reads omitted poster and backdrop paths back as null', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());

    expect(added.posterPath).toBeNull();
    expect(added.backdropPath).toBeNull();
  });

  it('rejects a movie with no video path (NOT NULL)', () => {
    const storage = freshStorage();

    // A movie with a video path persists...
    expect(storage.addMovie(newMovie()).videoPath).toBe(
      'Northwind (2018)/northwind.mkv'
    );
    // ...but videoPath is required by the schema; omitting it fails the insert.
    const missingVideo = { title: 'No Video' } as NewMovie;
    expect(() => storage.addMovie(missingVideo)).toThrow();
  });
});

describe('library: addMovie atomicity', () => {
  it('writes nothing when the insert fails mid-transaction (no orphan rows)', () => {
    const path = tempDbPath();
    const storage = track(createSqliteStorage(path));

    // One valid movie is committed first: a single movie row, one genre link,
    // one subtitle.
    storage.addMovie(
      newMovie({
        genres: ['Drama'],
        subtitles: [{ path: 'ok.srt', language: 'English' }],
      })
    );

    // An out-of-range rating fails the movies-row CHECK; the two genres and the
    // subtitle staged for THIS movie must never be committed either.
    expect(() =>
      storage.addMovie(
        newMovie({
          rating: 11,
          genres: ['Action', 'Sci-Fi'],
          subtitles: [{ path: 'en.srt', language: 'English' }],
        })
      )
    ).toThrow();

    // Inspect the committed state through an independent connection: exactly the
    // first movie's rows survive — the failed insert added nothing.
    const probe = track(openDatabase(path));
    expect(countRows(probe, 'movies')).toBe(1);
    expect(countRows(probe, 'movie_genres')).toBe(1);
    expect(countRows(probe, 'subtitles')).toBe(1);
    // The 12-genre seed is untouched.
    expect(countRows(probe, 'genres')).toBe(12);
  });
});
