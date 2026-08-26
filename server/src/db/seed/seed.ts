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
 * - **Three are favorites**, so the heart is visible somewhere on the screen.
 * - **One is deliberately unrated and one is deliberately rated nought**
 *   (`Havoc Line` and `Cold Open`, both in Action so they share a row). The
 *   two used to render the identical tile; the pair is here so that the
 *   difference between them — a bare star row versus one reading `0.0` —
 *   is checkable by looking, which is the reason this seed exists at all.
 *
 * The synopsis and credits exist for the movie detail page, whose lower
 * two-thirds is otherwise blank on every fixture, and they cover that screen's
 * states the same way:
 *
 * - **Several synopses run well past four lines** at the page's 560px measure,
 *   so `ExpandableText`'s "Read more" is there to click, and **a few sit
 *   comfortably under it** (`Havoc Line`, `Glasshouse`), so the absence of the
 *   toggle is visible too.
 * - **`Ash & Asphalt` has no synopsis** but keeps its credits, and
 *   **`Reel 4, Unlabelled` has neither** — the blocks that are supposed to
 *   disappear, disappearing.
 * - **`The Last Convoy` is credited to a cast but no director**, which is the
 *   case where the credits row renders "—" rather than dropping out, and
 *   **`Crosswind` has neither credit**, which is the case where it drops out
 *   entirely.
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
    // Long synopsis: overflows the detail page's four-line clamp, so "Read
    // more" is there to click.
    title: 'Northwind',
    videoPath: seedVideoPath('northwind-2018'),
    year: 2018,
    runtimeMinutes: 128,
    synopsis:
      'A retired ice pilot agrees to fly one last supply run to a research ' +
      'station the government stopped listing on its maps, and finds the crew ' +
      'gone and the radios still warm. What begins as a salvage job turns into ' +
      'a slow walk north through a season that has already decided how it ends, ' +
      'beside a passenger who knows more about the station than anyone left ' +
      'alive should.',
    director: 'Hal Brenner',
    cast: ['Ivy Okonkwo', 'Tomas Reier', 'Nadia Fenn'],
    genres: ['Action', 'Adventure'],
    rating: 8,
    resumePositionSeconds: 3120,
  },
  {
    title: 'Ironclad Sky',
    videoPath: seedVideoPath('ironclad-sky-2021'),
    year: 2021,
    runtimeMinutes: 142,
    synopsis:
      'Three decades after the orbital blockade, a mechanic who keeps other ' +
      "people's stolen fighters flying is handed a machine that answers to a " +
      "dead pilot's voice. Getting it off the ground costs her the only " +
      'workshop she has ever owned; keeping it in the air means finishing a war ' +
      'her parents surrendered, one contested corridor at a time, with a ' +
      'squadron assembled entirely out of people the fleet wrote off.',
    director: 'Sunita Raval',
    cast: ['Deena Marsh', 'Kwame Adjei', 'Lior Sabbagh', 'Perry Nakamura'],
    genres: ['Action', 'Sci-Fi'],
    rating: 9,
    resumePositionSeconds: 5100,
  },
  {
    title: 'Midnight Errand',
    videoPath: seedVideoPath('midnight-errand-2020'),
    year: 2020,
    runtimeMinutes: 105,
    synopsis:
      'A courier with one night left on her visa takes a package across a city ' +
      'that has quietly closed to her, and finds that everyone who touches the ' +
      'box would rather she kept walking than delivered it.',
    director: 'Émile Roux',
    cast: ['Yara Demir', 'Anton Pilch'],
    genres: ['Action', 'Crime'],
    rating: 7,
  },
  {
    title: 'Blackwater Run',
    videoPath: seedVideoPath('blackwater-run-2019'),
    year: 2019,
    runtimeMinutes: 117,
    synopsis:
      'Two brothers run a fishing boat that has not carried fish in years. ' +
      'When the elder takes on a cargo he refuses to describe, the younger has ' +
      'to decide how much of the river he is willing to know.',
    director: 'Ruth Calloway',
    cast: ['Sam Ojo', 'Elias Ojo', 'Marguerite Vance'],
    genres: ['Action', 'Thriller'],
    rating: 6,
    isFavorite: true,
  },
  {
    title: 'Iron Meridian',
    videoPath: seedVideoPath('iron-meridian-2016'),
    year: 2016,
    runtimeMinutes: 131,
    synopsis:
      'The last surveyor of a border that no longer exists walks its length ' +
      'one final time, marking stones for a country that has already renamed ' +
      'the valleys behind him. He is followed by a soldier assigned to make ' +
      'sure the map comes out wrong, by a translator who has learned to hear ' +
      'both sides lie in the same sentence, and eventually by the war itself, ' +
      'arriving early and from the wrong direction.',
    director: 'Beatrix Halloran',
    cast: ['Gustav Weiss', 'Amira Haddad', 'Jonas Fell'],
    genres: ['Action'],
    rating: 9,
    watched: true,
  },
  {
    // Credited to nobody in the chair, but the cast survived — the detail
    // page's credits row shows "—" for the director and keeps the names.
    title: 'The Last Convoy',
    videoPath: seedVideoPath('the-last-convoy-2014'),
    year: 2014,
    runtimeMinutes: 108,
    synopsis:
      'A supply column crosses two hundred miles of open country with a radio ' +
      'that only receives, and every night the drivers argue about whether the ' +
      'voice on it is ahead of them or behind.',
    cast: ['Rosa Iglesias', 'Duncan Frey'],
    genres: ['Action', 'Adventure'],
    rating: 5,
  },
  {
    // Deliberately unrated (distinct from a stored 0) — the star row's empty
    // state. Its synopsis is short enough to sit inside the clamp, so the
    // absence of a "Read more" toggle is visible somewhere too.
    title: 'Havoc Line',
    videoPath: seedVideoPath('havoc-line-2022'),
    year: 2022,
    runtimeMinutes: 99,
    synopsis:
      'A demolition crew is given one week to bring down a tower nobody will ' +
      'admit still has tenants.',
    director: 'Priya Anand',
    cast: ['Ola Berg', 'Curtis Vane'],
    genres: ['Action'],
  },
  {
    // Rated nought, on purpose, and filed next to `Havoc Line` so the pair sits
    // in the same row: five empty stars with no number is the unrated card,
    // five empty stars reading `0.0` is this one. Every claim about telling
    // them apart is checkable by looking at the Action shelf.
    title: 'Cold Open',
    videoPath: seedVideoPath('cold-open-2019'),
    year: 2019,
    runtimeMinutes: 91,
    synopsis:
      'A stunt team is hired to stage a heist for a film that turns out to ' +
      'have no crew, no cameras and a very real vault.',
    director: 'Marguerite Osei',
    cast: ['Dov Halperin', 'Ines Carvalho'],
    genres: ['Action'],
    rating: 0,
  },
  {
    title: 'Steel Rain',
    videoPath: seedVideoPath('steel-rain-2015'),
    year: 2015,
    runtimeMinutes: 124,
    synopsis:
      "A monsoon strands a mine's night shift underground with the foreman who " +
      'has been falsifying the safety logs for a decade, and the new hire who ' +
      'has read all of them.',
    director: 'Tobias Lindqvist',
    cast: ['Neve Marchetti', 'Idris Kamara'],
    genres: ['Action', 'Drama'],
    rating: 8,
  },
  {
    title: 'Nightfall Protocol',
    videoPath: seedVideoPath('nightfall-protocol-2023'),
    year: 2023,
    runtimeMinutes: 136,
    synopsis:
      'An analyst who spent nine years writing the evacuation plan for a city ' +
      'she never visited is finally sent there to run it, four hours after the ' +
      'order she wrote was ignored. Every step of the protocol assumes people ' +
      'who no longer hold their posts, roads that were rerouted in the spring, ' +
      'and a chain of command that would rather the plan failed cleanly than ' +
      'succeeded by improvisation.',
    director: 'Wren Achebe',
    cast: ['Cordelia Stamp', 'Miguel Arriaga', 'Hana Yoshida'],
    genres: ['Action', 'Thriller'],
    rating: 7,
    resumePositionSeconds: 1200,
  },
  {
    // Uncredited on both counts: the detail page drops the credits row entirely
    // for this one, which only reads as deliberate next to the movies that keep
    // theirs.
    title: 'Crosswind',
    videoPath: seedVideoPath('crosswind-2012'),
    year: 2012,
    runtimeMinutes: 95,
    synopsis:
      'A crop duster with a grounded licence flies anyway, and the county ' +
      'spends a summer pretending not to hear him.',
    genres: ['Action'],
    rating: 4,
  },
  {
    title: 'Redline County',
    videoPath: seedVideoPath('redline-county-2017'),
    year: 2017,
    runtimeMinutes: 112,
    synopsis:
      "A sheriff's deputy inherits a stretch of highway, the arrangement that " +
      'keeps it quiet, and the ledger naming everyone who has ever benefited ' +
      'from both.',
    director: 'Lorna Buckhalter',
    cast: ['Theo Grant', 'Simone Aleixo'],
    genres: ['Action', 'Crime'],
    rating: 6,
    isFavorite: true,
  },
  {
    // No synopsis at all, but fully credited: the synopsis block disappears and
    // the credits row below it stays.
    title: 'Ash & Asphalt',
    videoPath: seedVideoPath('ash-and-asphalt-2011'),
    year: 2011,
    runtimeMinutes: 101,
    director: 'Casimir Nowak',
    cast: ['Bela Toth', 'Ren Aoki'],
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
    synopsis:
      'A lighthouse keeper on a coast the ferries stopped serving takes in a ' +
      'girl who arrived on the last boat and will not say where from. Over one ' +
      'long off-season they build something like a family out of a rationed ' +
      'pantry, a broken radio, and the slow understanding that the mainland has ' +
      'questions neither of them intends to answer honestly — and that the ' +
      'light itself is scheduled to be automated in the spring.',
    director: 'Ana Sørensen',
    cast: ['Marit Holt', 'Peder Vinge', 'Ilse Brandt'],
    genres: ['Drama', 'Romance'],
    rating: 7,
  },
  {
    title: 'Paper Lanterns',
    videoPath: seedVideoPath('paper-lanterns-2019'),
    year: 2019,
    runtimeMinutes: 96,
    synopsis:
      'A girl who folds lanterns for a festival her town can no longer afford ' +
      'discovers that the ones she sends downriver are coming back.',
    director: 'Mei-Lin Chow',
    cast: ['Ayaka Sudo', 'Bruno Pereira'],
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
    synopsis:
      'Over four years, a camera follows the crew dismantling a mountain ' +
      'railway that took sixty years to build, from the first bolt lifted out ' +
      'of the summit station to the last carriage lowered onto a truck. The men ' +
      'taking it apart are the sons of the men who laid it, and most of them ' +
      'will have no work in the valley once the line is gone. The film never ' +
      'leaves the mountain, and never asks anyone to explain themselves.',
    director: 'Ingrid Vasquez',
    cast: [],
    genres: ['Documentary'],
    rating: 7,
    resumePositionSeconds: 1500,
  },
  {
    title: 'Glasshouse',
    videoPath: seedVideoPath('glasshouse-2017'),
    year: 2017,
    runtimeMinutes: 94,
    synopsis:
      "A botanist inherits her aunt's greenhouse and the routine that keeps it " +
      'alive, and learns which of the two the house actually needs.',
    director: 'Sasha Ilves',
    cast: ['Freya Lund', 'Otto Wexler'],
    genres: ['Horror', 'Thriller'],
    rating: 6,
    resumePositionSeconds: 900,
  },
  {
    title: 'Cardboard Kings',
    videoPath: seedVideoPath('cardboard-kings-2013'),
    year: 2013,
    runtimeMinutes: 98,
    synopsis:
      'Four children build a kingdom in the yard behind a furniture shop, and ' +
      'defend it through a summer in which their parents quietly divide ' +
      'everything else.',
    director: 'Georgie Mbeki',
    cast: ['Pia Rademacher', 'Sol Villanueva', 'Emmett Doyle'],
    genres: ['Comedy', 'Family'],
    rating: 8,
  },
  {
    title: 'Rooftop Season',
    videoPath: seedVideoPath('rooftop-season-2019'),
    year: 2019,
    runtimeMinutes: 102,
    synopsis:
      'Two neighbours who have never spoken share a rooftop through one summer ' +
      'of repairs, and negotiate the whole of a friendship through the ' +
      'placement of two chairs.',
    director: 'Halvard Nyman',
    cast: ['Junia Castro', 'Wallace Idowu'],
    genres: ['Comedy', 'Romance'],
    rating: 5,
  },
  {
    // No runtime: the resume label drops the "of ..." half and the progress bar
    // falls back to its nominal sliver.
    title: 'Signal Lost',
    videoPath: seedVideoPath('signal-lost-2023'),
    year: 2023,
    synopsis:
      'A night-shift operator at a decommissioned relay station keeps logging ' +
      'transmissions the equipment is no longer capable of receiving.',
    director: 'Tomasz Ferreira',
    cast: ['Klara Bond'],
    genres: ['Sci-Fi', 'Thriller'],
    rating: 8,
    resumePositionSeconds: 2460,
  },
  {
    // No genres at all: earns no genre row, so Continue Watching is the only
    // place it can appear. Nothing else either — no synopsis, no credits — the
    // unlabelled reel is the detail page's emptiest possible movie.
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
