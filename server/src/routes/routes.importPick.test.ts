// @vitest-environment node
//
// 40 — Import review, Phase 4: "the Folder picker" (issue #334).
//
// `POST /api/import/current/problems/:id/pick { folder }` — a press on an
// `ambiguous` row's **Folder picker**: `204` once the importer has imported
// the row from that **Candidate folder**; `200 ImportProblem` with the row
// redrawn as that folder's `no-video` Problem when it holds several videos;
// `400` for a body `importBody` refuses and for a folder that is not one of
// the Problem's candidates, nothing imported; `404` for an id not there.
// `routes.importApply.test.ts`' shape: a real listener, a real `fetch`, a real
// `:memory:` library, the fixture tree listed as a **Library folder** with a
// second Die Hard folder beside it; and the importer injected, so the route
// is proved to reach the domain through its argument and nowhere else.

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
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ImportProblem, ImportRun } from '@/types';
import { pickFolderBody } from './importBody/importBody';

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
  secondVideos = ['Die Hard.mp4'],
}: {
  importer?: (composed: Importer) => Importer;
  secondVideos?: string[];
} = {}) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const dir = sandboxRoot('familyflix-import-pick-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir);
  const second = join(root, 'Die Hard (1988)');
  mkdirSync(second);
  for (const video of secondVideos) {
    writeFileSync(join(second, video), '');
  }
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
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    sheet,
    root,
    fixtureFolder: join(root, 'Die.Hard.1988.1080p'),
    second,
  };
}

const postImport = (baseUrl: string, sheetPath: string) =>
  fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath, mode: 'copy' }),
  });

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

function postPick(
  baseUrl: string,
  id: string,
  body: unknown
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}/pick`,
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

/** The sheet run over the fixture and the second folder, left in review. */
async function inReviewAmbiguous(secondVideos?: string[]) {
  const api = freshApi({ secondVideos });
  await postImport(api.baseUrl, api.sheet);
  const run = await untilReview(api.baseUrl);
  const problem = run.problems.find(
    (each: ImportProblem) => each.kind === 'ambiguous'
  );
  if (problem === undefined) {
    throw new Error(`no ambiguous Problem: ${JSON.stringify(run.problems)}`);
  }
  return { ...api, run, problem };
}

const dieHard = (storage: LibraryStorage) =>
  storage
    .listMovies({ sort: 'a-z' })
    .find((movie) => movie.title === 'Die Hard');

describe('GET /api/import/current — an ambiguous Problem’s candidates', () => {
  it('carries every Candidate folder, each with its video count', async () => {
    const { problem, fixtureFolder, second } = await inReviewAmbiguous();

    expect(
      [...(problem.candidates ?? [])].sort((a, b) =>
        a.path.localeCompare(b.path)
      )
    ).toEqual(
      [
        { path: fixtureFolder, name: 'Die.Hard.1988.1080p', videos: 1 },
        { path: second, name: 'Die Hard (1988)', videos: 1 },
      ].sort((a, b) => a.path.localeCompare(b.path))
    );
  });
});

describe('POST /api/import/current/problems/:id/pick — 204', () => {
  it('answers 204 with no body, and imports the title from that folder', async () => {
    const { baseUrl, storage, problem, fixtureFolder } =
      await inReviewAmbiguous();

    const response = await postPick(baseUrl, problem.id, {
      folder: fixtureFolder,
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(dieHard(storage)).toMatchObject({ title: 'Die Hard', year: 1988 });
    expect(dieHard(storage)?.subtitles).toHaveLength(2);
  });

  it('takes the Problem off current', async () => {
    const { baseUrl, problem, fixtureFolder } = await inReviewAmbiguous();

    await postPick(baseUrl, problem.id, { folder: fixtureFolder });

    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems.map((each) => each.id)).not.toContain(problem.id);
  });

  it('picks through the injected importer’s own pick, by the id in the path', async () => {
    const pick = vi
      .fn<Importer['pick']>()
      .mockResolvedValue({ kind: 'imported' });
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, pick }),
    });

    const response = await postPick(baseUrl, 'p 1/x', {
      folder: '/films/Die Hard (1988)',
    });

    expect(response.status).toBe(204);
    expect(pick).toHaveBeenCalledWith('p 1/x', '/films/Die Hard (1988)');
  });
});

describe('POST /api/import/current/problems/:id/pick — 200, the row redrawn', () => {
  const SEVERAL = ['Die Hard.mp4', 'Die Hard (Director’s Cut).mkv'];

  it('answers 200 with that folder’s no-video Problem, and imports nothing', async () => {
    const { baseUrl, storage, problem, second } =
      await inReviewAmbiguous(SEVERAL);

    const response = await postPick(baseUrl, problem.id, { folder: second });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: 'no-video',
      title: 'Die Hard',
      reason: 'Two videos. Pick the film.',
    });
    expect(dieHard(storage)).toBeUndefined();
  });

  it('puts the redrawn Problem on current in the ambiguous one’s place', async () => {
    const { baseUrl, problem, second } = await inReviewAmbiguous(SEVERAL);

    const redrawn = (await (
      await postPick(baseUrl, problem.id, { folder: second })
    ).json()) as ImportProblem;

    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems).toContainEqual(redrawn);
    expect(after.problems.some((each) => each.kind === 'ambiguous')).toBe(
      false
    );
  });

  it('opens its Resolve on the Found-file choice: the detail lists both videos', async () => {
    const { baseUrl, problem, second } = await inReviewAmbiguous(SEVERAL);
    const redrawn = (await (
      await postPick(baseUrl, problem.id, { folder: second })
    ).json()) as ImportProblem;

    const detail = await (
      await fetch(
        `${baseUrl}/api/import/current/problems/${encodeURIComponent(redrawn.id)}`
      )
    ).json();

    expect(detail.folder).toBe(second);
    expect([...detail.files.videos].sort()).toEqual(
      SEVERAL.map((video) => join(second, video)).sort()
    );
  });

  it('echoes the injected importer’s redrawn Problem', async () => {
    const redrawn: ImportProblem = {
      id: 'p1',
      kind: 'no-video',
      title: 'Die Hard',
      reason: 'Two videos. Pick the film.',
    };
    const pick = vi
      .fn<Importer['pick']>()
      .mockResolvedValue({ kind: 'redrawn', problem: redrawn });
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, pick }),
    });

    const response = await postPick(baseUrl, 'p1', { folder: '/films/x' });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(redrawn);
  });
});

describe('POST /api/import/current/problems/:id/pick — 400', () => {
  it.each([
    ['no folder', {}],
    ['an empty folder', { folder: '' }],
    ['a folder that is not a string', { folder: 7 }],
  ])(
    'answers 400 for %s, in importBody’s own sentence',
    async (_name, body) => {
      const pick = vi
        .fn<Importer['pick']>()
        .mockResolvedValue({ kind: 'imported' });
      const { baseUrl } = freshApi({
        importer: (composed) => ({ ...composed, pick }),
      });

      const response = await postPick(baseUrl, 'p1', body);

      expect(response.status).toBe(400);
      const read = pickFolderBody(body);
      expect(read.ok).toBe(false);
      expect(await response.json()).toEqual({
        error: read.ok ? null : read.error,
      });
      expect(pick).not.toHaveBeenCalled();
    }
  );

  it('answers 400 for a folder that is not a candidate, and imports nothing', async () => {
    const { baseUrl, storage, root, problem } = await inReviewAmbiguous();
    const elsewhere = join(root, 'Heat (1995)');
    mkdirSync(elsewhere);
    writeFileSync(join(elsewhere, 'Heat.mp4'), '');

    const response = await postPick(baseUrl, problem.id, {
      folder: elsewhere,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: expect.any(String) });
    expect(dieHard(storage)).toBeUndefined();
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems.map((each) => each.id)).toContain(problem.id);
  });

  it('turns the injected importer’s refusal into the 400, in its own words', async () => {
    const pick = vi.fn<Importer['pick']>().mockResolvedValue({
      kind: 'refused',
      error: 'That folder is not one of the candidates.',
    });
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, pick }),
    });

    const response = await postPick(baseUrl, 'p1', { folder: '/films/x' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'That folder is not one of the candidates.',
    });
  });
});

describe('POST /api/import/current/problems/:id/pick — 404', () => {
  it('answers 404 for an id that is not there, with a reason', async () => {
    const { baseUrl, storage, fixtureFolder } = await inReviewAmbiguous();

    const response = await postPick(baseUrl, 'no-such-problem', {
      folder: fixtureFolder,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(dieHard(storage)).toBeUndefined();
  });

  it('answers 404 for a row already picked', async () => {
    const { baseUrl, problem, fixtureFolder } = await inReviewAmbiguous();
    const first = await postPick(baseUrl, problem.id, {
      folder: fixtureFolder,
    });
    expect(first.status).toBe(204);

    const response = await postPick(baseUrl, problem.id, {
      folder: fixtureFolder,
    });

    expect(response.status).toBe(404);
  });

  it('answers 404 when there is no run', async () => {
    const { baseUrl, fixtureFolder } = freshApi();

    const response = await postPick(baseUrl, 'p1', { folder: fixtureFolder });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('turns the injected importer’s false into the 404', async () => {
    const pick = vi
      .fn<Importer['pick']>()
      .mockResolvedValue({ kind: 'not-found' });
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, pick }),
    });

    const response = await postPick(baseUrl, 'p1', { folder: '/films/x' });

    expect(response.status).toBe(404);
    expect(pick).toHaveBeenCalledWith('p1', '/films/x');
  });
});
