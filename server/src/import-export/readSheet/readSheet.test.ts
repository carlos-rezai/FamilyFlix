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
      endYear: 1988,
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
      endYear: 2001,
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
        endYear: 1988,
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

// --- 14 — Export, Phase 1: "the tracer bullet" (issue #137) -------------------
//
// The **Sheet writer** is this reader's mirror, and it writes the watch state
// under a `Status` header as `Watched` / `In progress` / `Unwatched` — the
// three derived states, not a yes/no. For an untouched **Export file** to read
// back as the library it came from, `Status` joins the watched column's
// synonyms, `Watched` joins the truthy values, and the two other states fall
// through to `false`. The `watched` header and its old values still read: the
// maintainer's own sheet is not rewritten by the export shipping.

describe('readSheet — the Status column an export writes', () => {
  it('reads a Status header as the watched column', async () => {
    const rows = await oneRow('Title,Status', 'Die Hard,Watched');

    expect(rows[0].watched).toBe(true);
  });

  it.each(['Watched', 'watched', 'WATCHED'])(
    'reads “%s” as watched',
    async (cell) => {
      const rows = await oneRow('Title,Status', `Die Hard,${cell}`);

      expect(rows[0].watched).toBe(true);
    }
  );

  it.each(['In progress', 'in progress', 'Unwatched', 'unwatched'])(
    'reads “%s” as not watched',
    async (cell) => {
      const rows = await oneRow('Title,Status', `Die Hard,${cell}`);

      expect(rows[0].watched).toBe(false);
    }
  );

  it('still reads the watched header and its old values', async () => {
    const rows = await readSheet(
      csv(
        'Title,Watched\nDie Hard,yes\nAmélie,true\nNorthwind,1\nZephyr,✓\nMeridian,no\n'
      ),
      'library.csv'
    );

    expect(rows.map((row) => row.watched)).toEqual([
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('reads the export’s own value under the old header too', async () => {
    const rows = await oneRow('Title,Watched', 'Die Hard,Watched');

    expect(rows[0].watched).toBe(true);
  });

  it('takes the first of Status and Watched when a sheet carries both', async () => {
    // Two headers for one column: the leftmost wins, as it does for every
    // other synonym pair, rather than the later one overwriting.
    const rows = await oneRow('Title,Status,Watched', 'Die Hard,Watched,no');

    expect(rows[0].watched).toBe(true);
  });
});

describe('readSheet — a CSV that begins with a BOM', () => {
  /** The bytes Excel — and the **Sheet writer** — put ahead of a UTF-8 CSV. */
  const BOM = '\uFEFF';

  it('strips the BOM, so the first header is still the title column', async () => {
    const rows = await readSheet(
      csv(`${BOM}Title,Year\nDie Hard,1988\n`),
      'library.csv'
    );

    expect(rows).toEqual([
      {
        title: 'Die Hard',
        year: 1988,
        endYear: 1988,
        genres: [],
        director: null,
        cast: [],
        synopsis: null,
        rating: null,
        watched: false,
      },
    ]);
  });

  it('does not refuse a BOM-led sheet as one with no title column', async () => {
    await expect(
      readSheet(csv(`${BOM}Title\nDie Hard\n`), 'library.csv')
    ).resolves.toHaveLength(1);
  });

  it('keeps a BOM out of the title when Title is the first column', async () => {
    const rows = await readSheet(
      csv(`${BOM}Title,Status\nDie Hard,Watched\n`),
      'library.csv'
    );

    expect(rows[0].title).toBe('Die Hard');
    expect(rows[0].title.charCodeAt(0)).not.toBe(0xfeff);
  });
});

// 22 — Series (TV), Phase 8: "re-runs, year ranges, unnamed shows, the setup
// panel" (issue #198).
//
// A show's row spans years, so the Year cell learns four shapes: a lone year,
// a range with an en dash or a hyphen, and an open range for a show still
// running. A lone year is a finished run — its end is itself — and a film's
// row is read the same way, so a film given a range keeps its first year.
describe('readSheet — a Year cell that spans years', () => {
  it.each([
    ['a lone year', '2022', 2022, 2022],
    ['a range with an en dash', '2019–2023', 2019, 2023],
    ['a range with a hyphen', '2019-2023', 2019, 2023],
    ['an open range', '2021–', 2021, null],
  ])('reads %s', async (_, cell, year, endYear) => {
    const rows = await oneRow('Title,Year', `Harbor & Vine,${cell}`);

    expect(rows[0]).toMatchObject({ year, endYear });
  });

  it('reads a blank or unreadable Year as neither year', async () => {
    const rows = await readSheet(
      csv('Title,Year\nDie Hard,\nAmélie,unknown\nBrazil,2019–20x3\n'),
      'library.csv'
    );

    expect(rows.map((row) => [row.year, row.endYear])).toEqual([
      [null, null],
      [null, null],
      [null, null],
    ]);
  });

  it('keeps a film row’s first year when its Year cell is a range', async () => {
    const rows = await oneRow(
      'Title,Year,Director',
      'Die Hard,1988–1990,John McTiernan'
    );

    expect(rows[0].year).toBe(1988);
  });
});
