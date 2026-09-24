// @vitest-environment node
//
// 22 — Series (TV), Phase 1: "a Season-folder show imports as one series"
// (issue #189).
//
// The importer's series slice, beside its movie suite rather than inside it —
// that file is past two thousand lines, and the routes' split into
// `routes.import.test.ts` and friends is the precedent. Composed the same way:
// a real `freshStorage`, a real `Media` over a sandbox managed directory and
// the absent **Playback component**.
//
// A **Library root** holding a film beside a **Show folder** whose videos sit
// in **Season folders** — `Season 01/` and `Season 2/` — is imported over a
// sheet naming both. What is asserted is what the run leaves behind and what
// it says on the way:
//
// - the show is one **Series**, taking the matched row's title, year, genres,
//   synopsis, rating and cast, with its _Director_ as the creator and its
//   _Status_ not applied;
// - its **Episodes** are numbered — the season off the folder, the episode and
//   title off the **Episode tag** — and copied into one **Series folder**
//   reserved from the title and first year, under `season-NN/`, each with its
//   runtime derived from the copied bytes;
// - the film beside it imports exactly as before, and the show is not a movie;
// - each episode is one item on the bar, reading `Show · SnnEnn` as the
//   current item and in its `success` line.
//
// The root is built here rather than taken from the checked-in fixture, so the
// counts below do not move when the fixture does. The episode videos are
// copies of the fixture's Die Hard header, so each derives 132 minutes. The
// last suite is the series fixture's own — a checked-in sheet and root of
// their own beside the movie fixture, so the movie suites' counts over the
// two-film library never move — and a dev library filled from it has a
// series on the tab.

import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import { createPlayback } from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { heldCopy } from '../../test-support/heldCopy/heldCopy';
import { LIBRARY_FIXTURE } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type { LibraryStorage } from '../../library';
import type { Episode, ImportRun, LogLine, Series } from '@/types';

const SHOW = 'Lighthouse Keepers (2019)';

/** The three episode videos, by the folder each sits in. */
const EPISODES = {
  'Season 01': [
    'Lighthouse.Keepers.S01E01.First.Light.1080p.mp4',
    'Lighthouse.Keepers.S01E02.The.Storm.1080p.x264.mp4',
  ],
  'Season 2': ['Lighthouse Keepers 2x01 Spring Tide.mp4'],
} as const;

const SHEET = [
  'Title,Year,Genre,Director,Actors,Description,Rating,Watched',
  'Die Hard,1988,Action / Thriller,John McTiernan,"Bruce Willis, Alan Rickman",A New York cop takes on a tower full of thieves on Christmas Eve.,8,yes',
  'Lighthouse Keepers,2019,Drama / Family,Mara Quinn,"Lena Ortiz, Tom Adeyemi",Two sisters keep the last manned light on the coast.,9,yes',
].join('\n');

/** The fixture's film header — an `mvhd` saying 132 minutes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

/**
 * A library root holding Die Hard's folder beside the show, a sheet naming
 * both, and the importer composed over a fresh library and managed directory.
 */
function sandbox({
  media: mediaSeam = (real) => real,
}: { media?: (real: Media) => Media } = {}): {
  storage: LibraryStorage;
  importer: Importer;
  media: string;
  root: string;
  sheet: string;
} {
  const dir = sandboxRoot('familyflix-import-series-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const root = join(dir, 'root');
  cpSync(
    join(LIBRARY_FIXTURE, 'root', 'Die.Hard.1988.1080p'),
    join(root, 'Die.Hard.1988.1080p'),
    { recursive: true }
  );
  for (const [season, videos] of Object.entries(EPISODES)) {
    const at = join(root, SHOW, season);
    mkdirSync(at, { recursive: true });
    for (const video of videos) {
      cpSync(HEADER, join(at, video));
    }
  }

  const sheet = join(dir, 'library.csv');
  writeFileSync(sheet, SHEET);

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: mediaSeam(createMedia(media)),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return { storage, importer, media, root, sheet };
}

/** The snapshot once the run has reached review — or a failure if it never does. */
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

/** Every series the library holds. */
const allSeries = (storage: LibraryStorage): Series[] =>
  storage.getSeriesHome().series;

/** The one series the run wrote, or a failure naming what it found. */
function theSeries(storage: LibraryStorage): Series {
  const series = allSeries(storage);
  if (series.length !== 1) {
    throw new Error(`expected one series, found ${JSON.stringify(series)}`);
  }
  return series[0];
}

/** A series' episodes in season, then episode order. */
const episodesOf = (storage: LibraryStorage, series: Series): Episode[] =>
  storage.listEpisodes(series.id);

/**
 * The held copy's arrival — or a failure as soon as the run reaches review
 * without ever asking for that file, rather than a twenty-second timeout.
 */
async function reachedOrFinished(
  reached: Promise<void>,
  importer: Importer
): Promise<void> {
  await Promise.race([
    reached,
    untilReview(importer).then(() => {
      throw new Error('the run reached review without copying the held file');
    }),
  ]);
}

const linesMatching = (run: ImportRun, pattern: RegExp): LogLine[] =>
  run.log.filter((line) => pattern.test(line.text));

describe('createImporter — a Season-folder show becomes one series', () => {
  it('writes the show as one series', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(allSeries(storage).map((series) => series.title)).toEqual([
      'Lighthouse Keepers',
    ]);
  });

  it('takes the row’s metadata, with its Director as the creator', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    const series = theSeries(storage);
    expect(series).toMatchObject({
      title: 'Lighthouse Keepers',
      year: 2019,
      creator: 'Mara Quinn',
      cast: ['Lena Ortiz', 'Tom Adeyemi'],
      synopsis: 'Two sisters keep the last manned light on the coast.',
      rating: 9,
      tmdbId: null,
    });
    expect(series.genres.map((genre) => genre.name).sort()).toEqual([
      'Drama',
      'Family',
    ]);
  });

  it('numbers its episodes: the season off the folder, the episode and title off the tag', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(
      episodesOf(storage, theSeries(storage)).map((episode) => [
        episode.season,
        episode.number,
        episode.title,
      ])
    ).toEqual([
      [1, 1, 'First Light'],
      [1, 2, 'The Storm'],
      [2, 1, 'Spring Tide'],
    ]);
  });

  it('does not apply the row’s Status — every episode starts unwatched', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    for (const episode of episodesOf(storage, theSeries(storage))) {
      expect(episode).toMatchObject({
        watched: false,
        resumePositionSeconds: 0,
        status: 'unwatched',
      });
    }
  });

  it('copies each episode into its own Series folder, under season-NN/', async () => {
    const { storage, importer, media, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    const episodes = episodesOf(storage, theSeries(storage));
    expect(episodes.map((episode) => episode.videoPath)).toEqual([
      'lighthouse-keepers-2019/season-01/Lighthouse.Keepers.S01E01.First.Light.1080p.mp4',
      'lighthouse-keepers-2019/season-01/Lighthouse.Keepers.S01E02.The.Storm.1080p.x264.mp4',
      'lighthouse-keepers-2019/season-02/Lighthouse Keepers 2x01 Spring Tide.mp4',
    ]);

    // Every stored path resolves to a file with the source's own bytes.
    const sources = [
      join(root, SHOW, 'Season 01', EPISODES['Season 01'][0]),
      join(root, SHOW, 'Season 01', EPISODES['Season 01'][1]),
      join(root, SHOW, 'Season 2', EPISODES['Season 2'][0]),
    ];
    episodes.forEach((episode, index) => {
      expect(readFileSync(join(media, episode.videoPath))).toEqual(
        readFileSync(sources[index])
      );
    });
  });

  it('derives each episode’s runtime from the copied video', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(
      episodesOf(storage, theSeries(storage)).map(
        (episode) => episode.runtimeMinutes
      )
    ).toEqual([132, 132, 132]);
  });

  it('imports the film beside it exactly as before, and the show is not a movie', async () => {
    const { storage, importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    await untilReview(importer);

    const movies = storage.listMovies({ sort: 'a-z' });
    expect(movies.map((movie) => movie.title)).toEqual(['Die Hard']);
    expect(movies[0]).toMatchObject({
      year: 1988,
      director: 'John McTiernan',
      videoPath: 'die-hard-1988/Die.Hard.1988.1080p.mp4',
      runtimeMinutes: 132,
      watched: true,
    });
  });
});

describe('createImporter — each episode is one item on the bar', () => {
  it('counts the film and every episode: four of four done', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run).toMatchObject({ total: 4, done: 4, problems: [] });
  });

  it('names the episode being copied as Series · SnnEnn under currentItem', async () => {
    const hold = heldCopy(EPISODES['Season 01'][1]);
    const { importer, root, sheet } = sandbox({ media: hold.seam });
    await importer.start(sheet, root);
    await reachedOrFinished(hold.reached, importer);

    expect(importer.current()?.currentItem).toBe('Lighthouse Keepers · S01E02');

    hold.release();
    await untilReview(importer);
  });

  it('has advanced the bar past the earlier episodes by the time the last one copies', async () => {
    const hold = heldCopy(EPISODES['Season 2'][0]);
    const { importer, root, sheet } = sandbox({ media: hold.seam });
    await importer.start(sheet, root);
    await reachedOrFinished(hold.reached, importer);

    const run = importer.current();
    expect(run?.total).toBe(4);
    expect(run?.done).toBeGreaterThanOrEqual(2);
    expect(run?.done).toBeLessThan(4);

    hold.release();
    await untilReview(importer);
  });

  it('logs one success line per episode, reading Series · SnnEnn', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const episodes = linesMatching(run, /^✓ Imported\s+Lighthouse Keepers/);
    expect(episodes.map((line) => line.kind)).toEqual([
      'success',
      'success',
      'success',
    ]);
    expect(episodes.map((line) => line.text)).toEqual([
      expect.stringMatching(/^✓ Imported\s+Lighthouse Keepers · S01E01$/),
      expect.stringMatching(/^✓ Imported\s+Lighthouse Keepers · S01E02$/),
      expect.stringMatching(/^✓ Imported\s+Lighthouse Keepers · S02E01$/),
    ]);
  });

  it('keeps the film’s own success line as it was', async () => {
    const { importer, root, sheet } = sandbox();

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(linesMatching(run, /^✓ Imported\s+Die Hard$/)).toHaveLength(1);
  });
});

describe('createImporter — the checked-in series fixture', () => {
  /** The fixture imported from one of its two sheets, over a fresh library. */
  async function importFixture(
    spelling: 'library.xlsx' | 'library.csv'
  ): Promise<{ storage: LibraryStorage; root: string }> {
    const dir = sandboxRoot('familyflix-import-fixture-');
    const media = join(dir, 'media');
    mkdirSync(media);
    const { root, sheet } = seriesFixture(dir, spelling);
    const storage = freshStorage();
    const importer = createImporter({
      storage,
      media: createMedia(media),
      playback: createPlayback(media, fixedSlot(null)),
    });

    await importer.start(sheet, root);
    await untilReview(importer);
    return { storage, root };
  }

  it.each([['library.xlsx' as const], ['library.csv' as const]])(
    'imports Harbor & Vine as one series from %s',
    async (spelling) => {
      const { storage } = await importFixture(spelling);

      const series = allSeries(storage).find(
        (held) => held.title === 'Harbor & Vine'
      );
      if (series === undefined) {
        throw new Error('the fixture imported no Harbor & Vine');
      }
      expect(series.creator).not.toBeNull();

      const episodes = episodesOf(storage, series);
      expect(episodes.length).toBeGreaterThan(0);
      for (const episode of episodes) {
        expect(episode.season).toBe(1);
        expect(episode.videoPath).toMatch(/^harbor-vine(-\d{4})?\/season-01\//);
        expect(episode.runtimeMinutes).not.toBeNull();
      }
      expect(episodes.map((episode) => episode.number)).toEqual(
        episodes.map((_, index) => index + 1)
      );

      // The shows are not movies.
      expect(storage.listMovies({ sort: 'a-z' })).toEqual([]);
    }
  );

  it.each([['library.xlsx' as const], ['library.csv' as const]])(
    'imports a second show, laid out loose, as its own series from %s',
    async (spelling) => {
      const { storage, root } = await importFixture(spelling);

      // The fixture's second shape: a Show folder holding tagged videos at
      // its own root, with no Season folder between.
      const loose = readdirSync(root, { withFileTypes: true }).filter(
        (entry) =>
          entry.isDirectory() &&
          readdirSync(join(root, entry.name)).some((file) =>
            /S\d\dE\d\d.*\.(mp4|mkv)$/i.test(file)
          )
      );
      expect(loose).toHaveLength(1);

      const series = allSeries(storage);
      expect(series).toHaveLength(2);
      const other = series.find((held) => held.title !== 'Harbor & Vine');
      if (other === undefined) {
        throw new Error('the fixture imported no second series');
      }
      // Named by its row, not guessed from the folder.
      expect(other.creator).not.toBeNull();
      const episodes = episodesOf(storage, other);
      expect(episodes.length).toBeGreaterThan(0);
      for (const episode of episodes) {
        expect(episode.runtimeMinutes).not.toBeNull();
      }
    }
  );
});

// 22 — Series (TV), Phase 7: "loose episodes, subtitles and the unplaced
// problem" (issue #197).
//
// The scanner's second shape end to end: a **Show folder** whose videos sit
// loose at its root, beside the film. Built per test from a layout — a
// relative folder onto the files in it, every video a copy of the fixture's
// header and every subtitle a line of text — over the same two-row sheet, so
// each suite below reads as the tree it is about.

/** A root laid out from `layout` under a fresh sandbox, and the importer over it. */
function looseSandbox(layout: Record<string, string[]>): {
  storage: LibraryStorage;
  importer: Importer;
  media: string;
  root: string;
  sheet: string;
} {
  const dir = sandboxRoot('familyflix-import-loose-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const root = join(dir, 'root');
  cpSync(
    join(LIBRARY_FIXTURE, 'root', 'Die.Hard.1988.1080p'),
    join(root, 'Die.Hard.1988.1080p'),
    { recursive: true }
  );
  for (const [folder, files] of Object.entries(layout)) {
    const at = join(root, folder);
    mkdirSync(at, { recursive: true });
    for (const file of files) {
      if (file.endsWith('.srt')) {
        writeFileSync(join(at, file), '1\n00:00:01,000 --> 00:00:02,000\nHi\n');
      } else {
        cpSync(HEADER, join(at, file));
      }
    }
  }

  const sheet = join(dir, 'library.csv');
  writeFileSync(sheet, SHEET);

  const storage = freshStorage();
  const importer = createImporter({
    storage,
    media: createMedia(media),
    playback: createPlayback(media, fixedSlot(null)),
  });
  return { storage, importer, media, root, sheet };
}

const LOOSE = {
  [SHOW]: [
    'Lighthouse.Keepers.S01E01.First.Light.mp4',
    'Lighthouse.Keepers.S01E01.First.Light.en.srt',
    'Lighthouse.Keepers.S01E01.First.Light.pt.srt',
    'Lighthouse.Keepers.S01E02.The.Storm.mp4',
    'Lighthouse.Keepers.S02E01E02.Spring.Tide.mp4',
  ],
};

const unplacedOf = (run: ImportRun) =>
  run.problems.filter((problem) => problem.kind === 'unplaced');

describe('createImporter — a folder of loose episodes becomes one series', () => {
  it('writes the loose folder as one series from its row', async () => {
    const { storage, importer, root, sheet } = looseSandbox(LOOSE);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(theSeries(storage)).toMatchObject({
      title: 'Lighthouse Keepers',
      year: 2019,
      creator: 'Mara Quinn',
    });
    expect(run.problems).toEqual([]);
  });

  it('numbers loose episodes off their tags, a multi-episode file taking its first number', async () => {
    const { storage, importer, root, sheet } = looseSandbox(LOOSE);

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(
      episodesOf(storage, theSeries(storage)).map((episode) => [
        episode.season,
        episode.number,
        episode.title,
        episode.videoPath,
      ])
    ).toEqual([
      [
        1,
        1,
        'First Light',
        'lighthouse-keepers-2019/season-01/Lighthouse.Keepers.S01E01.First.Light.mp4',
      ],
      [
        1,
        2,
        'The Storm',
        'lighthouse-keepers-2019/season-01/Lighthouse.Keepers.S01E02.The.Storm.mp4',
      ],
      [
        2,
        1,
        'Spring Tide',
        'lighthouse-keepers-2019/season-02/Lighthouse.Keepers.S02E01E02.Spring.Tide.mp4',
      ],
    ]);
  });

  it('lets a Season folder’s number win over the tag’s', async () => {
    const { storage, importer, root, sheet } = looseSandbox({
      [join(SHOW, 'Season 03')]: ['Lighthouse.Keepers.S01E05.Misfiled.mp4'],
    });

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(
      episodesOf(storage, theSeries(storage)).map((episode) => [
        episode.season,
        episode.number,
      ])
    ).toEqual([[3, 5]]);
  });

  it('keeps the film beside it a movie', async () => {
    const { storage, importer, root, sheet } = looseSandbox(LOOSE);

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(
      storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toEqual(['Die Hard']);
  });
});

describe('createImporter — episode subtitles', () => {
  it('attaches each subtitle to the episode whose stem it begins with, in its detected language', async () => {
    const { storage, importer, media, root, sheet } = looseSandbox(LOOSE);

    await importer.start(sheet, root);
    await untilReview(importer);

    const [first, second] = episodesOf(storage, theSeries(storage));
    expect(
      first.subtitles
        .map((track) => [track.path, track.language])
        .sort(([a], [b]) => a.localeCompare(b))
    ).toEqual([
      [
        'lighthouse-keepers-2019/season-01/Lighthouse.Keepers.S01E01.First.Light.en.srt',
        'English',
      ],
      [
        'lighthouse-keepers-2019/season-01/Lighthouse.Keepers.S01E01.First.Light.pt.srt',
        'Portuguese',
      ],
    ]);
    expect(second.subtitles).toEqual([]);

    // The tracks are copied in, not referenced where they lay.
    for (const track of first.subtitles) {
      expect(readFileSync(join(media, track.path), 'utf8')).toContain('Hi');
    }
  });

  it('logs a subtitle that matches no episode as a Warning line, not a Problem', async () => {
    const { storage, importer, root, sheet } = looseSandbox({
      [SHOW]: [...LOOSE[SHOW], 'Directors.Commentary.en.srt'],
    });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const lines = linesMatching(run, /Directors\.Commentary\.en\.srt/);
    expect(lines.map((line) => line.kind)).toEqual(['warning']);
    expect(run.problems).toEqual([]);
    for (const episode of episodesOf(storage, theSeries(storage))) {
      expect(
        episode.subtitles.map((track) => track.path).join(' ')
      ).not.toContain('Commentary');
    }
  });
});

describe('createImporter — unplaced episodes', () => {
  const WITH_STRAYS = {
    [SHOW]: [
      ...LOOSE[SHOW],
      'Lighthouse Keepers - Behind the Scenes.mp4',
      'Lighthouse.Keepers.S01E02.Storm.Copy.mp4',
    ],
  };

  it('files an unnumbered video and a second claim on a number as unplaced Problems', async () => {
    const { importer, root, sheet } = looseSandbox(WITH_STRAYS);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    const unplaced = unplacedOf(run);
    expect(unplaced).toHaveLength(2);
    expect(run.problems).toHaveLength(2);
    expect(unplaced.map((problem) => problem.title).join(' | ')).toContain(
      'Behind the Scenes'
    );
  });

  it('names the fix in the reason: rename it and import again', async () => {
    const { importer, root, sheet } = looseSandbox(WITH_STRAYS);

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(unplacedOf(run)).not.toEqual([]);
    for (const problem of unplacedOf(run)) {
      expect(problem.reason).toMatch(
        /rename it .*S\d\dE\d\d.* and import again/i
      );
    }
  });

  it('imports every placed episode of the show all the same, one file per number', async () => {
    const { storage, importer, root, sheet } = looseSandbox(WITH_STRAYS);

    await importer.start(sheet, root);
    await untilReview(importer);

    expect(
      episodesOf(storage, theSeries(storage)).map((episode) => [
        episode.season,
        episode.number,
      ])
    ).toEqual([
      [1, 1],
      [1, 2],
      [2, 1],
    ]);
  });

  it('files an unnumbered video in a Season folder as unplaced', async () => {
    const { importer, root, sheet } = looseSandbox({
      [join(SHOW, 'Season 01')]: [
        'Lighthouse.Keepers.S01E01.First.Light.mp4',
        'Bonus Feature.mp4',
      ],
    });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(run.problems.map((problem) => problem.kind)).toEqual(['unplaced']);
    expect(run.problems[0].title).toContain('Bonus Feature');
  });

  it('lets Skip dismiss an unplaced Problem', async () => {
    const { importer, root, sheet } = looseSandbox(WITH_STRAYS);

    await importer.start(sheet, root);
    const run = await untilReview(importer);
    const [first] = unplacedOf(run);

    expect(importer.dismiss(first.id)).toBe(true);
    expect(
      importer.current()?.problems.map((problem) => problem.id)
    ).not.toContain(first.id);
  });

  it('creates no series for a show whose every video is unplaced, and files only those Problems', async () => {
    const { storage, importer, media, root, sheet } = looseSandbox({
      [join(SHOW, 'Season 01')]: ['Episode One.mp4', 'Episode Two.mp4'],
    });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(allSeries(storage)).toEqual([]);
    expect(run.problems.map((problem) => problem.kind)).toEqual([
      'unplaced',
      'unplaced',
    ]);
    // Nothing reserved for it either — the film's is the one folder.
    expect(readdirSync(media)).toEqual(['die-hard-1988']);
  });
});

describe('createImporter — two Show folders with one Title key', () => {
  it('files the row as ambiguous and imports neither', async () => {
    const { storage, importer, root, sheet } = looseSandbox({
      [SHOW]: ['Lighthouse.Keepers.S01E01.First.Light.mp4'],
      [join('TV', SHOW, 'Season 01')]: [
        'Lighthouse.Keepers.S01E01.First.Light.mp4',
      ],
    });

    await importer.start(sheet, root);
    const run = await untilReview(importer);

    expect(allSeries(storage)).toEqual([]);
    expect(
      run.problems.map((problem) => [problem.kind, problem.title])
    ).toEqual([['ambiguous', 'Lighthouse Keepers']]);
  });
});
