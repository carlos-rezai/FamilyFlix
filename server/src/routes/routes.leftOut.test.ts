// @vitest-environment node
//
// 51, Library audit, Phase 10: "a title taken out stays out" (issue #453).
//
// The Delete routes write the **Left-out videos**, so a later **Folder scan**
// does not bring a deleted title back:
//
// - a keep-files Delete (the plain `DELETE`) of a linked title records each
//   of its **Linked videos**;
// - a copied title's Delete records its **Source folder**'s **Source
//   file(s)** under the Library folder it came from.
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

/** A file at a path under a root, its directories made. */
function place(root: string, relative: string): void {
  const file = join(root, relative);
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, 'bytes');
}

/** A fresh library behind the router, one Library folder listed. */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-left-out-delete-');
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
    body: JSON.stringify({ enrich: false, mode, scope: 'all' }),
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

describe('a keep-files Delete leaves its videos out', () => {
  it('records a linked film’s video', async () => {
    const api = await freshApi();
    place(api.library, 'Coco (2017)/Coco.mkv');
    place(api.library, 'Heat (1995)/Heat.mkv');
    await scanToReview(api, 'link');

    await remove(api, `movies/${await filmId(api, 'Coco')}`);

    expect(leftOut(api)).toEqual(['Coco (2017)/Coco.mkv']);
  });

  it('records every episode video of a linked series', async () => {
    const api = await freshApi();
    place(api.library, 'Tidewater (2018)/Tidewater.S01E01.mkv');
    place(api.library, 'Tidewater (2018)/Tidewater.S01E02.mkv');
    await scanToReview(api, 'link');

    await remove(api, `series/${await seriesId(api, 'Tidewater')}`);

    expect(leftOut(api)).toEqual([
      'Tidewater (2018)/Tidewater.S01E01.mkv',
      'Tidewater (2018)/Tidewater.S01E02.mkv',
    ]);
  });

  it('keeps the deleted film out of the next Folder scan', async () => {
    const api = await freshApi();
    place(api.library, 'Coco (2017)/Coco.mkv');
    place(api.library, 'Heat (1995)/Heat.mkv');
    await scanToReview(api, 'link');
    await remove(api, `movies/${await filmId(api, 'Coco')}`);

    const run = await scanToReview(api, 'link');

    const after = (await titles(api)).movies.map((m) => m.title);
    expect(after).toEqual(['Heat']);
    expect(run.log.map((line) => line.text)).toContainEqual(
      expect.stringMatching(/^· Left out 1 videos? you deleted earlier$/)
    );
  });
});

describe('a copied title’s Delete leaves its original out', () => {
  it('records a copied film’s Source file, and the next scan does not copy it back', async () => {
    const api = await freshApi();
    place(api.library, 'Coco (2017)/Coco.mkv');
    place(api.library, 'Heat (1995)/Heat.mkv');
    await scanToReview(api, 'copy');

    await remove(api, `movies/${await filmId(api, 'Coco')}`);

    expect(leftOut(api)).toEqual(['Coco (2017)/Coco.mkv']);
    await scanToReview(api, 'copy');
    expect((await titles(api)).movies.map((m) => m.title)).toEqual(['Heat']);
  });

  it('records a copied series’ Source files, and the next scan does not copy it back', async () => {
    const api = await freshApi();
    place(api.library, 'Tidewater (2018)/Tidewater.S01E01.mkv');
    place(api.library, 'Tidewater (2018)/Tidewater.S01E02.mkv');
    await scanToReview(api, 'copy');

    await remove(api, `series/${await seriesId(api, 'Tidewater')}`);

    expect(leftOut(api)).toEqual([
      'Tidewater (2018)/Tidewater.S01E01.mkv',
      'Tidewater (2018)/Tidewater.S01E02.mkv',
    ]);
    await scanToReview(api, 'copy');
    expect((await titles(api)).series).toEqual([]);
  });
});
