// @vitest-environment node
//
// 40 — Import review, Phase 4: "Import as on a no-row row" (issue #335).
//
// A `no-row` **Problem** carries its `guess` on the snapshot — the title and
// year a **Folder scan** would give the folder, through `guessedRow` — so the
// review can offer _Import as “Ironwood (2018)”_ without opening the form.
// `importGuessed(id)` imports the folder under that guess, exactly as a
// Folder scan would, takes the Problem off and answers `imported`; a folder
// of several videos, or a copy that fails, is `redrawn` in the row's place,
// as the Folder picker's are (issue #336); an id not there is `not-found`,
// nothing imported.
//
// The runs are real, `createImporter.folderPicker.test.ts`' sandbox: the
// fixture copied under a sandboxed **Library folder**, a folder no sheet row
// names beside it, a real `Media`, the absent Playback component.

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage } from '../../library';
import type { ImportProblem, ImportRun, Movie } from '@/types';

/** The folder the sheet forgot, named the way a release folder is. */
const IRONWOOD = 'Ironwood.2018.1080p';

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  media: string;
  root: string;
  sheet: string;
  /** The folder no sheet row names: one (empty) video. */
  unnamed: string;
}

function sandbox(
  name = IRONWOOD,
  seam: (real: Media) => Media = (real) => real
): Sandbox {
  const dir = sandboxRoot('familyflix-import-guessed-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir, 'library.csv');
  const unnamed = join(root, name);
  mkdirSync(unnamed);
  writeFileSync(join(unnamed, `${name}.mp4`), '');
  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: seam(createMedia(media)),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  storage.addLibraryFolder(root);
  return { storage, importer, media, root, sheet, unnamed };
}

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

function noRowOf(run: ImportRun): ImportProblem {
  const problem = run.problems.find((each) => each.kind === 'no-row');
  if (problem === undefined) {
    throw new Error(`no no-row Problem: ${JSON.stringify(run.problems)}`);
  }
  return problem;
}

/**
 * The fixture's own two films, as the sheet names them and as a Folder scan
 * names their folders.
 */
const FIXTURE_TITLES = new Set(['Die Hard', 'Amélie', 'Amelie']);

/** The titles the sheet does not name: what the unnamed folder became. */
const unnamedMovies = (storage: LibraryStorage): Movie[] =>
  storage
    .listMovies({ sort: 'a-z' })
    .filter((movie) => !FIXTURE_TITLES.has(movie.title));

/** The sheet run over the fixture and the unnamed folder, left in review. */
async function inReview(
  name?: string,
  seam?: (real: Media) => Media,
  before?: (box: Sandbox) => void
) {
  const box = sandbox(name, seam);
  before?.(box);
  await box.importer.start(box.sheet);
  const run = await untilReview(box.importer);
  return { ...box, run, problem: noRowOf(run) };
}

/** What a Folder scan names the same folder, in a sandbox of its own. */
async function scannedAs(name: string): Promise<Movie> {
  const box = sandbox(name);
  await box.importer.scan(box.storage.libraryFolders());
  await untilReview(box.importer);
  const [movie] = unnamedMovies(box.storage);
  if (movie === undefined) {
    throw new Error(`the Folder scan imported nothing for ${name}`);
  }
  return movie;
}

describe('createImporter — a no-row Problem’s guess', () => {
  it('guesses the title and year off the folder’s name', async () => {
    const { problem } = await inReview();

    expect(problem.guess).toBe('Ironwood (2018)');
  });

  it.each([IRONWOOD, 'Ironwood (2018)', 'The Quiet Hours'])(
    'matches what a Folder scan names %s',
    async (name) => {
      const { problem } = await inReview(name);
      const scanned = await scannedAs(name);

      expect(problem.guess).toBe(
        scanned.year === null
          ? scanned.title
          : `${scanned.title} (${scanned.year})`
      );
    }
  );

  it('carries a guess on the no-row Problem alone', async () => {
    const box = sandbox();
    // A row with no folder beside the unnamed folder: two kinds on review.
    writeFileSync(
      box.sheet,
      'Title,Year,Genre\nDie Hard,1988,Action\nThe Lantern Keeper,2011,Drama\n',
      'utf8'
    );
    await box.importer.start(box.sheet);
    const run = await untilReview(box.importer);

    expect(run.problems.map((each) => each.kind)).toContain('no-folder');
    // Amélie's folder is unnamed by this sheet too: two no-row rows.
    expect(
      new Set(
        run.problems
          .filter((each) => each.guess !== undefined)
          .map((each) => each.kind)
      )
    ).toEqual(new Set(['no-row']));
    expect(
      run.problems
        .filter((each) => each.kind === 'no-row')
        .every((each) => each.guess !== undefined)
    ).toBe(true);
  });
});

describe('createImporter.importGuessed — the folder imported', () => {
  it('imports the folder under its guess and answers imported', async () => {
    const { importer, storage, problem } = await inReview();
    expect(unnamedMovies(storage)).toEqual([]);

    const imported = await importer.importGuessed(problem.id);

    expect(imported).toEqual({ kind: 'imported' });
    const movies = unnamedMovies(storage);
    expect(movies).toHaveLength(1);
    expect(movies[0]).toMatchObject({ title: 'Ironwood', year: 2018 });
    expect(movies[0].videoPath).toMatch(/\.mp4$/);
  });

  it('imports it exactly as a Folder scan would name it', async () => {
    const { importer, storage, problem } = await inReview();
    const scanned = await scannedAs(IRONWOOD);

    await importer.importGuessed(problem.id);

    expect(unnamedMovies(storage)[0]).toMatchObject({
      title: scanned.title,
      year: scanned.year,
      genres: scanned.genres,
    });
  });

  it('takes the Problem off the snapshot, and leaves the rest', async () => {
    const { importer, problem, run } = await inReview();

    await importer.importGuessed(problem.id);

    const after = importer.current()?.problems ?? [];
    expect(after.map((each) => each.id)).toEqual(
      run.problems
        .filter((each) => each.id !== problem.id)
        .map((each) => each.id)
    );
  });

  it('copies the folder into a Movie folder of its own', async () => {
    const { importer, media, problem } = await inReview();
    const before = readdirSync(media);

    await importer.importGuessed(problem.id);

    expect(readdirSync(media)).toHaveLength(before.length + 1);
    expect(readdirSync(media)).toContain('ironwood-2018');
  });
});

describe('createImporter.importGuessed — the row redrawn', () => {
  it('redraws a folder of two videos as its no-video Problem, in the row’s place', async () => {
    const { importer, storage, problem, run } = await inReview(
      IRONWOOD,
      undefined,
      ({ unnamed }) => writeFileSync(join(unnamed, 'Ironwood.Extras.mp4'), '')
    );
    const at = run.problems.findIndex((each) => each.id === problem.id);

    const outcome = await importer.importGuessed(problem.id);

    expect(outcome).toMatchObject({
      kind: 'redrawn',
      problem: {
        kind: 'no-video',
        title: 'Ironwood',
        reason: 'Two videos. Pick the film.',
      },
    });
    const after = importer.current()?.problems ?? [];
    expect(after).toHaveLength(run.problems.length);
    expect(outcome).toEqual({ kind: 'redrawn', problem: after[at] });
    expect(unnamedMovies(storage)).toEqual([]);
  });

  it('redraws a copy that fails as its failed Problem, in the row’s place', async () => {
    const { importer, storage, media, problem, run } = await inReview(
      IRONWOOD,
      (real) => ({
        ...real,
        copyIn: async (...args) => {
          if (args[1].endsWith(`${IRONWOOD}.mp4`)) {
            throw new Error('EBUSY: resource busy or locked');
          }
          return real.copyIn(...args);
        },
      })
    );
    const at = run.problems.findIndex((each) => each.id === problem.id);
    const before = readdirSync(media);

    const outcome = await importer.importGuessed(problem.id);

    expect(outcome).toMatchObject({
      kind: 'redrawn',
      problem: {
        kind: 'failed',
        title: 'Ironwood',
        reason: "Couldn't copy the video file: EBUSY: resource busy or locked.",
      },
    });
    const after = importer.current()?.problems ?? [];
    expect(after).toHaveLength(run.problems.length);
    expect(outcome).toEqual({ kind: 'redrawn', problem: after[at] });
    expect(unnamedMovies(storage)).toEqual([]);
    expect(readdirSync(media)).toEqual(before);
  });
});

describe('createImporter.importGuessed — a row not there', () => {
  it('answers not-found for an id that is not there, and imports nothing', async () => {
    const { importer, storage } = await inReview();

    expect(await importer.importGuessed('no-such-problem')).toEqual({
      kind: 'not-found',
    });
    expect(unnamedMovies(storage)).toEqual([]);
  });

  it('answers not-found a second time, once the Problem is gone', async () => {
    const { importer, storage, problem } = await inReview();
    await importer.importGuessed(problem.id);

    expect(await importer.importGuessed(problem.id)).toEqual({
      kind: 'not-found',
    });
    expect(unnamedMovies(storage)).toHaveLength(1);
  });

  it('answers not-found when there is no run', async () => {
    const { importer } = sandbox();

    expect(await importer.importGuessed('p1')).toEqual({ kind: 'not-found' });
  });
});
