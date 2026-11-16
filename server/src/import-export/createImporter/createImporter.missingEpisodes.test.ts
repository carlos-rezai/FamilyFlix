// @vitest-environment node
//
// 66, Missing videos, Phase 3: "gone episodes are listed" (issue #636).
//
// The **Missing check** reaches each held show's episodes: every episode
// whose video `playback.videoFile` answers `missing` is gone, and a show with
// any gone episode files one `missing` **Problem** carrying its `seriesId`
// and one **Warning line**, however many episodes are gone:
//
// - the reason names the first three gone episodes' **Episode tags** in
//   season-and-episode order, then _and N more_, then _is_ or _are no longer
//   on disk._; a show with every episode gone reads _None of its N episodes'
//   videos are on disk._;
// - the warning line reads `⚠ <key> is missing N episode videos`;
// - an **Unreachable** show and a copied episode are never listed; a renamed
//   episode is listed, as there is no **Found again** for episodes.
//
// The runs are real: the series fixture copied into a sandboxed Library
// folder with Tidewater grown to seven episodes over two seasons, an on-disk
// library with a raw handle for the columns no shared type carries, a real
// `Media` over a sandbox managed directory, and the absent **Playback
// component**.

import { copyFileSync, mkdirSync, renameSync, rmSync } from 'node:fs';
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
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { ImportMode, ImportProblem, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const TIDEWATER = 'Tidewater (2018)';
const HARBOR = 'Harbor & Vine (2021)';

/** Tidewater's seven episodes, by tag: the fixture's two and five more. */
const TIDEWATER_FILES: Record<string, string> = {
  S01E01: 'Season 01/Tidewater.S01E01.Low.Water.mp4',
  S01E02: 'Season 01/Tidewater.S01E02.The.Crossing.mp4',
  S01E03: 'Season 01/Tidewater.S01E03.Slack.Tide.mp4',
  S01E04: 'Season 01/Tidewater.S01E04.Spring.Tide.mp4',
  S02E01: 'Season 02/Tidewater.S02E01.Thaw.mp4',
  S02E02: 'Season 02/Tidewater.S02E02.The.Long.Run.mp4',
  S02E03: 'Season 02/Tidewater.S02E03.Landfall.mp4',
};

const HARBOR_FILES: Record<string, string> = {
  S01E01: 'Season 01/Harbor.and.Vine.S01E01.Pilot.mp4',
  S01E02: 'Season 01/Harbor.and.Vine.S01E02.The.Night.Market.mp4',
};

interface Sandbox {
  dir: string;
  media: string;
  storage: LibraryStorage;
  db: SqliteDatabase;
  importer: Importer;
  /** The series fixture's Library folder, Tidewater grown to seven episodes. */
  shows: StoredLibraryFolder;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-missing-episodes-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'shows'));
  const { root } = seriesFixture(join(dir, 'shows'), 'library.csv');
  const tidewater = join(root, TIDEWATER);
  mkdirSync(join(tidewater, 'Season 02'));
  for (const [tag, file] of Object.entries(TIDEWATER_FILES)) {
    if (tag !== 'S01E01' && tag !== 'S01E02') {
      copyFileSync(
        join(tidewater, TIDEWATER_FILES.S01E01 ?? ''),
        join(tidewater, file)
      );
    }
  }

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
    media: createMedia(media),
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
    shows: storage.addLibraryFolder(root),
  };
}

/** A second listed Library folder holding one two-episode show, Seawall. */
function secondFolder(box: Sandbox): StoredLibraryFolder {
  const root = join(box.dir, 'more');
  const season = join(root, 'Seawall (2020)', 'Season 01');
  mkdirSync(season, { recursive: true });
  const source = join(box.shows.path, TIDEWATER, TIDEWATER_FILES.S01E01 ?? '');
  copyFileSync(source, join(season, 'Seawall.S01E01.Breakers.mp4'));
  copyFileSync(source, join(season, 'Seawall.S01E02.Groynes.mp4'));
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
  folders: StoredLibraryFolder[] = [box.shows],
  mode: ImportMode = 'link'
): Promise<ImportRun> {
  await box.importer.scan(folders, false, mode);
  return untilReview(box.importer);
}

const missingOf = (run: ImportRun): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === 'missing');

const missingTitles = (run: ImportRun): string[] =>
  missingOf(run)
    .map((problem) => problem.title)
    .sort();

/** The one `missing` Problem titled so; throws when there is not exactly one. */
function missingNamed(run: ImportRun, title: string): ImportProblem {
  const found = missingOf(run).filter((problem) => problem.title === title);
  if (found.length !== 1) {
    throw new Error(
      `expected one missing ${title}: ${JSON.stringify(run.problems)}`
    );
  }
  return found[0] as ImportProblem;
}

/** The held show of this title's id. */
function heldSeriesId(box: Sandbox, title: string): string {
  const show = box.storage
    .getSeriesHome()
    .series.find((series) => series.title === title);
  if (show === undefined) {
    throw new Error(`no held show titled ${title}`);
  }
  return show.id;
}

/** Delete these episodes' videos from Tidewater's Title folder. */
const deleteTidewater = (box: Sandbox, ...tags: string[]) => {
  for (const tag of tags) {
    rmSync(join(box.shows.path, TIDEWATER, TIDEWATER_FILES[tag] ?? ''));
  }
};

const deleteHarbor = (box: Sandbox, ...tags: string[]) => {
  for (const tag of tags) {
    rmSync(join(box.shows.path, HARBOR, HARBOR_FILES[tag] ?? ''));
  }
};

const warnings = (run: ImportRun, text: string) =>
  run.log.filter((line) => line.text === text);

describe('createImporter: the Missing check over gone episodes, the reason', () => {
  it('names one gone episode by its tag', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Tidewater');
    deleteTidewater(box, 'S01E02');

    const run = await scanOnce(box);

    expect(missingNamed(run, 'Tidewater')).toEqual(
      expect.objectContaining({
        kind: 'missing',
        title: 'Tidewater',
        reason: 'S01E02 is no longer on disk.',
        seriesId: id,
      })
    );
  });

  it('names three gone episodes in season-and-episode order', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteTidewater(box, 'S02E01', 'S01E03', 'S01E02');

    const run = await scanOnce(box);

    expect(missingNamed(run, 'Tidewater').reason).toBe(
      'S01E02, S01E03 and S02E01 are no longer on disk.'
    );
  });

  it('names the first three of five gone episodes, then how many more', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteTidewater(box, 'S02E03', 'S02E01', 'S01E03', 'S02E02', 'S01E02');

    const run = await scanOnce(box);

    expect(missingNamed(run, 'Tidewater').reason).toBe(
      'S01E02, S01E03, S02E01 and 2 more are no longer on disk.'
    );
  });

  it('reads none of its episodes when every one is gone', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Harbor & Vine');
    deleteHarbor(box, 'S01E01', 'S01E02');

    const run = await scanOnce(box);

    expect(missingNamed(run, 'Harbor & Vine')).toEqual(
      expect.objectContaining({
        kind: 'missing',
        title: 'Harbor & Vine',
        reason: "None of its 2 episodes' videos are on disk.",
        seriesId: id,
      })
    );
  });
});

describe('createImporter: the Missing check over gone episodes, one per show', () => {
  it('files one row and one warning line per show, however many are gone', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteTidewater(box, 'S01E02', 'S01E03', 'S02E01');
    deleteHarbor(box, 'S01E01', 'S01E02');

    const run = await scanOnce(box);

    expect(missingTitles(run)).toEqual(['Harbor & Vine', 'Tidewater']);
    expect(warnings(run, `⚠ ${TIDEWATER} is missing 3 episode videos`)).toEqual(
      [{ text: `⚠ ${TIDEWATER} is missing 3 episode videos`, kind: 'warning' }]
    );
    expect(warnings(run, `⚠ ${HARBOR} is missing 2 episode videos`)).toEqual([
      { text: `⚠ ${HARBOR} is missing 2 episode videos`, kind: 'warning' },
    ]);
    const last = run.log.filter((line) => line.kind === 'success').at(-1);
    expect(last?.text).toBe(
      `✓ Scan complete: 0 imported, ${run.problems.length} need attention.`
    );
  });
});

describe('createImporter: the Missing check over episodes it must not list', () => {
  it('does not list a show of an Unreachable folder', async () => {
    const box = sandbox();
    const more = secondFolder(box);
    await scanOnce(box, [box.shows, more]);
    // The drive is unplugged: the folder is listed but no longer reads.
    rmSync(more.path, { recursive: true, force: true });
    deleteTidewater(box, 'S01E02');

    const run = await scanOnce(box, [box.shows, more]);

    expect(missingTitles(run)).toEqual(['Tidewater']);
  });

  it('does not list a copied episode whose original left its folder', async () => {
    const box = sandbox();
    await scanOnce(box, [box.shows], 'copy');
    deleteTidewater(box, 'S01E02');
    // Harbor & Vine's S01E02 copy is gone as well as its original.
    const { video_path: harborCopy } = box.db
      .prepare(
        `SELECT e.video_path FROM episodes e JOIN series s ON s.id = e.series_id
         WHERE s.title = ? AND e.season_number = 1 AND e.episode_number = 2`
      )
      .get('Harbor & Vine') as { video_path: string };
    rmSync(join(box.media, harborCopy));
    deleteHarbor(box, 'S01E02');

    const run = await scanOnce(box, [box.shows], 'copy');

    expect(missingTitles(run)).toEqual(['Harbor & Vine']);
    expect(missingNamed(run, 'Harbor & Vine').reason).toBe(
      'S01E02 is no longer on disk.'
    );
  });

  it('lists a renamed episode, as no episode is Found again', async () => {
    const box = sandbox();
    await scanOnce(box);
    const season = join(box.shows.path, TIDEWATER, 'Season 01');
    renameSync(
      join(box.shows.path, TIDEWATER, TIDEWATER_FILES.S01E02 ?? ''),
      join(season, 'Tidewater.S01E02.mp4')
    );

    const run = await scanOnce(box);

    expect(missingTitles(run)).toEqual(['Tidewater']);
    expect(missingNamed(run, 'Tidewater').reason).toBe(
      'S01E02 is no longer on disk.'
    );
  });
});
