// @vitest-environment node
//
// 66, Missing videos, Phase 3: "take out a show or its gone episodes"
// (issue #637).
//
// `takeOutMissing(id)` reaches shows. The `missing` Problem's `takeOut` reads
// _Take out of library_ when every episode is gone, else _Take out N
// episodes_ or _Take out 1 episode_. A press:
//
// - with every episode gone, takes the show out as the series Delete does;
// - otherwise takes out only the episodes the check found, checked again at
//   press time, so an episode whose file came back is kept. The rows go
//   through `removeEpisodes`, and the managed files no row points at any more
//   are unlinked; the show keeps the rest, its art and its watch history;
// - records no **Left-out video**, so a put-back episode is imported by the
//   next scan.
//
// The runs are real: the series fixture copied into a sandboxed Library
// folder with Tidewater grown to four episodes, an on-disk library, a real
// `Media` over a sandbox managed directory, and the absent **Playback
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
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import { idleLayoutFill } from '../../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../../test-support/idleLibrarySheet/idleLibrarySheet';
import type { Episode, ImportProblem, ImportRun } from '@/types';

// Registered after the helpers' own hooks, so it runs first: Windows will not
// remove a sandbox holding an open database file.
afterEach(closeTracked);

const TIDEWATER = 'Tidewater (2018)';
const HARBOR = 'Harbor & Vine (2021)';

/** Tidewater's four episodes, by tag: the fixture's two and two more. */
const TIDEWATER_FILES: Record<string, string> = {
  S01E01: 'Season 01/Tidewater.S01E01.Low.Water.mp4',
  S01E02: 'Season 01/Tidewater.S01E02.The.Crossing.mp4',
  S01E03: 'Season 01/Tidewater.S01E03.Slack.Tide.mp4',
  S01E04: 'Season 01/Tidewater.S01E04.Spring.Tide.mp4',
};

const HARBOR_FILES: Record<string, string> = {
  S01E01: 'Season 01/Harbor.and.Vine.S01E01.Pilot.mp4',
  S01E02: 'Season 01/Harbor.and.Vine.S01E02.The.Night.Market.mp4',
};

interface Sandbox {
  dir: string;
  media: string;
  storage: LibraryStorage;
  importer: Importer;
  shows: StoredLibraryFolder;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-take-out-episodes-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'shows'));
  const { root } = seriesFixture(join(dir, 'shows'), 'library.csv');
  const tidewater = join(root, TIDEWATER);
  for (const tag of ['S01E03', 'S01E04']) {
    copyFileSync(
      join(tidewater, TIDEWATER_FILES.S01E01 ?? ''),
      join(tidewater, TIDEWATER_FILES[tag] ?? '')
    );
  }

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
  });
  return {
    dir,
    media,
    storage,
    importer,
    shows: storage.addLibraryFolder(root),
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

async function scanOnce(box: Sandbox): Promise<ImportRun> {
  await box.importer.scan([box.shows], false, 'link');
  return untilReview(box.importer);
}

/** The one `missing` Problem titled so; throws when there is not exactly one. */
function missingNamed(run: ImportRun, title: string): ImportProblem {
  const found = run.problems.filter(
    (problem) => problem.kind === 'missing' && problem.title === title
  );
  if (found.length !== 1) {
    throw new Error(
      `expected one missing ${title}: ${JSON.stringify(run.problems)}`
    );
  }
  return found[0] as ImportProblem;
}

function heldSeriesId(box: Sandbox, title: string): string {
  const show = box.storage
    .getSeriesHome()
    .series.find((series) => series.title === title);
  if (show === undefined) {
    throw new Error(`no held show titled ${title}`);
  }
  return show.id;
}

const tagOf = (episode: Episode): string =>
  `S${String(episode.season).padStart(2, '0')}E${String(episode.number).padStart(2, '0')}`;

const tagsOf = (box: Sandbox, seriesId: string): string[] =>
  box.storage.listEpisodes(seriesId).map(tagOf);

function episodeOf(box: Sandbox, seriesId: string, tag: string): Episode {
  const episode = box.storage
    .listEpisodes(seriesId)
    .find((each) => tagOf(each) === tag);
  if (episode === undefined) {
    throw new Error(`no ${tag} held`);
  }
  return episode;
}

const tidewaterVideo = (box: Sandbox, tag: string) =>
  join(box.shows.path, TIDEWATER, TIDEWATER_FILES[tag] ?? '');

const deleteTidewater = (box: Sandbox, ...tags: string[]) => {
  for (const tag of tags) {
    rmSync(tidewaterVideo(box, tag));
  }
};

const deleteHarbor = (box: Sandbox, ...tags: string[]) => {
  for (const tag of tags) {
    rmSync(join(box.shows.path, HARBOR, HARBOR_FILES[tag] ?? ''));
  }
};

const problemIds = (importer: Importer): string[] =>
  (importer.current()?.problems ?? []).map((problem) => problem.id);

describe('createImporter: a missing show’s Take out wording', () => {
  it('reads Take out 1 episode for one gone episode', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteTidewater(box, 'S01E02');

    const run = await scanOnce(box);

    expect(missingNamed(run, 'Tidewater').takeOut).toBe('Take out 1 episode');
  });

  it('reads Take out N episodes for several gone episodes', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteTidewater(box, 'S01E02', 'S01E03', 'S01E04');

    const run = await scanOnce(box);

    expect(missingNamed(run, 'Tidewater').takeOut).toBe('Take out 3 episodes');
  });

  it('reads Take out of library when every episode is gone', async () => {
    const box = sandbox();
    await scanOnce(box);
    deleteHarbor(box, 'S01E01', 'S01E02');

    const run = await scanOnce(box);

    expect(missingNamed(run, 'Harbor & Vine').takeOut).toBe(
      'Take out of library'
    );
  });
});

describe('createImporter: takeOutMissing on a show with some episodes gone', () => {
  it('answers true, takes the Problem off and only the gone episodes out', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Tidewater');
    deleteTidewater(box, 'S01E02', 'S01E04');
    const problem = missingNamed(await scanOnce(box), 'Tidewater');

    expect(box.importer.takeOutMissing(problem.id)).toBe(true);

    expect(problemIds(box.importer)).not.toContain(problem.id);
    expect(tagsOf(box, id)).toEqual(['S01E01', 'S01E03']);
    expect(heldSeriesId(box, 'Harbor & Vine')).toEqual(expect.any(String));
  });

  it('keeps the show’s art and the kept episodes’ watch history', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Tidewater');
    const pilot = episodeOf(box, id, 'S01E01');
    box.storage.setEpisodeWatched(pilot.id, true);
    box.storage.setEpisodeResumePosition(episodeOf(box, id, 'S01E03').id, 300);
    const seasonPoster =
      box.storage.getSeriesDetail(id)?.seasons[0]?.posterPath ?? null;
    expect(seasonPoster).not.toBeNull();
    deleteTidewater(box, 'S01E02');
    const problem = missingNamed(await scanOnce(box), 'Tidewater');

    expect(box.importer.takeOutMissing(problem.id)).toBe(true);

    expect(tagsOf(box, id)).toEqual(['S01E01', 'S01E03', 'S01E04']);
    expect(episodeOf(box, id, 'S01E01').watched).toBe(true);
    expect(episodeOf(box, id, 'S01E03').resumePositionSeconds).toBe(300);
    // Pilot's still and track are still held, and still on disk.
    const kept = episodeOf(box, id, 'S01E01');
    expect(kept.stillPath).toBe(pilot.stillPath);
    expect(kept.subtitles).toEqual(pilot.subtitles);
    for (const path of [
      kept.stillPath ?? '',
      ...kept.subtitles.map((track) => track.path),
    ]) {
      expect(existsSync(join(box.media, path))).toBe(true);
    }
    // The Season poster is held, and on disk.
    expect(box.storage.getSeriesDetail(id)?.seasons[0]?.posterPath).toBe(
      seasonPoster
    );
    expect(existsSync(join(box.media, seasonPoster ?? ''))).toBe(true);
  });

  it('unlinks the managed files of a taken-out episode', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Tidewater');
    const pilot = episodeOf(box, id, 'S01E01');
    const managed = [
      pilot.stillPath ?? '',
      ...pilot.subtitles.map((track) => track.path),
    ];
    expect(managed.filter((path) => path !== '')).toHaveLength(2);
    for (const path of managed) {
      expect(existsSync(join(box.media, path))).toBe(true);
    }
    deleteTidewater(box, 'S01E01');
    const problem = missingNamed(await scanOnce(box), 'Tidewater');

    box.importer.takeOutMissing(problem.id);

    expect(tagsOf(box, id)).toEqual(['S01E02', 'S01E03', 'S01E04']);
    for (const path of managed) {
      expect(existsSync(join(box.media, path))).toBe(false);
    }
  });

  it('keeps an episode whose file came back before the press', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Tidewater');
    const video = tidewaterVideo(box, 'S01E03');
    const aside = join(box.dir, 'S01E03.mp4');
    renameSync(video, aside);
    deleteTidewater(box, 'S01E02');
    const problem = missingNamed(await scanOnce(box), 'Tidewater');
    expect(problem.takeOut).toBe('Take out 2 episodes');

    renameSync(aside, video);
    expect(box.importer.takeOutMissing(problem.id)).toBe(true);

    expect(tagsOf(box, id)).toEqual(['S01E01', 'S01E03', 'S01E04']);
  });

  it('records no Left-out video, and the next scan imports a put-back episode', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Tidewater');
    const video = tidewaterVideo(box, 'S01E02');
    const aside = join(box.dir, 'S01E02.mp4');
    renameSync(video, aside);
    const problem = missingNamed(await scanOnce(box), 'Tidewater');
    expect(box.importer.takeOutMissing(problem.id)).toBe(true);
    expect(box.storage.leftOut(box.shows.id).size).toBe(0);
    expect(tagsOf(box, id)).toEqual(['S01E01', 'S01E03', 'S01E04']);

    renameSync(aside, video);
    const next = await scanOnce(box);

    expect(next.problems.filter((each) => each.kind === 'missing')).toEqual([]);
    expect(tagsOf(box, heldSeriesId(box, 'Tidewater'))).toEqual([
      'S01E01',
      'S01E02',
      'S01E03',
      'S01E04',
    ]);
  });
});

describe('createImporter: takeOutMissing on a show with every episode gone', () => {
  it('answers true and takes the show out of the library, and its Media folder', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Harbor & Vine');
    const folder = box.storage.mediaFolderOf('series', id);
    expect(folder).not.toBeNull();
    expect(existsSync(join(box.media, folder ?? ''))).toBe(true);
    deleteHarbor(box, 'S01E01', 'S01E02');
    const problem = missingNamed(await scanOnce(box), 'Harbor & Vine');

    expect(box.importer.takeOutMissing(problem.id)).toBe(true);

    expect(problemIds(box.importer)).not.toContain(problem.id);
    expect(box.storage.getSeriesDetail(id)).toBeNull();
    expect(
      box.storage.getSeriesHome().series.map((series) => series.title)
    ).toEqual(['Tidewater']);
    expect(existsSync(join(box.media, folder ?? ''))).toBe(false);
    expect(tagsOf(box, heldSeriesId(box, 'Tidewater'))).toHaveLength(4);
  });

  it('records no Left-out video, and the next scan imports the put-back show', async () => {
    const box = sandbox();
    await scanOnce(box);
    const aside = join(box.dir, 'harbor');
    mkdirSync(aside);
    for (const file of Object.values(HARBOR_FILES)) {
      renameSync(
        join(box.shows.path, HARBOR, file),
        join(aside, file.replace('Season 01/', ''))
      );
    }
    const problem = missingNamed(await scanOnce(box), 'Harbor & Vine');
    expect(box.importer.takeOutMissing(problem.id)).toBe(true);
    expect(box.storage.leftOut(box.shows.id).size).toBe(0);

    for (const file of Object.values(HARBOR_FILES)) {
      renameSync(
        join(aside, file.replace('Season 01/', '')),
        join(box.shows.path, HARBOR, file)
      );
    }
    await scanOnce(box);

    expect(tagsOf(box, heldSeriesId(box, 'Harbor & Vine'))).toEqual([
      'S01E01',
      'S01E02',
    ]);
  });

  it('answers true and only takes the Problem off for a show already deleted elsewhere', async () => {
    const box = sandbox();
    await scanOnce(box);
    const id = heldSeriesId(box, 'Tidewater');
    deleteTidewater(box, 'S01E02');
    const problem = missingNamed(await scanOnce(box), 'Tidewater');
    box.storage.deleteSeries(id);

    expect(box.importer.takeOutMissing(problem.id)).toBe(true);

    expect(problemIds(box.importer)).not.toContain(problem.id);
    expect(heldSeriesId(box, 'Harbor & Vine')).toEqual(expect.any(String));
  });
});
