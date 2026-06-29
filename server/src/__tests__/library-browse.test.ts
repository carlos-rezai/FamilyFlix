// @vitest-environment node
//
// Phase 3 — "Browse: list, filter, sort, search, genre rows" (issue #4).
//
// These tests exercise a REAL SQLite database through the `library/`
// repository's public `LibraryStorage` interface — `listMovies`,
// `searchMovies`, and `listGenres`. Nothing is mocked: the actual
// parameterized SQL, the ORDER BY clauses, the genre join, and the
// row→model assembly are all exercised for real, per the PRD's "real
// in-memory SQLite, not a mock" testing decision.
//
// A fresh, isolated `:memory:` database is created per test via the factory.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSqliteStorage } from '../library';
import type { MovieSort, NewMovie } from '../../../src/types';

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

// --- sort ----------------------------------------------------------------------

describe('library: listMovies sort', () => {
  it('recently-added orders by creation time, newest first', () => {
    const storage = freshStorage();

    // Distinct creation instants via fake timers (created_at is repo-generated
    // from `new Date()`), so the ordering is deterministic, not tie-dependent.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const oldest = storage.addMovie(newMovie({ title: 'Oldest' }));
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    const middle = storage.addMovie(newMovie({ title: 'Middle' }));
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    const newest = storage.addMovie(newMovie({ title: 'Newest' }));
    vi.useRealTimers();

    const list = storage.listMovies({ sort: 'recently-added' });

    expect(list.map((m) => m.id)).toEqual([newest.id, middle.id, oldest.id]);
  });

  it('a-z orders by title, case-insensitively', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'banana' }));
    storage.addMovie(newMovie({ title: 'Apple' }));
    storage.addMovie(newMovie({ title: 'cherry' }));

    const list = storage.listMovies({ sort: 'a-z' });

    expect(list.map((m) => m.title)).toEqual(['Apple', 'banana', 'cherry']);
  });

  it('year orders newest year first, with unknown year last', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Old', year: 1999 }));
    storage.addMovie(newMovie({ title: 'New', year: 2021 }));
    storage.addMovie(newMovie({ title: 'Mid', year: 2010 }));
    storage.addMovie(newMovie({ title: 'NoYear' })); // year omitted -> null

    const list = storage.listMovies({ sort: 'year' });

    expect(list.map((m) => m.title)).toEqual(['New', 'Mid', 'Old', 'NoYear']);
  });

  it('highest-rated orders by rating descending, with unrated last', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Mid', rating: 6 }));
    storage.addMovie(newMovie({ title: 'Top', rating: 10 }));
    storage.addMovie(newMovie({ title: 'Low', rating: 2 }));
    storage.addMovie(newMovie({ title: 'Unrated' })); // rating omitted -> null

    const list = storage.listMovies({ sort: 'highest-rated' });

    expect(list.map((m) => m.title)).toEqual(['Top', 'Mid', 'Low', 'Unrated']);
  });

  it('unwatched-first groups unwatched, then in-progress, then watched (title A–Z within group)', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Watched One', watched: true }));
    storage.addMovie(
      newMovie({ title: 'In Progress', resumePositionSeconds: 120 })
    );
    storage.addMovie(newMovie({ title: 'Zebra' })); // unwatched
    storage.addMovie(newMovie({ title: 'Apple' })); // unwatched

    const list = storage.listMovies({ sort: 'unwatched-first' });

    // Unwatched group first (A–Z within it), then in-progress, then watched.
    expect(list.map((m) => m.title)).toEqual([
      'Apple',
      'Zebra',
      'In Progress',
      'Watched One',
    ]);
    expect(list.map((m) => m.status)).toEqual([
      'unwatched',
      'unwatched',
      'in-progress',
      'watched',
    ]);
  });
});

// --- filters -------------------------------------------------------------------

describe('library: listMovies filters', () => {
  it('filters by genre name', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Actioner', genres: ['Action'] }));
    storage.addMovie(
      newMovie({ title: 'Crossover', genres: ['Drama', 'Action'] })
    );
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    const list = storage.listMovies({ sort: 'a-z', genre: 'Action' });

    expect(list.map((m) => m.title)).toEqual(['Actioner', 'Crossover']);
  });

  it('filters by minimum rating, excluding unrated movies', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Three', rating: 3 }));
    storage.addMovie(newMovie({ title: 'Seven', rating: 7 }));
    storage.addMovie(newMovie({ title: 'Ten', rating: 10 }));
    storage.addMovie(newMovie({ title: 'Unrated' })); // null rating

    const list = storage.listMovies({ sort: 'a-z', minRating: 7 });

    expect(list.map((m) => m.title)).toEqual(['Seven', 'Ten']);
  });

  it('filters to favorites only', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Loved', isFavorite: true }));
    storage.addMovie(newMovie({ title: 'Meh', isFavorite: false }));
    storage.addMovie(newMovie({ title: 'Also Loved', isFavorite: true }));

    const list = storage.listMovies({ sort: 'a-z', favoritesOnly: true });

    expect(list.map((m) => m.title)).toEqual(['Also Loved', 'Loved']);
  });

  it('filters to in-progress only (excludes unwatched and watched)', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Resuming', resumePositionSeconds: 300 })
    );
    storage.addMovie(newMovie({ title: 'Fresh' })); // unwatched
    storage.addMovie(
      // watched movie with a leftover resume position is NOT in-progress
      newMovie({
        title: 'Done',
        watched: true,
        resumePositionSeconds: 300,
      })
    );

    const list = storage.listMovies({ sort: 'a-z', inProgressOnly: true });

    expect(list.map((m) => m.title)).toEqual(['Resuming']);
  });

  it('combines a filter and a sort in a single query (genre + minRating, A–Z)', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Strong Action', genres: ['Action'], rating: 9 })
    );
    storage.addMovie(
      newMovie({ title: 'Weak Action', genres: ['Action'], rating: 4 })
    );
    storage.addMovie(
      newMovie({ title: 'Better Action', genres: ['Action'], rating: 8 })
    );
    storage.addMovie(
      newMovie({ title: 'Strong Drama', genres: ['Drama'], rating: 9 })
    );

    const list = storage.listMovies({
      sort: 'a-z',
      genre: 'Action',
      minRating: 8,
    });

    // Only high-rated Action titles, ordered A–Z.
    expect(list.map((m) => m.title)).toEqual([
      'Better Action',
      'Strong Action',
    ]);
  });
});

// --- search --------------------------------------------------------------------

describe('library: search by title', () => {
  it('searchMovies matches a case-insensitive title substring', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'The Matrix' }));
    storage.addMovie(newMovie({ title: 'Matrix Reloaded' }));
    storage.addMovie(newMovie({ title: 'Inception' }));

    const titles = storage
      .searchMovies('matrix')
      .map((m) => m.title)
      .sort();

    expect(titles).toEqual(['Matrix Reloaded', 'The Matrix']);
  });

  it('the listMovies search filter matches the same titles', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'The Matrix' }));
    storage.addMovie(newMovie({ title: 'Matrix Reloaded' }));
    storage.addMovie(newMovie({ title: 'Inception' }));

    const list = storage.listMovies({ sort: 'a-z', search: 'matrix' });

    expect(list.map((m) => m.title)).toEqual(['Matrix Reloaded', 'The Matrix']);
  });

  it('returns [] when nothing matches the search', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Inception' }));

    expect(storage.searchMovies('zzz-no-such-title')).toEqual([]);
  });
});

// --- listGenres ----------------------------------------------------------------

describe('library: listGenres', () => {
  it('returns only genres with at least one movie, each with its count', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'A1', genres: ['Action'] }));
    storage.addMovie(newMovie({ title: 'A2', genres: ['Action', 'Drama'] }));
    storage.addMovie(newMovie({ title: 'D1', genres: ['Drama'] }));

    const genres = storage.listGenres();
    const byName = new Map(genres.map((g) => [g.name, g.count]));

    // Only the two used genres appear (the other 10 seeded genres are absent).
    expect(byName.get('Action')).toBe(2);
    expect(byName.get('Drama')).toBe(2);
    expect(genres).toHaveLength(2);
    expect(byName.has('Comedy')).toBe(false);
    // Each carries the seeded genre id.
    expect(genres.every((g) => typeof g.id === 'string' && g.id)).toBe(true);
  });

  it('returns [] before any movie is added (no empty genre rows)', () => {
    const storage = freshStorage();

    expect(storage.listGenres()).toEqual([]);
  });
});

// --- empty results & full assembly ---------------------------------------------

describe('library: empty results and full-model assembly', () => {
  const SORTS: MovieSort[] = [
    'recently-added',
    'a-z',
    'year',
    'highest-rated',
    'unwatched-first',
  ];

  it('listMovies returns [] on an empty library for every sort', () => {
    const storage = freshStorage();

    for (const sort of SORTS) {
      expect(storage.listMovies({ sort })).toEqual([]);
    }
  });

  it('listMovies returns [] when filters match nothing (not an error)', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Only One', genres: ['Drama'] }));

    expect(() =>
      storage.listMovies({ sort: 'a-z', genre: 'Horror' })
    ).not.toThrow();
    expect(storage.listMovies({ sort: 'a-z', genre: 'Horror' })).toEqual([]);
  });

  it('each returned item is a fully assembled Movie (matches getMovie)', () => {
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

    const [item] = storage.listMovies({ sort: 'a-z' });

    // The list item is the same fully-assembled model getMovie returns:
    // ordered genres, parsed cast, ordered subtitles, derived status.
    expect(item).toEqual(storage.getMovie(added.id));
    expect(item.genres.map((g) => g.name)).toEqual(['Action', 'Sci-Fi']);
    expect(item.cast).toEqual(['Alice Stone', 'Bob Vance']);
    expect(item.subtitles.map((s) => s.language)).toEqual([
      'English',
      'German',
    ]);
    expect(item.status).toBe('in-progress');
  });
});
