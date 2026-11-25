// @vitest-environment node
//
// 68, Resolve cells (issue #650): a `no-folder` row's Resolve opens with
// the art its row's path cells name under the run's **Sheet root**.
//
// Heat's row names `Heat (1995)/`, a Title folder no Library folder holds:
// the film lies in `Heat old rip/`, so the row is a `no-folder` **Problem**.
// Its sheet lies outside any `Meta/` with `Heat (1995)/Images/poster.jpg` and
// `Heat (1995)/Subtitles/English.srt` beside it, as an Export carries them.
// The **Problem detail** offers both as **Found files**, and the Resolve's
// save copies them in; a found video under the Sheet root is still refused.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  createImporter,
  ImportPathError,
  type Importer,
  type ResolveForm,
} from './createImporter';
import { createSqliteStorage, type LibraryStorage } from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { idleFrameFill } from '../../test-support/idleFrameFill/idleFrameFill';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { ImportProblem, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const HEAT = 'Heat (1995)';

/** Heat's one-row sheet, its Poster and Subtitles cells under its Folder key. */
const SHEET = [
  'Type,Folder,Title,Year,Genres,Poster,Subtitles',
  `Movie,${HEAT},Heat,1995,Crime,${HEAT}/Images/poster.jpg,${HEAT}/Subtitles/English.srt`,
  '',
].join('\n');

/** Write `bytes` at `path`, its folders made on the way. */
function put(path: string, bytes: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
}

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  /** The film, under the Library folder in a folder no row names. */
  video: string;
  /** The folder holding the sheet: the run's Sheet root. */
  sheets: string;
  /** The managed media directory. */
  media: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-resolve-cells-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const library = join(dir, 'Library');
  const video = join(library, 'Heat old rip', 'heat.mp4');
  put(video, 'video bytes');
  const sheets = join(dir, 'Sheets');

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media, unfittedArt()),
    playback: createPlayback(media, fixedSlot(null), () => null),
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
    frameFill: idleFrameFill(),
  });
  storage.addLibraryFolder(library);
  return { storage, importer, video, sheets, media };
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

/** Heat's `no-folder` Problem, once the run over the sheet reached review. */
async function noFolder(box: Sandbox): Promise<ImportProblem> {
  const sheet = join(box.sheets, 'my-library.csv');
  put(sheet, SHEET);
  await box.importer.start(sheet, false);
  const run = await untilReview(box.importer);
  const problem = run.problems.find((each) => each.kind === 'no-folder');
  if (problem === undefined) {
    throw new Error(`no no-folder Problem: ${JSON.stringify(run.problems)}`);
  }
  return problem;
}

/** The art the sheet's cells name, laid beside the sheet. */
function layArt(box: Sandbox): { poster: string; track: string } {
  const poster = join(box.sheets, HEAT, 'Images', 'poster.jpg');
  const track = join(box.sheets, HEAT, 'Subtitles', 'English.srt');
  put(poster, 'poster bytes');
  put(track, 'track bytes');
  return { poster, track };
}

/** Heat's Resolve as the form sends it: its video picked, the rest as given. */
const resolveForm = (
  video: string,
  rest: Partial<ResolveForm> = {}
): ResolveForm => ({
  title: 'Heat',
  year: 1995,
  director: null,
  synopsis: null,
  rating: null,
  cast: [],
  genres: ['Crime'],
  video: { found: video },
  poster: null,
  backdrop: null,
  subtitles: [],
  ...rest,
});

describe('createImporter: a no-folder row’s Problem detail', () => {
  it('offers the poster its Poster cell names under the Sheet root', async () => {
    const box = sandbox();
    const { poster } = layArt(box);
    const problem = await noFolder(box);

    expect(box.importer.problem(problem.id)?.files.poster).toBe(poster);
  });

  it('offers each track its Subtitles cells name, in the language its name reads', async () => {
    const box = sandbox();
    const { track } = layArt(box);
    const problem = await noFolder(box);

    expect(box.importer.problem(problem.id)?.files.subtitles).toEqual([
      { path: track, language: 'English' },
    ]);
  });

  it('offers nothing a cell names that is not there', async () => {
    const box = sandbox();
    const problem = await noFolder(box);

    const files = box.importer.problem(problem.id)?.files;
    expect(files?.poster).toBeUndefined();
    expect(files?.subtitles).toEqual([]);
  });
});

describe('createImporter: a no-folder row’s Resolve', () => {
  it('saves the poster and track found under the Sheet root', async () => {
    const box = sandbox();
    const art = layArt(box);
    const problem = await noFolder(box);

    const movie = await box.importer.resolve(
      problem.id,
      resolveForm(box.video, {
        poster: { found: art.poster },
        subtitles: [{ file: { found: art.track }, language: 'English' }],
      })
    );

    expect(movie.posterPath).not.toBeNull();
    expect(readFileSync(join(box.media, movie.posterPath ?? ''), 'utf8')).toBe(
      'poster bytes'
    );
    expect(movie.subtitles.map((each) => each.language)).toEqual(['English']);
  });

  it('only reads the Sheet root', async () => {
    const box = sandbox();
    const art = layArt(box);
    const problem = await noFolder(box);

    await box.importer.resolve(
      problem.id,
      resolveForm(box.video, { poster: { found: art.poster } })
    );

    expect(existsSync(art.poster)).toBe(true);
  });

  it('refuses a found video under the Sheet root', async () => {
    const box = sandbox();
    const stray = join(box.sheets, HEAT, 'heat.mp4');
    put(stray, 'video bytes');
    const problem = await noFolder(box);

    await expect(
      box.importer.resolve(problem.id, resolveForm(stray))
    ).rejects.toBeInstanceOf(ImportPathError);
  });
});
