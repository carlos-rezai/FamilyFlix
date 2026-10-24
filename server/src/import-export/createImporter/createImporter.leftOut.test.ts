// @vitest-environment node
//
// 51 — Library audit, Phase 10: "a title taken out stays out" (issue #453).
//
// A **Folder scan** and a sheet import skip every **Left-out video** before
// any match, so a title deleted with its files kept does not come back:
//
// - a left-out film is neither imported nor a **Problem**;
// - a **Show folder** whose every video is left out is skipped whole, no
//   empty series made for it;
// - a Show folder with new videos beside left-out ones takes only the new;
// - each run logs one `info` **Log line**, _· Left out N videos you deleted
//   earlier_, counting the whole run, and none when nothing was left out.
//
// The runs are real: the fixtures copied into sandboxed Library folders, an
// on-disk library, a real `Media` over a sandbox managed directory, and the
// absent **Playback component**.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
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
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const DIE_HARD = 'Die.Hard.1988.1080p/Die.Hard.1988.1080p.mp4';
const AMELIE = 'Drama/Amelie (2001)/Amelie.mp4';
const HARBOR_PILOT =
  'Harbor & Vine (2021)/Season 01/Harbor.and.Vine.S01E01.Pilot.mp4';
const HARBOR_SECOND =
  'Harbor & Vine (2021)/Season 01/Harbor.and.Vine.S01E02.The.Night.Market.mp4';
const TIDEWATER_FIRST = 'Tidewater (2018)/Tidewater.S01E01.Low.Water.mp4';
const TIDEWATER_SECOND = 'Tidewater (2018)/Tidewater.S01E02.The.Crossing.mp4';

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  films: StoredLibraryFolder;
  shows: StoredLibraryFolder;
  /** One sheet naming the two films and the two shows. */
  sheet: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-left-out-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'films'));
  mkdirSync(join(dir, 'shows'));
  const films = libraryFixture(join(dir, 'films'), 'library.csv');
  const shows = seriesFixture(join(dir, 'shows'), 'library.csv');
  const sheet = join(dir, 'both.csv');
  const showRows = readFileSync(shows.sheet, 'utf8').split(/\r?\n/).slice(1);
  writeFileSync(
    sheet,
    `${readFileSync(films.sheet, 'utf8').trimEnd()}\n${showRows.join('\n')}`
  );
  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(
      media,
      fixedSlot(null),
      (id) =>
        storage.libraryFolders().find((folder) => folder.id === id)?.path ??
        null
    ),
  });
  return {
    storage,
    importer,
    sheet,
    films: storage.addLibraryFolder(films.root),
    shows: storage.addLibraryFolder(shows.root),
  };
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

/** One whole Link scan of both folders, then the run let go. */
async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.films, box.shows], false, 'link');
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** One whole Link sheet run over both folders, then the run let go. */
async function sheetOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.start(box.sheet, false, 'link');
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

const filmTitles = (storage: LibraryStorage): string[] =>
  storage
    .listMovies({ sort: 'a-z' })
    .map((movie) => movie.title)
    .sort();

const showTitles = (storage: LibraryStorage): string[] =>
  storage
    .getSeriesHome()
    .series.map((series) => series.title)
    .sort();

const episodeVideos = (storage: LibraryStorage, title: string): string[] => {
  const series = storage
    .getSeriesHome()
    .series.find((found) => found.title === title);
  if (series === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return storage
    .listEpisodes(series.id)
    .map((episode) => episode.videoPath)
    .sort();
};

const leftOutLines = (run: ImportRun) =>
  run.log.filter((line) => line.text.startsWith('· Left out'));

describe('createImporter.scan — left-out videos', () => {
  it('skips a left-out film: not imported and not a Problem', async () => {
    const box = sandbox();
    box.storage.leaveOut([{ folderId: box.films.id, videoPath: DIE_HARD }]);

    const run = await scanOnce(box);

    expect(filmTitles(box.storage)).toEqual(['Amelie']);
    expect(JSON.stringify(run.problems)).not.toContain('Die');
  });

  it('logs one info line for the whole run, counting every folder’s', async () => {
    const box = sandbox();
    box.storage.leaveOut([
      { folderId: box.films.id, videoPath: DIE_HARD },
      { folderId: box.shows.id, videoPath: TIDEWATER_FIRST },
    ]);

    const run = await scanOnce(box);

    expect(leftOutLines(run)).toEqual([
      expect.objectContaining({
        text: '· Left out 2 videos you deleted earlier',
        kind: 'info',
      }),
    ]);
  });

  it('logs no left-out line on a run with nothing left out, only on one with some', async () => {
    const box = sandbox();
    // The shows alone first, so the films are never held when left out.
    await box.importer.scan([box.shows], false, 'link');
    const quiet = await untilReview(box.importer);
    await box.importer.cancel();
    box.storage.leaveOut([
      { folderId: box.films.id, videoPath: DIE_HARD },
      { folderId: box.films.id, videoPath: AMELIE },
    ]);

    const run = await scanOnce(box);

    expect(leftOutLines(quiet)).toEqual([]);
    expect(leftOutLines(run).map((line) => line.text)).toEqual([
      '· Left out 2 videos you deleted earlier',
    ]);
  });

  it('skips a Show folder whose every video is left out, whole', async () => {
    const box = sandbox();
    box.storage.leaveOut([
      { folderId: box.shows.id, videoPath: HARBOR_PILOT },
      { folderId: box.shows.id, videoPath: HARBOR_SECOND },
    ]);

    const run = await scanOnce(box);

    expect(showTitles(box.storage)).toEqual(['Tidewater']);
    expect(JSON.stringify(run.problems)).not.toContain('Harbor');
    expect(leftOutLines(run).map((line) => line.text)).toEqual([
      '· Left out 2 videos you deleted earlier',
    ]);
  });

  it('takes only the new videos of a Show folder beside left-out ones', async () => {
    const box = sandbox();
    box.storage.leaveOut([
      { folderId: box.shows.id, videoPath: TIDEWATER_FIRST },
    ]);

    await scanOnce(box);

    expect(showTitles(box.storage)).toEqual(['Harbor & Vine', 'Tidewater']);
    expect(episodeVideos(box.storage, 'Tidewater')).toEqual([TIDEWATER_SECOND]);
  });
});

describe('createImporter.start — a sheet run skips left-out videos', () => {
  it('imports neither left-out film, and logs one line for the run', async () => {
    const box = sandbox();
    box.storage.leaveOut([
      { folderId: box.films.id, videoPath: DIE_HARD },
      { folderId: box.films.id, videoPath: AMELIE },
    ]);

    const run = await sheetOnce(box);

    expect(filmTitles(box.storage)).toEqual([]);
    expect(showTitles(box.storage)).toEqual(['Harbor & Vine', 'Tidewater']);
    expect(leftOutLines(run)).toEqual([
      expect.objectContaining({
        text: '· Left out 2 videos you deleted earlier',
        kind: 'info',
      }),
    ]);
  });

  it('skips an all-left-out Show folder, and takes the new videos beside left-out ones', async () => {
    const box = sandbox();
    box.storage.leaveOut([
      { folderId: box.shows.id, videoPath: HARBOR_PILOT },
      { folderId: box.shows.id, videoPath: HARBOR_SECOND },
      { folderId: box.shows.id, videoPath: TIDEWATER_FIRST },
    ]);

    await sheetOnce(box);

    expect(showTitles(box.storage)).toEqual(['Tidewater']);
    expect(episodeVideos(box.storage, 'Tidewater')).toEqual([TIDEWATER_SECOND]);
  });
});
