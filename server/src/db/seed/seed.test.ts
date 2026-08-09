// @vitest-environment node
//
// 03 — Card Carousel refactor, commit 1: "Add the dev seed script" (issue #21).
//
// These tests exercise the seed through the real `LibraryStorage` interface
// against a real, fully-migrated `:memory:` SQLite database — the same "real
// in-memory SQLite, not a mock" convention the rest of the server-side suite
// follows. Nothing about `better-sqlite3` is stubbed, so an unknown genre name
// or a schema CHECK violation in a fixture fails here rather than at the
// developer's terminal.
//
// Two properties matter more than the fixture data itself, because both are
// what make it safe to point this at the on-disk dev database: a run is
// idempotent, and a run cannot touch a movie that arrived any other way.

import { afterEach, describe, expect, it } from 'vitest';

import { createSqliteStorage } from '../../library';
import { SEED_MOVIES, SEED_VIDEO_PREFIX, seedLibrary } from './seed';

// --- per-test resource tracking ------------------------------------------------

interface Closeable {
  close(): void;
}

const closeables: Closeable[] = [];

/** A fresh, fully-migrated in-memory repository, closed automatically. */
function freshStorage(): ReturnType<typeof createSqliteStorage> {
  const storage = createSqliteStorage(':memory:');
  closeables.push(storage);
  return storage;
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

/**
 * How many movies one genre row needs before it overflows the visible width and
 * the carousel's arrows appear. Six cards fit comfortably on a typical window,
 * so eight is past the edge with room to spare — the seed exists to make those
 * arrows visible, and this is the assertion that keeps them so.
 */
const MIN_OVERFLOWING_ROW = 8;

const titlesOf = (movies: { title: string }[]) =>
  movies.map((movie) => movie.title).sort();

describe('the dev seed — what a run writes', () => {
  it('writes the whole fixture set into an empty library', () => {
    const storage = freshStorage();

    seedLibrary(storage);

    expect(titlesOf(storage.listMovies({ sort: 'a-z' }))).toEqual(
      titlesOf([...SEED_MOVIES])
    );
  });

  it('reports what it removed and what it added', () => {
    const storage = freshStorage();

    const first = seedLibrary(storage);
    const second = seedLibrary(storage);

    expect(first).toEqual({ removed: 0, added: SEED_MOVIES.length });
    expect(second).toEqual({
      removed: SEED_MOVIES.length,
      added: SEED_MOVIES.length,
    });
  });

  it('stores every fixture under the reserved video prefix', () => {
    const storage = freshStorage();

    seedLibrary(storage);

    // The delete pass is scoped to this prefix, so a fixture that escaped it
    // would silently accumulate a duplicate on every subsequent run.
    for (const movie of storage.listMovies({ sort: 'a-z' })) {
      expect(movie.videoPath.startsWith(SEED_VIDEO_PREFIX)).toBe(true);
    }
  });
});

describe('the dev seed — running it twice', () => {
  it('leaves the same library rather than doubling it', () => {
    const storage = freshStorage();

    seedLibrary(storage);
    seedLibrary(storage);

    expect(storage.listMovies({ sort: 'a-z' })).toHaveLength(
      SEED_MOVIES.length
    );
  });

  it('converges on the current fixtures, not on the rows it wrote before', () => {
    const storage = freshStorage();

    seedLibrary(storage);
    // Edit a seed row the way a developer poking at the app would, then re-run:
    // the run has to overwrite it, not preserve it.
    const [first] = storage.listMovies({ sort: 'a-z' });
    storage.updateMovie(first.id, { title: 'Edited By Hand' });
    seedLibrary(storage);

    const titles = titlesOf(storage.listMovies({ sort: 'a-z' }));
    expect(titles).not.toContain('Edited By Hand');
    expect(titles).toEqual(titlesOf([...SEED_MOVIES]));
  });
});

describe('the dev seed — movies it did not write', () => {
  it('leaves a movie added any other way untouched', () => {
    const storage = freshStorage();
    const mine = storage.addMovie({
      title: 'A Real Import',
      videoPath: 'A Real Import (2024)/a-real-import.mkv',
      genres: ['Drama'],
    });

    seedLibrary(storage);
    seedLibrary(storage);

    const survivor = storage.getMovie(mine.id);
    expect(survivor?.title).toBe('A Real Import');
    expect(storage.listMovies({ sort: 'a-z' })).toHaveLength(
      SEED_MOVIES.length + 1
    );
  });
});

describe('the dev seed — the states it puts on the home screen', () => {
  it('fills a genre row past the point where the carousel needs arrows', () => {
    const storage = freshStorage();

    seedLibrary(storage);

    const biggest = Math.max(
      ...storage.getHome().rows.map((row) => row.movies.length)
    );
    expect(biggest).toBeGreaterThanOrEqual(MIN_OVERFLOWING_ROW);
  });

  it('gives Continue Watching tiles with a known runtime and one without', () => {
    const storage = freshStorage();

    seedLibrary(storage);

    const { continueWatching } = storage.getHome();
    expect(
      continueWatching.filter((movie) => movie.runtimeMinutes !== null).length
    ).toBeGreaterThan(1);
    expect(
      continueWatching.some((movie) => movie.runtimeMinutes === null)
    ).toBe(true);
  });

  it('includes an in-progress movie with no genres, which only that row can show', () => {
    const storage = freshStorage();

    seedLibrary(storage);

    const untagged = storage
      .getHome()
      .continueWatching.filter((movie) => movie.genres.length === 0);
    expect(untagged).toHaveLength(1);
  });

  it('covers the watched and unwatched card states as well as in-progress', () => {
    const storage = freshStorage();

    seedLibrary(storage);
    const movies = storage.listMovies({ sort: 'a-z' });

    expect(movies.some((movie) => movie.status === 'watched')).toBe(true);
    expect(movies.some((movie) => movie.status === 'unwatched')).toBe(true);
    expect(movies.some((movie) => movie.status === 'in-progress')).toBe(true);
  });

  it('leaves every fixture without artwork, so the cards render their gradient', () => {
    const storage = freshStorage();

    seedLibrary(storage);

    for (const movie of storage.listMovies({ sort: 'a-z' })) {
      expect(movie.posterPath).toBeNull();
      expect(movie.backdropPath).toBeNull();
    }
  });
});
