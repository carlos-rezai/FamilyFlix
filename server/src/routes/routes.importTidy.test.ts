// @vitest-environment node
//
// 57 — Tidy into folders, Phase 3: "Tidy into, one film" (issue #526).
//
// `POST /api/import/current/problems/:id/tidy`: _Tidy into “<folder>”_ on a
// `loose` row answers the importer's `ReviewOutcome` as every review press
// does: `204` once the film is moved and imported and the row is off, `200`
// with the row redrawn when the move fails, `404` for an id not there.
// `routes.importGuessed.test.ts`' shape: a real listener, a real `fetch`, a
// real `:memory:` library, a root holding one loose film listed as a
// **Library folder**, and the importer injected, so the route is proved to
// reach the domain through its argument and nowhere else.

import express from 'express';
import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
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
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { LIBRARY_FIXTURE } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ImportProblem, ImportRun } from '@/types';

const HEADER = join(
  LIBRARY_FIXTURE,
  'root',
  'Die.Hard.1988.1080p',
  'Die.Hard.1988.1080p.mp4'
);
const VIDEO = 'Apex.2026.1080p.mp4';
const SUBTITLE = 'Apex.2026.1080p.en.srt';
const FOLDER = 'Apex (2026)';

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

function freshApi(importer?: (composed: Importer) => Importer) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const dir = sandboxRoot('familyflix-import-tidy-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const root = join(dir, 'root');
  mkdirSync(root);
  cpSync(HEADER, join(root, VIDEO));
  writeFileSync(join(root, SUBTITLE), '1\n00:00:01,000 --> 00:00:02,000\nHi\n');
  storage.addLibraryFolder(root);

  const mediaDomain = createMedia(media);
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
  return { storage, root, baseUrl: `http://127.0.0.1:${port}` };
}

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

const postTidy = (baseUrl: string, id: string): Promise<Response> =>
  fetch(
    `${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}/tidy`,
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

/** A Link Folder scan over the root, left in review, and its loose Problem. */
async function inReviewLoose(importer?: (composed: Importer) => Importer) {
  const api = freshApi(importer);
  const started = await fetch(`${api.baseUrl}/api/library-folders/scan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enrich: false, mode: 'link', scope: 'all' }),
  });
  expect(started.status).toBe(201);
  const run = await untilReview(api.baseUrl);
  const problem = run.problems.find(
    (each: ImportProblem) => each.kind === 'loose'
  );
  if (problem === undefined) {
    throw new Error(`no loose Problem: ${JSON.stringify(run.problems)}`);
  }
  return { ...api, problem };
}

describe('POST /api/import/current/problems/:id/tidy', () => {
  it('answers 204 once the film is moved and imported', async () => {
    const api = await inReviewLoose();

    const response = await postTidy(api.baseUrl, api.problem.id);

    expect(response.status).toBe(204);
    expect(existsSync(join(api.root, FOLDER, VIDEO))).toBe(true);
    expect(
      api.storage.listMovies({ sort: 'a-z' }).map((movie) => movie.title)
    ).toContain('Apex');
  });

  it('takes the row off the run', async () => {
    const api = await inReviewLoose();

    await postTidy(api.baseUrl, api.problem.id);

    const run = (await (await getCurrent(api.baseUrl)).json()) as ImportRun;
    expect(run.problems.map((each) => each.id)).not.toContain(api.problem.id);
  });

  it('answers 200 with the row redrawn when the importer redraws it', async () => {
    const redrawn: ImportProblem = {
      id: 'loose-apex',
      kind: 'loose',
      title: FOLDER,
      reason: "Couldn't move it: It's open in another app. Nothing was moved.",
    };
    const tidy = vi.fn(async () => ({
      kind: 'redrawn' as const,
      problem: redrawn,
    }));
    const api = await inReviewLoose((composed) => ({ ...composed, tidy }));

    const response = await postTidy(api.baseUrl, api.problem.id);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(redrawn);
    expect(tidy).toHaveBeenCalledWith(api.problem.id);
  });

  it('answers 404 for an id that is not there', async () => {
    const api = await inReviewLoose();

    const response = await postTidy(api.baseUrl, 'not-a-problem');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'No such problem: not-a-problem',
    });
  });
});
