// @vitest-environment node
//
// 60, Rebuild edges, Phase 6 (issue #569): a sheet that doesn't read is left
// alone.
//
// A **Folder scan** whose **Library folder**'s `Meta/` sheet the **Sheet
// reader** refuses scans the folder by its layout alone and says the sheet is
// kept: one Warning line, `⚠ Could not read <path>, scanned without it and
// left as it is`, and never a **Problem** (log 60, Q7).
//
// The run is real: the importer's fixture library copied into a sandboxed
// Library folder, a real `Media`, the absent Playback component, and a real
// **Library sheet writer** wired to `LibraryStorage.onChange`.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter } from './createImporter';
import { createSqliteStorage } from '../../library';
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
import { createLibrarySheet } from '../createLibrarySheet/createLibrarySheet';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** A sheet the Sheet reader refuses: its header holds no title column. */
const CORRUPT = Buffer.concat([
  Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00]),
  Buffer.from('\u0000\u0001garbled;bytes\r\n\u0002\u0003', 'latin1'),
]);

/** The fixture library in a Library folder, the corrupt sheet in its `Meta/`. */
function sandbox() {
  const dir = sandboxRoot('familyflix-unread-sheet-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  cpSync(join(LIBRARY_FIXTURE, 'root'), root, { recursive: true });
  mkdirSync(join(root, 'Meta'));
  const sheetPath = join(root, 'Meta', 'familyflix-library.csv');
  writeFileSync(sheetPath, CORRUPT);

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
  return { importer, sheetPath, folder: storage.addLibraryFolder(root) };
}

/** The snapshot once the run has reached review, or a failure if it never does. */
async function untilReview(
  current: () => ImportRun | null
): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('createImporter.scan: a Meta sheet that does not read', () => {
  it('logs the `left as it is` line and raises no Problem', async () => {
    const { importer, sheetPath, folder } = sandbox();

    await importer.scan([folder], false);
    const run = await untilReview(() => importer.current());

    expect(
      run.log.filter(
        (entry) =>
          entry.kind === 'warning' && entry.text.includes('Could not read')
      )
    ).toEqual([
      expect.objectContaining({
        text: `⚠ Could not read ${sheetPath}, scanned without it and left as it is`,
      }),
    ]);
    expect(run.problems).toEqual([]);
  });
});
