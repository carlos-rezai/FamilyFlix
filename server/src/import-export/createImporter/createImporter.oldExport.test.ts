// @vitest-environment node
//
// 67, Export paths, Phase 1 (issue #644): an old Export's rows find their
// folders.
//
// The maintainer's case: v0.16.1 exported a library whose **Source folders**
// were nested (`Movies\Amelie (2001)`, `Series\Tidewater (2018)`), so its
// sheet's `Folder` cells carry a parent segment and a backslash, and its art
// lies a level deep in the **Export folder**. That Export is kept beside this
// suite, in `v0.16.1-export/`, byte for byte as v0.16.1 wrote it.
//
// After a Factory reset the inner folders, `Movies/` and `Series/`, are linked
// as Library folders and the Export's sheet uploaded from its `Meta/` folder:
// each row's **Folder path** has a parent segment, its **Folder key** is the
// Title folder's own name, and every title is matched with no **Problem**.
// Path cells still fill nothing in this phase.

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { createLibrarySheet } from '../createLibrarySheet/createLibrarySheet';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

/** The v0.16.1 Export, as that version wrote it. */
const OLD_EXPORT = fileURLToPath(
  new URL('./v0.16.1-export/familyflix-collection_15-11-2026/', import.meta.url)
);

/** The Export's sheet, where an Export writes it. */
const SHEET = join('Meta', 'familyflix-library.csv');

/** The sheet's SHA-256 as v0.16.1 wrote it: the fixture is never rewritten. */
const SHEET_SHA256 =
  '3613f65dc0861dc2053175d88da320543ef06b08450d2188b8aba269c15d5d1d';

const SERIES_FIXTURE = join(LIBRARY_FIXTURE, '..', 'seriesFixture', 'root');

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The Export's sheet, copied into the sandbox. */
  sheet: string;
}

/**
 * The re-linked library: the importer's films in an inner `Movies/` folder,
 * Tidewater in an inner `Series/`, each linked as its own Library folder, and
 * a copy of the v0.16.1 Export beside them.
 */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-old-export-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const library = join(dir, 'Library');
  const movies = join(library, 'Movies');
  const series = join(library, 'Series');
  cpSync(join(LIBRARY_FIXTURE, 'root'), movies, { recursive: true });
  cpSync(
    join(SERIES_FIXTURE, 'Tidewater (2018)'),
    join(series, 'Tidewater (2018)'),
    { recursive: true }
  );
  const exported = join(dir, 'Backups', 'familyflix-collection_15-11-2026');
  cpSync(OLD_EXPORT, exported, { recursive: true });

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
  storage.addLibraryFolder(movies);
  storage.addLibraryFolder(series);
  return { storage, importer, sheet: join(exported, SHEET) };
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

/** The Export's sheet uploaded over the re-linked library, run to review. */
async function uploaded(box: Sandbox): Promise<ImportRun> {
  await box.importer.start(box.sheet, false);
  return untilReview(box.importer);
}

describe('createImporter: a v0.16.1 Export over a re-linked inner folder', () => {
  it('is kept byte for byte as v0.16.1 wrote it', () => {
    const bytes = readFileSync(join(OLD_EXPORT, SHEET));

    expect(createHash('sha256').update(bytes).digest('hex')).toBe(SHEET_SHA256);
  });

  // The fixture's rows carry no genre, so each film still files the soft
  // missing-meta Problem it always has (design log 13); no row fails to match.
  it('raises no matching Problem', async () => {
    const box = sandbox();

    const run = await uploaded(box);

    const matching = ['no-folder', 'ambiguous', 'no-video', 'no-row'];
    expect(run.problems.filter((p) => matching.includes(p.kind))).toEqual([]);
  });

  it('brings every title back', async () => {
    const box = sandbox();

    await uploaded(box);

    expect(
      box.storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toEqual(['Amelie', 'Die Hard']);
    expect(
      box.storage.getSeriesHome().series.map((series) => series.title)
    ).toEqual(['Tidewater']);
  });

  it('keeps each title in the inner Library folder holding its Title folder', async () => {
    const box = sandbox();

    await uploaded(box);

    const titles = box.storage.libraryTitles();
    expect(
      [...titles.movies, ...titles.series]
        .map((title) => title.sourceFolder)
        .sort()
    ).toEqual(['Amelie (2001)', 'Die Hard (1988)', 'Tidewater (2018)']);
  });
});
