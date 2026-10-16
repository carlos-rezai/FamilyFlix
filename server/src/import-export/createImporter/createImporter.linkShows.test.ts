// @vitest-environment node
//
// 41 — Link or copy, Slice 4: "shows and the sheet link" (issue #344).
//
// The **Import mode** reaches a show's episodes and the sheet start:
//
// - `importShow` follows `ImportRun.mode`: under Link each episode records a
//   **Linked video** — `{ videoFolderId, videoPath }`, the path relative to
//   its **Library folder** with forward slashes — and no episode video is
//   copied into the managed media directory; under Copy each is copied in, as
//   today. Either way every episode plays.
// - `start(sheetPath, enrich, mode)` carries the mode as `ImportRun.mode`, and
//   a sheet run links (or copies) its films and its shows as a scan does.
// - **Already in library** never changes a held title's mode: a held show that
//   gains a new episode on a re-run adds it in the re-run's mode, and its held
//   episodes keep theirs.
//
// The runs are real: the fixtures copied into sandboxed Library folders, a
// real `Media` over a sandbox managed directory, and a `Playback` reading each
// folder's path off the same library, over the absent **Playback component**.

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createImporter, type Importer } from './createImporter';
import {
  createSqliteStorage,
  type LibraryStorage,
  type StoredLibraryFolder,
} from '../../library';
import { createMedia } from '../../media/createMedia/createMedia';
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
import type { Episode, ImportMode, ImportRun, Movie, Series } from '@/types';

afterEach(closeTracked);

interface Sandbox {
  storage: LibraryStorage;
  importer: Importer;
  playback: Playback;
  /** The managed media directory. */
  media: string;
  /** The Library folder the series fixture was copied into, listed. */
  shows: StoredLibraryFolder;
  /** The series fixture's sheet. */
  showSheet: string;
  /** The Library folder the film fixture was copied into, listed. */
  films: StoredLibraryFolder;
  /** The film fixture's sheet. */
  filmSheet: string;
}

function sandbox(): Sandbox {
  const dir = sandboxRoot('familyflix-import-link-shows-');
  const media = join(dir, 'media');
  mkdirSync(media);
  mkdirSync(join(dir, 'shows'));
  mkdirSync(join(dir, 'films'));
  const shows = seriesFixture(join(dir, 'shows'), 'library.csv');
  const films = libraryFixture(join(dir, 'films'), 'library.csv');

  const storage = track(createSqliteStorage(join(dir, 'familyflix.db')));
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
  });
  return {
    storage,
    importer,
    playback,
    media,
    shows: storage.addLibraryFolder(shows.root),
    showSheet: shows.sheet,
    films: storage.addLibraryFolder(films.root),
    filmSheet: films.sheet,
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

/** One whole Folder scan in a mode, then the run let go. */
async function scanOnce(box: Sandbox, mode: ImportMode): Promise<ImportRun> {
  await box.importer.scan([box.shows, box.films], false, mode);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

/** One whole sheet run in a mode, then the run let go. */
async function sheetOnce(
  box: Sandbox,
  sheet: string,
  mode: ImportMode
): Promise<ImportRun> {
  await box.importer.start(sheet, false, mode);
  const run = await untilReview(box.importer);
  await box.importer.cancel();
  return run;
}

function showsByTitle(storage: LibraryStorage): Record<string, Series> {
  return Object.fromEntries(
    storage.getSeriesHome().series.map((series) => [series.title, series])
  );
}

function filmsByTitle(storage: LibraryStorage): Record<string, Movie> {
  return Object.fromEntries(
    storage.listMovies({ sort: 'a-z' }).map((movie) => [movie.title, movie])
  );
}

/** Every episode the library holds, show by show, in season and number order. */
function allEpisodes(storage: LibraryStorage): Episode[] {
  return storage
    .getSeriesHome()
    .series.flatMap((series) => storage.listEpisodes(series.id));
}

function episodesOf(storage: LibraryStorage, title: string): Episode[] {
  const show = showsByTitle(storage)[title];
  if (show === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return storage.listEpisodes(show.id);
}

/** Every file under a directory, relative to it, with forward slashes. */
function filesUnder(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }
  return (
    readdirSync(root, { recursive: true, withFileTypes: true }) as {
      isFile(): boolean;
      name: string;
      parentPath: string;
    }[]
  )
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(root, join(entry.parentPath, entry.name)).split(sep).join('/')
    )
    .sort();
}

const isVideo = (path: string) => /\.(mp4|mkv|avi|webm|mov)$/i.test(path);

const LINKED_EPISODES = {
  'Harbor & Vine': [
    'Harbor & Vine (2021)/Season 01/Harbor.and.Vine.S01E01.Pilot.mp4',
    'Harbor & Vine (2021)/Season 01/Harbor.and.Vine.S01E02.The.Night.Market.mp4',
  ],
  Tidewater: [
    'Tidewater (2018)/Tidewater.S01E01.Low.Water.mp4',
    'Tidewater (2018)/Tidewater.S01E02.The.Crossing.mp4',
  ],
} as const;

/** Every episode of every show opens through the Playback. */
function expectEveryEpisodePlays(box: Sandbox): void {
  const episodes = allEpisodes(box.storage);
  expect(episodes).toHaveLength(4);
  for (const episode of episodes) {
    expect(
      box.playback.videoFile({
        videoPath: episode.videoPath,
        videoFolderId: episode.videoFolderId,
      }).kind
    ).toBe('file');
  }
}

describe('createImporter.scan — a Link scan over a show', () => {
  it('records each episode’s video as linked, relative to its Library folder', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    for (const [title, paths] of Object.entries(LINKED_EPISODES)) {
      expect(
        episodesOf(box.storage, title).map((episode) => ({
          videoFolderId: episode.videoFolderId,
          videoPath: episode.videoPath,
        }))
      ).toEqual(
        paths.map((videoPath) => ({ videoFolderId: box.shows.id, videoPath }))
      );
    }
  });

  it('copies no episode video into the managed media directory', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    expect(allEpisodes(box.storage)).toHaveLength(4);
    expect(filesUnder(box.media).filter(isVideo)).toEqual([]);
  });

  it('still numbers the episodes off their folders and tags', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    expect(
      episodesOf(box.storage, 'Harbor & Vine').map((episode) => [
        episode.season,
        episode.number,
        episode.title,
        episode.videoFolderId,
      ])
    ).toEqual([
      [1, 1, 'Pilot', box.shows.id],
      [1, 2, 'The Night Market', box.shows.id],
    ]);
  });

  it('plays every episode where it lies', async () => {
    const box = sandbox();

    await scanOnce(box, 'link');

    expectEveryEpisodePlays(box);
  });
});

describe('createImporter.start — the sheet start under an Import mode', () => {
  it.each(['link', 'copy'] as const)(
    'carries mode %s on every snapshot',
    async (mode) => {
      const box = sandbox();

      const first = await box.importer.start(box.filmSheet, false, mode);
      const last = await untilReview(box.importer);
      await box.importer.cancel();

      expect(first.mode).toBe(mode);
      expect(last.mode).toBe(mode);
    }
  );

  it('a Link sheet run links its films', async () => {
    const box = sandbox();

    await sheetOnce(box, box.filmSheet, 'link');

    const films = filmsByTitle(box.storage);
    expect(films['Amélie']).toMatchObject({
      videoFolderId: box.films.id,
      videoPath: 'Drama/Amelie (2001)/Amelie.mp4',
    });
    expect(films['Die Hard']).toMatchObject({
      videoFolderId: box.films.id,
      videoPath: 'Die.Hard.1988.1080p/Die.Hard.1988.1080p.mp4',
    });
    expect(filesUnder(box.media).filter(isVideo)).toEqual([]);
  });

  it('a Link sheet run links its shows, and every episode plays', async () => {
    const box = sandbox();

    await sheetOnce(box, box.showSheet, 'link');

    for (const [title, paths] of Object.entries(LINKED_EPISODES)) {
      expect(
        episodesOf(box.storage, title).map((episode) => ({
          videoFolderId: episode.videoFolderId,
          videoPath: episode.videoPath,
        }))
      ).toEqual(
        paths.map((videoPath) => ({ videoFolderId: box.shows.id, videoPath }))
      );
    }
    expect(filesUnder(box.media).filter(isVideo)).toEqual([]);
    expectEveryEpisodePlays(box);
  });

  it('a Copy sheet run copies its films', async () => {
    const box = sandbox();

    const run = await sheetOnce(box, box.filmSheet, 'copy');

    expect(run.mode).toBe('copy');
    const films = filmsByTitle(box.storage);
    expect(films['Amélie']).toMatchObject({
      videoFolderId: null,
      videoPath: 'amelie-2001/Amelie.mp4',
    });
    expect(filesUnder(box.media).filter(isVideo)).toEqual(
      expect.arrayContaining([
        'amelie-2001/Amelie.mp4',
        'die-hard-1988/Die.Hard.1988.1080p.mp4',
      ])
    );
  });

  it('a Copy sheet run copies its shows, and every episode plays', async () => {
    const box = sandbox();

    const run = await sheetOnce(box, box.showSheet, 'copy');

    expect(run.mode).toBe('copy');
    const episodes = allEpisodes(box.storage);
    expect(episodes).toHaveLength(4);
    for (const episode of episodes) {
      expect(episode.videoFolderId).toBeNull();
    }
    expect(filesUnder(box.media).filter(isVideo)).toHaveLength(4);
    expectEveryEpisodePlays(box);
  });
});

describe('createImporter — a held show gains an episode on a re-run', () => {
  /** A third Tidewater episode on disk, beside the two the fixture holds. */
  function addThirdEpisode(box: Sandbox): void {
    const tidewater = join(box.shows.path, 'Tidewater (2018)');
    copyFileSync(
      join(tidewater, 'Tidewater.S01E02.The.Crossing.mp4'),
      join(tidewater, 'Tidewater.S01E03.High.Water.mp4')
    );
  }

  const modeOf = (episode: Episode): ImportMode =>
    episode.videoFolderId === null ? 'copy' : 'link';

  it.each([
    ['link', 'copy'],
    ['copy', 'link'],
  ] as const)(
    'a sheet run first in %s, then in %s: the new episode takes the re-run’s mode, the held keep theirs',
    async (first, second) => {
      const box = sandbox();
      await sheetOnce(box, box.showSheet, first);
      const held = episodesOf(box.storage, 'Tidewater');
      addThirdEpisode(box);

      await sheetOnce(box, box.showSheet, second);

      const episodes = episodesOf(box.storage, 'Tidewater');
      expect(
        episodes.map((episode) => [episode.number, modeOf(episode)])
      ).toEqual([
        [1, first],
        [2, first],
        [3, second],
      ]);
      expect(episodes.slice(0, 2)).toEqual(held);
      expect(
        box.playback.videoFile({
          videoPath: episodes[2].videoPath,
          videoFolderId: episodes[2].videoFolderId,
        }).kind
      ).toBe('file');
    }
  );

  it.each([
    ['link', 'copy'],
    ['copy', 'link'],
  ] as const)(
    'a scan first in %s, then in %s: the new episode takes the re-run’s mode, the held keep theirs',
    async (first, second) => {
      const box = sandbox();
      await scanOnce(box, first);
      const held = episodesOf(box.storage, 'Tidewater');
      addThirdEpisode(box);

      await scanOnce(box, second);

      const episodes = episodesOf(box.storage, 'Tidewater');
      expect(
        episodes.map((episode) => [episode.number, modeOf(episode)])
      ).toEqual([
        [1, first],
        [2, first],
        [3, second],
      ]);
      expect(episodes.slice(0, 2)).toEqual(held);
    }
  );

  it('a Link re-run links the new episode relative to its Library folder', async () => {
    const box = sandbox();
    await sheetOnce(box, box.showSheet, 'copy');
    addThirdEpisode(box);

    await sheetOnce(box, box.showSheet, 'link');

    expect(episodesOf(box.storage, 'Tidewater')[2]).toMatchObject({
      videoFolderId: box.shows.id,
      videoPath: 'Tidewater (2018)/Tidewater.S01E03.High.Water.mp4',
    });
  });
});

describe('createImporter.scan — the Activity log names the mode over a show', () => {
  it('a Link scan logs each episode as linked', async () => {
    const run = await scanOnce(sandbox(), 'link');

    const texts = run.log.map((line) => line.text);
    expect(texts).toContain('✓ Linked     Harbor & Vine · S01E01');
    expect(texts).toContain('✓ Linked     Harbor & Vine · S01E02');
  });
});
