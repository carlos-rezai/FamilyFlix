// @vitest-environment node
//
// 31 — Export options, Phase 1: "the tracer" (issue #276).
//
// The export's new route pair, through a real listener and a real `fetch` over
// a real `:memory:` library — `routes.export.test.ts`'s seam, kept apart from
// that file because its download route retires in this initiative's refactor.
//
// - `GET /api/export` → the grown **Export summary**: `movieCount`,
//   `seriesCount`, `episodeCount`, `defaultDestination` (the first **Library
//   folder** in the order added that `readableFolder` calls readable, else
//   `<home>\Downloads`) and `folderName` (today's **Export name**).
// - `POST /api/export { format, destination, images, subtitles }` → `201
//   ExportResult { folder, movieCount, seriesCount }`, or `400 { error }` for a
//   malformed body or a refused destination.
//
// And the round trip, for films: an untouched export, written to disk by the
// server and fed back to Bulk import over the same root, adds nothing; and the
// same export with one row edited, imported onto a fresh library, imports the
// edit and leaves the other row as written.
//
// And log 14's edges, ported from the download route before it retired: the
// two awkward titles — _Amélie_, a diacritic; _"Whatever," she said_, a comma
// and a double quote — read back identically in both formats; the CSV's BOM
// ahead of them and stripped by the reader; a library of none written as the
// header row alone; and the summary read as the library stands now.

import ExcelJS from 'exceljs';
import express from 'express';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';

import { createApiRouter } from '.';
import { createEnrichment } from '../enrichment/createEnrichment/createEnrichment';
import { offlineTmdb } from '../test-support/offlineTmdb/offlineTmdb';
import { createImporter } from '../import-export/createImporter/createImporter';
import { exportName } from '../import-export/exportName/exportName';
import { readSheet } from '../import-export/readSheet/readSheet';
import { createMedia } from '../media/createMedia/createMedia';
import { createPlayback } from '../playback/createPlayback/createPlayback';
import { createSqliteStorage, type LibraryStorage } from '../library';
import { fixedSlot } from '../test-support/fixedSlot/fixedSlot';
import { libraryFixture } from '../test-support/libraryFixture/libraryFixture';
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import { EXPORT_COLUMNS, EXPORT_FORMATS } from '@/types';
import type {
  ExportFormat,
  ExportResult,
  ExportSummary,
  ImportRun,
} from '@/types';

const FORMATS = [...EXPORT_FORMATS];

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

function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  dir: string;
  root: string;
  sheet: string;
  scratch: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-export-folder-api-');
  const media = join(dir, 'media');
  const scratch = join(dir, 'scratch');
  mkdirSync(media);
  mkdirSync(scratch);
  const { root, sheet } = libraryFixture(dir, 'library.csv');

  const mediaDomain = createMedia(media);
  const playback = createPlayback(media, fixedSlot(null));
  const app = express();
  app.use(
    '/api',
    createApiRouter(
      storage,
      media,
      playback,
      mediaDomain,
      createImporter({ storage, media: mediaDomain, playback }),
      createEnrichment({ storage, client: offlineTmdb(), media: mediaDomain })
    )
  );

  const server = app.listen(0);
  servers.push(server);

  const { port } = server.address() as AddressInfo;
  return {
    storage,
    baseUrl: `http://127.0.0.1:${port}`,
    dir,
    root,
    sheet,
    scratch,
  };
}

async function getSummary(baseUrl: string): Promise<ExportSummary> {
  const response = await fetch(`${baseUrl}/api/export`);
  expect(response.status).toBe(200);
  return (await response.json()) as ExportSummary;
}

const postExport = (baseUrl: string, body: unknown) =>
  fetch(`${baseUrl}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const addFolder = (baseUrl: string, path: string) =>
  fetch(`${baseUrl}/api/library-folders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });

/** A directory of its own under the sandbox. */
function folder(dir: string, name: string): string {
  const path = join(dir, name);
  mkdirSync(path, { recursive: true });
  return path;
}

/** Three films, and two series of two and three episodes. */
function addLibrary(storage: LibraryStorage): void {
  storage.addMovie(
    newMovie({
      title: 'Zephyr',
      videoPath: 'Zephyr (2020)/zephyr.mkv',
      year: 2020,
    })
  );
  storage.addMovie(
    newMovie({
      title: 'Backwater',
      videoPath: 'Backwater (2018)/b.mkv',
      year: 2018,
    })
  );
  storage.addMovie(
    newMovie({ title: 'Meridian', videoPath: 'Meridian (2021)/m.mkv' })
  );
  const harbor = storage.addSeries({ title: 'Harbor & Vine', year: 2021 });
  for (const number of [1, 2]) {
    storage.addEpisode(harbor.id, {
      season: 1,
      number,
      videoPath: `harbor-2021/season-01/e${number}.mp4`,
    });
  }
  const keepers = storage.addSeries({
    title: 'Lighthouse Keepers',
    year: 2019,
  });
  for (const number of [1, 2, 3]) {
    storage.addEpisode(keepers.id, {
      season: 1,
      number,
      videoPath: `keepers-2019/season-01/e${number}.mp4`,
    });
  }
}

describe('GET /api/export — the grown summary', () => {
  it('answers zero of everything on an empty library', async () => {
    const { baseUrl } = freshApi();

    expect(await getSummary(baseUrl)).toMatchObject({
      movieCount: 0,
      seriesCount: 0,
      episodeCount: 0,
    });
  });

  it('counts the films, the series and the episodes', async () => {
    const { storage, baseUrl } = freshApi();
    addLibrary(storage);

    expect(await getSummary(baseUrl)).toMatchObject({
      movieCount: 3,
      seriesCount: 2,
      episodeCount: 5,
    });
  });

  it('names today’s Export name as the folder', async () => {
    const { baseUrl } = freshApi();

    const summary = await getSummary(baseUrl);

    expect(summary.folderName).toBe(exportName(new Date()));
    expect(summary.folderName).toMatch(
      /^familyflix-collection_\d{2}-\d{2}-\d{4}$/
    );
  });
});

describe('GET /api/export — the default destination', () => {
  it('is Downloads under the home folder with no Library folder listed', async () => {
    const { baseUrl } = freshApi();

    expect((await getSummary(baseUrl)).defaultDestination).toBe(
      join(homedir(), 'Downloads')
    );
  });

  it('is the first Library folder, in the order added', async () => {
    const { baseUrl, dir } = freshApi();
    const movies = folder(dir, 'Movies');
    const kids = folder(dir, 'Kids');
    expect((await addFolder(baseUrl, movies)).status).toBe(201);
    expect((await addFolder(baseUrl, kids)).status).toBe(201);

    expect((await getSummary(baseUrl)).defaultDestination).toBe(movies);
  });

  it('skips a listed folder that cannot be reached', async () => {
    const { baseUrl, dir } = freshApi();
    const movies = folder(dir, 'Movies');
    const kids = folder(dir, 'Kids');
    expect((await addFolder(baseUrl, movies)).status).toBe(201);
    expect((await addFolder(baseUrl, kids)).status).toBe(201);
    rmSync(movies, { recursive: true, force: true });

    expect((await getSummary(baseUrl)).defaultDestination).toBe(kids);
  });

  it('is Downloads when every listed folder is out of reach', async () => {
    const { baseUrl, dir } = freshApi();
    const movies = folder(dir, 'Movies');
    expect((await addFolder(baseUrl, movies)).status).toBe(201);
    rmSync(movies, { recursive: true, force: true });

    expect((await getSummary(baseUrl)).defaultDestination).toBe(
      join(homedir(), 'Downloads')
    );
  });
});

describe('POST /api/export — written', () => {
  it('answers 201 with the folder it wrote and the counts', async () => {
    const { storage, baseUrl, dir } = freshApi();
    addLibrary(storage);
    const destination = folder(dir, 'Exports');

    const response = await postExport(baseUrl, {
      format: 'csv',
      destination,
      images: false,
      subtitles: false,
    });

    expect(response.status).toBe(201);
    const result = (await response.json()) as ExportResult;
    expect(result).toEqual({
      folder: join(destination, exportName(new Date())),
      movieCount: 3,
      seriesCount: 2,
    });
  });

  it('leaves the dated folder on disk, holding the films’ sheet', async () => {
    const { storage, baseUrl, dir } = freshApi();
    addLibrary(storage);
    const destination = folder(dir, 'Exports');

    const result = (await (
      await postExport(baseUrl, {
        format: 'xlsx',
        destination,
        images: false,
        subtitles: false,
      })
    ).json()) as ExportResult;

    const name = exportName(new Date());
    expect(readdirSync(destination)).toEqual([name]);
    const sheet = join(result.folder, `${name}.xlsx`);
    const rows = await readSheet(readFileSync(sheet), `${name}.xlsx`);
    expect(rows.map((row) => row.title)).toEqual(
      expect.arrayContaining(['Backwater', 'Meridian', 'Zephyr'])
    );
  });
});

describe('POST /api/export — refused', () => {
  it('answers 400 with the drive-letter sentence for a relative destination', async () => {
    const { baseUrl } = freshApi();

    const response = await postExport(baseUrl, {
      format: 'csv',
      destination: 'Exports',
      images: false,
      subtitles: false,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Type the full path, starting with a drive letter.',
    });
    expect(existsSync(join(process.cwd(), 'Exports'))).toBe(false);
  });

  it('answers 400 with its sentence for a destination that is not there', async () => {
    const { baseUrl, dir } = freshApi();
    const missing = join(dir, 'not-there');

    const response = await postExport(baseUrl, {
      format: 'csv',
      destination: missing,
      images: false,
      subtitles: false,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'No folder at that path.' });
    expect(existsSync(missing)).toBe(false);
  });

  it('answers 400 with one sentence for a malformed body', async () => {
    const { baseUrl, dir } = freshApi();

    const response = await postExport(baseUrl, {
      format: 'pdf',
      destination: folder(dir, 'Exports'),
      images: false,
      subtitles: false,
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: unknown };
    expect(typeof body.error).toBe('string');
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

/** The library the importer fills from its fixture, exported to a folder; the sheet's path. */
async function exportedFixture(
  api: ReturnType<typeof freshApi>,
  format: ExportFormat
): Promise<string> {
  expect((await postImport(api.baseUrl, api.sheet, api.root)).status).toBe(201);
  await untilReview(api.baseUrl);
  expect((await postCancel(api.baseUrl)).status).toBe(204);
  const destination = folder(api.dir, 'Exports');
  const response = await postExport(api.baseUrl, {
    format,
    destination,
    images: false,
    subtitles: false,
  });
  expect(response.status).toBe(201);
  const { folder: written } = (await response.json()) as ExportResult;
  const name = exportName(new Date());
  return join(written, `${name}.${format}`);
}

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
  'POST /api/export (%s) — an untouched export re-imported adds nothing',
  (format) => {
    it('is every film Already in library when fed back to the importer', async () => {
      const api = freshApi();
      const exported = await exportedFixture(api, format);
      const before = api.storage.listMovies({ sort: 'a-z' });

      expect((await postImport(api.baseUrl, exported, api.root)).status).toBe(
        201
      );
      const run = await untilReview(api.baseUrl);

      expect(run).toMatchObject({
        phase: 'review',
        found: 2,
        matched: 0,
        total: 0,
        done: 0,
        problems: [],
      });
      expect(api.storage.listMovies({ sort: 'a-z' })).toEqual(before);
      expect(api.storage.countMovies()).toBe(2);
    });
  }
);

describe.each(FORMATS)(
  'POST /api/export (%s) — an edited row imports its edit',
  (format) => {
    it('yields a film carrying the edited year and genres', async () => {
      const first = freshApi();
      const exported = await exportedFixture(first, format);
      const edited = await withRowEdited(
        readFileSync(exported),
        format,
        'Die Hard',
        { year: 1989, genres: 'Action, Thriller, Crime' }
      );

      const second = freshApi();
      renameSync(
        join(second.root, 'Die.Hard.1988.1080p'),
        join(second.root, 'Die Hard')
      );
      const sheetPath = join(second.scratch, `edited.${format}`);
      writeFileSync(sheetPath, edited);
      expect(
        (await postImport(second.baseUrl, sheetPath, second.root)).status
      ).toBe(201);
      const run = await untilReview(second.baseUrl);

      expect(run).toMatchObject({ phase: 'review', done: 2, problems: [] });
      const dieHard = second.storage
        .listMovies({ sort: 'a-z' })
        .find((movie) => movie.title === 'Die Hard');
      expect(dieHard).toMatchObject({
        year: 1989,
        director: 'John McTiernan',
        cast: ['Bruce Willis', 'Alan Rickman'],
        rating: 8,
        watched: true,
      });
      expect(dieHard?.genres.map((genre) => genre.name)).toEqual([
        'Action',
        'Thriller',
        'Crime',
      ]);
    });
  }
);

describe.each(FORMATS)(
  'POST /api/export (%s) — the row an edit did not touch',
  (format) => {
    it('leaves the row it did not edit as the export wrote it', async () => {
      const first = freshApi();
      const exported = await exportedFixture(first, format);
      const edited = await withRowEdited(
        readFileSync(exported),
        format,
        'Die Hard',
        { year: 1989, genres: 'Action, Thriller, Crime' }
      );

      const second = freshApi();
      renameSync(
        join(second.root, 'Die.Hard.1988.1080p'),
        join(second.root, 'Die Hard')
      );
      const sheetPath = join(second.scratch, `edited.${format}`);
      writeFileSync(sheetPath, edited);
      expect(
        (await postImport(second.baseUrl, sheetPath, second.root)).status
      ).toBe(201);
      await untilReview(second.baseUrl);

      const amelie = second.storage
        .listMovies({ sort: 'a-z' })
        .find((movie) => movie.title === 'Amélie');
      expect(amelie).toMatchObject({
        year: 2001,
        director: 'Jean-Pierre Jeunet',
        cast: ['Audrey Tautou'],
        rating: 7,
        watched: false,
      });
      expect(amelie?.genres.map((genre) => genre.name)).toEqual([
        'Romance',
        'Comedy',
      ]);
    });
  }
);

// --- the edges -------------------------------------------------------------------

/** The two awkward titles: a diacritic, then a comma and a double quote. */
function addAwkwardLibrary(storage: LibraryStorage): void {
  storage.addMovie(
    newMovie({
      title: 'Amélie',
      videoPath: 'Amélie (2001)/amelie.mkv',
      year: 2001,
      director: 'Jean-Pierre Jeunet',
      cast: ['Audrey Tautou'],
      rating: 7,
      genres: ['Romance', 'Comedy'],
      watched: true,
    })
  );
  storage.addMovie(
    newMovie({
      title: '"Whatever," she said',
      videoPath: 'Whatever she said (2015)/whatever.mkv',
      year: 2015,
      director: 'Zoë "Zed" Ríos',
      cast: ['Ana Sørensen', 'Peder "Pete" Vinge'],
      genres: ['Drama'],
    })
  );
}

/** The library as it stands, exported to a folder of its own; the sheet's bytes. */
async function exportedSheet(
  api: ReturnType<typeof freshApi>,
  format: ExportFormat
): Promise<Buffer> {
  const response = await postExport(api.baseUrl, {
    format,
    destination: folder(api.dir, 'Exports'),
    images: false,
    subtitles: false,
  });
  expect(response.status).toBe(201);
  const { folder: written } = (await response.json()) as ExportResult;
  return readFileSync(join(written, `${exportName(new Date())}.${format}`));
}

describe.each(FORMATS)(
  'POST /api/export (%s) — the awkward title',
  (format) => {
    const filename = `${exportName(new Date())}.${format}`;

    it('reads back every awkward cell identically, A–Z, the quote first', async () => {
      const api = freshApi();
      addAwkwardLibrary(api.storage);

      const rows = await readSheet(await exportedSheet(api, format), filename);

      expect(rows.map((row) => row.title)).toEqual([
        '"Whatever," she said',
        'Amélie',
      ]);
      expect(rows[0]).toMatchObject({
        title: '"Whatever," she said',
        year: 2015,
        genres: ['Drama'],
        director: 'Zoë "Zed" Ríos',
        cast: ['Ana Sørensen', 'Peder "Pete" Vinge'],
        rating: null,
        watched: false,
      });
      expect(rows[1]).toMatchObject({
        title: 'Amélie',
        year: 2001,
        genres: ['Romance', 'Comedy'],
        director: 'Jean-Pierre Jeunet',
        cast: ['Audrey Tautou'],
        rating: 7,
        watched: true,
      });
    });
  }
);

describe('POST /api/export (csv) — the BOM through the route and the reader', () => {
  it('writes the BOM ahead of the awkward titles, quoted as CSV quotes them', async () => {
    const api = freshApi();
    addAwkwardLibrary(api.storage);

    const bytes = await exportedSheet(api, 'csv');
    const text = bytes.toString('utf8');

    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
    expect(text).toContain('Amélie');
    expect(text).toContain('"""Whatever,"" she said"');
  });

  it('is stripped by the reader, so no title carries it', async () => {
    const api = freshApi();
    addAwkwardLibrary(api.storage);

    const rows = await readSheet(
      await exportedSheet(api, 'csv'),
      `${exportName(new Date())}.csv`
    );

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.title).not.toContain('\uFEFF');
    }
  });

  it('writes the BOM once, ahead of a header-only file too', async () => {
    const api = freshApi();

    const text = (await exportedSheet(api, 'csv')).toString('utf8');

    expect(text.startsWith('\uFEFF')).toBe(true);
    expect(text.indexOf('\uFEFF', 1)).toBe(-1);
  });
});

describe.each(FORMATS)(
  'POST /api/export (%s) — a library of none',
  (format) => {
    it('answers 201 with no titles, and a sheet the reader reads as no rows', async () => {
      const api = freshApi();

      const response = await postExport(api.baseUrl, {
        format,
        destination: folder(api.dir, 'Exports'),
        images: false,
        subtitles: false,
      });

      expect(response.status).toBe(201);
      const result = (await response.json()) as ExportResult;
      expect(result).toMatchObject({ movieCount: 0, seriesCount: 0 });
      const name = exportName(new Date());
      const bytes = readFileSync(join(result.folder, `${name}.${format}`));
      expect(await readSheet(bytes, `${name}.${format}`)).toEqual([]);
    });

    it('is the header row alone — the sixteen names, nothing under them', async () => {
      const api = freshApi();

      const bytes = await exportedSheet(api, format);

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
      expect(sheet.rowCount).toBe(1);
      expect(sheet.getRow(1).values).toEqual([undefined, ...EXPORT_COLUMNS]);
    });
  }
);

describe('GET /api/export — the summary as it stands now', () => {
  it('answers the count as it stands now, not as it stood at startup', async () => {
    const { storage, baseUrl } = freshApi();
    expect(await getSummary(baseUrl)).toMatchObject({ movieCount: 0 });

    addLibrary(storage);

    expect(await getSummary(baseUrl)).toMatchObject({
      movieCount: 3,
      seriesCount: 2,
      episodeCount: 5,
    });
  });
});
