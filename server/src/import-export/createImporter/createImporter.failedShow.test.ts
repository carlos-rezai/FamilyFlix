// @vitest-environment node
//
// 42 — Review at scale, Slice 4: "one failed row per show" (issue #357).
//
// A show whose episode copies throw files **one** `failed` **Problem** titled
// with the show — not one per episode, which is how five real series ran the
// review to 1,400+ rows. Its reason is the count and the first error, its
// **Problem detail** lists the episodes that failed as `files.videos` (the
// `unplaced` precedent), and it carries the held series' `seriesId`, so
// _Resolve_ opens the **Series Resolve**. A film's `failed` is unchanged.
//
// The last suite is the guard on the rule the review stands on: **at most one
// Problem per kind per Source folder, Sheet row or Show folder**, over a
// generated tree of five shows × eight seasons × twenty episodes with every
// copy failing — by a Folder scan and by a sheet naming the five.
//
// Composed as the series suite is: a real `freshStorage`, a real `Media` over
// a sandbox managed directory with its `copyIn` failing on cue, and the absent
// **Playback component**.

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import type { LibraryStorage, StoredLibraryFolder } from '../../library';
import type { ImportProblem, ImportRun, Series } from '@/types';

const SHOW = 'Lighthouse Keepers (2019)';

const FILM_ROW =
  'Die Hard,1988,Action / Thriller,John McTiernan,"Bruce Willis, Alan Rickman",A New York cop takes on a tower full of thieves on Christmas Eve.,8,yes';
const SHOW_ROW =
  'Lighthouse Keepers,2019,Drama / Family,Mara Quinn,"Lena Ortiz, Tom Adeyemi",Two sisters keep the last manned light on the coast.,9,yes';
const HEAD = 'Title,Year,Genre,Director,Actors,Description,Rating,Watched';

/** The fixture's film header — an `mvhd` saying 132 minutes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

const FILM_VIDEO = 'Die.Hard.1988.1080p.mp4';

/** Season 01's four episodes, in name order. */
const E01 = 'Lighthouse.Keepers.S01E01.First.Light.mp4';
const E02 = 'Lighthouse.Keepers.S01E02.The.Storm.mp4';
const E03 = 'Lighthouse.Keepers.S01E03.Fog.Bank.mp4';
const E04 = 'Lighthouse.Keepers.S01E04.Spring.Tide.mp4';

/** Which source files a copy throws on, and the error each throws. */
type Failures = Record<string, string>;

function failing(failures: Failures | 'all'): (real: Media) => Media {
  return (real) => ({
    ...real,
    copyIn: async (...args) => {
      if (failures === 'all') {
        throw new Error('no space left on device');
      }
      const message = failures[basename(args[1])];
      if (message !== undefined) {
        throw new Error(message);
      }
      return real.copyIn(...args);
    },
  });
}

/**
 * Die Hard beside the show's Season 01, a sheet naming both, and the importer
 * over a fresh library whose copies fail on cue.
 */
function sandbox(
  episodes: string[],
  failures: Failures
): {
  storage: LibraryStorage;
  importer: Importer;
  root: string;
  sheet: string;
} {
  const dir = sandboxRoot('familyflix-import-failed-show-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const root = join(dir, 'root');
  cpSync(
    join(LIBRARY_FIXTURE, 'root', 'Die.Hard.1988.1080p'),
    join(root, 'Die.Hard.1988.1080p'),
    { recursive: true }
  );
  const season = join(root, SHOW, 'Season 01');
  mkdirSync(season, { recursive: true });
  for (const episode of episodes) {
    cpSync(HEADER, join(season, episode));
  }

  const sheet = join(dir, 'library.csv');
  writeFileSync(sheet, [HEAD, FILM_ROW, SHOW_ROW].join('\n'));

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: failing(failures)(createMedia(media)),
    playback: createPlayback(media, fixedSlot(null), () => null),
  });
  storage.addLibraryFolder(root);
  return { storage, importer, root, sheet };
}

/** The snapshot once the run has reached review — or a failure if it never does. */
async function untilReview(
  importer: Importer,
  within = 10_000
): Promise<ImportRun> {
  const deadline = Date.now() + within;
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

const failedOf = (run: ImportRun): ImportProblem[] =>
  run.problems.filter((problem) => problem.kind === 'failed');

const allSeries = (storage: LibraryStorage): Series[] =>
  storage.getSeriesHome().series;

const NO_SPACE = 'no space left on device';

describe('createImporter — a show’s failed copies are one failed row', () => {
  it('files one failed Problem naming the show, its reason the count and the first error', async () => {
    const { importer, sheet } = sandbox([E01, E02, E03], {
      [E01]: NO_SPACE,
      [E02]: NO_SPACE,
      [E03]: NO_SPACE,
    });

    await importer.start(sheet);
    const run = await untilReview(importer);

    expect(run.problems).toEqual([
      {
        id: expect.any(String),
        kind: 'failed',
        title: 'Lighthouse Keepers',
        reason: "3 episodes couldn't be copied: no space left on device.",
      },
    ]);
  });

  it('reads the first error into the reason when the episodes failed differently', async () => {
    const { importer, sheet } = sandbox([E01, E02, E03], {
      [E01]: NO_SPACE,
      [E02]: 'EBUSY: resource busy or locked',
    });

    await importer.start(sheet);
    const run = await untilReview(importer);

    expect(failedOf(run)).toHaveLength(1);
    expect(failedOf(run)[0].reason).toBe(
      "2 episodes couldn't be copied: no space left on device."
    );
  });

  it('lists the failed episodes on the Problem detail, as absolute paths in name order', async () => {
    const { importer, root, sheet } = sandbox([E01, E02, E03, E04], {
      [E01]: NO_SPACE,
      [E03]: NO_SPACE,
      [E04]: NO_SPACE,
    });

    await importer.start(sheet);
    const [problem] = failedOf(await untilReview(importer));
    const detail = importer.problem(problem.id);

    expect(detail?.files.videos).toEqual(
      [E01, E03, E04].map((video) => join(root, SHOW, 'Season 01', video))
    );
    expect(detail?.folder).toBe(join(root, SHOW));
    expect(detail?.row.title).toBe('Lighthouse Keepers');
  });

  it('names the series the run holds for the show, so Resolve joins it', async () => {
    const { storage, importer, sheet } = sandbox([E01, E02, E03, E04], {
      [E02]: NO_SPACE,
      [E03]: NO_SPACE,
      [E04]: NO_SPACE,
    });

    await importer.start(sheet);
    const [problem] = failedOf(await untilReview(importer));

    const [series] = allSeries(storage);
    expect(series).toBeDefined();
    expect(problem.seriesId).toBe(series.id);
    expect(problem.reason).toBe(
      "3 episodes couldn't be copied: no space left on device."
    );
  });

  it('names no series when every episode failed and none is held', async () => {
    const { storage, importer, sheet } = sandbox([E01, E02, E03], {
      [E01]: NO_SPACE,
      [E02]: NO_SPACE,
      [E03]: NO_SPACE,
    });

    await importer.start(sheet);
    const failed = failedOf(await untilReview(importer));

    expect(failed).toHaveLength(1);
    const [problem] = failed;

    expect(allSeries(storage)).toEqual([]);
    expect(problem.seriesId).toBeUndefined();
  });

  it('lets Skip dismiss the show’s failed Problem', async () => {
    const { importer, sheet } = sandbox([E01, E02, E03], {
      [E01]: NO_SPACE,
      [E02]: NO_SPACE,
      [E03]: NO_SPACE,
    });

    await importer.start(sheet);
    const [problem] = failedOf(await untilReview(importer));

    expect(importer.dismiss(problem.id)).toBe(true);
    expect(importer.current()?.problems).toEqual([]);
  });

  it('leaves a film’s failed row as it was, beside the show’s', async () => {
    const { importer, sheet } = sandbox([E01, E02], {
      [FILM_VIDEO]: 'EBUSY: resource busy or locked',
      [E01]: NO_SPACE,
      [E02]: NO_SPACE,
    });

    await importer.start(sheet);
    const run = await untilReview(importer);

    expect(failedOf(run)).toHaveLength(2);
    expect(failedOf(run)).toContainEqual({
      id: expect.any(String),
      kind: 'failed',
      title: 'Die Hard',
      reason: "Couldn't copy the video file: EBUSY: resource busy or locked.",
    });
    const film = failedOf(run).find((problem) => problem.title === 'Die Hard');
    expect(film?.seriesId).toBeUndefined();
  });
});

/**
 * The guard: five shows × eight seasons × twenty episodes, every copy
 * failing. Each Problem is keyed by its kind and its source — the Source or
 * Show folder its detail names, else its Sheet row's title — and no key may
 * be filed twice.
 */
describe('createImporter — at most one Problem per kind per source', () => {
  const SHOWS = ['Aurora', 'Brightwater', 'Cinder Bay', 'Driftwood', 'Ember'];
  const SEASONS = 8;
  const EPISODES_PER_SEASON = 20;

  function generatedTree(): {
    importer: Importer;
    folder: StoredLibraryFolder;
    sheet: string;
  } {
    const dir = sandboxRoot('familyflix-import-guard-');
    const media = join(dir, 'media');
    mkdirSync(media);
    const root = join(dir, 'root');
    for (const show of SHOWS) {
      for (let season = 1; season <= SEASONS; season += 1) {
        const ss = String(season).padStart(2, '0');
        const at = join(root, show, `Season ${ss}`);
        mkdirSync(at, { recursive: true });
        for (let episode = 1; episode <= EPISODES_PER_SEASON; episode += 1) {
          const ee = String(episode).padStart(2, '0');
          writeFileSync(join(at, `${show}.S${ss}E${ee}.mp4`), '');
        }
      }
    }
    const sheet = join(dir, 'library.csv');
    writeFileSync(
      sheet,
      [HEAD, ...SHOWS.map((show) => `${show},2020,Drama,,,,,`)].join('\n')
    );

    const storage = freshStorage();
    const importer = createImporter({
      storage,
      media: failing('all')(createMedia(media)),
      playback: createPlayback(media, fixedSlot(null), () => null),
    });
    const folder = storage.addLibraryFolder(root);
    return { importer, folder, sheet };
  }

  /** Every kind-and-source key filed more than once. */
  function filedTwice(importer: Importer, run: ImportRun): string[] {
    const seen = new Map<string, number>();
    for (const problem of run.problems) {
      const detail = importer.problem(problem.id);
      const source =
        detail?.folder ?? `row:${detail?.row.title ?? problem.title}`;
      const key = `${problem.kind} · ${source}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    return [...seen].filter(([, count]) => count > 1).map(([key]) => key);
  }

  it('holds over a Folder scan of the generated tree', async () => {
    const { importer, folder } = generatedTree();

    await importer.scan([folder]);
    const run = await untilReview(importer, 60_000);

    expect(filedTwice(importer, run)).toEqual([]);
    expect(
      failedOf(run)
        .map((problem) => problem.title)
        .sort()
    ).toEqual(SHOWS);
  }, 90_000);

  it('holds over a sheet naming every show of the generated tree', async () => {
    const { importer, sheet } = generatedTree();

    await importer.start(sheet);
    const run = await untilReview(importer, 60_000);

    expect(filedTwice(importer, run)).toEqual([]);
    expect(
      failedOf(run)
        .map((problem) => problem.title)
        .sort()
    ).toEqual(SHOWS);
    expect(failedOf(run)[0].reason).toBe(
      "160 episodes couldn't be copied: no space left on device."
    );
  }, 90_000);
});
