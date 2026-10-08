// @vitest-environment node
//
// 30 — Library folders, Phase 3: "the spreadsheet import joins the list"
// (issue #270).
//
// `createImporter.start(sheet, root)` looks its typed root up against the
// **Library folders** before anything starts, so a collection migrated from
// Excel stays current with a later **Folder scan**:
//
// - the same as a listed folder → the run uses that folder;
// - inside a listed folder → the run uses the containing folder, and each
//   title's `source_folder` is relative to it;
// - neither → the root is added to the list, and the run uses it;
// - containing a listed folder → refused on the `root` field, and nothing
//   starts.
//
// Every title a sheet import adds records its `library_folder_id`. The runs
// are real: the film fixture copied under a sandbox, a real `Media` over a
// sandbox managed directory, the absent **Playback component**, and a raw
// handle on the same database for the two columns no shared type carries.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createImporter,
  ImportStartError,
  type Importer,
} from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  /** The folder the fixture's `root/` was copied under. */
  collection: string;
  /** The fixture's tree — the root a sheet import is typed over. */
  root: string;
  sheet: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-sheet-root-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const collection = join(dir, 'collection');
  mkdirSync(collection);
  const { root, sheet } = libraryFixture(collection, 'library.csv');

  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return { storage, db, importer, collection, root, sheet };
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

/** One whole sheet import, then the run let go, so another may start. */
async function importOnce(box: Sandbox, root = box.root): Promise<ImportRun> {
  await box.importer.start(box.sheet, root);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

interface TitleRow {
  library_folder_id: string | null;
  source_folder: string | null;
}

/** The two columns a sheet import writes, by film title. */
function movieRows(db: SqliteDatabase): Record<string, TitleRow> {
  const all = db
    .prepare('SELECT title, library_folder_id, source_folder FROM movies')
    .all() as (TitleRow & { title: string })[];
  return Object.fromEntries(
    all.map(({ title, ...row }) => [title, row as TitleRow])
  );
}

describe('createImporter.start — a root equal to a listed folder', () => {
  it('adds no folder, and links the titles to that folder', async () => {
    const box = sandbox();
    const listed = box.storage.addLibraryFolder(box.root);

    await importOnce(box);

    expect(box.storage.libraryFolders().map((folder) => folder.id)).toEqual([
      listed.id,
    ]);
    const movies = movieRows(box.db);
    expect(movies['Die Hard']).toMatchObject({
      library_folder_id: listed.id,
      source_folder: 'Die.Hard.1988.1080p',
    });
    expect(movies['Amelie']).toMatchObject({
      library_folder_id: listed.id,
      source_folder: join('Drama', 'Amelie (2001)'),
    });
  });
});

describe('createImporter.start — a root inside a listed folder', () => {
  it('links the titles to the containing folder, with source_folder relative to it', async () => {
    const box = sandbox();
    const listed = box.storage.addLibraryFolder(box.collection);

    await importOnce(box);

    expect(box.storage.libraryFolders().map((folder) => folder.id)).toEqual([
      listed.id,
    ]);
    const movies = movieRows(box.db);
    expect(movies['Die Hard']).toMatchObject({
      library_folder_id: listed.id,
      source_folder: join('root', 'Die.Hard.1988.1080p'),
    });
    expect(movies['Amelie']).toMatchObject({
      library_folder_id: listed.id,
      source_folder: join('root', 'Drama', 'Amelie (2001)'),
    });
  });
});

describe('createImporter.start — an unlisted root', () => {
  it('is added to the list, and its titles are linked to it', async () => {
    const box = sandbox();

    await importOnce(box);

    const folders = box.storage.libraryFolders();
    expect(folders.map((folder) => folder.path)).toEqual([box.root]);
    const [added] = folders;
    expect(added.titleCount).toBe(2);
    const movies = movieRows(box.db);
    expect(movies['Die Hard']).toMatchObject({
      library_folder_id: added.id,
      source_folder: 'Die.Hard.1988.1080p',
    });
    expect(movies['Amelie']).toMatchObject({
      library_folder_id: added.id,
      source_folder: join('Drama', 'Amelie (2001)'),
    });
  });
});

describe('createImporter.start — a root containing a listed folder', () => {
  it('is refused on the root field with the containing sentence', async () => {
    const box = sandbox();
    const drama = join(box.root, 'Drama');
    box.storage.addLibraryFolder(drama);

    const refusal = box.importer.start(box.sheet, box.root);

    await expect(refusal).rejects.toBeInstanceOf(ImportStartError);
    await expect(refusal).rejects.toMatchObject({
      field: 'root',
      message: `That folder holds ${drama}, which is already a library folder. Import from ${drama}, or remove it from your library folders first.`,
    });
  });

  it('starts nothing: no run, no folder added, no title imported', async () => {
    const box = sandbox();
    const drama = join(box.root, 'Drama');
    box.storage.addLibraryFolder(drama);

    await box.importer.start(box.sheet, box.root).catch(() => undefined);

    expect(box.importer.current()).toBeNull();
    expect(box.storage.libraryFolders().map((folder) => folder.path)).toEqual([
      drama,
    ]);
    expect(box.storage.listMovies({ sort: 'a-z' })).toEqual([]);
  });
});

describe('createImporter — a scan after a sheet import', () => {
  it('adds nothing from the same folder', async () => {
    const box = sandbox();
    await importOnce(box);
    const before = box.storage.listMovies({ sort: 'a-z' }).length;
    const folders = box.storage.libraryFolders();
    expect(folders.map((folder) => folder.path)).toEqual([box.root]);

    await box.importer.scan(folders);
    const run = await untilReview(box.importer);
    await box.importer.cancel();

    expect(box.storage.listMovies({ sort: 'a-z' })).toHaveLength(before);
    expect(run).toMatchObject({ total: 0, done: 0 });
  });
});
