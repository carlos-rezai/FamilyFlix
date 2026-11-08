// @vitest-environment node
//
// 58 — Folder layout, Phase 5: the one sheet (issue #538).
//
// `writeSheet(table, format)` is the **Sheet writer**: `exportRows`' one
// table and an **Export format** in, the sheet's bytes out. Pure over the
// table: it sorts nothing and names nothing, the Export (and the Library
// sheet writer) deciding where the bytes land. As csv it is one file behind
// its UTF-8 BOM, every row type in it; as xlsx one worksheet named `Library`,
// a number where a number was stored, no styling, and each filled path cell a
// hyperlink whose text is its path (log 58, Q11).

import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { EXPORT_FORMATS, SHEET_COLUMNS } from '@/types';
import type { Episode, ExportFormat, Movie, SeriesDetail } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';
import { makeSeriesDetail } from '@/test-support/makeSeriesDetail/makeSeriesDetail';
import { exportRows, type ExportTable } from '../exportRows/exportRows';
import { writeSheet } from './writeSheet';

const FORMATS = [...EXPORT_FORMATS];

const BOM = String.fromCharCode(0xfeff);

const ALL = { images: true, subtitles: true };

const text = (cell: unknown): string =>
  cell === null || cell === undefined ? '' : String(cell);

const AMELIE: Movie = makeMovie({
  id: 'amelie',
  title: 'Amélie',
  year: 2001,
  runtimeMinutes: 122,
  rating: 7,
  synopsis: '"Whatever," she said.',
  videoPath: 'amelie-2001/amelie.mkv',
  posterPath: 'amelie-2001/poster.jpg',
  subtitles: [
    {
      id: 'a1',
      path: 'amelie-2001/amelie.fr.srt',
      language: 'French',
      position: 0,
    },
    {
      id: 'a2',
      path: 'amelie-2001/amelie.en.srt',
      language: 'English',
      position: 1,
    },
  ],
});

const TIDEWATER: SeriesDetail = ((): SeriesDetail => {
  const detail = makeSeriesDetail([['watched', 'unwatched']], {
    id: 'tidewater',
    title: 'Tidewater',
    year: 2018,
    endYear: null,
    posterPath: 'tidewater-2018/poster.jpg',
  });
  const stored = (episode: Episode): Episode => ({
    ...episode,
    videoPath: `tidewater-2018/e${episode.number}.mp4`,
    stillPath: `tidewater-2018/still-${episode.number}.jpg`,
  });
  return {
    ...detail,
    seasons: detail.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map(stored),
    })),
  };
})();

/** The one table `exportRows` hands the writer: a film and a series. */
const TABLE: ExportTable = exportRows([AMELIE], [TIDEWATER], ALL).table;

async function open(
  bytes: Buffer,
  format: ExportFormat
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  if (format === 'xlsx') {
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    return workbook;
  }
  const csv = bytes.toString('utf8').replace(/^﻿/, '');
  await workbook.csv.read(Readable.from([csv]), {
    map: (value: string) => value,
  });
  return workbook;
}

/** A worksheet as text cells, as wide as the Sheet columns. */
function cellsOf(sheet: ExcelJS.Worksheet): string[][] {
  const rows: string[][] = [];
  sheet.eachRow({ includeEmpty: true }, (row) => {
    rows.push(
      SHEET_COLUMNS.map((_, index) => {
        const value = row.getCell(index + 1).value;
        if (typeof value === 'object' && value !== null && 'text' in value) {
          return text(value.text);
        }
        return text(value);
      })
    );
  });
  return rows;
}

describe.each(FORMATS)('writeSheet — the one table (%s)', (format) => {
  it('writes the table row for row, every row type in one sheet', async () => {
    const bytes = await writeSheet(TABLE, format);

    const workbook = await open(bytes, format);
    expect(cellsOf(workbook.worksheets[0])).toEqual(
      TABLE.map((row) => row.map(text))
    );
    expect(
      cellsOf(workbook.worksheets[0])
        .slice(1)
        .map((row) => row[0])
    ).toEqual(['Movie', 'Series', 'Season', 'Episode', 'Episode']);
  });

  it('writes the header alone for a library of none', async () => {
    const bytes = await writeSheet(exportRows([], [], ALL).table, format);

    const workbook = await open(bytes, format);
    expect(cellsOf(workbook.worksheets[0])).toEqual([[...SHEET_COLUMNS]]);
  });
});

describe('writeSheet — as csv', () => {
  it('starts the one file with a UTF-8 BOM, once', async () => {
    const csv = (await writeSheet(TABLE, 'csv')).toString('utf8');

    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.slice(1).startsWith(BOM)).toBe(false);
    expect(csv.split(BOM)).toHaveLength(2);
  });

  it('opens with the Sheet columns as its header line', async () => {
    const csv = (await writeSheet(TABLE, 'csv')).toString('utf8');

    expect(csv.slice(1).split(/\r?\n/)[0]).toBe(SHEET_COLUMNS.join(','));
  });

  it('keeps the subtitle paths in one cell, joined by |', async () => {
    const csv = (await writeSheet(TABLE, 'csv')).toString('utf8');

    expect(csv).toContain(
      'Amélie (2001)/Subtitles/French.srt|Amélie (2001)/Subtitles/English.srt'
    );
  });
});

describe('writeSheet — as xlsx', () => {
  it('writes a workbook, the zip an .xlsx is, with no BOM', async () => {
    const bytes = await writeSheet(TABLE, 'xlsx');

    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('holds one worksheet, named Library', async () => {
    const workbook = await open(await writeSheet(TABLE, 'xlsx'), 'xlsx');

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Library']);
  });

  it('writes the year, runtime and rating as number cells', async () => {
    const workbook = await open(await writeSheet(TABLE, 'xlsx'), 'xlsx');

    const row = workbook.worksheets[0].getRow(2);
    const column = (name: string): number =>
      (SHEET_COLUMNS as readonly string[]).indexOf(name) + 1;
    expect(row.getCell(column('Year')).value).toBe(2001);
    expect(row.getCell(column('Runtime')).value).toBe(122);
    expect(row.getCell(column('Rating')).value).toBe(7);
  });

  it('writes the header in the default font, with no widths and no frozen panes', async () => {
    const sheet = (await open(await writeSheet(TABLE, 'xlsx'), 'xlsx'))
      .worksheets[0];

    expect(sheet.getRow(1).getCell(1).font?.bold ?? false).toBe(false);
    expect(sheet.getColumn(1).width).toBeUndefined();
    expect((sheet.views ?? []).some((view) => view.state === 'frozen')).toBe(
      false
    );
  });

  it('links a Poster and a Still cell to its path, the path as its text', async () => {
    const sheet = (await open(await writeSheet(TABLE, 'xlsx'), 'xlsx'))
      .worksheets[0];
    const column = (name: string): number =>
      (SHEET_COLUMNS as readonly string[]).indexOf(name) + 1;

    expect(sheet.getRow(2).getCell(column('Poster')).value).toEqual({
      text: 'Amélie (2001)/Images/poster.jpg',
      hyperlink: 'Amélie (2001)/Images/poster.jpg',
    });
    expect(sheet.getRow(5).getCell(column('Still')).value).toEqual({
      text: 'Tidewater (2018)/Season 01/Images/Stills/S01E01.jpg',
      hyperlink: 'Tidewater (2018)/Season 01/Images/Stills/S01E01.jpg',
    });
  });
});
