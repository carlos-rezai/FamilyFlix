// @vitest-environment node
//
// 41 — Review at scale, Phase 6: "Import all as guessed" (issue #361).
//
// `POST /api/import/current/problems/import-guessed { ids }` — _Import all as
// guessed_ beside a chosen `no-row`: `200` with the whole **Current run**,
// each id it holds run through `importFromReview` in order under the run's
// **Import mode** — the folder imported under its guess, linked where it lies
// in a Link run and copied in under Copy — so the screen redraws from the
// echo; a row that cannot be settled stays, redrawn as its new problem; an
// id not held is passed over, not refused; `400` with a sentence for an `ids`
// that is not a non-empty string array, the importer never asked; `404` with
// no run. `routes.importDismiss.test.ts`' shape: a real listener, a real
// `fetch`, a real `:memory:` library, the fixture tree listed as a **Library
// folder** with two folders no sheet row names beside it.

import express from 'express';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
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
import type { ImportMode, ImportRun, Movie } from '@/types';

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

const DIE_HARD = 'Die.Hard.1988.1080p/Die.Hard.1988.1080p.mp4';
const IRONWOOD = 'Ironwood (2018)';
const QUARRY = 'Quarry Lane (2004)';

function freshApi({
  importer,
  twoVideos = false,
}: {
  importer?: (composed: Importer) => Importer;
  /** Quarry Lane's folder holds a second video, so its guess cannot settle. */
  twoVideos?: boolean;
} = {}) {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);
  const dir = sandboxRoot('familyflix-import-many-guessed-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = libraryFixture(dir);
  for (const name of [IRONWOOD, QUARRY]) {
    mkdirSync(join(root, name));
    copyFileSync(join(root, DIE_HARD), join(root, name, `${name}.mp4`));
  }
  if (twoVideos) {
    copyFileSync(join(root, DIE_HARD), join(root, QUARRY, 'Extras.mp4'));
  }
  const folder = storage.addLibraryFolder(root);

  const mediaDomain = createMedia(media);
  const playback = createPlayback(
    media,
    fixedSlot(null),
    (id) =>
      storage.libraryFolders().find((each) => each.id === id)?.path ?? null
  );
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
    media,
    folder,
    baseUrl: `http://127.0.0.1:${port}`,
    sheet,
  };
}

const postImport = (baseUrl: string, sheetPath: string, mode: ImportMode) =>
  fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath, mode }),
  });

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

const postImportGuessed = (baseUrl: string, body: unknown): Promise<Response> =>
  fetch(`${baseUrl}/api/import/current/problems/import-guessed`, {
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
async function inReview(
  options: Parameters<typeof freshApi>[0] = {},
  mode: ImportMode = 'copy'
) {
  const api = freshApi(options);
  await postImport(api.baseUrl, api.sheet, mode);
  const run = await untilReview(api.baseUrl);
  expect(run.mode).toBe(mode);
  const noRow = run.problems.filter((problem) => problem.kind === 'no-row');
  if (noRow.length < 2) {
    throw new Error(`two no-row Problems wanted: ${JSON.stringify(run)}`);
  }
  return { ...api, run, noRow };
}

const ids = (run: ImportRun) => run.problems.map((problem) => problem.id);

const movieTitled = (
  storage: LibraryStorage,
  title: string
): Movie | undefined =>
  storage.listMovies({ sort: 'a-z' }).find((movie) => movie.title === title);

describe('POST /api/import/current/problems/import-guessed — 200', () => {
  it('answers the whole snapshot, every id asked imported and taken off, the rest kept', async () => {
    const { baseUrl, run, noRow } = await inReview();
    const asked = noRow.map((problem) => problem.id);

    const response = await postImportGuessed(baseUrl, { ids: asked });

    expect(response.status).toBe(200);
    const echo = (await response.json()) as ImportRun;
    expect(echo.phase).toBe('review');
    expect(ids(echo)).toEqual(ids(run).filter((id) => !asked.includes(id)));
  });

  it('imports every chosen folder under its guessed title and year', async () => {
    const { baseUrl, storage, noRow } = await inReview();
    expect(movieTitled(storage, 'Ironwood')).toBeUndefined();

    await postImportGuessed(baseUrl, { ids: noRow.map((p) => p.id) });

    expect(movieTitled(storage, 'Ironwood')).toMatchObject({ year: 2018 });
    expect(movieTitled(storage, 'Quarry Lane')).toMatchObject({ year: 2004 });
  });

  it('keeps the echo: the current run reads the same afterwards', async () => {
    const { baseUrl, noRow } = await inReview();

    const echo = (await (
      await postImportGuessed(baseUrl, { ids: noRow.map((p) => p.id) })
    ).json()) as ImportRun;

    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(ids(after)).toEqual(ids(echo));
  });

  it('asks the importer for each id in the order given', async () => {
    const asked: string[] = [];
    const { baseUrl, noRow } = await inReview({
      importer: (composed) => ({
        ...composed,
        importGuessed: vi.fn<Importer['importGuessed']>((id) => {
          asked.push(id);
          return composed.importGuessed(id);
        }),
      }),
    });
    const order = noRow.map((p) => p.id).reverse();

    const response = await postImportGuessed(baseUrl, { ids: order });

    expect(response.status).toBe(200);
    expect(asked).toEqual(order);
  });

  it('passes over an id it does not hold, importing the rest', async () => {
    const { baseUrl, storage, run, noRow } = await inReview();
    const ironwood = noRow.find((p) => p.title.startsWith('Ironwood'));
    if (ironwood === undefined) {
      throw new Error('no Ironwood row');
    }

    const response = await postImportGuessed(baseUrl, {
      ids: ['no-such-problem', ironwood.id],
    });

    expect(response.status).toBe(200);
    const echo = (await response.json()) as ImportRun;
    expect(ids(echo)).toEqual(ids(run).filter((id) => id !== ironwood.id));
    expect(movieTitled(storage, 'Ironwood')).toBeDefined();
    expect(movieTitled(storage, 'Quarry Lane')).toBeUndefined();
  });

  it('answers the snapshot unchanged when it holds none of the ids', async () => {
    const { baseUrl, run } = await inReview();

    const response = await postImportGuessed(baseUrl, { ids: ['gone'] });

    expect(response.status).toBe(200);
    expect(ids((await response.json()) as ImportRun)).toEqual(ids(run));
  });
});

describe('POST /api/import/current/problems/import-guessed — the run’s mode', () => {
  it('a Link run links each chosen folder’s video where it lies', async () => {
    const { baseUrl, storage, folder, noRow } = await inReview({}, 'link');

    await postImportGuessed(baseUrl, { ids: noRow.map((p) => p.id) });

    expect(movieTitled(storage, 'Ironwood')).toMatchObject({
      videoFolderId: folder.id,
      videoPath: `${IRONWOOD}/${IRONWOOD}.mp4`,
    });
    expect(movieTitled(storage, 'Quarry Lane')).toMatchObject({
      videoFolderId: folder.id,
      videoPath: `${QUARRY}/${QUARRY}.mp4`,
    });
  });

  it('a Copy run copies each chosen folder’s video in', async () => {
    const { baseUrl, storage, media, noRow } = await inReview({}, 'copy');

    await postImportGuessed(baseUrl, { ids: noRow.map((p) => p.id) });

    for (const title of ['Ironwood', 'Quarry Lane']) {
      const movie = movieTitled(storage, title);
      expect(movie?.videoFolderId).toBeNull();
      expect(existsSync(join(media, movie?.videoPath ?? 'missing'))).toBe(true);
    }
  });
});

describe('POST /api/import/current/problems/import-guessed — a row that cannot settle', () => {
  it('stays in the echo, redrawn as its new problem, while the others import', async () => {
    const { baseUrl, storage, noRow } = await inReview({ twoVideos: true });
    const quarry = noRow.find((p) => p.title.startsWith('Quarry Lane'));
    if (quarry === undefined) {
      throw new Error('no Quarry Lane row');
    }

    const response = await postImportGuessed(baseUrl, {
      ids: noRow.map((p) => p.id),
    });

    expect(response.status).toBe(200);
    const echo = (await response.json()) as ImportRun;
    expect(ids(echo)).not.toContain(quarry.id);
    expect(echo.problems).toContainEqual(
      expect.objectContaining({
        kind: 'no-video',
        reason: 'Two videos. Pick the film.',
      })
    );
    expect(movieTitled(storage, 'Quarry Lane')).toBeUndefined();
    expect(movieTitled(storage, 'Ironwood')).toBeDefined();
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(ids(after)).toEqual(ids(echo));
  });
});

describe('POST /api/import/current/problems/import-guessed — 400', () => {
  it.each([
    ['no ids at all', {}],
    ['an empty list', { ids: [] }],
    ['a string, not a list', { ids: 'p1' }],
    ['a list holding a number', { ids: [1] }],
  ])('refuses %s in a sentence, importing nothing', async (_, body) => {
    const { baseUrl, storage, run } = await inReview();

    const response = await postImportGuessed(baseUrl, body);

    expect(response.status).toBe(400);
    const { error } = (await response.json()) as { error: unknown };
    expect(typeof error).toBe('string');
    expect(error as string).toMatch(/^[A-Z].*\.$/);
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(ids(after)).toEqual(ids(run));
    expect(movieTitled(storage, 'Ironwood')).toBeUndefined();
  });
});

describe('POST /api/import/current/problems/import-guessed — 404', () => {
  it('answers 404 when there is no run, with a reason', async () => {
    const { baseUrl } = freshApi();

    const response = await postImportGuessed(baseUrl, { ids: ['p1'] });

    expect(response.status).toBe(404);
    const { error } = (await response.json()) as { error: unknown };
    expect(typeof error).toBe('string');
  });
});
