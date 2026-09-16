// @vitest-environment node
//
// 14 — Export, Phase 1: "the tracer bullet" (issue #137).
//
// The **Sheet writer**: a list of movies and an **Export format** in, the
// bytes of one **Export file** out — the **Sheet reader**'s mirror, and the
// unit that carries the most weight in the initiative. Pure over the list it
// is given: it opens no file, reads no storage and sorts nothing, so every
// case here is a `makeMovie` typed in place and the bytes read straight back.
//
// The eight cell rules live inside it and nowhere else, so this is where each
// is pinned; and the round trip — write, then `readSheet` — is what makes an
// export a backup rather than a listing: an untouched **Export file** fed to
// **Bulk import** must read as one **Sheet row** per movie with every field
// equal, so the run adds nothing.
//
// 14 — Export, Phase 2: "Excel" (issue #138) gives the writer its second arm.
// The shape, the eight cell rules and the round trip are the same promise in
// both **Export formats**, so those groups run once per format; what is the
// CSV's own — the BOM — and what is the workbook's own — one worksheet, a
// number where a number was stored, and no styling — each keep a group of
// their own.

import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { writeSheet } from './writeSheet';
import { readSheet } from '../readSheet/readSheet';
import { EXPORT_COLUMNS, EXPORT_FORMATS } from '@/types';
import type { ExportFormat, Movie, Subtitle } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

/** The two formats, as `describe.each` cases. */
const FORMATS = [...EXPORT_FORMATS];

/** The header row, in the prototype's eight names and order. */
const HEADER = [
  'Title',
  'Year',
  'Genres',
  'Director',
  'Cast',
  'Rating',
  'Status',
  'Subtitles',
];

const BOM = '\uFEFF';

/** A subtitle track at a position, for the order the Subtitles cell keeps. */
const track = (language: string, position: number): Subtitle => ({
  id: `s${position}`,
  path: `Comet Season/${language}.srt`,
  language,
  position,
});

/** One movie with every exported column populated. */
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
    videoPath: 'Die Hard (1988)/die-hard.mkv',
    genres: [
      { id: 'g1', name: 'Action' },
      { id: 'g2', name: 'Thriller' },
    ],
    subtitles: [track('en', 0), track('de', 1)],
    ...overrides,
  });
}

/**
 * The bytes opened as the workbook they are, through `exceljs` — the same
 * library the reader opens them with. A CSV is parsed as text with the BOM
 * taken off first, so a test about a cell is not also a test about the BOM;
 * a workbook is loaded as the zip it is.
 */
async function open(
  bytes: Buffer,
  format: ExportFormat
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  if (format === 'xlsx') {
    // `exceljs` declares its own `Buffer` — a bare `ArrayBuffer` shape — for
    // what is a Node `Buffer` at runtime, the same mismatch the reader notes.
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    return workbook;
  }
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  await workbook.csv.read(Readable.from([text]), {
    map: (value: string) => value,
  });
  return workbook;
}

/**
 * The sheet read back as text cells, row by row. Every cell is coerced to
 * text — a workbook's `1988` is a number, a CSV's the digits — and a row is
 * padded to the header's width, so an empty trailing cell reads as `''`
 * rather than as a shorter row.
 */
async function cells(bytes: Buffer, format: ExportFormat): Promise<string[][]> {
  const workbook = await open(bytes, format);
  const rows: string[][] = [];
  workbook.worksheets[0].eachRow({ includeEmpty: true }, (row) => {
    rows.push(
      HEADER.map((_, index) => {
        const value = row.getCell(index + 1).value;
        return value === null || value === undefined ? '' : String(value);
      })
    );
  });
  return rows;
}

/** The row under the header, by column name. */
async function firstRow(
  bytes: Buffer,
  format: ExportFormat
): Promise<Record<string, string>> {
  const [header, row] = await cells(bytes, format);
  expect(header).toEqual(HEADER);
  return Object.fromEntries(HEADER.map((name, index) => [name, row[index]]));
}

describe('writeSheet — the export columns', () => {
  it('spells the export columns once, in the prototype’s order', () => {
    // The writer's header row and the dialog's pills both read this list.
    expect(EXPORT_COLUMNS).toEqual(HEADER);
  });
});

describe.each(FORMATS)('writeSheet — the shape of the sheet (%s)', (format) => {
  it('writes the header row in the eight names and order', async () => {
    const bytes = await writeSheet([fullMovie()], format);

    const [header] = await cells(bytes, format);
    expect(header).toEqual(HEADER);
  });

  it('writes a header-only sheet for an empty library', async () => {
    const bytes = await writeSheet([], format);

    expect(await cells(bytes, format)).toEqual([HEADER]);
  });

  it('writes one row per movie', async () => {
    const bytes = await writeSheet(
      [fullMovie({ id: 'm1' }), fullMovie({ id: 'm2', title: 'Amélie' })],
      format
    );

    expect(await cells(bytes, format)).toHaveLength(3);
  });

  it('writes the movies in the order it was given, sorting nothing', async () => {
    const bytes = await writeSheet(
      [
        fullMovie({ id: 'm1', title: 'Zephyr' }),
        fullMovie({ id: 'm2', title: 'Amélie' }),
        fullMovie({ id: 'm3', title: 'Meridian' }),
      ],
      format
    );

    const rows = await cells(bytes, format);
    expect(rows.slice(1).map((row) => row[0])).toEqual([
      'Zephyr',
      'Amélie',
      'Meridian',
    ]);
  });
});

describe.each(FORMATS)('writeSheet — the eight cell rules (%s)', (format) => {
  it('writes every column of a fully populated movie', async () => {
    const row = await firstRow(await writeSheet([fullMovie()], format), format);

    expect(row).toEqual({
      Title: 'Die Hard',
      Year: '1988',
      Genres: 'Action, Thriller',
      Director: 'John McTiernan',
      Cast: 'Bruce Willis, Alan Rickman',
      Rating: '8',
      Status: 'Watched',
      Subtitles: 'en, de',
    });
  });

  it('writes the title as stored', async () => {
    const row = await firstRow(
      await writeSheet([fullMovie({ title: '  Die.Hard  ' })], format),
      format
    );

    expect(row.Title).toBe('  Die.Hard  ');
  });

  it('leaves a null year, director and rating empty', async () => {
    const row = await firstRow(
      await writeSheet(
        [fullMovie({ year: null, director: null, rating: null })],
        format
      ),
      format
    );

    expect(row.Year).toBe('');
    expect(row.Director).toBe('');
    expect(row.Rating).toBe('');
  });

  it('joins the genres with a comma and a space, in stored order', async () => {
    const row = await firstRow(
      await writeSheet(
        [
          fullMovie({
            genres: [
              { id: 'g2', name: 'Thriller' },
              { id: 'g1', name: 'Action' },
              { id: 'g3', name: 'Comedy' },
            ],
          }),
        ],
        format
      ),
      format
    );

    expect(row.Genres).toBe('Thriller, Action, Comedy');
  });

  it('leaves the genres empty for an ungenred movie', async () => {
    const row = await firstRow(
      await writeSheet([fullMovie({ genres: [] })], format),
      format
    );

    expect(row.Genres).toBe('');
  });

  it('joins the cast with a comma and a space, in stored order', async () => {
    const row = await firstRow(
      await writeSheet(
        [
          fullMovie({
            cast: ['Alan Rickman', 'Bruce Willis', 'Bonnie Bedelia'],
          }),
        ],
        format
      ),
      format
    );

    expect(row.Cast).toBe('Alan Rickman, Bruce Willis, Bonnie Bedelia');
  });

  it('leaves the cast empty for a movie with none', async () => {
    const row = await firstRow(
      await writeSheet([fullMovie({ cast: [] })], format),
      format
    );

    expect(row.Cast).toBe('');
  });

  it('writes the rating as the stored 0–10 integer', async () => {
    const rows = await cells(
      await writeSheet(
        [
          fullMovie({ id: 'm1', rating: 10 }),
          fullMovie({ id: 'm2', rating: 0 }),
          fullMovie({ id: 'm3', rating: 7 }),
        ],
        format
      ),
      format
    );

    expect(rows.slice(1).map((row) => row[5])).toEqual(['10', '0', '7']);
  });

  it.each([
    ['watched', 'Watched'],
    ['in-progress', 'In progress'],
    ['unwatched', 'Unwatched'],
  ] as const)('writes the %s state as “%s”', async (status, cell) => {
    const row = await firstRow(
      await writeSheet(
        [
          fullMovie({
            status,
            watched: status === 'watched',
            resumePositionSeconds: status === 'in-progress' ? 600 : 0,
          }),
        ],
        format
      ),
      format
    );

    expect(row.Status).toBe(cell);
  });

  it('joins the subtitle languages with a comma and a space, in track order', async () => {
    const row = await firstRow(
      await writeSheet(
        [
          fullMovie({
            // Stored out of track order on purpose: the position is the order.
            subtitles: [track('fr', 2), track('en', 0), track('de', 1)],
          }),
        ],
        format
      ),
      format
    );

    expect(row.Subtitles).toBe('en, de, fr');
  });

  it('leaves the subtitles empty for a movie with no tracks', async () => {
    const row = await firstRow(
      await writeSheet([fullMovie({ subtitles: [] })], format),
      format
    );

    expect(row.Subtitles).toBe('');
  });

  it('writes no synopsis, runtime or path', async () => {
    const movie = fullMovie({
      runtimeMinutes: 137,
      posterPath: 'Die Hard (1988)/poster.jpg',
      backdropPath: 'Die Hard (1988)/backdrop.jpg',
    });

    const rows = await cells(await writeSheet([movie], format), format);
    const text = rows.flat().join('\n');

    expect(rows[1]).toHaveLength(HEADER.length);
    expect(text).not.toContain(movie.synopsis);
    expect(text).not.toContain('137');
    expect(text).not.toContain('die-hard.mkv');
    expect(text).not.toContain('poster.jpg');
    expect(text).not.toContain('backdrop.jpg');
    expect(text).not.toContain(movie.id);
  });
});

describe('writeSheet — the CSV bytes', () => {
  it('begins with a UTF-8 BOM, so Excel opens diacritics correctly', async () => {
    const bytes = await writeSheet([fullMovie({ title: 'Amélie' })], 'csv');

    expect(bytes.toString('utf8').startsWith(BOM)).toBe(true);
    expect(bytes.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  it('writes the BOM once, ahead of the header', async () => {
    const text = (await writeSheet([fullMovie()], 'csv')).toString('utf8');

    expect(text.slice(1)).not.toContain(BOM);
    expect(text.slice(1).startsWith(HEADER.join(','))).toBe(true);
  });
});

describe('writeSheet — the Excel bytes', () => {
  it('writes a workbook — the zip an .xlsx is, opened by exceljs as one', async () => {
    const bytes = await writeSheet([fullMovie()], 'xlsx');

    // An OpenXML workbook is a zip, and a zip begins with `PK`.
    expect(bytes.subarray(0, 2).toString('latin1')).toBe('PK');
    const workbook = await open(bytes, 'xlsx');
    expect(workbook.worksheets[0].rowCount).toBe(2);
  });

  it('writes one worksheet', async () => {
    const bytes = await writeSheet([fullMovie()], 'xlsx');

    const workbook = await open(bytes, 'xlsx');
    expect(workbook.worksheets).toHaveLength(1);
  });

  it('writes the year and the rating as number cells, so Excel sorts them as numbers', async () => {
    const bytes = await writeSheet(
      [fullMovie({ year: 1988, rating: 8 })],
      'xlsx'
    );

    const row = (await open(bytes, 'xlsx')).worksheets[0].getRow(2);
    expect(row.getCell(HEADER.indexOf('Year') + 1).value).toBe(1988);
    expect(row.getCell(HEADER.indexOf('Rating') + 1).value).toBe(8);
  });

  it('leaves a null year and rating as empty cells, not the word null', async () => {
    const bytes = await writeSheet(
      [fullMovie({ year: null, rating: null })],
      'xlsx'
    );

    const row = (await open(bytes, 'xlsx')).worksheets[0].getRow(2);
    expect(row.getCell(HEADER.indexOf('Year') + 1).value ?? null).toBeNull();
    expect(row.getCell(HEADER.indexOf('Rating') + 1).value ?? null).toBeNull();
  });

  it('carries no BOM — a workbook is a zip, not text', async () => {
    const bytes = await writeSheet([fullMovie()], 'xlsx');

    expect(bytes.subarray(0, 3)).not.toEqual(Buffer.from([0xef, 0xbb, 0xbf]));
  });

  // The prototype promises "an .xlsx workbook with a header row" and no more:
  // no bold header, no column widths, no frozen panes.
  describe('no styling', () => {
    it('writes the header row in the default font, not bold', async () => {
      const bytes = await writeSheet([fullMovie()], 'xlsx');

      const header = (await open(bytes, 'xlsx')).worksheets[0].getRow(1);
      HEADER.forEach((_, index) => {
        const { font } = header.getCell(index + 1);
        expect(font?.bold ?? false).toBe(false);
      });
    });

    it('sets no column widths', async () => {
      const bytes = await writeSheet([fullMovie()], 'xlsx');

      const sheet = (await open(bytes, 'xlsx')).worksheets[0];
      HEADER.forEach((_, index) => {
        expect(sheet.getColumn(index + 1).width).toBeUndefined();
      });
    });

    it('freezes no panes', async () => {
      const bytes = await writeSheet([fullMovie()], 'xlsx');

      const sheet = (await open(bytes, 'xlsx')).worksheets[0];
      expect((sheet.views ?? []).some((view) => view.state === 'frozen')).toBe(
        false
      );
    });
  });
});

describe.each(FORMATS)(
  'writeSheet — the round trip through the Sheet reader (%s)',
  (format) => {
    const filename = `family-library.${format}`;

    /** The three states, and every kind of empty, as a library the reader has to read back whole. */
    const LIBRARY: Movie[] = [
      fullMovie({ id: 'm1' }),
      fullMovie({
        id: 'm2',
        title: 'Amélie',
        year: 2001,
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
      fullMovie({
        id: 'm3',
        title: 'Northwind',
        year: null,
        director: null,
        cast: [],
        rating: null,
        genres: [],
        watched: false,
        status: 'unwatched',
        subtitles: [],
      }),
    ];

    it('reads back one Sheet row per movie, in order', async () => {
      const bytes = await writeSheet(LIBRARY, format);

      const rows = await readSheet(bytes, filename);

      expect(rows.map((row) => row.title)).toEqual([
        'Die Hard',
        'Amélie',
        'Northwind',
      ]);
    });

    it('reads back the title, year, genres, director, cast and rating equal', async () => {
      const bytes = await writeSheet(LIBRARY, format);

      const rows = await readSheet(bytes, filename);

      expect(rows).toEqual(
        LIBRARY.map((movie) => ({
          title: movie.title,
          year: movie.year,
          genres: movie.genres.map((genre) => genre.name),
          director: movie.director,
          cast: movie.cast,
          // Not exported, so not read back — the one field the mirror drops.
          synopsis: null,
          rating: movie.rating,
          watched: movie.status === 'watched',
        }))
      );
    });

    it('reads Watched back as watched, and the other two states as not', async () => {
      const bytes = await writeSheet(LIBRARY, format);

      const rows = await readSheet(bytes, filename);

      expect(rows.map((row) => row.watched)).toEqual([true, false, false]);
    });

    it('survives a title with a comma, a quote and a diacritic', async () => {
      const title = 'Léon: "The Professional", Director’s Cut';
      const bytes = await writeSheet([fullMovie({ title })], format);

      const rows = await readSheet(bytes, filename);

      expect(rows).toHaveLength(1);
      expect(rows[0].title).toBe(title);
      expect(rows[0].director).toBe('John McTiernan');
    });

    it('survives a cast member and a genre carrying diacritics', async () => {
      const bytes = await writeSheet(
        [
          fullMovie({
            cast: ['Jean Reno', 'Gérard Depardieu'],
            genres: [{ id: 'g9', name: 'Comédie' }],
          }),
        ],
        format
      );

      const rows = await readSheet(bytes, filename);

      expect(rows[0].cast).toEqual(['Jean Reno', 'Gérard Depardieu']);
      expect(rows[0].genres).toEqual(['Comédie']);
    });
  }
);

describe('writeSheet — the round trip through the BOM', () => {
  it('reads back clean through the BOM the writer put first', async () => {
    const bytes = await writeSheet([fullMovie()], 'csv');

    const rows = await readSheet(bytes, 'family-library.csv');

    // A reader that kept the BOM would see a header of `\uFEFFTitle`, find no
    // title column, and refuse the file it was handed by its own mirror.
    expect(rows[0].title).toBe('Die Hard');
  });
});
