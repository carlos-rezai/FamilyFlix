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
// Two routes from the tracer bullet — `POST /api/import` and
// `GET /api/import/current` — a third from issue #126,
// `POST /api/import/current/cancel`, a fourth from issue #129,
// `DELETE /api/import/current/problems/:id` (the **Review step**'s _Skip_:
// `204`, then `404` for the same id), and one guard on a route that already
// existed: `POST /api/movies` keeps accepting bytes only, whatever a path
// field says. Issue #130 adds the two routes of **Resolve**:
// `GET /api/import/current/problems/:id` (the **Problem detail**, or `404`)
// and `POST /api/import/current/problems/:id/resolve` (_Save & continue_:
// the form's multipart, a **Found file** copied only from under the root).

import express from 'express';
import {
  cpSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
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
import type {
  ImportProblem,
  ImportProblemDetail,
  ImportRun,
  Movie,
} from '@/types';

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

const postCancel = (baseUrl: string) =>
  fetch(`${baseUrl}/api/import/current/cancel`, { method: 'POST' });

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
      log: expect.any(Array),
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
      expect(run).toMatchObject({ log: expect.any(Array), problems: [] });
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
      log: expect.any(Array),
      problems: [],
    });
    expect((await getCurrent(baseUrl)).status).toBe(200);
  });
});

/**
 * Cancel, over the wire: `204` with nothing to say, and from then on
 * `current` is a `404` — the run is discarded, not paused. The gate holds the
 * run mid-copy so the cancel lands on a run that is actually going.
 */
describe('POST /api/import/current/cancel', () => {
  it('answers 204 for a run that is going, and current answers 404 after it', async () => {
    const { seam, release } = gatedSeam();
    const { baseUrl, root, sheet } = freshApi({ seam });
    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });
    expect((await getCurrent(baseUrl)).status).toBe(200);

    const cancelled = postCancel(baseUrl);
    release();
    const response = await cancelled;

    expect(response.status).toBe(204);
    expect((await getCurrent(baseUrl)).status).toBe(404);
  });

  it('answers 204 for a run in review, and current answers 404 after it', async () => {
    const { baseUrl, root, sheet } = freshApi();
    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });
    await untilReview(baseUrl);

    const response = await postCancel(baseUrl);

    expect(response.status).toBe(204);
    expect((await getCurrent(baseUrl)).status).toBe(404);
  });

  it('lets a new run start once the old one is cancelled', async () => {
    const { baseUrl, root, sheet } = freshApi();
    const first = (await (
      await postImport(baseUrl, { sheetPath: sheet, rootPath: root })
    ).json()) as ImportRun;
    await untilReview(baseUrl);
    await postCancel(baseUrl);

    const response = await postImport(baseUrl, {
      sheetPath: sheet,
      rootPath: root,
    });

    expect(response.status).toBe(201);
    expect(((await response.json()) as ImportRun).id).not.toBe(first.id);
    await untilReview(baseUrl);
  });
});

describe('the importer is injected, not imported', () => {
  it('cancels through the injected importer’s own cancel', async () => {
    const cancel = vi.fn<Importer['cancel']>().mockResolvedValue(undefined);
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, cancel }),
    });

    const response = await postCancel(baseUrl);

    expect(response.status).toBe(204);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

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

const deleteProblem = (baseUrl: string, id: string) =>
  fetch(`${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });

/**
 * A **Source folder** under the root the fixture sheet does not name — the
 * one sure way to give a run a **Problem** (`no-row`) without touching the
 * fixture. An empty video file, because a folder no row claims is never
 * copied.
 */
function unlistedFolder(root: string, name = 'Ironwood (2018)'): void {
  mkdirSync(join(root, name));
  writeFileSync(join(root, name, 'Ironwood.mp4'), '');
}

/**
 * **Dismiss** over the wire — the **Review step**'s _Skip_: `204` with nothing
 * to say and the problem gone from `current`; `404` for an id that is not
 * there, which a second dismiss of the same id is. Gone is gone.
 */
describe('DELETE /api/import/current/problems/:id', () => {
  it('answers 204 and the problem is gone from current', async () => {
    const { baseUrl, root, sheet } = freshApi();
    unlistedFolder(root);
    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });
    const run = await untilReview(baseUrl);
    expect(run.problems).toHaveLength(1);

    const response = await deleteProblem(baseUrl, run.problems[0].id);

    expect(response.status).toBe(204);
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems).toEqual([]);
  });

  it('answers 404 for the same id a second time', async () => {
    const { baseUrl, root, sheet } = freshApi();
    unlistedFolder(root);
    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });
    const run = await untilReview(baseUrl);
    await deleteProblem(baseUrl, run.problems[0].id);

    const response = await deleteProblem(baseUrl, run.problems[0].id);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('answers 404 for an id that never was, and leaves the problems alone', async () => {
    const { baseUrl, root, sheet } = freshApi();
    unlistedFolder(root);
    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });
    await untilReview(baseUrl);

    const response = await deleteProblem(baseUrl, 'no-such-problem');

    expect(response.status).toBe(404);
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems).toHaveLength(1);
  });

  it('answers 404 when there is no run', async () => {
    const { baseUrl } = freshApi();

    const response = await deleteProblem(baseUrl, 'p1');

    // The route's own 404, with a reason — not Express's page for a route
    // that does not exist.
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('imports nothing for the dismissed problem', async () => {
    const { baseUrl, media, root, sheet } = freshApi();
    unlistedFolder(root);
    await postImport(baseUrl, { sheetPath: sheet, rootPath: root });
    const run = await untilReview(baseUrl);

    await deleteProblem(baseUrl, run.problems[0].id);

    // The two fixture films and nothing else: no folder was reserved for the
    // dismissed one, and no row was written.
    expect(readdirSync(media).sort()).toEqual(['amelie-2001', 'die-hard-1988']);
    const movies = (await (await fetch(`${baseUrl}/api/movies`)).json()) as {
      title: string;
    }[];
    expect(movies.map((movie) => movie.title).sort()).toEqual([
      'Amélie',
      'Die Hard',
    ]);
  });

  it('dismisses through the injected importer’s own dismiss, by the id in the path', async () => {
    const dismiss = vi.fn<Importer['dismiss']>().mockReturnValue(true);
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, dismiss }),
    });

    const response = await deleteProblem(baseUrl, 'p 1/x');

    expect(response.status).toBe(204);
    expect(dismiss).toHaveBeenCalledWith('p 1/x');
  });

  it('turns the injected importer’s false into the 404', async () => {
    const dismiss = vi.fn<Importer['dismiss']>().mockReturnValue(false);
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, dismiss }),
    });

    const response = await deleteProblem(baseUrl, 'p1');

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(dismiss).toHaveBeenCalledWith('p1');
  });
});

// --- 13 — Bulk import, Phase 5: Resolve — the found file and the resolve route (issue #130)
//
// Two routes for one **Problem**. `GET …/problems/:id` answers the **Problem
// detail** the form prefills from, or `404`. `POST …/problems/:id/resolve` is
// _Save & continue_: the form's own multipart encoding, parsed by the same
// reader the movie routes use, a **Found file** arriving as the path field
// the edit route already reads for a **Stored file** and a picked one as
// bytes. It is the only route in the app that accepts a path — and it copies
// from under the **Current run**'s root and nowhere else: a path outside it
// is a `400` with nothing copied. `201` with the movie, and the problem gone
// from `current`.

const getProblem = (baseUrl: string, id: string) =>
  fetch(`${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}`);

/** _Save & continue_ over the wire: the parts as the form appends them, in order. */
function postResolve(
  baseUrl: string,
  id: string,
  parts: [name: string, value: string | File][]
): Promise<Response> {
  const body = new FormData();
  for (const [name, value] of parts) {
    body.append(name, value);
  }
  return fetch(
    `${baseUrl}/api/import/current/problems/${encodeURIComponent(id)}/resolve`,
    { method: 'POST', body }
  );
}

/**
 * A `Media` whose copy of the one source file whose path ends in `filename`
 * throws once, then goes through — what leaves Die Hard behind as a `failed`
 * problem and still lets Resolve copy the same file afterwards.
 */
function failOnceSeam(filename: string): (real: Media) => Media {
  let failed = false;
  return (real) => ({
    ...real,
    copyIn: async (folder, source) => {
      if (!failed && source.endsWith(filename)) {
        failed = true;
        throw new Error('EBUSY: resource busy or locked');
      }
      return real.copyIn(folder, source);
    },
  });
}

/** An API whose run has left Die Hard behind as a `failed` problem. */
async function failedDieHardApi(): Promise<
  ReturnType<typeof freshApi> & { problem: ImportProblem; dieHard: string }
> {
  const api = freshApi({ seam: failOnceSeam('Die.Hard.1988.1080p.mp4') });
  await postImport(api.baseUrl, { sheetPath: api.sheet, rootPath: api.root });
  const run = await untilReview(api.baseUrl);
  const problem = run.problems.find((p) => p.kind === 'failed');
  if (problem === undefined) {
    throw new Error(`no failed problem: ${JSON.stringify(run.problems)}`);
  }
  return { ...api, problem, dieHard: join(api.root, 'Die.Hard.1988.1080p') };
}

/** The fields of the form, as `movieFormData` sends them for the fixture's Die Hard. */
const dieHardFields = (): [string, string][] => [
  ['title', 'Die Hard'],
  ['year', '1988'],
  ['director', 'John McTiernan'],
  [
    'description',
    'A New York cop takes on a tower full of thieves on Christmas Eve.',
  ],
  ['rating', '8'],
  ['genre', 'Action'],
  ['genre', 'Thriller'],
  ['cast', 'Bruce Willis'],
  ['cast', 'Alan Rickman'],
];

/** Every file under the managed directory, by name, in any folder. */
const managedFiles = (media: string): string[] =>
  readdirSync(media, { recursive: true })
    .map((entry) => String(entry).split('\\').join('/'))
    .filter((entry) => entry.includes('/'))
    .sort();

describe('GET /api/import/current/problems/:id', () => {
  it('answers 200 with the detail: row, folder, candidates and files', async () => {
    const { baseUrl, problem, dieHard } = await failedDieHardApi();

    const response = await getProblem(baseUrl, problem.id);

    expect(response.status).toBe(200);
    const detail = (await response.json()) as ImportProblemDetail;
    expect(detail).toMatchObject({
      id: problem.id,
      kind: 'failed',
      title: 'Die Hard',
      row: {
        title: 'Die Hard',
        year: 1988,
        genres: ['Action', 'Thriller'],
        director: 'John McTiernan',
        cast: ['Bruce Willis', 'Alan Rickman'],
        rating: 8,
      },
      folder: dieHard,
      candidates: [],
      files: {
        video: join(dieHard, 'Die.Hard.1988.1080p.mp4'),
        poster: join(dieHard, 'poster.jpg'),
        backdrop: join(dieHard, 'fanart.jpg'),
        subtitles: [
          {
            path: join(dieHard, 'Die.Hard.1988.1080p.en.srt'),
            language: 'English',
          },
          {
            path: join(dieHard, 'Die.Hard.1988.1080p.pt.srt'),
            language: 'Portuguese',
          },
        ],
      },
    });
  });

  it('answers 404 for an id that never was', async () => {
    const { baseUrl } = await failedDieHardApi();

    const response = await getProblem(baseUrl, 'no-such-problem');

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('answers 404 for a problem already dismissed', async () => {
    const { baseUrl, problem } = await failedDieHardApi();
    await deleteProblem(baseUrl, problem.id);

    const response = await getProblem(baseUrl, problem.id);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('answers 404 when there is no run', async () => {
    const { baseUrl } = freshApi();

    const response = await getProblem(baseUrl, 'p1');

    // The route's own 404, with a reason — not Express's page for a route
    // that does not exist.
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('answers the detail from the injected importer’s own problem, by the id in the path', async () => {
    const detail: ImportProblemDetail = {
      id: 'p 1/x',
      kind: 'no-folder',
      title: 'The Lantern Keeper',
      reason: 'No folder found matching this spreadsheet row.',
      row: { title: 'The Lantern Keeper', year: 2019, genres: ['Drama'] },
      candidates: [],
      files: { subtitles: [] },
    };
    const problem = vi.fn<Importer['problem']>().mockReturnValue(detail);
    const { baseUrl } = freshApi({
      importer: (composed) => ({ ...composed, problem }),
    });

    const response = await getProblem(baseUrl, 'p 1/x');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(detail);
    expect(problem).toHaveBeenCalledWith('p 1/x');
  });
});

describe('POST /api/import/current/problems/:id/resolve', () => {
  it('answers 201 with the movie, and the found file is in the managed directory', async () => {
    const { baseUrl, media, problem, dieHard } = await failedDieHardApi();

    const response = await postResolve(baseUrl, problem.id, [
      ...dieHardFields(),
      ['videoPath', join(dieHard, 'Die.Hard.1988.1080p.mp4')],
      ['posterPath', join(dieHard, 'poster.jpg')],
      ['subtitleLanguage', 'English'],
      ['subtitlePath', join(dieHard, 'Die.Hard.1988.1080p.en.srt')],
      ['subtitleLanguage', 'Portuguese'],
      ['subtitlePath', join(dieHard, 'Die.Hard.1988.1080p.pt.srt')],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(movie).toMatchObject({
      title: 'Die Hard',
      year: 1988,
      director: 'John McTiernan',
      cast: ['Bruce Willis', 'Alan Rickman'],
      rating: 8,
      videoPath: 'die-hard-1988/Die.Hard.1988.1080p.mp4',
      posterPath: 'die-hard-1988/poster.jpg',
    });
    expect(movie.genres.map((genre) => genre.name).sort()).toEqual([
      'Action',
      'Thriller',
    ]);
    expect(
      movie.subtitles.map((track) => [track.path, track.language])
    ).toEqual([
      ['die-hard-1988/Die.Hard.1988.1080p.en.srt', 'English'],
      ['die-hard-1988/Die.Hard.1988.1080p.pt.srt', 'Portuguese'],
    ]);
    expect(readFileSync(join(media, movie.videoPath))).toEqual(
      readFileSync(join(dieHard, 'Die.Hard.1988.1080p.mp4'))
    );
    expect(managedFiles(media)).toContain('die-hard-1988/poster.jpg');
  });

  it('serves the resolved film off the same wire as every other one', async () => {
    const { baseUrl, problem, dieHard } = await failedDieHardApi();
    const created = (await (
      await postResolve(baseUrl, problem.id, [
        ...dieHardFields(),
        ['videoPath', join(dieHard, 'Die.Hard.1988.1080p.mp4')],
      ])
    ).json()) as Movie;

    const detail = await fetch(`${baseUrl}/api/movies/${created.id}`);

    expect(detail.status).toBe(200);
    expect(((await detail.json()) as Movie).title).toBe('Die Hard');
  });

  it('takes a picked file as bytes beside a found one as a path', async () => {
    const { baseUrl, media, problem, dieHard } = await failedDieHardApi();

    const response = await postResolve(baseUrl, problem.id, [
      ...dieHardFields(),
      ['videoPath', join(dieHard, 'Die.Hard.1988.1080p.mp4')],
      [
        'poster',
        new File([new Uint8Array([0xff, 0xd8, 0xff])], 'better-poster.jpg', {
          type: 'image/jpeg',
        }),
      ],
    ]);

    expect(response.status).toBe(201);
    const movie = (await response.json()) as Movie;
    expect(movie.videoPath).toBe('die-hard-1988/Die.Hard.1988.1080p.mp4');
    expect(movie.posterPath).toBe('die-hard-1988/better-poster.jpg');
    expect(readFileSync(join(media, movie.posterPath ?? ''))).toEqual(
      Buffer.from([0xff, 0xd8, 0xff])
    );
  });

  it('answers 400 for a found path outside the root, with nothing copied', async () => {
    const { baseUrl, media, problem, scratch } = await failedDieHardApi();
    const outside = join(scratch, 'elsewhere.mp4');
    writeFileSync(outside, 'not the family’s');

    const response = await postResolve(baseUrl, problem.id, [
      ...dieHardFields(),
      ['videoPath', outside],
    ]);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(readdirSync(media).sort()).toEqual(['amelie-2001']);
    const movies = (await (await fetch(`${baseUrl}/api/movies`)).json()) as {
      title: string;
    }[];
    expect(movies.map((movie) => movie.title)).toEqual(['Amélie']);
    // And the problem is still listed: a refused save is a save not made.
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems.map((p) => p.id)).toEqual([problem.id]);
  });

  it('refuses a poster or a subtitle outside the root as firmly as the video', async () => {
    const { baseUrl, media, problem, dieHard, scratch } =
      await failedDieHardApi();
    writeFileSync(join(scratch, 'elsewhere.srt'), '');

    const response = await postResolve(baseUrl, problem.id, [
      ...dieHardFields(),
      ['videoPath', join(dieHard, 'Die.Hard.1988.1080p.mp4')],
      ['subtitleLanguage', 'English'],
      ['subtitlePath', join(scratch, 'elsewhere.srt')],
    ]);

    // The film named inside the root is not copied either: a refusal copies
    // nothing at all.
    expect(response.status).toBe(400);
    expect(readdirSync(media).sort()).toEqual(['amelie-2001']);
  });

  it('dismisses the problem on 201: current no longer lists it', async () => {
    const { baseUrl, problem, dieHard } = await failedDieHardApi();

    const response = await postResolve(baseUrl, problem.id, [
      ...dieHardFields(),
      ['videoPath', join(dieHard, 'Die.Hard.1988.1080p.mp4')],
    ]);

    expect(response.status).toBe(201);
    const after = (await (await getCurrent(baseUrl)).json()) as ImportRun;
    expect(after.problems).toEqual([]);
    expect((await getProblem(baseUrl, problem.id)).status).toBe(404);
  });

  it('answers 400 on the form’s own refusals — an untitled body', async () => {
    const { baseUrl, media, problem, dieHard } = await failedDieHardApi();

    const response = await postResolve(baseUrl, problem.id, [
      ['title', '   '],
      ['videoPath', join(dieHard, 'Die.Hard.1988.1080p.mp4')],
    ]);

    // The gate is still a title and a film, read by the same reader the
    // movie routes use; and a refused save copies nothing.
    expect(response.status).toBe(400);
    expect(readdirSync(media).sort()).toEqual(['amelie-2001']);
  });

  it('answers 404 for a problem that is not there, copying nothing', async () => {
    const { baseUrl, media, problem, dieHard } = await failedDieHardApi();
    await deleteProblem(baseUrl, problem.id);

    const response = await postResolve(baseUrl, problem.id, [
      ...dieHardFields(),
      ['videoPath', join(dieHard, 'Die.Hard.1988.1080p.mp4')],
    ]);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
    expect(readdirSync(media).sort()).toEqual(['amelie-2001']);
  });

  it('answers 404 when there is no run', async () => {
    const { baseUrl, root } = freshApi();

    const response = await postResolve(baseUrl, 'p1', [
      ...dieHardFields(),
      [
        'videoPath',
        join(root, 'Die.Hard.1988.1080p', 'Die.Hard.1988.1080p.mp4'),
      ],
    ]);

    // The route's own 404, with a reason — not Express's page for a route
    // that does not exist.
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: expect.any(String) });
  });

  it('answers 400 for a body that is not multipart', async () => {
    const { baseUrl, problem } = await failedDieHardApi();

    const response = await fetch(
      `${baseUrl}/api/import/current/problems/${problem.id}/resolve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Die Hard' }),
      }
    );

    expect(response.status).toBe(400);
  });
});
