// @vitest-environment node
//
// 57 — Tidy into folders, Phase 2: "a scan lists loose films" (issue #525).
//
// A **Folder scan** reads each reachable Library folder's top level and files
// one hard `loose` **Problem** per film **Tidy** and per clash, after the
// folder's other Problems: titled with the **Tidy folder name**, its reason
// _Lies loose at the top of <root>, with no folder of its own._ and its
// `tidy` on it, or, for a clash, the clash sentence and no `tidy`. The walk
// logs `· N loose videos at the top of <root>, listed in review to tidy`. A
// sheet run files none: a row whose film lies loose stays `no-folder`.
//
// Real runs over a root laid out per test (every video a copy of the
// fixture's header), a real `Media` over a sandbox managed directory and the
// absent **Playback component**.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import type { ImportProblem, ImportRun } from '@/types';

/** The fixture's film header, every video's bytes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

/** A one-row sheet naming the film the demo root holds loose. */
const SHEET = [
  'Title,Year,Genre,Director,Actors,Description,Rating,Watched',
  'Apex,2026,Drama,Mara Quinn,Lena Ortiz,A climber goes back up.,8,',
].join('\n');

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  root: string;
  folder: StoredLibraryFolder;
  sheet: string;
  /** A path nothing is at. */
  gone: string;
}

/**
 * A root laid out from `files` (`a/b` makes the folder; a trailing `/` an
 * empty one), listed as a Library folder, and the importer over it.
 */
function sandbox(files: string[]): Sandbox {
  const dir = sandboxRoot('familyflix-loose-scan-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  mkdirSync(root);
  for (const file of files) {
    const path = join(root, file);
    if (file.endsWith('/')) {
      mkdirSync(path, { recursive: true });
      continue;
    }
    mkdirSync(join(path, '..'), { recursive: true });
    if (file.endsWith('.mp4')) {
      cpSync(HEADER, path);
    } else {
      writeFileSync(path, '1\n00:00:01,000 --> 00:00:02,000\nHi\n');
    }
  }
  const sheet = join(dir, 'library.csv');
  writeFileSync(sheet, SHEET);

  const storage = freshStorage();
  const folder = storage.addLibraryFolder(root);
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  return { storage, importer, root, folder, sheet, gone: join(dir, 'gone') };
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

/** One whole scan, then the run let go, so another may start. */
async function scanOnce(
  importer: Importer,
  folders: StoredLibraryFolder[]
): Promise<ImportRun> {
  await importer.scan(folders);
  const run = await untilReview(importer);
  await importer.cancel();
  return run;
}

const looseOf = (run: ImportRun): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === 'loose');

/** The demo: three bare films at the top, one with its subtitle. */
const DEMO = [
  'Apex.2026.1080p.mp4',
  'Apex.2026.1080p.en.srt',
  'Northwind (2019).mp4',
  'Harbor.Lights.2019.mp4',
];

const filmReason = (root: string): string =>
  `Lies loose at the top of ${root}, with no folder of its own.`;

describe('createImporter.scan — loose films', () => {
  it('files one loose Problem per loose film', async () => {
    const box = sandbox(DEMO);

    const run = await scanOnce(box.importer, [box.folder]);

    expect(
      looseOf(run)
        .map((problem) => problem.title)
        .sort()
    ).toEqual(['Apex (2026)', 'Harbor Lights (2019)', 'Northwind (2019)']);
  });

  it('gives each the film reason and its tidy, the companions on it', async () => {
    const box = sandbox(DEMO);

    const run = await scanOnce(box.importer, [box.folder]);
    const apex = looseOf(run).find(
      (problem) => problem.title === 'Apex (2026)'
    );

    expect(apex).toMatchObject({
      kind: 'loose',
      title: 'Apex (2026)',
      reason: filmReason(box.root),
      tidy: {
        id: 'apex.2026.1080p.mp4',
        kind: 'film',
        folder: 'Apex (2026)',
        videos: ['Apex.2026.1080p.mp4'],
        companions: ['Apex.2026.1080p.en.srt'],
      },
    });
  });

  it('files them hard: no title the library holds is named on one', async () => {
    const box = sandbox(DEMO);

    const run = await scanOnce(box.importer, [box.folder]);

    expect(looseOf(run)).toHaveLength(3);
    for (const problem of looseOf(run)) {
      expect(problem.movieId).toBeUndefined();
      expect(problem.seriesId).toBeUndefined();
    }
  });

  it('files them after the folder’s other Problems', async () => {
    const box = sandbox([
      'Lighthouse Keepers (2019)/Lighthouse.Keepers.S01E01.mp4',
      'Lighthouse Keepers (2019)/Lighthouse.Keepers.S01E02.mp4',
      'Lighthouse Keepers (2019)/Storm.Copy.S01E02.mp4',
      'Northwind (2019).mp4',
      'Harbor.Lights.2019.mp4',
    ]);

    const run = await scanOnce(box.importer, [box.folder]);

    expect(run.problems.map((problem) => problem.kind)).toEqual([
      'unplaced',
      'loose',
      'loose',
    ]);
  });

  it('logs the folder’s info line', async () => {
    const box = sandbox(DEMO);

    const run = await scanOnce(box.importer, [box.folder]);

    expect(run.log).toContainEqual({
      text: `· 3 loose videos at the top of ${box.root}, listed in review to tidy`,
      kind: 'info',
    });
  });

  it('files them again on a scan of a folder already scanned', async () => {
    const box = sandbox(DEMO);
    await scanOnce(box.importer, [box.folder]);

    const again = await scanOnce(box.importer, [box.folder]);

    expect(looseOf(again)).toHaveLength(3);
  });
});

describe('createImporter.scan — a loose film whose folder name is taken', () => {
  it('files it with the clash sentence and no tidy', async () => {
    const box = sandbox(['Ironwood.2018.1080p.mp4', 'Ironwood (2018)/']);

    const run = await scanOnce(box.importer, [box.folder]);

    expect(looseOf(run)).toHaveLength(1);
    const [clash] = looseOf(run);
    expect(clash).toMatchObject({
      kind: 'loose',
      title: 'Ironwood (2018)',
      reason: 'A folder called “Ironwood (2018)” is already here.',
    });
    expect(clash.tidy).toBeUndefined();
  });
});

describe('createImporter.scan — an Unreachable folder', () => {
  it('files no loose Problem for it, only the reachable folder’s', async () => {
    const box = sandbox(DEMO);
    const gone = box.storage.addLibraryFolder(box.gone);

    const run = await scanOnce(box.importer, [box.folder, gone]);

    expect(looseOf(run)).toHaveLength(3);
    for (const problem of looseOf(run)) {
      expect(problem.reason).toBe(filmReason(box.root));
    }
  });
});

describe('createImporter.start — a sheet run', () => {
  it('files no loose Problem where a scan of the same root files them, and the row stays no-folder', async () => {
    const box = sandbox(DEMO);
    expect(looseOf(await scanOnce(box.importer, [box.folder]))).toHaveLength(3);

    await box.importer.start(box.sheet);
    const run = await untilReview(box.importer);

    expect(looseOf(run)).toEqual([]);
    expect(run.problems).toContainEqual(
      expect.objectContaining({ kind: 'no-folder', title: 'Apex' })
    );
  });
});
