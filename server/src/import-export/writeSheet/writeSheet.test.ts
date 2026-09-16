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

import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { writeSheet } from './writeSheet';
import { readSheet } from '../readSheet/readSheet';
import { EXPORT_COLUMNS } from '@/types';
import type { Movie, Subtitle } from '@/types';
import { makeMovie } from '@/test-support/makeMovie/makeMovie';

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
 * The CSV read back as text cells, row by row, through `exceljs`'s own CSV
 * parser — the same one the reader opens the bytes with — with the BOM taken
 * off first, so a test about a cell is not also a test about the BOM. Every
 * cell is coerced to text, and a row is padded to the header's width, so an
 * empty trailing cell reads as `''` rather than as a shorter row.
 */
async function cells(bytes: Buffer): Promise<string[][]> {
  const text = bytes.toString('utf8').replace(/^\uFEFF/, '');
  const workbook = new ExcelJS.Workbook();
  await workbook.csv.read(Readable.from([text]), {
    map: (value: string) => value,
  });
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
async function firstRow(bytes: Buffer): Promise<Record<string, string>> {
  const [header, row] = await cells(bytes);
  expect(header).toEqual(HEADER);
  return Object.fromEntries(HEADER.map((name, index) => [name, row[index]]));
}

describe('writeSheet — the shape of the sheet', () => {
  it('spells the export columns once, in the prototype’s order', () => {
    // The writer's header row and the dialog's pills both read this list.
    expect(EXPORT_COLUMNS).toEqual(HEADER);
  });

  it('writes the header row in the eight names and order', async () => {
    const bytes = await writeSheet([fullMovie()], 'csv');

    const [header] = await cells(bytes);
    expect(header).toEqual(HEADER);
  });

  it('writes a header-only sheet for an empty library', async () => {
    const bytes = await writeSheet([], 'csv');

    expect(await cells(bytes)).toEqual([HEADER]);
  });

  it('writes one row per movie', async () => {
    const bytes = await writeSheet(
      [fullMovie({ id: 'm1' }), fullMovie({ id: 'm2', title: 'Amélie' })],
      'csv'
    );

    expect(await cells(bytes)).toHaveLength(3);
  });

  it('writes the movies in the order it was given, sorting nothing', async () => {
    const bytes = await writeSheet(
      [
        fullMovie({ id: 'm1', title: 'Zephyr' }),
        fullMovie({ id: 'm2', title: 'Amélie' }),
        fullMovie({ id: 'm3', title: 'Meridian' }),
      ],
      'csv'
    );

    const rows = await cells(bytes);
    expect(rows.slice(1).map((row) => row[0])).toEqual([
      'Zephyr',
      'Amélie',
      'Meridian',
    ]);
  });
});

describe('writeSheet — the eight cell rules', () => {
  it('writes every column of a fully populated movie', async () => {
    const row = await firstRow(await writeSheet([fullMovie()], 'csv'));

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
      await writeSheet([fullMovie({ title: '  Die.Hard  ' })], 'csv')
    );

    expect(row.Title).toBe('  Die.Hard  ');
  });

  it('leaves a null year, director and rating empty', async () => {
    const row = await firstRow(
      await writeSheet(
        [fullMovie({ year: null, director: null, rating: null })],
        'csv'
      )
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
        'csv'
      )
    );

    expect(row.Genres).toBe('Thriller, Action, Comedy');
  });

  it('leaves the genres empty for an ungenred movie', async () => {
    const row = await firstRow(
      await writeSheet([fullMovie({ genres: [] })], 'csv')
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
        'csv'
      )
    );

    expect(row.Cast).toBe('Alan Rickman, Bruce Willis, Bonnie Bedelia');
  });

  it('leaves the cast empty for a movie with none', async () => {
    const row = await firstRow(
      await writeSheet([fullMovie({ cast: [] })], 'csv')
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
        'csv'
      )
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
        'csv'
      )
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
        'csv'
      )
    );

    expect(row.Subtitles).toBe('en, de, fr');
  });

  it('leaves the subtitles empty for a movie with no tracks', async () => {
    const row = await firstRow(
      await writeSheet([fullMovie({ subtitles: [] })], 'csv')
    );

    expect(row.Subtitles).toBe('');
  });

  it('writes no synopsis, runtime or path', async () => {
    const movie = fullMovie({
      runtimeMinutes: 137,
      posterPath: 'Die Hard (1988)/poster.jpg',
      backdropPath: 'Die Hard (1988)/backdrop.jpg',
    });

    const text = (await writeSheet([movie], 'csv')).toString('utf8');

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

describe('writeSheet — the round trip through the Sheet reader', () => {
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
    const bytes = await writeSheet(LIBRARY, 'csv');

    const rows = await readSheet(bytes, 'family-library.csv');

    expect(rows.map((row) => row.title)).toEqual([
      'Die Hard',
      'Amélie',
      'Northwind',
    ]);
  });

  it('reads back the title, year, genres, director, cast and rating equal', async () => {
    const bytes = await writeSheet(LIBRARY, 'csv');

    const rows = await readSheet(bytes, 'family-library.csv');

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
    const bytes = await writeSheet(LIBRARY, 'csv');

    const rows = await readSheet(bytes, 'family-library.csv');

    expect(rows.map((row) => row.watched)).toEqual([true, false, false]);
  });

  it('survives a title with a comma, a quote and a diacritic', async () => {
    const title = 'Léon: "The Professional", Director’s Cut';
    const bytes = await writeSheet([fullMovie({ title })], 'csv');

    const rows = await readSheet(bytes, 'family-library.csv');

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
      'csv'
    );

    const rows = await readSheet(bytes, 'family-library.csv');

    expect(rows[0].cast).toEqual(['Jean Reno', 'Gérard Depardieu']);
    expect(rows[0].genres).toEqual(['Comédie']);
  });

  it('reads back clean through the BOM the writer put first', async () => {
    const bytes = await writeSheet([fullMovie()], 'csv');

    const rows = await readSheet(bytes, 'family-library.csv');

    // A reader that kept the BOM would see a header of `\uFEFFTitle`, find no
    // title column, and refuse the file it was handed by its own mirror.
    expect(rows[0].title).toBe('Die Hard');
  });
});
