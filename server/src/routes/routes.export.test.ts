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
// that is not one of the two. A failing file route answers a status, never a
// page.
//
// 14 — Export, Phase 2: "Excel" (issue #138) turns `xlsx` from the refusal
// Phase 1 named into a `200` under the OpenXML spreadsheet type, and runs the
// round trip in both formats.
//
// The last two groups are the initiative's promise end to end, in both
// directions of the README's: a library the importer filled from its fixture,
// exported, and the export fed back to the importer over the same root — and
// nothing added; then the same export with one row edited, imported onto a
// fresh library — and a movie carrying the edited values.

import ExcelJS from 'exceljs';
import express from 'express';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';
import { Readable } from 'node:stream';
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
import { EXPORT_FORMATS } from '@/types';
import type { ExportFormat, ExportSummary, ImportRun } from '@/types';

/** The two formats, as `describe.each` cases. */
const FORMATS = [...EXPORT_FORMATS];

/** The content type each format's file route answers under. */
const CONTENT_TYPE: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

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
    expect(response.headers.get('content-type')).toBe(CONTENT_TYPE.csv);
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
});

describe('GET /api/export/xlsx — the file', () => {
  it('answers 200 under the OpenXML spreadsheet content type', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'xlsx');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(CONTENT_TYPE.xlsx);
  });

  it('names the file family-library.xlsx as an attachment', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'xlsx');

    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="family-library.xlsx"'
    );
  });

  it('sends a workbook, not a JSON refusal — the intermediate 400 from #137 is gone', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'xlsx');
    const bytes = Buffer.from(await response.arrayBuffer());

    // An OpenXML workbook is a zip, and a zip begins with `PK`.
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(response.headers.get('content-type')).not.toContain(
      'application/json'
    );
  });

  it('sends a body the Sheet reader reads back as every movie, A–Z by title', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'xlsx');
    const bytes = Buffer.from(await response.arrayBuffer());

    const rows = await readSheet(bytes, 'family-library.xlsx');
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

    const response = await getFile(baseUrl, 'xlsx');
    const bytes = Buffer.from(await response.arrayBuffer());

    const [appleGrove, , , zephyr] = await readSheet(
      bytes,
      'family-library.xlsx'
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

  it('sends one worksheet with a header row and no styling', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    const response = await getFile(baseUrl, 'xlsx');
    const bytes = Buffer.from(await response.arrayBuffer());

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    expect(workbook.worksheets).toHaveLength(1);
    const [sheet] = workbook.worksheets;
    const header = sheet.getRow(1);
    expect(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => header.getCell(n).value)
    ).toEqual([
      'Title',
      'Year',
      'Genres',
      'Director',
      'Cast',
      'Rating',
      'Status',
      'Subtitles',
    ]);
    expect(header.getCell(1).font?.bold ?? false).toBe(false);
    expect(sheet.getColumn(1).width).toBeUndefined();
    expect((sheet.views ?? []).some((view) => view.state === 'frozen')).toBe(
      false
    );
  });

  it('sends a header-only workbook for an empty library', async () => {
    const { baseUrl } = freshApi();

    const response = await getFile(baseUrl, 'xlsx');
    const bytes = Buffer.from(await response.arrayBuffer());

    expect(response.status).toBe(200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    expect(workbook.worksheets[0].rowCount).toBe(1);
    expect(await readSheet(bytes, 'family-library.xlsx')).toEqual([]);
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

describe.each(FORMATS)(
  'GET /api/export/%s — an export re-imported adds nothing',
  (format) => {
    const filename = `family-library.${format}`;

    it('exports the library the importer filled, A–Z', async () => {
      const { baseUrl, root, sheet } = freshApi();
      expect((await postImport(baseUrl, sheet, root)).status).toBe(201);
      await untilReview(baseUrl);

      const response = await getFile(baseUrl, format);
      const rows = await readSheet(
        Buffer.from(await response.arrayBuffer()),
        filename
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
      const response = await getFile(baseUrl, format);
      const exported = join(scratch, filename);
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
  }
);

// --- the round trip, with one row edited -----------------------------------------

/**
 * The export with one row's Year and Genres cells changed, in its own format —
 * what the maintainer does in Excel between the download and the re-import,
 * done through `exceljs` so the bytes go back out as the format they came in.
 */
async function withRowEdited(
  bytes: Buffer,
  format: ExportFormat,
  title: string,
  edits: { year: number; genres: string }
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  if (format === 'xlsx') {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
  } else {
    await workbook.csv.read(
      Readable.from([bytes.toString('utf8').replace(/^\uFEFF/, '')]),
      { map: (value: string) => value }
    );
  }
  const [sheet] = workbook.worksheets;
  const header = sheet.getRow(1);
  const column = (name: string): number => {
    for (let n = 1; n <= sheet.columnCount; n += 1) {
      if (header.getCell(n).value === name) {
        return n;
      }
    }
    throw new Error(`no ${name} column`);
  };
  let edited = false;
  sheet.eachRow((row, number) => {
    if (number > 1 && row.getCell(column('Title')).value === title) {
      row.getCell(column('Year')).value = edits.year;
      row.getCell(column('Genres')).value = edits.genres;
      edited = true;
    }
  });
  expect(edited).toBe(true);
  return format === 'xlsx'
    ? Buffer.from(await workbook.xlsx.writeBuffer())
    : Buffer.from(await workbook.csv.writeBuffer());
}

describe.each(FORMATS)(
  'GET /api/export/%s — an export edited and imported onto a fresh library',
  (format) => {
    const filename = `family-library.${format}`;

    it('yields a movie carrying the edited year and genres', async () => {
      // The library the maintainer exports: filled by the importer from its
      // fixture, then cancelled at review so the next run can start.
      const first = freshApi();
      expect(
        (await postImport(first.baseUrl, first.sheet, first.root)).status
      ).toBe(201);
      await untilReview(first.baseUrl);
      expect((await postCancel(first.baseUrl)).status).toBe(204);
      const response = await getFile(first.baseUrl, format);
      expect(response.status).toBe(200);
      const exported = Buffer.from(await response.arrayBuffer());

      // A year corrected and a genre added, the way Excel would save them.
      const edited = await withRowEdited(exported, format, 'Die Hard', {
        year: 1989,
        genres: 'Action, Thriller, Crime',
      });

      // The fresh library, over a root whose Die Hard folder carries no year
      // of its own — a folder named `Die.Hard.1988` would refuse the corrected
      // row as a near name, which is the matcher's rule and not the export's.
      const second = freshApi();
      renameSync(
        join(second.root, 'Die.Hard.1988.1080p'),
        join(second.root, 'Die Hard')
      );
      const sheetPath = join(second.scratch, filename);
      writeFileSync(sheetPath, edited);
      expect(
        (await postImport(second.baseUrl, sheetPath, second.root)).status
      ).toBe(201);
      const run = await untilReview(second.baseUrl);

      expect(run).toMatchObject({
        phase: 'review',
        found: 2,
        matched: 2,
        total: 2,
        done: 2,
        problems: [],
      });
      const movies = second.storage.listMovies({ sort: 'a-z' });
      expect(movies.map((movie) => movie.title)).toEqual([
        'Amélie',
        'Die Hard',
      ]);
      expect(movies[1]).toMatchObject({
        title: 'Die Hard',
        year: 1989,
        director: 'John McTiernan',
        cast: ['Bruce Willis', 'Alan Rickman'],
        rating: 8,
        watched: true,
      });
      expect(movies[1].genres.map((genre) => genre.name)).toEqual([
        'Action',
        'Thriller',
        'Crime',
      ]);
    });

    it('leaves the row it did not edit as the export wrote it', async () => {
      const first = freshApi();
      expect(
        (await postImport(first.baseUrl, first.sheet, first.root)).status
      ).toBe(201);
      await untilReview(first.baseUrl);
      expect((await postCancel(first.baseUrl)).status).toBe(204);
      const exported = Buffer.from(
        await (await getFile(first.baseUrl, format)).arrayBuffer()
      );
      const edited = await withRowEdited(exported, format, 'Die Hard', {
        year: 1989,
        genres: 'Action, Thriller, Crime',
      });

      const second = freshApi();
      renameSync(
        join(second.root, 'Die.Hard.1988.1080p'),
        join(second.root, 'Die Hard')
      );
      const sheetPath = join(second.scratch, filename);
      writeFileSync(sheetPath, edited);
      expect(
        (await postImport(second.baseUrl, sheetPath, second.root)).status
      ).toBe(201);
      await untilReview(second.baseUrl);

      const [amelie] = second.storage.listMovies({ sort: 'a-z' });
      expect(amelie).toMatchObject({
        title: 'Amélie',
        year: 2001,
        director: 'Jean-Pierre Jeunet',
        cast: ['Audrey Tautou'],
        rating: 7,
        watched: false,
      });
      expect(amelie.genres.map((genre) => genre.name)).toEqual([
        'Romance',
        'Comedy',
      ]);
    });
  }
);
