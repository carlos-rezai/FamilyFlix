// @vitest-environment node
//
// 42 — Review at scale, Slice 7: "choose a season's poster from TMDB" (issue
// #364).
//
// `POST /api/enrichment/current/seasons/:season/poster { path }` → `200
// SeasonChoice`: the chosen image streamed through `Media.storeNamed` into the
// Series folder as `S02-poster.jpg`, or `S02-poster-2.jpg` when that is the
// held poster's name, then `setSeasonPoster`'s upsert, and the replaced file
// removed: a new name is a new url, so the page draws the new image rather
// than the one it already loaded. `400` for a path not
// among that season's choices; `404` without a single-series run, or for a
// season it does not hold; `503` when TMDB is not reached, the poster left as
// it was. Each refusal `{ error }`.
//
// Composed over a real in-memory library, a real `Media` over a sandbox, and
// `fakeTmdb`, `routes.enrichmentDismiss.test.ts`' shape.

import express from 'express';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, posix } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import {
  ENRICH_FIELDS,
  type EnrichField,
  type EnrichmentRun,
  type SeasonChoice,
} from '@/types';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import type { TmdbSeason } from '../enrichment/tmdbClient/tmdbClient';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import {
  fakeTmdb,
  TMDB_KEY as KEY,
  tmdbImageBytes,
  tmdbSeason,
  tmdbTvDetail,
  tmdbTvResult,
  type FakeTmdb,
} from '../test-support/fakeTmdb/fakeTmdb';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';

const storages: LibraryStorage[] = [];
const servers: Server[] = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  for (const storage of storages.splice(0)) {
    storage.close();
  }
});

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
  1: tmdbSeason(1, [episodeOf(1)], { poster_path: '/s01-poster.jpg' }),
  2: tmdbSeason(2, [episodeOf(1)], { poster_path: '/s02-poster.jpg' }),
};

const image = (file_path: string, vote_average = 5) => ({
  file_path,
  vote_average,
});

function knowsTheShow(): FakeTmdb {
  return fakeTmdb({
    tvSearches: { [TITLE]: [tmdbTvResult(SHOW_ID, TITLE, 2018)] },
    shows: [tmdbTvDetail(SHOW_ID, TITLE, 2018)],
    seasons: { [SHOW_ID]: SEASONS },
    seasonImages: {
      [SHOW_ID]: {
        1: [image('/s01-a.jpg')],
        2: [image('/s02-a.jpg', 6), image('/s02-b.jpg', 4)],
      },
    },
    seriesImages: { [SHOW_ID]: [image('/show-1.jpg')] },
  });
}

async function freshApi(client: FakeTmdb = knowsTheShow()) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  storage.setTmdbKey(KEY);

  const root = sandboxRoot('familyflix-enrich-season-poster-api-');
  const media = createMedia(root);
  const playback = createPlayback(root, fixedSlot(null), () => null);
  const enrichment = createEnrichment({ storage, client, media, playback });

  const reserved = media.reserveFolder(TITLE, 2018);
  const series = storage.addSeries({ title: TITLE, year: 2018 });
  let video = '';
  for (const season of [1, 2]) {
    video = await media.storeUpload(
      media.seasonFolder(reserved, season),
      `S0${season}E01.mkv`,
      Readable.from([Buffer.from('video bytes')])
    );
    storage.addEpisode(series.id, { season, number: 1, videoPath: video });
  }
  const folder = posix.dirname(posix.dirname(video));

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      root,
      playback,
      media,
      createImporter({ storage, media, playback }),
      enrichment
    )
  );
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return {
    storage,
    client,
    root,
    folder,
    seriesId: series.id,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

type Api = Awaited<ReturnType<typeof freshApi>>;

const getCurrent = (baseUrl: string) =>
  fetch(`${baseUrl}/api/enrichment/current`);

const postPoster = (
  baseUrl: string,
  season: number | string,
  body: unknown
): Promise<Response> =>
  fetch(`${baseUrl}/api/enrichment/current/seasons/${season}/poster`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function untilReview(baseUrl: string): Promise<EnrichmentRun> {
  return vi.waitFor(
    async () => {
      const response = await getCurrent(baseUrl);
      expect(response.status).toBe(200);
      const run = (await response.json()) as EnrichmentRun;
      expect(run.phase).toBe('review');
      return run;
    },
    { timeout: 10_000 }
  );
}

async function startSync(api: Api, body: Record<string, unknown>) {
  const started = await fetch(`${api.baseUrl}/api/enrichment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ writeSheet: false, writePosters: false, ...body }),
  });
  expect(started.status).toBe(201);
  return untilReview(api.baseUrl);
}

/** A single-series Sync over the show, in review. */
async function inReview({
  fields = ALL_FIELDS,
  client,
}: { fields?: EnrichField[]; client?: FakeTmdb } = {}) {
  const api = await freshApi(client);
  const run = await startSync(api, {
    scope: 'single',
    seriesId: api.seriesId,
    fields,
  });
  return { ...api, run };
}

const seasonPosterRead = (api: Api, season: number) =>
  api.storage
    .getSeriesDetail(api.seriesId)
    ?.seasons.find((each) => each.number === season)?.posterPath ?? null;

const storedBytes = (api: Api, season: number, name = `S0${season}-poster`) =>
  readFileSync(join(api.root, `${api.folder}/${name}.jpg`), 'utf8');

async function errorOf(response: Response): Promise<string> {
  const { error } = (await response.json()) as { error: unknown };
  expect(typeof error).toBe('string');
  return error as string;
}

describe('POST /api/enrichment/current/seasons/:season/poster — 200', () => {
  it('stores the chosen image as S02-poster-2.jpg beside the held S02-poster.jpg, removes that, and the series page reads it', async () => {
    const api = await inReview();
    expect(storedBytes(api, 2)).toBe(tmdbImageBytes('/s02-poster.jpg'));

    const response = await postPoster(api.baseUrl, 2, { path: '/s02-b.jpg' });

    expect(response.status).toBe(200);
    expect(storedBytes(api, 2, 'S02-poster-2')).toBe(
      tmdbImageBytes('/s02-b.jpg')
    );
    expect(seasonPosterRead(api, 2)).toBe(`${api.folder}/S02-poster-2.jpg`);
    expect(() => storedBytes(api, 2)).toThrow();
    // The other season is left as it was.
    expect(storedBytes(api, 1)).toBe(tmdbImageBytes('/s01-poster.jpg'));
  });

  it('answers the season’s Season choice: its poster through the image route, its choices kept', async () => {
    const api = await inReview();
    const before = api.run.seasons?.find((each) => each.season === 2);

    const response = await postPoster(api.baseUrl, 2, { path: '/s02-a.jpg' });

    const echo = (await response.json()) as SeasonChoice;
    expect(echo.season).toBe(2);
    expect(echo.posterUrl).toBe(`/api/images/${api.folder}/S02-poster-2.jpg`);
    expect(echo.choices).toEqual(before?.choices);
  });

  it('answers a new url for every choice taken, back to S02-poster.jpg on the next', async () => {
    const api = await inReview();

    await postPoster(api.baseUrl, 2, { path: '/s02-a.jpg' });
    const response = await postPoster(api.baseUrl, 2, { path: '/s02-b.jpg' });

    const echo = (await response.json()) as SeasonChoice;
    expect(echo.posterUrl).toBe(`/api/images/${api.folder}/S02-poster.jpg`);
    expect(storedBytes(api, 2)).toBe(tmdbImageBytes('/s02-b.jpg'));
    expect(() => storedBytes(api, 2, 'S02-poster-2')).toThrow();
  });

  it('takes one of the series’ posters for a season too', async () => {
    const api = await inReview();

    const response = await postPoster(api.baseUrl, 1, { path: '/show-1.jpg' });

    expect(response.status).toBe(200);
    expect(storedBytes(api, 1, 'S01-poster-2')).toBe(
      tmdbImageBytes('/show-1.jpg')
    );
  });

  it('gives a season with no poster yet its first one', async () => {
    const api = await inReview({ fields: NO_POSTER });
    expect(seasonPosterRead(api, 2)).toBeNull();

    const response = await postPoster(api.baseUrl, 2, { path: '/s02-a.jpg' });

    expect(response.status).toBe(200);
    const echo = (await response.json()) as SeasonChoice;
    expect(echo.posterUrl).toBe(`/api/images/${api.folder}/S02-poster.jpg`);
    expect(seasonPosterRead(api, 2)).toBe(`${api.folder}/S02-poster.jpg`);
    expect(storedBytes(api, 2)).toBe(tmdbImageBytes('/s02-a.jpg'));
  });

  it('keeps the run’s Season choice in step, so a re-read draws the same', async () => {
    const api = await inReview({ fields: NO_POSTER });

    const echo = (await (
      await postPoster(api.baseUrl, 2, { path: '/s02-a.jpg' })
    ).json()) as SeasonChoice;

    const after = (await (
      await getCurrent(api.baseUrl)
    ).json()) as EnrichmentRun;
    expect(after.seasons?.find((each) => each.season === 2)).toEqual(echo);
  });
});

describe('POST /api/enrichment/current/seasons/:season/poster — 400', () => {
  it.each([
    ['a path TMDB never offered', { path: '/elsewhere.jpg' }],
    ['another season’s path', { path: '/s01-a.jpg' }],
    ['no path at all', {}],
    ['a path that is not a string', { path: 7 }],
  ])('refuses %s, fetching nothing and leaving the poster', async (_, body) => {
    const api = await inReview();
    api.client.image.mockClear();

    const response = await postPoster(api.baseUrl, 2, body);

    expect(response.status).toBe(400);
    expect(await errorOf(response)).toMatch(/^[A-Z].*\.$/);
    expect(api.client.image).not.toHaveBeenCalled();
    expect(storedBytes(api, 2)).toBe(tmdbImageBytes('/s02-poster.jpg'));
  });
});

describe('POST /api/enrichment/current/seasons/:season/poster — 404', () => {
  it('answers 404 when there is no run', async () => {
    const api = await freshApi();

    const response = await postPoster(api.baseUrl, 2, { path: '/s02-a.jpg' });

    expect(response.status).toBe(404);
    await errorOf(response);
  });

  it('answers 404 for a library-wide run, which offers no seasons', async () => {
    const api = await freshApi();
    const run = await startSync(api, { scope: 'all', fields: ALL_FIELDS });
    expect(run.seasons).toBeUndefined();

    const response = await postPoster(api.baseUrl, 2, { path: '/s02-a.jpg' });

    expect(response.status).toBe(404);
    await errorOf(response);
  });

  it('answers 404 for a season the run does not hold', async () => {
    const api = await inReview();

    const response = await postPoster(api.baseUrl, 9, { path: '/s02-a.jpg' });

    expect(response.status).toBe(404);
    await errorOf(response);
  });
});

describe('POST /api/enrichment/current/seasons/:season/poster — 503', () => {
  it('answers 503 when TMDB is not reached, the poster left as it was', async () => {
    const client = knowsTheShow();
    const real = client.image.getMockImplementation();
    if (real === undefined) throw new Error('no image implementation');
    client.image.mockImplementation((path, signal) =>
      path === '/s02-b.jpg'
        ? Promise.resolve({ kind: 'unreachable' } as const)
        : real(path, signal)
    );
    const api = await inReview({ client });

    const response = await postPoster(api.baseUrl, 2, { path: '/s02-b.jpg' });

    expect(response.status).toBe(503);
    await errorOf(response);
    expect(storedBytes(api, 2)).toBe(tmdbImageBytes('/s02-poster.jpg'));
    expect(seasonPosterRead(api, 2)).toBe(`${api.folder}/S02-poster.jpg`);
    const after = (await (
      await getCurrent(api.baseUrl)
    ).json()) as EnrichmentRun;
    expect(after.seasons).toEqual(api.run.seasons);
  });
});
