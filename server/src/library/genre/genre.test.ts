// @vitest-environment node
//
// Phase 1 of 06 — "The genre payload, end to end" (issue #43).
//
// These tests exercise the genre aggregate through the `library/` repository's
// public `LibraryStorage` interface — `getGenre()`, the single call
// `GET /api/genre/:name` serves. Nothing is mocked: a real, fully migrated
// `:memory:` SQLite database is seeded through `addMovie`, per the PRD's "real
// SQLite, nothing mocked" testing decision, and the route layer is deliberately
// not involved (it is a thin parse-and-serialize seam, tested in
// `routes.test.ts`).
//
// A fresh, isolated `:memory:` database is created per test via the factory.
// The one exception is the wiring guard at the bottom, which needs two handles
// on the *same* rows and so uses a temp file.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createSqliteStorage } from '..';
import { openDatabase } from '../../db';
import { createBrowse } from '../browse/browse';
import { createMovieReader } from '../read/read';
import { createGenre } from './genre';
import type { GenrePayload, GenreQuery, MovieSort, NewMovie } from '@/types';

// --- per-test resource tracking ------------------------------------------------

interface Closeable {
  close(): void;
}

const closeables: Closeable[] = [];
const tempDirs: string[] = [];

function track<T extends Closeable>(resource: T): T {
  closeables.push(resource);
  return resource;
}

/** A fresh, fully-migrated in-memory repository, closed automatically. */
function freshStorage(): ReturnType<typeof createSqliteStorage> {
  return track(createSqliteStorage(':memory:'));
}

/** A path to a database file no other test shares, removed automatically. */
function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'familyflix-genre-'));
  tempDirs.push(dir);
  return join(dir, 'familyflix.db');
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
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
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

/** The titles of a payload's movies, in the order the payload carries them. */
function titles(payload: GenrePayload): string[] {
  return payload.movies.map((movie) => movie.title);
}

/**
 * One Drama shelf whose every sort disagrees with every other **and** with the
 * recently-added default, so no ordering assertion below can pass on a
 * coincidence: mixed case, a missing year, an unrated title, and one movie in
 * each of the three watch states.
 */
function seedSortableDrama(
  storage: ReturnType<typeof createSqliteStorage>
): void {
  vi.useFakeTimers();

  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  storage.addMovie(
    newMovie({
      title: 'Zephyr',
      videoPath: 'Zephyr (1999)/zephyr.mkv',
      year: 1999,
      rating: 4,
      watched: true,
      genres: ['Drama'],
    })
  );

  vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
  storage.addMovie(
    newMovie({
      title: 'apple Grove',
      videoPath: 'apple Grove (2021)/apple-grove.mkv',
      year: 2021,
      genres: ['Drama'],
    })
  );

  vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
  storage.addMovie(
    newMovie({
      title: 'Backwater',
      videoPath: 'Backwater/backwater.mkv',
      resumePositionSeconds: 300,
      genres: ['Drama'],
    })
  );

  vi.setSystemTime(new Date('2026-01-04T00:00:00.000Z'));
  storage.addMovie(
    newMovie({
      title: 'Meridian',
      videoPath: 'Meridian/meridian.mkv',
      rating: 9,
      genres: ['Drama'],
    })
  );

  vi.useRealTimers();
}

// --- the whole genre, uncapped -------------------------------------------------

describe('library: getGenre', () => {
  it('returns every movie in the genre, with no cap', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 20);

    const payload = storage.getGenre('Action');

    // A genre row stops at 15; this screen *is* "View all", so the other five
    // are exactly what it exists to reach.
    expect(payload.movies).toHaveLength(20);
    expect(payload.total).toBe(20);
  });

  it('names the genre it was asked for in the payload', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Drama', 2);

    expect(storage.getGenre('Drama').genre).toBe('Drama');
  });

  it('holds only that genre, leaving the rest of the library out', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Chiller', genres: ['Horror'] }));
    storage.addMovie(newMovie({ title: 'Untagged' }));

    expect(titles(storage.getGenre('Drama'))).toEqual(['Weepie']);
  });

  it('lists a movie tagged with several genres under each of them', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Crossover', genres: ['Action', 'Drama', 'Sci-Fi'] })
    );
    storage.addMovie(newMovie({ title: 'Actioner', genres: ['Action'] }));

    expect(titles(storage.getGenre('Action')).sort()).toEqual([
      'Actioner',
      'Crossover',
    ]);
    expect(titles(storage.getGenre('Drama'))).toEqual(['Crossover']);
    expect(titles(storage.getGenre('Sci-Fi'))).toEqual(['Crossover']);
  });

  it('answers an omitted query with the genre in the default order', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 3);

    // Recently-added, newest first — the order the library has been in since
    // 02, and the one a "View all" with no `?sort=` is asking for.
    expect(titles(storage.getGenre('Action'))).toEqual([
      'Action 03',
      'Action 02',
      'Action 01',
    ]);
  });

  it('answers an empty payload for a genre the library does not hold', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    // A stale bookmark for an emptied genre is a normal "nothing here", not an
    // error — the caller still has a name to put in the heading.
    expect(storage.getGenre('Westerns')).toEqual({
      genre: 'Westerns',
      total: 0,
      movies: [],
    });
  });

  it('answers an empty payload for every genre of an empty library', () => {
    const storage = freshStorage();

    expect(storage.getGenre('Drama')).toEqual({
      genre: 'Drama',
      total: 0,
      movies: [],
    });
  });

  it('matches the genre name exactly as the library spells it', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    // The name travels through unnormalised, the way `?genre=` already does.
    expect(storage.getGenre('drama').movies).toEqual([]);
    expect(titles(storage.getGenre('Drama'))).toEqual(['Weepie']);
  });

  it('carries a genre whose name has a space in it, verbatim', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    // The name is echoed exactly as asked for, spaces and all — the heading is
    // drawn from it, and the seeded 12-genre pool holds no two-word name to
    // look up. `GET /api/genre/:name` is where the decoding is guarded.
    expect(storage.getGenre('Science Fiction')).toEqual({
      genre: 'Science Fiction',
      total: 0,
      movies: [],
    });
  });

  it('assembles every genre and subtitle on each movie it returns', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'The Quiet Harbor',
        videoPath: 'The Quiet Harbor (2016)/the-quiet-harbor.mkv',
        year: 2016,
        synopsis: 'A lighthouse keeper takes in a runaway girl.',
        director: 'Ana Sørensen',
        cast: ['Marit Holt', 'Peder Vinge'],
        rating: 7,
        resumePositionSeconds: 3120,
        genres: ['Drama', 'Romance'],
        subtitles: [
          { path: 'The Quiet Harbor (2016)/en.srt', language: 'en' },
          { path: 'The Quiet Harbor (2016)/pt.srt', language: 'pt' },
        ],
      })
    );

    const [movie] = storage.getGenre('Drama').movies;

    // The grid draws cards from these, so a collection dropped on the way out
    // is a card that renders wrong — the same full model `getMovie` returns.
    expect(movie.genres.map((genre) => genre.name)).toEqual([
      'Drama',
      'Romance',
    ]);
    expect(movie.subtitles.map((subtitle) => subtitle.language)).toEqual([
      'en',
      'pt',
    ]);
    expect(movie.cast).toEqual(['Marit Holt', 'Peder Vinge']);
    expect(movie.status).toBe('in-progress');
    expect(movie.director).toBe('Ana Sørensen');
    expect(movie.year).toBe(2016);
    expect(movie.rating).toBe(7);
  });
});

// --- the search arm ------------------------------------------------------------

describe('library: getGenre under a search', () => {
  it('narrows the list to movies whose title matches', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Harbor Lights', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    expect(titles(storage.getGenre('Drama', { search: 'harbor' }))).toEqual([
      'Harbor Lights',
    ]);
  });

  it('narrows the list on the synopsis as well as the title', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Weepie',
        synopsis: 'A slow farewell on a fading coast.',
        genres: ['Drama'],
      })
    );
    storage.addMovie(newMovie({ title: 'Harbor Lights', genres: ['Drama'] }));

    // The same widened arm `listMovies` already carries, reused unchanged.
    expect(
      titles(storage.getGenre('Drama', { search: 'fading coast' }))
    ).toEqual(['Weepie']);
  });

  it("keeps total at the genre's unfiltered count while a search narrows it", () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 20);

    const payload = storage.getGenre('Action', { search: 'Action 07' });

    // "12 of 214 titles" — the count label needs both numbers, and the total is
    // the one "View all 214" already promised on the row.
    expect(titles(payload)).toEqual(['Action 07']);
    expect(payload.total).toBe(20);
  });

  it('answers an empty list, and the true total, when nothing matches', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 3);

    const payload = storage.getGenre('Action', { search: 'zzz-nothing' });

    // "No matches" — a populated genre with nothing found, which the screen
    // tells apart from an empty genre by the total.
    expect(payload.movies).toEqual([]);
    expect(payload.total).toBe(3);
  });

  it('searches inside the genre, never across the whole library', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Harbor Lights', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Harbor Chase', genres: ['Action'] }));

    expect(titles(storage.getGenre('Drama', { search: 'harbor' }))).toEqual([
      'Harbor Lights',
    ]);
  });
});

// --- the five sorts ------------------------------------------------------------

describe('library: getGenre under a sort', () => {
  /** The Drama shelf under one sort — what each sort below claims to order. */
  function dramaUnder(
    storage: ReturnType<typeof createSqliteStorage>,
    sort: MovieSort
  ): string[] {
    return titles(storage.getGenre('Drama', { sort }));
  }

  it('orders by title for a-z, without minding the case', () => {
    const storage = freshStorage();
    seedSortableDrama(storage);

    // A parent looking for a title does not know which of them was
    // capitalised, so "apple Grove" sorts before "Backwater".
    expect(dramaUnder(storage, 'a-z')).toEqual([
      'apple Grove',
      'Backwater',
      'Meridian',
      'Zephyr',
    ]);
  });

  it('orders newest year first, leaving an unknown year last', () => {
    const storage = freshStorage();
    seedSortableDrama(storage);

    expect(dramaUnder(storage, 'year')).toEqual([
      'apple Grove',
      'Zephyr',
      'Backwater',
      'Meridian',
    ]);
  });

  it('orders best first, leaving an unrated movie last', () => {
    const storage = freshStorage();
    seedSortableDrama(storage);

    expect(dramaUnder(storage, 'highest-rated')).toEqual([
      'Meridian',
      'Zephyr',
      'apple Grove',
      'Backwater',
    ]);
  });

  it('orders unwatched, then in-progress, then watched', () => {
    const storage = freshStorage();
    seedSortableDrama(storage);

    expect(dramaUnder(storage, 'unwatched-first')).toEqual([
      'apple Grove',
      'Meridian',
      'Backwater',
      'Zephyr',
    ]);
  });

  it('orders newest added first for recently-added', () => {
    const storage = freshStorage();
    seedSortableDrama(storage);

    expect(dramaUnder(storage, 'recently-added')).toEqual([
      'Meridian',
      'Backwater',
      'apple Grove',
      'Zephyr',
    ]);
  });

  it('answers the default sort exactly as an omitted query', () => {
    const storage = freshStorage();
    seedSortableDrama(storage);

    expect(storage.getGenre('Drama', { sort: 'recently-added' })).toEqual(
      storage.getGenre('Drama')
    );
  });

  it('takes the search and the order in one query', () => {
    const storage = freshStorage();
    seedGenre(storage, 'Action', 12);

    const query: GenreQuery = { sort: 'a-z', search: 'Action 1' };

    expect(titles(storage.getGenre('Action', query))).toEqual([
      'Action 10',
      'Action 11',
      'Action 12',
    ]);
  });
});

// --- the wiring guard ----------------------------------------------------------

describe('library: getGenre on the LibraryStorage seam', () => {
  it('reaches the aggregate, returning the payload createGenre builds', () => {
    // Two handles on the *same* rows — a temp file rather than `:memory:`, so
    // the two payloads can be compared whole, ids and timestamps included.
    const dbPath = tempDbPath();
    const storage = track(createSqliteStorage(dbPath));
    seedGenre(storage, 'Drama', 3);
    storage.addMovie(newMovie({ title: 'Chiller', genres: ['Horror'] }));

    const db = track(openDatabase(dbPath));
    const aggregate = createGenre(createBrowse(db, createMovieReader(db)));

    const query: GenreQuery = { sort: 'a-z', search: 'Drama' };

    expect(storage.getGenre('Drama', query)).toEqual(
      aggregate.getGenre('Drama', query)
    );
    expect(storage.getGenre('Drama')).toEqual(aggregate.getGenre('Drama'));
  });
});
