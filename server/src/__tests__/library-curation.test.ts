// @vitest-environment node
//
// Phase 4 — "Curation mutators (favorite, rating)" (issue #6).
//
// These tests exercise a REAL SQLite database through the `library/`
// repository's public `LibraryStorage` interface — `setFavorite` and
// `setRating`. Both mutators return `void` (the interface is locked in the
// design log), so every assertion reads the persisted state back through
// `getMovie` / `listMovies`. Nothing is mocked: the actual UPDATE statements,
// the rating CHECK constraint, and the row→model assembly are exercised for
// real, per the PRD's "real in-memory SQLite, not a mock" testing decision.
//
// A fresh, isolated `:memory:` database is created per test via the factory.

import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteStorage } from '../library';
import type { NewMovie } from '../../../src/types';

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

// --- setFavorite ---------------------------------------------------------------

describe('library: setFavorite', () => {
  it('sets the favorite flag (reads back through getMovie)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());
    expect(added.isFavorite).toBe(false);

    storage.setFavorite(added.id, true);

    expect(storage.getMovie(added.id)?.isFavorite).toBe(true);
  });

  it('clears the favorite flag back to false', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ isFavorite: true }));
    expect(added.isFavorite).toBe(true);

    storage.setFavorite(added.id, false);

    expect(storage.getMovie(added.id)?.isFavorite).toBe(false);
  });

  it('surfaces the movie in the favoritesOnly set (the Favorites row)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());
    // It starts outside the favorites set.
    expect(
      storage
        .listMovies({ sort: 'recently-added', favoritesOnly: true })
        .map((m) => m.id)
    ).not.toContain(added.id);

    storage.setFavorite(added.id, true);

    expect(
      storage
        .listMovies({ sort: 'recently-added', favoritesOnly: true })
        .map((m) => m.id)
    ).toContain(added.id);
  });

  it('drops the movie out of the favoritesOnly set when cleared', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ isFavorite: true }));
    expect(
      storage
        .listMovies({ sort: 'recently-added', favoritesOnly: true })
        .map((m) => m.id)
    ).toContain(added.id);

    storage.setFavorite(added.id, false);

    expect(
      storage
        .listMovies({ sort: 'recently-added', favoritesOnly: true })
        .map((m) => m.id)
    ).not.toContain(added.id);
  });

  it('preserves unrelated metadata (rating, title)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ rating: 7 }));

    storage.setFavorite(added.id, true);

    const after = storage.getMovie(added.id);
    expect(after?.isFavorite).toBe(true);
    expect(after?.rating).toBe(7);
    expect(after?.title).toBe('Northwind');
  });
});

// --- setRating -----------------------------------------------------------------

describe('library: setRating', () => {
  it('sets a 0–10 rating (reads back through getMovie)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());
    expect(added.rating).toBe(null);

    storage.setRating(added.id, 8);

    expect(storage.getMovie(added.id)?.rating).toBe(8);
  });

  it('overrides a TMDB-seeded rating', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ rating: 6 }));
    expect(added.rating).toBe(6);

    storage.setRating(added.id, 9);

    expect(storage.getMovie(added.id)?.rating).toBe(9);
  });

  it('accepts the boundary values 0 and 10', () => {
    const storage = freshStorage();
    const low = storage.addMovie(newMovie());
    const high = storage.addMovie(newMovie());

    storage.setRating(low.id, 0);
    storage.setRating(high.id, 10);

    expect(storage.getMovie(low.id)?.rating).toBe(0);
    expect(storage.getMovie(high.id)?.rating).toBe(10);
  });

  it('clears to unrated with null (distinct from a stored 0)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ rating: 5 }));

    storage.setRating(added.id, null);

    expect(storage.getMovie(added.id)?.rating).toBe(null);
  });

  it('stores a literal 0 that is not treated as unrated', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie());

    storage.setRating(added.id, 0);

    // A stored 0 is a real rating, distinct from null/unrated.
    expect(storage.getMovie(added.id)?.rating).toBe(0);
    expect(storage.getMovie(added.id)?.rating).not.toBe(null);
  });

  it('rejects an above-range rating via the CHECK, never persisting it', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ rating: 4 }));

    expect(() => storage.setRating(added.id, 11)).toThrow(/CHECK constraint/i);

    // The prior rating is left untouched — nothing was committed.
    expect(storage.getMovie(added.id)?.rating).toBe(4);
  });

  it('rejects a below-range rating via the CHECK, never persisting it', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ rating: 4 }));

    expect(() => storage.setRating(added.id, -1)).toThrow(/CHECK constraint/i);

    expect(storage.getMovie(added.id)?.rating).toBe(4);
  });

  it('preserves unrelated metadata (favorite, title)', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ isFavorite: true }));

    storage.setRating(added.id, 7);

    const after = storage.getMovie(added.id);
    expect(after?.rating).toBe(7);
    expect(after?.isFavorite).toBe(true);
    expect(after?.title).toBe('Northwind');
  });
});
