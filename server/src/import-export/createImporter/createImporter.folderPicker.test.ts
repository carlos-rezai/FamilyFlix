// @vitest-environment node
//
// 40 — Import review, Phase 4: "the Folder picker" (issue #334).
//
// An `ambiguous` **Problem** carries its **Candidate folders** on the
// snapshot — `{ path, name, videos }`, one per folder the match weighed — so
// the review can draw a **Folder picker** without opening the form.
// `pick(id, folder)` imports the row from one of its own candidates and
// answers `null`; a candidate holding several videos turns the row into that
// folder's `no-video` Problem, answered and on the snapshot in its place,
// whose detail lists the folder's videos for the **Found-file choice**; an id
// not there answers `false`; and a folder that is not a candidate is refused
// with `CandidateRefusedError`, nothing imported.
//
// The runs are real, `createImporter.test.ts`' sandbox: the fixture copied
// under a sandboxed **Library folder**, a second Die Hard folder beside it so
// the row has two answers, a real `Media`, the absent Playback component.

import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CandidateRefusedError,
  createImporter,
  type Importer,
} from './createImporter';
import { createMedia } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage } from '../../library';
import type { ImportProblem, ImportRun, Movie } from '@/types';

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  media: string;
  root: string;
  sheet: string;
  /** The fixture's own Die Hard folder: one real video, a poster, two subtitles. */
  fixtureFolder: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-folder-picker-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir, 'library.csv');
  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  storage.addLibraryFolder(root);
  return {
    storage,
    importer,
    media,
    root,
    sheet,
    fixtureFolder: join(root, 'Die.Hard.1988.1080p'),
  };
}

/** A **Source folder** under the root holding the (empty) videos it names. */
function folderUnder(root: string, name: string, videos: string[]): string {
  const folder = join(root, name);
  mkdirSync(folder);
  for (const video of videos) {
    writeFileSync(join(folder, video), '');
  }
  return folder;
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

function ambiguousOf(run: ImportRun): ImportProblem {
  const problem = run.problems.find((each) => each.kind === 'ambiguous');
  if (problem === undefined) {
    throw new Error(`no ambiguous Problem: ${JSON.stringify(run.problems)}`);
  }
  return problem;
}

const dieHard = (storage: LibraryStorage): Movie | undefined =>
  storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === 'Die Hard');

/** Die Hard answered by the fixture's folder and a second one, run to review. */
async function twoAnswers(secondVideos: string[] = ['Die Hard.mp4']) {
  const box = sandbox();
  const second = folderUnder(box.root, 'Die Hard (1988)', secondVideos);
  await box.importer.start(box.sheet);
  const run = await untilReview(box.importer);
  return { ...box, second, run, problem: ambiguousOf(run) };
}

describe('createImporter — an ambiguous Problem’s Candidate folders', () => {
  it('names every folder it weighed, each with its name, path and video count', async () => {
    const { problem, fixtureFolder, second } = await twoAnswers();

    const byPath = [...(problem.candidates ?? [])].sort((a, b) =>
      a.path.localeCompare(b.path)
    );
    expect(byPath).toEqual(
      [
        { path: fixtureFolder, name: 'Die.Hard.1988.1080p', videos: 1 },
        { path: second, name: 'Die Hard (1988)', videos: 1 },
      ].sort((a, b) => a.path.localeCompare(b.path))
    );
  });

  it('counts every video a candidate holds', async () => {
    const { problem, second } = await twoAnswers([
      'Die Hard.mp4',
      'Die Hard (Director’s Cut).mkv',
    ]);

    expect(
      problem.candidates?.find((candidate) => candidate.path === second)
    ).toEqual({ path: second, name: 'Die Hard (1988)', videos: 2 });
  });

  it('names the one folder of a near-name match', async () => {
    const box = sandbox();
    const aliens = folderUnder(box.root, 'Aliens (1986)', ['Aliens.mp4']);
    const sheet = join(box.root, '..', 'near.csv');
    writeFileSync(sheet, 'Title,Year,Genre\nAlien,1979,Horror\n', 'utf8');
    await box.importer.start(sheet);

    const problem = ambiguousOf(await untilReview(box.importer));

    expect(problem.candidates).toEqual([
      { path: aliens, name: 'Aliens (1986)', videos: 1 },
    ]);
  });

  it('carries candidates on the ambiguous Problem alone', async () => {
    const { run } = await twoAnswers();

    expect(
      run.problems
        .filter((each) => each.candidates !== undefined)
        .map((each) => each.kind)
    ).toEqual(['ambiguous']);
  });
});

describe('createImporter.pick — a one-video candidate', () => {
  it('imports the title from that folder and answers null', async () => {
    const { importer, storage, problem, fixtureFolder } = await twoAnswers();
    expect(dieHard(storage)).toBeUndefined();

    const picked = await importer.pick(problem.id, fixtureFolder);

    expect(picked).toBeNull();
    const movie = dieHard(storage);
    expect(movie).toMatchObject({ title: 'Die Hard', year: 1988 });
    expect(movie?.videoPath).toMatch(/\.mp4$/);
    expect(movie?.posterPath).not.toBeNull();
    expect(movie?.subtitles).toHaveLength(2);
  });

  it('imports from the other candidate when that is the one pressed', async () => {
    const { importer, storage, problem, second } = await twoAnswers();

    await importer.pick(problem.id, second);

    const movie = dieHard(storage);
    expect(movie).toMatchObject({ title: 'Die Hard', year: 1988 });
    expect(movie?.posterPath).toBeNull();
    expect(movie?.subtitles).toEqual([]);
  });

  it('takes the Problem off the snapshot', async () => {
    const { importer, problem, fixtureFolder } = await twoAnswers();

    await importer.pick(problem.id, fixtureFolder);

    expect(importer.current()?.problems.map((each) => each.id)).not.toContain(
      problem.id
    );
  });

  it('copies the files into a Movie folder of their own', async () => {
    const { importer, media, problem, fixtureFolder } = await twoAnswers();
    const before = readdirSync(media);

    await importer.pick(problem.id, fixtureFolder);

    expect(readdirSync(media)).toHaveLength(before.length + 1);
    expect(readdirSync(media)).toContain('die-hard-1988');
  });
});

describe('createImporter.pick — a candidate of several videos', () => {
  const SEVERAL = ['Die Hard.mp4', 'Die Hard (Director’s Cut).mkv'];

  it('answers that folder’s no-video Problem and imports nothing', async () => {
    const { importer, storage, problem, second } = await twoAnswers(SEVERAL);

    const picked = await importer.pick(problem.id, second);

    expect(picked).toMatchObject({
      kind: 'no-video',
      title: 'Die Hard',
      reason: 'Two videos. Pick the film.',
    });
    expect(dieHard(storage)).toBeUndefined();
  });

  it('turns the row into it on the snapshot, in the ambiguous one’s place', async () => {
    const { importer, problem, second, run } = await twoAnswers(SEVERAL);
    const at = run.problems.findIndex((each) => each.id === problem.id);

    const picked = await importer.pick(problem.id, second);

    const after = importer.current()?.problems ?? [];
    expect(after).toHaveLength(run.problems.length);
    expect(after[at]).toEqual(picked);
    expect(after.some((each) => each.kind === 'ambiguous')).toBe(false);
  });

  it('opens on the Found-file choice: its detail is that folder, with both videos', async () => {
    const { importer, problem, second } = await twoAnswers(SEVERAL);

    const picked = await importer.pick(problem.id, second);
    if (picked === null || picked === false) {
      throw new Error(`expected a redrawn Problem, got ${String(picked)}`);
    }
    const detail = importer.problem(picked.id);

    expect(detail?.folder).toBe(second);
    expect([...(detail?.files.videos ?? [])].sort()).toEqual(
      SEVERAL.map((video) => join(second, video)).sort()
    );
    expect(detail?.row).toMatchObject({ title: 'Die Hard', year: 1988 });
  });
});

describe('createImporter.pick — what it refuses', () => {
  it('refuses a folder that is not one of the Problem’s candidates, and imports nothing', async () => {
    const { importer, storage, media, root, problem } = await twoAnswers();
    const elsewhere = folderUnder(root, 'Heat (1995)', ['Heat.mp4']);
    const before = readdirSync(media);

    await expect(importer.pick(problem.id, elsewhere)).rejects.toBeInstanceOf(
      CandidateRefusedError
    );

    expect(dieHard(storage)).toBeUndefined();
    expect(readdirSync(media)).toEqual(before);
    expect(importer.current()?.problems.map((each) => each.id)).toContain(
      problem.id
    );
  });

  it('refuses a path climbing out of a candidate', async () => {
    const { importer, storage, problem, fixtureFolder } = await twoAnswers();

    await expect(
      importer.pick(problem.id, join(fixtureFolder, '..', 'Drama'))
    ).rejects.toBeInstanceOf(CandidateRefusedError);
    expect(dieHard(storage)).toBeUndefined();
  });

  it('answers false for an id that is not there, and imports nothing', async () => {
    const { importer, storage, fixtureFolder } = await twoAnswers();

    expect(await importer.pick('no-such-problem', fixtureFolder)).toBe(false);
    expect(dieHard(storage)).toBeUndefined();
  });

  it('answers false a second time, once the Problem is gone', async () => {
    const { importer, problem, fixtureFolder } = await twoAnswers();
    await importer.pick(problem.id, fixtureFolder);

    expect(await importer.pick(problem.id, fixtureFolder)).toBe(false);
  });

  it('answers false when there is no run', async () => {
    const { importer, fixtureFolder } = sandbox();

    expect(await importer.pick('p1', fixtureFolder)).toBe(false);
  });
});
