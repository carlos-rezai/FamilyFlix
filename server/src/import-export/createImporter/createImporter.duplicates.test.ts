// @vitest-environment node
//
// 60, Rebuild edges, Phase 8 (issue #571): two rows for one title, the first
// read.
//
// _Import from spreadsheet_ and the **Folder scan**'s Meta sheet read both
// log each `duplicate` skip as one **Warning line**, by `skipLine`:
// `⚠ Heat (1995) is in the sheet twice, the first row read`, once per
// repeated row.
//
// Composed as the unread-cells suite is: a sandboxed Library folder holding
// `Heat (1995)/heat.mkv` with the sheet in its `Meta/`, a real
// `freshStorage`, a real `Media` over a sandbox Managed media directory, the
// absent **Playback component**, an idle **Library sheet writer** and the
// real **Layout fill**.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createLayoutFill } from '../createLayoutFill/createLayoutFill';
import type { StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

const HEAT = 'Heat (1995)';

const HEADER = 'Type,Folder,Title,Year';

/** Heat's row, as the sheet repeats it. */
const HEAT_ROW = `Movie,${HEAT},Heat,1995`;

const DUPLICATE_LINE = `⚠ ${HEAT} is in the sheet twice, the first row read`;

interface Sandbox {
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The sheet in the Library folder's `Meta/`. */
  sheet: string;
}

/** A Library folder holding Heat's Title folder and `lines` as its Meta sheet. */
function sandbox(lines: string[]): Sandbox {
  const dir = sandboxRoot('familyflix-import-duplicates-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(join(root, HEAT), { recursive: true });
  writeFileSync(join(root, HEAT, 'heat.mkv'), 'heat video');
  mkdirSync(join(root, 'Meta'));
  const sheet = join(root, 'Meta', 'familyflix-library.csv');
  writeFileSync(sheet, `${lines.join('\n')}\n`);

  const storage = freshStorage();
  const mediaRoot = createMedia(media);
  const importer = createImporter({
    storage,
    media: mediaRoot,
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: createLayoutFill({ storage, media: mediaRoot }),
  });
  const folder = storage.addLibraryFolder(root);
  return { importer, folder, sheet };
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

/** One whole Folder scan of the sandbox's Library folder, linking. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.folder], false, 'link');
  return untilReview(box.importer);
}

/** One whole _Import from spreadsheet_ of the folder's own sheet, linking. */
async function importSheet(box: Sandbox): Promise<ImportRun> {
  await box.importer.start(box.sheet, false, 'link');
  return untilReview(box.importer);
}

/** How many of the run's Log lines are `text` as a Warning line. */
const warningsOf = (run: ImportRun, text: string): number =>
  run.log.filter((line) => line.text === text && line.kind === 'warning')
    .length;

describe.each([
  ['a Folder scan', scanOnce],
  ['an upload', importSheet],
])('Heat’s repeated rows, by %s', (_run, runOnce) => {
  it('logs a second Heat row as one Warning line', async () => {
    const run = await runOnce(sandbox([HEADER, HEAT_ROW, HEAT_ROW]));

    expect(warningsOf(run, DUPLICATE_LINE)).toBe(1);
  });

  it('logs one Warning line per repeated row', async () => {
    const run = await runOnce(sandbox([HEADER, HEAT_ROW, HEAT_ROW, HEAT_ROW]));

    expect(warningsOf(run, DUPLICATE_LINE)).toBe(2);
  });

  it('logs nothing for a sheet naming Heat once', async () => {
    const run = await runOnce(sandbox([HEADER, HEAT_ROW]));

    expect(warningsOf(run, DUPLICATE_LINE)).toBe(0);
  });
});
