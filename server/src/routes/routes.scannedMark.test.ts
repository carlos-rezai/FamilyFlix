// @vitest-environment node
//
// Release review (issue #424): "scan only new folders".
//
// `POST /api/library-folders/scan { enrich, mode, all? }` starts a **Folder
// scan** over the listed **Library folders** with no **Scanned mark** only. A
// folder whose run finished is not read again; one whose run was cancelled
// still counts as new. `all: true` (the **Scan every folder again** box)
// reads every listed folder, Scanned mark or not; a missing `all` is `false`.
//
// A real listener, a real `fetch`, the fixtures copied into real folders on
// disk, over a real `:memory:` library, composed the way `main.ts` is.

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
import { createMedia, type Media } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { heldCopy } from '../test-support/heldCopy/heldCopy';
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { seriesFixture } from '../test-support/seriesFixture/seriesFixture';
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
  /** The film fixture's folder: Amelie and Die Hard. */
  films: string;
  /** The series fixture's folder: Harbor & Vine and Tidewater. */
  shows: string;
}

function freshApi({
  media: mediaSeam = (real) => real,
}: { media?: (real: Media) => Media } = {}): Api {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const sandbox = sandboxRoot('familyflix-scanned-mark-api-');
  const media = join(sandbox, 'media');
  mkdirSync(media);
  mkdirSync(join(sandbox, 'films'));
  mkdirSync(join(sandbox, 'shows'));
  const { root: films } = libraryFixture(join(sandbox, 'films'));
  const { root: shows } = seriesFixture(join(sandbox, 'shows'));
  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaSeam(mediaDomain), playback }),
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
  return { baseUrl: `http://127.0.0.1:${port}`, films, shows };
}

async function listPath(api: Api, path: string): Promise<void> {
  const response = await fetch(`${api.baseUrl}/api/library-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  expect(response.status).toBe(201);
}

const scan = (api: Api, body: unknown = { enrich: false, mode: 'link' }) =>
  fetch(`${api.baseUrl}/api/library-folders/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function untilReview(api: Api): Promise<ImportRun> {
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

/** One whole scan over the route, answering the run in review. */
async function scanToReview(
  api: Api,
  body: unknown = { enrich: false, mode: 'link' }
): Promise<ImportRun> {
  const response = await scan(api, body);
  expect(response.status).toBe(201);
  return untilReview(api);
}

const texts = (run: ImportRun) => run.log.map((line) => line.text);
const scanning = (run: ImportRun) =>
  texts(run).filter((text) => text.startsWith('Scanning'));
const names = (run: ImportRun, title: string) =>
  texts(run).some((text) => text.includes(title));

describe('POST /api/library-folders/scan — only new folders', () => {
  it('reads only the folder just added, its log naming only its titles', async () => {
    const api = freshApi();
    await listPath(api, api.shows);
    await scanToReview(api);
    await listPath(api, api.films);

    const run = await scanToReview(api);

    expect(scanning(run)).toEqual([`Scanning   ${api.films}`]);
    expect(names(run, 'Amelie')).toBe(true);
    expect(names(run, 'Harbor & Vine')).toBe(false);
    expect(names(run, 'Tidewater')).toBe(false);
  });

  it('reads a folder whose scan was cancelled again, as a new one', async () => {
    const hold = heldCopy('Amelie.mp4');
    const api = freshApi({ media: hold.seam });
    await listPath(api, api.shows);
    await scanToReview(api);
    await listPath(api, api.films);
    // Copy, so the run holds on the film's copy-in, then is cancelled.
    expect((await scan(api, { enrich: false, mode: 'copy' })).status).toBe(201);
    await hold.reached;
    const cancelled = fetch(`${api.baseUrl}/api/import/current/cancel`, {
      method: 'POST',
    });
    hold.release();
    expect((await cancelled).ok).toBe(true);

    const run = await scanToReview(api);

    expect(scanning(run)).toEqual([`Scanning   ${api.films}`]);
    expect(names(run, 'Amelie')).toBe(true);
    expect(names(run, 'Tidewater')).toBe(false);
  });

  it('reads every listed folder with all: true', async () => {
    const api = freshApi();
    await listPath(api, api.shows);
    await listPath(api, api.films);
    await scanToReview(api);

    const run = await scanToReview(api, {
      enrich: false,
      mode: 'link',
      all: true,
    });

    expect(scanning(run)).toEqual([
      `Scanning   ${api.shows}`,
      `Scanning   ${api.films}`,
    ]);
  });

  it('reads only new folders with all: false', async () => {
    const api = freshApi();
    await listPath(api, api.shows);
    await scanToReview(api);
    await listPath(api, api.films);

    const run = await scanToReview(api, {
      enrich: false,
      mode: 'link',
      all: false,
    });

    expect(scanning(run)).toEqual([`Scanning   ${api.films}`]);
  });
});
