// @vitest-environment node
//
// 14 — Export, Phase 1: "the tracer bullet" (issue #137).
//
// The export's slice of the router's tests, beside the import's — the seam
// `routes.test.ts`'s header names and that file is too large to take: a real
// listener, a real `fetch`, real status codes, headers and bodies, over a real
// `:memory:` library. Nothing new is injected: there is no run, no state and
// no cancel, so no export domain object — the file route is
// `storage.listMovies({ sort: 'a-z' })` → `writeSheet` → send, and the summary
// is `storage.countMovies()`.
//
// Two routes: `GET /api/export` → `200 { movieCount }`, and
// `GET /api/export/:format` → the bytes of one **Export file** under the CSV
// content type and the attachment disposition, or `400 { error }` for a format
// that is not one of the two. In this slice `xlsx` is refused too — the
// writer's second arm is Phase 2 — an intermediate state named rather than
// hidden. A failing file route answers a status, never a page.
//
// The last group is the initiative's promise end to end: a library the
// importer filled from its fixture, exported, and the export fed back to the
// importer over the same root — and nothing added.

import express from 'express';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createImporter } from '../import-export/createImporter/createImporter';
import { readSheet } from '../import-export/readSheet/readSheet';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import type { ExportSummary, ImportRun } from '@/types';

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
 * A fresh library behind a listening API, composed the way `main.ts` composes
 * it, plus a copy of the importer's fixture under the same sandbox for the
 * one group that runs an import.
 */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  root: string;
  sheet: string;
  scratch: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-export-api-');
  const media = join(dir, 'media');
  const scratch = join(dir, 'scratch');
  mkdirSync(media);
  mkdirSync(scratch);
  const { root, sheet } = libraryFixture(dir, 'library.csv');

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, null);
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback })
    )
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return { storage, baseUrl: `http://127.0.0.1:${port}`, root, sheet, scratch };
}

const getSummary = (baseUrl: string) => fetch(`${baseUrl}/api/export`);
const getFile = (baseUrl: string, format: string) =>
  fetch(`${baseUrl}/api/export/${format}`);

/** Four movies, added out of order, so A–Z is something the route has to do. */
function addLibrary(storage: LibraryStorage): void {
  storage.addMovie(
    newMovie({
      title: 'Zephyr',
      videoPath: 'Zephyr (2020)/zephyr.mkv',
      year: 2020,
      genres: ['Drama'],
      watched: true,
    })
  );
  storage.addMovie(
    newMovie({
      title: 'apple Grove',
      videoPath: 'apple Grove (2019)/apple-grove.mkv',
      year: 2019,
      director: 'Ana Sørensen',
      cast: ['Marit Holt', 'Peder Vinge'],
      rating: 7,
      genres: ['Comedy', 'Romance'],
      resumePositionSeconds: 600,
      subtitles: [
        { path: 'apple Grove (2019)/en.srt', language: 'en' },
        { path: 'apple Grove (2019)/pt.srt', language: 'pt' },
      ],
    })
  );
  storage.addMovie(
    newMovie({ title: 'Meridian', videoPath: 'Meridian (2021)/meridian.mkv' })
  );
  storage.addMovie(
    newMovie({
      title: 'Backwater',
      videoPath: 'Backwater (2018)/backwater.mkv',
      year: 2018,
    })
  );
}

describe('GET /api/export — the summary', () => {
  it('answers 200 with a movie count of 0 on an empty library', async () => {
    const { baseUrl } = freshApi();

    const response = await getSummary(baseUrl);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect((await response.json()) as ExportSummary).toEqual({ movieCount: 0 });
  });

  it('answers the number of movies in the library', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getSummary(baseUrl);

    expect(response.status).toBe(200);
    expect((await response.json()) as ExportSummary).toEqual({ movieCount: 4 });
  });

  it('answers the count as it stands now, not as it stood at startup', async () => {
    const { storage, baseUrl } = freshApi();
    expect(await (await getSummary(baseUrl)).json()).toEqual({ movieCount: 0 });

    addLibrary(storage);

    expect(await (await getSummary(baseUrl)).json()).toEqual({ movieCount: 4 });
  });
});

describe('GET /api/export/csv — the file', () => {
  it('answers 200 under the CSV content type', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'csv');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/csv; charset=utf-8'
    );
  });

  it('names the file family-library.csv as an attachment', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'csv');

    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="family-library.csv"'
    );
  });

  it('sends a body the Sheet reader reads back as every movie, A–Z by title', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'csv');
    const bytes = Buffer.from(await response.arrayBuffer());

    const rows = await readSheet(bytes, 'family-library.csv');
    expect(rows.map((row) => row.title)).toEqual([
      'apple Grove',
      'Backwater',
      'Meridian',
      'Zephyr',
    ]);
  });

  it('sends every column the export carries', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'csv');
    const bytes = Buffer.from(await response.arrayBuffer());

    const [appleGrove, , , zephyr] = await readSheet(
      bytes,
      'family-library.csv'
    );
    expect(appleGrove).toEqual({
      title: 'apple Grove',
      year: 2019,
      genres: ['Comedy', 'Romance'],
      director: 'Ana Sørensen',
      cast: ['Marit Holt', 'Peder Vinge'],
      synopsis: null,
      rating: 7,
      // Part-way through is In progress, which the reader reads as not watched.
      watched: false,
    });
    expect(zephyr).toMatchObject({
      title: 'Zephyr',
      year: 2020,
      watched: true,
    });
  });

  it('begins with a UTF-8 BOM', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'csv');
    const bytes = Buffer.from(await response.arrayBuffer());

    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it('sends a header-only file for an empty library', async () => {
    const { baseUrl } = freshApi();

    const response = await getFile(baseUrl, 'csv');
    const text = Buffer.from(await response.arrayBuffer()).toString('utf8');

    expect(response.status).toBe(200);
    expect(text.replace(/^\uFEFF/, '').trim()).toBe(
      'Title,Year,Genres,Director,Cast,Rating,Status,Subtitles'
    );
  });
});

describe('GET /api/export/:format — a format the route refuses', () => {
  it('answers 400 with an error for a format that is neither csv nor xlsx', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'pdf');

    expect(response.status).toBe(400);
    expect((await response.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining('pdf'),
    });
  });

  it('answers a status and a JSON body, never a page', async () => {
    const { baseUrl } = freshApi();

    const response = await getFile(baseUrl, 'pdf');

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('content-disposition')).toBeNull();
    const text = await response.text();
    expect(text).not.toContain('<html');
    expect(() => JSON.parse(text) as unknown).not.toThrow();
  });

  it('refuses CSV spelt in upper case — the two formats are the wire’s own names', async () => {
    const { baseUrl } = freshApi();

    const response = await getFile(baseUrl, 'CSV');

    expect(response.status).toBe(400);
  });

  // Phase 2 turns this into a 200 under the OpenXML type; until the writer's
  // second arm exists the honest answer is a refusal, and the dialog's
  // _Export as Excel_ meets it as the refused request it already handles.
  it('answers 400 for xlsx in this slice — the writer has no Excel arm yet', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'xlsx');

    expect(response.status).toBe(400);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect((await response.json()) as { error: string }).toMatchObject({
      error: expect.any(String),
    });
  });
});

// --- the round trip through Bulk import ------------------------------------------

const postImport = (baseUrl: string, sheetPath: string, rootPath: string) =>
  fetch(`${baseUrl}/api/import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheetPath, rootPath }),
  });

const postCancel = (baseUrl: string) =>
  fetch(`${baseUrl}/api/import/current/cancel`, { method: 'POST' });

/** The snapshot once the run has reached review — or a failure if it never does. */
async function untilReview(baseUrl: string): Promise<ImportRun> {
  const deadline = Date.now() + 10_000;
  for (;;) {
    const response = await fetch(`${baseUrl}/api/import/current`);
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

describe('GET /api/export/csv — an export re-imported adds nothing', () => {
  it('exports the library the importer filled, A–Z', async () => {
    const { baseUrl, root, sheet } = freshApi();
    expect((await postImport(baseUrl, sheet, root)).status).toBe(201);
    await untilReview(baseUrl);

    const response = await getFile(baseUrl, 'csv');
    const rows = await readSheet(
      Buffer.from(await response.arrayBuffer()),
      'family-library.csv'
    );

    expect(rows.map((row) => row.title)).toEqual(['Amélie', 'Die Hard']);
    expect(rows[1]).toMatchObject({
      year: 1988,
      genres: ['Action', 'Thriller'],
      director: 'John McTiernan',
      cast: ['Bruce Willis', 'Alan Rickman'],
      rating: 8,
      watched: true,
    });
  });

  it('is every movie Already in library when fed back to the importer', async () => {
    const { storage, baseUrl, root, sheet, scratch } = freshApi();
    expect((await postImport(baseUrl, sheet, root)).status).toBe(201);
    await untilReview(baseUrl);
    expect((await postCancel(baseUrl)).status).toBe(204);
    const before = storage.listMovies({ sort: 'a-z' });

    // The export, saved as the file the family's Downloads folder would hold.
    const response = await getFile(baseUrl, 'csv');
    const exported = join(scratch, 'family-library.csv');
    writeFileSync(exported, Buffer.from(await response.arrayBuffer()));

    expect((await postImport(baseUrl, exported, root)).status).toBe(201);
    const run = await untilReview(baseUrl);

    expect(run).toMatchObject({
      phase: 'review',
      found: 2,
      matched: 0,
      total: 0,
      done: 0,
      problems: [],
    });
    expect(run.log.map((line) => line.text)).toEqual(
      expect.arrayContaining([
        '– Already in library Amélie (2001)',
        '– Already in library Die Hard (1988)',
      ])
    );
    expect(storage.listMovies({ sort: 'a-z' })).toEqual(before);
    expect(storage.countMovies()).toBe(2);
  });
});
