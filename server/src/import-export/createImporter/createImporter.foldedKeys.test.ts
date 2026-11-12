// @vitest-environment node
//
// 61, Export round trip, Phase 5 (issue #586): Folder keys fold NFC, then
// lower case.
//
// A folder copied from a Mac names `Amélie (2001)` decomposed (NFD); a row
// Excel saved spells it composed (NFC). A **Folder scan** matches the two as
// one **Folder key**, so the row's fields reach the title, and the **Library
// sheet** it then writes keeps the disk's own bytes in the Folder cell, one
// row for the title.
//
// The runs are real: a Library folder built under `sandboxRoot` (the one real
// video copied in), a real `Media` over a sandbox managed directory, the
// absent **Playback component**, and a real **Library sheet writer** wired to
// the library's changes.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createSqliteStorage, type StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { FIXTURE_VIDEO } from '../../test-support/fixtureVideo/fixtureVideo';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  createLibrarySheet,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
import { readSheet } from '../readSheet/readSheet';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** `Amélie (2001)` composed (NFC), as Excel saves it. */
const AMELIE_NFC = 'Am\u00e9lie (2001)';
/** `Amélie (2001)` decomposed (NFD), as a folder copied from a Mac names it. */
const AMELIE_NFD = 'Ame\u0301lie (2001)';

interface Sandbox {
  importer: Importer;
  writer: LibrarySheet;
  root: string;
  folder: StoredLibraryFolder;
}

/**
 * A library on disk and one Library folder holding an NFD `Amélie (2001)`
 * Title folder with the real video, and a Meta sheet naming it in NFC with a
 * Rating of 9; the Library sheet writer wired to the library's changes.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-folded-keys-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(join(root, AMELIE_NFD), { recursive: true });
  copyFileSync(FIXTURE_VIDEO, join(root, AMELIE_NFD, 'Amelie.mp4'));
  mkdirSync(join(root, 'Meta'));
  writeFileSync(
    join(root, 'Meta', 'familyflix-library.csv'),
    [
      'Type,Folder,Title,Year,Rating',
      `Movie,${AMELIE_NFC},Amelie,2001,9`,
      '',
    ].join('\n'),
    'utf8'
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
  return { importer, writer, root, folder: storage.addLibraryFolder(root) };
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

describe('createImporter.scan: an NFD folder and an NFC row', () => {
  it('writes one Library sheet row, its Folder cell the disk’s own bytes', async () => {
    const box = sandbox();

    await box.importer.scan([box.folder], false);
    await untilReview(box.importer);
    await box.importer.cancel();
    await box.writer.flush();

    const rows = await readSheet(
      readFileSync(join(box.root, 'Meta', 'familyflix-library.csv')),
      'familyflix-library.csv'
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].folder).toBe(AMELIE_NFD);
    expect(rows[0].rating).toBe(9);
  });
});
