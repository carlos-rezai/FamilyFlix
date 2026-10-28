// @vitest-environment node
//
// 54, Scan new folders, Phase 3: "a run marks what it read" (issue #494).
//
// A **Folder scan** and a sheet run each mark the **Library folders** their
// walk read as scanned, at the moment the run sets its phase to review, so a
// run left in review and let go by the next start has already marked them. A
// folder that cannot be reached, a folder whose read fails mid-walk, and a run
// cancelled before review mark nothing: each such folder stays a **New
// folder**, `scannedAt` null.
//
// The runs are real: the film and series fixtures copied into two sandboxed
// Library folders, one sheet naming all four titles, an on-disk library, a
// real `Media` over a sandbox managed directory and the absent **Playback
// component**. The one double is the filesystem's `readdir`, refusing a single
// root so its read fails after the root check passed.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun } from '@/types';

/** The one root whose read fails mid-walk; `null` for none. */
const failing = vi.hoisted(() => ({ root: null as string | null }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const readdir = ((
    path: Parameters<typeof actual.readdir>[0],
    ...rest: unknown[]
  ) =>
    failing.root !== null && String(path) === failing.root
      ? Promise.reject(
          Object.assign(new Error('EACCES: permission denied'), {
            code: 'EACCES',
          })
        )
      : (actual.readdir as (...args: unknown[]) => Promise<unknown>)(
          path,
          ...rest
        )) as typeof actual.readdir;
  return { ...actual, default: { ...actual, readdir }, readdir };
});

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);
afterEach(() => {
  failing.root = null;
});

interface Sandbox {
  storage: LibraryStorage;
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

/** A library on disk, the two fixture folders listed by none, one sheet. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-marks-scanned-');
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
  const sheet = join(dir, 'both.csv');
  const showRows = readFileSync(showSheet, 'utf8').split(/\r?\n/).slice(1);
  writeFileSync(
    sheet,
    `${readFileSync(filmSheet, 'utf8').trimEnd()}\n${showRows.join('\n')}`
  );

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, films, shows, gone: join(dir, 'gone'), sheet };
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

/** Each listed folder's mark, by its path. */
function marks(storage: LibraryStorage): Record<string, string | null> {
  return Object.fromEntries(
    storage.libraryFolders().map((folder) => [folder.path, folder.scannedAt])
  );
}

/** The mark of one folder, read back from the list. */
function markOf(
  storage: LibraryStorage,
  folder: StoredLibraryFolder
): string | null {
  return marks(storage)[folder.path] ?? null;
}

/** An ISO stamp no earlier than the run's start and no later than `now`. */
function expectStampedDuring(
  stamp: string | null,
  run: ImportRun,
  now: string
): void {
  expect(stamp).not.toBeNull();
  expect(new Date(stamp ?? '').toISOString()).toBe(stamp);
  expect((stamp ?? '') >= run.startedAt).toBe(true);
  expect((stamp ?? '') <= now).toBe(true);
}

describe('createImporter: a run marks what it read', () => {
  it('marks every folder a Folder scan read on reaching review, and only those', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);

    await box.importer.scan([films]);
    const run = await untilReview(box.importer);
    const now = new Date().toISOString();

    expectStampedDuring(markOf(box.storage, films), run, now);
    expect(markOf(box.storage, shows)).toBeNull();
  });

  it('has marked them before the run in review is let go by the next start', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);

    await box.importer.scan([films]);
    await untilReview(box.importer);
    const marked = markOf(box.storage, films);
    await box.importer.scan([shows]);
    await untilReview(box.importer);

    expect(marked).not.toBeNull();
    expect(markOf(box.storage, films)).toBe(marked);
    expect(markOf(box.storage, shows)).not.toBeNull();
  });

  it('marks the listed folders a sheet run read on reaching review', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);

    await box.importer.start(box.sheet);
    const run = await untilReview(box.importer);
    const now = new Date().toISOString();

    expectStampedDuring(markOf(box.storage, films), run, now);
    expectStampedDuring(markOf(box.storage, shows), run, now);
  });

  it('leaves an Unreachable folder a Folder scan skipped new, and marks the rest', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const gone = box.storage.addLibraryFolder(box.gone);

    await box.importer.scan(box.storage.libraryFolders());
    await untilReview(box.importer);

    expect(markOf(box.storage, gone)).toBeNull();
    expect(markOf(box.storage, films)).not.toBeNull();
  });

  it('leaves an Unreachable folder a sheet run skipped new, and marks the rest', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);
    const gone = box.storage.addLibraryFolder(box.gone);

    await box.importer.start(box.sheet);
    await untilReview(box.importer);

    expect(markOf(box.storage, gone)).toBeNull();
    expect(markOf(box.storage, films)).not.toBeNull();
    expect(markOf(box.storage, shows)).not.toBeNull();
  });

  it('leaves a folder whose read fails mid-walk new, and marks the rest', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);
    failing.root = box.shows;

    await box.importer.scan(box.storage.libraryFolders());
    await untilReview(box.importer);

    // The shows' read did fail: none of its titles came in, the films' did.
    expect(box.storage.getSeriesHome().series).toEqual([]);
    expect(box.storage.listMovies({ sort: 'a-z' }).length).toBeGreaterThan(0);
    expect(markOf(box.storage, shows)).toBeNull();
    expect(markOf(box.storage, films)).not.toBeNull();
  });

  it('marks no folder for a run cancelled before review, and the next run marks its own', async () => {
    const box = sandbox();
    const films = box.storage.addLibraryFolder(box.films);
    const shows = box.storage.addLibraryFolder(box.shows);

    await box.importer.scan([films]);
    await box.importer.cancel();
    expect(marks(box.storage)).toEqual({
      [films.path]: null,
      [shows.path]: null,
    });

    await box.importer.scan([shows]);
    await untilReview(box.importer);

    expect(markOf(box.storage, films)).toBeNull();
    expect(markOf(box.storage, shows)).not.toBeNull();
  });

  it('leaves no reachable folder new after a scan over every folder', async () => {
    const box = sandbox();
    box.storage.addLibraryFolder(box.films);
    box.storage.addLibraryFolder(box.shows);
    box.storage.addLibraryFolder(box.gone);

    await box.importer.scan(box.storage.libraryFolders());
    await untilReview(box.importer);

    expect(marks(box.storage)).toEqual({
      [box.films]: expect.any(String),
      [box.shows]: expect.any(String),
      [box.gone]: null,
    });
  });
});
