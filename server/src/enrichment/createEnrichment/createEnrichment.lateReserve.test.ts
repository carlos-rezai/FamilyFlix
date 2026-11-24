// @vitest-environment node
//
// 75 — Poster pick, phase 1 (issue #708): a linked show's art lands.
//
// A show added by the **Show folder pick** links its videos where they lie,
// so it has no **Media folder** to write art into. A Sync gives it one late:
// the **Late reserve** reserves a folder by title and year the first time an
// image has arrived to store, records it on the series, and every poster,
// backdrop, **Season poster** and **Still** (a **Frame still** included) of
// that pass lands in it. A **Season choice** taken on such a series reserves
// the same way and answers `chosen`. A series whose folder still opens keeps
// it; a Sync with Poster and Backdrop off stores nothing and so reserves
// nothing; a refused reserve is an image not stored, and the Sync goes on.
//
// Composed over a real in-memory library, a real `Media` over a sandbox, a
// fake TMDB and a Playback whose `frame` is scripted: no test goes online.
//
// Phase 2 (issue #709): a linked film's art lands. A film added with its video
// linked where it lies has no Media folder either; its Sync makes one Late
// reserve for its poster and backdrop, so both land in one new folder,
// recorded on the film, and its video path stays as it was.

import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, relative, sep } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';

import { ENRICH_FIELDS, type EnrichField } from '@/types';
import { createMedia, type Media } from '../../media/createMedia/createMedia';
import type { Playback } from '../../playback/createPlayback/createPlayback';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../../test-support/unfittedArt/unfittedArt';
import {
  fakeTmdb,
  reviewed,
  tmdbMovieDetail,
  tmdbMovieResult,
  TMDB_KEY,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
} from '../../test-support/fakeTmdb/fakeTmdb';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';
import { createLayoutFill } from '../../import-export/createLayoutFill/createLayoutFill';
import { createEnrichment } from './createEnrichment';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];
const NO_ART: EnrichField[] = ALL_FIELDS.filter(
  (field) => field !== 'poster' && field !== 'backdrop'
);

const SHOW_ID = 71001;
const TITLE = 'The Hollow Coast';
/** What `reserveFolder(TITLE, 2018)` names in an empty media root. */
const RESERVED = 'the-hollow-coast-2018';

const FILM_ID = 550123;
const FILM = 'The Lantern Keeper';
/** What `reserveFolder(FILM, 2019)` names in an empty media root. */
const FILM_RESERVED = 'the-lantern-keeper-2019';
/** The film's video, linked where it lies in the Library folder. */
const FILM_VIDEO = `${FILM} (2019)/lantern.mkv`;

const image = (file_path: string) => ({ file_path, vote_average: 5 });

/**
 * A TMDB that knows the show, its poster and backdrop, and season 1 with its
 * own poster: E01 with a still, E02 without one, so E02 takes a Frame still.
 * It knows the film too, with its poster and backdrop.
 */
const knowsTheShow = () =>
  fakeTmdb({
    searches: { [FILM]: [tmdbMovieResult(FILM_ID, FILM, 2019)] },
    movies: [tmdbMovieDetail(FILM_ID, FILM, 2019)],
    tvSearches: { [TITLE]: [tmdbTvResult(SHOW_ID, TITLE, 2018)] },
    shows: [tmdbTvDetail(SHOW_ID, TITLE, 2018)],
    seasons: {
      [SHOW_ID]: {
        1: tmdbSeason(
          1,
          [
            {
              episode_number: 1,
              name: 'Low Tide',
              air_date: '2018-09-02',
              runtime: 52,
              still_path: '/s01e01.jpg',
            },
            {
              episode_number: 2,
              name: 'Driftwood',
              air_date: '2018-09-09',
              runtime: 49,
              still_path: null,
            },
          ],
          { poster_path: '/s01-poster.jpg' }
        ),
      },
    },
    seasonImages: { [SHOW_ID]: { 1: [image('/s01-a.jpg')] } },
    seriesImages: { [SHOW_ID]: [image('/show-1.jpg')] },
  });

/** A frame that answers a picture at once. */
const pictured: Playback['frame'] = async () => ({
  kind: 'frame',
  picture: Readable.from([Buffer.from('a frame off the video')]),
});

const LINKED = [
  `${TITLE}/Season 01/S01E01.mkv`,
  `${TITLE}/Season 01/S01E02.mkv`,
];

interface Options {
  /** Swap the media domain, to refuse a reserve. */
  media?: (real: Media) => Media;
}

/** A keyed library, a sandbox media root, a Library folder, the domain. */
function world({ media }: Options = {}) {
  const storage = freshStorage();
  storage.setTmdbKey(TMDB_KEY);
  const root = sandboxRoot('familyflix-late-reserve-sync-');
  const realMedia = createMedia(root, unfittedArt());
  const domainMedia = media === undefined ? realMedia : media(realMedia);
  const enrichment = createEnrichment({
    storage,
    client: knowsTheShow(),
    media: domainMedia,
    playback: framelessPlayback(pictured),
    layoutFill: createLayoutFill({ storage, media: domainMedia }),
  });

  const libraryFolder = join(
    sandboxRoot('familyflix-late-reserve-lib-'),
    'Shows'
  );
  mkdirSync(join(libraryFolder, TITLE, 'Season 01'), { recursive: true });
  for (const path of LINKED) writeFileSync(join(libraryFolder, path), 'video');
  const listed = storage.addLibraryFolder(libraryFolder);

  /**
   * The show as the Show folder pick adds it: its episodes linked where they
   * lie, so no Media folder is recorded — unless one is given.
   */
  function addShow(mediaFolder?: string): string {
    const series = storage.addSeries({ title: TITLE, year: 2018, mediaFolder });
    LINKED.forEach((videoPath, index) => {
      storage.addEpisode(series.id, {
        season: 1,
        number: index + 1,
        videoPath,
        videoFolderId: listed.id,
      });
    });
    return series.id;
  }

  /**
   * The film as a linked add makes it: its video linked where it lies in the
   * Library folder, so no Media folder is recorded, unless one is given.
   */
  function addFilm(mediaFolder?: string): string {
    mkdirSync(join(libraryFolder, `${FILM} (2019)`), { recursive: true });
    writeFileSync(join(libraryFolder, FILM_VIDEO), 'video');
    return storage.addMovie({
      title: FILM,
      year: 2019,
      videoPath: FILM_VIDEO,
      videoFolderId: listed.id,
      mediaFolder,
    }).id;
  }

  return {
    storage,
    enrichment,
    root,
    realMedia,
    libraryFolder,
    addShow,
    addFilm,
  };
}

type World = ReturnType<typeof world>;

async function syncTheSeries(
  enrichment: World['enrichment'],
  seriesId: string,
  fields: EnrichField[] = ALL_FIELDS
) {
  const outcome = await enrichment.start({ scope: 'single', seriesId, fields });
  expect(outcome.kind).toBe('started');
  return reviewed(enrichment);
}

async function syncTheFilm(
  enrichment: World['enrichment'],
  movieId: string,
  fields: EnrichField[] = ALL_FIELDS
) {
  const outcome = await enrichment.start({ scope: 'single', movieId, fields });
  expect(outcome.kind).toBe('started');
  return reviewed(enrichment);
}

/** Every file under a directory, relative to it with `/`, sorted. */
function filesUnder(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  const walk = (at: string) => {
    for (const name of readdirSync(at)) {
      const full = join(at, name);
      if (statSync(full).isDirectory()) walk(full);
      else found.push(relative(dir, full).split(sep).join('/'));
    }
  };
  walk(dir);
  return found.sort();
}

const episodes = (storage: World['storage'], id: string) =>
  [...storage.listEpisodes(id)].sort((a, b) => a.number - b.number);

describe('createEnrichment: a series with no Media folder, synced', () => {
  it('lands its poster, backdrop, Season poster and Stills in one new folder, recorded on the series', async () => {
    const { storage, enrichment, root, addShow } = world();
    const id = addShow();

    await syncTheSeries(enrichment, id);

    expect(storage.mediaFolderOf('series', id)).toBe(RESERVED);
    expect(readdirSync(root)).toEqual([RESERVED]);
    expect(filesUnder(join(root, RESERVED))).toEqual(
      [
        'S01-poster.jpg',
        'backdrop.jpg',
        'poster.jpg',
        'season-01/S01E01.still.jpg',
        'season-01/S01E02.frame.jpg',
      ].sort()
    );
    const series = storage.getSeries(id);
    expect(series?.posterPath).toBe(`${RESERVED}/poster.jpg`);
    expect(series?.backdropPath).toBe(`${RESERVED}/backdrop.jpg`);
    expect(
      storage.getSeriesDetail(id)?.seasons.find((each) => each.number === 1)
        ?.posterPath
    ).toBe(`${RESERVED}/S01-poster.jpg`);
    expect(episodes(storage, id).map((each) => each.stillPath)).toEqual([
      `${RESERVED}/season-01/S01E01.still.jpg`,
      `${RESERVED}/season-01/S01E02.frame.jpg`,
    ]);
  });

  it('writes nothing into the Library folder and leaves the videos’ paths as they were', async () => {
    const { storage, enrichment, libraryFolder, addShow } = world();
    const id = addShow();

    await syncTheSeries(enrichment, id);

    // The pass did store its art, so this is not a Sync that wrote nothing.
    expect(storage.mediaFolderOf('series', id)).toBe(RESERVED);
    expect(filesUnder(libraryFolder)).toEqual(LINKED);
    expect(episodes(storage, id).map((each) => each.videoPath)).toEqual(LINKED);
  });
});

describe('createEnrichment: a series whose Media folder opens', () => {
  it('keeps using it, and no new folder is made', async () => {
    const { storage, enrichment, root, realMedia, addShow } = world();
    const held = relative(root, realMedia.reserveFolder('Held Folder', null))
      .split(sep)
      .join('/');
    const id = addShow(held);

    await syncTheSeries(enrichment, id);

    expect(storage.mediaFolderOf('series', id)).toBe(held);
    expect(readdirSync(root)).toEqual([held]);
    expect(storage.getSeries(id)?.posterPath).toBe(`${held}/poster.jpg`);
    expect(episodes(storage, id).map((each) => each.stillPath)).toEqual([
      `${held}/season-01/S01E01.still.jpg`,
      `${held}/season-01/S01E02.frame.jpg`,
    ]);
  });
});

describe('createEnrichment: a folder-less series with Poster and Backdrop off', () => {
  it('makes no folder and records none', async () => {
    const { storage, enrichment, root, addShow } = world();
    const id = addShow();

    await syncTheSeries(enrichment, id, NO_ART);

    expect(readdirSync(root)).toEqual([]);
    expect(storage.mediaFolderOf('series', id)).toBeNull();
  });
});

describe('createEnrichment: a Season choice on a folder-less series', () => {
  it('answers chosen, its folder reserved and recorded, and the held tile’s url follows it', async () => {
    const { storage, enrichment, root, addShow } = world();
    const id = addShow();
    // Poster and Backdrop off: the pass stores nothing, so the series is still folder-less.
    await syncTheSeries(enrichment, id, NO_ART);

    const outcome = await enrichment.chooseSeasonPoster(1, '/s01-a.jpg');

    expect(outcome.kind).toBe('chosen');
    const stored = `${RESERVED}/S01-poster.jpg`;
    expect(outcome).toMatchObject({
      choice: { season: 1, posterUrl: `/api/images/${stored}` },
    });
    expect(
      storage.getSeriesDetail(id)?.seasons.find((each) => each.number === 1)
        ?.posterPath
    ).toBe(stored);
    expect(storage.mediaFolderOf('series', id)).toBe(RESERVED);
    expect(filesUnder(root)).toEqual([stored]);
    expect(
      enrichment.current()?.seasons?.find((each) => each.season === 1)
        ?.posterUrl
    ).toBe(`/api/images/${stored}`);
  });

  it('still answers not-found when there is no run', async () => {
    const { enrichment } = world();

    expect(await enrichment.chooseSeasonPoster(1, '/s01-a.jpg')).toEqual({
      kind: 'not-found',
    });
  });
});

describe('createEnrichment: a refused reserve', () => {
  it('reads as an image not stored, and the Sync goes on', async () => {
    const reserveFolder = vi.fn<Media['reserveFolder']>(() => {
      throw new Error('disk full');
    });
    const { storage, enrichment, root, addShow } = world({
      media: (real) => ({ ...real, reserveFolder }),
    });
    const id = addShow();

    const run = await syncTheSeries(enrichment, id);

    // It was asked for, once an image had arrived, and refused.
    expect(reserveFolder).toHaveBeenCalledWith(TITLE, 2018);
    expect(run.phase).toBe('review');
    expect(filesUnder(root)).toEqual([]);
    expect(storage.mediaFolderOf('series', id)).toBeNull();
    expect(storage.getSeries(id)?.posterPath ?? null).toBeNull();
    expect(
      episodes(storage, id).map((each) => [each.title, each.stillPath])
    ).toEqual([
      ['Low Tide', null],
      ['Driftwood', null],
    ]);
  });
});

describe('createEnrichment: a film with no Media folder, synced', () => {
  it('lands its poster and backdrop in one new folder, recorded on the film', async () => {
    const { storage, enrichment, root, addFilm } = world();
    const id = addFilm();

    await syncTheFilm(enrichment, id);

    expect(storage.mediaFolderOf('movie', id)).toBe(FILM_RESERVED);
    expect(readdirSync(root)).toEqual([FILM_RESERVED]);
    expect(filesUnder(join(root, FILM_RESERVED))).toEqual([
      'backdrop.jpg',
      'poster.jpg',
    ]);
    const movie = storage.getMovie(id);
    expect(movie?.posterPath).toBe(`${FILM_RESERVED}/poster.jpg`);
    expect(movie?.backdropPath).toBe(`${FILM_RESERVED}/backdrop.jpg`);
  });

  it('leaves its video path as it was and writes nothing into the Library folder', async () => {
    const { storage, enrichment, libraryFolder, addFilm } = world();
    const id = addFilm();
    // The world's show is linked from the same Library folder.
    const before = filesUnder(libraryFolder);
    expect(before).toContain(FILM_VIDEO);

    await syncTheFilm(enrichment, id);

    // The pass did store its art, so this is not a Sync that wrote nothing.
    expect(storage.mediaFolderOf('movie', id)).toBe(FILM_RESERVED);
    expect(storage.getMovie(id)?.videoPath).toBe(FILM_VIDEO);
    expect(filesUnder(libraryFolder)).toEqual(before);
  });
});

describe('createEnrichment: a film whose Media folder opens', () => {
  it('keeps using it, and no new folder is made', async () => {
    const { storage, enrichment, root, realMedia, addFilm } = world();
    const held = relative(root, realMedia.reserveFolder('Held Folder', null))
      .split(sep)
      .join('/');
    const id = addFilm(held);

    await syncTheFilm(enrichment, id);

    expect(storage.mediaFolderOf('movie', id)).toBe(held);
    expect(readdirSync(root)).toEqual([held]);
    const movie = storage.getMovie(id);
    expect(movie?.posterPath).toBe(`${held}/poster.jpg`);
    expect(movie?.backdropPath).toBe(`${held}/backdrop.jpg`);
  });
});

describe('createEnrichment: a folder-less film with Poster and Backdrop off', () => {
  it('makes no folder and records none', async () => {
    const { storage, enrichment, root, addFilm } = world();
    const id = addFilm();

    await syncTheFilm(enrichment, id, NO_ART);

    expect(readdirSync(root)).toEqual([]);
    expect(storage.mediaFolderOf('movie', id)).toBeNull();
  });
});
