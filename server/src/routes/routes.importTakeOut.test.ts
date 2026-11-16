// @vitest-environment node
//
// 66, Missing videos, Phase 2: "take out a film" (issue #635).
//
// `POST /api/import/current/problems/:id/take-out`, the `missing` row's _Take
// out of library_: `204` once the importer's `takeOutMissing` has taken the
// title out and the Problem off, `404` with the Skip's own `noSuchProblem`
// sentence for a Problem not there or not `missing`, and `500` with _Could not
// take that title out_ when the write throws. `routes.importApply.test.ts`'
// shape: a real listener, a real `fetch`, a real `:memory:` library, the
// fixture tree listed as a **Library folder**; and the importer injected, so
// the route is proved to reach the domain through its argument and nowhere
// else.

import express from 'express';
import { mkdirSync, rmSync } from 'node:fs';
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
import { createLayoutFill } from '../import-export/createLayoutFill/createLayoutFill';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { idleLayoutFill } from '../test-support/idleLayoutFill/idleLayoutFill';
import { idleLibrarySheet } from '../test-support/idleLibrarySheet/idleLibrarySheet';
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
}: { importer?: (composed: Importer) => Importer } = {}) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const dir = sandboxRoot('familyflix-import-take-out-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root } = libraryFixture(dir);
  const folder = storage.addLibraryFolder(root);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) =>
      storage.libraryFolders().find((each) => each.id === id)?.path ?? null
  );
  const composed = createImporter({
    storage,
    media: mediaDomain,
    playback,
    librarySheet: idleLibrarySheet(),
    layoutFill: idleLayoutFill(),
  });

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
        layoutFill: createLayoutFill({ storage, media: mediaDomain }),
      }),
      createLayoutFill({ storage, media: mediaDomain })
    )
  );
  const server = app.listen(0);
  servers.push(server);
  const { port } = server.address() as AddressInfo;
  return {
    storage,
    importer: composed,
    folder,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

const postTakeOut = (baseUrl: string, id: string): Promise<Response> =>
  fetch(
    `${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}/take-out`,
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

/**
 * The fixture scanned in once, Die Hard's video deleted, and a second scan
 * left in review on its `missing` row.
 */
async function inReviewWithMissing() {
  const api = freshApi();
  await api.importer.scan([api.folder], false, 'link');
  await untilReview(api.baseUrl);
  const movie = api.storage
    .listMovies({ sort: 'a-z' })
    .find((each) => each.title === 'Die Hard');
  if (movie === undefined) {
    throw new Error('the fixture never imported Die Hard');
  }
  rmSync(join(api.folder.path, 'Die Hard (1988)', 'Die.Hard.1988.1080p.mp4'));

  await api.importer.scan([api.folder], false, 'link');
  const run = await untilReview(api.baseUrl);
  const problem = run.problems.find(
    (each: ImportProblem) => each.kind === 'missing'
  );
  if (problem === undefined) {
    throw new Error(`no missing Problem: ${JSON.stringify(run.problems)}`);
  }
  return { ...api, run, movieId: movie.id, problem };
}

describe('POST /api/import/current/problems/:id/take-out: 204', () => {
  it('answers 204 with no body, and the film is out of the library', async () => {
    const { baseUrl, storage, movieId, problem } = await inReviewWithMissing();

    const response = await postTakeOut(baseUrl, problem.id);

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(storage.getMovie(movieId)).toBeNull();
  });

  it('takes the Problem off current', async () => {
    const { baseUrl, problem } = await inReviewWithMissing();

    await postTakeOut(baseUrl, problem.id);

    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems.map((each) => each.id)).not.toContain(problem.id);
  });

  it('takes out through the injected importer’s own takeOutMissing, by the id in the path', async () => {
    const takeOutMissing = vi.fn().mockReturnValue(true);
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, takeOutMissing }),
    });

    const response = await postTakeOut(baseUrl, 'p 1/x');

    expect(response.status).toBe(204);
    expect(takeOutMissing).toHaveBeenCalledWith('p 1/x');
  });
});

describe('POST /api/import/current/problems/:id/take-out: 404', () => {
  it('answers 404 with noSuchProblem for an id that is not there', async () => {
    const { baseUrl, storage, movieId } = await inReviewWithMissing();

    const response = await postTakeOut(baseUrl, 'no-such-problem');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'No such problem: no-such-problem',
    });
    expect(storage.getMovie(movieId)).not.toBeNull();
  });

  it('answers 404 for the same id a second time', async () => {
    const { baseUrl, problem } = await inReviewWithMissing();
    await postTakeOut(baseUrl, problem.id);

    const response = await postTakeOut(baseUrl, problem.id);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: `No such problem: ${problem.id}`,
    });
  });

  it('turns the injected importer’s false, a Problem not missing, into the 404', async () => {
    const takeOutMissing = vi.fn().mockReturnValue(false);
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, takeOutMissing }),
    });

    const response = await postTakeOut(baseUrl, 'p-no-video');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: 'No such problem: p-no-video',
    });
    expect(takeOutMissing).toHaveBeenCalledWith('p-no-video');
  });

  it('answers 404 when there is no run', async () => {
    const { baseUrl } = freshApi();

    const response = await postTakeOut(baseUrl, 'p1');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'No such problem: p1' });
  });
});

describe('POST /api/import/current/problems/:id/take-out: 500', () => {
  it('answers 500 with Could not take that title out when the write throws', async () => {
    const takeOutMissing = vi.fn(() => {
      throw new Error('disk on fire');
    });
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, takeOutMissing }),
    });

    const response = await postTakeOut(baseUrl, 'p1');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Could not take that title out',
    });
  });
});
