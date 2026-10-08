// @vitest-environment node
//
// 30 — Library folders, Phase 2: "the Folder scan" (issue #269).
//
// `POST /api/library-folders/scan { enrich }` starts a **Folder scan** over
// every listed **Library folder**:
//
// - `201 ImportRun` — the run's first snapshot, `source: 'folders'`, the
//   `enrich` flag carried as a sheet import's is;
// - `400` with no folders listed;
// - `409` while a **Current run** exists.
//
// A real listener, a real `fetch`, real directories on disk, over a real
// `:memory:` library, composed the way `main.ts` is.

import express from 'express';
import { mkdirSync } from 'node:fs';
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
import type { ImportRun } from '@/types';

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

function freshApi(): Api {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const sandbox = sandboxRoot('familyflix-folder-scan-api-');
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

/** A directory under the sandbox's disk, made and listed. */
async function listFolder(api: Api, name: string): Promise<string> {
  const path = join(api.disk, name);
  mkdirSync(path, { recursive: true });
  const response = await fetch(`${api.baseUrl}/api/library-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  expect(response.status).toBe(201);
  return path;
}

const scan = (api: Api, body: unknown = { enrich: false }) =>
  fetch(`${api.baseUrl}/api/library-folders/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** Wait for the Current run to reach review, so nothing is closed under it. */
async function untilReview(api: Api): Promise<void> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await fetch(`${api.baseUrl}/api/import/current`);
    if (response.status === 200) {
      const run = (await response.json()) as ImportRun;
      if (run.phase === 'review') {
        return;
      }
    }
    if (Date.now() > deadline) {
      throw new Error('the run never reached review');
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('POST /api/library-folders/scan', () => {
  it('answers 201 with the run’s first snapshot, its source folders', async () => {
    const api = freshApi();
    await listFolder(api, 'Movies');

    const response = await scan(api);

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: expect.any(String),
      source: 'folders',
      enrich: false,
    });
    await untilReview(api);
  });

  it('carries enrich on the run', async () => {
    const api = freshApi();
    await listFolder(api, 'Movies');

    const response = await scan(api, { enrich: true });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ enrich: true });
    await untilReview(api);
  });

  it('answers 400 with a sentence when no folder is listed', async () => {
    const api = freshApi();

    const response = await scan(api);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: expect.stringMatching(/^\S.*\.$/),
    });
    expect((await fetch(`${api.baseUrl}/api/import/current`)).status).toBe(404);
  });

  it('answers 409 while a run exists', async () => {
    const api = freshApi();
    await listFolder(api, 'Movies');
    const first = await scan(api);
    expect(first.status).toBe(201);

    const second = await scan(api);

    expect(second.status).toBe(409);
    expect(await second.json()).toMatchObject({ error: expect.any(String) });
    await untilReview(api);
  });
});
