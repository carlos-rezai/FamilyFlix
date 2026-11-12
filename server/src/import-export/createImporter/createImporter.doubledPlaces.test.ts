// @vitest-environment node
//
// 61, Export round trip, Phase 3 (issue #584): the walk words each Doubled
// place.
//
// A **Folder scan** words each **Doubled place** its **Layout read** reports
// as one **Layout warning**, beside the folder's other Layout warnings, as
// the handoff's _Copy_ table spells it, never a **Problem**:
//
// - `⚠ Heat (1995) holds 2 posters, heat-1995-POSTER.png read` (`backdrops`
//   alike);
// - `⚠ Tidewater (2018) Season 1 holds 2 posters, poster.png read`;
// - `⚠ Tidewater (2018) S01E02 holds 2 Stills, S01E02.png read`.
//
// One file per role logs nothing, so deleting the extra quiets the next scan,
// and the **Library sheet**'s path cell names the file read.
//
// The runs are real: a Library folder built under `sandboxRoot` (the one real
// video copied in, art as plain bytes), a real `Media` over a sandbox managed
// directory, the absent **Playback component**, and a real **Library sheet
// writer** wired to the library's changes.

import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  writer: LibrarySheet;
  /** The Library folder's path on disk. */
  root: string;
  /** The Library folder, listed. */
  folder: StoredLibraryFolder;
}

/**
 * A library on disk and one Library folder holding the entries given: a path
 * ending in a video extension is the real video, any other file plain bytes;
 * the **Library sheet writer** wired to the library's changes.
 */
function sandbox(entries: string[]): Sandbox {
  const dir = sandboxRoot('familyflix-doubled-places-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(root);
  for (const entry of entries) {
    const path = join(root, entry);
    mkdirSync(dirname(path), { recursive: true });
    if (/\.(mp4|mkv)$/i.test(entry)) {
      copyFileSync(FIXTURE_VIDEO, path);
    } else {
      writeFileSync(path, `${entry} bytes`);
    }
  }

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
  return {
    storage,
    importer,
    writer,
    root,
    folder: storage.addLibraryFolder(root),
  };
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

/** One whole offline scan of the Library folder, left in review. */
async function scanned(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.folder], false);
  return untilReview(box.importer);
}

const warnings = (run: ImportRun): string[] =>
  run.log.filter((line) => line.kind === 'warning').map((line) => line.text);

const HEAT = [
  'Heat (1995)/Heat.mp4',
  'Heat (1995)/Images/poster.png',
  'Heat (1995)/Images/heat-1995-POSTER.png',
  'Heat (1995)/Images/heat-backdrop.png',
  'Heat (1995)/Images/backdrop.jpg',
];

const TIDEWATER = [
  'Tidewater (2018)/Season 01/Tidewater.S01E01.mp4',
  'Tidewater (2018)/Season 01/Tidewater.S01E02.mp4',
  'Tidewater (2018)/Season 01/Images/season-poster.jpg',
  'Tidewater (2018)/Season 01/Images/poster.png',
  'Tidewater (2018)/Season 01/Images/Stills/S01E01.jpg',
  'Tidewater (2018)/Season 01/Images/Stills/tidewater-s01e02.jpg',
  'Tidewater (2018)/Season 01/Images/Stills/S01E02.png',
];

const DOUBLED_LINES = [
  '⚠ Heat (1995) holds 2 posters, heat-1995-POSTER.png read',
  '⚠ Heat (1995) holds 2 backdrops, backdrop.jpg read',
  '⚠ Tidewater (2018) Season 1 holds 2 posters, poster.png read',
  '⚠ Tidewater (2018) S01E02 holds 2 Stills, S01E02.png read',
];

describe('createImporter.scan: the Doubled place lines', () => {
  it('logs each Doubled place as one Warning line, as the Copy table spells it', async () => {
    const box = sandbox([...HEAT, ...TIDEWATER, 'Drama/Amelie (2001)/a.mp4']);

    const run = await scanned(box);

    for (const text of DOUBLED_LINES) {
      expect(run.log).toContainEqual({ text, kind: 'warning' });
    }
    expect(warnings(run).filter((text) => text.includes(' holds 2 '))).toEqual(
      expect.arrayContaining(DOUBLED_LINES)
    );
    expect(
      warnings(run).filter((text) => text.includes(' holds 2 '))
    ).toHaveLength(DOUBLED_LINES.length);
    expect(warnings(run)).toContain(
      "⚠ Drama isn't named Title (Year), left out"
    );
    expect(run.problems).toEqual([]);
  });

  it('logs no such line once the extra files are deleted', async () => {
    const box = sandbox([...HEAT, ...TIDEWATER]);
    const first = await scanned(box);
    expect(warnings(first)).toEqual(expect.arrayContaining(DOUBLED_LINES));
    await box.importer.cancel();

    for (const extra of [
      'Heat (1995)/Images/poster.png',
      'Heat (1995)/Images/heat-backdrop.png',
      'Tidewater (2018)/Season 01/Images/season-poster.jpg',
      'Tidewater (2018)/Season 01/Images/Stills/tidewater-s01e02.jpg',
    ]) {
      rmSync(join(box.root, ...extra.split('/')));
    }
    const second = await scanned(box);

    expect(warnings(second).filter((text) => text.includes(' holds '))).toEqual(
      []
    );
  });

  it('names the file read in the Library sheet’s path cell', async () => {
    const box = sandbox(HEAT);

    const run = await scanned(box);
    expect(warnings(run)).toContain(
      '⚠ Heat (1995) holds 2 posters, heat-1995-POSTER.png read'
    );
    await box.importer.cancel();
    await box.writer.flush();

    const rows = await readSheet(
      readFileSync(join(box.root, 'Meta', 'familyflix-library.csv')),
      'familyflix-library.csv'
    );
    expect(rows.find((row) => row.title === 'Heat')).toMatchObject({
      poster: 'Heat (1995)/Images/heat-1995-POSTER.png',
      backdrop: 'Heat (1995)/Images/backdrop.jpg',
    });
  });
});
