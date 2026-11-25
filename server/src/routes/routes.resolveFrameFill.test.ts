// @vitest-environment node
//
// 76, Whole add follow-up (issue #724): the Frame fill after a Series Resolve.
//
// `POST /api/import/current/problems/:id/resolve` for an `unplaced` Problem
// starts the router's **Frame fill** on the `Series` the importer answers and
// answers `201` without waiting, as `POST /series` does: the Stills land
// after. A join counts too, since the episodes it brings may be Still-less.
//
// Composed as `routes.seriesResolve.test.ts` is (a sheet Import of a root
// holding Die Hard and a Show folder whose Season folder the test lays out,
// over a real listener, a real `:memory:` library and a sandboxed media
// root), with the real `createFrameFill` over a scripted `frame` behind a
// door and a spy on its `fill`, as `routes.frameFill.test.ts` has.

import express from 'express';
import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { createFrameFill } from '../enrichment/createFrameFill/createFrameFill';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import {
  createPlayback,
  type Playback,
} from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { framelessPlayback } from '../test-support/framelessPlayback/framelessPlayback';
import { idleFrameFill } from '../test-support/idleFrameFill/idleFrameFill';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
import { LIBRARY_FIXTURE } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { unfittedArt } from '../test-support/unfittedArt/unfittedArt';
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

type Frame = Playback['frame'];

const SHOW = 'Lighthouse Keepers (2019)';
const SEASON = 'Season 01';

const SHEET = [
  'Title,Year,Genre,Director,Actors,Description,Rating,Watched',
  'Die Hard,1988,Action / Thriller,John McTiernan,"Bruce Willis, Alan Rickman",A New York cop takes on a tower full of thieves on Christmas Eve.,8,yes',
  'Lighthouse Keepers,2019,Drama,Mara Quinn,Lena Ortiz,Two sisters keep the last manned light on the coast.,9,',
].join('\n');

/** The fixture's film header: every episode video here is a copy of it. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die Hard (1988)',
  'Die.Hard.1988.1080p.mp4'
);

/** A door the scripted frame waits behind until it is opened. */
function door() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, opened };
}

/**
 * A fresh library behind a listening API, a root holding Die Hard and the
 * show's Season folder laid out from `episodes`, the sheet naming both, and
 * a Frame fill whose `frame` waits behind `held`, its `fill` spied on.
 */
function freshApi(episodes: string[]) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-resolve-frame-fill-');
  const media = join(dir, 'media');
  mkdirSync(media);

  const root = join(dir, 'root');
  cpSync(
    join(LIBRARY_FIXTURE, 'root', 'Die Hard (1988)'),
    join(root, 'Die Hard (1988)'),
    { recursive: true }
  );
  const season = join(root, SHOW, SEASON);
  mkdirSync(season, { recursive: true });
  for (const video of episodes) {
    cpSync(HEADER, join(season, video));
  }
  const sheet = join(dir, 'library.csv');
  writeFileSync(sheet, SHEET);

  const mediaDomain = createMedia(media, unfittedArt());
  // The router's own Playback has no component: it takes no frame.
  const playback = createPlayback(media, fixedSlot(null), () => null);

  const held = door();
  const frame = vi.fn<Frame>(async () => {
    await held.opened;
    return {
      kind: 'frame',
      picture: Readable.from([Buffer.from('a frame off the video')]),
    };
  });
  const realFill = createFrameFill({
    storage,
    media: mediaDomain,
    playback: framelessPlayback(frame),
  });
  const frameFill = { fill: vi.fn((id: string) => realFill.fill(id)) };

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({
        storage,
        media: mediaDomain,
        playback,
        librarySheet: idleLibrarySheet(),
        layoutFill: idleLayoutFill(),
        frameFill: idleFrameFill(),
      }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
        layoutFill: createLayoutFill({ storage, media: mediaDomain }),
      }),
      createLayoutFill({ storage, media: mediaDomain }),
      frameFill
    )
  );
  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    root,
    sheet,
    season,
    held,
    frame,
    frameFill,
  };
}

/** The snapshot once the run has reached review, or a failure if it never does. */
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

/** The run imported over `api`'s sheet, and its one `unplaced` Problem. */
async function unplacedProblem(
  api: ReturnType<typeof freshApi>
): Promise<ImportProblem> {
  api.storage.addLibraryFolder(api.root);
  await fetch(`${api.baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath: api.sheet, mode: 'copy' }),
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

/** Each episode of a series as `[S/E, still source or null]`. */
function stillSources(
  storage: LibraryStorage,
  id: string
): [string, string | null][] {
  const sources = storage.stillSourcesOf(id);
  return storage
    .listEpisodes(id)
    .map((episode) => [
      `S${episode.season}E${episode.number}`,
      episode.stillPath === null ? null : (sources.get(episode.id) ?? 'held'),
    ]);
}

describe('the Series Resolve: the Frame fill after a new show', () => {
  const STRAYS = ['Bonus One.mp4', 'Bonus Two.mp4'];

  it('starts the fill on the series it answers, answers 201 before the fill ends, and the Stills land after', async () => {
    const api = freshApi(STRAYS);
    const problem = await unplacedProblem(api);

    const response = await postResolve(api.baseUrl, problem.id, [
      episodeField(1, 1, 'Bonus One', join(api.season, 'Bonus One.mp4')),
      episodeField(1, 2, 'Bonus Two', join(api.season, 'Bonus Two.mp4')),
    ]);

    expect(response.status).toBe(201);
    const series = (await response.json()) as Series;
    expect(api.frameFill.fill).toHaveBeenCalledWith(series.id);
    // Answered while the first take is still held behind the door.
    expect(stillSources(api.storage, series.id)).toEqual([
      ['S1E1', null],
      ['S1E2', null],
    ]);

    await vi.waitFor(() => expect(api.frame).toHaveBeenCalledTimes(1));
    api.held.open();
    await vi.waitFor(() =>
      expect(stillSources(api.storage, series.id)).toEqual([
        ['S1E1', 'frame'],
        ['S1E2', 'frame'],
      ])
    );
    expect(api.frame).toHaveBeenCalledTimes(2);
  });
});

describe('the Series Resolve: the Frame fill after a join', () => {
  const MIXED = ['Lighthouse.Keepers.S01E01.First.Light.mp4', 'Bonus One.mp4'];

  it('starts the fill on the held series it joins, and its new episode gets a Frame still', async () => {
    const api = freshApi(MIXED);
    const problem = await unplacedProblem(api);
    const [held] = allSeries(api.storage);
    expect(held).toBeDefined();
    // The sheet Import started none.
    expect(api.frameFill.fill).not.toHaveBeenCalled();

    const response = await postResolve(api.baseUrl, problem.id, [
      episodeField(1, 2, 'Bonus One', join(api.season, 'Bonus One.mp4')),
    ]);

    expect(response.status).toBe(201);
    expect(api.frameFill.fill).toHaveBeenCalledWith(held.id);
    api.held.open();
    await vi.waitFor(() =>
      expect(stillSources(api.storage, held.id)).toEqual([
        ['S1E1', 'frame'],
        ['S1E2', 'frame'],
      ])
    );
  });
});
