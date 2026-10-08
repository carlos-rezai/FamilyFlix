// @vitest-environment node
//
// 30 — Library folders, Phase 2: "the Folder scan" (issue #269).
//
// `createImporter.scan(folders, enrich?)` — the importer's second start, on the
// same state machine, **Current run** and **Review step** as a sheet import,
// with no spreadsheet at all:
//
// - each reachable **Library folder** is walked in the order added; one that
//   cannot be reached is skipped with `⚠ Can't reach <path> — skipped`, and a
//   run with none reachable still reaches review;
// - the log opens with one `Scanning   <path>` line per folder;
// - a film is named off its folder (`titleGuess` / `yearInName`), a show off
//   its Show folder — so no `no-row` and no `missing-meta` is ever raised;
// - **Already in library** is two rules in order: the same Library folder and
//   Source folder (whatever the title now says), then the title key and year,
//   which links the held title to this folder;
// - each new title records `library_folder_id` and a `source_folder` relative
//   to its Library folder;
// - `ImportRun.source` is `'folders'`, a sheet run's `'sheet'`.
//
// The runs are real: the film and series fixtures copied into two sandboxed
// Library folders, a real `Media` over a sandbox managed directory, the absent
// **Playback component**, and a raw handle on the same database for the two
// columns no shared type carries.

import { copyFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
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
  /** The film fixture's sheet, for a sheet run beside the scans. */
  sheet: string;
}

/** A library on disk, a raw handle on it, and the two fixture folders. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-folder-scan-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  mkdirSync(join(dir, 'shows'));
  const { root: films, sheet } = libraryFixture(
    join(dir, 'films'),
    'library.csv'
  );
  const { root: shows } = seriesFixture(join(dir, 'shows'), 'library.csv');

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

/** One whole scan, then the run let go, so another may start. */
async function scanOnce(
  importer: Importer,
  folders: StoredLibraryFolder[]
): Promise<ImportRun> {
  await importer.scan(folders);
  const run = await untilReview(importer);
  await importer.cancel();
  return run;
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

interface TitleRow {
  title: string;
  year: number | null;
  library_folder_id: string | null;
  source_folder: string | null;
}

/** Every title in one table, with the two columns the scan writes, by title. */
function rows(
  db: SqliteDatabase,
  table: 'movies' | 'series'
): Record<string, TitleRow> {
  const all = db
    .prepare(
      `SELECT title, year, library_folder_id, source_folder FROM ${table}`
    )
    .all() as TitleRow[];
  return Object.fromEntries(all.map((row) => [row.title, row]));
}

/** How many movies, series and episodes the library holds. */
function counts(storage: LibraryStorage): {
  movies: number;
  series: number;
  episodes: number;
} {
  const series = storage.getSeriesHome().series;
  return {
    movies: storage.listMovies({ sort: 'a-z' }).length,
    series: series.length,
    episodes: series.reduce(
      (sum, show) => sum + storage.listEpisodes(show.id).length,
      0
    ),
  };
}

const texts = (run: ImportRun) => run.log.map((line) => line.text);

describe('createImporter.scan — a first scan', () => {
  it('imports each film named off its folder', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    await scanOnce(box.importer, [folders.films, folders.shows]);

    const movies = box.storage.listMovies({ sort: 'a-z' });
    expect(
      movies.map((movie) => ({ title: movie.title, year: movie.year }))
    ).toEqual([
      { title: 'Amelie', year: 2001 },
      { title: 'Die Hard', year: 1988 },
    ]);
  });

  it('imports each show named off its folder, with its episodes', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    await scanOnce(box.importer, [folders.films, folders.shows]);

    const series = box.storage
      .getSeriesHome()
      .series.map((show) => ({
        title: show.title,
        year: show.year,
        episodes: box.storage.listEpisodes(show.id).length,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
    expect(series).toEqual([
      { title: 'Harbor & Vine', year: 2021, episodes: 2 },
      { title: 'Tidewater', year: 2018, episodes: 2 },
    ]);
  });

  it('records each film’s Library folder and its Source folder relative to it', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    await scanOnce(box.importer, [folders.films, folders.shows]);

    const movies = rows(box.db, 'movies');
    expect(movies['Die Hard']).toMatchObject({
      library_folder_id: folders.films.id,
      source_folder: 'Die.Hard.1988.1080p',
    });
    expect(movies['Amelie']).toMatchObject({
      library_folder_id: folders.films.id,
      source_folder: join('Drama', 'Amelie (2001)'),
    });
  });

  it('records each show’s Library folder and its Show folder relative to it', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    await scanOnce(box.importer, [folders.films, folders.shows]);

    const series = rows(box.db, 'series');
    expect(series['Harbor & Vine']).toMatchObject({
      library_folder_id: folders.shows.id,
      source_folder: 'Harbor & Vine (2021)',
    });
    expect(series['Tidewater']).toMatchObject({
      library_folder_id: folders.shows.id,
      source_folder: 'Tidewater (2018)',
    });
  });

  it('opens the log with one Scanning line per folder, in the order added', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    const run = await scanOnce(box.importer, [folders.films, folders.shows]);

    expect(run.log.slice(0, 2)).toEqual([
      { text: `Scanning   ${box.films}`, kind: expect.any(String) },
      { text: `Scanning   ${box.shows}`, kind: expect.any(String) },
    ]);
  });

  it('raises no no-row and no missing-meta', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    const run = await scanOnce(box.importer, [folders.films, folders.shows]);

    const kinds = run.problems.map((problem) => problem.kind);
    expect(kinds).not.toContain('no-row');
    expect(kinds).not.toContain('missing-meta');
  });
});

describe('createImporter.scan — a rescan', () => {
  it('adds nothing on a second scan', async () => {
    const box = sandbox();
    const folders = listBoth(box);
    await scanOnce(box.importer, [folders.films, folders.shows]);
    const before = counts(box.storage);

    const run = await scanOnce(box.importer, [folders.films, folders.shows]);

    expect(counts(box.storage)).toEqual(before);
    expect(run).toMatchObject({ total: 0, done: 0 });
  });

  it('adds nothing even after a title’s name and year are edited', async () => {
    const box = sandbox();
    const folders = listBoth(box);
    await scanOnce(box.importer, [folders.films, folders.shows]);
    box.db
      .prepare(
        "UPDATE movies SET title = 'A Christmas Siege', year = 1990 WHERE title = 'Die Hard'"
      )
      .run();
    box.db
      .prepare(
        "UPDATE series SET title = 'The Ferry', year = 2019 WHERE title = 'Tidewater'"
      )
      .run();
    const before = counts(box.storage);

    const run = await scanOnce(box.importer, [folders.films, folders.shows]);

    expect(counts(box.storage)).toEqual(before);
    expect(run).toMatchObject({ total: 0, done: 0 });
    expect(Object.keys(rows(box.db, 'movies')).sort()).toEqual([
      'A Christmas Siege',
      'Amelie',
    ]);
  });

  it('brings in an episode added to a held show’s folder', async () => {
    const box = sandbox();
    const folders = listBoth(box);
    await scanOnce(box.importer, [folders.films, folders.shows]);
    const tidewater = join(box.shows, 'Tidewater (2018)');
    copyFileSync(
      join(tidewater, 'Tidewater.S01E02.The.Crossing.mp4'),
      join(tidewater, 'Tidewater.S01E03.High.Water.mp4')
    );

    await scanOnce(box.importer, [folders.films, folders.shows]);

    const show = box.storage
      .getSeriesHome()
      .series.find((series) => series.title === 'Tidewater');
    expect(show).toBeDefined();
    const episodes = box.storage.listEpisodes(show?.id ?? '');
    expect(episodes.map((episode) => [episode.season, episode.number])).toEqual(
      [
        [1, 1],
        [1, 2],
        [1, 3],
      ]
    );
    expect(
      box.storage
        .getSeriesHome()
        .series.filter((series) => series.title === 'Tidewater')
    ).toHaveLength(1);
  });
});

describe('createImporter.scan — a title already held by title key and year', () => {
  it('links the held film to its folder and Source folder, and adds it once', async () => {
    const box = sandbox();
    const folders = listBoth(box);
    const held = box.storage.addMovie({
      title: 'Die Hard',
      year: 1988,
      videoPath: 'die-hard-1988/video.mp4',
    });

    await scanOnce(box.importer, [folders.films, folders.shows]);

    const row = box.db
      .prepare(
        'SELECT library_folder_id, source_folder FROM movies WHERE id = ?'
      )
      .get(held.id);
    expect(row).toEqual({
      library_folder_id: folders.films.id,
      source_folder: 'Die.Hard.1988.1080p',
    });
    expect(
      box.storage
        .listMovies({ sort: 'a-z' })
        .filter((movie) => movie.title === 'Die Hard')
    ).toHaveLength(1);
  });
});

describe('createImporter.scan — an unreachable folder', () => {
  it('is skipped with its warning, and the other folder is still scanned', async () => {
    const box = sandbox();
    const gone = box.storage.addLibraryFolder(box.gone);
    const films = box.storage.addLibraryFolder(box.films);

    const run = await scanOnce(box.importer, [gone, films]);

    expect(run.log).toContainEqual({
      text: `⚠ Can't reach ${box.gone} — skipped`,
      kind: 'warning',
    });
    expect(
      box.storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toEqual(['Amelie', 'Die Hard']);
  });

  it('still reaches review when no folder could be reached', async () => {
    const box = sandbox();
    const gone = box.storage.addLibraryFolder(box.gone);

    const run = await scanOnce(box.importer, [gone]);

    expect(run.phase).toBe('review');
    expect(texts(run)).toContain(`⚠ Can't reach ${box.gone} — skipped`);
    expect(counts(box.storage)).toEqual({ movies: 0, series: 0, episodes: 0 });
  });
});

describe('createImporter — the run’s source', () => {
  it('is folders for a scan', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    const started = await box.importer.scan([folders.films, folders.shows]);
    const run = await untilReview(box.importer);
    await box.importer.cancel();

    expect(started.source).toBe('folders');
    expect(run.source).toBe('folders');
  });

  it('is sheet for a sheet import', async () => {
    const box = sandbox();

    const started = await box.importer.start(box.sheet, box.films);
    const run = await untilReview(box.importer);
    await box.importer.cancel();

    expect(started.source).toBe('sheet');
    expect(run.source).toBe('sheet');
  });

  it('carries enrich on a scan as a sheet import does', async () => {
    const box = sandbox();
    const folders = listBoth(box);

    const started = await box.importer.scan([folders.films], true);
    await untilReview(box.importer);
    await box.importer.cancel();

    expect(started.enrich).toBe(true);
  });
});
