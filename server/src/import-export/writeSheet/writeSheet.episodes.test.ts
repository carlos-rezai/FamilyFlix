// @vitest-environment node
//
// 31 — Export options, Phase 2: series and episodes (issue #277).
//
// `writeSheet(tables, format, name)` writes the Episodes table beside the
// Titles table. As xlsx, one workbook holds two worksheets in order, `Titles`
// then `Episodes`. As csv, it is two files, `<name>.csv` and
// `<name>-episodes.csv`, each behind its own UTF-8 BOM. Titles stays first in
// both formats — first so the **Sheet reader**'s first-worksheet rule reads it
// and nothing else, which is why no episode is ever read back as a film.

import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { writeSheet } from './writeSheet';
import { exportRows } from '../exportRows/exportRows';
import { readSheet } from '../readSheet/readSheet';
import {
  EXPORT_COLUMNS,
  EXPORT_EPISODE_COLUMNS,
  EXPORT_FORMATS,
  type ExportFormat,
  type Movie,
  type SeriesDetail,
} from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';

const FORMATS = [...EXPORT_FORMATS];

/** A UTF-8 BOM at the start of decoded text. */
const LEADING_BOM = new RegExp(`^${String.fromCharCode(0xfeff)}`);

const NAME = 'familyflix-collection_09-10-2026';

const OFF = { images: false, subtitles: false };

const HEAT: Movie = makeMovie({
  id: 'heat',
  title: 'Heat',
  year: 1995,
  director: 'Michael Mann',
  synopsis: 'A thief and a detective, each the best at what he does.',
});

const SEVERANCE: SeriesDetail = makeSeriesDetail(
  [
    ['watched', 'watched', 'in-progress'],
    ['unwatched', 'unwatched'],
  ],
  {
    id: 'severance',
    title: 'Severance',
    year: 2022,
    endYear: null,
    creator: 'Dan Erickson',
    synopsis: 'Office workers have their memories split.',
  }
);

async function filesOf(
  format: ExportFormat,
  movies: Movie[] = [HEAT],
  series: SeriesDetail[] = [SEVERANCE]
): Promise<{ filename: string; bytes: Buffer }[]> {
  return writeSheet(exportRows(movies, series, OFF).tables, format, NAME);
}

async function open(
  bytes: Buffer,
  format: ExportFormat
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  if (format === 'xlsx') {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    return workbook;
  }
  await workbook.csv.read(
    Readable.from([bytes.toString('utf8').replace(LEADING_BOM, '')]),
    { map: (value: string) => value }
  );
  return workbook;
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

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);

describe('writeSheet — as xlsx, two worksheets', () => {
  it('writes one file, the workbook, holding Titles, then Episodes, and nothing else', async () => {
    const files = await filesOf('xlsx');
    expect(files.map((file) => file.filename)).toEqual([`${NAME}.xlsx`]);
    const [{ bytes }] = files;

    const workbook = await open(bytes, 'xlsx');
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Titles',
      'Episodes',
    ]);
  });

  it('writes the Titles worksheet with the film and the series A–Z', async () => {
    const [{ bytes }] = await filesOf('xlsx');

    const rows = cellsOf(
      (await open(bytes, 'xlsx')).worksheets[0],
      EXPORT_COLUMNS.length
    );
    expect(rows[0]).toEqual([...EXPORT_COLUMNS]);
    expect(rows.slice(1).map((row) => row[1])).toEqual(['Heat', 'Severance']);
  });

  it('writes the Episodes worksheet: its header, then the episodes in order', async () => {
    const [{ bytes }] = await filesOf('xlsx');

    const rows = cellsOf(
      (await open(bytes, 'xlsx')).worksheets[1],
      EXPORT_EPISODE_COLUMNS.length
    );
    expect(rows[0]).toEqual([...EXPORT_EPISODE_COLUMNS]);
    expect(rows.slice(1).map((row) => [row[0], row[1], row[2]])).toEqual([
      ['Severance', '1', '1'],
      ['Severance', '1', '2'],
      ['Severance', '1', '3'],
      ['Severance', '2', '1'],
      ['Severance', '2', '2'],
    ]);
  });

  it('writes a header-only Episodes worksheet for a library with no series', async () => {
    const [{ bytes }] = await filesOf('xlsx', [HEAT], []);

    const workbook = await open(bytes, 'xlsx');
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      'Titles',
      'Episodes',
    ]);
    expect(
      cellsOf(workbook.worksheets[1], EXPORT_EPISODE_COLUMNS.length)
    ).toEqual([[...EXPORT_EPISODE_COLUMNS]]);
  });
});

describe('writeSheet — as csv, two files', () => {
  it('writes the Titles file first, then the Episodes file', async () => {
    const files = await filesOf('csv');

    expect(files.map((file) => file.filename)).toEqual([
      `${NAME}.csv`,
      `${NAME}-episodes.csv`,
    ]);
  });

  it('starts each file with a UTF-8 BOM, once', async () => {
    const files = await filesOf('csv');

    expect(files).toHaveLength(2);
    for (const { bytes } of files) {
      expect(bytes.subarray(0, 3)).toEqual(BOM);
      expect(bytes.subarray(3).includes(BOM)).toBe(false);
    }
  });

  it('writes the Titles file with the film and the series A–Z', async () => {
    const [titles] = await filesOf('csv');

    const rows = cellsOf(
      (await open(titles.bytes, 'csv')).worksheets[0],
      EXPORT_COLUMNS.length
    );
    expect(rows[0]).toEqual([...EXPORT_COLUMNS]);
    expect(rows.slice(1).map((row) => row[1])).toEqual(['Heat', 'Severance']);
  });

  it('writes the Episodes file: its header, then the episodes in order', async () => {
    const [, episodes] = await filesOf('csv');

    const rows = cellsOf(
      (await open(episodes.bytes, 'csv')).worksheets[0],
      EXPORT_EPISODE_COLUMNS.length
    );
    expect(rows[0]).toEqual([...EXPORT_EPISODE_COLUMNS]);
    expect(rows.slice(1).map((row) => [row[0], row[1], row[2]])).toEqual([
      ['Severance', '1', '1'],
      ['Severance', '1', '2'],
      ['Severance', '1', '3'],
      ['Severance', '2', '1'],
      ['Severance', '2', '2'],
    ]);
  });

  it('still writes the Episodes file, header alone, with no series', async () => {
    const files = await filesOf('csv', [HEAT], []);

    expect(files.map((file) => file.filename)).toEqual([
      `${NAME}.csv`,
      `${NAME}-episodes.csv`,
    ]);
    const rows = cellsOf(
      (await open(files[1].bytes, 'csv')).worksheets[0],
      EXPORT_EPISODE_COLUMNS.length
    );
    expect(rows).toEqual([[...EXPORT_EPISODE_COLUMNS]]);
  });
});

describe.each(FORMATS)(
  'writeSheet — a series row through the Sheet reader (%s)',
  (format) => {
    it('reads back the film and the series, and no episode as a film', async () => {
      const [titles] = await filesOf(format);

      const rows = await readSheet(titles.bytes, titles.filename);

      expect(rows.map((row) => row.title)).toEqual(['Heat', 'Severance']);
      expect(rows[1]).toMatchObject({
        title: 'Severance',
        year: 2022,
        endYear: null,
        director: 'Dan Erickson',
        synopsis: 'Office workers have their memories split.',
      });
    });
  }
);
