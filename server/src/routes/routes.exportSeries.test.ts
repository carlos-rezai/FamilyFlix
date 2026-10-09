// @vitest-environment node
//
// 31 — Export options, Phase 2: series and episodes (issue #277).
//
// `POST /api/export` through a real listener and a real `fetch` over a real
// `:memory:` library, `routes.exportFolder.test.ts`'s seam. The route reads
// each series' detail over the full series list and hands it to the writer:
//
// - an export of a library holding _Heat_ and _Severance_ lists both in one
//   A–Z Titles sheet, and its Episodes table holds _Severance_'s episodes in
//   order — the second worksheet in xlsx, `<name>-episodes.csv` in csv;
// - the `201` counts the series in `seriesCount`;
// - the round trip, with series rows and their synopses among the titles: an
//   untouched export of the importer's series fixture, fed back to Bulk import
//   over the same root, adds nothing, and no episode is read as a film.

import ExcelJS from 'exceljs';
import express from 'express';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
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
import { seriesFixture } from '../test-support/seriesFixture/seriesFixture';
import { newMovie } from '../test-support/newMovie/newMovie';
import { sandboxRoot } from '../test-support/sandboxRoot/sandboxRoot';
import {
  EXPORT_COLUMNS,
  EXPORT_EPISODE_COLUMNS,
  EXPORT_FORMATS,
} from '@/types';
import type { ExportFormat, ExportResult, ImportRun } from '@/types';

const FORMATS = [...EXPORT_FORMATS];

/** A UTF-8 BOM at the start of decoded text. */
const LEADING_BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`);

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

/** A fresh library over a copy of the importer's series fixture. */
function freshApi(): {
  storage: LibraryStorage;
  baseUrl: string;
  dir: string;
  root: string;
  sheet: string;
} {
  const storage = createSqliteStorage(':memory:');
  storages.push(storage);

  const dir = sandboxRoot('familyflix-export-series-api-');
  const media = join(dir, 'media');
  mkdirSync(media);
  const { root, sheet } = seriesFixture(dir, 'library.csv');

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
  return { storage, baseUrl: `http://127.0.0.1:${port}`, dir, root, sheet };
}

const postExport = (baseUrl: string, body: unknown) =>
  fetch(`${baseUrl}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** A directory of its own under the sandbox. */
function folder(dir: string, name: string): string {
  const path = join(dir, name);
  mkdirSync(path, { recursive: true });
  return path;
}

/** _Heat_, and _Severance_'s three episodes, added out of order. */
function addHeatAndSeverance(storage: LibraryStorage): void {
  storage.addMovie(
    newMovie({ title: 'Heat', videoPath: 'Heat (1995)/heat.mkv', year: 1995 })
  );
  const severance = storage.addSeries({
    title: 'Severance',
    year: 2022,
    creator: 'Dan Erickson',
  });
  for (const [season, number] of [
    [2, 1],
    [1, 2],
    [1, 1],
  ]) {
    storage.addEpisode(severance.id, {
      season,
      number,
      videoPath: `severance-2022/season-0${season}/e${number}.mp4`,
    });
  }
}

/** Export to a fresh folder; the result and the Export name. */
async function exported(
  api: ReturnType<typeof freshApi>,
  format: ExportFormat
): Promise<{ result: ExportResult; name: string }> {
  const destination = folder(api.dir, 'Exports');
  const response = await postExport(api.baseUrl, {
    format,
    destination,
    images: false,
    subtitles: false,
  });
  expect(response.status).toBe(201);
  return {
    result: (await response.json()) as ExportResult,
    name: exportName(new Date()),
  };
}

/** A worksheet as text cells, `width` wide. */
function cellsOf(sheet: ExcelJS.Worksheet, width: number): string[][] {
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push(
      Array.from({ length: width }, (_, index) => {
        const value = row.getCell(index + 1).value;
        return value === null || value === undefined ? '' : String(value);
      })
    );
  });
  return rows;
}

async function csvSheet(path: string): Promise<ExcelJS.Worksheet> {
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(
    Readable.from([readFileSync(path, 'utf8').replace(LEADING_BOM, '')]),
    { map: (value: string) => value }
  );
  return workbook.worksheets[0];
}

const SEVERANCE_IN_ORDER = [
  ['Severance', '1', '1'],
  ['Severance', '1', '2'],
  ['Severance', '2', '1'],
];

describe('POST /api/export — series and episodes', () => {
  it('lists Heat and Severance in one A–Z sheet, and Severance’s episodes in order (xlsx)', async () => {
    const api = freshApi();
    addHeatAndSeverance(api.storage);

    const { result, name } = await exported(api, 'xlsx');

    expect(result).toMatchObject({ movieCount: 1, seriesCount: 1 });
    expect(readdirSync(result.folder)).toEqual([`${name}.xlsx`]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(
      readFileSync(
        join(result.folder, `${name}.xlsx`)
      ) as unknown as ArrayBuffer
    );
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Titles',
      'Episodes',
    ]);
    const titles = cellsOf(workbook.worksheets[0], EXPORT_COLUMNS.length);
    expect(titles.slice(1).map((row) => [row[0], row[1]])).toEqual([
      ['Movie', 'Heat'],
      ['Series', 'Severance'],
    ]);
    const episodes = cellsOf(
      workbook.worksheets[1],
      EXPORT_EPISODE_COLUMNS.length
    );
    expect(episodes[0]).toEqual([...EXPORT_EPISODE_COLUMNS]);
    expect(episodes.slice(1).map((row) => row.slice(0, 3))).toEqual(
      SEVERANCE_IN_ORDER
    );
  });

  it('lists Heat and Severance in one A–Z sheet, and Severance’s episodes in a second file (csv)', async () => {
    const api = freshApi();
    addHeatAndSeverance(api.storage);

    const { result, name } = await exported(api, 'csv');

    expect(result).toMatchObject({ movieCount: 1, seriesCount: 1 });
    expect(readdirSync(result.folder).sort()).toEqual(
      [`${name}-episodes.csv`, `${name}.csv`].sort()
    );
    const titles = cellsOf(
      await csvSheet(join(result.folder, `${name}.csv`)),
      EXPORT_COLUMNS.length
    );
    expect(titles.slice(1).map((row) => [row[0], row[1]])).toEqual([
      ['Movie', 'Heat'],
      ['Series', 'Severance'],
    ]);
    const episodes = cellsOf(
      await csvSheet(join(result.folder, `${name}-episodes.csv`)),
      EXPORT_EPISODE_COLUMNS.length
    );
    expect(episodes[0]).toEqual([...EXPORT_EPISODE_COLUMNS]);
    expect(episodes.slice(1).map((row) => row.slice(0, 3))).toEqual(
      SEVERANCE_IN_ORDER
    );
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

describe.each(FORMATS)(
  'POST /api/export (%s) — an untouched export of series re-imported adds nothing',
  (format) => {
    it('holds the same series and episodes, and reads no episode as a film', async () => {
      const api = freshApi();
      expect((await postImport(api.baseUrl, api.sheet, api.root)).status).toBe(
        201
      );
      await untilReview(api.baseUrl);
      expect((await postCancel(api.baseUrl)).status).toBe(204);
      const series = api.storage.seriesInScope('all');
      expect(series.map((held) => held.synopsis)).toEqual(
        expect.arrayContaining([
          'Three generations keep a harbourside restaurant afloat.',
        ])
      );
      const episodes = series.map((held) => api.storage.listEpisodes(held.id));
      expect(api.storage.countMovies()).toBe(0);

      const { result, name } = await exported(api, format);
      expect(result.seriesCount).toBe(2);
      const sheetPath = join(result.folder, `${name}.${format}`);
      const exportedRows = await readSheet(readFileSync(sheetPath), sheetPath);
      expect(exportedRows).toEqual([
        expect.objectContaining({
          title: 'Harbor & Vine',
          synopsis: 'Three generations keep a harbourside restaurant afloat.',
        }),
        expect.objectContaining({ title: 'Tidewater' }),
      ]);
      expect(
        (
          await postImport(
            api.baseUrl,
            join(result.folder, `${name}.${format}`),
            api.root
          )
        ).status
      ).toBe(201);
      const run = await untilReview(api.baseUrl);

      expect(run).toMatchObject({ total: 0, done: 0, problems: [] });
      expect(api.storage.seriesInScope('all')).toEqual(series);
      expect(series.map((held) => api.storage.listEpisodes(held.id))).toEqual(
        episodes
      );
      expect(api.storage.countMovies()).toBe(0);
    });
  }
);
