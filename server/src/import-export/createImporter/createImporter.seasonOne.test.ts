// @vitest-environment node
//
// 64, Rescan a folder, Phase 2 (issue #619): `Season 1` read.
//
// A **Season folder** is `Season N`, any number of digits, case folded, so a
// **Folder scan** of a yearless `Death Note/` holding `Season 1/` imports the
// series _Death Note_, year `null`, its episodes numbered in season 1.
//
// The runs are real, `createImporter.yearless.test.ts`' sandbox: a Library
// folder built under `sandboxRoot` with the one real video copied in, a real
// `Media` over a sandbox managed directory and the absent **Playback
// component**.

import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
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
  const dir = sandboxRoot('familyflix-season-one-scan-');
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

describe('createImporter.scan: a Season 1 folder', () => {
  it('imports Death Note/Season 1/ as Death Note, null year, in season 1', async () => {
    const box = sandbox();
    const shows = libraryFolder(box, 'Shows', [
      'Death Note/Season 1/Death.Note.S01E01.Rebirth.mkv',
      'Death Note/Season 1/Death.Note.S01E02.Confrontation.mkv',
    ]);

    const run = await scanned(box, [shows]);

    const series = box.storage.getSeriesHome().series;
    expect(series.map(({ title, year }) => ({ title, year }))).toEqual([
      { title: 'Death Note', year: null },
    ]);
    expect(
      box.storage
        .listEpisodes(series[0].id)
        .map(({ season, number }) => [season, number])
    ).toEqual([
      [1, 1],
      [1, 2],
    ]);
    expect(run.problems).toEqual([]);
  });

  it('logs no Layout warning that leaves the show out', async () => {
    const box = sandbox();
    const shows = libraryFolder(box, 'Shows', [
      'Death Note/Season 1/Death.Note.S01E01.Rebirth.mkv',
    ]);

    const run = await scanned(box, [shows]);

    expect(
      run.log
        .filter((line) => line.kind === 'warning')
        .map((line) => line.text)
        .filter((text) => text.includes('left out'))
    ).toEqual([]);
  });
});
