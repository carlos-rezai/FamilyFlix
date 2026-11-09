// @vitest-environment node
//
// 59, Rebuild whole, Phase 3 (issue #550): a new title takes every sheet
// field.
//
// A new title imported from a **Folder scan** or _Import from spreadsheet_
// takes every field its **Row type** gives: a film's TMDB id, TMDB rating and
// Runtime; a series' TMDB id, TMDB rating and Favorite; an episode's Status
// and Runtime. Runtime comes from the probe, the sheet's only when the probe
// answers none; only `Watched` marks watched, `In progress` starts at the
// start. A title imported with a TMDB id has the **Details state** `synced`.
//
// The runs are real: the film and series fixtures copied into one sandboxed
// **Library folder**, a real `Media`, the absent Playback component with the
// Library folder's path resolved (so a linked video's header is read where it
// lies), and a sheet typed here. A video emptied to no bytes is one the probe
// answers no runtime for.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
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
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { SERIES_FIXTURE } from '../../test-support/seriesFixture/seriesFixture';
import {
  SHEET_COLUMNS,
  type Episode,
  type ImportRun,
  type Movie,
  type Series,
  type SheetColumn,
} from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** One sheet line, its cells by column, a column left out a blank cell. */
const line = (cells: Partial<Record<SheetColumn, string | number>>): string =>
  SHEET_COLUMNS.map((column) => {
    const cell = String(cells[column] ?? '');
    return /[",]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
  }).join(',');

/** The one sheet: its header, then the lines given. */
const sheetOf = (lines: string[]): string =>
  `${[SHEET_COLUMNS.join(','), ...lines].join('\n')}\n`;

const DIE_HARD = 'Die Hard (1988)';
const AMELIE = 'Amelie (2001)';
const HARBOR = 'Harbor & Vine (2021)';

/**
 * The sheet the tests share: Die Hard matched to TMDB with a Runtime its
 * probed header contradicts, Amélie with a Runtime and no match, and _Harbor
 * & Vine_ hearted and matched, its first episode Watched, its second In
 * progress with a Runtime of its own.
 */
const SHEET = sheetOf([
  line({
    Type: 'Movie',
    Folder: DIE_HARD,
    Title: 'Die Hard',
    Year: 1988,
    Runtime: 999,
    'TMDB rating': 7.8,
    'TMDB id': 562,
    Status: 'Unwatched',
  }),
  line({
    Type: 'Movie',
    Folder: AMELIE,
    Title: 'Amélie',
    Year: 2001,
    Runtime: 120,
    Status: 'Unwatched',
  }),
  line({
    Type: 'Series',
    Folder: HARBOR,
    Title: 'Harbor & Vine',
    Year: 2021,
    'TMDB rating': 8.1,
    'TMDB id': 1399,
    Favorite: 'Yes',
  }),
  line({ Type: 'Season', Folder: HARBOR, Season: 1 }),
  line({
    Type: 'Episode',
    Folder: HARBOR,
    Season: 1,
    Episode: 1,
    Title: 'Pilot',
    Status: 'Watched',
  }),
  line({
    Type: 'Episode',
    Folder: HARBOR,
    Season: 1,
    Episode: 2,
    Title: 'The Night Market',
    Runtime: 47,
    Status: 'In progress',
  }),
]);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The Library folder's path on disk. */
  root: string;
  /** The Library folder, listed. */
  folder: StoredLibraryFolder;
  /** The sandbox itself, for a sheet kept outside the Library folder. */
  dir: string;
}

/**
 * Die Hard, Amélie and _Harbor & Vine_ copied into one Library folder,
 * Amélie's video and _Harbor & Vine_'s second episode's emptied so the probe
 * answers no runtime for them, and a fresh library over it.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-sheet-fields-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Library');
  for (const title of [DIE_HARD, AMELIE]) {
    cpSync(join(LIBRARY_FIXTURE, 'root', title), join(root, title), {
      recursive: true,
    });
  }
  cpSync(join(SERIES_FIXTURE, 'root', HARBOR), join(root, HARBOR), {
    recursive: true,
  });
  writeFileSync(join(root, AMELIE, 'Amelie.mp4'), '');
  writeFileSync(
    join(
      root,
      HARBOR,
      'Season 01',
      'Harbor.and.Vine.S01E02.The.Night.Market.mp4'
    ),
    ''
  );

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(
      media,
      fixedSlot(null),
      (id) =>
        storage.libraryFolders().find((folder) => folder.id === id)?.path ??
        null
    ),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  return {
    storage,
    importer,
    root,
    dir,
    folder: storage.addLibraryFolder(root),
  };
}

/** The snapshot once the run has reached review, or a failure if it never does. */
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

/** A Folder scan of a sandbox whose `Meta/` holds {@link SHEET}. */
async function scannedWithSheet(): Promise<LibraryStorage> {
  const box = sandbox();
  mkdirSync(join(box.root, 'Meta'));
  writeFileSync(join(box.root, 'Meta', 'familyflix-library.csv'), SHEET);
  await box.importer.scan([box.folder], false);
  await untilReview(box.importer);
  return box.storage;
}

/** _Import from spreadsheet_ of {@link SHEET} over a sandbox. */
async function importedFromSheet(): Promise<LibraryStorage> {
  const box = sandbox();
  const sheetPath = join(box.dir, 'library.csv');
  writeFileSync(sheetPath, SHEET);
  await box.importer.start(sheetPath);
  await untilReview(box.importer);
  return box.storage;
}

/** The held movie whose title is `title`, read whole. */
function movieTitled(storage: LibraryStorage, title: string): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === title);
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error(
      `the library holds no ${title}: ${JSON.stringify(
        storage.listMovies({ sort: 'a-z' }).map((each) => each.title)
      )}`
    );
  }
  return movie;
}

/** The held series titled `title`, and its episodes by `SxxEyy`. */
function seriesTitled(
  storage: LibraryStorage,
  title: string
): { series: Series; episodes: Record<string, Episode> } {
  const listed = storage
    .getSeriesHome()
    .series.find((each) => each.title === title);
  const detail =
    listed === undefined ? null : storage.getSeriesDetail(listed.id);
  if (detail === null) {
    throw new Error(`the library holds no series ${title}`);
  }
  const episodes: Record<string, Episode> = {};
  for (const season of detail.seasons) {
    for (const episode of season.episodes) {
      const tag = `S${String(episode.season).padStart(2, '0')}E${String(
        episode.number
      ).padStart(2, '0')}`;
      episodes[tag] = episode;
    }
  }
  return { series: detail.series, episodes };
}

describe.each([
  ['a Folder scan', scannedWithSheet],
  ['Import from spreadsheet', importedFromSheet],
])('createImporter: %s gives a new title every sheet field', (_, run) => {
  it('gives a new film its TMDB id and TMDB rating', async () => {
    const storage = await run();

    expect(movieTitled(storage, 'Die Hard')).toMatchObject({
      tmdbId: 562,
      tmdbScore: 7.8,
    });
  });

  it('gives a new film the sheet’s Runtime only when the probe answers none', async () => {
    const storage = await run();

    expect(movieTitled(storage, 'Amélie').runtimeMinutes).toBe(120);
    // The fixture's header says 132 minutes; the sheet says 999.
    expect(movieTitled(storage, 'Die Hard').runtimeMinutes).toBe(132);
  });

  it('gives a new series its TMDB id, TMDB rating and Favorite', async () => {
    const storage = await run();

    expect(seriesTitled(storage, 'Harbor & Vine').series).toMatchObject({
      tmdbId: 1399,
      tmdbScore: 8.1,
      isFavorite: true,
    });
  });

  it('marks only a Watched episode watched, an In progress one at its start', async () => {
    const storage = await run();

    const { episodes } = seriesTitled(storage, 'Harbor & Vine');
    expect(episodes.S01E01).toMatchObject({ watched: true, status: 'watched' });
    expect(episodes.S01E02).toMatchObject({
      watched: false,
      resumePositionSeconds: 0,
      status: 'unwatched',
    });
  });

  it('gives a new episode the sheet’s Runtime when the probe answers none', async () => {
    const storage = await run();

    expect(
      seriesTitled(storage, 'Harbor & Vine').episodes.S01E02.runtimeMinutes
    ).toBe(47);
  });

  it('answers the Details state synced for a title imported with a TMDB id', async () => {
    const storage = await run();

    const titles = storage.libraryTitles();
    expect(
      titles.movies.find((movie) => movie.title === 'Die Hard')?.details
    ).toBe('synced');
    expect(
      titles.series.find((series) => series.title === 'Harbor & Vine')?.details
    ).toBe('synced');
  });
});
