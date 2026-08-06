// @vitest-environment node
//
// Phase 2 — "Backend seam: limit + the /api/home aggregate" (issue #12).
//
// These tests exercise the home-payload aggregation through the `library/`
// repository's public `LibraryStorage` interface — `listHomeRows()`, the
// single call `GET /api/home` serves. Nothing is mocked: a real, fully
// migrated `:memory:` SQLite database is seeded through `addMovie`, per the
// PRD's "real in-memory SQLite, not a mock" testing decision, and the route
// layer is deliberately not involved (it is a one-line JSON wrapper).
//
// A fresh, isolated `:memory:` database is created per test via the factory.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSqliteStorage } from '..';
import type { NewMovie } from '@/types';

// --- per-test resource tracking ------------------------------------------------

interface Closeable {
  close(): void;
}

const closeables: Closeable[] = [];

function track<T extends Closeable>(resource: T): T {
  closeables.push(resource);
  return resource;
}

/** A fresh, fully-migrated in-memory repository, closed automatically. */
function freshStorage(): ReturnType<typeof createSqliteStorage> {
  return track(createSqliteStorage(':memory:'));
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

/**
 * Add `count` movies to one genre, each a day newer than the last, so
 * `recently-added` ordering is deterministic rather than tie-dependent
 * (`created_at` is repo-generated from `new Date()`). Titles are numbered from
 * 1 (oldest) to `count` (newest).
 */
function seedGenre(
  storage: ReturnType<typeof createSqliteStorage>,
  genre: string,
  count: number
): void {
  vi.useFakeTimers();
  for (let n = 1; n <= count; n += 1) {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, n)));
    storage.addMovie(
      newMovie({
        title: `${genre} ${String(n).padStart(2, '0')}`,
        genres: [genre],
      })
    );
  }
  vi.useRealTimers();
}

// --- rows ----------------------------------------------------------------------

describe('library: listHomeRows rows', () => {
  it('returns one row per populated genre, alphabetically by genre name', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Actioner', genres: ['Action'] }));
    storage.addMovie(newMovie({ title: 'Chiller', genres: ['Horror'] }));

    const rows = storage.listHomeRows();

    expect(rows.map((row) => row.genre)).toEqual(['Action', 'Drama', 'Horror']);
  });

  it('produces no row for a genre with no movies', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Only One', genres: ['Drama'] }));

    const rows = storage.listHomeRows();

    // The other 11 seeded genres carry no movies, so they are simply absent.
    expect(rows.map((row) => row.genre)).toEqual(['Drama']);
  });

  it('returns [] for an empty library', () => {
    const storage = freshStorage();

    expect(storage.listHomeRows()).toEqual([]);
  });

  it('lists a movie tagged with several genres in each of those rows', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Crossover', genres: ['Action', 'Drama', 'Sci-Fi'] })
    );
    storage.addMovie(newMovie({ title: 'Actioner', genres: ['Action'] }));

    const rows = storage.listHomeRows();
    const titlesByGenre = new Map(
      rows.map((row) => [row.genre, row.movies.map((m) => m.title).sort()])
    );

    expect(titlesByGenre.get('Action')).toEqual(['Actioner', 'Crossover']);
    expect(titlesByGenre.get('Drama')).toEqual(['Crossover']);
    expect(titlesByGenre.get('Sci-Fi')).toEqual(['Crossover']);
  });
});

// --- cap and count -------------------------------------------------------------

describe('library: listHomeRows cap and count', () => {
  it('caps a row at 15 movies, newest first', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 20);

    const [row] = storage.listHomeRows();

    expect(row.movies).toHaveLength(15);
    // The 15 most recently added, newest first — not the first 15 added.
    expect(row.movies.map((m) => m.title)).toEqual([
      'Action 20',
      'Action 19',
      'Action 18',
      'Action 17',
      'Action 16',
      'Action 15',
      'Action 14',
      'Action 13',
      'Action 12',
      'Action 11',
      'Action 10',
      'Action 09',
      'Action 08',
      'Action 07',
      'Action 06',
    ]);
  });

  it("reports the genre's true total as count, not the capped 15", () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 20);
    seedGenre(storage, 'Drama', 3);

    const rows = storage.listHomeRows();
    const byGenre = new Map(rows.map((row) => [row.genre, row]));

    expect(byGenre.get('Action')?.count).toBe(20);
    expect(byGenre.get('Action')?.movies).toHaveLength(15);
    expect(byGenre.get('Drama')?.count).toBe(3);
    expect(byGenre.get('Drama')?.movies).toHaveLength(3);
  });
});

// --- payload shape -------------------------------------------------------------

describe('library: listHomeRows payload shape', () => {
  it('carries fully assembled Movie models (matching getMovie)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(
      newMovie({
        title: 'Northwind',
        year: 2018,
        cast: ['Alice Stone', 'Bob Vance'],
        rating: 8,
        genres: ['Action', 'Sci-Fi'],
        subtitles: [
          { path: 'Northwind (2018)/en.srt', language: 'English' },
          { path: 'Northwind (2018)/de.srt', language: 'German' },
        ],
        resumePositionSeconds: 600,
      })
    );

    const [row] = storage.listHomeRows();
    const [movie] = row.movies;

    // Same model the rest of the repository returns: ordered genres, parsed
    // cast, ordered subtitles, derived status — the card needs all of it.
    expect(movie).toEqual(storage.getMovie(added.id));
    expect(movie.genres.map((g) => g.name)).toEqual(['Action', 'Sci-Fi']);
    expect(movie.status).toBe('in-progress');
  });
});
