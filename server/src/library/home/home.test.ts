// @vitest-environment node
//
// Phase 1 of 03 — "Named sections on the home payload" (issue #18), amending
// the 02 aggregate (issue #12).
//
// These tests exercise the home payload through the `library/` repository's
// public `LibraryStorage` interface — `getHome()`, the single call
// `GET /api/home` serves. Nothing is mocked: a real, fully migrated `:memory:`
// SQLite database is seeded through `addMovie`, per the PRD's "real in-memory
// SQLite, not a mock" testing decision, and the route layer is deliberately not
// involved (it is a pure passthrough, which is the reason for that seam).
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
 * Add `count` movies, each a day newer than the last, so `recently-added`
 * ordering is deterministic rather than tie-dependent (`created_at` is
 * repo-generated from `new Date()`). `build` shapes movie `n`, numbered from 1
 * (oldest) to `count` (newest), and receives that number zero-padded for titles.
 */
function seedByAge(
  storage: ReturnType<typeof createSqliteStorage>,
  count: number,
  build: (label: string) => Partial<NewMovie>
): void {
  vi.useFakeTimers();
  for (let n = 1; n <= count; n += 1) {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, n)));
    storage.addMovie(newMovie(build(String(n).padStart(2, '0'))));
  }
  vi.useRealTimers();
}

/** `count` movies in one genre, oldest first, titled `{genre} 01`…`{genre} NN`. */
function seedGenre(
  storage: ReturnType<typeof createSqliteStorage>,
  genre: string,
  count: number
): void {
  seedByAge(storage, count, (label) => ({
    title: `${genre} ${label}`,
    genres: [genre],
  }));
}

/** `count` in-progress movies (a resume position, not watched), oldest first. */
function seedInProgress(
  storage: ReturnType<typeof createSqliteStorage>,
  count: number
): void {
  seedByAge(storage, count, (label) => ({
    title: `Started ${label}`,
    resumePositionSeconds: 600,
  }));
}

// --- genre rows: the 02 behaviour, unchanged under the new envelope -------------

describe('library: getHome genre rows', () => {
  it('returns one row per populated genre, alphabetically by genre name', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Actioner', genres: ['Action'] }));
    storage.addMovie(newMovie({ title: 'Chiller', genres: ['Horror'] }));

    const { rows } = storage.getHome();

    expect(rows.map((row) => row.genre)).toEqual(['Action', 'Drama', 'Horror']);
  });

  it('produces no row for a genre with no movies', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Only One', genres: ['Drama'] }));

    const { rows } = storage.getHome();

    // The other 11 seeded genres carry no movies, so they are simply absent.
    expect(rows.map((row) => row.genre)).toEqual(['Drama']);
  });

  it('lists a movie tagged with several genres in each of those rows', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Crossover', genres: ['Action', 'Drama', 'Sci-Fi'] })
    );
    storage.addMovie(newMovie({ title: 'Actioner', genres: ['Action'] }));

    const { rows } = storage.getHome();
    const titlesByGenre = new Map(
      rows.map((row) => [row.genre, row.movies.map((m) => m.title).sort()])
    );

    expect(titlesByGenre.get('Action')).toEqual(['Actioner', 'Crossover']);
    expect(titlesByGenre.get('Drama')).toEqual(['Crossover']);
    expect(titlesByGenre.get('Sci-Fi')).toEqual(['Crossover']);
  });

  it('caps a row at 15 movies, newest first', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 20);

    const [row] = storage.getHome().rows;

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

    const { rows } = storage.getHome();
    const byGenre = new Map(rows.map((row) => [row.genre, row]));

    expect(byGenre.get('Action')?.count).toBe(20);
    expect(byGenre.get('Action')?.movies).toHaveLength(15);
    expect(byGenre.get('Drama')?.count).toBe(3);
    expect(byGenre.get('Drama')?.movies).toHaveLength(3);
  });
});

// --- continue watching ---------------------------------------------------------

describe('library: getHome continue watching', () => {
  it('holds only in-progress movies — the unstarted one is left out', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Untouched' }));
    storage.addMovie(
      newMovie({ title: 'Halfway', resumePositionSeconds: 600 })
    );

    const { continueWatching } = storage.getHome();

    expect(continueWatching.map((m) => m.title)).toEqual(['Halfway']);
  });

  it('leaves out a movie that was finished, even one still carrying a position', () => {
    const storage = freshStorage();
    // Watched is the deciding flag: a stale resume position does not resurrect
    // a finished movie into the row.
    storage.addMovie(
      newMovie({ title: 'Finished', watched: true, resumePositionSeconds: 600 })
    );
    storage.addMovie(newMovie({ title: 'Halfway', resumePositionSeconds: 90 }));

    const { continueWatching } = storage.getHome();

    expect(continueWatching.map((m) => m.title)).toEqual(['Halfway']);
  });

  it('drops a movie once it is marked watched', () => {
    const storage = freshStorage();
    const started = storage.addMovie(
      newMovie({ title: 'Halfway', resumePositionSeconds: 600 })
    );
    expect(storage.getHome().continueWatching).toHaveLength(1);

    storage.markWatched(started.id);

    expect(storage.getHome().continueWatching).toEqual([]);
  });

  it('orders recently-added first', () => {
    const storage = freshStorage();
    seedInProgress(storage, 3);

    const { continueWatching } = storage.getHome();

    expect(continueWatching.map((m) => m.title)).toEqual([
      'Started 03',
      'Started 02',
      'Started 01',
    ]);
  });

  it('caps at the same 15 as the genre rows, newest first', () => {
    const storage = freshStorage();
    seedInProgress(storage, 20);

    const { continueWatching } = storage.getHome();

    expect(continueWatching).toHaveLength(15);
    expect(continueWatching.map((m) => m.title)).toEqual([
      'Started 20',
      'Started 19',
      'Started 18',
      'Started 17',
      'Started 16',
      'Started 15',
      'Started 14',
      'Started 13',
      'Started 12',
      'Started 11',
      'Started 10',
      'Started 09',
      'Started 08',
      'Started 07',
      'Started 06',
    ]);
  });

  it('is empty when nothing has been started', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Untouched', genres: ['Drama'] }));

    const home = storage.getHome();

    expect(home.continueWatching).toEqual([]);
    // The library is not empty — only the continue section is.
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
  });

  it('lists an in-progress movie here and still in its genre row', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Halfway',
        genres: ['Action'],
        resumePositionSeconds: 600,
      })
    );

    const home = storage.getHome();

    // Two different questions — "what am I part-way through" and "what Action
    // do I own" — so the same movie earns a place in both answers.
    expect(home.continueWatching.map((m) => m.title)).toEqual(['Halfway']);
    expect(home.rows.map((row) => row.genre)).toEqual(['Action']);
    expect(home.rows[0].movies.map((m) => m.title)).toEqual(['Halfway']);
  });

  it('lists an in-progress movie with no genre tags, which earns no row', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Untagged', resumePositionSeconds: 42 })
    );

    const home = storage.getHome();

    expect(home.continueWatching.map((m) => m.title)).toEqual(['Untagged']);
    expect(home.rows).toEqual([]);
  });
});

// --- the Library query ---------------------------------------------------------
//
// 05 — Search + filter, Phase 1: "search on the server, end to end" (issue #31).
// One Library query produces one Home payload: the genre rows and the Continue
// Watching row are built from it, so the top of the screen can never disagree
// with the rest of it.

describe('library: getHome under a Library query', () => {
  it('narrows the genre rows to the movies that match the query', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Comic Caper', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'Comic Relief', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      search: 'comic',
    });
    const titlesByGenre = new Map(
      rows.map((row) => [row.genre, row.movies.map((m) => m.title)])
    );

    expect(titlesByGenre.get('Comedy')).toEqual(['Comic Caper']);
    expect(titlesByGenre.get('Drama')).toEqual(['Comic Relief']);
  });

  it("keeps a narrowed row's count at the genre's unfiltered total", () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Harbor Lights', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Sad Ending', genres: ['Drama'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      search: 'harbor',
    });

    // The row shows 1 of 3, and "View all 3" stays honest about the genre.
    expect(rows).toHaveLength(1);
    expect(rows[0].genre).toBe('Drama');
    expect(rows[0].movies.map((m) => m.title)).toEqual(['Harbor Lights']);
    expect(rows[0].count).toBe(3);
  });

  it('drops a row whose movies all failed the query', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Comic Caper', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Chiller', genres: ['Horror'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      search: 'comic',
    });

    // A screenful of empty rows is not an answer — the rows that matched
    // nothing are gone, not rendered blank.
    expect(rows.map((row) => row.genre)).toEqual(['Comedy']);
  });

  it('still caps a narrowed row at 15, newest first', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 20); // titles "Action 01".."Action 20"
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      search: 'action',
    });

    expect(rows.map((row) => row.genre)).toEqual(['Action']);
    expect(rows[0].movies).toHaveLength(15);
    expect(rows[0].count).toBe(20);
    expect(rows[0].movies[0].title).toBe('Action 20');
    expect(rows[0].movies[14].title).toBe('Action 06');
  });

  it('narrows the continue section off the same query', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Comic Caper',
        genres: ['Comedy'],
        resumePositionSeconds: 600,
      })
    );
    storage.addMovie(
      newMovie({
        title: 'Weepie',
        genres: ['Drama'],
        resumePositionSeconds: 300,
      })
    );

    const home = storage.getHome({ sort: 'recently-added', search: 'comic' });

    // Both sections narrow together, off the one query.
    expect(home.continueWatching.map((m) => m.title)).toEqual(['Comic Caper']);
    expect(home.rows.map((row) => row.genre)).toEqual(['Comedy']);
  });

  it('drops an in-progress movie that fails the query from the continue section', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Halfway', resumePositionSeconds: 600 })
    );

    const home = storage.getHome({
      sort: 'recently-added',
      search: 'zzz-nothing',
    });

    expect(home.continueWatching).toEqual([]);
    expect(home.rows).toEqual([]);
  });

  it('matches the widened search inside the rows (synopsis and genre name)', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Northwind',
        genres: ['Action'],
        synopsis: 'A lighthouse keeper on a fading coast.',
      })
    );
    storage.addMovie(newMovie({ title: 'Decoy', genres: ['Action'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      search: 'lighthouse',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].movies.map((m) => m.title)).toEqual(['Northwind']);
  });

  /**
   * Regression guard on the signature change — green before and after. An
   * un-narrowed home is what the browse screen has rendered since 02, and
   * growing a query parameter must not move it.
   */
  it('returns the unfiltered home when no query is given', () => {
    const storage = freshStorage();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Actioner', genres: ['Action'] }));
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    storage.addMovie(
      newMovie({
        title: 'Halfway',
        genres: ['Action'],
        resumePositionSeconds: 600,
      })
    );
    vi.useRealTimers();

    const home = storage.getHome();

    expect(home.rows.map((row) => row.genre)).toEqual(['Action', 'Drama']);
    expect(home.rows.map((row) => row.movies.map((m) => m.title))).toEqual([
      ['Halfway', 'Actioner'],
      ['Weepie'],
    ]);
    expect(home.continueWatching.map((m) => m.title)).toEqual(['Halfway']);
    // The default query and no query at all are the same request.
    expect(home).toEqual(storage.getHome({ sort: 'recently-added' }));
  });
});

// --- payload shape -------------------------------------------------------------

describe('library: getHome payload shape', () => {
  it('returns both sections empty for an empty library', () => {
    const storage = freshStorage();

    expect(storage.getHome()).toEqual({ continueWatching: [], rows: [] });
  });

  it('carries fully assembled Movie models in both sections (matching getMovie)', () => {
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

    const home = storage.getHome();
    const [movie] = home.rows[0].movies;
    const [started] = home.continueWatching;

    // Same model the rest of the repository returns: ordered genres, parsed
    // cast, ordered subtitles, derived status — the cards need all of it.
    expect(movie).toEqual(storage.getMovie(added.id));
    expect(movie.genres.map((g) => g.name)).toEqual(['Action', 'Sci-Fi']);
    expect(movie.status).toBe('in-progress');
    expect(started).toEqual(storage.getMovie(added.id));
  });
});

// --- 05 — Search + filter, Phase 4: "the Genre dropdown" (issue #36) ------------

describe('library: getHome under a genre filter', () => {
  /** Three populated genres, one movie apiece, so a row can only be missing on purpose. */
  function seedThreeGenres(
    storage: ReturnType<typeof createSqliteStorage>
  ): void {
    storage.addMovie(newMovie({ title: 'Comic Caper', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Chiller', genres: ['Horror'] }));
  }

  it('builds only the asked-for genre’s row, and leaves every other one out', () => {
    const storage = freshStorage();
    seedThreeGenres(storage);

    const { rows } = storage.getHome({
      sort: 'recently-added',
      genre: 'Drama',
    });

    // Choosing a genre is a narrowing of the whole screen, not a highlight:
    // exactly one row survives it.
    expect(rows).toHaveLength(1);
    expect(rows[0].genre).toBe('Drama');
    expect(rows[0].movies.map((m) => m.title)).toEqual(['Weepie']);
  });

  it('keeps that row’s count at the genre’s unfiltered total', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Drama', 24); // "Drama 01".."Drama 24"
    storage.addMovie(newMovie({ title: 'Comic Caper', genres: ['Comedy'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      genre: 'Drama',
    });

    // One row, showing the 15 a carousel holds — but "View all 24" still says
    // 24, because the count is the genre's rather than the query's.
    expect(rows).toHaveLength(1);
    expect(rows[0].movies).toHaveLength(15);
    expect(rows[0].count).toBe(24);
  });

  it('still caps the one surviving row at 15, newest first', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 20);

    const { rows } = storage.getHome({
      sort: 'recently-added',
      genre: 'Action',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].movies).toHaveLength(15);
    expect(rows[0].count).toBe(20);
    expect(rows[0].movies[0].title).toBe('Action 20');
  });

  it('narrows that row by the search term as well, in one query', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Comic Caper', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'Comic Relief', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      genre: 'Drama',
      search: 'comic',
    });

    // "Comedies about the sea" is one question, not two: the genre picks the
    // row and the term picks what is in it.
    expect(rows).toHaveLength(1);
    expect(rows[0].genre).toBe('Drama');
    expect(rows[0].movies.map((m) => m.title)).toEqual(['Comic Relief']);
  });

  it('orders that row by the sort the query carries', () => {
    const storage = freshStorage();
    seedByAge(storage, 3, (label) => ({
      title: `Drama ${label}`,
      genres: ['Drama'],
    }));

    const { rows } = storage.getHome({ sort: 'a-z', genre: 'Drama' });

    expect(rows[0].movies.map((m) => m.title)).toEqual([
      'Drama 01',
      'Drama 02',
      'Drama 03',
    ]);
  });

  it('comes back with no rows at all when the genre holds nothing that matched', () => {
    const storage = freshStorage();
    seedThreeGenres(storage);

    const { rows } = storage.getHome({
      sort: 'recently-added',
      genre: 'Drama',
      search: 'zzz-nothing',
    });

    // The empty-row drop rule still applies to the one row that was built —
    // a blank shelf is not an answer.
    expect(rows).toEqual([]);
  });

  it('comes back with no rows for a genre the library does not hold', () => {
    const storage = freshStorage();
    seedThreeGenres(storage);

    expect(
      storage.getHome({ sort: 'recently-added', genre: 'Westerns' }).rows
    ).toEqual([]);
  });

  it('narrows the continue section to that genre too, off the same query', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Comic Caper',
        genres: ['Comedy'],
        resumePositionSeconds: 600,
      })
    );
    storage.addMovie(
      newMovie({
        title: 'Weepie',
        genres: ['Drama'],
        resumePositionSeconds: 300,
      })
    );

    const home = storage.getHome({ sort: 'recently-added', genre: 'Drama' });

    // The top of the screen can never disagree with the rest of it.
    expect(home.continueWatching.map((m) => m.title)).toEqual(['Weepie']);
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
  });

  it('builds every populated genre’s row again once the genre is dropped', () => {
    const storage = freshStorage();
    seedThreeGenres(storage);

    // "All Genres" is the absence of the filter, not a genre of its own.
    expect(
      storage.getHome({ sort: 'recently-added' }).rows.map((row) => row.genre)
    ).toEqual(['Comedy', 'Drama', 'Horror']);
  });

  it('leaves a movie tagged with several genres in the row that was asked for', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Both', genres: ['Comedy', 'Drama'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      genre: 'Drama',
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].genre).toBe('Drama');
    expect(rows[0].movies.map((m) => m.title)).toEqual(['Both']);
  });
});
