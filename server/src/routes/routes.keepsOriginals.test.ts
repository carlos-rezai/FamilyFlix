// @vitest-environment node
//
// 52, Keep originals, slice 2: "a Delete keeps originals, the routes"
// (issue #476).
//
// **The guarantee**: no Delete reaches an **Original**. A linked title's
// Delete removes only its rows; a copied title's removes only its **Media
// folder**. After each, every original under the Library folder is on disk
// and byte-identical, a copied title's Managed copy is gone, and a later
// **Folder scan** does not bring the title back. A `?files=trash` from an old
// client is ignored: it keeps every original exactly as a plain Delete does.
//
// End to end over the real router: a real library, a real `Media` over a
// sandbox managed directory with no shell behind it, and one temporary
// Library folder listed through the API and filled by a real scan.

import express from 'express';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join, relative } from 'node:path';
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
import type { ImportMode, ImportRun, LibraryTitles } from '@/types';

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

/** A fresh library behind the router, one temporary Library folder listed. */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-keeps-originals-');
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

  return { baseUrl, storage, media, library, folderId };
}

type Api = Awaited<ReturnType<typeof freshApi>>;

/** An original under the Library folder, its bytes its own. */
function original(api: Api, path: string): void {
  const file = join(api.library, path);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, randomBytes(256));
}

/** Every file under the Library folder, by relative path, with its bytes. */
function snapshot(api: Api): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else {
        files.set(relative(api.library, path), readFileSync(path));
      }
    }
  };
  walk(api.library);
  return files;
}

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

async function idOf(
  api: Api,
  kind: 'movies' | 'series',
  title: string
): Promise<string> {
  const found = (await titles(api))[kind].find((t) => t.title === title);
  if (found === undefined) {
    throw new Error(`the library holds no ${title}`);
  }
  return found.id;
}

const leftOut = (api: Api): string[] =>
  [...api.storage.leftOut(api.folderId)].sort();

/** Every original still on disk, byte for byte. */
function expectUntouched(api: Api, before: Map<string, Buffer>): void {
  const after = snapshot(api);
  expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
  for (const [path, bytes] of before) {
    expect(after.get(path)?.equals(bytes), path).toBe(true);
  }
}

const QUERIES = [
  ['a plain Delete', ''],
  ['an old client’s ?files=trash', '?files=trash'],
] as const;

describe.each(QUERIES)('%s keeps every original', (_name, query) => {
  it('deletes a linked movie, every original byte-identical, and a scan does not bring it back', async () => {
    const api = await freshApi();
    original(api, 'Coco (2017)/Coco.mkv');
    original(api, 'Heat (1995)/Heat.mkv');
    await scanToReview(api, 'link');
    const before = snapshot(api);

    const response = await fetch(
      `${api.baseUrl}/api/movies/${await idOf(api, 'movies', 'Coco')}${query}`,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(204);
    expectUntouched(api, before);
    expect(leftOut(api)).toEqual(['Coco (2017)/Coco.mkv']);
    await scanToReview(api, 'link');
    expect((await titles(api)).movies.map((m) => m.title)).toEqual(['Heat']);
  });

  it('deletes a linked series, its episodes and the poster beside them byte-identical, and a scan does not bring it back', async () => {
    const api = await freshApi();
    original(api, 'Tidewater (2018)/Tidewater.S01E01.mkv');
    original(api, 'Tidewater (2018)/Tidewater.S01E02.mkv');
    original(api, 'Heat (1995)/Heat.mkv');
    await scanToReview(api, 'link');
    original(api, 'Tidewater (2018)/poster.jpg');
    const before = snapshot(api);

    const response = await fetch(
      `${api.baseUrl}/api/series/${await idOf(api, 'series', 'Tidewater')}${query}`,
      { method: 'DELETE' }
    );

    expect(response.status).toBe(204);
    expectUntouched(api, before);
    expect(leftOut(api)).toEqual([
      'Tidewater (2018)/Tidewater.S01E01.mkv',
      'Tidewater (2018)/Tidewater.S01E02.mkv',
    ]);
    await scanToReview(api, 'link');
    expect((await titles(api)).series).toEqual([]);
  });

  it('deletes a copied movie, its Managed copy gone and its original byte-identical, and a scan does not copy it back', async () => {
    const api = await freshApi();
    original(api, 'Coco (2017)/Coco.mkv');
    original(api, 'Heat (1995)/Heat.mkv');
    await scanToReview(api, 'copy');
    const id = await idOf(api, 'movies', 'Coco');
    const folder = api.storage.mediaFolderOf('movie', id);
    expect(folder).not.toBeNull();
    expect(existsSync(join(api.media, folder ?? ''))).toBe(true);
    const before = snapshot(api);

    const response = await fetch(`${api.baseUrl}/api/movies/${id}${query}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(existsSync(join(api.media, folder ?? ''))).toBe(false);
    expectUntouched(api, before);
    expect(leftOut(api)).toEqual(['Coco (2017)/Coco.mkv']);
    await scanToReview(api, 'copy');
    expect((await titles(api)).movies.map((m) => m.title)).toEqual(['Heat']);
  });
});
