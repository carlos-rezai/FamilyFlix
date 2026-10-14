// @vitest-environment node
//
// 40 — Import review, Phase 3: "Sheet differences" (issue #333).
//
// `POST /api/import/current/problems/:id/apply { choices }` — the `differs`
// row's _Apply choices_: `204` once the importer has written the sheet's side
// of each field chosen `sheet` and taken the Problem off, `400` for a body
// `importBody` refuses — its sentence the route's `error`, the importer never
// asked — and `404` for an id not there. `routes.import.test.ts`' shape: a
// real listener, a real `fetch`, a real `:memory:` library, the fixture tree
// listed as a **Library folder**; and the importer injected, so the route is
// proved to reach the domain through its argument and nowhere else.

import express from 'express';
import { mkdirSync } from 'node:fs';
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
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ImportProblem, ImportRun } from '@/types';
import { sheetChoicesBody } from './importBody/importBody';

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
}: { importer?: (composed: Importer) => Importer } = {}) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const dir = sandboxRoot('familyflix-import-apply-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir);
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
      createEnrichment({ storage, client: offlineTmdb(), media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, sheet };
}

const postImport = (baseUrl: string, sheetPath: string) =>
  fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath, mode: 'copy' }),
  });

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

const postCancel = (baseUrl: string) =>
  fetch(`${baseUrl}/api/import/current/cancel`, { method: 'POST' });

function postApply(
  baseUrl: string,
  id: string,
  body: unknown
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}/apply`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

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

/**
 * The fixture imported once, Die Hard's director changed in the library, and
 * a second run over the same sheet left in review on its `differs` row.
 */
async function inReviewWithDifference() {
  const api = freshApi();
  await postImport(api.baseUrl, api.sheet);
  await untilReview(api.baseUrl);
  await postCancel(api.baseUrl);
  const movie = api.storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === 'Die Hard');
  if (movie === undefined) {
    throw new Error('the fixture never imported Die Hard');
  }
  api.storage.updateMovie(movie.id, { director: 'Renny Harlin', rating: 5 });

  await postImport(api.baseUrl, api.sheet);
  const run = await untilReview(api.baseUrl);
  const problem = run.problems.find(
    (each: ImportProblem) => each.kind === 'differs'
  );
  if (problem === undefined) {
    throw new Error(`no differs Problem: ${JSON.stringify(run.problems)}`);
  }
  return { ...api, movieId: movie.id, problem };
}

describe('POST /api/import/current/problems/:id/apply — 204', () => {
  it('answers 204 with no body, and writes only the fields chosen sheet', async () => {
    const { baseUrl, storage, movieId, problem } =
      await inReviewWithDifference();

    const response = await postApply(baseUrl, problem.id, {
      choices: { director: 'sheet', rating: 'mine' },
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(storage.getMovie(movieId)).toMatchObject({
      director: 'John McTiernan',
      rating: 5,
    });
  });

  it('takes the Problem off current', async () => {
    const { baseUrl, problem } = await inReviewWithDifference();

    await postApply(baseUrl, problem.id, { choices: { director: 'sheet' } });

    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems.map((each) => each.id)).not.toContain(problem.id);
  });

  it('applies through the injected importer’s own apply, by the id in the path', async () => {
    const apply = vi.fn<Importer['apply']>().mockReturnValue(true);
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, apply }),
    });

    const response = await postApply(baseUrl, 'p 1/x', {
      choices: { synopsis: 'sheet', cast: 'mine' },
    });

    expect(response.status).toBe(204);
    expect(apply).toHaveBeenCalledWith('p 1/x', {
      synopsis: 'sheet',
      cast: 'mine',
    });
  });
});

describe('POST /api/import/current/problems/:id/apply — 400', () => {
  it.each([
    ['no choices', {}],
    ['a list of choices', { choices: ['sheet'] }],
    ['a side that is neither', { choices: { director: 'theirs' } }],
    ['a field that is never in play', { choices: { title: 'sheet' } }],
  ])(
    'answers 400 for %s, in importBody’s own sentence',
    async (_name, body) => {
      const apply = vi.fn<Importer['apply']>().mockReturnValue(true);
      const { baseUrl } = freshApi({
        importer: (composed) => ({ ...composed, apply }),
      });

      const response = await postApply(baseUrl, 'p1', body);

      expect(response.status).toBe(400);
      const read = sheetChoicesBody(body);
      expect(read.ok).toBe(false);
      expect(await response.json()).toEqual({
        error: read.ok ? null : read.error,
      });
      expect(apply).not.toHaveBeenCalled();
    }
  );

  it('writes nothing on a refusal, and leaves the Problem on the run', async () => {
    const { baseUrl, storage, movieId, problem } =
      await inReviewWithDifference();

    const response = await postApply(baseUrl, problem.id, {
      choices: { director: 'tmdb' },
    });

    expect(response.status).toBe(400);
    expect(storage.getMovie(movieId)).toMatchObject({
      director: 'Renny Harlin',
    });
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems.map((each) => each.id)).toContain(problem.id);
  });
});

describe('POST /api/import/current/problems/:id/apply — 404', () => {
  it('answers 404 for an id that is not there, with a reason', async () => {
    const { baseUrl, storage, movieId } = await inReviewWithDifference();

    const response = await postApply(baseUrl, 'no-such-problem', {
      choices: { director: 'sheet' },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(storage.getMovie(movieId)).toMatchObject({
      director: 'Renny Harlin',
    });
  });

  it('answers 404 for the same id a second time', async () => {
    const { baseUrl, problem } = await inReviewWithDifference();
    await postApply(baseUrl, problem.id, { choices: { director: 'sheet' } });

    const response = await postApply(baseUrl, problem.id, {
      choices: { director: 'sheet' },
    });

    expect(response.status).toBe(404);
  });

  it('answers 404 when there is no run', async () => {
    const { baseUrl } = freshApi();

    const response = await postApply(baseUrl, 'p1', {
      choices: { director: 'sheet' },
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('turns the injected importer’s false into the 404', async () => {
    const apply = vi.fn<Importer['apply']>().mockReturnValue(false);
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, apply }),
    });

    const response = await postApply(baseUrl, 'p1', {
      choices: { director: 'sheet' },
    });

    expect(response.status).toBe(404);
    expect(apply).toHaveBeenCalledWith('p1', { director: 'sheet' });
  });
});
