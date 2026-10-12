// @vitest-environment node
//
// "A folder of several films imports only one" (issue #315).
//
// A **Collection folder** — `Star Wars/` holding one video per film — imports
// every film in it, each named off its own file, in a **Folder scan** and a
// sheet import alike. Each records the folder as its `source_folder`, and is
// **Already in library** by its title key and year alone, so a rescan adds
// nothing and a film added to the folder later still comes in.
//
// A film folder holding the film and its sample is no collection: a Folder
// scan files the `no-video` _Two videos. Pick the film._ Problem a sheet run
// already files, rather than importing the first video it found.
//
// The runs are real: the fixture's ten-second MP4 copied under each name into
// a sandboxed Library folder, a real `Media` over a sandbox managed directory
// and the absent **Playback component**.

import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  /** The Library folder, empty until a test lays out its folders. */
  root: string;
  /** Where a sheet run's sheet goes. */
  sheet: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-collection-folder-');
  const media = join(dir, 'media');
  const root = join(dir, 'library');
  mkdirSync(media);
  mkdirSync(root);

  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return { storage, db, importer, root, sheet: join(dir, 'library.csv') };
}

/** A folder under the Library folder, holding a real video under each name. */
function folderOf(box: Sandbox, name: string, videos: string[]): string {
  const dir = join(box.root, name);
  mkdirSync(dir, { recursive: true });
  for (const video of videos) {
    copyFileSync(FIXTURE_VIDEO, join(dir, video));
  }
  return dir;
}

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

/** One whole Folder scan of the sandbox's Library folder, then let go. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  const listed =
    box.storage.libraryFolders().find((folder) => folder.path === box.root) ??
    box.storage.addLibraryFolder(box.root);
  await box.importer.scan([listed]);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** One whole sheet run over the sandbox's Library folder, then let go. */
async function importSheet(box: Sandbox, csv: string): Promise<ImportRun> {
  writeFileSync(box.sheet, csv);
  await box.importer.start(box.sheet, box.root);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

const titles = (storage: LibraryStorage) =>
  storage
    .listMovies({ sort: 'a-z' })
    .map((movie) => ({ title: movie.title, year: movie.year }));

const STAR_WARS = [
  'Star.Wars.A.New.Hope.1977.mp4',
  'The.Empire.Strikes.Back.1980.mp4',
  'Return.of.the.Jedi.1983.mp4',
];

describe('createImporter.scan — a Collection folder', () => {
  it('imports every film in it, each named off its own file', async () => {
    const box = sandbox();
    folderOf(box, 'Star Wars', STAR_WARS);

    await scanOnce(box);

    expect(titles(box.storage)).toEqual([
      { title: 'Return of the Jedi', year: 1983 },
      { title: 'Star Wars A New Hope', year: 1977 },
      { title: 'The Empire Strikes Back', year: 1980 },
    ]);
  });

  it('records the folder as each film’s Source folder', async () => {
    const box = sandbox();
    folderOf(box, 'Star Wars', STAR_WARS);

    await scanOnce(box);

    const folders = box.db
      .prepare('SELECT source_folder FROM movies')
      .all() as { source_folder: string | null }[];
    expect(folders.map((row) => row.source_folder)).toEqual([
      'Star Wars',
      'Star Wars',
      'Star Wars',
    ]);
  });

  it('adds nothing on a second scan', async () => {
    const box = sandbox();
    folderOf(box, 'Star Wars', STAR_WARS);
    await scanOnce(box);

    const run = await scanOnce(box);

    expect(titles(box.storage)).toHaveLength(3);
    expect(run).toMatchObject({ total: 0, done: 0 });
  });

  it('brings in a film added to the folder after the first scan', async () => {
    const box = sandbox();
    const dir = folderOf(box, 'Star Wars', STAR_WARS);
    await scanOnce(box);
    copyFileSync(FIXTURE_VIDEO, join(dir, 'The.Phantom.Menace.1999.mp4'));

    await scanOnce(box);

    expect(titles(box.storage)).toContainEqual({
      title: 'The Phantom Menace',
      year: 1999,
    });
    expect(titles(box.storage)).toHaveLength(4);
  });
});

describe('createImporter.scan — one film with two videos', () => {
  it('imports nothing and files Two videos. Pick the film.', async () => {
    const box = sandbox();
    folderOf(box, 'Heat (1995)', ['Heat.1995.mp4', 'Heat.1995.sample.mp4']);

    const run = await scanOnce(box);

    expect(titles(box.storage)).toEqual([]);
    expect(
      run.problems.map((problem) => ({
        kind: problem.kind,
        title: problem.title,
        reason: problem.reason,
      }))
    ).toEqual([
      {
        kind: 'no-video',
        title: 'Heat',
        reason: 'Two videos. Pick the film.',
      },
    ]);
  });
});

describe('createImporter.start — a Collection folder', () => {
  it('matches each row to its own file and imports it', async () => {
    const box = sandbox();
    folderOf(box, 'Star Wars', STAR_WARS);

    const run = await importSheet(
      box,
      [
        'Title,Year',
        'Star Wars A New Hope,1977',
        'The Empire Strikes Back,1980',
        'Return of the Jedi,1983',
      ].join('\n')
    );

    expect(titles(box.storage)).toEqual([
      { title: 'Return of the Jedi', year: 1983 },
      { title: 'Star Wars A New Hope', year: 1977 },
      { title: 'The Empire Strikes Back', year: 1980 },
    ]);
    expect(run.problems.map((problem) => problem.kind)).not.toContain(
      'no-video'
    );
  });
});
