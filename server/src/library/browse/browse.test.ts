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

import { createSqliteStorage } from '..';
import { MOVIE_SORTS } from '@/types';
import type { GenreQuery, LibraryQuery, MovieSort, NewMovie } from '@/types';

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

// --- the last-watched order ----------------------------------------------------

// 09 — Continue Watching, Phase 2: "the last-watched order" (issue #77).
//
// The repository gains an order the wire cannot name. `last-watched` exists in
// `ListSort` and in the `ORDER_BY` record; it is deliberately absent from
// `MOVIE_SORTS`, so no URL and no dropdown can ask for it — only `listMovies`
// can, and for this one phase its only caller is this file.
//
// The stamps are written through `NewMovie.lastWatchedAt` rather than through
// `setResumePosition`, because what is under test here is the ORDER BY, not the
// mutators that feed it — those are Phase 1's, and `write.test.ts` owns them.

describe('library: listMovies last-watched sort', () => {
  it('orders the most recently watched first', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Oldest', lastWatchedAt: '2026-01-01T00:00:00.000Z' })
    );
    storage.addMovie(
      newMovie({ title: 'Newest', lastWatchedAt: '2026-03-01T00:00:00.000Z' })
    );
    storage.addMovie(
      newMovie({ title: 'Middle', lastWatchedAt: '2026-02-01T00:00:00.000Z' })
    );

    const list = storage.listMovies({ sort: 'last-watched' });

    // What you were watching last night is what the shelf leads with.
    expect(list.map((m) => m.title)).toEqual(['Newest', 'Middle', 'Oldest']);
  });

  it('sorts every unstamped movie after every stamped one', () => {
    const storage = freshStorage();

    // The unstamped pair is added last, so a missing `IS NULL` leading key
    // would leave them at the front under `created_at DESC` rather than behind.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    storage.addMovie(
      newMovie({
        title: 'Watched Long Ago',
        lastWatchedAt: '2020-01-01T00:00:00.000Z',
      })
    );
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Never Watched' })); // stamp -> null
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Also Never Watched' }));
    vi.useRealTimers();

    const list = storage.listMovies({ sort: 'last-watched' });

    // Never watched is not "watched at the dawn of time" — it is not in the
    // queue at all, and sinks below a film last touched six years ago.
    expect(list.map((m) => m.title)).toEqual([
      'Watched Long Ago',
      'Also Never Watched',
      'Never Watched',
    ]);
    expect(list.map((m) => m.lastWatchedAt)).toEqual([
      '2020-01-01T00:00:00.000Z',
      null,
      null,
    ]);
  });

  it('is byte-for-byte the recently-added list when nothing is stamped', () => {
    const storage = freshStorage();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    storage.addMovie(
      newMovie({ title: 'Apple', genres: ['Drama'], rating: 4 })
    );
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Banana', year: 1999 }));
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Cherry', genres: ['Action'] }));
    vi.useRealTimers();

    // Whole assembled models, not just ids: an unstamped library is the shelf
    // it is today, and a tiebreak that differed while preserving the ids would
    // still be a change nobody asked for.
    expect(storage.listMovies({ sort: 'last-watched' })).toEqual(
      storage.listMovies({ sort: 'recently-added' })
    );
  });

  it('falls back to the id when unstamped movies share a creation instant', () => {
    const storage = freshStorage();

    // One frozen instant, so `created_at DESC` cannot separate them and only
    // `recently-added`'s own `m.id` tiebreak is left to decide.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const ids = [
      storage.addMovie(newMovie({ title: 'One' })).id,
      storage.addMovie(newMovie({ title: 'Two' })).id,
      storage.addMovie(newMovie({ title: 'Three' })).id,
    ];
    vi.useRealTimers();

    const list = storage.listMovies({ sort: 'last-watched' });

    expect(list.map((m) => m.id)).toEqual([...ids].sort());
  });

  it('applies the cap after this order, not after another one re-sorted', () => {
    const storage = freshStorage();

    // Deliberately adversarial: the two most recently *added* movies are the
    // two watched *longest* ago. A limit applied to `recently-added` and then
    // re-sorted in JavaScript returns those two — the wrong fifteen, in
    // miniature.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    storage.addMovie(
      newMovie({
        title: 'Last Night',
        lastWatchedAt: '2026-06-03T00:00:00.000Z',
      })
    );
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    storage.addMovie(
      newMovie({
        title: 'The Night Before',
        lastWatchedAt: '2026-06-02T00:00:00.000Z',
      })
    );
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    storage.addMovie(
      newMovie({
        title: 'Months Back',
        lastWatchedAt: '2026-01-15T00:00:00.000Z',
      })
    );
    vi.setSystemTime(new Date('2026-01-04T00:00:00.000Z'));
    storage.addMovie(
      newMovie({
        title: 'Years Back',
        lastWatchedAt: '2021-01-15T00:00:00.000Z',
      })
    );
    vi.useRealTimers();

    const list = storage.listMovies({ sort: 'last-watched', limit: 2 });

    expect(list.map((m) => m.title)).toEqual([
      'Last Night',
      'The Night Before',
    ]);
  });
});

// --- the two sort vocabularies -------------------------------------------------

// The new order is reachable from `listMovies` and from nowhere else. These
// guard that boundary rather than the behaviour above: they pass today and must
// go on passing, because widening either vocabulary is how `?sort=last-watched`
// would quietly become a URL the app answers, and the Sort dropdown a control
// with a sixth option nobody designed.

describe('library: the wire sort vocabulary', () => {
  it('still holds exactly its five orders, and last-watched is not one', () => {
    expect(MOVIE_SORTS).toEqual([
      'recently-added',
      'a-z',
      'year',
      'highest-rated',
      'unwatched-first',
    ]);
    expect(MOVIE_SORTS as readonly string[]).not.toContain('last-watched');
  });

  it('is what a LibraryQuery and a GenreQuery carry, so neither can name it', () => {
    const library: LibraryQuery = {
      // @ts-expect-error LibraryQuery.sort stays MovieSort — a home request
      // comes off a URL, and a URL may only name an order the dropdown can
      // show. The suppression IS the assertion: widening this to ListSort
      // makes it an unused @ts-expect-error and fails the type check.
      sort: 'last-watched',
    };
    const genre: GenreQuery = {
      // @ts-expect-error GenreQuery.sort stays MovieSort, for the same reason —
      // this is the order a row's "View all" carries over in the URL.
      sort: 'last-watched',
    };

    // Read both, so neither is an unused binding rather than an assertion.
    expect([library.sort, genre.sort]).toEqual([
      'last-watched',
      'last-watched',
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

// --- limit ---------------------------------------------------------------------

describe('library: listMovies limit', () => {
  it('caps the number of rows returned', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Apple' }));
    storage.addMovie(newMovie({ title: 'Banana' }));
    storage.addMovie(newMovie({ title: 'Cherry' }));
    storage.addMovie(newMovie({ title: 'Damson' }));

    const list = storage.listMovies({ sort: 'a-z', limit: 2 });

    // The cap applies after the sort — the first two titles A–Z, not any two.
    expect(list.map((m) => m.title)).toEqual(['Apple', 'Banana']);
  });

  it('combines with a genre filter and a sort in one query', () => {
    const storage = freshStorage();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Old Action', genres: ['Action'] }));
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Mid Action', genres: ['Action'] }));
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'New Action', genres: ['Action'] }));
    vi.setSystemTime(new Date('2026-01-04T00:00:00.000Z'));
    storage.addMovie(newMovie({ title: 'Newest Drama', genres: ['Drama'] }));
    vi.useRealTimers();

    const list = storage.listMovies({
      sort: 'recently-added',
      genre: 'Action',
      limit: 2,
    });

    // Filtered to Action, newest first, then capped — the Drama title is
    // excluded even though it is the newest movie in the library.
    expect(list.map((m) => m.title)).toEqual(['New Action', 'Mid Action']);
  });

  it('returns every matching row when no limit is given', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Apple' }));
    storage.addMovie(newMovie({ title: 'Banana' }));
    storage.addMovie(newMovie({ title: 'Cherry' }));

    const list = storage.listMovies({ sort: 'a-z' });

    expect(list.map((m) => m.title)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('returns every match when the limit exceeds the number of matches', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Apple', genres: ['Action'] }));
    storage.addMovie(newMovie({ title: 'Banana', genres: ['Action'] }));
    storage.addMovie(newMovie({ title: 'Cherry', genres: ['Drama'] }));

    const list = storage.listMovies({
      sort: 'a-z',
      genre: 'Action',
      limit: 15,
    });

    expect(list.map((m) => m.title)).toEqual(['Apple', 'Banana']);
  });
});

// --- search --------------------------------------------------------------------
//
// 05 — Search + filter, Phase 1: "search on the server, end to end" (issue #31).
// The search text widens from a title substring to title OR synopsis OR genre
// name, so a parent who types "comedy" or a half-remembered plot fragment finds
// the film. The title tests below are the pre-existing ones, kept as-is.

describe('library: listMovies search', () => {
  it('matches a case-insensitive title substring', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'The Matrix' }));
    storage.addMovie(newMovie({ title: 'Matrix Reloaded' }));
    storage.addMovie(newMovie({ title: 'Inception' }));

    const list = storage.listMovies({ sort: 'a-z', search: 'matrix' });

    expect(list.map((m) => m.title)).toEqual(['Matrix Reloaded', 'The Matrix']);
  });

  it('matches a case-insensitive synopsis substring', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Northwind',
        synopsis: 'A lighthouse keeper on a fading coast takes in a runaway.',
      })
    );
    storage.addMovie(
      newMovie({
        title: 'Inception',
        synopsis: 'A thief who steals corporate secrets through dreams.',
      })
    );
    storage.addMovie(newMovie({ title: 'Untold' })); // no synopsis at all

    // Half-remembered plot, typed in any case — the title says nothing about it.
    const list = storage.listMovies({ sort: 'a-z', search: 'LIGHTHOUSE' });

    expect(list.map((m) => m.title)).toEqual(['Northwind']);
  });

  it('matches a case-insensitive genre-name substring', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Chuckles', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Untagged' }));

    // "COMED" is in no title and no synopsis — only in a genre name.
    const list = storage.listMovies({ sort: 'a-z', search: 'COMED' });

    expect(list.map((m) => m.title)).toEqual(['Chuckles']);
  });

  it('returns a movie matching on several arms exactly once', () => {
    const storage = freshStorage();
    // "ion" is in both the Action and Animation genre names — and in this
    // movie's title, and in its synopsis. Four matching arms, one movie.
    storage.addMovie(
      newMovie({
        title: 'Action Hero',
        synopsis: 'An expedition of pure motion.',
        genres: ['Action', 'Animation'],
      })
    );
    // Matches on two genre names only — nothing in its title or synopsis.
    storage.addMovie(
      newMovie({ title: 'Northwind', genres: ['Action', 'Animation'] })
    );

    const list = storage.listMovies({ sort: 'a-z', search: 'ion' });

    // One row per movie, however many arms and however many genres match —
    // the row set must not multiply out over the genre join.
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.title)).toEqual(['Action Hero', 'Northwind']);
  });

  it('returns [] for a fragment nothing holds', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Inception',
        synopsis: 'A thief who steals corporate secrets.',
        genres: ['Sci-Fi'],
      })
    );

    expect(storage.listMovies({ sort: 'a-z', search: 'zzz-nothing' })).toEqual(
      []
    );
  });

  it('combines with a genre filter', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Comic Caper',
        synopsis: 'A heist that goes sideways.',
        genres: ['Comedy'],
      })
    );
    storage.addMovie(
      newMovie({
        title: 'Grim Job',
        synopsis: 'A heist that goes sideways.',
        genres: ['Drama'],
      })
    );

    const list = storage.listMovies({
      sort: 'a-z',
      genre: 'Drama',
      search: 'heist',
    });

    expect(list.map((m) => m.title)).toEqual(['Grim Job']);
  });

  it('combines with a minimum rating', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Harbor Lights',
        synopsis: 'A lighthouse tale.',
        rating: 9,
      })
    );
    storage.addMovie(
      newMovie({
        title: 'Harbor Dark',
        synopsis: 'A lighthouse tale.',
        rating: 4,
      })
    );
    storage.addMovie(newMovie({ title: 'Unrelated', rating: 10 }));

    const list = storage.listMovies({
      sort: 'a-z',
      search: 'lighthouse',
      minRating: 8,
    });

    expect(list.map((m) => m.title)).toEqual(['Harbor Lights']);
  });

  it('applies each of the five sorts to the widened result set', () => {
    const storage = freshStorage();

    // Three movies matching "dram" through three different arms — title,
    // genre name, synopsis — plus one control that matches through none.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    storage.addMovie(
      newMovie({ title: 'Xray Drama', year: 2010, rating: 3 }) // unwatched
    );
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    storage.addMovie(
      newMovie({
        title: 'Yankee',
        genres: ['Drama'],
        year: 2021,
        rating: 8,
        resumePositionSeconds: 60, // in-progress
      })
    );
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    storage.addMovie(
      newMovie({
        title: 'Zulu',
        synopsis: 'A dramatic turn on a quiet street.',
        year: 1999,
        rating: 10,
        watched: true,
      })
    );
    vi.setSystemTime(new Date('2026-01-04T00:00:00.000Z'));
    // Newest, highest year, top rating, unwatched, first alphabetically — it
    // would lead every sort below if the search were not applied.
    storage.addMovie(
      newMovie({
        title: 'Alpha Control',
        synopsis: 'A quiet comedy of manners.',
        year: 2030,
        rating: 10,
      })
    );
    vi.useRealTimers();

    const titlesFor = (sort: MovieSort) =>
      storage.listMovies({ sort, search: 'dram' }).map((m) => m.title);

    expect(titlesFor('recently-added')).toEqual([
      'Zulu',
      'Yankee',
      'Xray Drama',
    ]);
    expect(titlesFor('a-z')).toEqual(['Xray Drama', 'Yankee', 'Zulu']);
    expect(titlesFor('year')).toEqual(['Yankee', 'Xray Drama', 'Zulu']);
    expect(titlesFor('highest-rated')).toEqual([
      'Zulu',
      'Yankee',
      'Xray Drama',
    ]);
    expect(titlesFor('unwatched-first')).toEqual([
      'Xray Drama',
      'Yankee',
      'Zulu',
    ]);
  });

  it('assembles genres and subtitles correctly when the genre arm matches', () => {
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
    // A movie the search misses — its children must not leak into the batch.
    storage.addMovie(
      newMovie({
        title: 'Weepie',
        genres: ['Drama'],
        subtitles: [{ path: 'Weepie/fr.srt', language: 'French' }],
      })
    );

    const list = storage.listMovies({ sort: 'a-z', search: 'sci' });

    // The batched child reads re-run the widened WHERE as a subquery, so the
    // assembled model has to stay identical to the single-row read path.
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual(storage.getMovie(added.id));
    expect(list[0].genres.map((g) => g.name)).toEqual(['Action', 'Sci-Fi']);
    expect(list[0].subtitles.map((s) => s.language)).toEqual([
      'English',
      'German',
    ]);
  });
});

describe('library: searchMovies', () => {
  it('matches a case-insensitive title substring', () => {
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

  it('matches on synopsis and on genre name too, ordered A–Z', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Zulu', genres: ['Comedy'] }));
    storage.addMovie(
      newMovie({ title: 'Alpha', synopsis: 'A comedic misunderstanding.' })
    );
    storage.addMovie(newMovie({ title: 'Comedy Central' }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    expect(storage.searchMovies('comed').map((m) => m.title)).toEqual([
      'Alpha',
      'Comedy Central',
      'Zulu',
    ]);
  });

  it('returns exactly what listMovies with the search filter returns', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Chuckles', genres: ['Comedy'], rating: 7 })
    );
    storage.addMovie(
      newMovie({ title: 'Alpha', synopsis: 'A comedic misunderstanding.' })
    );
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));

    // The documented promise: a shorthand over the query, not its own
    // semantics. Asserted over a non-empty result, so two empty arrays can
    // never make the equivalence look true.
    const found = storage.searchMovies('comed');

    expect(found).toHaveLength(2);
    expect(found).toEqual(storage.listMovies({ sort: 'a-z', search: 'comed' }));
  });

  it('returns [] when nothing matches the search', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Inception',
        synopsis: 'A thief who steals corporate secrets.',
        genres: ['Sci-Fi'],
      })
    );

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

  // --- 06 — Genre row ordering (issue #39) -------------------------------------

  it('orders genres by movie count, busiest first', () => {
    const storage = freshStorage();
    // Deliberately not alphabetical: 'Action' would lead an A–Z list, and here
    // it holds the fewest movies, so it has to come last.
    storage.addMovie(newMovie({ title: 'A1', genres: ['Action'] }));
    storage.addMovie(newMovie({ title: 'C1', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'C2', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'D1', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'D2', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'D3', genres: ['Drama'] }));

    expect(
      storage.listGenres().map((genre) => [genre.name, genre.count])
    ).toEqual([
      ['Drama', 3],
      ['Comedy', 2],
      ['Action', 1],
    ]);
  });

  it('breaks an equal count alphabetically', () => {
    const storage = freshStorage();
    // Horror and Comedy tie on two; the name is what settles them, so the list
    // is stable enough to learn rather than reordering itself between calls.
    storage.addMovie(newMovie({ title: 'H1', genres: ['Horror'] }));
    storage.addMovie(newMovie({ title: 'H2', genres: ['Horror'] }));
    storage.addMovie(newMovie({ title: 'C1', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'C2', genres: ['Comedy'] }));
    storage.addMovie(newMovie({ title: 'T1', genres: ['Thriller'] }));
    storage.addMovie(newMovie({ title: 'T2', genres: ['Thriller'] }));
    storage.addMovie(newMovie({ title: 'D1', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'D2', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'D3', genres: ['Drama'] }));

    expect(storage.listGenres().map((genre) => genre.name)).toEqual([
      'Drama',
      'Comedy',
      'Horror',
      'Thriller',
    ]);
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

// --- 05 — Search + filter, Phase 4: "the Genre dropdown" (issue #36) ------------

describe('library: countMovies', () => {
  it('counts every movie in the library', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'One' }));
    storage.addMovie(newMovie({ title: 'Two' }));
    storage.addMovie(newMovie({ title: 'Three' }));

    expect(storage.countMovies()).toBe(3);
  });

  it('counts a movie once however many genres it carries', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Triple', genres: ['Action', 'Comedy', 'Drama'] })
    );

    // This is the whole reason the count is its own query: the "All Genres"
    // row is a count of movies, and a movie tagged three times is still one
    // movie on the shelf.
    expect(storage.countMovies()).toBe(1);
  });

  it('is not the sum of the genre counts when movies are tagged twice', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Both', genres: ['Action', 'Comedy'] }));
    storage.addMovie(newMovie({ title: 'Just Action', genres: ['Action'] }));

    const summed = storage
      .listGenres()
      .reduce((total, genre) => total + genre.count, 0);

    expect(summed).toBe(3);
    expect(storage.countMovies()).toBe(2);
  });

  it('counts a movie with no genre at all', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Untagged' }));
    storage.addMovie(newMovie({ title: 'Tagged', genres: ['Drama'] }));

    // An untagged movie earns no genre row, but it is still on the shelf, so
    // "All Genres" has to include it.
    expect(storage.listGenres()).toHaveLength(1);
    expect(storage.countMovies()).toBe(2);
  });

  it('returns 0 on an empty library', () => {
    expect(freshStorage().countMovies()).toBe(0);
  });

  it('drops back down when a movie is deleted', () => {
    const storage = freshStorage();
    const added = storage.addMovie(newMovie({ title: 'Fleeting' }));
    expect(storage.countMovies()).toBe(1);

    storage.deleteMovie(added.id);

    expect(storage.countMovies()).toBe(0);
  });
});
