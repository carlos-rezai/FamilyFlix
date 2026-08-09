import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { createSqliteStorage, type LibraryStorage } from '../../library';
import type { NewMovie } from '@/types';

/**
 * Development scaffolding, with a stated end date.
 *
 * FamilyFlix has no way to put a movie in the library yet — Add Movie and bulk
 * import are both unbuilt, and nothing writes a resume position until the
 * player ships. A freshly migrated database therefore holds twelve genres and
 * zero movies, so running the app shows "Your library is empty" and every
 * visual claim about the browse home is unverifiable by looking at it.
 *
 * This module writes a fixture library through the ordinary
 * {@link LibraryStorage} interface so the home screen has something to render.
 * It is not production code and it is not a migration: the commit that ships
 * bulk import is the commit that should delete it.
 *
 * @see docs/refactor-plans/03-card-carousel-refactor.md
 */

/**
 * The reserved video-path prefix that marks a row as belonging to the seed.
 *
 * This is what makes a run idempotent without widening any production write
 * interface. `addMovie` mints its own id, so the seed cannot write rows under
 * fixed ids it could later look up; instead every fixture stores its video
 * under this prefix, and a run deletes exactly the movies carrying it before
 * writing the set again. A movie added any other way can never match, so the
 * seed can never delete real data — the guarantee matters because this runs
 * against the same on-disk database the dev server uses.
 */
export const SEED_VIDEO_PREFIX = '__seed__/';

/** What one run of the seed did, for the caller and for the stdout report. */
export interface SeedReport {
  /** Seed rows found from a previous run and removed before rewriting. */
  removed: number;
  /** Fixtures written by this run — always the full set. */
  added: number;
}

/**
 * Build the reserved relative video path for one fixture. Paths are stored
 * relative to the managed media directory, exactly as a real import would store
 * them; nothing on disk backs them, which is fine because nothing plays a seed
 * movie.
 */
function seedVideoPath(slug: string): string {
  return `${SEED_VIDEO_PREFIX}${slug}/${slug}.mkv`;
}

/**
 * The fixture library.
 *
 * Chosen to exercise every state the browse home can show, so that looking at
 * the app is a real check on the feature rather than a partial one:
 *
 * - **Action holds twelve titles** — comfortably more than fit on screen, so
 *   that row overflows and the carousel's prev/next arrows actually appear.
 * - **Six movies are in progress with a known runtime**, giving the Continue
 *   Watching row real tiles with a "Resume · 52:00 of 2:08:00" label and a
 *   proportional progress track.
 * - **One is in progress with no runtime at all** (`Signal Lost`), which is the
 *   case that renders the elapsed-only label and the nominal progress sliver.
 * - **One is in progress and carries no genre tags** (`Reel 4, Unlabelled`), so
 *   it earns no genre row and appears in Continue Watching alone.
 * - **Three are watched**, which is the poster card's badge state, and the rest
 *   are unwatched, which is its plain state.
 * - **Three are favorites** and one is deliberately unrated, so the heart and
 *   the empty star row are both visible somewhere on the screen.
 *
 * Genres are drawn only from the twelve the migration seeds — `addMovie`
 * rejects an unknown genre name, so a typo here fails the seed loudly rather
 * than writing a half-tagged library.
 *
 * No fixture carries a poster or backdrop path. That is deliberate: with no
 * artwork the cards render their deterministic id-derived gradient, which is
 * exactly what they are specified to do for a movie whose images have not been
 * imported, and it keeps the seed from depending on binary files in the repo.
 */
export const SEED_MOVIES: readonly NewMovie[] = [
  // --- Action: the deliberately overflowing row ------------------------------
  {
    title: 'Northwind',
    videoPath: seedVideoPath('northwind-2018'),
    year: 2018,
    runtimeMinutes: 128,
    genres: ['Action', 'Adventure'],
    rating: 8,
    resumePositionSeconds: 3120,
  },
  {
    title: 'Ironclad Sky',
    videoPath: seedVideoPath('ironclad-sky-2021'),
    year: 2021,
    runtimeMinutes: 142,
    genres: ['Action', 'Sci-Fi'],
    rating: 9,
    resumePositionSeconds: 5100,
  },
  {
    title: 'Midnight Errand',
    videoPath: seedVideoPath('midnight-errand-2020'),
    year: 2020,
    runtimeMinutes: 105,
    genres: ['Action', 'Crime'],
    rating: 7,
  },
  {
    title: 'Blackwater Run',
    videoPath: seedVideoPath('blackwater-run-2019'),
    year: 2019,
    runtimeMinutes: 117,
    genres: ['Action', 'Thriller'],
    rating: 6,
    isFavorite: true,
  },
  {
    title: 'Iron Meridian',
    videoPath: seedVideoPath('iron-meridian-2016'),
    year: 2016,
    runtimeMinutes: 131,
    genres: ['Action'],
    rating: 9,
    watched: true,
  },
  {
    title: 'The Last Convoy',
    videoPath: seedVideoPath('the-last-convoy-2014'),
    year: 2014,
    runtimeMinutes: 108,
    genres: ['Action', 'Adventure'],
    rating: 5,
  },
  {
    // Deliberately unrated (distinct from a stored 0) — the star row's empty state.
    title: 'Havoc Line',
    videoPath: seedVideoPath('havoc-line-2022'),
    year: 2022,
    runtimeMinutes: 99,
    genres: ['Action'],
  },
  {
    title: 'Steel Rain',
    videoPath: seedVideoPath('steel-rain-2015'),
    year: 2015,
    runtimeMinutes: 124,
    genres: ['Action', 'Drama'],
    rating: 8,
  },
  {
    title: 'Nightfall Protocol',
    videoPath: seedVideoPath('nightfall-protocol-2023'),
    year: 2023,
    runtimeMinutes: 136,
    genres: ['Action', 'Thriller'],
    rating: 7,
    resumePositionSeconds: 1200,
  },
  {
    title: 'Crosswind',
    videoPath: seedVideoPath('crosswind-2012'),
    year: 2012,
    runtimeMinutes: 95,
    genres: ['Action'],
    rating: 4,
  },
  {
    title: 'Redline County',
    videoPath: seedVideoPath('redline-county-2017'),
    year: 2017,
    runtimeMinutes: 112,
    genres: ['Action', 'Crime'],
    rating: 6,
    isFavorite: true,
  },
  {
    title: 'Ash & Asphalt',
    videoPath: seedVideoPath('ash-and-asphalt-2011'),
    year: 2011,
    runtimeMinutes: 101,
    genres: ['Action'],
    rating: 5,
    watched: true,
  },

  // --- The rest of the shelves ----------------------------------------------
  {
    title: 'The Quiet Harbor',
    videoPath: seedVideoPath('the-quiet-harbor-2016'),
    year: 2016,
    runtimeMinutes: 111,
    genres: ['Drama', 'Romance'],
    rating: 7,
  },
  {
    title: 'Paper Lanterns',
    videoPath: seedVideoPath('paper-lanterns-2019'),
    year: 2019,
    runtimeMinutes: 96,
    genres: ['Animation', 'Family'],
    rating: 10,
    isFavorite: true,
    watched: true,
  },
  {
    title: 'The Long Descent',
    videoPath: seedVideoPath('the-long-descent-2022'),
    year: 2022,
    runtimeMinutes: 88,
    genres: ['Documentary'],
    rating: 7,
    resumePositionSeconds: 1500,
  },
  {
    title: 'Glasshouse',
    videoPath: seedVideoPath('glasshouse-2017'),
    year: 2017,
    runtimeMinutes: 94,
    genres: ['Horror', 'Thriller'],
    rating: 6,
    resumePositionSeconds: 900,
  },
  {
    title: 'Cardboard Kings',
    videoPath: seedVideoPath('cardboard-kings-2013'),
    year: 2013,
    runtimeMinutes: 98,
    genres: ['Comedy', 'Family'],
    rating: 8,
  },
  {
    title: 'Rooftop Season',
    videoPath: seedVideoPath('rooftop-season-2019'),
    year: 2019,
    runtimeMinutes: 102,
    genres: ['Comedy', 'Romance'],
    rating: 5,
  },
  {
    // No runtime: the resume label drops the "of ..." half and the progress bar
    // falls back to its nominal sliver.
    title: 'Signal Lost',
    videoPath: seedVideoPath('signal-lost-2023'),
    year: 2023,
    genres: ['Sci-Fi', 'Thriller'],
    rating: 8,
    resumePositionSeconds: 2460,
  },
  {
    // No genres at all: earns no genre row, so Continue Watching is the only
    // place it can appear.
    title: 'Reel 4, Unlabelled',
    videoPath: seedVideoPath('reel-4-unlabelled-2005'),
    year: 2005,
    runtimeMinutes: 42,
    resumePositionSeconds: 600,
  },
];

/**
 * Replace the seed's rows in `storage` with the current fixture set, leaving
 * every other movie alone.
 *
 * Idempotent by construction: the delete pass is scoped to the reserved video
 * prefix, so running twice leaves the same library rather than a doubled one,
 * and editing {@link SEED_MOVIES} then re-running converges on the new set.
 * Takes the storage rather than a path so a test can hand it an in-memory
 * database and exercise the real repository.
 */
export function seedLibrary(storage: LibraryStorage): SeedReport {
  const previous = storage
    .listMovies({ sort: 'a-z' })
    .filter((movie) => movie.videoPath.startsWith(SEED_VIDEO_PREFIX));

  for (const movie of previous) {
    storage.deleteMovie(movie.id);
  }

  for (const fixture of SEED_MOVIES) {
    storage.addMovie(fixture);
  }

  return { removed: previous.length, added: SEED_MOVIES.length };
}

/**
 * The database the seed writes to when run as a script.
 *
 * Mirrors the default in `server/src/main.ts` on purpose — the point of the
 * seed is that `npm run db:seed && npm run dev` shows you the rows you just
 * wrote, which only holds if both processes open the same file. `FAMILYFLIX_DB_PATH`
 * overrides it in both places, so pointing the dev server at another database
 * points the seed there too.
 */
const DEFAULT_DB_PATH = './familyflix.db';

/**
 * Open the library, seed it, report what happened, close the connection.
 *
 * Reports through `console.info` rather than `console.log`: the code rules ban
 * `console.log` outright, and the info channel already carries the `DEBUG_SQL`
 * tracing output, so it is the channel with precedent. A script whose whole job
 * is to tell you what it wrote needs to say so somewhere.
 */
export function runSeed(
  dbPath: string = process.env.FAMILYFLIX_DB_PATH ?? DEFAULT_DB_PATH
): SeedReport {
  const storage = createSqliteStorage(dbPath);

  try {
    const report = seedLibrary(storage);
    console.info(
      `Seeded ${report.added} movies into ${dbPath} ` +
        `(removed ${report.removed} from a previous run).`
    );
    return report;
  } finally {
    // Closing in `finally` so a failed run still releases the WAL files rather
    // than leaving the dev server to trip over them.
    storage.close();
  }
}

/**
 * Run only when this file is the process entrypoint (`npm run db:seed`), never
 * on import. The test imports this module for its fixtures and its pure seeding
 * function, and must not write to the real database as a side effect of that.
 */
const isEntrypoint =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  runSeed();
}
