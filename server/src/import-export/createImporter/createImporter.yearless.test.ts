// @vitest-environment node
//
// 64, Rescan a folder, Phase 1 (issue #618): a yearless Title folder imported.
//
// A folder in a **Library folder**'s root named the way the household reads
// the title (`Heat`, no year) is a **Title folder**: a **Folder scan**, _Scan
// all folders_ and _Scan new folders_ alike, imports it with its **Folder
// key**'s title and a null year. `Heat` beside `Heat (1986)` is two titles,
// and a second scan finds it **Already in library**, importing nothing twice.
//
// The runs are real, `createImporter.folderLayout.test.ts`' sandbox: Library
// folders built under `sandboxRoot` with the one real video copied in, a real
// `Media` over a sandbox managed directory and the absent **Playback
// component**.

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { foldersToScan } from '../foldersToScan/foldersToScan';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** Where the Library folders are made. */
  dir: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-yearless-scan-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media, unfittedArt()),
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
  return { storage, importer, dir };
}

/** A Library folder `name` holding the videos given, listed. */
function libraryFolder(
  box: Sandbox,
  name: string,
  videos: string[]
): StoredLibraryFolder {
  const root = join(box.dir, name);
  mkdirSync(root);
  for (const video of videos) {
    const path = join(root, video);
    mkdirSync(dirname(path), { recursive: true });
    copyFileSync(FIXTURE_VIDEO, path);
  }
  return box.storage.addLibraryFolder(root);
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

/** One scan of the folders given, left in review, then let go. */
async function scanned(
  box: Sandbox,
  folders: StoredLibraryFolder[]
): Promise<ImportRun> {
  await box.importer.scan(folders, false, 'link');
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** Every held movie's title and year, sorted by title then year. */
const held = (storage: LibraryStorage) =>
  storage
    .listMovies({ sort: 'a-z' })
    .map((movie) => ({ title: movie.title, year: movie.year }))
    .sort(
      (a, b) => a.title.localeCompare(b.title) || (a.year ?? 0) - (b.year ?? 0)
    );

describe('createImporter.scan: a yearless Title folder', () => {
  it('imports Heat/ as Heat with a null year', async () => {
    const box = sandbox();
    const movies = libraryFolder(box, 'Movies', ['Heat/heat.mkv']);

    const run = await scanned(box, [movies]);

    expect(held(box.storage)).toEqual([{ title: 'Heat', year: null }]);
    expect(run.problems).toEqual([]);
    const warnings = run.log
      .filter((line) => line.kind === 'warning')
      .map((l) => l.text);
    expect(warnings.filter((text) => text.includes('Title (Year)'))).toEqual(
      []
    );
    expect(warnings.filter((text) => text.includes('left out'))).toEqual([]);
  });

  it('imports Heat beside Heat (1986) as two titles', async () => {
    const box = sandbox();
    const movies = libraryFolder(box, 'Movies', [
      'Heat/heat.mkv',
      'Heat (1986)/heat.mkv',
    ]);

    await scanned(box, [movies]);

    expect(held(box.storage)).toEqual([
      { title: 'Heat', year: null },
      { title: 'Heat', year: 1986 },
    ]);
  });

  it('imports nothing twice on a second scan', async () => {
    const box = sandbox();
    const movies = libraryFolder(box, 'Movies', [
      'Heat/heat.mkv',
      'Heat (1986)/heat.mkv',
    ]);
    await scanned(box, [movies]);

    await scanned(box, box.storage.libraryFolders());

    expect(held(box.storage)).toEqual([
      { title: 'Heat', year: null },
      { title: 'Heat', year: 1986 },
    ]);
  });
});

describe('createImporter.scan: Scan new folders, a yearless Title folder', () => {
  it('imports Heat/ from a New folder with a null year', async () => {
    const box = sandbox();
    const old = libraryFolder(box, 'Old', ['Die Hard (1988)/die-hard.mkv']);
    await scanned(box, [old]);
    libraryFolder(box, 'New', ['Heat/heat.mkv']);

    await scanned(box, foldersToScan(box.storage.libraryFolders(), 'new'));

    expect(held(box.storage)).toEqual([
      { title: 'Die Hard', year: 1988 },
      { title: 'Heat', year: null },
    ]);
  });
});
