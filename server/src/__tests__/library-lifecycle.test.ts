// @vitest-environment node
//
// Phase 4 — "Edit and delete a movie (transactional + cascade)" (issue #7).
//
// These tests exercise a REAL SQLite database through the `library/`
// repository's public `LibraryStorage` interface — `updateMovie` and
// `deleteMovie`. Nothing is mocked: the actual multi-table UPDATE/DELETE
// transaction, the genre-name resolution, the foreign-key cascades, and the
// row→model assembly are all exercised for real, per the PRD's "real in-memory
// SQLite, not a mock" testing decision.
//
// `:memory:` is used for the behavioural cases (a fresh, isolated DB per test).
// The atomicity and subtitle-orphan cases use a throwaway on-disk file so a
// SECOND connection (`openDatabase`) can independently inspect the committed
// table contents and prove nothing was half-applied / left orphaned.
//
// Interface decisions this slice locks in (design log names the shape
// `updateMovie(id, patch: MoviePatch): Movie` / `deleteMovie(id): void`; these
// three points fill the gaps it left open):
//   1. `patch.genres` / `patch.subtitles`, when supplied, REPLACE the whole
//      collection; omitting a key leaves that collection untouched.
//   2. `MoviePatch` covers metadata only — watched/resume, favorite, and rating
//      stay owned by their dedicated mutators (markWatched, setFavorite,
//      setRating), so a metadata edit never disturbs them.
//   3. `updateMovie` on an unknown id throws (its return type is a non-null
//      Movie); `deleteMovie` on an unknown id is a silent, idempotent no-op.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { createSqliteStorage } from '../library';
import { openDatabase, type SqliteDatabase } from '../db';
import type { MoviePatch, NewMovie } from '../../../src/types';

// A syntactically-valid v4 UUID that no test ever inserts.
const MISSING_ID = '00000000-0000-4000-8000-000000000000';

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
    tempDir = mkdtempSync(join(tmpdir(), 'familyflix-lifecycle-'));
  }
  return join(tempDir, `lib-${Math.random().toString(36).slice(2)}.db`);
}

afterEach(() => {
  vi.useRealTimers();
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

/** A richly-populated movie (genres + subtitles + scalar metadata) — the
 *  starting point for edits that must leave the untouched parts intact. */
function fullMovie(overrides: Partial<NewMovie> = {}): NewMovie {
  return newMovie({
    year: 2018,
    runtimeMinutes: 121,
    synopsis: 'A storm chaser races an unnatural front.',
    director: 'Jane Roe',
    cast: ['Alice Stone', 'Bob Vance'],
    genres: ['Action', 'Sci-Fi', 'Thriller'],
    subtitles: [
      { path: 'Northwind (2018)/en.srt', language: 'English' },
      { path: 'Northwind (2018)/de.srt', language: 'German' },
    ],
    ...overrides,
  });
}

/** Row count of a table, read through an independent raw connection. */
function countRows(db: SqliteDatabase, table: string): number {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
    n: number;
  };
  return row.n;
}

// --- updateMovie ---------------------------------------------------------------

describe('library: updateMovie', () => {
  it('edits scalar metadata and returns the persisted full model', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());

    const updated = storage.updateMovie(added.id, {
      title: 'Northwind: Redux',
      year: 2020,
      runtimeMinutes: 130,
      synopsis: 'A re-cut of the storm chaser saga.',
      director: 'John Doe',
    });

    // The returned model reflects the edits (no second read needed)...
    expect(updated.title).toBe('Northwind: Redux');
    expect(updated.year).toBe(2020);
    expect(updated.runtimeMinutes).toBe(130);
    expect(updated.synopsis).toBe('A re-cut of the storm chaser saga.');
    expect(updated.director).toBe('John Doe');
    // ...and equals what a fresh read assembles.
    expect(storage.getMovie(added.id)).toEqual(updated);
  });

  it('replaces the genre set (ordered), removing the old links', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());
    expect(added.genres.map((g) => g.name)).toEqual([
      'Action',
      'Sci-Fi',
      'Thriller',
    ]);

    const updated = storage.updateMovie(added.id, {
      genres: ['Drama', 'Crime'],
    });

    // The new set is stored, in order; the old tags are gone.
    expect(updated.genres.map((g) => g.name)).toEqual(['Drama', 'Crime']);
    expect(updated.genres.every((g) => typeof g.id === 'string' && g.id)).toBe(
      true
    );

    // The old genre links were deleted at the DB level: the browse rows no
    // longer surface Action/Sci-Fi/Thriller, and now surface Drama/Crime.
    const genreNames = storage.listGenres().map((g) => g.name);
    expect(genreNames).toContain('Drama');
    expect(genreNames).toContain('Crime');
    expect(genreNames).not.toContain('Action');
    expect(genreNames).not.toContain('Sci-Fi');
    expect(genreNames).not.toContain('Thriller');
  });

  it('replaces the subtitle set, removing the old tracks', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());
    expect(added.subtitles.map((s) => s.language)).toEqual([
      'English',
      'German',
    ]);

    const updated = storage.updateMovie(added.id, {
      subtitles: [{ path: 'Northwind (2018)/fr.srt', language: 'French' }],
    });

    expect(updated.subtitles.map((s) => s.language)).toEqual(['French']);
    expect(updated.subtitles.map((s) => s.path)).toEqual([
      'Northwind (2018)/fr.srt',
    ]);
    // Fresh ids/positions for the replacement track.
    expect(updated.subtitles[0].position).toBe(0);
    expect(
      typeof updated.subtitles[0].id === 'string' &&
        updated.subtitles[0].id.length > 0
    ).toBe(true);
  });

  it('leaves omitted collections untouched (partial patch)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());

    const updated = storage.updateMovie(added.id, { title: 'Renamed' });

    // Only the title changed; genres, subtitles, and cast are preserved.
    expect(updated.title).toBe('Renamed');
    expect(updated.genres.map((g) => g.name)).toEqual([
      'Action',
      'Sci-Fi',
      'Thriller',
    ]);
    expect(updated.subtitles.map((s) => s.language)).toEqual([
      'English',
      'German',
    ]);
    expect(updated.cast).toEqual(['Alice Stone', 'Bob Vance']);
  });

  it('refreshes updated_at while leaving created_at unchanged', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-03T10:00:00.000Z'));

    const storage = freshStorage();
    const added = storage.addMovie(newMovie());
    // On insert the two stamps are equal (same instant).
    expect(added.createdAt).toBe(added.updatedAt);

    vi.setSystemTime(new Date('2026-07-03T11:30:00.000Z'));
    const updated = storage.updateMovie(added.id, { title: 'Renamed' });

    // created_at is stable; updated_at moves forward to the edit instant.
    expect(updated.createdAt).toBe(added.createdAt);
    expect(updated.updatedAt).not.toBe(added.updatedAt);
    expect(Date.parse(updated.updatedAt)).toBeGreaterThan(
      Date.parse(added.createdAt)
    );
    // The refreshed stamp is persisted, not just returned.
    expect(storage.getMovie(added.id)?.updatedAt).toBe(updated.updatedAt);
  });

  it('does not disturb watch state, favorite, or rating (metadata-only patch)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie({ isFavorite: true, rating: 7 }));
    storage.setResumePosition(added.id, 640);

    const updated = storage.updateMovie(added.id, { title: 'Renamed' });

    expect(updated.isFavorite).toBe(true);
    expect(updated.rating).toBe(7);
    expect(updated.resumePositionSeconds).toBe(640);
    expect(updated.watched).toBe(false);
    expect(updated.status).toBe('in-progress');
  });

  it('stores edited paths verbatim, keeping them relative', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());

    const updated = storage.updateMovie(added.id, {
      videoPath: 'Northwind Redux (2020)/movie.mkv',
      posterPath: 'northwind-redux/poster.jpg',
      subtitles: [
        { path: 'Northwind Redux (2020)/en.srt', language: 'English' },
      ],
    });

    expect(updated.videoPath).toBe('Northwind Redux (2020)/movie.mkv');
    expect(updated.posterPath).toBe('northwind-redux/poster.jpg');
    expect(updated.subtitles[0].path).toBe('Northwind Redux (2020)/en.srt');
    // None of the stored paths were absolutised.
    expect(isAbsolute(updated.videoPath)).toBe(false);
    expect(isAbsolute(updated.posterPath as string)).toBe(false);
    expect(isAbsolute(updated.subtitles[0].path)).toBe(false);
  });

  it('applies its multi-table changes in one transaction (no half-applied edits)', () => {
    const path = tempDbPath();
    const storage = track(createSqliteStorage(path));

    const added = storage.addMovie(
      fullMovie({
        genres: ['Drama'],
        subtitles: [{ path: 'ok.srt', language: 'English' }],
      })
    );

    // Guard: without this, the `.toThrow()` below is satisfied by the *missing*
    // method throwing a TypeError — a false green. This anchors the test to the
    // real rollback behaviour.
    expect(typeof storage.updateMovie).toBe('function');

    // The patch renames the movie and swaps genres/subtitles, but names a genre
    // that does not exist — the write must fail and roll back *everything*,
    // including the title, so no partial edit survives.
    const badPatch: MoviePatch = {
      title: 'Should Not Persist',
      genres: ['Action', 'Nonexistent Genre'],
      subtitles: [
        { path: 'new-en.srt', language: 'English' },
        { path: 'new-de.srt', language: 'German' },
      ],
    };
    expect(() => storage.updateMovie(added.id, badPatch)).toThrow();

    // Inspect the committed state through an independent connection: the movie
    // is unchanged — original title, its single Drama link, its single subtitle.
    const probe = track(openDatabase(path));
    expect(countRows(probe, 'movies')).toBe(1);
    expect(countRows(probe, 'movie_genres')).toBe(1);
    expect(countRows(probe, 'subtitles')).toBe(1);

    const after = storage.getMovie(added.id);
    expect(after?.title).toBe('Northwind');
    expect(after?.genres.map((g) => g.name)).toEqual(['Drama']);
    expect(after?.subtitles.map((s) => s.path)).toEqual(['ok.srt']);
  });

  it('throws when the movie id is unknown', () => {
    const storage = freshStorage();

    // Guard: a missing method also throws (TypeError) — this keeps the test
    // RED for the right reason until real "unknown id" handling exists.
    expect(typeof storage.updateMovie).toBe('function');
    expect(() => storage.updateMovie(MISSING_ID, { title: 'X' })).toThrow();
  });
});

// --- deleteMovie ---------------------------------------------------------------

describe('library: deleteMovie', () => {
  it('removes the movie (getMovie returns null afterwards)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());
    expect(storage.getMovie(added.id)).not.toBeNull();

    storage.deleteMovie(added.id);

    expect(storage.getMovie(added.id)).toBeNull();
  });

  it('drops the movie from listMovies, leaving others intact', () => {
    const storage = freshStorage();
    const keep = storage.addMovie(newMovie({ title: 'Keeper' }));
    const drop = storage.addMovie(newMovie({ title: 'Goner' }));

    storage.deleteMovie(drop.id);

    const ids = storage.listMovies({ sort: 'recently-added' }).map((m) => m.id);
    expect(ids).toContain(keep.id);
    expect(ids).not.toContain(drop.id);
  });

  it('cascades to movie_genres (its genre rows leave the browse counts)', () => {
    const storage = freshStorage();
    // The only movie tagged Horror — so Horror appears in listGenres with count
    // 1, then must disappear entirely once the movie (and its link) is gone.
    const added = storage.addMovie(newMovie({ genres: ['Horror'] }));
    expect(storage.listGenres().find((g) => g.name === 'Horror')?.count).toBe(
      1
    );

    storage.deleteMovie(added.id);

    expect(
      storage.listGenres().find((g) => g.name === 'Horror')
    ).toBeUndefined();
  });

  it('cascades to subtitles (no orphaned subtitle rows remain)', () => {
    const path = tempDbPath();
    const storage = track(createSqliteStorage(path));
    const added = storage.addMovie(
      fullMovie({
        genres: ['Drama'],
        subtitles: [
          { path: 'en.srt', language: 'English' },
          { path: 'de.srt', language: 'German' },
        ],
      })
    );

    // Precondition: the child rows exist.
    const before = track(openDatabase(path));
    expect(countRows(before, 'subtitles')).toBe(2);
    expect(countRows(before, 'movie_genres')).toBe(1);

    storage.deleteMovie(added.id);

    // Inspect committed state through an independent connection: the movie and
    // ALL of its children are gone — no orphans, and the genre seed is intact.
    const probe = track(openDatabase(path));
    expect(countRows(probe, 'movies')).toBe(0);
    expect(countRows(probe, 'movie_genres')).toBe(0);
    expect(countRows(probe, 'subtitles')).toBe(0);
    expect(countRows(probe, 'genres')).toBe(12);
  });

  it('is a silent no-op for an unknown id (idempotent)', () => {
    const storage = freshStorage();
    const kept = storage.addMovie(newMovie({ title: 'Keeper' }));

    expect(() => storage.deleteMovie(MISSING_ID)).not.toThrow();

    // The real movie is untouched.
    expect(storage.getMovie(kept.id)).not.toBeNull();
  });
});
