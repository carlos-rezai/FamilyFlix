// @vitest-environment node
//
// 64, Rescan a folder, Phase 4 (issue #621): the Layout fill writes into the
// household's Season folder.
//
// A show whose season lies in `Season 1/` has its season-scoped files filled
// into `Season 1/`, never a new `Season 01/` beside it, so a scan, its
// **Layout fill**, then a second scan raise no **Doubled place** warning for
// the season.
//
// Composed as `createImporter.layoutFill.test.ts` is: the series fixture
// copied into a sandboxed **Library folder**, Tidewater's `Season 01/`
// renamed `Season 1/` and its poster moved to a Season poster cell of its
// sheet in `Meta/`; a real `freshStorage`, a real `Media`, the absent
// **Playback component**, an idle **Library sheet writer** and the real
// `createLayoutFill`.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createLayoutFill } from '../createLayoutFill/createLayoutFill';
import type { StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { SERIES_FIXTURE } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun } from '@/types';

const TIDEWATER = 'Tidewater (2018)';

/** The fixture sheet's header: every Sheet column. */
const HEADER = readFileSync(join(LIBRARY_FIXTURE, 'library.csv'), 'utf8')
  .split(/\r?\n/)[0]
  .trim();

/** The Season poster cell Tidewater's sheet names. */
const COVER = `${TIDEWATER}/Season 1/cover.jpg`;

/** A sheet of Tidewater's rows, its Season 1 poster cell {@link COVER}. */
const SHEET = [
  HEADER,
  `Series,${TIDEWATER},,,Tidewater,2018,,,,"Drama, Family",Ines Duarte,"Rui Matos, Clara Bento",A ferry crew keeps an island connected through one hard winter.,7,,,,,,,,,`,
  `Season,${TIDEWATER},1,,,,,,,,,,,,,,,,,,${COVER},,`,
  `Episode,${TIDEWATER},1,1,Low Water,,2018-10-02,,,,,,,,,,Unwatched,,,,,,`,
  `Episode,${TIDEWATER},1,2,The Crossing,,2018-10-09,,,,,,,,,,Unwatched,,,,,,`,
  '',
].join('\n');

interface Sandbox {
  importer: Importer;
  folder: StoredLibraryFolder;
  /** Tidewater's Title folder on disk. */
  show: string;
}

/** The series fixture with Tidewater in `Season 1/`, its poster only a cell. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-season-one-fill-');
  const mediaDir = join(dir, 'media');
  mkdirSync(mediaDir);
  const root = join(dir, 'Shows');
  cpSync(join(SERIES_FIXTURE, 'root'), root, { recursive: true });
  const show = join(root, TIDEWATER);
  renameSync(join(show, 'Season 01'), join(show, 'Season 1'));
  renameSync(
    join(show, 'Season 1', 'Images', 'poster.jpg'),
    join(root, ...COVER.split('/'))
  );
  mkdirSync(join(root, 'Meta'));
  writeFileSync(join(root, 'Meta', 'familyflix-library.csv'), SHEET);

  const storage = freshStorage();
  const media = createMedia(mediaDir, unfittedArt());
  const importer = createImporter({
    storage,
    media,
    playback: createPlayback(mediaDir, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: createLayoutFill({ storage, media }),
  });
  const folder = storage.addLibraryFolder(root);
  return { importer, folder, show };
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

/** One whole Folder scan of the sandbox's Library folder, copying. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, 'copy');
  return untilReview(box.importer);
}

describe('createImporter.scan: a Season 1 show filled and scanned again', () => {
  it('fills the Season poster into Season 1/Images, making no Season 01', async () => {
    const box = sandbox();

    await scanOnce(box);

    expect(existsSync(join(box.show, 'Season 1', 'Images', 'poster.jpg'))).toBe(
      true
    );
    expect(existsSync(join(box.show, 'Season 01'))).toBe(false);
  });

  // A `Season 01/` beside `Season 1/` is a doubled season: read once, and
  // the one read first by name holds no video, so the show is left out.
  it('raises no doubled-season warning, nor any about the show, on the second scan', async () => {
    const box = sandbox();
    await scanOnce(box);

    const second = await scanOnce(box);

    expect(
      second.log
        .filter((line) => line.kind === 'warning')
        .map((line) => line.text)
        .filter(
          (text) =>
            /holds \d+ Season \d+ folders/.test(text) ||
            text.includes(TIDEWATER)
        )
    ).toEqual([]);
  });
});
