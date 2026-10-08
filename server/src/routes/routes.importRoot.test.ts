// @vitest-environment node
//
// 30 — Library folders, Phase 3: "the spreadsheet import joins the list"
// (issue #270).
//
// `POST /api/import` refuses a root that contains a listed **Library folder**
// before anything starts, as `400 { error, field: 'root' }` with the
// containing sentence — Import setup draws it under the root field, as it
// draws its other root refusals.
//
// A real listener, a real `fetch`, the film fixture on disk, over a real
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
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
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

function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  root: string;
  sheet: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-import-root-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir, 'library.csv');
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
  return { storage, baseUrl: `http://127.0.0.1:${port}`, root, sheet };
}

describe('POST /api/import — a root containing a library folder', () => {
  it('answers 400 on the root field with the containing sentence, and starts nothing', async () => {
    const { storage, baseUrl, root, sheet } = freshApi();
    const drama = join(root, 'Drama');
    storage.addLibraryFolder(drama);

    const response = await fetch(`${baseUrl}/api/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetPath: sheet, rootPath: root }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: `That folder holds ${drama}, which is already a library folder. Import from ${drama}, or remove it from your library folders first.`,
      field: 'root',
    });
    const current = await fetch(`${baseUrl}/api/import/current`);
    expect(current.status).toBe(404);
  });
});
