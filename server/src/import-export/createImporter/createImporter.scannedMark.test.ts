// @vitest-environment node
//
// Release review (issue #424): "scan only new folders, sync only what the
// run imported".
//
// The **Scanned mark**: `library_folders.scanned_at`, an ISO string, read back
// as `StoredLibraryFolder.scannedAt` (`null` while unset). A **Folder scan**
// sets it on each reachable folder it read, and only when the run finishes
// (reaches review); a cancelled or failed run leaves it unset, so the folder
// still counts as new.
//
// The run's imported titles: `ImportRun.imported`, the **Run scope**'s
// source, lists exactly the titles the run added, by `{ kind, id }`. A held
// title the run only re-linked is not one of them. A sheet run's is filled
// the same way.
//
// The runs are real: the film and series fixtures copied into sandboxed
// Library folders, a real `Media` over a sandbox managed directory, and the
// absent **Playback component**.

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { heldCopy } from '../../test-support/heldCopy/heldCopy';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun, TitleReference } from '@/types';

afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  films: string;
  shows: string;
  gone: string;
  sheet: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

function sandbox({
  media: mediaSeam = (real) => real,
  storage: storageSeam = (real) => real,
}: {
  media?: (real: Media) => Media;
  storage?: (real: LibraryStorage) => LibraryStorage;
} = {}): Sandbox {
  const dir = sandboxRoot('familyflix-scanned-mark-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  mkdirSync(join(dir, 'shows'));
  const { root: films, sheet } = libraryFixture(
    join(dir, 'films'),
    'library.csv'
  );
  const { root: shows } = seriesFixture(join(dir, 'shows'), 'library.csv');
  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage: storageSeam(storage),
    media: mediaSeam(createMedia(media)),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, films, shows, gone: join(dir, 'gone'), sheet };
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

async function scanOnce(
  importer: Importer,
  folders: StoredLibraryFolder[]
): Promise<ImportRun> {
  await importer.scan(folders, false, 'link');
  const run = await untilReview(importer);
  await importer.cancel();
  return run;
}

/** The folder as the library now holds it. */
function stored(box: Sandbox, id: string): StoredLibraryFolder {
  const folder = box.storage
    .libraryFolders()
    .find((candidate) => candidate.id === id);
  if (folder === undefined) throw new Error(`no folder ${id}`);
  return folder;
}

/** Every title the library holds, films then series, as references. */
function everyTitle(storage: LibraryStorage): TitleReference[] {
  return [
    ...storage
      .listMovies({ sort: 'a-z' })
      .map((movie): TitleReference => ({ kind: 'movie', id: movie.id })),
    ...storage.getSeriesHome().series.map(
      (series): TitleReference => ({
        kind: 'series',
        id: series.id,
      })
    ),
  ];
}

const byId = (refs: TitleReference[]) =>
  [...refs].sort((a, b) => a.id.localeCompare(b.id));

describe('createImporter.scan — the Scanned mark', () => {
  it('starts unset on a folder just listed', () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);

    expect(stored(box, films.id).scannedAt).toBeNull();
  });

  it('marks each folder a finished scan read, with an ISO stamp', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);

    await scanOnce(box.importer, [films, shows]);

    expect(stored(box, films.id).scannedAt).toMatch(ISO);
    expect(stored(box, shows.id).scannedAt).toMatch(ISO);
  });

  it('leaves a folder the scan was not given unmarked', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);

    await scanOnce(box.importer, [films]);

    expect(stored(box, films.id).scannedAt).toMatch(ISO);
    expect(stored(box, shows.id).scannedAt).toBeNull();
  });

  it('leaves an unreachable folder unmarked', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const gone = box.storage.addLibraryFolder(box.gone);

    await scanOnce(box.importer, [films, gone]);

    expect(stored(box, films.id).scannedAt).toMatch(ISO);
    expect(stored(box, gone.id).scannedAt).toBeNull();
  });

  it('leaves its folders unmarked when the scan is cancelled', async () => {
    const hold = heldCopy('Amelie.mp4');
    const box = sandbox({ media: hold.seam });
    const films = box.storage.addLibraryFolder(box.films);
    // Copy, so the run holds on the video's copy-in.
    await box.importer.scan([films], false, 'copy');
    await hold.reached;

    const cancelled = box.importer.cancel();
    hold.release();
    await cancelled;

    expect(stored(box, films.id).scannedAt).toBeNull();
  });

  it('leaves its folders unmarked when the scan fails', async () => {
    let failing = true;
    const box = sandbox({
      storage: (real) => ({
        ...real,
        listMovies: (...args: Parameters<LibraryStorage['listMovies']>) => {
          if (failing) throw new Error('the disk went away');
          return real.listMovies(...args);
        },
      }),
    });
    const films = box.storage.addLibraryFolder(box.films);

    // The run's first read of the library throws: it never finishes.
    await box.importer.scan([films], false, 'link');
    await box.importer.cancel().catch(() => undefined);
    failing = false;

    expect(stored(box, films.id).scannedAt).toBeNull();
  });
});

describe('ImportRun.imported — the titles a run imported', () => {
  it('lists every title a first scan imported, films and series', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);

    const run = await scanOnce(box.importer, [films, shows]);

    expect(everyTitle(box.storage)).toHaveLength(4);
    expect(byId(run.imported)).toEqual(byId(everyTitle(box.storage)));
  });

  it('starts empty on the run’s first snapshot', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);

    const first = await box.importer.scan([films], false, 'link');
    await untilReview(box.importer);
    await box.importer.cancel();

    expect(first.imported).toEqual([]);
  });

  it('leaves out a held title the run found again', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    await scanOnce(box.importer, [films]);
    const shows = box.storage.addLibraryFolder(box.shows);
    const held = new Set(everyTitle(box.storage).map((ref) => ref.id));

    const run = await scanOnce(box.importer, [films, shows]);

    expect(run.imported.some((ref) => held.has(ref.id))).toBe(false);
    expect(run.imported.map((ref) => ref.kind)).toEqual(['series', 'series']);
  });

  it('lists a sheet run’s imported titles the same way', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.films);

    await box.importer.start(box.sheet, true, 'link');
    const run = await untilReview(box.importer);
    await box.importer.cancel();

    expect(everyTitle(box.storage).length).toBeGreaterThan(0);
    expect(byId(run.imported)).toEqual(byId(everyTitle(box.storage)));
  });
});
