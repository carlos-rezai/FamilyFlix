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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

import { createSqliteStorage } from '..';
import { openDatabase, type SqliteDatabase } from '../../db';
import type { MoviePatch, NewMovie } from '@/types';

// RFC-4122 v4 UUID, as produced by crypto.randomUUID().
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    tempDir = mkdtempSync(join(tmpdir(), 'familyflix-lib-'));
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

  it('leaves omitted watch/favorite/rating fields untouched', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie({ isFavorite: true, rating: 7 }));
    storage.setResumePosition(added.id, 640);

    // A patch that names none of these leaves them exactly as they were — not
    // because they are out of scope (they are patchable), but because they were
    // omitted.
    const updated = storage.updateMovie(added.id, { title: 'Renamed' });

    expect(updated.isFavorite).toBe(true);
    expect(updated.rating).toBe(7);
    expect(updated.resumePositionSeconds).toBe(640);
    expect(updated.watched).toBe(false);
    expect(updated.status).toBe('in-progress');
  });

  it('patches the rating, and clears it to unrated with null', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie({ rating: 7 }));

    expect(storage.updateMovie(added.id, { rating: 9 }).rating).toBe(9);
    // null clears back to unrated (distinct from a stored 0).
    const cleared = storage.updateMovie(added.id, { rating: null });
    expect(cleared.rating).toBeNull();
    expect(storage.getMovie(added.id)?.rating).toBeNull();
  });

  it('patches the favorite flag', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());
    expect(added.isFavorite).toBe(false);

    expect(storage.updateMovie(added.id, { isFavorite: true }).isFavorite).toBe(
      true
    );
    expect(
      storage.updateMovie(added.id, { isFavorite: false }).isFavorite
    ).toBe(false);
  });

  it('patches watched without zeroing the resume position (no markWatched convention)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());
    storage.setResumePosition(added.id, 640);

    // markWatched would zero the resume position; updateMovie applies no such
    // convention — it writes exactly what it's given.
    const updated = storage.updateMovie(added.id, { watched: true });

    expect(updated.watched).toBe(true);
    expect(updated.resumePositionSeconds).toBe(640);
    expect(updated.status).toBe('watched');
  });

  it('patches the resume position and bumps updated_at', () => {
    const storage = freshStorage();
    const added = storage.addMovie(fullMovie());

    const updated = storage.updateMovie(added.id, {
      resumePositionSeconds: 900,
    });

    expect(updated.resumePositionSeconds).toBe(900);
    expect(updated.status).toBe('in-progress');
    // Unlike setResumePosition (which leaves updated_at alone), a patch bumps it.
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(added.updatedAt)
    );
    expect(storage.getMovie(added.id)?.resumePositionSeconds).toBe(900);
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
