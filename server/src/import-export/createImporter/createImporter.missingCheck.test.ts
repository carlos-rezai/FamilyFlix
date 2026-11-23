// @vitest-environment node
//
// 66, Missing videos, Phase 1: "a gone film is listed" (issue #634).
//
// The **Missing check** ends every run that reads the household's **Library
// folders**, after its imports and before its completion line: each held film
// whose recorded Library folder the run read has its video asked of
// `playback.videoFile`, and a `missing` answer files one `missing` **Problem**
// (_Its video, <file name>, is no longer on disk._) and one **Warning line**
// (`⚠ <key> is missing its video`), both counted in the completion line.
//
// - a film **Found again** in the run, moved or renamed, is not missing;
// - an **Unreachable** folder's film is not missing;
// - _Scan new folders_ never lists a title of a folder it did not walk;
// - a copied film whose original left its folder still plays, so is not;
// - a sheet run over the folders lists too;
// - a cancelled run lists nothing, and a skipped film stays held and is
//   listed again by the next scan, unless its file came back.
//
// The runs are real: the fixture copied into a sandboxed Library folder, an
// on-disk library with a raw handle for the columns no shared type carries, a
// real `Media` over a sandbox managed directory, and the absent **Playback
// component**.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { openDatabase, type SqliteDatabase } from '../../db';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { ImportMode, ImportProblem, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const DIE_HARD = 'Die Hard (1988)';
const DIE_HARD_FILE = 'Die.Hard.1988.1080p.mp4';
const AMELIE = 'Amelie (2001)';
const AMELIE_FILE = 'Amelie.mp4';
const HEAT = 'Heat (1995)';
const HEAT_FILE = 'Heat.mp4';

interface Sandbox {
  dir: string;
  media: string;
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  /** The fixture's Library folder: `Die Hard (1988)/`, `Amelie (2001)/`. */
  films: StoredLibraryFolder;
  /** The fixture's two-film sheet. */
  sheet: string;
}

/** The fixture in a listed films folder, over an on-disk library. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-missing-check-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  const { root, sheet } = libraryFixture(join(dir, 'films'), 'library.csv');

  const dbPath = join(dir, 'familyflix.db');
  const storage = track(createSqliteStorage(dbPath));
  const db = track(openDatabase(dbPath));
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) =>
      storage.libraryFolders().find((folder) => folder.id === id)?.path ?? null
  );
  const importer = createImporter({
    storage,
    media: createMedia(media, unfittedArt()),
    playback,
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });
  return {
    dir,
    media,
    storage,
    db,
    importer,
    films: storage.addLibraryFolder(root),
    sheet,
  };
}

/** A second listed Library folder holding one film, `Heat (1995)/Heat.mp4`. */
function secondFolder(box: Sandbox): StoredLibraryFolder {
  const root = join(box.dir, 'more');
  mkdirSync(join(root, HEAT), { recursive: true });
  copyFileSync(
    join(box.films.path, AMELIE, AMELIE_FILE),
    join(root, HEAT, HEAT_FILE)
  );
  return box.storage.addLibraryFolder(root);
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

/** One scan of `folders` in this mode, to review; the run is left there. */
async function scanOnce(
  box: Sandbox,
  folders: StoredLibraryFolder[] = [box.films],
  mode: ImportMode = 'link'
): Promise<ImportRun> {
  await box.importer.scan(folders, false, mode);
  return untilReview(box.importer);
}

/** The run's `missing` Problems, in its order. */
const missingOf = (run: ImportRun): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === 'missing');

const missingTitles = (run: ImportRun): string[] =>
  missingOf(run).map((problem) => problem.title);

/** The held film of this title's id. */
function heldId(box: Sandbox, title: string): string {
  const film = box.storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === title);
  if (film === undefined) {
    throw new Error(`no held film titled ${title}`);
  }
  return film.id;
}

/** Delete one fixture video from its Title folder. */
const deleteVideo = (
  folder: StoredLibraryFolder,
  title: string,
  file: string
) => rmSync(join(folder.path, title, file));

describe('createImporter: the Missing check over a deleted linked film', () => {
  it('lists it once, with its reason, its id and its warning line', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldId(box, 'Die Hard');
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);

    const run = await scanOnce(box);

    expect(missingOf(run)).toEqual([
      {
        id: expect.any(String),
        kind: 'missing',
        title: 'Die Hard',
        reason: `Its video, ${DIE_HARD_FILE}, is no longer on disk.`,
        movieId: id,
        takeOut: 'Take out of library',
      },
    ]);
    expect(
      run.log.filter(
        (line) => line.text === `⚠ ${DIE_HARD} is missing its video`
      )
    ).toEqual([
      { text: `⚠ ${DIE_HARD} is missing its video`, kind: 'warning' },
    ]);
  });

  it('counts it in the completion line', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);

    const run = await scanOnce(box);

    expect(missingTitles(run)).toEqual(['Die Hard']);
    const last = run.log.filter((line) => line.kind === 'success').at(-1);
    expect(last?.text).toBe(
      `✓ Scan complete: 0 imported, ${run.problems.length} need attention.`
    );
  });
});

describe('createImporter: the Missing check over a film Found again', () => {
  it('does not list a film moved to another Title folder', async () => {
    const box = sandbox();
    await scanOnce(box);
    const moved = join(box.films.path, 'Die Hard Collection (1988)');
    mkdirSync(moved);
    renameSync(
      join(box.films.path, DIE_HARD, DIE_HARD_FILE),
      join(moved, DIE_HARD_FILE)
    );
    deleteVideo(box.films, AMELIE, AMELIE_FILE);

    const run = await scanOnce(box);

    expect(missingTitles(run)).toEqual(['Amelie']);
  });

  it('does not list a film renamed in its own folder', async () => {
    const box = sandbox();
    await scanOnce(box);
    renameSync(
      join(box.films.path, DIE_HARD, DIE_HARD_FILE),
      join(box.films.path, DIE_HARD, 'Die Hard.mp4')
    );
    deleteVideo(box.films, AMELIE, AMELIE_FILE);

    const run = await scanOnce(box);

    expect(missingTitles(run)).toEqual(['Amelie']);
  });
});

describe('createImporter: the Missing check reads only the folders the run read', () => {
  it('does not list a film of an Unreachable folder', async () => {
    const box = sandbox();
    const more = secondFolder(box);
    await scanOnce(box, [box.films, more]);
    // The drive is unplugged: the folder is listed but no longer reads.
    rmSync(more.path, { recursive: true, force: true });
    deleteVideo(box.films, AMELIE, AMELIE_FILE);

    const run = await scanOnce(box, [box.films, more]);

    expect(missingTitles(run)).toEqual(['Amelie']);
  });

  it('on Scan new folders, never lists a title of a folder it did not walk', async () => {
    const box = sandbox();
    const more = secondFolder(box);
    await scanOnce(box, [box.films, more]);
    rmSync(join(more.path, HEAT, HEAT_FILE));
    deleteVideo(box.films, AMELIE, AMELIE_FILE);

    const run = await scanOnce(box, [box.films]);

    expect(missingTitles(run)).toEqual(['Amelie']);
  });

  it('lists in a sheet run over the folders too', async () => {
    const box = sandbox();
    await box.importer.start(box.sheet, false, 'link');
    await untilReview(box.importer);
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);

    await box.importer.start(box.sheet, false, 'link');
    const run = await untilReview(box.importer);

    expect(missingOf(run)).toEqual([
      expect.objectContaining({
        kind: 'missing',
        title: 'Die Hard',
        reason: `Its video, ${DIE_HARD_FILE}, is no longer on disk.`,
      }),
    ]);
    const last = run.log.filter((line) => line.kind === 'success').at(-1);
    expect(last?.text).toBe(
      `✓ Import complete: 0 imported, ${run.problems.length} need attention.`
    );
  });
});

describe('createImporter: the Missing check over a copied film', () => {
  it('does not list a copy whose original left its folder', async () => {
    const box = sandbox();
    await scanOnce(box, [box.films], 'copy');
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);
    // Amelie's copy is gone as well as its original: that one is missing.
    const { video_path: amelieCopy } = box.db
      .prepare('SELECT video_path FROM movies WHERE title = ?')
      .get('Amelie') as { video_path: string };
    rmSync(join(box.media, amelieCopy));
    deleteVideo(box.films, AMELIE, AMELIE_FILE);

    const run = await scanOnce(box, [box.films], 'copy');

    expect(missingTitles(run)).toEqual(['Amelie']);
  });
});

describe('createImporter: the Missing check across runs', () => {
  it('lists nothing for a cancelled run, and the next run lists the film once', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);

    await box.importer.scan([box.films], false, 'link');
    await box.importer.cancel();
    expect(box.importer.current()).toBeNull();

    const run = await scanOnce(box);

    expect(missingTitles(run)).toEqual(['Die Hard']);
  });

  it('keeps a skipped missing film held, and the next scan lists it again', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldId(box, 'Die Hard');
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);
    const first = await scanOnce(box);
    const [missing] = missingOf(first);
    expect(missing?.title).toBe('Die Hard');

    expect(box.importer.dismiss(missing?.id ?? '')).toBe(true);
    expect(box.storage.getMovie(id)).not.toBeNull();

    const next = await scanOnce(box);

    expect(missingTitles(next)).toEqual(['Die Hard']);
  });

  it('lists nothing on the next scan once the file is put back', async () => {
    const box = sandbox();
    await scanOnce(box);
    const video = join(box.films.path, DIE_HARD, DIE_HARD_FILE);
    const aside = join(box.dir, DIE_HARD_FILE);
    renameSync(video, aside);
    const first = await scanOnce(box);
    expect(missingTitles(first)).toEqual(['Die Hard']);

    renameSync(aside, video);
    const next = await scanOnce(box);

    expect(missingOf(next)).toEqual([]);
  });
});

// 66, Missing videos, Phase 2: "take out a film" (issue #635).
//
// `takeOutMissing(id)`, on `apply`'s precedent, is the `missing` row's _Take
// out of library_: the film's rows go, then its **Media folder** best-effort,
// as the movie Delete does, and without `leaveOut`, so a put-back file is
// imported by the next scan. Its linked video's folder is never touched. An id
// not held, or not `missing`, answers `false`; a title already deleted
// elsewhere answers `true` and only takes the Problem off (**Gone is gone**).

/** Die Hard imported, its video deleted, and the next scan in review on it. */
async function missingDieHard(box: Sandbox) {
  await scanOnce(box);
  const id = heldId(box, 'Die Hard');
  deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);
  const run = await scanOnce(box);
  const [problem] = missingOf(run);
  if (problem === undefined) {
    throw new Error(`no missing Problem: ${JSON.stringify(run.problems)}`);
  }
  return { id, problem };
}

const problemIds = (importer: Importer): string[] =>
  (importer.current()?.problems ?? []).map((problem) => problem.id);

describe('createImporter: the Missing check over a folder left with its art', () => {
  // Issue #639's walk: Die Hard's video deleted leaves its Title folder
  // holding only Images/ and Subtitles/, a folder the walk turns away.
  const kindsAndTitles = (run: ImportRun): string[] =>
    run.problems.map((problem) => `${problem.kind} ${problem.title}`);

  it('lists a missing film once, under Missing, not again under Off layout', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);

    const run = await scanOnce(box);

    expect(kindsAndTitles(run)).toEqual(['missing Die Hard']);
    expect(run.log.map((line) => line.text)).toContain(
      `⚠ ${DIE_HARD} holds no video or Season folder, left out`
    );
  });

  it('still lists the folder a film Found again left behind', async () => {
    const box = sandbox();
    await scanOnce(box);
    const moved = join(box.films.path, 'Die Hard Collection (1988)');
    mkdirSync(moved);
    renameSync(
      join(box.films.path, DIE_HARD, DIE_HARD_FILE),
      join(moved, DIE_HARD_FILE)
    );

    const run = await scanOnce(box);

    expect(kindsAndTitles(run)).toEqual([`off-layout ${DIE_HARD}`]);
  });
});

describe('createImporter: takeOutMissing on a missing film', () => {
  it('answers true, takes the Problem off and the film out of the library', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldId(box, 'Die Hard');
    box.storage.setResumePosition(id, 600);
    box.storage.setFavorite(id, true);
    expect(
      box.storage.getHome().continueWatching.map((movie) => movie.id)
    ).toContain(id);
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);
    const [problem] = missingOf(await scanOnce(box));

    expect(box.importer.takeOutMissing(problem?.id ?? '')).toBe(true);

    expect(problemIds(box.importer)).not.toContain(problem?.id);
    expect(box.storage.getMovie(id)).toBeNull();
    expect(
      box.storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toEqual(['Amelie']);
    const home = box.storage.getHome();
    expect(home.continueWatching.map((movie) => movie.id)).not.toContain(id);
    expect(home.favorites.map((movie) => movie.id)).not.toContain(id);
    expect(
      box.storage.libraryTitles().movies.map((movie) => movie.id)
    ).not.toContain(id);
  });

  it('removes its managed art and subtitles, and leaves its linked folder untouched', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldId(box, 'Die Hard');
    const folder = box.storage.mediaFolderOf('movie', id);
    expect(folder).not.toBeNull();
    expect(existsSync(join(box.media, folder ?? ''))).toBe(true);
    deleteVideo(box.films, DIE_HARD, DIE_HARD_FILE);
    const [problem] = missingOf(await scanOnce(box));

    box.importer.takeOutMissing(problem?.id ?? '');

    expect(existsSync(join(box.media, folder ?? ''))).toBe(false);
    const titleFolder = join(box.films.path, DIE_HARD);
    expect(existsSync(join(titleFolder, 'Images', 'poster.jpg'))).toBe(true);
    expect(existsSync(join(titleFolder, 'Images', 'backdrop.jpg'))).toBe(true);
    expect(
      existsSync(join(titleFolder, 'Subtitles', 'Die.Hard.1988.1080p.en.srt'))
    ).toBe(true);
  });

  it('records no Left-out video, and the next scan imports a put-back file', async () => {
    const box = sandbox();
    await scanOnce(box);
    const video = join(box.films.path, DIE_HARD, DIE_HARD_FILE);
    const aside = join(box.dir, DIE_HARD_FILE);
    renameSync(video, aside);
    const [problem] = missingOf(await scanOnce(box));
    expect(box.importer.takeOutMissing(problem?.id ?? '')).toBe(true);
    expect(box.storage.leftOut(box.films.id).size).toBe(0);

    renameSync(aside, video);
    const next = await scanOnce(box);

    expect(missingOf(next)).toEqual([]);
    expect(
      box.storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toEqual(['Amelie', 'Die Hard']);
  });

  it('leaves the rest of the library held', async () => {
    const box = sandbox();
    const { problem } = await missingDieHard(box);
    const amelie = heldId(box, 'Amelie');

    box.importer.takeOutMissing(problem.id);

    expect(box.storage.getMovie(amelie)).not.toBeNull();
  });

  it('answers true and only takes the Problem off for a film already deleted elsewhere', async () => {
    const box = sandbox();
    const { id, problem } = await missingDieHard(box);
    box.storage.deleteMovie(id);

    expect(box.importer.takeOutMissing(problem.id)).toBe(true);

    expect(problemIds(box.importer)).not.toContain(problem.id);
    expect(heldId(box, 'Amelie')).toEqual(expect.any(String));
  });

  it('answers false for an id that is not there, taking nothing out', async () => {
    const box = sandbox();
    const { id, problem } = await missingDieHard(box);

    expect(box.importer.takeOutMissing('no-such-problem')).toBe(false);

    expect(box.storage.getMovie(id)).not.toBeNull();
    expect(problemIds(box.importer)).toContain(problem.id);
  });

  it('answers false for the same id a second time', async () => {
    const box = sandbox();
    const { problem } = await missingDieHard(box);
    box.importer.takeOutMissing(problem.id);

    expect(box.importer.takeOutMissing(problem.id)).toBe(false);
  });

  it('answers false for a Problem that is not missing, taking nothing out', async () => {
    const box = sandbox();
    await scanOnce(box);
    // Two loose videos in one Title folder: the no-video Problem.
    mkdirSync(join(box.films.path, HEAT));
    copyFileSync(
      join(box.films.path, AMELIE, AMELIE_FILE),
      join(box.films.path, HEAT, HEAT_FILE)
    );
    copyFileSync(
      join(box.films.path, AMELIE, AMELIE_FILE),
      join(box.films.path, HEAT, 'Heat Directors Cut.mp4')
    );
    const run = await scanOnce(box);
    const other = run.problems.find((problem) => problem.kind === 'no-video');
    expect(other).toBeDefined();

    expect(box.importer.takeOutMissing(other?.id ?? '')).toBe(false);

    expect(problemIds(box.importer)).toContain(other?.id);
    expect(box.storage.listMovies({ sort: 'a-z' })).toHaveLength(2);
  });

  it('answers false when there is no run', () => {
    const box = sandbox();

    expect(box.importer.takeOutMissing('p1')).toBe(false);
  });
});
