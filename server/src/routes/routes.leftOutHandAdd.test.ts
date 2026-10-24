// @vitest-environment node
//
// 51 — Library audit, Phase 11: "removed episodes stay out, a hand add brings
// back" (issue #454).
//
// The last writer of the **Left-out videos**, and their clearing:
//
// - the **Series edit job** (`PATCH /api/series/:id`) records each removed
//   episode's video: a **Linked video** as it lies, a copied one as its
//   **Source folder**'s **Source file**; a rescan leaves it out;
// - a **Movie form** add (`POST /api/movies`) of a left-out video adds it and
//   clears its entry;
// - a **Show folder pick** add (`POST /api/series`) adds its left-out videos
//   and clears their entries, and only theirs;
// - a later **Folder scan** does not skip what a hand add brought back.
//
// End to end over the real router: a real library, a real `Media` over a
// sandbox managed directory, and one listed Library folder.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
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
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { Episode, ImportMode, ImportRun, LibraryTitles } from '@/types';

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

/** The bytes of an MP4 that reports its own length (`ftyp`, `moov`/`mvhd`). */
function mp4Of(seconds: number): Buffer {
  const mvhd = Buffer.alloc(100);
  mvhd.writeUInt8(0, 0);
  mvhd.writeUInt32BE(1000, 12);
  mvhd.writeUInt32BE(Math.round(seconds * 1000), 16);

  const box = (type: string, payload: Buffer): Buffer => {
    const header = Buffer.alloc(8);
    header.writeUInt32BE(8 + payload.length, 0);
    header.write(type, 4, 'latin1');
    return Buffer.concat([header, payload]);
  };

  return Buffer.concat([
    box('ftyp', Buffer.from('isom', 'latin1')),
    box('moov', box('mvhd', mvhd)),
  ]);
}

/** A video at a path under a root, its directories made; its absolute path. */
function place(root: string, relative: string): string {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, mp4Of(2520));
  return file;
}

const COCO = 'Coco (2017)/Coco.mp4';
const HEAT = 'Heat (1995)/Heat.mp4';
const PILOT = 'Tidewater (2018)/Tidewater.S01E01.mp4';
const SECOND = 'Tidewater (2018)/Tidewater.S01E02.mp4';
const THIRD = 'Tidewater (2018)/Tidewater.S01E03.mp4';

/** A fresh library behind the router, one Library folder listed. */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-left-out-hand-add-');
  const media = join(root, 'media');
  const library = join(root, 'Library');
  mkdirSync(media);
  mkdirSync(library);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) => storage.libraryFolders().find((f) => f.id === id)?.path ?? null
  );

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({
        storage,
        client: offlineTmdb(),
        media: mediaDomain,
        playback,
      })
    )
  );
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  const listed = await fetch(`${baseUrl}/api/library-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path: library }),
  });
  expect(listed.status).toBe(201);
  const folderId = storage.libraryFolders()[0].id;

  return { baseUrl, storage, library, folderId };
}

type Api = Awaited<ReturnType<typeof freshApi>>;

/** A Folder scan in the given Import mode, waited out to its review. */
async function scanToReview(api: Api, mode: ImportMode): Promise<ImportRun> {
  const started = await fetch(`${api.baseUrl}/api/library-folders/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrich: false, mode }),
  });
  expect(started.status).toBe(201);
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await fetch(`${api.baseUrl}/api/import/current`);
    if (response.status === 200) {
      const run = (await response.json()) as ImportRun;
      if (run.phase === 'review') {
        return run;
      }
    }
    if (Date.now() > deadline) {
      throw new Error('the run never reached review');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function titles(api: Api): Promise<LibraryTitles> {
  const response = await fetch(`${api.baseUrl}/api/library-titles`);
  expect(response.status).toBe(200);
  return (await response.json()) as LibraryTitles;
}

async function filmId(api: Api, title: string): Promise<string> {
  const found = (await titles(api)).movies.find((m) => m.title === title);
  if (found === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return found.id;
}

async function seriesId(api: Api, title: string): Promise<string> {
  const found = (await titles(api)).series.find((s) => s.title === title);
  if (found === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return found.id;
}

async function remove(api: Api, path: string): Promise<void> {
  const response = await fetch(`${api.baseUrl}/api/${path}`, {
    method: 'DELETE',
  });
  expect(response.status).toBe(204);
}

const leftOut = (api: Api): string[] =>
  [...api.storage.leftOut(api.folderId)].sort();

const LEFT_OUT_LINE = /^· Left out \d+ videos? you deleted earlier$/;

const logOf = (run: ImportRun): string[] => run.log.map((line) => line.text);

type Part = [name: string, value: string | File];

function send(
  api: Api,
  method: 'POST' | 'PATCH',
  path: string,
  parts: Part[]
): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(`${api.baseUrl}/api/${path}`, { method, body });
}

const seriesFields = (title: string, year: string): Part[] => [
  ['title', title],
  ['year', year],
  ['creator', ''],
  ['description', ''],
  ['rating', ''],
];

const filmFields = (title: string, year: string): Part[] => [
  ['title', title],
  ['year', year],
  ['director', ''],
  ['description', ''],
  ['rating', ''],
];

/** A held episode's `episode` field, its video as the path it has. */
const heldEpisode = (episode: Episode): Part => [
  'episode',
  JSON.stringify({
    id: episode.id,
    season: episode.season,
    number: episode.number,
    title: episode.title ?? '',
    videoPath: episode.videoPath,
    storedSubtitles: [],
    subtitleLanguages: [],
  }),
];

/** A Show folder pick's row: a found video, by its absolute path. */
const foundEpisode = (number: number, videoPath: string): Part => [
  'episode',
  JSON.stringify({
    season: 1,
    number,
    title: `Episode ${number}`,
    subtitleLanguages: [],
    videoPath,
    storedSubtitles: [],
  }),
];

/** The Series edit job's save, keeping only the held episodes numbered. */
async function keepOnly(
  api: Api,
  id: string,
  numbers: readonly number[]
): Promise<void> {
  const held = api.storage.listEpisodes(id);
  const response = await send(api, 'PATCH', `series/${id}`, [
    ...seriesFields('Tidewater', '2018'),
    ...held
      .filter((episode) => numbers.includes(episode.number))
      .map(heldEpisode),
  ]);
  expect(response.status).toBe(200);
}

const episodeNumbers = (api: Api, id: string): number[] =>
  api.storage.listEpisodes(id).map((episode) => episode.number);

describe('an episode removed in the Series edit job stays out', () => {
  it('records a removed linked episode’s video', async () => {
    const api = await freshApi();
    place(api.library, PILOT);
    place(api.library, SECOND);
    await scanToReview(api, 'link');

    await keepOnly(api, await seriesId(api, 'Tidewater'), [1]);

    expect(leftOut(api)).toEqual([SECOND]);
  });

  it('records a removed copied episode’s Source file', async () => {
    const api = await freshApi();
    place(api.library, PILOT);
    place(api.library, SECOND);
    await scanToReview(api, 'copy');

    await keepOnly(api, await seriesId(api, 'Tidewater'), [1]);

    expect(leftOut(api)).toEqual([SECOND]);
  });

  it('keeps a removed linked episode out of the next Folder scan', async () => {
    const api = await freshApi();
    place(api.library, PILOT);
    place(api.library, SECOND);
    await scanToReview(api, 'link');
    const id = await seriesId(api, 'Tidewater');
    await keepOnly(api, id, [1]);

    const run = await scanToReview(api, 'link');

    expect(episodeNumbers(api, id)).toEqual([1]);
    expect(logOf(run)).toContainEqual(expect.stringMatching(LEFT_OUT_LINE));
  });

  it('keeps a removed copied episode out of the next Folder scan', async () => {
    const api = await freshApi();
    place(api.library, PILOT);
    place(api.library, SECOND);
    await scanToReview(api, 'copy');
    const id = await seriesId(api, 'Tidewater');
    await keepOnly(api, id, [1]);

    await scanToReview(api, 'copy');

    expect(episodeNumbers(api, id)).toEqual([1]);
  });
});

describe('a Movie form add brings a left-out video back', () => {
  it('adds a left-out video linked, and clears its entry', async () => {
    const api = await freshApi();
    const coco = place(api.library, COCO);
    place(api.library, HEAT);
    await scanToReview(api, 'link');
    await remove(api, `movies/${await filmId(api, 'Coco')}`);
    expect(leftOut(api)).toEqual([COCO]);

    const response = await send(api, 'POST', 'movies', [
      ['mode', 'link'],
      ...filmFields('Coco', '2017'),
      ['videoPath', coco],
    ]);

    expect(response.status).toBe(201);
    expect((await titles(api)).movies.map((m) => m.title).sort()).toEqual([
      'Coco',
      'Heat',
    ]);
    expect(leftOut(api)).toEqual([]);
  });

  it('adds a left-out video copied, and clears its entry', async () => {
    const api = await freshApi();
    const coco = place(api.library, COCO);
    await scanToReview(api, 'copy');
    await remove(api, `movies/${await filmId(api, 'Coco')}`);
    expect(leftOut(api)).toEqual([COCO]);

    const response = await send(api, 'POST', 'movies', [
      ['mode', 'copy'],
      ...filmFields('Coco', '2017'),
      ['videoPath', coco],
    ]);

    expect(response.status).toBe(201);
    expect(leftOut(api)).toEqual([]);
  });

  it('clears only the entry of the video it adds', async () => {
    const api = await freshApi();
    const coco = place(api.library, COCO);
    place(api.library, HEAT);
    await scanToReview(api, 'link');
    await remove(api, `movies/${await filmId(api, 'Coco')}`);
    await remove(api, `movies/${await filmId(api, 'Heat')}`);

    const response = await send(api, 'POST', 'movies', [
      ['mode', 'link'],
      ...filmFields('Coco', '2017'),
      ['videoPath', coco],
    ]);

    expect(response.status).toBe(201);
    expect(leftOut(api)).toEqual([HEAT]);
  });
});

describe('a Show folder pick brings its left-out videos back', () => {
  it('adds its left-out videos, and clears their entries', async () => {
    const api = await freshApi();
    const pilot = place(api.library, PILOT);
    const second = place(api.library, SECOND);
    await scanToReview(api, 'link');
    await remove(api, `series/${await seriesId(api, 'Tidewater')}`);
    expect(leftOut(api)).toEqual([PILOT, SECOND]);

    const response = await send(api, 'POST', 'series', [
      ['mode', 'link'],
      ...seriesFields('Tidewater', '2018'),
      foundEpisode(1, pilot),
      foundEpisode(2, second),
    ]);

    expect(response.status).toBe(201);
    const id = await seriesId(api, 'Tidewater');
    expect(episodeNumbers(api, id)).toEqual([1, 2]);
    expect(leftOut(api)).toEqual([]);
  });

  it('clears only the entries of the videos it adds', async () => {
    const api = await freshApi();
    const pilot = place(api.library, PILOT);
    place(api.library, SECOND);
    await scanToReview(api, 'link');
    await remove(api, `series/${await seriesId(api, 'Tidewater')}`);

    const response = await send(api, 'POST', 'series', [
      ['mode', 'link'],
      ...seriesFields('Tidewater', '2018'),
      foundEpisode(1, pilot),
    ]);

    expect(response.status).toBe(201);
    expect(leftOut(api)).toEqual([SECOND]);
  });
});

describe('a later scan does not skip what a hand add brought back', () => {
  it('leaves nothing out after a Movie form add of the deleted film', async () => {
    const api = await freshApi();
    const coco = place(api.library, COCO);
    place(api.library, HEAT);
    await scanToReview(api, 'link');
    await remove(api, `movies/${await filmId(api, 'Coco')}`);
    const added = await send(api, 'POST', 'movies', [
      ['mode', 'link'],
      ...filmFields('Coco', '2017'),
      ['videoPath', coco],
    ]);
    expect(added.status).toBe(201);

    const run = await scanToReview(api, 'link');

    expect(logOf(run)).not.toContainEqual(expect.stringMatching(LEFT_OUT_LINE));
    expect((await titles(api)).movies.map((m) => m.title).sort()).toEqual([
      'Coco',
      'Heat',
    ]);
  });

  it('adds a brought-back show’s new episode on the next scan', async () => {
    const api = await freshApi();
    const pilot = place(api.library, PILOT);
    const second = place(api.library, SECOND);
    await scanToReview(api, 'link');
    await remove(api, `series/${await seriesId(api, 'Tidewater')}`);
    const added = await send(api, 'POST', 'series', [
      ['mode', 'link'],
      ...seriesFields('Tidewater', '2018'),
      foundEpisode(1, pilot),
      foundEpisode(2, second),
    ]);
    expect(added.status).toBe(201);
    place(api.library, THIRD);

    const run = await scanToReview(api, 'link');

    expect(logOf(run)).not.toContainEqual(expect.stringMatching(LEFT_OUT_LINE));
    expect(episodeNumbers(api, await seriesId(api, 'Tidewater'))).toEqual([
      1, 2, 3,
    ]);
  });
});
