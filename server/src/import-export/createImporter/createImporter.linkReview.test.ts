// @vitest-environment node
//
// 41 — Link or copy, Slice 4: "the review and the form follow the run"
// (issue #345), the importer's half.
//
// Every press in the **Review step** that imports a found video follows
// `ImportRun.mode`, as the run's own imports do:
//
// - the **Folder picker** (`pick`) and _Import as_ (`importGuessed`) add the
//   title with a **Linked video** in a Link run — `{ videoFolderId,
//   videoPath }`, the path relative to its **Library folder** with forward
//   slashes — and copy it in a Copy run;
// - the **Found files** of a film **Resolve** (`resolve`) and of a **Series
//   Resolve** (`resolveSeries`) follow the mode the same way;
// - a freshly picked file — a `{ stored }` slot the route already wrote into
//   managed storage — is copied either way: it stays the Stored path it is.
//
// The runs are real: the fixtures copied into a sandboxed Library folder, a
// real `Media` over a sandbox managed directory, and a `Playback` reading each
// folder's path off the same library, over the absent **Playback component**.

import { copyFileSync, createReadStream, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import {
  createPlayback,
  type Playback,
} from '../../playback/createPlayback/createPlayback';
import { fixedSlot } from '../../test-support/fixedSlot/fixedSlot';
import {
  closeTracked,
  track,
} from '../../test-support/freshStorage/freshStorage';
import { libraryFixture } from '../../test-support/libraryFixture/libraryFixture';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../../test-support/seriesFixture/seriesFixture';
import type {
  Episode,
  ImportMode,
  ImportProblem,
  ImportRun,
  Movie,
  ProblemKind,
} from '@/types';

afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  playback: Playback;
  mediaDomain: Media;
  /** The managed media directory. */
  media: string;
  /** The one Library folder the fixture was copied into, listed. */
  folder: StoredLibraryFolder;
  sheet: string;
}

/** One fixture — the films' or the shows' — as the only listed Library folder. */
function sandbox(kind: 'films' | 'shows'): Sandbox {
  const dir = sandboxRoot(`familyflix-import-link-review-${kind}-`);
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, kind));
  const { root, sheet } =
    kind === 'films'
      ? libraryFixture(join(dir, kind), 'library.csv')
      : seriesFixture(join(dir, kind), 'library.csv');

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) =>
      storage.libraryFolders().find((folder) => folder.id === id)?.path ?? null
  );
  const mediaDomain = createMedia(media);
  const importer = createImporter({ storage, media: mediaDomain, playback });
  return {
    storage,
    importer,
    playback,
    mediaDomain,
    media,
    folder: storage.addLibraryFolder(root),
    sheet,
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

/** The sheet run in a mode, left in review, and the one Problem of a kind. */
async function inReview(
  box: Sandbox,
  mode: ImportMode,
  kind: ProblemKind
): Promise<ImportProblem> {
  const first = await box.importer.start(box.sheet, false, mode);
  expect(first.mode).toBe(mode);
  const run = await untilReview(box.importer);
  expect(run.mode).toBe(mode);
  const problem = run.problems.find((each) => each.kind === kind);
  if (problem === undefined) {
    throw new Error(`no ${kind} Problem: ${JSON.stringify(run.problems)}`);
  }
  return problem;
}

function movieTitled(storage: LibraryStorage, title: string): Movie {
  const movie = storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === title);
  if (movie === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return movie;
}

function tidewaterEpisodes(storage: LibraryStorage): Episode[] {
  const show = storage
    .getSeriesHome()
    .series.find((series) => series.title === 'Tidewater');
  if (show === undefined) {
    throw new Error('the library holds no Tidewater');
  }
  return storage.listEpisodes(show.id);
}

const plays = (
  playback: Playback,
  title: { videoPath: string; videoFolderId: string | null }
) =>
  playback.videoFile({
    videoPath: title.videoPath,
    videoFolderId: title.videoFolderId,
  }).kind;

/** A copy of a real fixture video at a path under the Library folder. */
function placeVideo(box: Sandbox, from: string, to: string): void {
  mkdirSync(join(box.folder.path, to, '..'), { recursive: true });
  copyFileSync(join(box.folder.path, from), join(box.folder.path, to));
}

const DIE_HARD = 'Die.Hard.1988.1080p/Die.Hard.1988.1080p.mp4';

// --- The Folder picker -------------------------------------------------------

/** Die Hard answered by the fixture's folder and a second one: `ambiguous`. */
async function ambiguousDieHard(mode: ImportMode) {
  const box = sandbox('films');
  placeVideo(box, DIE_HARD, 'Die Hard (1988)/Die Hard.mp4');
  const problem = await inReview(box, mode, 'ambiguous');
  return { ...box, problem, second: join(box.folder.path, 'Die Hard (1988)') };
}

describe('createImporter.pick — the Folder picker follows the run’s mode', () => {
  it('a Link run adds the picked folder’s film linked where it lies', async () => {
    const box = await ambiguousDieHard('link');

    const outcome = await box.importer.pick(box.problem.id, box.second);

    expect(outcome).toEqual({ kind: 'imported' });
    expect(movieTitled(box.storage, 'Die Hard')).toMatchObject({
      videoFolderId: box.folder.id,
      videoPath: 'Die Hard (1988)/Die Hard.mp4',
    });
    expect(existsSync(join(box.media, 'Die Hard (1988)'))).toBe(false);
    expect(plays(box.playback, movieTitled(box.storage, 'Die Hard'))).toBe(
      'file'
    );
  });

  it('a Copy run copies the picked folder’s film in', async () => {
    const box = await ambiguousDieHard('copy');

    const outcome = await box.importer.pick(box.problem.id, box.second);

    expect(outcome).toEqual({ kind: 'imported' });
    const movie = movieTitled(box.storage, 'Die Hard');
    expect(movie.videoFolderId).toBeNull();
    expect(existsSync(join(box.media, movie.videoPath))).toBe(true);
    expect(plays(box.playback, movie)).toBe('file');
  });
});

// --- Import as ---------------------------------------------------------------

const IRONWOOD = 'Ironwood.2018.1080p';

/** A folder no sheet row names, beside the fixture: `no-row`. */
async function noRowIronwood(mode: ImportMode) {
  const box = sandbox('films');
  placeVideo(box, DIE_HARD, `${IRONWOOD}/${IRONWOOD}.mp4`);
  const problem = await inReview(box, mode, 'no-row');
  return { ...box, problem };
}

describe('createImporter.importGuessed — Import as follows the run’s mode', () => {
  it('a Link run adds the guessed title linked where it lies', async () => {
    const box = await noRowIronwood('link');

    const outcome = await box.importer.importGuessed(box.problem.id);

    expect(outcome).toEqual({ kind: 'imported' });
    const movie = movieTitled(box.storage, 'Ironwood');
    expect(movie).toMatchObject({
      videoFolderId: box.folder.id,
      videoPath: `${IRONWOOD}/${IRONWOOD}.mp4`,
    });
    expect(plays(box.playback, movie)).toBe('file');
  });

  it('a Copy run copies the guessed title in', async () => {
    const box = await noRowIronwood('copy');

    const outcome = await box.importer.importGuessed(box.problem.id);

    expect(outcome).toEqual({ kind: 'imported' });
    const movie = movieTitled(box.storage, 'Ironwood');
    expect(movie.videoFolderId).toBeNull();
    expect(existsSync(join(box.media, movie.videoPath))).toBe(true);
    expect(plays(box.playback, movie)).toBe('file');
  });
});

// --- A film Resolve ----------------------------------------------------------

/** Die Hard's folder holding a second video: `no-video`, for the form. */
async function twoVideoDieHard(mode: ImportMode) {
  const box = sandbox('films');
  placeVideo(box, DIE_HARD, 'Die.Hard.1988.1080p/Die.Hard.1988.1080p.mkv');
  const problem = await inReview(box, mode, 'no-video');
  const dieHard = join(box.folder.path, 'Die.Hard.1988.1080p');
  const form = {
    title: 'Die Hard',
    year: 1988,
    director: null,
    synopsis: null,
    rating: null,
    cast: [],
    genres: [],
    video: { found: join(dieHard, 'Die.Hard.1988.1080p.mp4') },
    poster: { found: join(dieHard, 'poster.jpg') },
    subtitles: [
      {
        file: { found: join(dieHard, 'Die.Hard.1988.1080p.en.srt') },
        language: 'English',
      },
    ],
  };
  return { ...box, problem, form };
}

/** A video the route already stored from bytes, as its Stored path. */
async function pickedVideo(
  box: Sandbox,
  folder: string,
  from = DIE_HARD
): Promise<string> {
  return box.mediaDomain.storeUpload(
    folder,
    'picked.mp4',
    createReadStream(join(box.folder.path, from))
  );
}

describe('createImporter.resolve — a film Resolve’s Found file follows the run’s mode', () => {
  it('a Link run links the found video, and still copies the poster and subtitles', async () => {
    const box = await twoVideoDieHard('link');

    const movie = await box.importer.resolve(box.problem.id, box.form);

    expect(movie).toMatchObject({
      videoFolderId: box.folder.id,
      videoPath: DIE_HARD,
    });
    expect(movie.posterPath).not.toBeNull();
    expect(existsSync(join(box.media, movie.posterPath ?? ''))).toBe(true);
    for (const track of movie.subtitles) {
      expect(existsSync(join(box.media, track.path))).toBe(true);
    }
    expect(existsSync(join(box.media, DIE_HARD))).toBe(false);
    expect(plays(box.playback, movie)).toBe('file');
  });

  it('a Copy run copies the found video in', async () => {
    const box = await twoVideoDieHard('copy');

    const movie = await box.importer.resolve(box.problem.id, box.form);

    expect(movie.videoFolderId).toBeNull();
    expect(existsSync(join(box.media, movie.videoPath))).toBe(true);
    expect(plays(box.playback, movie)).toBe('file');
  });

  it.each(['link', 'copy'] as const)(
    'a freshly picked video is copied in a %s run',
    async (mode) => {
      const box = await twoVideoDieHard(mode);
      const stored = await pickedVideo(
        box,
        box.mediaDomain.reserveFolder('Die Hard', 1988)
      );

      const movie = await box.importer.resolve(box.problem.id, {
        ...box.form,
        video: { stored },
      });

      expect(movie).toMatchObject({ videoFolderId: null, videoPath: stored });
      expect(existsSync(join(box.media, stored))).toBe(true);
      expect(plays(box.playback, movie)).toBe('file');
    }
  );
});

// --- A Series Resolve --------------------------------------------------------

const STRAY = 'Tidewater (2018)/Behind the Scenes.mp4';

/** A stray with no number beside Tidewater's two episodes: `unplaced`. */
async function unplacedTidewater(mode: ImportMode) {
  const box = sandbox('shows');
  placeVideo(box, 'Tidewater (2018)/Tidewater.S01E01.Low.Water.mp4', STRAY);
  const problem = await inReview(box, mode, 'unplaced');
  const form = {
    title: 'Tidewater',
    cast: [],
    genres: [],
    poster: null,
    episodes: [
      {
        season: 1,
        number: 3,
        title: 'Behind the Scenes',
        video: { found: join(box.folder.path, STRAY) },
        subtitles: [],
      },
    ],
  };
  return { ...box, problem, form };
}

const third = (episodes: Episode[]): Episode => {
  const episode = episodes.find((each) => each.number === 3);
  if (episode === undefined) {
    throw new Error(`no third episode: ${JSON.stringify(episodes)}`);
  }
  return episode;
};

describe('createImporter.resolveSeries — a Series Resolve’s Found files follow the run’s mode', () => {
  it('a Link run links each found episode where it lies', async () => {
    const box = await unplacedTidewater('link');

    await box.importer.resolveSeries(box.problem.id, box.form);

    const episode = third(tidewaterEpisodes(box.storage));
    expect(episode).toMatchObject({
      videoFolderId: box.folder.id,
      videoPath: STRAY,
    });
    expect(plays(box.playback, episode)).toBe('file');
  });

  it('a Link run leaves the held episodes linked as they were', async () => {
    const box = await unplacedTidewater('link');
    const held = tidewaterEpisodes(box.storage);

    await box.importer.resolveSeries(box.problem.id, box.form);

    expect(tidewaterEpisodes(box.storage).slice(0, 2)).toEqual(held);
  });

  it('a Copy run copies each found episode in', async () => {
    const box = await unplacedTidewater('copy');

    await box.importer.resolveSeries(box.problem.id, box.form);

    const episode = third(tidewaterEpisodes(box.storage));
    expect(episode.videoFolderId).toBeNull();
    expect(existsSync(join(box.media, episode.videoPath))).toBe(true);
    expect(plays(box.playback, episode)).toBe('file');
  });

  it.each(['link', 'copy'] as const)(
    'a freshly picked episode video is copied in a %s run',
    async (mode) => {
      const box = await unplacedTidewater(mode);
      const seriesFolder = box.mediaDomain.openFolder(
        box.storage.mediaFolderOf('series', box.problem.seriesId ?? '') ?? ''
      );
      if (seriesFolder === null) {
        throw new Error('the held series has no Media folder');
      }
      const stored = await pickedVideo(
        box,
        box.mediaDomain.seasonFolder(seriesFolder, 1),
        STRAY
      );

      await box.importer.resolveSeries(box.problem.id, {
        ...box.form,
        episodes: [{ ...box.form.episodes[0], video: { stored } }],
      });

      const episode = third(tidewaterEpisodes(box.storage));
      expect(episode).toMatchObject({ videoFolderId: null, videoPath: stored });
      expect(existsSync(join(box.media, stored))).toBe(true);
      expect(plays(box.playback, episode)).toBe('file');
    }
  );
});

// --- The Media folder a Resolve records ---------------------------------------
//
// A Linked video sits in no managed folder, so the folder a Resolve reserved
// for its art and subtitles is the only one the title has — and it must be the
// one recorded, or a Sync stores nothing and a Delete strands the folder.

const NEW_SHOW = 'Lighthouse Keepers (2020)/Season 01';

/** A new show of one unnumbered video and its subtitle: `unplaced`, no series. */
async function unplacedNewShow() {
  const box = sandbox('shows');
  placeVideo(
    box,
    'Tidewater (2018)/Tidewater.S01E01.Low.Water.mp4',
    `${NEW_SHOW}/Bonus One.mp4`
  );
  placeVideo(
    box,
    'Tidewater (2018)/Tidewater.S01E01.Low.Water.mp4',
    `${NEW_SHOW}/Bonus One.en.srt`
  );
  const run = await box.importer.start(box.sheet, false, 'link');
  expect(run.mode).toBe('link');
  const problem = (await untilReview(box.importer)).problems.find(
    (each) => each.kind === 'unplaced' && each.seriesId === undefined
  );
  if (problem === undefined) {
    throw new Error('no unplaced Problem for the new show');
  }
  const form = {
    title: 'Lighthouse Keepers',
    cast: [],
    genres: [],
    poster: null,
    episodes: [
      {
        season: 1,
        number: 1,
        title: 'Bonus One',
        video: { found: join(box.folder.path, NEW_SHOW, 'Bonus One.mp4') },
        subtitles: [
          {
            file: {
              found: join(box.folder.path, NEW_SHOW, 'Bonus One.en.srt'),
            },
            language: 'English',
          },
        ],
      },
    ],
  };
  return { ...box, problem, form };
}

describe('createImporter — a Resolve in a Link run records its Media folder', () => {
  it('a film Resolve records the folder its poster was copied into', async () => {
    const box = await twoVideoDieHard('link');

    const movie = await box.importer.resolve(box.problem.id, box.form);

    const folder = (movie.posterPath ?? '').split('/')[0];
    expect(folder).not.toBe('');
    expect(box.storage.mediaFolderOf('movie', movie.id)).toBe(folder);
  });

  it('a Series Resolve adding a show with no poster records the Series folder its subtitles went into', async () => {
    const box = await unplacedNewShow();

    const series = await box.importer.resolveSeries(box.problem.id, box.form);

    const [episode] = box.storage.listEpisodes(series.id);
    expect(episode.videoFolderId).toBe(box.folder.id);
    const folder = episode.subtitles[0].path.split('/')[0];
    expect(existsSync(join(box.media, folder))).toBe(true);
    expect(box.storage.mediaFolderOf('series', series.id)).toBe(folder);
  });
});

describe('createImporter — a Resolve over picked bytes finds the title’s folder', () => {
  it('a Series Resolve whose first picked file is an episode keeps the Series folder, not its season', async () => {
    const box = await unplacedNewShow();
    const reserved = box.mediaDomain.reserveFolder('Lighthouse Keepers', null);
    const stored = await pickedVideo(
      box,
      box.mediaDomain.seasonFolder(reserved, 1),
      `${NEW_SHOW}/Bonus One.mp4`
    );

    const series = await box.importer.resolveSeries(box.problem.id, {
      ...box.form,
      episodes: [{ ...box.form.episodes[0], video: { stored } }],
    });

    const [episode] = box.storage.listEpisodes(series.id);
    expect(episode.videoPath).toBe(stored);
    expect(box.storage.mediaFolderOf('series', series.id)).toBe(
      stored.split('/')[0]
    );
    // The subtitle went into the same season, not a season under it.
    expect(episode.subtitles[0].path.split('/')).toHaveLength(3);
  });
});
