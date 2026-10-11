// @vitest-environment node
//
// 38 — Title editing, Slice 7 (issue #310): the **Series Resolve** over the
// wire.
//
// A show's unnumbered files are one `unplaced` **Problem** per show, and its
// _Resolve_ posts the series form to the one resolve route,
// `POST /api/import/current/problems/:id/resolve`. For an `unplaced` Problem
// the route reads the body with `seriesFormBody` — the series fields, then
// each episode as its `episode` JSON field, a **Found file** as that field's
// `videoPath` — and with `movieFormBody` for every other kind, as before.
// `found` paths copy only from under the run's root. A save creates the
// series, or joins the one the run already holds, records each episode's
// **Source file**, and takes the Problem off the list.
//
// Over a real listener, a real `fetch`, a real `:memory:` library, a real
// managed directory and a root built here: Die Hard's folder beside a **Show
// folder** whose **Season folder** the test lays out.

import express from 'express';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { LIBRARY_FIXTURE } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ImportProblem, ImportRun, Series } from '@/types';

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

const SHOW = 'Lighthouse Keepers (2019)';
const SEASON = 'Season 01';

const SHEET = [
  'Title,Year,Genre,Director,Actors,Description,Rating,Watched',
  'Die Hard,1988,Action / Thriller,John McTiernan,"Bruce Willis, Alan Rickman",A New York cop takes on a tower full of thieves on Christmas Eve.,8,yes',
  'Lighthouse Keepers,2019,Drama,Mara Quinn,Lena Ortiz,Two sisters keep the last manned light on the coast.,9,',
].join('\n');

/** The fixture's film header — every episode video here is a copy of it. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

/**
 * A fresh library behind a listening API, a root holding Die Hard and the
 * show's Season folder laid out from `episodes`, and the sheet naming both.
 */
function freshApi(episodes: string[]): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  root: string;
  sheet: string;
  season: string;
  scratch: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-series-resolve-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const scratch = join(dir, 'scratch');
  mkdirSync(scratch);

  const root = join(dir, 'root');
  cpSync(
    join(LIBRARY_FIXTURE, 'root', 'Die.Hard.1988.1080p'),
    join(root, 'Die.Hard.1988.1080p'),
    { recursive: true }
  );
  const season = join(root, SHOW, SEASON);
  mkdirSync(season, { recursive: true });
  for (const video of episodes) {
    cpSync(HEADER, join(season, video));
  }
  const sheet = join(dir, 'library.csv');
  writeFileSync(sheet, SHEET);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({ storage, client: offlineTmdb(), media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    media,
    root,
    sheet,
    season,
    scratch,
  };
}

const getCurrent = async (baseUrl: string): Promise<ImportRun> =>
  (await (await fetch(`${baseUrl}/api/import/current`)).json()) as ImportRun;

/** The snapshot once the run has reached review — or a failure if it never does. */
async function untilReview(baseUrl: string): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await fetch(`${baseUrl}/api/import/current`);
    const run =
      response.status === 200 ? ((await response.json()) as ImportRun) : null;
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** The run imported over `api`'s sheet and root, and its one `unplaced` Problem. */
async function unplacedProblem(
  api: ReturnType<typeof freshApi>
): Promise<ImportProblem> {
  await fetch(`${api.baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath: api.sheet, rootPath: api.root }),
  });
  const run = await untilReview(api.baseUrl);
  const unplaced = run.problems.filter(({ kind }) => kind === 'unplaced');
  if (unplaced.length !== 1) {
    throw new Error(`expected one unplaced problem: ${JSON.stringify(run)}`);
  }
  return unplaced[0];
}

/** One `episode` field of the series body, its video a Found file's path. */
const episodeField = (
  season: number,
  number: number,
  title: string,
  videoPath: string
): [string, string] => [
  'episode',
  JSON.stringify({
    season,
    number,
    title,
    subtitleLanguages: [],
    videoPath,
  }),
];

/** _Save & continue_ on the Series Resolve: the fields, then each episode. */
function postResolve(
  baseUrl: string,
  id: string,
  episodes: [string, string][]
): Promise<Response> {
  const body = new FormData();
  body.append('title', 'Lighthouse Keepers');
  body.append('year', '2019');
  body.append('creator', 'Mara Quinn');
  body.append('genre', 'Drama');
  for (const [name, value] of episodes) {
    body.append(name, value);
  }
  return fetch(
    `${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}/resolve`,
    { method: 'POST', body }
  );
}

const allSeries = (storage: LibraryStorage): Series[] =>
  storage.getSeriesHome().series;

/** Each episode of the library's one series, as `[season, number, sourceFile]`. */
function episodesOfTheSeries(
  storage: LibraryStorage
): [number, number, string | null][] {
  const [series] = allSeries(storage);
  return storage
    .listEpisodes(series.id)
    .map((episode) => [episode.season, episode.number, episode.sourceFile]);
}

describe('the Series Resolve — a show the library does not hold yet', () => {
  const STRAYS = ['Bonus One.mp4', 'Bonus Two.mp4'];

  it('creates the series from the form, each found video an episode, and answers 201', async () => {
    const api = freshApi(STRAYS);
    const problem = await unplacedProblem(api);
    expect(allSeries(api.storage)).toEqual([]);

    const response = await postResolve(api.baseUrl, problem.id, [
      episodeField(1, 1, 'Bonus One', join(api.season, 'Bonus One.mp4')),
      episodeField(1, 2, 'Bonus Two', join(api.season, 'Bonus Two.mp4')),
    ]);

    expect(response.status).toBe(201);
    expect(allSeries(api.storage).map((series) => series.title)).toEqual([
      'Lighthouse Keepers',
    ]);
    const [series] = allSeries(api.storage);
    const episodes = api.storage.listEpisodes(series.id);
    expect(episodes.map((episode) => [episode.season, episode.number])).toEqual(
      [
        [1, 1],
        [1, 2],
      ]
    );
    // Copied in, not referenced where they lay.
    for (const episode of episodes) {
      expect(existsSync(join(api.media, episode.videoPath))).toBe(true);
    }
  });

  it('records each episode’s Source file, relative to the Show folder', async () => {
    const api = freshApi(STRAYS);
    const problem = await unplacedProblem(api);

    await postResolve(api.baseUrl, problem.id, [
      episodeField(1, 1, 'Bonus One', join(api.season, 'Bonus One.mp4')),
      episodeField(1, 2, 'Bonus Two', join(api.season, 'Bonus Two.mp4')),
    ]);

    expect(episodesOfTheSeries(api.storage)).toEqual([
      [1, 1, `${SEASON}/Bonus One.mp4`],
      [1, 2, `${SEASON}/Bonus Two.mp4`],
    ]);
  });

  it('takes the Problem off the list', async () => {
    const api = freshApi(STRAYS);
    const problem = await unplacedProblem(api);

    const response = await postResolve(api.baseUrl, problem.id, [
      episodeField(1, 1, 'Bonus One', join(api.season, 'Bonus One.mp4')),
      episodeField(1, 2, 'Bonus Two', join(api.season, 'Bonus Two.mp4')),
    ]);

    expect(response.status).toBe(201);
    expect((await getCurrent(api.baseUrl)).problems).toEqual([]);
    expect(
      (
        await fetch(
          `${api.baseUrl}/api/import/current/problems/${encodeURIComponent(problem.id)}`
        )
      ).status
    ).toBe(404);
  });

  it('refuses a found path outside the run’s root with 400, writing and copying nothing', async () => {
    const api = freshApi(STRAYS);
    const problem = await unplacedProblem(api);
    const outside = join(api.scratch, 'elsewhere.mp4');
    cpSync(HEADER, outside);

    const response = await postResolve(api.baseUrl, problem.id, [
      episodeField(1, 1, 'Bonus One', join(api.season, 'Bonus One.mp4')),
      episodeField(1, 2, 'Elsewhere', outside),
    ]);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(allSeries(api.storage)).toEqual([]);
    // Die Hard's is the one folder the run made; the refusal made none.
    expect(readdirSync(api.media)).toEqual(['die-hard-1988']);
    expect(
      (await getCurrent(api.baseUrl)).problems.map(({ id }) => id)
    ).toEqual([problem.id]);
  });
});

describe('the Series Resolve — joining the series the run already holds', () => {
  const MIXED = ['Lighthouse.Keepers.S01E01.First.Light.mp4', 'Bonus One.mp4'];

  it('adds the found video to the held series rather than making a second', async () => {
    const api = freshApi(MIXED);
    const problem = await unplacedProblem(api);
    const [held] = allSeries(api.storage);
    expect(held).toBeDefined();

    const response = await postResolve(api.baseUrl, problem.id, [
      episodeField(1, 2, 'Bonus One', join(api.season, 'Bonus One.mp4')),
    ]);

    expect(response.status).toBe(201);
    expect(allSeries(api.storage).map((series) => series.id)).toEqual([
      held.id,
    ]);
    expect(episodesOfTheSeries(api.storage)).toEqual([
      [1, 1, `${SEASON}/Lighthouse.Keepers.S01E01.First.Light.mp4`],
      [1, 2, `${SEASON}/Bonus One.mp4`],
    ]);
    expect((await getCurrent(api.baseUrl)).problems).toEqual([]);
  });

  it('refuses a number the held series already has with 400, changing nothing', async () => {
    const api = freshApi(MIXED);
    const problem = await unplacedProblem(api);

    const response = await postResolve(api.baseUrl, problem.id, [
      episodeField(1, 1, 'Bonus One', join(api.season, 'Bonus One.mp4')),
    ]);

    expect(response.status).toBe(400);
    // The refusal names the number, as the form's other episode refusals do.
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining('S01E01'),
    });
    expect(episodesOfTheSeries(api.storage)).toEqual([
      [1, 1, `${SEASON}/Lighthouse.Keepers.S01E01.First.Light.mp4`],
    ]);
    expect(
      (await getCurrent(api.baseUrl)).problems.map(({ id }) => id)
    ).toEqual([problem.id]);
  });
});
