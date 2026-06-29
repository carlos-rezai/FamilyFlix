// @vitest-environment node
//
// Phase 2 — "Add and read a movie (full round-trip)" (issue #3).
//
// These tests exercise a REAL SQLite database through the `library/`
// repository's public `LibraryStorage` interface — `addMovie` + `getMovie`.
// Nothing is mocked: the actual transactional multi-table insert, the CHECK
// constraints, the genre-name resolution, and the row→model assembly (ordered
// genres, parsed cast, ordered subtitles, derived status) are all exercised for
// real, per the PRD's "real in-memory SQLite, not a mock" testing decision.
//
// `:memory:` is used for the behavioural cases (a fresh, isolated DB per test).
// The atomicity case uses a throwaway on-disk file so a SECOND connection
// (`openDatabase`) can independently inspect the committed table contents and
// prove a failed insert left no half-written rows.

import { afterEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createSqliteStorage } from '../library';
import { openDatabase, type SqliteDatabase } from '../db';
import type { NewMovie } from '../../../src/types';

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

describe('library: addMovie / getMovie round-trip', () => {
  it('assembles the full model: ordered genres, parsed cast, ordered subtitles', () => {
    const storage = freshStorage();

    const added = storage.addMovie(
      newMovie({
        tmdbId: 12345,
        year: 2018,
        runtimeMinutes: 121,
        synopsis: 'A storm chaser races an unnatural front.',
        director: 'Jane Roe',
        cast: ['Alice Stone', 'Bob Vance', 'Carol Lin'],
        rating: 8,
        isFavorite: true,
        posterPath: 'northwind/poster.jpg',
        backdropPath: 'northwind/backdrop.jpg',
        genres: ['Action', 'Sci-Fi', 'Thriller'],
        subtitles: [
          { path: 'Northwind (2018)/en.srt', language: 'English' },
          { path: 'Northwind (2018)/de.srt', language: 'German' },
        ],
      })
    );

    const got = storage.getMovie(added.id);
    expect(got).not.toBeNull();
    const movie = got as NonNullable<typeof got>;

    // Scalar metadata round-trips.
    expect(movie.title).toBe('Northwind');
    expect(movie.tmdbId).toBe(12345);
    expect(movie.year).toBe(2018);
    expect(movie.runtimeMinutes).toBe(121);
    expect(movie.director).toBe('Jane Roe');
    expect(movie.rating).toBe(8);
    expect(movie.isFavorite).toBe(true);
    expect(movie.videoPath).toBe('Northwind (2018)/northwind.mkv');
    expect(movie.posterPath).toBe('northwind/poster.jpg');
    expect(movie.backdropPath).toBe('northwind/backdrop.jpg');

    // Genres preserve input order (genres[0] = primary) and carry resolved ids.
    expect(movie.genres.map((g) => g.name)).toEqual([
      'Action',
      'Sci-Fi',
      'Thriller',
    ]);
    expect(movie.genres.every((g) => typeof g.id === 'string' && g.id)).toBe(
      true
    );

    // Cast is an ordered string[] (display order preserved).
    expect(movie.cast).toEqual(['Alice Stone', 'Bob Vance', 'Carol Lin']);

    // Subtitles attach in track order, with strictly-ascending positions.
    expect(movie.subtitles.map((s) => s.language)).toEqual([
      'English',
      'German',
    ]);
    expect(movie.subtitles.map((s) => s.path)).toEqual([
      'Northwind (2018)/en.srt',
      'Northwind (2018)/de.srt',
    ]);
    const positions = movie.subtitles.map((s) => s.position);
    expect(positions[0]).toBeLessThan(positions[1]);
    expect(movie.subtitles.every((s) => typeof s.id === 'string' && s.id)).toBe(
      true
    );
  });

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

  it('returns null for an unknown id (does not throw)', () => {
    const storage = freshStorage();

    expect(() =>
      storage.getMovie('00000000-0000-4000-8000-000000000000')
    ).not.toThrow();
    expect(storage.getMovie('00000000-0000-4000-8000-000000000000')).toBeNull();
  });
});

describe('library: derived watch status', () => {
  it("is 'unwatched' when not watched and resume position is 0", () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());

    expect(added.watched).toBe(false);
    expect(added.resumePositionSeconds).toBe(0);
    expect(added.status).toBe('unwatched');
  });

  it("is 'in-progress' when resume position > 0 and not watched", () => {
    const storage = freshStorage();
    const added = storage.addMovie(
      newMovie({ resumePositionSeconds: 600, watched: false })
    );

    expect(added.status).toBe('in-progress');
  });

  it("is 'watched' when watched is set (regardless of resume position)", () => {
    const storage = freshStorage();
    const added = storage.addMovie(
      newMovie({ watched: true, resumePositionSeconds: 600 })
    );

    expect(added.status).toBe('watched');
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
