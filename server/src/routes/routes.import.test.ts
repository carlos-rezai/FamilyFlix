// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
//
// The fifth domain's slice of the router's tests — the seam `routes.test.ts`'s
// header names and that file is too large to take: a real listener, a real
// `fetch`, real status codes and bodies, over a real `:memory:` library and a
// real managed media directory. The importer is injected the way `playback`
// and `media` are, as the fifth argument, and these tests are the only thing
// that ever composes it beside `main.ts`.
//
// Two routes in this slice — `POST /api/import` and `GET /api/import/current`
// — and one guard on a route that already existed: `POST /api/movies` keeps
// accepting bytes only, whatever a path field says.

import express from 'express';
import { cpSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApiRouter } from '.';
import {
  createImporter,
  type Importer,
} from '../import-export/createImporter/createImporter';
import { createMedia, type Media } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ImportRun, Movie } from '@/types';

const FIXTURE = fileURLToPath(
  new URL('../import-export/createImporter/fixture/', import.meta.url)
);

// --- per-test resource tracking ------------------------------------------------

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

/**
 * A fresh library behind a listening API, its managed media directory, and a
 * copy of the fixture tree and sheet under the same sandbox — the **Library
 * root** the tests point the import at.
 *
 * `seam` wraps the real `Media` the importer is composed over; `importer`
 * replaces the importer altogether, for the one group that asks whether the
 * router reaches the domain through its argument and nowhere else.
 */
function freshApi({
  seam = (real) => real,
  importer,
}: {
  seam?: (real: Media) => Media;
  importer?: (composed: Importer) => Importer;
} = {}): {
  storage: LibraryStorage;
  baseUrl: string;
  media: string;
  root: string;
  sheet: string;
  scratch: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-import-api-');
  const media = join(dir, 'media');
  const root = join(dir, 'root');
  const scratch = join(dir, 'scratch');
  mkdirSync(media);
  mkdirSync(scratch);
  cpSync(join(FIXTURE, 'root'), root, { recursive: true });
  const sheet = join(dir, 'library.xlsx');
  cpSync(join(FIXTURE, 'library.xlsx'), sheet);

  const mediaDomain = seam(createMedia(media));
  const playback = createPlayback(media, null);
  const composed = createImporter({ storage, media: mediaDomain, playback });

  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      importer ? importer(composed) : composed
    )
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    media,
    root,
    sheet,
    scratch,
  };
}

function postImport(baseUrl: string, body: unknown): Promise<Response> {
  return fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const getCurrent = (baseUrl: string) => fetch(`${baseUrl}/api/import/current`);

/** The snapshot once the run has reached review — or a failure if it never does. */
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
 * A `Media` whose first copy waits until the test lets it go — the one way to
 * hold a run in its importing phase for as long as an assertion needs.
 */
function gatedSeam(): { seam: (real: Media) => Media; release: () => void } {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  return {
    release: () => release(),
    seam: (real) => ({
      ...real,
      copyIn: async (folder, source) => {
        if (!held) {
          held = true;
          await gate;
        }
        return real.copyIn(folder, source);
      },
    }),
  };
}

describe('POST /api/import — starting a run', () => {
  it('answers 201 with the snapshot', async () => {
    const { baseUrl, root, sheet } = freshApi();

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
    });

    expect(response.status).toBe(201);
    const run = (await response.json()) as ImportRun;
    expect(run).toMatchObject({
      id: expect.any(String),
      phase: expect.stringMatching(/^(scanning|importing|review)$/),
      startedAt: expect.any(String),
      found: expect.any(Number),
      total: expect.any(Number),
      done: expect.any(Number),
      matched: expect.any(Number),
      currentItem: expect.any(String),
      log: [],
      problems: [],
    });
  });

  it('runs the fixture through to two movies on the library', async () => {
    const { baseUrl, storage, root, sheet } = freshApi();

    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });
    const run = await untilReview(baseUrl);

    expect(run).toMatchObject({
      phase: 'review',
      found: 2,
      matched: 2,
      total: 2,
      done: 2,
    });
    expect(
      storage
        .listMovies({ sort: 'a-z' })
        .map((movie) => movie.title)
        .sort()
    ).toEqual(['Amélie', 'Die Hard']);
  });

  it('serves an imported film’s poster and detail off the same wire as a hand-added one', async () => {
    const { baseUrl, storage, root, sheet } = freshApi();

    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });
    await untilReview(baseUrl);

    const dieHard = storage
      .listMovies({ sort: 'a-z' })
      .find((movie) => movie.title === 'Die Hard') as Movie;
    const poster = await fetch(`${baseUrl}/api/images/${dieHard.posterPath}`);
    const detail = await fetch(`${baseUrl}/api/movies/${dieHard.id}`);

    expect(poster.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(((await detail.json()) as Movie).runtimeMinutes).toBe(132);
  });

  it('answers 409 while a run exists', async () => {
    const { seam, release } = gatedSeam();
    const { baseUrl, root, sheet } = freshApi({ seam });
    try {
      const first = await postImport(baseUrl, {
        sheetPath: sheet,
        rootPath: root,
      });
      expect(first.status).toBe(201);

      const second = await postImport(baseUrl, {
        sheetPath: sheet,
        rootPath: root,
      });

      expect(second.status).toBe(409);
      expect(await second.json()).toMatchObject({ error: expect.any(String) });
    } finally {
      // Let the run finish before the listener and the library are closed
      // under it.
      release();
      await untilReview(baseUrl);
    }
  });
});

describe('POST /api/import — refusing the sheet', () => {
  it('answers 400 on the sheet field for a sheet that does not exist', async () => {
    const { baseUrl, root, scratch } = freshApi();

    const response = await postImport(baseUrl, {
      sheetPath: join(scratch, 'missing.xlsx'),
      rootPath: root,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: expect.any(String),
      field: 'sheet',
    });
  });

  it('answers 400 on the sheet field for a sheet that cannot be read', async () => {
    const { baseUrl, root, scratch } = freshApi();
    const sheet = join(scratch, 'folder.xlsx');
    mkdirSync(sheet);

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'sheet' });
  });

  it('answers 400 on the sheet field for a file that is neither .xlsx nor .csv', async () => {
    const { baseUrl, root, scratch } = freshApi();
    const sheet = join(scratch, 'library.txt');
    writeFileSync(sheet, 'Title,Year\nDie Hard,1988\n');

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'sheet' });
  });

  it('answers 400 on the sheet field for a sheet with no title column', async () => {
    const { baseUrl, root, scratch } = freshApi();
    const sheet = join(scratch, 'no-title.csv');
    writeFileSync(sheet, 'Year,Genre\n1988,Action\n');

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'sheet' });
  });

  it('answers 400 on the sheet field when the body names no sheet at all', async () => {
    const { baseUrl, root } = freshApi();

    const response = await postImport(baseUrl, { rootPath: root });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'sheet' });
  });

  it('creates no run on a refusal', async () => {
    const { baseUrl, root, scratch } = freshApi();

    await postImport(baseUrl, {
      sheetPath: join(scratch, 'missing.xlsx'),
      rootPath: root,
    });

    expect((await getCurrent(baseUrl)).status).toBe(404);
  });
});

describe('POST /api/import — refusing the root', () => {
  it('answers 400 on the root field for a root that does not exist', async () => {
    const { baseUrl, sheet, scratch } = freshApi();

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: join(scratch, 'nowhere'),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: expect.any(String),
      field: 'root',
    });
  });

  it('answers 400 on the root field for a root that is not a directory', async () => {
    const { baseUrl, sheet } = freshApi();

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: sheet,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'root' });
  });

  it('answers 400 on the root field when the body names no root at all', async () => {
    const { baseUrl, sheet } = freshApi();

    const response = await postImport(baseUrl, { sheetPath: sheet });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ field: 'root' });
  });

  it('creates no run on a refusal', async () => {
    const { baseUrl, sheet, scratch } = freshApi();

    await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: join(scratch, 'nowhere'),
    });

    expect((await getCurrent(baseUrl)).status).toBe(404);
  });
});

describe('GET /api/import/current', () => {
  it('answers 404 when there is no run', async () => {
    const { baseUrl } = freshApi();

    const response = await getCurrent(baseUrl);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('answers 200 with the snapshot while the run is going', async () => {
    const { seam, release } = gatedSeam();
    const { baseUrl, root, sheet } = freshApi({ seam });
    try {
      const started = (await (
        await postImport(baseUrl, { sheetPath: sheet, rootPath: root })
      ).json()) as ImportRun;

      const response = await getCurrent(baseUrl);

      expect(response.status).toBe(200);
      const run = (await response.json()) as ImportRun;
      expect(run.id).toBe(started.id);
      expect(run.phase).toMatch(/^(scanning|importing)$/);
      expect(run).toMatchObject({ log: [], problems: [] });
    } finally {
      // Let the run finish before the listener and the library are closed
      // under it.
      release();
      await untilReview(baseUrl);
    }
  });

  it('answers 200 with the finished snapshot once the run is in review', async () => {
    const { baseUrl, root, sheet } = freshApi();
    const started = (await (
      await postImport(baseUrl, { sheetPath: sheet, rootPath: root })
    ).json()) as ImportRun;

    const run = await untilReview(baseUrl);

    expect(run.id).toBe(started.id);
    expect(run).toMatchObject({
      phase: 'review',
      found: 2,
      total: 2,
      done: 2,
      matched: 2,
      log: [],
      problems: [],
    });
    expect((await getCurrent(baseUrl)).status).toBe(200);
  });
});

describe('the importer is injected, not imported', () => {
  it('starts the run through the injected importer’s own start', async () => {
    const start = vi.fn<Importer['start']>();
    const { baseUrl, root, sheet } = freshApi({
      importer: (composed) => ({
        ...composed,
        start: (sheetPath, rootPath) => {
          start(sheetPath, rootPath);
          return composed.start(sheetPath, rootPath);
        },
      }),
    });

    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });

    expect(start).toHaveBeenCalledWith(sheet, root);
  });

  it('answers current from the injected importer’s own current', async () => {
    const snapshot: ImportRun = {
      id: 'run-1',
      phase: 'scanning',
      startedAt: '2026-09-13T10:00:00.000Z',
      found: 12,
      total: 0,
      done: 0,
      matched: 0,
      currentItem: 'C:\\Movies\\Die Hard (1988)',
      log: [],
      problems: [],
    };
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, current: () => snapshot }),
    });

    const response = await getCurrent(baseUrl);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(snapshot);
  });
});

describe('POST /api/movies — bytes only', () => {
  it('takes no path field for the video, whatever it names', async () => {
    const { baseUrl, media, root } = freshApi();
    const body = new FormData();
    body.append('title', 'Die Hard');
    body.append('year', '1988');
    // The fixture's real video, by its absolute path — what a **Found file**
    // travels as on the resolve route, and what this route must never copy
    // from: anyone who can reach it could name any file on the machine.
    body.append(
      'video',
      join(root, 'Die.Hard.1988.1080p', 'Die.Hard.1988.1080p.mp4')
    );
    body.append(
      'videoPath',
      join(root, 'Die.Hard.1988.1080p', 'Die.Hard.1988.1080p.mp4')
    );

    const response = await fetch(`${baseUrl}/api/movies`, {
      method: 'POST',
      body,
    });

    // Whatever the route makes of the body, the file named was neither copied
    // nor stored: the managed directory holds no video, and the row — if one
    // was added — points at nothing.
    const copied = readdirSync(media, { recursive: true }).filter((entry) =>
      String(entry).endsWith('.mp4')
    );
    expect(copied).toEqual([]);
    if (response.status === 201) {
      const movie = (await response.json()) as Movie;
      expect(movie.videoPath).toBe('');
    }
  });
});
