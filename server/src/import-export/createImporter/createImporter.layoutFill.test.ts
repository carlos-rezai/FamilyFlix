// @vitest-environment node
//
// 59, Rebuild whole, Phase 9 (issue #556): the Layout fill during a scan.
//
// `createImporter` takes the **Layout fill** as a dependency, as
// `createEnrichment` does, and runs it after each title a scan imports or
// fills, film or series. Each file it writes is the Sync's own `↓` line in
// the run's log; a folder it can't write is one Warning line and the run goes
// on; a Title folder already in the **Folder layout** gets nothing written.
//
// Composed as `createImporter.pathCells.test.ts` is: the importer's film or
// series fixture copied into a sandboxed **Library folder** (its sheet, when
// it has one, in `Meta/`), a real `freshStorage`, a real `Media` over a
// sandbox **Managed media directory**, the absent **Playback component**, an
// idle **Library sheet writer**, and the real `createLayoutFill` over the same
// storage and media, recorded so a test knows which titles it ran for.

import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
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
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { SERIES_FIXTURE } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun, LogLine } from '@/types';

const DIE_HARD = 'Die Hard (1988)';
const TIDEWATER = 'Tidewater (2018)';

/** The fixture sheet's header: every Sheet column. */
const HEADER = readFileSync(join(LIBRARY_FIXTURE, 'library.csv'), 'utf8')
  .split(/\r?\n/)[0]
  .trim();

/** A real JPEG to build each image from. */
const JPEG = readFileSync(
  join(LIBRARY_FIXTURE, 'root', DIE_HARD, 'Images', 'poster.jpg')
);

/** A sheet of Die Hard's Movie row, its Poster cell `poster`. */
const dieHardSheet = (poster: string): string =>
  [
    HEADER,
    [
      'Movie',
      DIE_HARD,
      '',
      '',
      'Die Hard',
      '1988',
      '',
      '',
      '"Action, Thriller"',
      'John McTiernan',
      '"Bruce Willis, Alan Rickman"',
      'A New York cop takes on a tower full of thieves on Christmas Eve.',
      '8',
      '',
      '',
      'Watched',
      '',
      '',
      '',
      poster,
      '',
      '',
    ].join(','),
    '',
  ].join('\n');

/** A sheet of Tidewater's rows, its Season 1 poster cell `seasonPoster`. */
const tidewaterSheet = (seasonPoster: string): string =>
  [
    HEADER,
    `Series,${TIDEWATER},,,Tidewater,2018,,,"Drama, Family",Ines Duarte,"Rui Matos, Clara Bento",A ferry crew keeps an island connected through one hard winter.,7,,,,,,,,,`,
    `Season,${TIDEWATER},1,,,,,,,,,,,,,,,,,${seasonPoster},,`,
    `Episode,${TIDEWATER},1,1,Low Water,,2018-10-02,,,,,,,,,Unwatched,,,,,,`,
    `Episode,${TIDEWATER},1,2,The Crossing,,2018-10-09,,,,,,,,,Unwatched,,,,,,`,
    '',
  ].join('\n');

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  folder: StoredLibraryFolder;
  /** The Library folder on disk. */
  root: string;
  /** Every title id the Layout fill was run for, in order. */
  filled: string[];
}

/**
 * `fixture`'s tree copied into a sandboxed Library folder, `csv` (if any) its
 * sheet in `Meta/`, and an importer handed the real Layout fill, recorded.
 */
function sandbox(fixture: string, csv: string | null): Sandbox {
  const dir = sandboxRoot('familyflix-import-layout-fill-');
  const mediaDir = join(dir, 'media');
  mkdirSync(mediaDir);
  const root = join(dir, 'Movies');
  cpSync(join(fixture, 'root'), root, { recursive: true });
  if (csv !== null) {
    mkdirSync(join(root, 'Meta'));
    writeFileSync(join(root, 'Meta', 'familyflix-library.csv'), csv);
  }

  const storage = freshStorage();
  const media = createMedia(mediaDir);
  const real = createLayoutFill({ storage, media });
  const filled: string[] = [];
  const importer = createImporter({
    storage,
    media,
    playback: createPlayback(mediaDir, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: {
      fill(titleId: string) {
        filled.push(titleId);
        return real.fill(titleId);
      },
    },
  });
  const folder = storage.addLibraryFolder(root);
  return { storage, importer, folder, root, filled };
}

/** An image at `cell` in the Library folder: the fixture JPEG, then its spelling. */
function writeImage(box: Sandbox, cell: string): Buffer {
  const path = join(box.root, ...cell.split('/'));
  mkdirSync(join(path, '..'), { recursive: true });
  const bytes = Buffer.concat([JPEG, Buffer.from(cell)]);
  writeFileSync(path, bytes);
  return bytes;
}

/** Every file under a directory, relative to it, sorted, with its bytes. */
function treeOf(dir: string): [string, string][] {
  const found: [string, string][] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        found.push([
          relative(dir, path),
          readFileSync(path).toString('base64'),
        ]);
      }
    }
  };
  walk(dir);
  return found.sort(([a], [b]) => a.localeCompare(b));
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

/** Every title id the library holds, films and series, sorted. */
function heldIds(storage: LibraryStorage): string[] {
  const films = storage.listMovies({ sort: 'a-z' }).map((movie) => movie.id);
  const shows = storage.getSeriesHome().series.map((series) => series.id);
  return [...films, ...shows].sort();
}

/** The run's `↓` lines. */
const writtenLines = (run: ImportRun): LogLine[] =>
  run.log.filter((line) => line.text.startsWith('↓ '));

describe('createImporter.scan: runs the Layout fill after each title', () => {
  it.each([
    ['films', LIBRARY_FIXTURE],
    ['series', SERIES_FIXTURE],
  ] as const)(
    'runs it for every %s title the scan imports',
    async (_, fixture) => {
      const box = sandbox(fixture, null);

      await scanOnce(box);

      expect(heldIds(box.storage)).toHaveLength(2);
      expect([...new Set(box.filled)].sort()).toEqual(heldIds(box.storage));
    }
  );

  it('runs it for a held series a rescan fills', async () => {
    const box = sandbox(SERIES_FIXTURE, null);
    const poster = join(
      box.root,
      TIDEWATER,
      'Season 01',
      'Images',
      'poster.jpg'
    );
    const aside = join(box.root, 'poster-aside.jpg');
    renameSync(poster, aside);
    await scanOnce(box);
    renameSync(aside, poster);
    box.filled.length = 0;

    await scanOnce(box);

    const tidewater = box.storage
      .getSeriesHome()
      .series.find((series) => series.title === 'Tidewater');
    expect(tidewater).toBeDefined();
    expect(box.filled).toContain(tidewater?.id);
  });
});

describe('createImporter.scan: each file the Layout fill writes is one ↓ line', () => {
  it('writes a film’s poster from its cell into Images/ and logs it', async () => {
    const cell = `${DIE_HARD}/heat.jpg`;
    const box = sandbox(LIBRARY_FIXTURE, dieHardSheet(cell));
    rmSync(join(box.root, DIE_HARD, 'Images', 'poster.jpg'));
    const bytes = writeImage(box, cell);

    const run = await scanOnce(box);

    const target = join(box.root, DIE_HARD, 'Images', 'poster.jpg');
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target)).toEqual(bytes);
    expect(writtenLines(run)).toEqual([
      { text: `↓ poster.jpg  →  ${target}`, kind: 'scan' },
    ]);
  });

  it('writes a series’ Season poster from its cell into its Images/ and logs it', async () => {
    const cell = `${TIDEWATER}/Season 01/cover.jpg`;
    const box = sandbox(SERIES_FIXTURE, tidewaterSheet(cell));
    rmSync(join(box.root, TIDEWATER, 'Season 01', 'Images', 'poster.jpg'));
    const bytes = writeImage(box, cell);

    const run = await scanOnce(box);

    const target = join(
      box.root,
      TIDEWATER,
      'Season 01',
      'Images',
      'poster.jpg'
    );
    expect(existsSync(target)).toBe(true);
    expect(readFileSync(target)).toEqual(bytes);
    expect(writtenLines(run)).toEqual([
      { text: `↓ poster.jpg  →  ${target}`, kind: 'scan' },
    ]);
  });
});

describe('createImporter.scan: a folder the Layout fill can’t write', () => {
  it('is one Warning line, and the run completes with every title', async () => {
    const cell = `${DIE_HARD}/heat.jpg`;
    const box = sandbox(LIBRARY_FIXTURE, dieHardSheet(cell));
    const images = join(box.root, DIE_HARD, 'Images');
    rmSync(images, { recursive: true });
    // A file where the Images folder belongs: the folder can't be made.
    writeFileSync(images, 'not a folder');
    writeImage(box, cell);

    const run = await scanOnce(box);

    const warnings = run.log.filter(
      (line) => line.kind === 'warning' && line.text.includes(images)
    );
    expect(warnings).toHaveLength(1);
    expect(readFileSync(images, 'utf8')).toBe('not a folder');
    expect(run.phase).toBe('review');
    expect(
      box.storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toContain('Die Hard');
    expect(heldIds(box.storage)).toHaveLength(2);
    expect(run.problems.filter((each) => each.kind === 'failed')).toEqual([]);
  });
});

describe('createImporter.scan: a folder already in the layout', () => {
  it.each([
    ['films', LIBRARY_FIXTURE],
    ['series', SERIES_FIXTURE],
  ] as const)(
    'runs the Layout fill over the %s fixture and writes nothing',
    async (_, fixture) => {
      const box = sandbox(fixture, null);
      const before = treeOf(box.root);

      const run = await scanOnce(box);

      expect(box.filled).not.toEqual([]);
      expect(writtenLines(run)).toEqual([]);
      expect(treeOf(box.root)).toEqual(before);
    }
  );
});
