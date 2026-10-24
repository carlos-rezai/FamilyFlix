// @vitest-environment node
//
// 51 — Library audit, Phase 12: "Bring back on Library folders" (issue #455).
//
// The Library folders routes and a folder's **Left-out videos**:
//
// - `GET /api/library-folders` gives each folder its `leftOut` count
//   (`LibraryFolderView.leftOut`);
// - `DELETE /api/library-folders/:id/left-out` (**Bring back**) forgets that
//   folder's entries and answers `204`, so the next **Folder scan** adds the
//   videos again;
// - removing a Library folder removes its entries with it.
//
// End to end over the real router: a real library, a real `Media` over a
// sandbox managed directory, and listed Library folders.

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
import type { ImportRun, LibraryTitles } from '@/types';

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

/** A file at a path under a root, its directories made. */
function place(root: string, relative: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'bytes');
}

/** One folder as the list answers it, `leftOut` included. */
interface ListedFolder {
  id: string;
  path: string;
  leftOut: number;
}

/** A fresh library behind the router, its two Library folders on disk. */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-bring-back-');
  const media = join(root, 'media');
  const movies = join(root, 'Movies');
  const kids = join(root, 'Kids');
  mkdirSync(media);
  mkdirSync(movies);
  mkdirSync(kids);

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

  return { baseUrl, storage, movies, kids };
}

type Api = Awaited<ReturnType<typeof freshApi>>;

/** List one folder by path through the route, answering its id. */
async function listFolder(api: Api, path: string): Promise<string> {
  const response = await fetch(`${api.baseUrl}/api/library-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  expect(response.status).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

async function folders(api: Api): Promise<ListedFolder[]> {
  const response = await fetch(`${api.baseUrl}/api/library-folders`);
  expect(response.status).toBe(200);
  return (await response.json()) as ListedFolder[];
}

async function bringBack(api: Api, folderId: string): Promise<Response> {
  return fetch(
    `${api.baseUrl}/api/library-folders/${encodeURIComponent(folderId)}/left-out`,
    { method: 'DELETE' }
  );
}

/** A linking Folder scan, waited out to its review. */
async function scanToReview(api: Api): Promise<ImportRun> {
  const started = await fetch(`${api.baseUrl}/api/library-folders/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrich: false, mode: 'link' }),
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

async function filmTitles(api: Api): Promise<string[]> {
  const response = await fetch(`${api.baseUrl}/api/library-titles`);
  expect(response.status).toBe(200);
  const titles = (await response.json()) as LibraryTitles;
  return titles.movies.map((m) => m.title).sort();
}

describe('the Library folders list carries each folder’s left-out count', () => {
  it('counts each folder’s Left-out videos, and 0 for a folder with none', async () => {
    const api = await freshApi();
    const movies = await listFolder(api, api.movies);
    const kids = await listFolder(api, api.kids);
    api.storage.leaveOut([
      { folderId: movies, videoPath: 'Coco (2017)/Coco.mkv' },
      { folderId: movies, videoPath: 'Heat (1995)/Heat.mkv' },
    ]);

    const listed = await folders(api);

    expect(listed.find((f) => f.id === movies)?.leftOut).toBe(2);
    expect(listed.find((f) => f.id === kids)?.leftOut).toBe(0);
  });
});

describe('Bring back: DELETE /api/library-folders/:id/left-out', () => {
  it('answers 204 and the list then counts none left out', async () => {
    const api = await freshApi();
    const movies = await listFolder(api, api.movies);
    api.storage.leaveOut([
      { folderId: movies, videoPath: 'Coco (2017)/Coco.mkv' },
    ]);

    const response = await bringBack(api, movies);

    expect(response.status).toBe(204);
    expect((await folders(api)).find((f) => f.id === movies)?.leftOut).toBe(0);
  });

  it('forgets only that folder’s entries', async () => {
    const api = await freshApi();
    const movies = await listFolder(api, api.movies);
    const kids = await listFolder(api, api.kids);
    api.storage.leaveOut([
      { folderId: movies, videoPath: 'Coco (2017)/Coco.mkv' },
      { folderId: kids, videoPath: 'Up (2009)/Up.mkv' },
    ]);

    expect((await bringBack(api, movies)).status).toBe(204);

    expect([...api.storage.leftOut(kids)]).toEqual(['Up (2009)/Up.mkv']);
  });

  it('lets the next Folder scan add a deleted film again', async () => {
    const api = await freshApi();
    const movies = await listFolder(api, api.movies);
    place(api.movies, 'Coco (2017)/Coco.mkv');
    place(api.movies, 'Heat (1995)/Heat.mkv');
    await scanToReview(api);
    const titles = (await (
      await fetch(`${api.baseUrl}/api/library-titles`)
    ).json()) as LibraryTitles;
    const coco = titles.movies.find((m) => m.title === 'Coco');
    expect(coco).toBeDefined();
    const removed = await fetch(`${api.baseUrl}/api/movies/${coco?.id}`, {
      method: 'DELETE',
    });
    expect(removed.status).toBe(204);
    await scanToReview(api);
    expect(await filmTitles(api)).toEqual(['Heat']);

    expect((await bringBack(api, movies)).status).toBe(204);
    await scanToReview(api);

    expect(await filmTitles(api)).toEqual(['Coco', 'Heat']);
  });
});

describe('removing a Library folder removes its left-out entries', () => {
  it('lists the folder afresh with none left out, and a scan adds its videos', async () => {
    const api = await freshApi();
    const first = await listFolder(api, api.movies);
    place(api.movies, 'Coco (2017)/Coco.mkv');
    api.storage.leaveOut([
      { folderId: first, videoPath: 'Coco (2017)/Coco.mkv' },
    ]);

    const removed = await fetch(
      `${api.baseUrl}/api/library-folders/${encodeURIComponent(first)}`,
      { method: 'DELETE' }
    );
    expect(removed.status).toBe(204);
    expect([...api.storage.leftOut(first)]).toEqual([]);
    const again = await listFolder(api, api.movies);

    expect((await folders(api)).find((f) => f.id === again)?.leftOut).toBe(0);
    await scanToReview(api);
    expect(await filmTitles(api)).toEqual(['Coco']);
  });
});
