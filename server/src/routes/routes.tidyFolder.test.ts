// @vitest-environment node
//
// 57 — Tidy into folders, Phase 7: "the Tidy dialog moves" (issue #530).
//
// `POST /api/library-folders/:id/tidy { ids }` moves only the tidies named,
// against a fresh **Tidy plan**, and answers `TidyResult`; `409` _A scan is
// running._ while a run is scanning or importing, moving nothing. The
// folder's `scannedAt` is left alone.
//
// End to end over the real router: a real library, a real `Media` over a
// sandbox managed directory (one copy held, to keep a scan in flight), and a
// Library folder laid out on disk.

import express from 'express';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import {
  createImporter,
  type Importer,
} from '../import-export/createImporter/createImporter';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { heldCopy } from '../test-support/heldCopy/heldCopy';
import { LIBRARY_FIXTURE } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { LibraryFolderView, TidyPlan, TidyResult } from '@/types';

/** The fixture's film header, every video's bytes. */
const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);

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
  const path = join(root, relative);
  mkdirSync(join(path, '..'), { recursive: true });
  if (relative.endsWith('.mp4')) {
    cpSync(HEADER, path);
  } else {
    writeFileSync(path, 'bytes');
  }
}

/**
 * A fresh library behind the router: `Movies` holding two loose films (one
 * with its subtitle) and one film in a folder of its own, whose copy `hold`
 * keeps in flight when a scan reaches it.
 */
async function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const root = sandboxRoot('familyflix-tidy-route-');
  const media = join(root, 'media');
  const movies = join(root, 'Movies');
  mkdirSync(media);
  mkdirSync(movies);
  place(movies, 'Apex.2026.1080p.mp4');
  place(movies, 'Apex.2026.1080p.en.srt');
  place(movies, 'Harbor.Lights.2019.mp4');
  place(movies, 'Coco (2017)/Coco.mp4');

  const folder = storage.addLibraryFolder(movies);

  const hold = heldCopy('Coco.mp4');
  const mediaDomain = hold.seam(createMedia(media));
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) => storage.libraryFolders().find((f) => f.id === id)?.path ?? null
  );
  const importer: Importer = createImporter({
    storage,
    media: mediaDomain,
    playback,
  });

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      importer,
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

  return { baseUrl, movies, folder, storage, importer, hold };
}

type Api = Awaited<ReturnType<typeof freshApi>>;

function postTidy(api: Api, ids: string[]): Promise<Response> {
  return fetch(
    `${api.baseUrl}/api/library-folders/${encodeURIComponent(api.folder.id)}/tidy`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    }
  );
}

async function untilReview(importer: Importer): Promise<void> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = importer.current();
    if (run !== null && run.phase === 'review') {
      return;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('POST /api/library-folders/:id/tidy', () => {
  it('moves only the ids posted and answers the TidyResult', async () => {
    const api = await freshApi();

    const response = await postTidy(api, ['apex.2026.1080p.mp4']);

    expect(response.status).toBe(200);
    expect((await response.json()) as TidyResult).toEqual({
      moved: 1,
      failed: [],
    });
    expect(
      existsSync(join(api.movies, 'Apex (2026)', 'Apex.2026.1080p.mp4'))
    ).toBe(true);
    expect(
      existsSync(join(api.movies, 'Apex (2026)', 'Apex.2026.1080p.en.srt'))
    ).toBe(true);
    expect(existsSync(join(api.movies, 'Harbor.Lights.2019.mp4'))).toBe(true);
  });

  it('does not move a video dropped in since the plan was read', async () => {
    const api = await freshApi();
    const read = await fetch(
      `${api.baseUrl}/api/library-folders/${encodeURIComponent(api.folder.id)}/loose`
    );
    const plan = (await read.json()) as TidyPlan;
    place(api.movies, 'Cedar.Point.2020.mp4');

    const response = await postTidy(
      api,
      plan.tidies.map((tidy) => tidy.id)
    );

    expect(response.status).toBe(200);
    expect(((await response.json()) as TidyResult).moved).toBe(2);
    expect(existsSync(join(api.movies, 'Cedar.Point.2020.mp4'))).toBe(true);
    expect(existsSync(join(api.movies, 'Cedar Point (2020)'))).toBe(false);
  });

  it('answers 409 A scan is running. while a run scans or imports, moving nothing', async () => {
    const api = await freshApi();
    await api.importer.scan([api.folder], false, 'copy');
    await api.hold.reached;

    const response = await postTidy(api, ['apex.2026.1080p.mp4']);

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'A scan is running.' });
    expect(existsSync(join(api.movies, 'Apex.2026.1080p.mp4'))).toBe(true);
    expect(existsSync(join(api.movies, 'Apex (2026)'))).toBe(false);
    api.hold.release();
    await untilReview(api.importer);
  });

  it('leaves the folder’s scannedAt as it was', async () => {
    const api = await freshApi();
    const at = '2026-11-01T09:00:00.000Z';
    api.storage.markScanned([api.folder.id], at);

    const response = await postTidy(api, [
      'apex.2026.1080p.mp4',
      'harbor.lights.2019.mp4',
    ]);
    expect(response.status).toBe(200);

    const listed = (await (
      await fetch(`${api.baseUrl}/api/library-folders`)
    ).json()) as LibraryFolderView[];
    expect(listed.find((f) => f.id === api.folder.id)?.scannedAt).toBe(at);
  });
});
