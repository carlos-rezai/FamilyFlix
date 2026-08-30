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
import { MOVIE_SORTS, type Movie, type NewMovie } from '@/types';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { newMovie } from '../../test-support/newMovie/newMovie';
import { seedByAge } from '../../test-support/seedByAge/seedByAge';
import { seedGenre } from '../../test-support/seedGenre/seedGenre';

/** Fake timers are how these tests get distinct creation instants. */
afterEach(() => {
  vi.useRealTimers();
});

// --- helpers -------------------------------------------------------------------

/** `count` favorited movies, oldest first, titled `Loved 01`…`Loved NN`. */
function seedFavorites(
  storage: ReturnType<typeof createSqliteStorage>,
  count: number
): void {
  seedByAge(storage, count, (label) => ({
    title: `Loved ${label}`,
    isFavorite: true,
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

/** An in-progress movie carrying the stamp the player will one day write. */
function started(
  title: string,
  lastWatchedAt: string,
  extra: Partial<NewMovie> = {}
): NewMovie {
  return newMovie({
    title,
    resumePositionSeconds: 600,
    lastWatchedAt,
    ...extra,
  });
}

/**
 * Three in-progress films whose last-watched order is the reverse of every
 * order the Sort dropdown can name.
 *
 * Stamps run Charlie → Bravo → Alpha, most recent first. Creation instant,
 * title, year and rating all run Alpha → Bravo → Charlie, and all three are
 * in-progress so `unwatched-first` falls to its title tiebreak — so each of the
 * five wire sorts puts these films in the exact opposite order to the shelf's
 * own. Each is favorited and tagged Drama, so all three sections hold the same
 * three films and the only thing that can differ between them is the order.
 */
function seedQueueAgainstEverySort(
  storage: ReturnType<typeof createSqliteStorage>
): void {
  const films = [
    { title: 'Charlie', year: 2000, rating: 2, watched: '2026-06-03' },
    { title: 'Bravo', year: 2010, rating: 6, watched: '2026-06-02' },
    { title: 'Alpha', year: 2020, rating: 10, watched: '2026-06-01' },
  ];

  vi.useFakeTimers();
  films.forEach((film, index) => {
    vi.setSystemTime(new Date(Date.UTC(2026, 0, index + 1)));
    storage.addMovie(
      started(film.title, `${film.watched}T00:00:00.000Z`, {
        year: film.year,
        rating: film.rating,
        genres: ['Drama'],
        isFavorite: true,
      })
    );
  });
  vi.useRealTimers();
}

/**
 * The same three-film queue without the favorites, genres, years and ratings —
 * stamps running Charlie → Bravo → Alpha, creation instants running the other
 * way, returned in stamp order. Staggering the instants is what makes these
 * tests deterministic: `created_at` ties would leave the order to
 * `recently-added`'s random-uuid tiebreak.
 */
function seedQueue(storage: ReturnType<typeof createSqliteStorage>): {
  charlie: Movie;
  bravo: Movie;
  alpha: Movie;
} {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  const charlie = storage.addMovie(
    started('Charlie', '2026-06-03T00:00:00.000Z')
  );
  vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
  const bravo = storage.addMovie(started('Bravo', '2026-06-02T00:00:00.000Z'));
  vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
  const alpha = storage.addMovie(started('Alpha', '2026-06-01T00:00:00.000Z'));
  vi.useRealTimers();

  return { charlie, bravo, alpha };
}

// --- genre rows: the 02 behaviour, unchanged under the new envelope -------------

describe('library: getHome genre rows', () => {
  // Rewritten by 06 (issue #39): the rows used to come back alphabetically,
  // which disagreed with the prototype (`FamilyFlix.dc.html:328`) and with the
  // Genre dropdown sitting directly above them. The contract is now the
  // dropdown's — busiest genre first.
  it('returns one row per populated genre, busiest genre first', () => {
    const storage = freshStorage();
    // 'Action' leads an A–Z list and holds the fewest movies, so an
    // alphabetical order and a count order disagree about this library.
    storage.addMovie(newMovie({ title: 'Actioner', genres: ['Action'] }));
    storage.addMovie(newMovie({ title: 'Chiller', genres: ['Horror'] }));
    storage.addMovie(newMovie({ title: 'Chiller 2', genres: ['Horror'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Weepie 2', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Weepie 3', genres: ['Drama'] }));

    const { rows } = storage.getHome();

    expect(rows.map((row) => row.genre)).toEqual(['Drama', 'Horror', 'Action']);
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

  it('falls back to recently-added when nothing is stamped', () => {
    const storage = freshStorage();
    seedInProgress(storage, 3);

    const { continueWatching } = storage.getHome();

    expect(continueWatching.map((m) => m.title)).toEqual([
      'Started 03',
      'Started 02',
      'Started 01',
    ]);
  });

  it('caps at the same 15 as the genre rows, under that fallback', () => {
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

// --- favorites -----------------------------------------------------------------
//
// 08 — Favorites, Phase 1: "the section, from the query to the wire" (issue
// #68). The payload's third section, and the first caller anywhere in the app
// of the `favoritesOnly` flag `MovieQuery` has carried since 02.

describe('library: getHome favorites', () => {
  it('holds only favorites — the unfavorited one is left out', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Ordinary' }));
    storage.addMovie(newMovie({ title: 'Loved', isFavorite: true }));

    const { favorites } = storage.getHome();

    expect(favorites.map((m) => m.title)).toEqual(['Loved']);
  });

  it('orders recently-added first', () => {
    const storage = freshStorage();
    seedFavorites(storage, 3);

    const { favorites } = storage.getHome();

    expect(favorites.map((m) => m.title)).toEqual([
      'Loved 03',
      'Loved 02',
      'Loved 01',
    ]);
  });

  it('caps at the same 15 as every other section, newest first', () => {
    const storage = freshStorage();
    seedFavorites(storage, 20);

    const { favorites } = storage.getHome();

    // The shared HOME_ROW_LIMIT, applied by the server — not a
    // favorites-specific cap, and never a client-side trim.
    expect(favorites).toHaveLength(15);
    expect(favorites.map((m) => m.title)).toEqual([
      'Loved 20',
      'Loved 19',
      'Loved 18',
      'Loved 17',
      'Loved 16',
      'Loved 15',
      'Loved 14',
      'Loved 13',
      'Loved 12',
      'Loved 11',
      'Loved 10',
      'Loved 09',
      'Loved 08',
      'Loved 07',
      'Loved 06',
    ]);
  });

  it('is empty when nothing is favorited', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Ordinary', genres: ['Drama'] }));

    const home = storage.getHome();

    expect(home.favorites).toEqual([]);
    // The library is not empty — only the shelf is.
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
  });

  it('drops a movie once it is unfavorited', () => {
    const storage = freshStorage();
    const loved = storage.addMovie(
      newMovie({ title: 'Loved', isFavorite: true })
    );
    expect(storage.getHome().favorites).toHaveLength(1);

    storage.setFavorite(loved.id, false);

    expect(storage.getHome().favorites).toEqual([]);
  });

  it('lists a favorite here and still in each of its genre rows', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Loved',
        genres: ['Action', 'Drama'],
        isFavorite: true,
      })
    );

    const home = storage.getHome();
    const titlesByGenre = new Map(
      home.rows.map((row) => [row.genre, row.movies.map((m) => m.title)])
    );

    // "What do we love" and "what Action do I own" are two different
    // questions, so the same movie earns a place in every answer.
    expect(home.favorites.map((m) => m.title)).toEqual(['Loved']);
    expect(titlesByGenre.get('Action')).toEqual(['Loved']);
    expect(titlesByGenre.get('Drama')).toEqual(['Loved']);
  });

  it('lists a favorite with no genre tags, which earns no row at all', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Untagged', isFavorite: true }));

    const home = storage.getHome();

    expect(home.favorites.map((m) => m.title)).toEqual(['Untagged']);
    expect(home.rows).toEqual([]);
  });

  it('lists a movie that is in progress and favorited in all three sections', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Loved Halfway',
        genres: ['Action'],
        isFavorite: true,
        resumePositionSeconds: 600,
      })
    );

    const home = storage.getHome();

    // The sections answer different questions and never compete for a movie.
    expect(home.continueWatching.map((m) => m.title)).toEqual([
      'Loved Halfway',
    ]);
    expect(home.favorites.map((m) => m.title)).toEqual(['Loved Halfway']);
    expect(home.rows.map((row) => row.genre)).toEqual(['Action']);
    expect(home.rows[0].movies.map((m) => m.title)).toEqual(['Loved Halfway']);
  });
});

// --- favorites under the Library query -----------------------------------------
//
// The shelf is built from the caller's whole query with the flag laid on top,
// so it narrows with the rest of the screen rather than standing outside it.
// This is the invariant `getHome` exists to protect: the top of the screen can
// never disagree with the rest of it.

describe('library: getHome favorites under a Library query', () => {
  it('drops a favorite that fails the search term', () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Comic Caper', isFavorite: true }));
    storage.addMovie(newMovie({ title: 'Weepie', isFavorite: true }));

    const { favorites } = storage.getHome({
      sort: 'recently-added',
      search: 'comic',
    });

    expect(favorites.map((m) => m.title)).toEqual(['Comic Caper']);
  });

  it('drops a favorite that fails the genre filter', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Loved Comedy', genres: ['Comedy'], isFavorite: true })
    );
    storage.addMovie(
      newMovie({ title: 'Loved Drama', genres: ['Drama'], isFavorite: true })
    );

    const home = storage.getHome({ sort: 'recently-added', genre: 'Drama' });

    expect(home.favorites.map((m) => m.title)).toEqual(['Loved Drama']);
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
  });

  it('drops a favorite that fails the rating minimum', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({ title: 'Adored', rating: 9, isFavorite: true })
    );
    storage.addMovie(newMovie({ title: 'Liked', rating: 4, isFavorite: true }));
    // Unrated is not a nought out of ten, but a minimum still excludes it —
    // the same rule every other section reads.
    storage.addMovie(newMovie({ title: 'Unrated', isFavorite: true }));

    const { favorites } = storage.getHome({
      sort: 'recently-added',
      minRating: 8,
    });

    expect(favorites.map((m) => m.title)).toEqual(['Adored']);
  });

  it('comes back in the sort the query asked for', () => {
    const storage = freshStorage();
    seedFavorites(storage, 3); // "Loved 01".."Loved 03", oldest first

    const { favorites } = storage.getHome({ sort: 'a-z' });

    // Not the recently-added default: the shelf takes the header's sort like
    // every other section.
    expect(favorites.map((m) => m.title)).toEqual([
      'Loved 01',
      'Loved 02',
      'Loved 03',
    ]);
  });

  it('narrows every section off the one query together', () => {
    const storage = freshStorage();
    storage.addMovie(
      newMovie({
        title: 'Comic Caper',
        genres: ['Comedy'],
        isFavorite: true,
        resumePositionSeconds: 600,
      })
    );
    storage.addMovie(
      newMovie({
        title: 'Weepie',
        genres: ['Drama'],
        isFavorite: true,
        resumePositionSeconds: 300,
      })
    );

    const home = storage.getHome({ sort: 'recently-added', search: 'comic' });

    expect(home.favorites.map((m) => m.title)).toEqual(['Comic Caper']);
    expect(home.continueWatching.map((m) => m.title)).toEqual(['Comic Caper']);
    expect(home.rows.map((row) => row.genre)).toEqual(['Comedy']);
  });

  it('still caps a narrowed shelf at 15, newest first', () => {
    const storage = freshStorage();
    seedFavorites(storage, 20); // "Loved 01".."Loved 20"
    storage.addMovie(newMovie({ title: 'Decoy', isFavorite: true }));

    const { favorites } = storage.getHome({
      sort: 'recently-added',
      search: 'loved',
    });

    expect(favorites).toHaveLength(15);
    expect(favorites[0].title).toBe('Loved 20');
    expect(favorites[14].title).toBe('Loved 06');
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

  it("orders the narrowed rows by each genre's unfiltered size", () => {
    const storage = freshStorage();
    storage.addMovie(newMovie({ title: 'Harbor Lights', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Weepie', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Sad Ending', genres: ['Drama'] }));
    storage.addMovie(newMovie({ title: 'Harbor Comic', genres: ['Comedy'] }));

    const { rows } = storage.getHome({
      sort: 'recently-added',
      search: 'harbor',
    });

    // Both rows survive with one match each. Drama leads because Drama is the
    // bigger genre, not because more of it matched — the query narrows what a
    // row holds, and never re-ranks the rows themselves. Alphabetically Comedy
    // would lead, and by matches this would be a tie.
    expect(rows.map((row) => [row.genre, row.count])).toEqual([
      ['Drama', 3],
      ['Comedy', 1],
    ]);
    expect(rows.map((row) => row.movies.map((m) => m.title))).toEqual([
      ['Harbor Lights'],
      ['Harbor Comic'],
    ]);
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
  it('returns all three sections empty for an empty library', () => {
    const storage = freshStorage();

    // Declared in the order the screen renders them: continue, favorites, rows.
    expect(storage.getHome()).toEqual({
      continueWatching: [],
      favorites: [],
      rows: [],
    });
  });

  it('carries fully assembled Movie models in all three sections (matching getMovie)', () => {
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
        isFavorite: true,
      })
    );

    const home = storage.getHome();
    const [movie] = home.rows[0].movies;
    const [started] = home.continueWatching;
    const [loved] = home.favorites;

    // Same model the rest of the repository returns: ordered genres, parsed
    // cast, ordered subtitles, derived status — the cards need all of it.
    expect(movie).toEqual(storage.getMovie(added.id));
    expect(movie.genres.map((g) => g.name)).toEqual(['Action', 'Sci-Fi']);
    expect(movie.status).toBe('in-progress');
    expect(started).toEqual(storage.getMovie(added.id));
    expect(loved).toEqual(storage.getMovie(added.id));
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

// --- the pinned order of the continue section ----------------------------------
//
// 09 — Continue Watching, Phase 3: "the shelf pins its order" (issue #78), the
// last mile of the tracer bullet #76 and #77 laid down.
//
// The resume queue's order is part of what the shelf *means*, so it stops being
// the caller's to set: `getHome` pins `last-watched` for `continueWatching`
// while the Favorites shelf and every genre row go on obeying the header's
// Sort. Nothing about a shelf of favorites implies an intrinsic order; a queue
// has one. That asymmetry is deliberate — it is the whole feature.
//
// Everything here goes through `getHome()`, the single call `GET /api/home`
// serves. `listSection` growing an argument is an implementation detail of this
// module and is never touched directly.
//
// The stamps are written through `NewMovie.lastWatchedAt` rather than through
// `setResumePosition`, because what is under test is the order, not the
// mutators that feed it — those are Phase 1's, and `write.test.ts` owns them.
// The two mutator tests below are the exceptions, and they assert what the
// *section* does, not what the column holds.

describe('library: getHome pins the continue section’s order', () => {
  // The demoable case is `a-z`: pick "A–Z" from Sort and the row holds its
  // order while the Favorites shelf and every genre row alphabetise underneath
  // it. The other four are the same claim, so the whole wire vocabulary is
  // asserted at once — and a sixth option added to `MOVIE_SORTS` without a
  // thought for this shelf lands here as a new failing case rather than as
  // silence.
  it.each([...MOVIE_SORTS])(
    'holds last-watched-first under sort=%s, while the favorites shelf and the genre rows obey it',
    (sort) => {
      const storage = freshStorage();
      seedQueueAgainstEverySort(storage);

      const home = storage.getHome({ sort });

      expect(home.continueWatching.map((m) => m.title)).toEqual([
        'Charlie',
        'Bravo',
        'Alpha',
      ]);
      // Every one of the five sorts ranks these three the other way round, so
      // the shelf and the rows disagreeing is the assertion.
      expect(home.favorites.map((m) => m.title)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ]);
      expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
      expect(home.rows[0].movies.map((m) => m.title)).toEqual([
        'Alpha',
        'Bravo',
        'Charlie',
      ]);
    }
  );

  it('leads with the film stamped last night over one stamped weeks ago, whichever was added first', () => {
    const storage = freshStorage();

    // Import order is the adversary: the film watched weeks ago is the one
    // added most recently, so the old `recently-added` shelf led with it.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    storage.addMovie(started('Last Night', '2026-06-03T00:00:00.000Z'));
    vi.setSystemTime(new Date('2026-01-03T00:00:00.000Z'));
    storage.addMovie(started('Weeks Ago', '2026-05-01T00:00:00.000Z'));
    vi.useRealTimers();

    const { continueWatching } = storage.getHome();

    expect(continueWatching.map((m) => m.title)).toEqual([
      'Last Night',
      'Weeks Ago',
    ]);
  });

  it('does not move a film when it is favorited or re-rated', () => {
    const storage = freshStorage();
    const { bravo, alpha } = seedQueue(storage);

    // Tidying up the library is not watching it. This is the reason the column
    // is `last_watched_at` and not `updated_at`.
    storage.setFavorite(alpha.id, true);
    storage.setRating(bravo.id, 10);

    expect(storage.getHome().continueWatching.map((m) => m.title)).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ]);
  });

  it('still drops a film from the section entirely once it is marked watched', () => {
    const storage = freshStorage();
    const { bravo } = seedQueue(storage);

    // `markWatched` stamps as well as zeroing the resume position, so a film
    // that leaves the shelf must not reappear at the head of it.
    storage.markWatched(bravo.id);

    expect(storage.getHome().continueWatching.map((m) => m.title)).toEqual([
      'Charlie',
      'Alpha',
    ]);
  });

  it('reorders nothing when a film is un-marked as watched', () => {
    const storage = freshStorage();
    const { alpha } = seedQueue(storage);
    const before = storage.getHome().continueWatching;

    // The film at the *back* of the queue, so a stamp written here would send
    // it to the front and the order alone would catch it.
    storage.markUnwatched(alpha.id);

    const after = storage.getHome().continueWatching;
    expect(after.map((m) => m.title)).toEqual(['Charlie', 'Bravo', 'Alpha']);
    // Whole assembled models: correcting a mis-tap changes nothing at all.
    expect(after).toEqual(before);
  });

  it('still drops an in-progress film that fails the search term, and keeps the order among the rest', () => {
    const storage = freshStorage();
    storage.addMovie(started('Zed Comic', '2026-06-03T00:00:00.000Z'));
    storage.addMovie(started('Weepie', '2026-06-02T00:00:00.000Z'));
    storage.addMovie(started('Comic Alpha', '2026-06-01T00:00:00.000Z'));

    // A filter answers *which* films are on the shelf; the order is the
    // shelf's own. The film the search drops sits between the two survivors,
    // and A–Z would swap them.
    const { continueWatching } = storage.getHome({
      sort: 'a-z',
      search: 'comic',
    });

    expect(continueWatching.map((m) => m.title)).toEqual([
      'Zed Comic',
      'Comic Alpha',
    ]);
  });

  it('still drops an in-progress film that fails the genre filter, and keeps the order among the rest', () => {
    const storage = freshStorage();
    storage.addMovie(
      started('Zed Drama', '2026-06-03T00:00:00.000Z', { genres: ['Drama'] })
    );
    storage.addMovie(
      started('Comic Caper', '2026-06-02T00:00:00.000Z', { genres: ['Comedy'] })
    );
    storage.addMovie(
      started('Alpha Drama', '2026-06-01T00:00:00.000Z', { genres: ['Drama'] })
    );

    const { continueWatching } = storage.getHome({
      sort: 'a-z',
      genre: 'Drama',
    });

    expect(continueWatching.map((m) => m.title)).toEqual([
      'Zed Drama',
      'Alpha Drama',
    ]);
  });

  it('still drops an in-progress film that fails the rating minimum, and keeps the order among the rest', () => {
    const storage = freshStorage();
    storage.addMovie(
      started('Zed Great', '2026-06-03T00:00:00.000Z', { rating: 10 })
    );
    storage.addMovie(
      started('Weepie Poor', '2026-06-02T00:00:00.000Z', { rating: 2 })
    );
    storage.addMovie(
      started('Alpha Great', '2026-06-01T00:00:00.000Z', { rating: 8 })
    );

    const { continueWatching } = storage.getHome({
      sort: 'a-z',
      minRating: 6,
    });

    expect(continueWatching.map((m) => m.title)).toEqual([
      'Zed Great',
      'Alpha Great',
    ]);
  });

  it('caps at the 15 most recently watched, not the 15 most recently added', () => {
    const storage = freshStorage();

    // Deliberately adversarial: import order runs exactly opposite to watch
    // order, so `Started 16` is the film added most recently *and* the film
    // watched longest ago. A cap taken over `recently-added` and then
    // re-sorted in JavaScript leads with it; the right shelf leaves it off.
    vi.useFakeTimers();
    for (let n = 1; n <= 16; n += 1) {
      vi.setSystemTime(new Date(Date.UTC(2026, 0, n)));
      const label = String(n).padStart(2, '0');
      const day = String(17 - n).padStart(2, '0');
      storage.addMovie(
        started(`Started ${label}`, `2026-06-${day}T00:00:00.000Z`)
      );
    }
    vi.useRealTimers();

    const { continueWatching } = storage.getHome();

    expect(continueWatching).toHaveLength(15);
    expect(continueWatching.map((m) => m.title)).toEqual([
      'Started 01',
      'Started 02',
      'Started 03',
      'Started 04',
      'Started 05',
      'Started 06',
      'Started 07',
      'Started 08',
      'Started 09',
      'Started 10',
      'Started 11',
      'Started 12',
      'Started 13',
      'Started 14',
      'Started 15',
    ]);
    // The 16th most recently watched is off the shelf, recently added or not.
    expect(continueWatching.map((m) => m.title)).not.toContain('Started 16');
  });

  it('is empty when nothing is in progress, whatever the caller’s sort', () => {
    const storage = freshStorage();
    const finished = storage.addMovie(
      started('Finished', '2026-06-03T00:00:00.000Z', { genres: ['Drama'] })
    );
    storage.markWatched(finished.id);
    storage.addMovie(newMovie({ title: 'Untouched', genres: ['Drama'] }));

    const home = storage.getHome({ sort: 'a-z' });

    // Pinning the order must not conjure a shelf out of a library with no
    // queue in it — the row stays hidden (`HomeRows.test.tsx`).
    expect(home.continueWatching).toEqual([]);
    expect(home.rows.map((row) => row.genre)).toEqual(['Drama']);
  });

  it('returns exactly today’s section, in today’s order, for a library where nothing has been stamped', () => {
    const storage = freshStorage();
    seedInProgress(storage, 3); // no stamps: `lastWatchedAt` is null throughout

    const { continueWatching } = storage.getHome();

    expect(continueWatching.map((m) => m.title)).toEqual([
      'Started 03',
      'Started 02',
      'Started 01',
    ]);
    // Whole assembled models against the shelf as it is built today, so the
    // change is invisible until it has something to say. 15 is HOME_ROW_LIMIT.
    expect(continueWatching).toEqual(
      storage.listMovies({
        sort: 'recently-added',
        inProgressOnly: true,
        limit: 15,
      })
    );
  });
});
