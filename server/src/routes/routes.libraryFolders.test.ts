// @vitest-environment node
//
// 30 — Library folders, Phase 1: "a remembered list, end to end" (issue #268).
//
// The three list routes over a sandbox: a real listener, a real `fetch`, real
// directories on disk, over a real `:memory:` library.
//
// - `GET /api/library-folders` → `200 LibraryFolder[]` in the order added,
//   `reachable` read afresh on every request.
// - `POST /api/library-folders { path }` → `201 LibraryFolder`; `400` for an
//   empty path, a relative path or a path that is not a readable directory;
//   `409` for an overlap with a listed folder. Every refusal is one sentence.
// - `DELETE /api/library-folders/:id` → `204`, or `404` for an id not listed.

import express from 'express';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
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
import type { LibraryFolder } from '@/types';

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

interface Api {
  baseUrl: string;
  /** A sandbox the test makes the family's folders in. */
  disk: string;
}

/** A fresh library behind a listening API, composed the way `main.ts` is. */
function freshApi(): Api {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const sandbox = sandboxRoot('familyflix-folders-api-');
  const media = join(sandbox, 'media');
  mkdirSync(media);
  const disk = join(sandbox, 'disk');
  mkdirSync(disk);
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
  return { baseUrl: `http://127.0.0.1:${port}`, disk };
}

/** A directory under the sandbox's disk, made. */
function folder(api: Api, ...segments: string[]): string {
  const path = join(api.disk, ...segments);
  mkdirSync(path, { recursive: true });
  return path;
}

const list = async (api: Api): Promise<LibraryFolder[]> => {
  const response = await fetch(`${api.baseUrl}/api/library-folders`);
  expect(response.status).toBe(200);
  return (await response.json()) as LibraryFolder[];
};

const add = (api: Api, body: unknown) =>
  fetch(`${api.baseUrl}/api/library-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const addFolder = async (api: Api, path: string): Promise<LibraryFolder> =>
  (await (await add(api, { path })).json()) as LibraryFolder;

const remove = (api: Api, id: string) =>
  fetch(`${api.baseUrl}/api/library-folders/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

/** A refusal's one sentence. */
const sentence = async (response: Response): Promise<string> =>
  ((await response.json()) as { error: string }).error;

/** One sentence: it starts with a word and ends with a full stop. */
const ONE_SENTENCE = /^\S.*\.$/;

describe('GET /api/library-folders', () => {
  it('answers an empty list on a fresh library', async () => {
    const api = freshApi();

    expect(await list(api)).toEqual([]);
  });

  it('lists the folders in the order added, each reachable with no titles', async () => {
    const api = freshApi();
    const movies = folder(api, 'Movies');
    const kids = folder(api, 'Kids');
    await add(api, { path: movies });
    await add(api, { path: kids });

    expect(await list(api)).toEqual([
      { id: expect.any(String), path: movies, titleCount: 0, reachable: true },
      { id: expect.any(String), path: kids, titleCount: 0, reachable: true },
    ]);
  });

  it('reads reachable afresh: false once the directory is gone, still listed', async () => {
    const api = freshApi();
    const movies = folder(api, 'Movies');
    await add(api, { path: movies });
    expect((await list(api))[0]?.reachable).toBe(true);

    rmSync(movies, { recursive: true, force: true });

    expect(await list(api)).toEqual([
      expect.objectContaining({ path: movies, reachable: false }),
    ]);
  });
});

describe('POST /api/library-folders', () => {
  it('answers 201 with the folder it added', async () => {
    const api = freshApi();
    const movies = folder(api, 'Movies');

    const response = await add(api, { path: movies });

    expect(response.status).toBe(201);
    const added = (await response.json()) as LibraryFolder;
    expect(added).toEqual({
      id: expect.any(String),
      path: movies,
      titleCount: 0,
      reachable: true,
    });
    expect((await list(api)).map((listed) => listed.id)).toEqual([added.id]);
  });

  it.each([
    ['no path', {}],
    ['an empty path', { path: '' }],
    ['a blank path', { path: '   ' }],
    ['a path that is not a string', { path: 42 }],
  ])('answers 400 with a sentence for %s', async (_case, body) => {
    const api = freshApi();

    const response = await add(api, body);

    expect(response.status).toBe(400);
    expect(await sentence(response)).toMatch(ONE_SENTENCE);
    expect(await list(api)).toEqual([]);
  });

  it('answers 400 with a sentence for a relative path', async () => {
    const api = freshApi();

    const response = await add(api, { path: 'Movies\\Kids' });

    expect(response.status).toBe(400);
    expect(await sentence(response)).toMatch(ONE_SENTENCE);
    expect(await list(api)).toEqual([]);
  });

  it('answers 400, No folder at that path., for a path nothing is at', async () => {
    const api = freshApi();

    const response = await add(api, { path: join(api.disk, 'Gone') });

    expect(response.status).toBe(400);
    expect(await sentence(response)).toBe('No folder at that path.');
    expect(await list(api)).toEqual([]);
  });

  it('answers 400, No folder at that path., for a file', async () => {
    const api = freshApi();
    const file = join(api.disk, 'northwind.mkv');
    writeFileSync(file, 'not a folder');

    const response = await add(api, { path: file });

    expect(response.status).toBe(400);
    expect(await sentence(response)).toBe('No folder at that path.');
    expect(await list(api)).toEqual([]);
  });

  it('answers 409 for a folder already listed', async () => {
    const api = freshApi();
    const movies = folder(api, 'Movies');
    await add(api, { path: movies });

    const response = await add(api, { path: movies });

    expect(response.status).toBe(409);
    expect(await sentence(response)).toBe(
      'That folder is already in your library folders.'
    );
    expect(await list(api)).toHaveLength(1);
  });

  it('answers 409 naming the listed folder a new one is inside', async () => {
    const api = freshApi();
    const movies = folder(api, 'Movies');
    const kids = folder(api, 'Movies', 'Kids');
    await add(api, { path: movies });

    const response = await add(api, { path: kids });

    expect(response.status).toBe(409);
    expect(await sentence(response)).toBe(
      `That folder is inside ${movies}, which is already a library folder.`
    );
    expect(await list(api)).toHaveLength(1);
  });

  it('answers 409 naming the listed folder a new one holds', async () => {
    const api = freshApi();
    const movies = folder(api, 'Movies');
    const kids = folder(api, 'Movies', 'Kids');
    await add(api, { path: kids });

    const response = await add(api, { path: movies });

    expect(response.status).toBe(409);
    expect(await sentence(response)).toBe(
      `That folder holds ${kids}, which is already a library folder.`
    );
    expect(await list(api)).toHaveLength(1);
  });

  it('takes a sibling that only shares a name prefix', async () => {
    const api = freshApi();
    await add(api, { path: folder(api, 'Movies') });

    const response = await add(api, { path: folder(api, 'Movies2') });

    expect(response.status).toBe(201);
    expect(await list(api)).toHaveLength(2);
  });
});

describe('DELETE /api/library-folders/:id', () => {
  it('answers 204 and takes the folder off the list', async () => {
    const api = freshApi();
    const movies = await addFolder(api, folder(api, 'Movies'));
    const kids = await addFolder(api, folder(api, 'Kids'));

    const response = await remove(api, movies.id);

    expect(response.status).toBe(204);
    expect((await list(api)).map((listed) => listed.id)).toEqual([kids.id]);
  });

  it('answers 404 with a sentence for an id not listed', async () => {
    const api = freshApi();

    const response = await remove(api, 'no-such-folder');

    expect(response.status).toBe(404);
    expect(await sentence(response)).toMatch(ONE_SENTENCE);
  });
});
