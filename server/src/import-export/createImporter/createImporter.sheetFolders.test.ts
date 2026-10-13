// @vitest-environment node
//
// 40 — Import review, Phase 1: "the sheet over the folders" (issue #331).
//
// `createImporter.start(sheetPath, enrich?)` — a sheet run with no root. It
// reads every listed **Library folder** through the same walk a **Folder
// scan** takes:
//
// - the log opens with one `Scanning   <path>` line per listed folder, in the
//   order added; one that cannot be reached is skipped with
//   `⚠ Can't reach <path>, skipped`, and the run goes on over the others;
// - a **Sheet row** names its folder through `matchRows`, in whichever listed
//   folder it lies, and each title records the Library folder it was found in;
// - **Already in library** is the Folder scan's two rules in order: the
//   Source folder on record first, whatever the title now says, then the
//   title key and year;
// - with no folder listed the start is refused as an `ImportStartError` on
//   `folders`, before any run exists.
//
// The runs are real: the film and series fixtures copied into two sandboxed
// Library folders, one sheet naming all four titles, a real `Media` over a
// sandbox managed directory, the absent **Playback component**, and a raw
// handle on the same database for the two columns no shared type carries.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createImporter,
  ImportStartError,
  type Importer,
} from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  /** The Library folder the film fixture was copied into. */
  films: string;
  /** The Library folder the series fixture was copied into. */
  shows: string;
  /** A path nothing is at. */
  gone: string;
  /** One sheet naming the two films and the two shows. */
  sheet: string;
}

/**
 * A library on disk, a raw handle on it, the two fixture folders — listed by
 * none, so each test lists what it means — and one sheet over both.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-sheet-folders-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  mkdirSync(join(dir, 'shows'));
  const { root: films, sheet: filmSheet } = libraryFixture(
    join(dir, 'films'),
    'library.csv'
  );
  const { root: shows, sheet: showSheet } = seriesFixture(
    join(dir, 'shows'),
    'library.csv'
  );

  // The two fixture sheets share their header: the films' whole, then the
  // shows' rows under it.
  const sheet = join(dir, 'both.csv');
  const showRows = readFileSync(showSheet, 'utf8').split(/\r?\n/).slice(1);
  writeFileSync(
    sheet,
    `${readFileSync(filmSheet, 'utf8').trimEnd()}\n${showRows.join('\n')}`
  );

  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return {
    storage,
    db,
    importer,
    films,
    shows,
    gone: join(dir, 'gone'),
    sheet,
  };
}

/** Both Library folders listed, films first. */
function listBoth(box: Sandbox): {
  films: StoredLibraryFolder;
  shows: StoredLibraryFolder;
} {
  const films = box.storage.addLibraryFolder(box.films);
  const shows = box.storage.addLibraryFolder(box.shows);
  return { films, shows };
}

/** The snapshot once the run has reached review — or a failure if it never does. */
async function untilReview(importer: Importer): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = importer.current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** One whole sheet run, then the run let go, so another may start. */
async function runOnce(importer: Importer, sheet: string): Promise<ImportRun> {
  await importer.start(sheet);
  const run = await untilReview(importer);
  await importer.cancel();
  return run;
}

interface TitleRow {
  title: string;
  library_folder_id: string | null;
  source_folder: string | null;
}

/** Every title in one table, with the two columns the run writes, by title. */
function rows(
  db: SqliteDatabase,
  table: 'movies' | 'series'
): Record<string, TitleRow> {
  const all = db
    .prepare(`SELECT title, library_folder_id, source_folder FROM ${table}`)
    .all() as TitleRow[];
  return Object.fromEntries(all.map((row) => [row.title, row]));
}

const movieTitles = (storage: LibraryStorage): string[] =>
  storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title);

const seriesTitles = (storage: LibraryStorage): string[] =>
  storage
    .getSeriesHome()
    .series.map((show) => show.title)
    .sort((a, b) => a.localeCompare(b));

const texts = (run: ImportRun) => run.log.map((line) => line.text);

describe('createImporter.start — a sheet over two listed folders', () => {
  it('imports the films in one folder and the shows in the other', async () => {
    const box = sandbox();
    listBoth(box);

    await runOnce(box.importer, box.sheet);

    expect(movieTitles(box.storage)).toEqual(['Amélie', 'Die Hard']);
    expect(seriesTitles(box.storage)).toEqual(['Harbor & Vine', 'Tidewater']);
  });

  it('opens the log with one Scanning line per folder, in the order added', async () => {
    const box = sandbox();
    listBoth(box);

    const run = await runOnce(box.importer, box.sheet);

    expect(run.log.slice(0, 2)).toEqual([
      { text: `Scanning   ${box.films}`, kind: 'scan' },
      { text: `Scanning   ${box.shows}`, kind: 'scan' },
    ]);
  });

  it('records each title against the Library folder it was found in', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    await runOnce(box.importer, box.sheet);

    const movies = rows(box.db, 'movies');
    expect(movies['Die Hard']).toMatchObject({
      library_folder_id: folders.films.id,
      source_folder: 'Die.Hard.1988.1080p',
    });
    const series = rows(box.db, 'series');
    expect(series['Tidewater']).toMatchObject({
      library_folder_id: folders.shows.id,
      source_folder: 'Tidewater (2018)',
    });
  });

  it('leaves the list of Library folders as it was', async () => {
    const box = sandbox();
    listBoth(box);

    await runOnce(box.importer, box.sheet);

    expect(box.storage.libraryFolders().map((folder) => folder.path)).toEqual([
      box.films,
      box.shows,
    ]);
  });

  it('carries enrich on the run, and only carries it', async () => {
    const box = sandbox();
    listBoth(box);

    const started = await box.importer.start(box.sheet, true);
    await untilReview(box.importer);
    await box.importer.cancel();

    expect(started).toMatchObject({ source: 'sheet', enrich: true });
  });
});

describe('createImporter.start — an unreachable folder', () => {
  it('is skipped with its warning, and the run goes on over the others', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.gone);
    box.storage.addLibraryFolder(box.films);

    const run = await runOnce(box.importer, box.sheet);

    expect(run.log).toContainEqual({
      text: `⚠ Can't reach ${box.gone}, skipped`,
      kind: 'warning',
    });
    expect(movieTitles(box.storage)).toEqual(['Amélie', 'Die Hard']);
  });

  it('still reaches review when no folder could be reached', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.gone);

    const run = await runOnce(box.importer, box.sheet);

    expect(run.phase).toBe('review');
    expect(texts(run)).toContain(`⚠ Can't reach ${box.gone}, skipped`);
    expect(movieTitles(box.storage)).toEqual([]);
  });
});

describe('createImporter.start — no folder listed', () => {
  it('is refused on folders, in one sentence, before any run exists', async () => {
    const box = sandbox();

    const refusal = box.importer.start(box.sheet);

    await expect(refusal).rejects.toBeInstanceOf(ImportStartError);
    await expect(refusal).rejects.toMatchObject({
      field: 'folders',
      message: 'Add a library folder first.',
    });
    expect(box.importer.current()).toBeNull();
  });

  it('still refuses a sheet that does not exist on the sheet field', async () => {
    const box = sandbox();
    listBoth(box);

    await expect(
      box.importer.start(join(box.films, '..', 'missing.csv'))
    ).rejects.toMatchObject({ field: 'sheet' });
  });
});

describe('createImporter.start — Already in library', () => {
  it('knows a held film by its Source folder first, whatever its title now says', async () => {
    const box = sandbox();
    listBoth(box);
    await runOnce(box.importer, box.sheet);
    box.db
      .prepare(
        "UPDATE movies SET title = 'A Christmas Siege', year = 1990 WHERE title = 'Die Hard'"
      )
      .run();

    const run = await runOnce(box.importer, box.sheet);

    expect(movieTitles(box.storage)).toEqual(['A Christmas Siege', 'Amélie']);
    expect(run).toMatchObject({ total: 0, done: 0 });
    expect(texts(run)).toContainEqual(
      expect.stringMatching(/^· Already in library Die Hard \(1988\)$/)
    );
  });

  it('knows a held show by its Source folder first, whatever its title now says', async () => {
    const box = sandbox();
    listBoth(box);
    await runOnce(box.importer, box.sheet);
    box.db
      .prepare(
        "UPDATE series SET title = 'The Ferry', year = 2019 WHERE title = 'Tidewater'"
      )
      .run();

    await runOnce(box.importer, box.sheet);

    expect(seriesTitles(box.storage)).toEqual(['Harbor & Vine', 'The Ferry']);
  });

  it('then knows a held film by its title key and year, and links it to its folder', async () => {
    const box = sandbox();
    const folders = listBoth(box);
    const held = box.storage.addMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'die-hard-1988/video.mp4',
    });

    const run = await runOnce(box.importer, box.sheet);

    expect(movieTitles(box.storage)).toEqual(['Amélie', 'Die Hard']);
    expect(
      box.db
        .prepare(
          'SELECT library_folder_id, source_folder FROM movies WHERE id = ?'
        )
        .get(held.id)
    ).toEqual({
      library_folder_id: folders.films.id,
      source_folder: 'Die.Hard.1988.1080p',
    });
    // Held bare, it takes the row's Sheet fills (issue #332) rather than
    // the Already in library line.
    expect(
      texts(run).some((text) => text.startsWith('✓ Updated    Die Hard (1988)'))
    ).toBe(true);
  });

  it('logs one Already in library line per title on a re-run with nothing to fill or add', async () => {
    const box = sandbox();
    listBoth(box);
    await runOnce(box.importer, box.sheet);

    const run = await runOnce(box.importer, box.sheet);

    const held = texts(run).filter((text) =>
      text.startsWith('· Already in library ')
    );
    expect(held.sort()).toEqual(
      [
        ...box.storage
          .listMovies({ sort: 'a-z' })
          .map(
            (movie) => `· Already in library ${movie.title} (${movie.year})`
          ),
        ...box.storage
          .getSeriesHome()
          .series.map(
            (show) => `· Already in library ${show.title} (${show.year})`
          ),
      ].sort()
    );
  });
});
