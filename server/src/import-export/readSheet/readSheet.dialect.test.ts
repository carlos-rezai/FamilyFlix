// @vitest-environment node
//
// 60, Rebuild edges, Phase 3 (issue #566): any Excel's sheet reads.
//
// The **Sheet reader**'s workbook opener decodes a CSV by its **Sheet
// dialect** and hands `exceljs` the separator, so a sheet a European Excel
// resaved, `;`-separated and cp1252, reads whole. A number cell takes a
// decimal comma in any sheet. An xlsx opens as it always has.

import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { readSheet } from './readSheet';

/** Bytes as cp1252 spells them: for these letters, one byte each. */
const cp1252 = (text: string): Buffer => Buffer.from(text, 'latin1');

const utf8 = (text: string): Buffer => Buffer.from(text, 'utf8');

/** A one-worksheet xlsx holding `rows`, the first the header. */
async function xlsx(rows: (string | number)[][]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Library');
  for (const row of rows) {
    sheet.addRow(row);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

describe('readSheet: a `;`-separated cp1252 sheet', () => {
  const SHEET = [
    'Type;Folder;Title;Year;Genres;Director;Rating;Status;Favorite',
    'Movie;Amelie (2001);Am\xe9lie;2001;Romance, Comedy;Jean-Pierre Jeunet;7;Unwatched;',
    'Movie;Heat (1995);Heat;1995;Crime;Michael Mann;8;Watched;Yes',
    '',
  ].join('\r\n');

  it('reads every row and every column', async () => {
    const rows = await readSheet(cp1252(SHEET), 'familyflix-library.csv');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: 'Movie',
      folder: 'Amelie (2001)',
      title: 'Amélie',
      year: 2001,
      genres: ['Romance', 'Comedy'],
      director: 'Jean-Pierre Jeunet',
      rating: 7,
      watched: false,
      favorite: false,
    });
    expect(rows[1]).toMatchObject({
      folder: 'Heat (1995)',
      title: 'Heat',
      year: 1995,
      director: 'Michael Mann',
      rating: 8,
      watched: true,
      favorite: true,
    });
  });

  it('spells a cp1252 letter right in a Folder cell too', async () => {
    const rows = await readSheet(
      cp1252('Folder;Title;Year\nAm\xe9lie (2001);Am\xe9lie;2001\n'),
      'library.csv'
    );

    expect(rows).toEqual([
      expect.objectContaining({ folder: 'Amélie (2001)', title: 'Amélie' }),
    ]);
  });

  it('reads a `;` sheet behind a UTF-8 BOM, the BOM kept out of the header', async () => {
    const bytes = Buffer.concat([
      Buffer.from([0xef, 0xbb, 0xbf]),
      utf8('Title;Year;Director\nAmélie;2001;Jean-Pierre Jeunet\n'),
    ]);

    expect(await readSheet(bytes, 'library.csv')).toEqual([
      expect.objectContaining({
        title: 'Amélie',
        year: 2001,
        director: 'Jean-Pierre Jeunet',
      }),
    ]);
  });
});

describe('readSheet: a decimal comma', () => {
  it('reads `8,5` as a Rating of 9 and `7,9` as a TMDB rating of 7.9 in a `;` sheet', async () => {
    const rows = await readSheet(
      utf8('Title;Rating;TMDB rating\nHeat;8,5;7,9\n'),
      'library.csv'
    );

    expect(rows[0]).toMatchObject({ rating: 9, tmdbScore: 7.9 });
  });

  it('reads a quoted `8,5` and `7,9` in a `,` sheet too', async () => {
    const rows = await readSheet(
      utf8('Title,Rating,TMDB rating\nHeat,"8,5","7,9"\n'),
      'library.csv'
    );

    expect(rows[0]).toMatchObject({ rating: 9, tmdbScore: 7.9 });
  });
});

describe('readSheet: an xlsx', () => {
  it('reads as before, its text cells taking a decimal comma too', async () => {
    const bytes = await xlsx([
      ['Title', 'Year', 'Genres', 'Rating', 'TMDB rating'],
      ['Heat', 1995, 'Crime; Thriller', 8.5, 7.9],
      ['Amélie', 2001, 'Romance, Comedy', '8,5', '7,9'],
    ]);

    const rows = await readSheet(bytes, 'library.xlsx');

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: 'Heat',
      year: 1995,
      genres: ['Crime', 'Thriller'],
      rating: 9,
      tmdbScore: 7.9,
    });
    expect(rows[1]).toMatchObject({
      title: 'Amélie',
      year: 2001,
      genres: ['Romance', 'Comedy'],
      rating: 9,
      tmdbScore: 7.9,
    });
  });
});
