// @vitest-environment node
//
// 59, Rebuild whole, Phase 11 (issue #558): the Orphaned-row line.
//
// A **Folder scan** logs one **Warning line** per **Folder key** its **Library
// sheet** holds that no **Title folder** does, a series' Season and Episode
// rows with it: `⚠ Die Hard (1988) is in the sheet but has no folder, left
// out`. An **Orphaned row** is never a **Problem** in review, and the sheet the
// run's close writes no longer holds it.
//
// The run is real: Die Hard and Tidewater copied into a sandboxed Library
// folder, scanned, filled and written to their sheet; then a Factory reset,
// Die Hard's Title folder renamed to `Heat (1995)` and Tidewater's removed, and
// the folder scanned again with a real `Media`, the absent Playback component
// and a real **Library sheet writer** wired to `LibraryStorage.onChange`.

import { cpSync, mkdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { SERIES_FIXTURE } from '../../test-support/seriesFixture/seriesFixture';
import {
  createLibrarySheet,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
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
}

/** Die Hard and Tidewater in a Library folder, the writer wired to the library. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-orphaned-rows-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(root);
  cpSync(
    join(LIBRARY_FIXTURE, 'root', 'Die Hard (1988)'),
    join(root, 'Die Hard (1988)'),
    { recursive: true }
  );
  cpSync(
    join(SERIES_FIXTURE, 'root', 'Tidewater (2018)'),
    join(root, 'Tidewater (2018)'),
    { recursive: true }
  );

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
  return { storage, importer, writer, root };
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

/** One offline Folder scan of the Library folder, answered at review. */
async function scanToReview(box: Sandbox): Promise<ImportRun> {
  const folder = box.storage.addLibraryFolder(box.root);
  await box.importer.scan([folder], false);
  return untilReview(box.importer);
}

/** The run closed and its sheet flushed: what _Done_ leaves. */
async function close(box: Sandbox): Promise<void> {
  await box.importer.cancel();
  await box.writer.flush();
}

/**
 * Both titles scanned and written to the sheet, then a Factory reset, Die
 * Hard's folder renamed to `Heat (1995)` and Tidewater's removed: the sheet
 * now holds two Folder keys no Title folder does, Tidewater's with its Season
 * and Episode rows.
 */
async function orphanBoth(box: Sandbox): Promise<void> {
  await scanToReview(box);
  await close(box);
  const [show] = box.storage.getSeriesHome().series;
  expect(show?.title).toBe('Tidewater');
  box.storage.enrichEpisode(box.storage.listEpisodes(show.id)[0].id, {
    title: 'Low Water',
    airDate: '2018-03-04',
  });
  await box.writer.flush();
  const sheet = readFileSync(
    join(box.root, 'Meta', 'familyflix-library.csv'),
    'utf8'
  );
  expect(sheet).toContain('Die Hard (1988)');
  expect(sheet).toContain('Tidewater (2018)');

  box.storage.reset();
  renameSync(join(box.root, 'Die Hard (1988)'), join(box.root, 'Heat (1995)'));
  rmSync(join(box.root, 'Tidewater (2018)'), { recursive: true, force: true });
}

const orphanLines = (run: ImportRun) =>
  run.log.filter((line) =>
    line.text.includes('is in the sheet but has no folder')
  );

describe('createImporter.scan: the Orphaned-row line', () => {
  it('logs one Warning line per orphaned Folder key, a series one line', async () => {
    const box = sandbox();
    await orphanBoth(box);

    const run = await scanToReview(box);

    expect(orphanLines(run)).toEqual([
      {
        text: '⚠ Die Hard (1988) is in the sheet but has no folder, left out',
        kind: 'warning',
      },
      {
        text: '⚠ Tidewater (2018) is in the sheet but has no folder, left out',
        kind: 'warning',
      },
    ]);
  });

  it('puts no Problem in review for an Orphaned row', async () => {
    const box = sandbox();
    await orphanBoth(box);

    const run = await scanToReview(box);

    expect(orphanLines(run)).toHaveLength(2);
    expect(
      run.problems.filter(
        (problem) =>
          problem.title.includes('Die Hard') ||
          problem.title.includes('Tidewater')
      )
    ).toEqual([]);
  });

  it('writes a sheet on close that holds no Orphaned row', async () => {
    const box = sandbox();
    await orphanBoth(box);

    const run = await scanToReview(box);
    await close(box);

    expect(orphanLines(run)).toHaveLength(2);
    const sheet = readFileSync(
      join(box.root, 'Meta', 'familyflix-library.csv'),
      'utf8'
    );
    expect(sheet).toContain('Heat (1995)');
    expect(sheet).not.toContain('Die Hard (1988)');
    expect(sheet).not.toContain('Tidewater (2018)');
  });
});
