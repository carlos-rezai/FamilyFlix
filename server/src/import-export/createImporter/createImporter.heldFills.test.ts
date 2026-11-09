// @vitest-environment node
//
// 59, Rebuild whole, Phase 4 (issue #551): a held title's empty fields are
// filled.
//
// A **Sheet row** for a title the library already holds fills its TMDB id,
// TMDB rating and Runtime only where it has none; `Favorite` `Yes` hearts a
// title not hearted and `No` never unhearts; an Episode row's `Watched` marks
// a held unwatched episode, as a film's row does. None is drawn as a _Yours |
// Spreadsheet_ difference.
//
// The runs are real, `createImporter.sheetFields.test.ts`' sandbox: the film
// and series fixtures in one **Library folder**, a real `Media`, the absent
// Playback component with the folder's path resolved, Amélie's video emptied
// so the probe answers no runtime for it. A first _Import from spreadsheet_
// brings the titles in from a sheet that names none of these fields; a
// second, from a sheet that names them all, is the one under test.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
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

/** A sheet: its header, then the lines given. */
const sheetOf = (lines: string[]): string =>
  `${[SHEET_COLUMNS.join(','), ...lines].join('\n')}\n`;

const DIE_HARD = 'Die Hard (1988)';
const AMELIE = 'Amelie (2001)';
const HARBOR = 'Harbor & Vine (2021)';

/**
 * The first run's sheet: Die Hard with a TMDB id and rating of its own, the
 * rest naming none of the fields under test, both episodes Unwatched.
 */
const FIRST = sheetOf([
  line({
    Type: 'Movie',
    Folder: DIE_HARD,
    Title: 'Die Hard',
    Year: 1988,
    'TMDB rating': 7.8,
    'TMDB id': 562,
    Status: 'Unwatched',
  }),
  line({
    Type: 'Movie',
    Folder: AMELIE,
    Title: 'Amélie',
    Year: 2001,
    Status: 'Unwatched',
  }),
  line({ Type: 'Series', Folder: HARBOR, Title: 'Harbor & Vine', Year: 2021 }),
  line({ Type: 'Season', Folder: HARBOR, Season: 1 }),
  line({
    Type: 'Episode',
    Folder: HARBOR,
    Season: 1,
    Episode: 1,
    Title: 'Pilot',
    Status: 'Unwatched',
  }),
  line({
    Type: 'Episode',
    Folder: HARBOR,
    Season: 1,
    Episode: 2,
    Title: 'The Night Market',
    Status: 'Unwatched',
  }),
]);

/**
 * The second run's sheet: Die Hard's held TMDB id, rating and probed Runtime
 * contradicted and its heart answered `No`; Amélie and _Harbor & Vine_ given
 * every field they lack, _Harbor & Vine_'s heart `harbor`; the first episode
 * Watched, the second In progress.
 */
const second = (harbor: 'Yes' | 'No'): string =>
  sheetOf([
    line({
      Type: 'Movie',
      Folder: DIE_HARD,
      Title: 'Die Hard',
      Year: 1988,
      Runtime: 999,
      'TMDB rating': 5.5,
      'TMDB id': 999,
      Status: 'Unwatched',
      Favorite: 'No',
    }),
    line({
      Type: 'Movie',
      Folder: AMELIE,
      Title: 'Amélie',
      Year: 2001,
      Runtime: 120,
      'TMDB rating': 7.9,
      'TMDB id': 194,
      Status: 'Unwatched',
      Favorite: 'Yes',
    }),
    line({
      Type: 'Series',
      Folder: HARBOR,
      Title: 'Harbor & Vine',
      Year: 2021,
      'TMDB rating': 8.1,
      'TMDB id': 1399,
      Favorite: harbor,
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
      Status: 'In progress',
    }),
  ]);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  dir: string;
}

/**
 * Die Hard, Amélie and _Harbor & Vine_ in one listed Library folder, Amélie's
 * video emptied so the probe answers no runtime for it, and a fresh library.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-held-fills-');
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
  });
  storage.addLibraryFolder(root);
  return { storage, importer, dir };
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

/** One _Import from spreadsheet_ of `text`, run to review and closed. */
async function importSheet(box: Sandbox, text: string): Promise<ImportRun> {
  const path = join(box.dir, `library-${Date.now()}-${Math.random()}.csv`);
  writeFileSync(path, text);
  await box.importer.start(path);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** The held movie whose title is `title`, read whole. */
function movieTitled(storage: LibraryStorage, title: string): Movie {
  const listed = storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === title);
  const movie = listed === undefined ? null : storage.getMovie(listed.id);
  if (movie === null) {
    throw new Error(`the library holds no ${title}`);
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

/**
 * The first run, Die Hard hearted and `prepare` run on the library, then the
 * second run over `second(harbor)`: the second run's snapshot.
 */
async function rerun(
  box: Sandbox,
  harbor: 'Yes' | 'No',
  prepare: (storage: LibraryStorage) => void = () => undefined
): Promise<ImportRun> {
  await importSheet(box, FIRST);
  box.storage.setFavorite(movieTitled(box.storage, 'Die Hard').id, true);
  prepare(box.storage);
  return importSheet(box, second(harbor));
}

describe('createImporter: a held title’s empty fields are filled from its row', () => {
  it('fills TMDB id, TMDB rating and Runtime only where the held film has none, raising no difference', async () => {
    const box = sandbox();

    const run = await rerun(box, 'Yes');

    expect(movieTitled(box.storage, 'Amélie')).toMatchObject({
      tmdbId: 194,
      tmdbScore: 7.9,
      runtimeMinutes: 120,
    });
    // Die Hard held its own; the fixture's header says 132 minutes.
    expect(movieTitled(box.storage, 'Die Hard')).toMatchObject({
      tmdbId: 562,
      tmdbScore: 7.8,
      runtimeMinutes: 132,
    });
    expect(run.problems).toEqual([]);
  });

  it('fills a held series’ empty TMDB id and TMDB rating', async () => {
    const box = sandbox();

    await rerun(box, 'Yes');

    expect(seriesTitled(box.storage, 'Harbor & Vine').series).toMatchObject({
      tmdbId: 1399,
      tmdbScore: 8.1,
    });
  });

  it('hearts a held film on Favorite Yes, and keeps a hearted one under No', async () => {
    const box = sandbox();

    await rerun(box, 'Yes');

    expect(movieTitled(box.storage, 'Amélie').isFavorite).toBe(true);
    expect(movieTitled(box.storage, 'Die Hard').isFavorite).toBe(true);
  });

  it('hearts a held series on Favorite Yes', async () => {
    const box = sandbox();

    await rerun(box, 'Yes');

    expect(seriesTitled(box.storage, 'Harbor & Vine').series.isFavorite).toBe(
      true
    );
  });

  it('keeps a hearted series hearted under a row saying No, while it fills the rest', async () => {
    const box = sandbox();

    await rerun(box, 'No', (storage) => {
      storage.setSeriesFavorite(
        seriesTitled(storage, 'Harbor & Vine').series.id,
        true
      );
    });

    expect(seriesTitled(box.storage, 'Harbor & Vine').series).toMatchObject({
      isFavorite: true,
      tmdbId: 1399,
    });
  });

  it('marks a held unwatched episode on an Episode row’s Watched, and only on Watched', async () => {
    const box = sandbox();

    await rerun(box, 'Yes');

    const { episodes } = seriesTitled(box.storage, 'Harbor & Vine');
    expect(episodes.S01E01).toMatchObject({ watched: true, status: 'watched' });
    expect(episodes.S01E02).toMatchObject({
      watched: false,
      status: 'unwatched',
    });
  });
});
