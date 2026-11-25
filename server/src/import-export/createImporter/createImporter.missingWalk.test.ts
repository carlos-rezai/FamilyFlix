// @vitest-environment node
//
// 66, Missing videos, Phase 6: "the walk and the documents" (issue #639).
//
// Log 66's walk, end to end over one Library folder holding the dev library:
// the two films of `fixture/` and the two shows of `seriesFixture/`, side by
// side as the household keeps them.
//
// - Die Hard's video deleted is listed under _Missing_, taken out, put back
//   and imported by the next scan;
// - one Tidewater episode deleted is listed once, and taken out alone: the
//   show keeps the rest, and Harbor & Vine is untouched;
// - an empty `Heat/` is listed under _Off layout_, scan after scan.
//
// The runs are real: an on-disk library, a real `Media` over a sandbox
// managed directory, and the absent **Playback component**.

import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
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
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import { idleFrameFill } from '../../test-support/idleFrameFill/idleFrameFill';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { ImportProblem, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const DIE_HARD_VIDEO = join('Die Hard (1988)', 'Die.Hard.1988.1080p.mp4');
const TIDEWATER_S01E02 = join(
  'Tidewater (2018)',
  'Season 01',
  'Tidewater.S01E02.The.Crossing.mp4'
);

interface Sandbox {
  dir: string;
  storage: LibraryStorage;
  importer: Importer;
  library: StoredLibraryFolder;
}

/** The dev library, films and shows, in one listed Library folder. */
function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-missing-walk-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  mkdirSync(join(dir, 'shows'));
  const films = libraryFixture(join(dir, 'films'), 'library.csv').root;
  const shows = seriesFixture(join(dir, 'shows'), 'library.csv').root;
  cpSync(shows, films, { recursive: true });

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
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
    frameFill: idleFrameFill(),
  });
  return { dir, storage, importer, library: storage.addLibraryFolder(films) };
}

async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.library], false, 'link');
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = box.importer.current();
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** The one Problem of this kind and title; throws unless exactly one. */
function problemNamed(
  run: ImportRun,
  kind: ImportProblem['kind'],
  title: string
): ImportProblem {
  const found = run.problems.filter(
    (problem) => problem.kind === kind && problem.title === title
  );
  if (found.length !== 1) {
    throw new Error(
      `expected one ${kind} ${title}: ${JSON.stringify(run.problems)}`
    );
  }
  return found[0] as ImportProblem;
}

const kindsAndTitles = (run: ImportRun): string[] =>
  run.problems.map((problem) => `${problem.kind} ${problem.title}`);

const filmTitles = (box: Sandbox): string[] =>
  box.storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title);

function tidewaterTags(box: Sandbox): string[] {
  const show = box.storage
    .getSeriesHome()
    .series.find((series) => series.title === 'Tidewater');
  if (show === undefined) {
    throw new Error('Tidewater is not held');
  }
  return box.storage
    .listEpisodes(show.id)
    .map(
      (episode) =>
        `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`
    );
}

const showTitles = (box: Sandbox): string[] =>
  box.storage
    .getSeriesHome()
    .series.map((series) => series.title)
    .sort();

describe('createImporter: Log 66’s walk over the dev library', () => {
  it('lists, takes out, and imports again a film whose video was deleted', async () => {
    const box = sandbox();
    await scanOnce(box);
    expect(filmTitles(box)).toEqual(['Amelie', 'Die Hard']);
    const kept = join(box.dir, 'Die.Hard.kept.mp4');
    copyFileSync(join(box.library.path, DIE_HARD_VIDEO), kept);
    rmSync(join(box.library.path, DIE_HARD_VIDEO));

    const listed = await scanOnce(box);
    // Its folder still holds its art: listed once, Missing, not Off layout.
    expect(kindsAndTitles(listed)).toEqual(['missing Die Hard']);
    const dieHard = problemNamed(listed, 'missing', 'Die Hard');
    expect(dieHard.takeOut).toBe('Take out of library');
    expect(box.importer.takeOutMissing(dieHard.id)).toBe(true);
    expect(filmTitles(box)).toEqual(['Amelie']);

    copyFileSync(kept, join(box.library.path, DIE_HARD_VIDEO));
    const again = await scanOnce(box);

    expect(filmTitles(box)).toEqual(['Amelie', 'Die Hard']);
    expect(kindsAndTitles(again)).toEqual([]);
  });

  it('lists one gone Tidewater episode and takes it out alone', async () => {
    const box = sandbox();
    await scanOnce(box);
    expect(tidewaterTags(box)).toEqual(['S01E01', 'S01E02']);
    rmSync(join(box.library.path, TIDEWATER_S01E02));

    const listed = await scanOnce(box);
    expect(kindsAndTitles(listed)).toEqual(['missing Tidewater']);
    const tidewater = problemNamed(listed, 'missing', 'Tidewater');
    expect(tidewater.reason).toBe('S01E02 is no longer on disk.');
    expect(tidewater.takeOut).toBe('Take out 1 episode');

    expect(box.importer.takeOutMissing(tidewater.id)).toBe(true);

    expect(tidewaterTags(box)).toEqual(['S01E01']);
    expect(showTitles(box)).toEqual(['Harbor & Vine', 'Tidewater']);
    expect(filmTitles(box)).toEqual(['Amelie', 'Die Hard']);
    expect(kindsAndTitles(await scanOnce(box))).toEqual([]);
  });

  it('lists an empty Heat/ under Off layout, scan after scan', async () => {
    const box = sandbox();
    mkdirSync(join(box.library.path, 'Heat'));

    const first = await scanOnce(box);
    const heat = problemNamed(first, 'off-layout', 'Heat');
    expect(heat.reason).toBe('Holds no video or Season folder.');
    expect(heat.takeOut).toBeUndefined();
    expect(filmTitles(box)).toEqual(['Amelie', 'Die Hard']);
    expect(showTitles(box)).toEqual(['Harbor & Vine', 'Tidewater']);

    expect(kindsAndTitles(await scanOnce(box))).toEqual(['off-layout Heat']);
  });
});
