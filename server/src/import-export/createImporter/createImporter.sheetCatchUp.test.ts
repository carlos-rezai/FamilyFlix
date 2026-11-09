// @vitest-environment node
//
// 59, Rebuild whole, Phase 12 (issue #559): the sheet catches up, and a New
// folder's sheet is safe.
//
// A run that reaches review touches every **Library folder** its walk read,
// not only those whose sheet it held, so a sheet a hard kill left behind (or
// lost) catches up at the next scan. A **New folder**'s sheet is not written
// while the run is in review; the run that marks it scanned writes it on
// close. An **Unreachable** folder is skipped, and caught up by the scan that
// finds it reachable.
//
// The runs are real: the importer's fixture library copied into a sandboxed
// Library folder with no `Meta/`, an on-disk library, a real `Media`, the
// absent Playback component, and a real **Library sheet writer** wired to
// `LibraryStorage.onChange` as the server wires it.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
} from 'node:fs';
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
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  createLibrarySheet,
  LIBRARY_SHEET,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
import { readSheet } from '../readSheet/readSheet';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  writer: LibrarySheet;
  /** The Library folder's path on disk. */
  root: string;
  /** The Library folder, listed: a **New folder**. */
  folder: StoredLibraryFolder;
}

/** The fixture library in a Library folder with no `Meta/`, a fresh library. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-sheet-catch-up-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: writer,
    layoutFill: idleLayoutFill(),
  });
  return {
    storage,
    importer,
    writer,
    root,
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

/** One whole offline scan of the folder, left in review. */
async function scanned(box: Sandbox): Promise<ImportRun> {
  const folder = box.storage
    .libraryFolders()
    .find((listed) => listed.id === box.folder.id);
  if (folder === undefined) {
    throw new Error('the Library folder is no longer listed');
  }
  await box.importer.scan([folder], false);
  return untilReview(box.importer);
}

/** One whole scan, closed, and the writer flushed. */
async function scannedAndClosed(box: Sandbox): Promise<void> {
  await scanned(box);
  await box.importer.cancel();
  await box.writer.flush();
}

const sheetPath = (box: Sandbox): string => join(box.root, LIBRARY_SHEET);

/** The Movie rows' titles of the folder's sheet, sorted. */
async function filmsInSheet(box: Sandbox): Promise<string[]> {
  const rows = await readSheet(
    readFileSync(sheetPath(box)),
    'familyflix-library.csv'
  );
  return rows
    .filter((row) => row.type === 'Movie')
    .map((row) => row.title)
    .sort();
}

describe('createImporter.scan: a run reaching review touches every folder its walk read', () => {
  it('writes the sheet of a folder whose sheet it did not read and where it added nothing', async () => {
    const box = sandbox();
    await scannedAndClosed(box);
    // A hard kill lost the sheet: the library holds every title already.
    rmSync(join(box.root, 'Meta'), { recursive: true, force: true });

    await scannedAndClosed(box);

    expect(await filmsInSheet(box)).toEqual(['Amelie', 'Die Hard']);
  });
});

describe('createImporter.scan: a New folder', () => {
  it('has no sheet written while the run that walks it is in review', async () => {
    const box = sandbox();

    await scanned(box);
    await box.writer.flush();

    expect(existsSync(sheetPath(box))).toBe(false);
  });

  it('has its sheet written whole when the run that marked it scanned closes', async () => {
    const box = sandbox();

    await scannedAndClosed(box);

    expect(await filmsInSheet(box)).toEqual(['Amelie', 'Die Hard']);
  });
});

describe('createImporter.scan: an Unreachable folder', () => {
  it('is skipped while unreachable and caught up by the scan that finds it', async () => {
    const box = sandbox();
    await scannedAndClosed(box);
    rmSync(join(box.root, 'Meta'), { recursive: true, force: true });
    const away = `${box.root} (unplugged)`;
    renameSync(box.root, away);

    await scannedAndClosed(box);
    expect(existsSync(box.root)).toBe(false);

    renameSync(away, box.root);
    await scannedAndClosed(box);

    expect(await filmsInSheet(box)).toEqual(['Amelie', 'Die Hard']);
  });
});
