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
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { createSqliteStorage } from '../../library';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  SEED_FIXTURE_VIDEO,
  SEED_MOVIES,
  SEED_VIDEO_PREFIX,
  seedLibrary,
} from './seed';

// --- per-test resource tracking ------------------------------------------------

interface Closeable {
  close(): void;
}

const closeables: Closeable[] = [];

/**
 * A fresh, fully-migrated in-memory repository and an empty managed media
 * directory — the two things one seed run writes into. Both are cleaned up
 * automatically.
 *
 * The media directory arrived with the player: the seed now copies a real
 * fixture video under the reserved prefix, so a run touches the disk as well as
 * the database and both halves have to be checkable. It is `sandboxRoot`'s,
 * which resolves the path and sweeps it — a temporary directory is a symlink on
 * macOS and an 8.3 short name on Windows, and a path the seed resolved would
 * otherwise disagree with the one built here.
 */
function freshLibrary(): {
  storage: ReturnType<typeof createSqliteStorage>;
  media: string;
} {
  const storage = createSqliteStorage(':memory:');
  closeables.push(storage);

  const media = sandboxRoot('familyflix-seed-');

  return { storage, media };
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

/**
 * How long a synopsis has to be before it overflows the detail page's clamp.
 *
 * `ExpandableText` clamps to 4 lines of 17px copy over a 560px measure, and its
 * toggle appears only when the copy actually overflows — so a seed whose prose
 * all fits leaves that toggle unreachable in the running app, which is the one
 * thing this fixture set exists to make checkable by looking.
 *
 * jsdom measures nothing, so the real clamp cannot be exercised here. These are
 * character-count proxies with deliberate margin on both sides: ~62 characters
 * fit on a line at that size and measure, so four lines hold roughly 250. A
 * synopsis past OVERFLOWS_CLAMP is comfortably too long whatever the font does
 * with it, and one under FITS_CLAMP is comfortably short. Same device as
 * MIN_OVERFLOWING_ROW above: assert the decision through a documented proxy,
 * never the measurement.
 */
const OVERFLOWS_CLAMP = 340;
const FITS_CLAMP = 150;

/** How many fixtures have to overflow before the expanded state is easy to find. */
const MIN_LONG_SYNOPSES = 3;

describe('the dev seed — what a run writes', () => {
  it('writes the whole fixture set into an empty library', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    expect(titlesOf(storage.listMovies({ sort: 'a-z' }))).toEqual(
      titlesOf([...SEED_MOVIES])
    );
  });

  it('reports what it removed and what it added', () => {
    const { storage, media } = freshLibrary();

    const first = seedLibrary(storage, media);
    const second = seedLibrary(storage, media);

    expect(first).toEqual({ removed: 0, added: SEED_MOVIES.length });
    expect(second).toEqual({
      removed: SEED_MOVIES.length,
      added: SEED_MOVIES.length,
    });
  });

  it('stores every fixture under the reserved video prefix', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    // The delete pass is scoped to this prefix, so a fixture that escaped it
    // would silently accumulate a duplicate on every subsequent run.
    for (const movie of storage.listMovies({ sort: 'a-z' })) {
      expect(movie.videoPath.startsWith(SEED_VIDEO_PREFIX)).toBe(true);
    }
  });
});

describe('the dev seed — running it twice', () => {
  it('leaves the same library rather than doubling it', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    seedLibrary(storage, media);

    expect(storage.listMovies({ sort: 'a-z' })).toHaveLength(
      SEED_MOVIES.length
    );
  });

  it('converges on the current fixtures, not on the rows it wrote before', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    // Edit a seed row the way a developer poking at the app would, then re-run:
    // the run has to overwrite it, not preserve it.
    const [first] = storage.listMovies({ sort: 'a-z' });
    storage.updateMovie(first.id, { title: 'Edited By Hand' });
    seedLibrary(storage, media);

    const titles = titlesOf(storage.listMovies({ sort: 'a-z' }));
    expect(titles).not.toContain('Edited By Hand');
    expect(titles).toEqual(titlesOf([...SEED_MOVIES]));
  });
});

describe('the dev seed — movies it did not write', () => {
  it('leaves a movie added any other way untouched', () => {
    const { storage, media } = freshLibrary();
    const mine = storage.addMovie({
      title: 'A Real Import',
      videoPath: 'A Real Import (2024)/a-real-import.mkv',
      genres: ['Drama'],
    });

    seedLibrary(storage, media);
    seedLibrary(storage, media);

    const survivor = storage.getMovie(mine.id);
    expect(survivor?.title).toBe('A Real Import');
    expect(storage.listMovies({ sort: 'a-z' })).toHaveLength(
      SEED_MOVIES.length + 1
    );
  });
});

describe('the dev seed — the states it puts on the home screen', () => {
  it('fills a genre row past the point where the carousel needs arrows', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    const biggest = Math.max(
      ...storage.getHome().rows.map((row) => row.movies.length)
    );
    expect(biggest).toBeGreaterThanOrEqual(MIN_OVERFLOWING_ROW);
  });

  it('gives Continue Watching tiles with a known runtime and one without', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    const { continueWatching } = storage.getHome();
    expect(
      continueWatching.filter((movie) => movie.runtimeMinutes !== null).length
    ).toBeGreaterThan(1);
    expect(
      continueWatching.some((movie) => movie.runtimeMinutes === null)
    ).toBe(true);
  });

  it('includes an in-progress movie with no genres, which only that row can show', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    const untagged = storage
      .getHome()
      .continueWatching.filter((movie) => movie.genres.length === 0);
    expect(untagged).toHaveLength(1);
  });

  it('covers the watched and unwatched card states as well as in-progress', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    const movies = storage.listMovies({ sort: 'a-z' });

    expect(movies.some((movie) => movie.status === 'watched')).toBe(true);
    expect(movies.some((movie) => movie.status === 'unwatched')).toBe(true);
    expect(movies.some((movie) => movie.status === 'in-progress')).toBe(true);
  });

  it('puts an unrated movie and a zero-rated one side by side on the shelves', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    const movies = storage.listMovies({ sort: 'a-z' });

    // Not "a fixture object omits rating" — the round trip is the point. A
    // repository that stored a literal 0 as NULL would put both cards in the
    // same state, and the whole reason these two fixtures exist is that the
    // difference between them is supposed to be visible by looking.
    const unrated = movies.filter((movie) => movie.rating === null);
    const zeroRated = movies.filter((movie) => movie.rating === 0);

    expect(unrated.length).toBeGreaterThanOrEqual(1);
    expect(zeroRated.length).toBeGreaterThanOrEqual(1);
  });

  it('keeps both rating states through a second run', () => {
    const { storage, media } = freshLibrary();

    // The zero-rated fixture is the one a re-run could quietly lose: rewriting
    // it as unrated would still leave the library the right length.
    seedLibrary(storage, media);
    seedLibrary(storage, media);
    const movies = storage.listMovies({ sort: 'a-z' });

    expect(movies.some((movie) => movie.rating === null)).toBe(true);
    expect(movies.some((movie) => movie.rating === 0)).toBe(true);
  });

  it('leaves every fixture without artwork, so the cards render their gradient', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    for (const movie of storage.listMovies({ sort: 'a-z' })) {
      expect(movie.posterPath).toBeNull();
      expect(movie.backdropPath).toBeNull();
    }
  });
});

// --- what the movie detail page needs below the fold ---------------------------
//
// Everything above this point is about the browse home. The detail page renders
// three fields no fixture carried until now — synopsis, director, and cast — so
// a seeded library would have shown that screen's lower two-thirds blank on all
// twenty-one movies. These tests pin the states that make the page checkable by
// looking rather than only by unit test.

describe('the dev seed — the states it puts on the movie detail page', () => {
  it('writes prose that survives the round trip through the repository', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    const movies = storage.listMovies({ sort: 'a-z' });

    // Not "the fixture object has a synopsis" — that a fixture sets a field the
    // repository quietly drops is exactly what this catches.
    const withSynopsis = movies.filter((movie) => movie.synopsis !== null);
    const withDirector = movies.filter((movie) => movie.director !== null);
    const withCast = movies.filter((movie) => movie.cast.length > 0);

    expect(withSynopsis.length).toBeGreaterThan(1);
    expect(withDirector.length).toBeGreaterThan(1);
    expect(withCast.length).toBeGreaterThan(1);
  });

  it('varies synopsis length so both clamp states are reachable', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    const synopses = storage
      .listMovies({ sort: 'a-z' })
      .map((movie) => movie.synopsis)
      .filter((synopsis): synopsis is string => synopsis !== null);

    const long = synopses.filter(
      (synopsis) => synopsis.length > OVERFLOWS_CLAMP
    );
    const short = synopses.filter((synopsis) => synopsis.length < FITS_CLAMP);

    // Several that overflow, so "Read more" is easy to find...
    expect(long.length).toBeGreaterThanOrEqual(MIN_LONG_SYNOPSES);
    // ...and at least one that does not, so its absence is visible too.
    expect(short.length).toBeGreaterThanOrEqual(1);
  });

  it('includes a movie missing only its director, which keeps its cast', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    // The credits row shows "—" for this one and keeps the cast beside it.
    const directorless = storage
      .listMovies({ sort: 'a-z' })
      .filter((movie) => movie.director === null && movie.cast.length > 0);
    expect(directorless.length).toBeGreaterThanOrEqual(1);
  });

  it('includes a movie missing both director and cast, beside ones with credits', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    const movies = storage.listMovies({ sort: 'a-z' });

    // Both halves matter. A fixture set with no credits at all satisfies "one
    // is uncredited" while showing nothing about the row that is supposed to
    // disappear — the omission is only visible next to a row that stayed.
    const uncredited = movies.filter(
      (movie) => movie.director === null && movie.cast.length === 0
    );
    const credited = movies.filter(
      (movie) => movie.director !== null || movie.cast.length > 0
    );
    expect(uncredited.length).toBeGreaterThanOrEqual(1);
    expect(credited.length).toBeGreaterThanOrEqual(1);
  });

  it('includes a movie with no synopsis, beside ones that have one', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    const movies = storage.listMovies({ sort: 'a-z' });

    const wordless = movies.filter((movie) => movie.synopsis === null);
    const described = movies.filter((movie) => movie.synopsis !== null);
    expect(wordless.length).toBeGreaterThanOrEqual(1);
    expect(described.length).toBeGreaterThanOrEqual(1);
  });
});

// --- the last-watched stamps ---------------------------------------------------

/** Every fixture's stamp, keyed by title — the shape a second run has to
 *  reproduce exactly, since `addMovie` mints a fresh id each time. */
function stampsByTitle(
  storage: ReturnType<typeof createSqliteStorage>
): Record<string, string | null> {
  return Object.fromEntries(
    storage
      .listMovies({ sort: 'a-z' })
      .map((movie) => [movie.title, movie.lastWatchedAt])
  );
}

describe('the dev seed — the last-watched stamps', () => {
  it('stamps every in-progress fixture', () => {
    // Without these the whole shelf is unstamped, the order falls back to
    // `created_at`, and the resume queue's order is invisible in the running
    // app until the player ships.
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    const inProgress = storage.listMovies({
      sort: 'a-z',
      inProgressOnly: true,
    });
    expect(inProgress.length).toBeGreaterThan(1);
    for (const movie of inProgress) {
      expect(typeof movie.lastWatchedAt).toBe('string');
    }
  });

  it('staggers them, so the shelf has an order to show rather than a tie', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    const stamps = storage
      .listMovies({ sort: 'a-z', inProgressOnly: true })
      .map((movie) => movie.lastWatchedAt);
    expect(new Set(stamps).size).toBe(stamps.length);
  });

  it('writes ISO strings, the same as every other date in the app', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    for (const movie of storage.listMovies({
      sort: 'a-z',
      inProgressOnly: true,
    })) {
      const stamp = movie.lastWatchedAt as string;
      expect(new Date(stamp).toISOString()).toBe(stamp);
    }
  });

  it('keeps the same stamps through a second run', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    const first = stampsByTitle(storage);
    // The comparison only means something if there are stamps to compare.
    expect(
      Object.values(first).filter((stamp) => typeof stamp === 'string').length
    ).toBeGreaterThan(1);

    seedLibrary(storage, media);

    expect(stampsByTitle(storage)).toEqual(first);
  });
});

// --- the files behind the fixtures ---------------------------------------------
//
// 10 — Video player, Phase 2: "direct play" (issue #84).
//
// Until the player, every fixture's `videoPath` pointed at nothing: the seed
// wrote rows and the browse home rendered them, and no code path ever opened the
// file. The stream route opens it, so a seeded library with no files behind it
// would put "Video file not available" on every film in the app — which is the
// one thing this seed exists to prevent.
//
// So a run now writes to the disk as well as the database, and the two
// guarantees that made it safe to point at the dev database have to hold for
// both halves: a run is idempotent, and a run cannot touch anything that
// arrived another way.

/** Every path under `root`, relative and sorted — the shape of a run's tree. */
function treeOf(root: string): string[] {
  return readdirSync(root, { recursive: true })
    .map((entry) => String(entry).split('\\').join('/'))
    .sort();
}

describe('the dev seed — the files it puts behind the fixtures', () => {
  it('leaves a real file at every fixture’s stored path', () => {
    // Not "some files were written": every seeded movie is one the player has
    // to be able to open, which is the whole point of the fixture.
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    for (const movie of storage.listMovies({ sort: 'a-z' })) {
      const file = join(media, movie.videoPath);
      expect(existsSync(file)).toBe(true);
      expect(readFileSync(file)).toEqual(readFileSync(SEED_FIXTURE_VIDEO));
    }
  });

  it('stores every fixture as an .mp4, the container that direct-plays', () => {
    // The fixture is H.264/AAC in an MP4. A row claiming `.mkv` over those bytes
    // would be served with the wrong content type and play nothing — the seed's
    // paths and the file it copies have to agree.
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    for (const movie of storage.listMovies({ sort: 'a-z' })) {
      expect(movie.videoPath.endsWith('.mp4')).toBe(true);
    }
  });

  it('keeps every copy inside the reserved prefix', () => {
    // The delete pass is scoped to this prefix on disk exactly as it is in the
    // database, so a copy written outside it could never be cleaned up again.
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);

    const tree = treeOf(media);
    // A run that wrote nothing satisfies "everything it wrote is under the
    // prefix" without meaning anything, so the count is asserted first.
    expect(tree.length).toBeGreaterThanOrEqual(SEED_MOVIES.length);
    for (const entry of tree) {
      expect(`${entry}/`.startsWith(SEED_VIDEO_PREFIX)).toBe(true);
    }
  });
});

describe('the dev seed — running it twice, on disk', () => {
  it('leaves the same files rather than a second copy of them', () => {
    const { storage, media } = freshLibrary();

    seedLibrary(storage, media);
    const first = treeOf(media);
    seedLibrary(storage, media);

    // Same guard as above: two empty trees are equal and prove nothing.
    expect(first.length).toBeGreaterThanOrEqual(SEED_MOVIES.length);
    expect(treeOf(media)).toEqual(first);
  });

  it('puts back a fixture file that was deleted by hand', () => {
    // Same convergence the database half has: a run is how you get back to the
    // known-good state, not something that only works on an untouched tree.
    const { storage, media } = freshLibrary();
    seedLibrary(storage, media);
    const [movie] = storage.listMovies({ sort: 'a-z' });
    rmSync(join(media, movie.videoPath), { force: true });

    seedLibrary(storage, media);

    const restored = storage
      .listMovies({ sort: 'a-z' })
      .find((candidate) => candidate.title === movie.title);
    expect(existsSync(join(media, restored?.videoPath ?? ''))).toBe(true);
  });

  it('clears up under the prefix and nowhere else', () => {
    // Both halves of the delete pass's scope, in one test because neither half
    // means anything without the other. A stale copy has to go — rename a
    // fixture and its old file would otherwise sit there forever — and a film
    // the maintainer imported has to survive, which is the guarantee that makes
    // it safe to point this at the real media directory at all.
    const { storage, media } = freshLibrary();
    const stale = join(media, SEED_VIDEO_PREFIX, 'retired-film', 'retired.mp4');
    const mine = join(media, 'A Real Import (2024)', 'a-real-import.mp4');
    for (const file of [stale, mine]) {
      mkdirSync(join(file, '..'), { recursive: true });
    }
    writeFileSync(stale, 'left over from an older fixture set');
    writeFileSync(mine, 'a film the maintainer imported');

    seedLibrary(storage, media);
    seedLibrary(storage, media);

    expect(existsSync(stale)).toBe(false);
    expect(readFileSync(mine, 'utf8')).toBe('a film the maintainer imported');
  });
});
