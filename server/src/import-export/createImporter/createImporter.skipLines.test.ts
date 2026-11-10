// @vitest-environment node
//
// 60, Rebuild edges, Phase 2 (issue #565): both runs log every skip.
//
// _Import from spreadsheet_ and the **Folder scan**'s Meta sheet read both
// log every skip the **Sheet reader** reports, each by `skipLine`, so a Meta
// sheet's titleless row is no longer silent. The ticket's Ronin repro: a
// Meta sheet row whose `Poster` climbs out of the Library folder and whose
// `Subtitles` climbs out of the Title folder copies nothing into the
// **Managed media directory**, writes nothing into the **Title folder**, and
// its log names both refused cells.
//
// Composed as the fixture suites are: a sandboxed Library folder holding
// `Ronin (1998)/ronin.mkv` with the sheet in its `Meta/`, the two files the
// cells name lying outside it, a real `freshStorage`, a real `Media` over a
// sandbox Managed media directory, the absent **Playback component**, an
// idle **Library sheet writer** and the real **Layout fill**.

import {
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createLayoutFill } from '../createLayoutFill/createLayoutFill';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun } from '@/types';

const RONIN = 'Ronin (1998)';
const POSTER_CELL = '../secret.txt';
const SUBTITLES_CELL = `${RONIN}/../../private/diary.srt`;

const HEADER = 'Type,Folder,Title,Year,Subtitles,Poster';

/** Ronin's row, its two path cells refused. */
const RONIN_ROW = `Movie,${RONIN},Ronin,1998,${SUBTITLES_CELL},${POSTER_CELL}`;

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The Library folder on disk. */
  root: string;
  /** The Managed media directory. */
  media: string;
  /** The sheet in the Library folder's `Meta/`. */
  sheet: string;
}

/**
 * A Library folder holding Ronin's Title folder and `lines` as its Meta
 * sheet, `secret.txt` beside the Library folder and `private/diary.srt`
 * beside that, as the ticket's repro lays them.
 */
function sandbox(lines: string[]): Sandbox {
  const dir = sandboxRoot('familyflix-import-skip-lines-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(join(root, RONIN), { recursive: true });
  writeFileSync(join(root, RONIN, 'ronin.mkv'), 'ronin video');
  mkdirSync(join(root, 'Meta'));
  const sheet = join(root, 'Meta', 'familyflix-library.csv');
  writeFileSync(sheet, `${lines.join('\n')}\n`);
  writeFileSync(join(dir, 'secret.txt'), 'a secret');
  mkdirSync(join(dir, 'private'));
  writeFileSync(
    join(dir, 'private', 'diary.srt'),
    '1\n00:00:01,000 --> 00:00:02,000\nDear diary\n'
  );

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
  return { storage, importer, folder, root, media, sheet };
}

/** Every file under a directory, relative to it, sorted. */
function filesUnder(dir: string): string[] {
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        found.push(relative(dir, path));
      }
    }
  };
  walk(dir);
  return found.sort();
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

/** The text of each of the run's Log lines. */
const logOf = (run: ImportRun): string[] => run.log.map((entry) => entry.text);

describe.each([
  ['a Folder scan', scanOnce],
  ['an upload', importSheet],
])('the Ronin repro, by %s', (_run, runOnce) => {
  it('copies nothing, writes nothing into the Title folder, and logs both refused cells', async () => {
    const box = sandbox([HEADER, RONIN_ROW]);

    const run = await runOnce(box);

    expect(filesUnder(box.media)).toEqual([]);
    expect(filesUnder(join(box.root, RONIN))).toEqual(['ronin.mkv']);
    expect(logOf(run)).toEqual(
      expect.arrayContaining([
        `⚠ ${RONIN}: Poster "${POSTER_CELL}" not read`,
        `⚠ ${RONIN}: Subtitles "${SUBTITLES_CELL}" not read`,
      ])
    );
  });
});

describe('createImporter.scan: a Meta sheet’s titleless row', () => {
  it('is logged as the upload logs it', async () => {
    const box = sandbox([HEADER, RONIN_ROW, 'Movie,,,1998,,']);

    const run = await scanOnce(box);

    expect(logOf(run)).toContain('⚠ Row 3 has no title, skipped');
  });
});
