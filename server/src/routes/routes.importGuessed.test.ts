// @vitest-environment node
//
// 40 — Import review, Phase 4: "Import as on a no-row row" (issue #335).
//
// `POST /api/import/current/problems/:id/import` — _Import as “Ironwood
// (2018)”_ on a `no-row` row: `204` once the importer has imported the folder
// under its `guess`, the title and year a **Folder scan** would give it, and
// taken the Problem off; `200` with the row redrawn as the folder's
// `no-video` or `failed` Problem, the pick's own answer (issue #336); `404`
// for an id not there — a row already gone among them. `routes.importPick.test.ts`' shape: a real listener, a real `fetch`, a
// real `:memory:` library, the fixture tree listed as a **Library folder**
// with a folder no sheet row names beside it; and the importer injected, so
// the route is proved to reach the domain through its argument and nowhere
// else.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import {
  createImporter,
  type Importer,
} from '../import-export/createImporter/createImporter';
import { createMedia, type Media } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ImportProblem, ImportRun } from '@/types';

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

function freshApi({
  importer,
  seam = (real) => real,
}: {
  importer?: (composed: Importer) => Importer;
  seam?: (real: Media) => Media;
} = {}) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const dir = sandboxRoot('familyflix-import-guessed-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir);
  const unnamed = join(root, 'Ironwood (2018)');
  mkdirSync(unnamed);
  writeFileSync(join(unnamed, 'Ironwood.mp4'), '');
  storage.addLibraryFolder(root);

  const mediaDomain = seam(createMedia(media));
  const playback = createPlayback(media, fixedSlot(null), () => null);
  const composed = createImporter({ storage, media: mediaDomain, playback });

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      importer ? importer(composed) : composed,
      createEnrichment({ storage, client: offlineTmdb(), media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, sheet, unnamed };
}

const postImport = (baseUrl: string, sheetPath: string) =>
  fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath }),
  });

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

const postImportAs = (baseUrl: string, id: string): Promise<Response> =>
  fetch(
    `${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}/import`,
    { method: 'POST' }
  );

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

/** The sheet run over the fixture and the unnamed folder, left in review. */
async function inReviewNoRow(
  options: Parameters<typeof freshApi>[0] = {},
  before?: (api: ReturnType<typeof freshApi>) => void
) {
  const api = freshApi(options);
  before?.(api);
  await postImport(api.baseUrl, api.sheet);
  const run = await untilReview(api.baseUrl);
  const problem = run.problems.find(
    (each: ImportProblem) => each.kind === 'no-row'
  );
  if (problem === undefined) {
    throw new Error(`no no-row Problem: ${JSON.stringify(run.problems)}`);
  }
  return { ...api, run, problem };
}

const ironwood = (storage: LibraryStorage) =>
  storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === 'Ironwood');

describe('GET /api/import/current — a no-row Problem’s guess', () => {
  it('carries the title and year a Folder scan would give the folder', async () => {
    const { problem } = await inReviewNoRow();

    expect(problem.guess).toBe('Ironwood (2018)');
  });
});

describe('POST /api/import/current/problems/:id/import — 204', () => {
  it('answers 204 with no body, and imports the folder under its guess', async () => {
    const { baseUrl, storage, problem } = await inReviewNoRow();
    expect(ironwood(storage)).toBeUndefined();

    const response = await postImportAs(baseUrl, problem.id);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(ironwood(storage)).toMatchObject({ title: 'Ironwood', year: 2018 });
  });

  it('takes the Problem off current', async () => {
    const { baseUrl, problem } = await inReviewNoRow();

    await postImportAs(baseUrl, problem.id);

    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems.map((each) => each.id)).not.toContain(problem.id);
  });

  it('imports through the injected importer’s own importGuessed, by the id in the path', async () => {
    const importGuessed = vi
      .fn<Importer['importGuessed']>()
      .mockResolvedValue({ kind: 'imported' });
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, importGuessed }),
    });

    const response = await postImportAs(baseUrl, 'p 1/x');

    expect(response.status).toBe(204);
    expect(importGuessed).toHaveBeenCalledWith('p 1/x');
  });
});

describe('POST /api/import/current/problems/:id/import — 200, the row redrawn', () => {
  it('answers 200 with a folder of two videos redrawn as its no-video Problem', async () => {
    const { baseUrl, storage, problem } = await inReviewNoRow(
      {},
      ({ unnamed }) => writeFileSync(join(unnamed, 'Ironwood.Extras.mp4'), '')
    );

    const response = await postImportAs(baseUrl, problem.id);

    expect(response.status).toBe(200);
    const redrawn = (await response.json()) as ImportProblem;
    expect(redrawn).toMatchObject({
      kind: 'no-video',
      reason: 'Two videos. Pick the film.',
    });
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems).toContainEqual(redrawn);
    expect(ironwood(storage)).toBeUndefined();
  });

  it('answers 200 with a copy that fails redrawn as its failed Problem', async () => {
    const { baseUrl, storage, problem } = await inReviewNoRow({
      seam: (real) => ({
        ...real,
        copyIn: async (...args) => {
          if (args[1].endsWith('Ironwood.mp4')) {
            throw new Error('EBUSY: resource busy or locked');
          }
          return real.copyIn(...args);
        },
      }),
    });

    const response = await postImportAs(baseUrl, problem.id);

    expect(response.status).toBe(200);
    const redrawn = (await response.json()) as ImportProblem;
    expect(redrawn).toMatchObject({
      kind: 'failed',
      reason: "Couldn't copy the video file: EBUSY: resource busy or locked.",
    });
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems).toContainEqual(redrawn);
    expect(ironwood(storage)).toBeUndefined();
  });
});

describe('POST /api/import/current/problems/:id/import — 404', () => {
  it('answers 404 for an id that is not there, with a reason', async () => {
    const { baseUrl, storage } = await inReviewNoRow();

    const response = await postImportAs(baseUrl, 'no-such-problem');

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(ironwood(storage)).toBeUndefined();
  });

  it('answers 404 for a row already imported, importing nothing twice', async () => {
    const { baseUrl, storage, problem } = await inReviewNoRow();
    const first = await postImportAs(baseUrl, problem.id);
    expect(first.status).toBe(204);

    const response = await postImportAs(baseUrl, problem.id);

    expect(response.status).toBe(404);
    expect(
      storage
        .listMovies({ sort: 'a-z' })
        .filter((movie) => movie.title === 'Ironwood')
    ).toHaveLength(1);
  });

  it('answers 404 when there is no run', async () => {
    const { baseUrl } = freshApi();

    const response = await postImportAs(baseUrl, 'p1');

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('turns the injected importer’s not-found into the 404', async () => {
    const importGuessed = vi
      .fn<Importer['importGuessed']>()
      .mockResolvedValue({ kind: 'not-found' });
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, importGuessed }),
    });

    const response = await postImportAs(baseUrl, 'p1');

    expect(response.status).toBe(404);
    expect(importGuessed).toHaveBeenCalledWith('p1');
  });
});
