// @vitest-environment node
//
// 58, Folder layout, Phase 2 (issue #535): one film in the layout, over the
// four shapes log 51 Phase 4 (issue #447) once read as Season folders.
//
// The importer's **Folder scan** reads a Library folder by the **Folder
// layout**, whose Season folder is `Season` and its number: a Dutch
// `Seizoen 1`, a `Season 1 (2008)` with its year, a release-named
// `Release.Show.S01.1080p.WEB-DL` and a `Specials` folder are none. Each sits
// alone under its own **Title folder** in one **Library folder**, which holds
// no video or Season folder and is one **Layout warning**: no series, no
// film, no Problem.
//
// Composed as the series suite is: a real `freshStorage`, a real `Media` over
// a sandbox managed directory and the absent **Playback component**. The
// episode videos are copies of the fixture's Die Hard header.

import { cpSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { ImportRun } from '@/types';

/** The four shapes: each Show folder, its Season folder and its videos. */
const SHOWS: readonly (readonly [string, string, readonly string[]])[] = [
  [
    'Seizoen Show (2010)',
    'Seizoen 1',
    ['Seizoen.Show.S01E01.mp4', 'Seizoen.Show.S01E02.mp4'],
  ],
  ['Year Show (2008)', 'Season 1 (2008)', ['Year.Show.S01E01.mp4']],
  [
    'Release Show (2011)',
    'Release.Show.S01.1080p.WEB-DL',
    ['Release.Show.S01E01.1080p.WEB-DL.mp4'],
  ],
  ['Specials Show (2012)', 'Specials', ['Specials.Show.S00E01.Christmas.mp4']],
];

/** The fixture's film header, an `mvhd` saying 132 minutes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die Hard (1988)',
  'Die.Hard.1988.1080p.mp4'
);

/** A Library folder holding the four shows, listed, and the importer over it. */
function sandbox(): {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
} {
  const dir = sandboxRoot('familyflix-import-season-folders-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const root = join(dir, 'root');
  for (const [show, season, videos] of SHOWS) {
    const at = join(root, show, season);
    mkdirSync(at, { recursive: true });
    for (const video of videos) {
      cpSync(HEADER, join(at, video));
    }
  }

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder };
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

describe('createImporter.scan: the four shapes the layout does not read', () => {
  it('makes no series and no film, and files no Problem', async () => {
    const { storage, importer, folder } = sandbox();

    await importer.scan([folder]);
    const run = await untilReview(importer);

    expect(storage.listMovies({ sort: 'a-z' })).toEqual([]);
    expect(storage.getSeriesHome().series).toEqual([]);
    expect(run.problems).toEqual([]);
  });

  it('logs one Layout warning for each Title folder', async () => {
    const { importer, folder } = sandbox();

    await importer.scan([folder]);
    const run = await untilReview(importer);

    expect(
      run.log
        .filter((line) => line.kind === 'warning')
        .map((line) => line.text)
        .sort()
    ).toEqual(
      SHOWS.map(
        ([show]) => `⚠ ${show} holds no video or Season folder, left out`
      ).sort()
    );
  });
});
