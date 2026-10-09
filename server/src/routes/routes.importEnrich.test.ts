// @vitest-environment node
//
// 23 — Enrichment, Phase 9: "from the import" (issue #212).
//
// `POST /api/import` accepts `enrich`, and the **Current run** carries it as
// `ImportRun.enrich` on every snapshot — the `201`, each `GET current`, and
// the snapshot in review — so a screen that re-attaches to the run still knows
// whether _Finish_ hands off to an Enrichment run. The box is a hand-off, not
// a sync: the import itself makes no TMDB request and starts no enrichment.
//
// The seam is `routes.import.test.ts`'s: a real listener and `fetch` over a
// real `:memory:` library, managed media directory and fixture root, with
// the `enrichment/` domain composed over a TMDB client that counts every
// question it is asked.

import express from 'express';
import { mkdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import type { TmdbClient } from '../enrichment/tmdbClient/tmdbClient';
import { createImporter } from '../import-export/createImporter/createImporter';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
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

/** Every member of an offline client, wrapped so each question is counted. */
function countingTmdb(): { client: TmdbClient; asked: () => number } {
  const offline = offlineTmdb();
  const spies = Object.fromEntries(
    Object.entries(offline).map(([name, member]) => [name, vi.fn(member)])
  ) as unknown as TmdbClient;
  return {
    client: spies,
    asked: () =>
      Object.values(
        spies as unknown as Record<string, ReturnType<typeof vi.fn>>
      )
        .map((spy) => spy.mock.calls.length)
        .reduce((sum, n) => sum + n, 0),
  };
}

function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-import-enrich-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));
  const importer = createImporter({ storage, media: mediaDomain, playback });
  const tmdb = countingTmdb();

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      importer,
      createEnrichment({ storage, client: tmdb.client, media: mediaDomain })
    )
  );

  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, root, sheet, tmdb };
}

function postImport(baseUrl: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function getCurrent(baseUrl: string): Promise<ImportRun | null> {
  const response = await fetch(`${baseUrl}/api/import/current`);
  return response.status === 200
    ? ((await response.json()) as ImportRun)
    : null;
}

async function untilReview(baseUrl: string): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const run = await getCurrent(baseUrl);
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('POST /api/import — enrich travels on the run', () => {
  it('answers the 201 snapshot with enrich: true when it was asked for', async () => {
    const { baseUrl, root, sheet } = freshApi();

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
      enrich: true,
    });

    expect(response.status).toBe(201);
    expect(((await response.json()) as ImportRun).enrich).toBe(true);
    // Otherwise the run outlives the test and imports into a closed database.
    await untilReview(baseUrl);
  });

  it('carries enrich: true on every read of the current run, through to review', async () => {
    const { baseUrl, root, sheet } = freshApi();
    await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
      enrich: true,
    });

    // A screen arriving now — the re-attach — reads the same flag.
    expect((await getCurrent(baseUrl))?.enrich).toBe(true);
    expect((await untilReview(baseUrl)).enrich).toBe(true);
  });

  it('answers enrich: false when it was not asked for', async () => {
    const { baseUrl, root, sheet } = freshApi();

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
    });

    expect(((await response.json()) as ImportRun).enrich).toBe(false);
    expect((await untilReview(baseUrl)).enrich).toBe(false);
  });

  it('answers enrich: false when it was sent false', async () => {
    const { baseUrl, root, sheet } = freshApi();

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
      enrich: false,
    });

    expect(((await response.json()) as ImportRun).enrich).toBe(false);
    // Otherwise the run outlives the test and imports into a closed database.
    await untilReview(baseUrl);
  });
});

describe('POST /api/import — the import itself goes nowhere near TMDB', () => {
  it('asks the TMDB client nothing and starts no enrichment, run through to review', async () => {
    const { baseUrl, root, sheet, tmdb } = freshApi();

    await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
      enrich: true,
    });
    const run = await untilReview(baseUrl);

    expect(run.enrich).toBe(true);
    expect(run.done).toBe(2);
    expect(tmdb.asked()).toBe(0);
    expect((await fetch(`${baseUrl}/api/enrichment/current`)).status).toBe(404);
  });
});
