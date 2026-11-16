// @vitest-environment node
//
// 66, Missing videos, Phase 4 (issue #638): Off-layout folders.
//
// Each root folder of a walked **Library folder** that the **Folder layout**
// turns away, an **Off-layout folder**, is one hard `off-layout` **Problem**
// in the run's review, beside its unchanged **Layout warning**:
//
// - titled by the folder's name, reason _Holds no video or Season folder._
//   (`empty`) or _Holds loose videos and Season folders._ (`mixed`);
// - counted in the completion line, and listed again by every scan until it
//   is fixed on disk, a _Skip_ settling it for that run alone;
// - a fixed folder (a video put in, loose videos sorted) is imported by the
//   next scan like any new folder;
// - the root's loose videos and a **Doubled place** stay warnings only.
//
// The runs are real: the fixture copied into a sandboxed Library folder, an
// on-disk library, a real `Media` over a sandbox managed directory, and the
// absent **Playback component**.

import { copyFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
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
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { ImportProblem, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const EMPTY_REASON = 'Holds no video or Season folder.';
const MIXED_REASON = 'Holds loose videos and Season folders.';

const HARBOR = 'Harbor (2021)';
const HARBOR_PILOT = 'Harbor.S01E01.Pilot.mp4';
const HARBOR_SECOND = 'Harbor.S01E02.The.Night.Market.mp4';

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The fixture's Library folder: `Die Hard (1988)/`, `Amelie (2001)/`. */
  films: StoredLibraryFolder;
}

/** The fixture in a listed films folder, over an on-disk library. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-off-layout-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  const { root } = libraryFixture(join(dir, 'films'), 'library.csv');
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
  return { storage, importer, films: storage.addLibraryFolder(root) };
}

/** A path in the films folder. */
const at = (box: Sandbox, ...parts: string[]): string =>
  join(box.films.path, ...parts);

/** Copy the fixture's real video to a relative path in the films folder. */
function putVideo(box: Sandbox, relative: string): void {
  const path = at(box, relative);
  mkdirSync(dirname(path), { recursive: true });
  copyFileSync(at(box, 'Amelie (2001)', 'Amelie.mp4'), path);
}

/** An empty `Heat/` in the films folder. */
const makeEmptyHeat = (box: Sandbox) => mkdirSync(at(box, 'Heat'));

/** A `Harbor (2021)/` holding a Season folder and one loose episode. */
function makeMixedHarbor(box: Sandbox): void {
  putVideo(box, join(HARBOR, 'Season 01', HARBOR_PILOT));
  putVideo(box, join(HARBOR, HARBOR_SECOND));
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

/** One Link scan of the films folder, to review; the run is left there. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.films], false, 'link');
  return untilReview(box.importer);
}

/** The run's `off-layout` Problems, in its order. */
const offLayoutOf = (run: ImportRun): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === 'off-layout');

const filmTitles = (storage: LibraryStorage): string[] =>
  storage
    .listMovies({ sort: 'a-z' })
    .map((movie) => movie.title)
    .sort();

const showTitles = (storage: LibraryStorage): string[] =>
  storage
    .getSeriesHome()
    .series.map((series) => series.title)
    .sort();

const warningLines = (run: ImportRun): string[] =>
  run.log.filter((line) => line.kind === 'warning').map((line) => line.text);

describe('createImporter: an Off-layout folder is a Problem', () => {
  it('files one off-layout Problem for an empty folder, titled by its name, its warning line kept', async () => {
    const box = sandbox();
    makeEmptyHeat(box);

    const run = await scanOnce(box);

    expect(offLayoutOf(run)).toEqual([
      {
        id: expect.any(String),
        kind: 'off-layout',
        title: 'Heat',
        reason: EMPTY_REASON,
      },
    ]);
    expect(warningLines(run)).toContain(
      '⚠ Heat holds no video or Season folder, left out'
    );
  });

  it('files one off-layout Problem for a mixed folder, titled by its name, its warning line kept', async () => {
    const box = sandbox();
    makeMixedHarbor(box);

    const run = await scanOnce(box);

    expect(offLayoutOf(run)).toEqual([
      {
        id: expect.any(String),
        kind: 'off-layout',
        title: HARBOR,
        reason: MIXED_REASON,
      },
    ]);
    expect(warningLines(run)).toContain(
      `⚠ ${HARBOR} holds loose videos and Season folders, left out`
    );
  });

  it('files one Problem per Off-layout folder, imports the rest, and counts them in the completion line', async () => {
    const box = sandbox();
    makeEmptyHeat(box);
    makeMixedHarbor(box);

    const run = await scanOnce(box);

    expect(
      offLayoutOf(run)
        .map((problem) => [problem.title, problem.reason])
        .sort(([a], [b]) => a.localeCompare(b))
    ).toEqual([
      [HARBOR, MIXED_REASON],
      ['Heat', EMPTY_REASON],
    ]);
    expect(filmTitles(box.storage)).toEqual(['Amelie', 'Die Hard']);
    expect(run.problems).toHaveLength(2);
    const last = run.log.filter((line) => line.kind === 'success').at(-1);
    expect(last?.text).toBe('✓ Scan complete: 2 imported, 2 need attention.');
  });

  it('lists it again on every scan, a Skip settling it for that run alone', async () => {
    const box = sandbox();
    makeEmptyHeat(box);
    const first = await scanOnce(box);
    const [heat] = offLayoutOf(first);
    expect(heat?.title).toBe('Heat');

    expect(box.importer.dismiss(heat?.id ?? '')).toBe(true);
    expect(offLayoutOf(box.importer.current() as ImportRun)).toEqual([]);

    const next = await scanOnce(box);

    expect(offLayoutOf(next).map((problem) => problem.title)).toEqual(['Heat']);
  });
});

describe('createImporter: a fixed Off-layout folder', () => {
  it('imports an empty folder once a video is put in, and lists it no more', async () => {
    const box = sandbox();
    makeEmptyHeat(box);
    const first = await scanOnce(box);
    expect(offLayoutOf(first).map((problem) => problem.title)).toEqual([
      'Heat',
    ]);
    expect(filmTitles(box.storage)).toEqual(['Amelie', 'Die Hard']);

    putVideo(box, join('Heat', 'Heat.mp4'));
    const next = await scanOnce(box);

    expect(offLayoutOf(next)).toEqual([]);
    expect(filmTitles(box.storage)).toEqual(['Amelie', 'Die Hard', 'Heat']);
  });

  it('imports a mixed folder once its loose videos are sorted, and lists it no more', async () => {
    const box = sandbox();
    makeMixedHarbor(box);
    const first = await scanOnce(box);
    expect(offLayoutOf(first).map((problem) => problem.title)).toEqual([
      HARBOR,
    ]);
    expect(showTitles(box.storage)).toEqual([]);

    renameSync(
      at(box, HARBOR, HARBOR_SECOND),
      at(box, HARBOR, 'Season 01', HARBOR_SECOND)
    );
    const next = await scanOnce(box);

    expect(offLayoutOf(next)).toEqual([]);
    expect(showTitles(box.storage)).toEqual(['Harbor']);
  });
});

describe('createImporter: warnings that stay warnings', () => {
  it('files no Problem for the root’s loose videos, a warning line only', async () => {
    const box = sandbox();
    makeEmptyHeat(box);
    putVideo(box, 'Loose.Film.mp4');

    const run = await scanOnce(box);

    expect(run.problems.map((problem) => problem.kind)).toEqual(['off-layout']);
    expect(warningLines(run)).toContain(
      `⚠ 1 video lies loose at the top of ${box.films.path}, left out`
    );
  });

  it('files no Problem for a Doubled place, a warning line only', async () => {
    const box = sandbox();
    makeEmptyHeat(box);
    copyFileSync(
      at(box, 'Die Hard (1988)', 'Images', 'poster.jpg'),
      at(box, 'Die Hard (1988)', 'Images', 'poster.png')
    );

    const run = await scanOnce(box);

    expect(run.problems.map((problem) => problem.kind)).toEqual(['off-layout']);
    expect(
      warningLines(run).filter((line) =>
        line.startsWith('⚠ Die Hard (1988) holds 2 posters')
      )
    ).toHaveLength(1);
  });
});
