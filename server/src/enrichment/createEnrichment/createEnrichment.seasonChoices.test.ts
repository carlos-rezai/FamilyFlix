// @vitest-environment node
//
// 42 — Review at scale, Slice 7: "choose a season's poster from TMDB" (issue
// #364).
//
// A single-series Sync's snapshot carries `seasons?: SeasonChoice[]` — one
// per Season on disk the Sync reads (season 0 is never read, so never
// offered), each with its held Season poster through `imageUrl` and at most
// ten choices: the season's own posters first (`seasonImages`), then the
// series' (`seriesImages`, `source: 'series'`). A library-wide run carries
// none.
//
// Composed over a real in-memory SQLite library, a real `Media` over a
// sandbox media root, and `fakeTmdb`: no test here goes online.

import { posix } from 'node:path';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { ENRICH_FIELDS, type EnrichField } from '@/types';
import { createMedia } from '../../media/createMedia/createMedia';
import { freshStorage } from '../../test-support/freshStorage/freshStorage';
import { sandboxRoot } from '../../test-support/sandboxRoot/sandboxRoot';
import {
  fakeTmdb,
  reviewed,
  TMDB_KEY as KEY,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
  type FakeTmdb,
} from '../../test-support/fakeTmdb/fakeTmdb';
import type { TmdbSeason } from '../tmdbClient/tmdbClient';
import { createEnrichment } from './createEnrichment';
import { framelessPlayback } from '../../test-support/framelessPlayback/framelessPlayback';

const ALL_FIELDS: EnrichField[] = [...ENRICH_FIELDS];
const NO_POSTER: EnrichField[] = ALL_FIELDS.filter(
  (field) => field !== 'poster'
);

const SHOW_ID = 71001;
const TITLE = 'The Hollow Coast';

const episodeOf = (number: number) => ({
  episode_number: number,
  name: `Episode ${number}`,
  air_date: '2018-09-02',
  runtime: 50,
  still_path: null,
});

const SEASONS: Record<number, TmdbSeason> = {
  0: tmdbSeason(0, [episodeOf(1)], { poster_path: '/s00-poster.jpg' }),
  1: tmdbSeason(1, [episodeOf(1), episodeOf(2)], {
    poster_path: '/s01-poster.jpg',
  }),
  2: tmdbSeason(2, [episodeOf(1)], { poster_path: '/s02-poster.jpg' }),
};

const image = (file_path: string, vote_average = 5) => ({
  file_path,
  vote_average,
});

/** Season 1 has seven of its own; season 2 has two. */
const S01_IMAGES = Array.from({ length: 7 }, (_, i) =>
  image(`/s01-${i + 1}.jpg`, 9 - i)
);
const S02_IMAGES = [image('/s02-a.jpg', 6), image('/s02-b.jpg', 4)];
/** The show's own six posters. */
const SHOW_IMAGES = Array.from({ length: 6 }, (_, i) =>
  image(`/show-${i + 1}.jpg`, 8 - i)
);

function knowsTheShow(): FakeTmdb {
  return fakeTmdb({
    tvSearches: { [TITLE]: [tmdbTvResult(SHOW_ID, TITLE, 2018)] },
    shows: [tmdbTvDetail(SHOW_ID, TITLE, 2018)],
    seasons: { [SHOW_ID]: SEASONS },
    seasonImages: {
      [SHOW_ID]: { 0: [image('/s00-a.jpg')], 1: S01_IMAGES, 2: S02_IMAGES },
    },
    seriesImages: { [SHOW_ID]: SHOW_IMAGES },
  });
}

const ON_DISK = [
  { season: 0, number: 1 },
  { season: 1, number: 1 },
  { season: 1, number: 2 },
  { season: 2, number: 1 },
];

function world(client: FakeTmdb = knowsTheShow()) {
  const storage = freshStorage();
  storage.setTmdbKey(KEY);
  const media = createMedia(sandboxRoot('familyflix-enrich-season-choices-'));
  const enrichment = createEnrichment({
    storage,
    client,
    media,
    playback: framelessPlayback(),
  });

  async function addShow(): Promise<{ id: string; folder: string }> {
    const reserved = media.reserveFolder(TITLE, 2018);
    const series = storage.addSeries({ title: TITLE, year: 2018 });
    let video = '';
    for (const each of ON_DISK) {
      const stem = `S${String(each.season).padStart(2, '0')}E${String(
        each.number
      ).padStart(2, '0')}`;
      video = await media.storeUpload(
        media.seasonFolder(reserved, each.season),
        `${stem}.mkv`,
        Readable.from([Buffer.from('video bytes')])
      );
      storage.addEpisode(series.id, {
        season: each.season,
        number: each.number,
        videoPath: video,
      });
    }
    return { id: series.id, folder: posix.dirname(posix.dirname(video)) };
  }

  return { storage, client, enrichment, addShow };
}

type Enrichment = ReturnType<typeof world>['enrichment'];

async function syncTheSeries(
  enrichment: Enrichment,
  seriesId: string,
  fields: EnrichField[] = ALL_FIELDS
) {
  const outcome = await enrichment.start({
    scope: 'single',
    seriesId,
    fields,
    writeSheet: false,
    writePosters: false,
  });
  expect(outcome.kind).toBe('started');
  return reviewed(enrichment);
}

describe('createEnrichment: a single-series run carries its Season choices', () => {
  it('holds one Season choice per season the Sync reads, in season order', async () => {
    const { enrichment, addShow } = world();
    const { id } = await addShow();

    const run = await syncTheSeries(enrichment, id);

    expect(run.seasons?.map((each) => each.season)).toEqual([1, 2]);
  });

  it('offers the season’s own posters first, then the series’, at most ten', async () => {
    const { enrichment, addShow } = world();
    const { id } = await addShow();

    const run = await syncTheSeries(enrichment, id);

    const first = run.seasons?.find((each) => each.season === 1);
    expect(first?.choices).toHaveLength(10);
    expect(first?.choices.map(({ path, source }) => [path, source])).toEqual([
      ...S01_IMAGES.map(({ file_path }) => [file_path, 'season']),
      ['/show-1.jpg', 'series'],
      ['/show-2.jpg', 'series'],
      ['/show-3.jpg', 'series'],
    ]);

    const second = run.seasons?.find((each) => each.season === 2);
    expect(second?.choices.map(({ path, source }) => [path, source])).toEqual([
      ['/s02-a.jpg', 'season'],
      ['/s02-b.jpg', 'season'],
      ...SHOW_IMAGES.map(({ file_path }) => [file_path, 'series']),
    ]);
  });

  it('gives each choice a TMDB image url for its path', async () => {
    const { enrichment, addShow } = world();
    const { id } = await addShow();

    const run = await syncTheSeries(enrichment, id);

    expect(run.seasons).toHaveLength(2);
    for (const season of run.seasons ?? []) {
      for (const choice of season.choices) {
        expect(choice.url).toMatch(
          /^https:\/\/image\.tmdb\.org\/t\/p\/[a-z0-9]+\//
        );
        expect(choice.url.endsWith(choice.path)).toBe(true);
      }
    }
  });

  it('holds each season’s held poster through the image route', async () => {
    const { enrichment, addShow } = world();
    const { id, folder } = await addShow();

    const run = await syncTheSeries(enrichment, id);

    expect(
      run.seasons?.map(({ season, posterUrl }) => [season, posterUrl])
    ).toEqual([
      [1, `/api/images/${folder}/S01-poster.jpg`],
      [2, `/api/images/${folder}/S02-poster.jpg`],
    ]);
  });

  it('holds a null posterUrl for a season with no poster yet', async () => {
    const { enrichment, addShow } = world();
    const { id } = await addShow();

    const run = await syncTheSeries(enrichment, id, NO_POSTER);

    expect(run.seasons?.map(({ posterUrl }) => posterUrl)).toEqual([
      null,
      null,
    ]);
    expect(run.seasons?.[0]?.choices.length).toBeGreaterThan(0);
  });

  it('asks the series’ images and each season’s, under the key', async () => {
    const { enrichment, client, addShow } = world();
    const { id } = await addShow();

    await syncTheSeries(enrichment, id);

    expect(
      client.seriesImages.mock.calls.map(([key, show]) => [key, show])
    ).toEqual([[KEY, SHOW_ID]]);
    const seasonsAsked = client.seasonImages.mock.calls
      .map(([, show, n]) => [show, n])
      .sort();
    expect(seasonsAsked).toEqual([
      [SHOW_ID, 1],
      [SHOW_ID, 2],
    ]);
  });
});

describe('createEnrichment: a library-wide run carries no Season choices', () => {
  it('holds no seasons, even over a series', async () => {
    const { enrichment, client, addShow } = world();
    await addShow();

    await enrichment.start({
      scope: 'all',
      fields: ALL_FIELDS,
      writeSheet: false,
      writePosters: false,
    });
    const run = await reviewed(enrichment);

    expect(run.enriched).toBe(1);
    expect(run.seasons).toBeUndefined();
    expect(client.seriesImages).not.toHaveBeenCalled();
  });
});
