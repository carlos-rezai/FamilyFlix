// @vitest-environment node
//
// 41 — Review at scale, Phase 6: "Skip all and Keep all mine in the Import
// review" (issue #360).
//
// `POST /api/import/current/problems/dismiss { ids }` — the bulk **Dismiss**
// behind _Skip all_ (a Review group's header, and beside a chosen kind) and
// _Keep all mine_ (beside `differs`): `200` with the whole **Current run**,
// every id it holds dismissed, so the screen redraws from the echo; an id not
// held is passed over, not refused; `400` with a sentence for an `ids` that
// is not a non-empty string array, the importer never asked; `404` with no
// run. `routes.importGuessed.test.ts`' shape: a real listener, a real
// `fetch`, a real `:memory:` library, the fixture tree listed as a **Library
// folder** with two folders no sheet row names beside it, so the review holds
// two `no-row` Problems and the fixture's own.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
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

function freshApi() {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const dir = sandboxRoot('familyflix-import-dismiss-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir);
  for (const name of ['Ironwood (2018)', 'Quarry Lane (2004)']) {
    const unnamed = join(root, name);
    mkdirSync(unnamed);
    writeFileSync(join(unnamed, `${name}.mp4`), '');
  }
  storage.addLibraryFolder(root);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null), () => null);
  const importer = createImporter({ storage, media: mediaDomain, playback });

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      importer,
      createEnrichment({ storage, client: offlineTmdb(), media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${port}`, sheet };
}

const postImport = (baseUrl: string, sheetPath: string) =>
  fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath, mode: 'copy' }),
  });

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

const postDismiss = (baseUrl: string, body: unknown): Promise<Response> =>
  fetch(`${baseUrl}/api/import/current/problems/dismiss`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

async function untilReview(baseUrl: string): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await getCurrent(baseUrl);
    const run =
      response.status === 200 ? ((await response.json()) as ImportRun) : null;
    if (run !== null && run.phase === 'review') {
      return run;
    }
    if (Date.now() > deadline) {
      throw new Error(`the run never reached review: ${JSON.stringify(run)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/** The sheet run over the fixture and the two unnamed folders, in review. */
async function inReview() {
  const api = freshApi();
  await postImport(api.baseUrl, api.sheet);
  const run = await untilReview(api.baseUrl);
  const noRow = run.problems.filter((problem) => problem.kind === 'no-row');
  if (noRow.length < 2) {
    throw new Error(`two no-row Problems wanted: ${JSON.stringify(run)}`);
  }
  return { ...api, run, noRow };
}

const ids = (run: ImportRun) => run.problems.map((problem) => problem.id);

describe('POST /api/import/current/problems/dismiss — 200', () => {
  it('answers the whole snapshot, every id asked dismissed and the rest kept', async () => {
    const { baseUrl, run, noRow } = await inReview();
    const asked = noRow.map((problem) => problem.id);

    const response = await postDismiss(baseUrl, { ids: asked });

    expect(response.status).toBe(200);
    const echo = (await response.json()) as ImportRun;
    expect(echo.phase).toBe('review');
    expect(echo.matched).toBe(run.matched);
    expect(ids(echo)).toEqual(ids(run).filter((id) => !asked.includes(id)));
  });

  it('dismisses them for good: the current run reads the same afterwards', async () => {
    const { baseUrl, noRow } = await inReview();

    const echo = (await (
      await postDismiss(baseUrl, { ids: noRow.map((problem) => problem.id) })
    ).json()) as ImportRun;

    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(ids(after)).toEqual(ids(echo));
  });

  it('passes over an id it does not hold, dismissing the rest', async () => {
    const { baseUrl, run, noRow } = await inReview();

    const response = await postDismiss(baseUrl, {
      ids: ['no-such-problem', noRow[0].id],
    });

    expect(response.status).toBe(200);
    const echo = (await response.json()) as ImportRun;
    expect(ids(echo)).toEqual(ids(run).filter((id) => id !== noRow[0].id));
  });

  it('answers the snapshot unchanged when it holds none of the ids', async () => {
    const { baseUrl, run } = await inReview();

    const response = await postDismiss(baseUrl, { ids: ['gone', 'never'] });

    expect(response.status).toBe(200);
    expect(ids((await response.json()) as ImportRun)).toEqual(ids(run));
  });
});

describe('POST /api/import/current/problems/dismiss — 400', () => {
  it.each([
    ['no ids at all', {}],
    ['an empty list', { ids: [] }],
    ['a string, not a list', { ids: 'p1' }],
    ['a list holding a number', { ids: [1] }],
  ])('refuses %s in a sentence, dismissing nothing', async (_, body) => {
    const { baseUrl, run } = await inReview();

    const response = await postDismiss(baseUrl, body);

    expect(response.status).toBe(400);
    const { error } = (await response.json()) as { error: unknown };
    expect(typeof error).toBe('string');
    expect(error as string).toMatch(/^[A-Z].*\.$/);
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(ids(after)).toEqual(ids(run));
  });
});

describe('POST /api/import/current/problems/dismiss — 404', () => {
  it('answers 404 when there is no run, with a reason', async () => {
    const { baseUrl } = freshApi();

    const response = await postDismiss(baseUrl, { ids: ['p1'] });

    expect(response.status).toBe(404);
    const { error } = (await response.json()) as { error: unknown };
    expect(typeof error).toBe('string');
  });
});
