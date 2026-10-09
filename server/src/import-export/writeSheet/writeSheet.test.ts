// @vitest-environment node
//
// 31 — Export options, Phase 1: "the tracer" (issue #276).
//
// `writeSheet(tables, format, name)` — the **Sheet writer**, still pure and
// still the **Sheet reader**'s mirror, now answering named files. The cell
// rules have moved to `exportRows`, so the tables it is handed here are
// `exportRows`' own, and what is left to pin is the writer's: the file's name
// after the **Export name**, the CSV's BOM, the workbook's `Titles`
// worksheet, a number where a number was stored, no styling, and the round
// trip — every file read back through `readSheet` as one **Sheet row** per
// film with every field equal.
//
// (Log 14's suite pinned the eight cell rules here; they are `exportRows`'
// suite's now.)

import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { writeSheet } from './writeSheet';
import { exportRows } from '../exportRows/exportRows';
import { readSheet } from '../readSheet/readSheet';
import { EXPORT_COLUMNS, EXPORT_FORMATS } from '@/types';
import type { ExportFormat, Movie, Subtitle } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

const FORMATS = [...EXPORT_FORMATS];

const NAME = 'familyflix-collection_08-10-2026';

const BOM = String.fromCharCode(0xfeff);

const OFF = { images: false, subtitles: false };

const track = (language: string, position: number): Subtitle => ({
  id: `s${position}`,
  path: `Die Hard (1988)/${language}.srt`,
  language,
  position,
});

function fullMovie(overrides: Partial<Movie> = {}): Movie {
  return makeMovie({
    id: 'm1',
    title: 'Die Hard',
    year: 1988,
    runtimeMinutes: 132,
    synopsis:
      'A New York cop takes on a tower full of thieves on Christmas Eve.',
    director: 'John McTiernan',
    cast: ['Bruce Willis', 'Alan Rickman'],
    rating: 8,
    watched: true,
    status: 'watched',
    genres: [
      { id: 'g1', name: 'Action' },
      { id: 'g2', name: 'Thriller' },
    ],
    subtitles: [track('en', 0), track('de', 1)],
    ...overrides,
  });
}

/** The films' tables, as `exportRows` hands them to the writer. */
const tablesOf = (movies: Movie[]) => exportRows(movies, [], OFF).tables;

/** What the writer answered for one format, as `{ filename, bytes }`. */
async function write(
  movies: Movie[],
  format: ExportFormat,
  name = NAME
): Promise<{ filename: string; bytes: Buffer }[]> {
  return writeSheet(tablesOf(movies), format, name);
}

/** The Titles file — the one named after the export itself. */
async function titlesFile(
  movies: Movie[],
  format: ExportFormat,
  name = NAME
): Promise<{ filename: string; bytes: Buffer }> {
  const files = await write(movies, format, name);
  const file = files.find((each) => each.filename === `${name}.${format}`);
  if (file === undefined) {
    throw new Error(
      `no ${name}.${format} among ${files.map((f) => f.filename).join(', ')}`
    );
  }
  return file;
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
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  await workbook.csv.read(Readable.from([text]), {
    map: (value: string) => value,
  });
  return workbook;
}

/** The first worksheet as text cells, sixteen wide. */
async function cells(bytes: Buffer, format: ExportFormat): Promise<string[][]> {
  const workbook = await open(bytes, format);
  const rows: string[][] = [];
  workbook.worksheets[0].eachRow({ includeEmpty: true }, (row) => {
    rows.push(
      EXPORT_COLUMNS.map((_, index) => {
        const value = row.getCell(index + 1).value;
        return value === null || value === undefined ? '' : String(value);
      })
    );
  });
  return rows;
}

describe.each(FORMATS)('writeSheet — the Titles sheet (%s)', (format) => {
  it('writes the sixteen-column header row first', async () => {
    const { bytes } = await titlesFile([fullMovie()], format);

    const [header] = await cells(bytes, format);
    expect(header).toEqual([...EXPORT_COLUMNS]);
  });

  it('writes one row per film, in the order the table holds', async () => {
    const { bytes } = await titlesFile(
      [
        fullMovie({ id: 'm1', title: 'Zephyr' }),
        fullMovie({ id: 'm2', title: 'Amélie' }),
      ],
      format
    );

    const rows = await cells(bytes, format);
    expect(rows.slice(1).map((row) => row[1])).toEqual(['Amélie', 'Zephyr']);
  });

  it('writes a header-only sheet for a library of none', async () => {
    const { bytes } = await titlesFile([], format);

    expect(await cells(bytes, format)).toEqual([[...EXPORT_COLUMNS]]);
  });
});

describe('writeSheet — as csv', () => {
  it('names the file after the export', async () => {
    const files = await write([fullMovie()], 'csv');

    expect(files.map((file) => file.filename)).toContain(`${NAME}.csv`);
  });

  it('names the file after whatever name it is handed', async () => {
    const files = await write(
      [fullMovie()],
      'csv',
      'familyflix-collection_01-01-2027'
    );

    expect(files.map((file) => file.filename)).toContain(
      'familyflix-collection_01-01-2027.csv'
    );
  });

  it('starts the file with a UTF-8 BOM', async () => {
    const { bytes } = await titlesFile([fullMovie({ title: 'Amélie' })], 'csv');

    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it('writes the BOM once, ahead of the header', async () => {
    const { bytes } = await titlesFile([fullMovie()], 'csv');
    const text = bytes.toString('utf8');

    expect(text.slice(1)).not.toContain(BOM);
    expect(text.slice(1).startsWith(EXPORT_COLUMNS.join(','))).toBe(true);
  });
});

describe('writeSheet — as xlsx', () => {
  it('names the file after the export', async () => {
    const files = await write([fullMovie()], 'xlsx');

    expect(files.map((file) => file.filename)).toContain(`${NAME}.xlsx`);
  });

  it('writes a workbook — the zip an .xlsx is — with no BOM', async () => {
    const { bytes } = await titlesFile([fullMovie()], 'xlsx');

    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
  });

  it('names the first worksheet Titles', async () => {
    const { bytes } = await titlesFile([fullMovie()], 'xlsx');

    const workbook = await open(bytes, 'xlsx');
    expect(workbook.worksheets[0].name).toBe('Titles');
  });

  it('writes the year, runtime and rating as number cells', async () => {
    const { bytes } = await titlesFile(
      [fullMovie({ year: 1988, runtimeMinutes: 132, rating: 8 })],
      'xlsx'
    );

    const row = (await open(bytes, 'xlsx')).worksheets[0].getRow(2);
    const column = (name: string) =>
      (EXPORT_COLUMNS as readonly string[]).indexOf(name) + 1;
    expect(row.getCell(column('Year')).value).toBe(1988);
    expect(row.getCell(column('Runtime')).value).toBe(132);
    expect(row.getCell(column('Rating')).value).toBe(8);
  });

  it('writes the header in the default font, with no widths and no frozen panes', async () => {
    const { bytes } = await titlesFile([fullMovie()], 'xlsx');

    const sheet = (await open(bytes, 'xlsx')).worksheets[0];
    expect(sheet.getRow(1).getCell(1).font?.bold ?? false).toBe(false);
    expect(sheet.getColumn(1).width).toBeUndefined();
    expect((sheet.views ?? []).some((view) => view.state === 'frozen')).toBe(
      false
    );
  });
});

describe.each(FORMATS)(
  'writeSheet — the round trip through the Sheet reader (%s)',
  (format) => {
    const LIBRARY: Movie[] = [
      fullMovie({
        id: 'm2',
        title: 'Amélie',
        year: 2001,
        synopsis:
          'A shy waitress decides to change the lives of those around her.',
        director: 'Jean-Pierre Jeunet',
        cast: ['Audrey Tautou'],
        rating: 7,
        genres: [
          { id: 'g4', name: 'Romance' },
          { id: 'g3', name: 'Comedy' },
        ],
        watched: false,
        resumePositionSeconds: 1200,
        status: 'in-progress',
        subtitles: [track('fr', 0)],
      }),
      fullMovie({ id: 'm1' }),
      fullMovie({
        id: 'm3',
        title: 'Northwind',
        year: null,
        synopsis: null,
        director: null,
        cast: [],
        rating: null,
        genres: [],
        watched: false,
        status: 'unwatched',
        subtitles: [],
      }),
    ];

    it('reads back one Sheet row per film, every field equal', async () => {
      const { filename, bytes } = await titlesFile(LIBRARY, format);

      const rows = await readSheet(bytes, filename);

      expect(rows).toEqual(
        LIBRARY.map((movie) => ({
          title: movie.title,
          year: movie.year,
          endYear: movie.year,
          genres: movie.genres.map((genre) => genre.name),
          director: movie.director,
          cast: movie.cast,
          synopsis: movie.synopsis,
          rating: movie.rating,
          watched: movie.status === 'watched',
        }))
      );
    });

    it('survives the awkward titles — a diacritic, a comma and a quote', async () => {
      const titles = ['"Whatever," she said', 'Amélie'];
      const { filename, bytes } = await titlesFile(
        titles.map((title, index) => fullMovie({ id: `m${index}`, title })),
        format
      );

      const rows = await readSheet(bytes, filename);

      expect(rows.map((row) => row.title)).toEqual(titles);
    });
  }
);
