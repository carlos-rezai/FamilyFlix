// @vitest-environment node
//
// 61, Export round trip, Phase 2 (issue #583): an upload reads an unscanned
// folder's own sheet first.
//
// QA ticket 580's Heat repro: `Heat (1995)/heat.mkv` scanned, rated 5 and
// exported, then rated 9 and hearted, its **Library sheet** caught up, the
// library Factory reset, the folder listed again and the **Export**'s sheet
// uploaded. A sheet run reads each walked **Library folder** never scanned
// (`scannedAt` `null`) that holds a Library sheet before it matches the
// uploaded rows, so those rows meet Heat as a held title: a cell Heat lacks
// is a **Sheet fill**, a cell the two sheets disagree on a **Sheet
// difference**, _Yours 9 | Spreadsheet 5_. _Finish_ with _Yours_ keeps 9 and
// the heart, and `Meta/familyflix-library.csv` is not rewritten to 5. A
// scanned folder, or an unscanned one with no sheet, is unchanged; the run is
// still one run, one complete line, one review.
//
// The run is real: the ticket's Library folder laid from nothing in a
// sandbox, a real `Media`, the absent Playback component, a real **Library
// sheet writer** wired to `LibraryStorage.onChange` as the server wires it,
// and a real `writeExport`.

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  createLibrarySheet,
  type LibrarySheet,
} from '../createLibrarySheet/createLibrarySheet';
import { sourceFoldersOf } from '../sourceFoldersOf/sourceFoldersOf';
import { writeExport } from '../writeExport/writeExport';
import type { ImportProblem, ImportRun, Movie } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const HEAT = 'Heat (1995)';

const DIRECTOR = 'Michael Mann';

const EXPORT_NAME = 'familyflix-collection_12-11-2026';

/** A real video to lay Heat's from. */
const VIDEO = readFileSync(
  join(LIBRARY_FIXTURE, 'root', 'Die Hard (1988)', 'Die.Hard.1988.1080p.mp4')
);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  writer: LibrarySheet;
  mediaDomain: Media;
  /** The Library folder's path on disk. */
  root: string;
  /** Where the Export is written. */
  exports: string;
}

/** The ticket's Library folder, Heat's one video; a fresh library over it. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-unscanned-sheet-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'Movies');
  mkdirSync(join(root, HEAT), { recursive: true });
  writeFileSync(
    join(root, HEAT, 'heat.mkv'),
    Buffer.concat([VIDEO, Buffer.from(HEAT)])
  );
  const exports = join(dir, 'Backups');
  mkdirSync(exports);

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const writer = createLibrarySheet({ storage });
  storage.onChange((folderIds) => writer.touch(folderIds));
  const mediaDomain = createMedia(media);
  const importer = createImporter({
    storage,
    media: mediaDomain,
    // A Linked video resolves under its Library folder, so a linked Heat is
    // held where it lies, not Found again.
    playback: createPlayback(
      media,
      fixedSlot(null),
      (id) =>
        storage.libraryFolders().find((folder) => folder.id === id)?.path ??
        null
    ),
    librarySheet: writer,
    layoutFill: idleLayoutFill(),
  });
  return { storage, importer, writer, mediaDomain, root, exports };
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

/** _Finish_: the run let go, and every sheet it held caught up. */
async function finish(box: Sandbox): Promise<void> {
  await box.importer.cancel();
  await box.writer.flush();
}

/** Every held Heat, read whole. */
function heats(storage: LibraryStorage): Movie[] {
  return storage
    .listMovies({ sort: 'a-z' })
    .filter((movie) => movie.title === 'Heat')
    .map((listed) => {
      const movie = storage.getMovie(listed.id);
      if (movie === null) {
        throw new Error('the library lost Heat');
      }
      return movie;
    });
}

/** The one held Heat, or a failure when the library holds not exactly one. */
function heat(storage: LibraryStorage): Movie {
  const held = heats(storage);
  expect(held).toHaveLength(1);
  return held[0];
}

/**
 * The ticket's repro up to the upload: Heat scanned, given its director,
 * rated 5 and exported; then rated 9, hearted and its director cleared, the
 * Library sheet caught up. Answers the Export's sheet.
 */
async function heatExported(box: Sandbox): Promise<string> {
  await box.importer.scan([box.storage.addLibraryFolder(box.root)], false);
  await untilReview(box.importer);
  await finish(box);
  const id = heat(box.storage).id;
  box.storage.updateMovie(id, { director: DIRECTOR });
  box.storage.setRating(id, 5);
  await box.writer.flush();

  const outcome = await writeExport(
    box.mediaDomain,
    {
      format: 'csv',
      destination: box.exports,
      images: false,
      subtitles: false,
      name: EXPORT_NAME,
    },
    {
      movies: [heat(box.storage)],
      series: [],
      sourceFolders: sourceFoldersOf(box.storage.libraryTitles()),
    }
  );
  if (outcome.kind !== 'written') {
    throw new Error(`the export was not written: ${JSON.stringify(outcome)}`);
  }

  box.storage.setRating(id, 9);
  box.storage.setFavorite(id, true);
  box.storage.updateMovie(id, { director: null });
  await box.writer.flush();
  return join(outcome.folder, 'Meta', 'familyflix-library.csv');
}

/** The Export's sheet uploaded over the library as it stands, run to review. */
async function upload(box: Sandbox, sheet: string): Promise<ImportRun> {
  await box.importer.start(sheet, false);
  return untilReview(box.importer);
}

/** The whole repro: exported, Factory reset, the folder listed again, uploaded. */
async function heatRepro(box: Sandbox): Promise<ImportRun> {
  const sheet = await heatExported(box);
  box.storage.reset();
  const folder: StoredLibraryFolder = box.storage.addLibraryFolder(box.root);
  expect(folder.scannedAt).toBeNull();
  return upload(box, sheet);
}

/** The run's `differs` Problems. */
const differsOf = (run: ImportRun): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === 'differs');

/** Heat's row of the Library folder's own sheet, by column name. */
function metaHeatRow(box: Sandbox): Record<string, string> {
  const [header, ...rows] = readFileSync(
    join(box.root, 'Meta', 'familyflix-library.csv'),
    'utf8'
  )
    .split(/\r?\n/)
    .filter((line) => line !== '');
  const names = header.split(',');
  const heatRows = rows.filter((row) => row.includes(HEAT));
  expect(heatRows).toHaveLength(1);
  const cells = heatRows[0].split(',');
  return Object.fromEntries(names.map((name, index) => [name, cells[index]]));
}

/**
 * What the title's one `✓ Updated` line names, or a failure when the run
 * logged not exactly one for it.
 */
function updatedNames(run: ImportRun, title: string): string[] {
  const prefix = `✓ Updated    ${title} — `;
  const lines = run.log.filter((line) => line.text.startsWith(prefix));
  expect(lines.map((line) => line.text)).toHaveLength(1);
  return lines[0].text.slice(prefix.length).split(', ');
}

describe('createImporter.start: an upload into an unscanned folder holding a Library sheet', () => {
  it('keeps the Heat repro’s 9 and its heart after Finish with Yours', async () => {
    const box = sandbox();
    const run = await heatRepro(box);
    const [differs] = differsOf(run);
    expect(differs).toBeDefined();

    expect(box.importer.apply(differs.id, { rating: 'mine' })).toBe(true);
    await finish(box);

    expect(heat(box.storage)).toMatchObject({ rating: 9, isFavorite: true });
  });

  it('holds a Sheet difference, Yours 9 | Spreadsheet 5', async () => {
    const box = sandbox();

    const run = await heatRepro(box);

    const differs = differsOf(run);
    expect(differs).toHaveLength(1);
    expect(differs[0].title).toMatch(/^Heat/);
    expect(differs[0].differences).toEqual([
      { field: 'rating', label: 'Rating', mine: '4½ ★', sheet: '2½ ★' },
    ]);
  });

  it('leaves Meta/familyflix-library.csv saying 9 and the heart after Finish', async () => {
    const box = sandbox();
    const run = await heatRepro(box);
    for (const problem of differsOf(run)) {
      box.importer.apply(problem.id, { rating: 'mine' });
    }

    await finish(box);

    expect(metaHeatRow(box)).toMatchObject({ Rating: '9', Favorite: 'Yes' });
  });

  it('fills a cell the folder’s own sheet left blank as a Sheet fill', async () => {
    const box = sandbox();

    const run = await heatRepro(box);

    expect(updatedNames(run, HEAT)).toContain('director');
    expect(heat(box.storage).director).toBe(DIRECTOR);
  });

  it('logs one complete line and reaches review once', async () => {
    const box = sandbox();

    const run = await heatRepro(box);

    const complete = run.log.filter((line) => /^✓ .*complete/.test(line.text));
    expect(complete).toHaveLength(1);
    expect(run.log.at(-1)).toEqual(complete[0]);
    expect(box.importer.current()?.phase).toBe('review');
  });
});

describe('createImporter.start: an upload the change leaves as it was', () => {
  it('raises the same difference in a scanned folder, and reads no sheet twice', async () => {
    const box = sandbox();
    const sheet = await heatExported(box);

    const run = await upload(box, sheet);

    expect(heats(box.storage)).toHaveLength(1);
    expect(differsOf(run)[0]?.differences).toEqual([
      { field: 'rating', label: 'Rating', mine: '4½ ★', sheet: '2½ ★' },
    ]);
    expect(updatedNames(run, HEAT)).toContain('director');
    expect(
      run.log.filter((line) => /^✓ .*complete/.test(line.text))
    ).toHaveLength(1);
  });

  it('imports the uploaded row afresh into an unscanned folder with no Library sheet', async () => {
    const box = sandbox();
    const sheet = await heatExported(box);
    box.storage.reset();
    rmSync(join(box.root, 'Meta'), { recursive: true, force: true });
    box.storage.addLibraryFolder(box.root);

    const run = await upload(box, sheet);

    expect(differsOf(run)).toEqual([]);
    expect(heat(box.storage)).toMatchObject({
      rating: 5,
      isFavorite: false,
      director: DIRECTOR,
    });
  });
});
