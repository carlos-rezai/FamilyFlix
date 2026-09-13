// @vitest-environment node
//
// 13 — Bulk import, Phase 2: "the tracer bullet" (issue #125).
//
// The **Sheet reader**: bytes and an extension in, **Sheet rows** out. Pure
// over a buffer — it opens no file and knows no path — so every case here is a
// string the test types, except the one pair that has to be real: the fixture's
// `.xlsx` and `.csv` hold the same two rows, and reading them must not be able
// to tell which one it was handed.
//
// The synonym table is the whole point of the unit: the real sheet says `Title`,
// `Year` and `Genre` today, and the maintainer will add the rest later under
// whichever header they think of first. Only a title column is required — a
// sheet with none is the one refusal the reader makes, and it is the sheet
// field's `400` upstream.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { readSheet } from './readSheet';

/** The fixture pair the importer's own tests run over. */
const FIXTURE = fileURLToPath(
  new URL('../createImporter/fixture/', import.meta.url)
);

/** A sheet typed in place, as the bytes a CSV file would hold. */
const csv = (text: string): Buffer => Buffer.from(text, 'utf8');

/** A one-row sheet whose header is what the test is about. */
const oneRow = (header: string, row: string) =>
  readSheet(csv(`${header}\n${row}\n`), 'library.csv');

describe('readSheet — the two formats', () => {
  it('reads the fixture’s .xlsx and .csv to the same rows', async () => {
    const fromXlsx = await readSheet(
      readFileSync(join(FIXTURE, 'library.xlsx')),
      'library.xlsx'
    );
    const fromCsv = await readSheet(
      readFileSync(join(FIXTURE, 'library.csv')),
      'library.csv'
    );

    // Excel stores 1988 as a number and a CSV as the digits; the reader owes
    // the caller one shape for both.
    expect(fromXlsx).toEqual(fromCsv);
    expect(fromCsv).toHaveLength(2);
  });

  it('reads every column of the fixture rows', async () => {
    const rows = await readSheet(
      readFileSync(join(FIXTURE, 'library.csv')),
      'library.csv'
    );

    expect(rows[0]).toEqual({
      title: 'Die Hard',
      year: 1988,
      genres: ['Action', 'Thriller'],
      director: 'John McTiernan',
      cast: ['Bruce Willis', 'Alan Rickman'],
      synopsis:
        'A New York cop takes on a tower full of thieves on Christmas Eve.',
      rating: 8,
      watched: true,
    });
    expect(rows[1]).toEqual({
      title: 'Amélie',
      year: 2001,
      genres: ['Romance', 'Comedy'],
      director: 'Jean-Pierre Jeunet',
      cast: ['Audrey Tautou'],
      synopsis:
        'A shy waitress in Montmartre decides to change the lives of those around her.',
      rating: 7,
      watched: false,
    });
  });

  it('refuses a file that is neither .xlsx nor .csv', async () => {
    await expect(
      readSheet(csv('Title\nDie Hard\n'), 'library.txt')
    ).rejects.toThrow();
  });

  it('answers no rows for a sheet that is only a header', async () => {
    await expect(
      readSheet(csv('Title,Year\n'), 'library.csv')
    ).resolves.toEqual([]);
  });
});

describe('readSheet — finding the columns', () => {
  it('imports a Title/Year/Genre-only sheet — the real one — fully', async () => {
    const rows = await oneRow('Title,Year,Genre', 'Die Hard,1988,Action');

    expect(rows).toEqual([
      {
        title: 'Die Hard',
        year: 1988,
        genres: ['Action'],
        director: null,
        cast: [],
        synopsis: null,
        rating: null,
        watched: false,
      },
    ]);
  });

  it.each(['title', 'name', 'movie', 'film'])(
    'finds the title under “%s”',
    async (header) => {
      const rows = await oneRow(header, 'Die Hard');

      expect(rows[0].title).toBe('Die Hard');
    }
  );

  it.each(['genre', 'genres'])(
    'finds the genres under “%s”',
    async (header) => {
      const rows = await oneRow(`title,${header}`, 'Die Hard,Action');

      expect(rows[0].genres).toEqual(['Action']);
    }
  );

  it.each(['cast', 'actors'])('finds the cast under “%s”', async (header) => {
    const rows = await oneRow(
      `title,${header}`,
      'Die Hard,"Bruce Willis, Alan Rickman"'
    );

    expect(rows[0].cast).toEqual(['Bruce Willis', 'Alan Rickman']);
  });

  it.each(['description', 'synopsis'])(
    'finds the synopsis under “%s”',
    async (header) => {
      const rows = await oneRow(
        `title,${header}`,
        'Die Hard,A cop in a tower.'
      );

      expect(rows[0].synopsis).toBe('A cop in a tower.');
    }
  );

  it('finds the year, the director, the rating and watched under their own names', async () => {
    const rows = await oneRow(
      'title,year,director,rating,watched',
      'Die Hard,1988,John McTiernan,8,yes'
    );

    expect(rows[0]).toMatchObject({
      year: 1988,
      director: 'John McTiernan',
      rating: 8,
      watched: true,
    });
  });

  it('matches a header regardless of case and surrounding space', async () => {
    const rows = await oneRow('TITLE, Year ,GeNrE', 'Die Hard,1988,Action');

    expect(rows[0]).toMatchObject({
      title: 'Die Hard',
      year: 1988,
      genres: ['Action'],
    });
  });

  it('ignores a column it does not recognise', async () => {
    const rows = await oneRow(
      'Title,Year,Shelf,Notes',
      'Die Hard,1988,B3,lent to Sam'
    );

    expect(rows[0]).toMatchObject({ title: 'Die Hard', year: 1988 });
    expect(rows[0]).not.toHaveProperty('shelf');
    expect(rows[0]).not.toHaveProperty('notes');
  });

  it('refuses a sheet with no title column', async () => {
    await expect(
      readSheet(csv('Year,Genre\n1988,Action\n'), 'library.csv')
    ).rejects.toThrow(/title/i);
  });
});

describe('readSheet — the cells', () => {
  it.each([
    ['a comma', 'Action, Thriller'],
    ['a slash', 'Action / Thriller'],
    ['a semicolon', 'Action; Thriller'],
  ])('splits genres on %s', async (_, cell) => {
    const rows = await oneRow('Title,Genre', `Die Hard,"${cell}"`);

    expect(rows[0].genres).toEqual(['Action', 'Thriller']);
  });

  it('splits genres on a mix of separators and drops the empty pieces', async () => {
    const rows = await oneRow(
      'Title,Genre',
      'Die Hard,"Action,/ Thriller; ;Crime"'
    );

    expect(rows[0].genres).toEqual(['Action', 'Thriller', 'Crime']);
  });

  it('skips a row with a blank title', async () => {
    const rows = await readSheet(
      csv('Title,Year\nDie Hard,1988\n,1990\n   ,1991\nAmélie,2001\n'),
      'library.csv'
    );

    expect(rows.map((row) => row.title)).toEqual(['Die Hard', 'Amélie']);
  });

  it('treats a year that is not a year as no year', async () => {
    const rows = await readSheet(
      csv('Title,Year\nDie Hard,unknown\nAmélie,\nBrazil,19x5\n'),
      'library.csv'
    );

    expect(rows.map((row) => row.year)).toEqual([null, null, null]);
  });

  it('reads the rating on the column’s own 0–10 scale', async () => {
    const rows = await readSheet(
      csv('Title,Rating\nDie Hard,8\nAmélie,10\nBrazil,0\nGigli,\n'),
      'library.csv'
    );

    expect(rows.map((row) => row.rating)).toEqual([8, 10, 0, null]);
  });

  it.each(['yes', 'Yes', 'YES', 'true', 'TRUE', '1', '✓'])(
    'reads “%s” as watched',
    async (cell) => {
      const rows = await oneRow('Title,Watched', `Die Hard,${cell}`);

      expect(rows[0].watched).toBe(true);
    }
  );

  it.each(['no', 'false', '0', '', 'later'])(
    'reads “%s” as not watched',
    async (cell) => {
      const rows = await oneRow('Title,Watched', `Die Hard,${cell}`);

      expect(rows[0].watched).toBe(false);
    }
  );

  it('trims the text it reads', async () => {
    const rows = await oneRow(
      'Title,Director',
      '  Die Hard  ,  John McTiernan '
    );

    expect(rows[0]).toMatchObject({
      title: 'Die Hard',
      director: 'John McTiernan',
    });
  });
});
