// @vitest-environment node
//
// 60, Rebuild edges, Phase 4 (issue #570): every cell the reader can't take
// is named.
//
// The **Sheet reader** reports an **Unread cell** (an `unread-cell` skip) for
// every filled cell it can't take: `Year`, `Season`, `Episode`, `Rating`,
// `Runtime`, `TMDB rating`, `TMDB id` and `Air date` when unparseable, each
// read as blank; an unknown `Type`, still read as Movie; a `Status` outside
// its yes-list and spelled no-list (`no`, `false`, `0`, `unwatched`,
// `in progress`); a `Favorite` outside its yes-list and no-list (`no`,
// `false`, `0`); and a filled Episode row `Synopsis`, which is not an
// episode's field. A no-list word reads as no, with no skip. Genres are not
// the reader's to report.

import { describe, expect, it } from 'vitest';

import type { SheetColumn } from '@/types';
import { readSheet, type SheetRow, type SheetSkip } from './readSheet';

/** A sheet typed in place, as the bytes a CSV file would hold. */
const csv = (lines: string[]): Buffer =>
  Buffer.from(`${lines.join('\n')}\n`, 'utf8');

/** A cell quoted for CSV, so a comma, quote or space in it reads as text. */
const quoted = (text: string): string => `"${text.replace(/"/g, '""')}"`;

/** Read a sheet and gather every skip the reader reports. */
async function readWithSkips(
  lines: string[]
): Promise<{ rows: SheetRow[]; skips: SheetSkip[] }> {
  const skips: SheetSkip[] = [];
  const rows = await readSheet(csv(lines), 'library.csv', (skip) => {
    skips.push(skip);
  });
  return { rows, skips };
}

const HEAT = 'Heat (1995)';
const TIDEWATER = 'Tidewater (2018)';

/** _Heat_'s Movie row, `column` holding `cell` beside its Title. */
const heatWith = (column: string, cell: string): string[] => [
  `Type,Folder,Title,${column}`,
  `Movie,${HEAT},Heat,${quoted(cell)}`,
];

/** An unread cell on Heat's row, as the reader reports it. */
const unreadOnHeat = (column: SheetColumn, text: string): SheetSkip => ({
  kind: 'unread-cell',
  label: HEAT,
  column,
  text,
});

describe('readSheet: a number or date cell that does not parse', () => {
  it.each([
    ['Year', 'nineteen ninety-five', 'year'],
    ['Rating', '8½', 'rating'],
    ['Runtime', '2h50', 'runtime'],
    ['TMDB rating', 'n/a', 'tmdbScore'],
    ['TMDB id', 'tt0113277', 'tmdbId'],
    ['Air date', 'next spring', 'airDate'],
  ] as const)(
    'reads a %s cell "%s" as blank, one Unread cell',
    async (column, cell, field) => {
      const { rows, skips } = await readWithSkips(heatWith(column, cell));

      expect(rows[0][field]).toBeNull();
      expect(skips).toEqual([unreadOnHeat(column, cell)]);
    }
  );

  it('reads an Episode row’s Season cell that does not parse as blank, one Unread cell', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Season,Episode,Title',
      `Episode,${TIDEWATER},one,2,The Pier`,
    ]);

    expect(rows[0].season).toBeNull();
    expect(skips).toEqual([
      { kind: 'unread-cell', label: TIDEWATER, column: 'Season', text: 'one' },
    ]);
  });

  it('reads an Episode row’s Episode cell that does not parse as blank, one Unread cell', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Season,Episode,Title',
      `Episode,${TIDEWATER},1,two,The Pier`,
    ]);

    expect(rows[0].episode).toBeNull();
    expect(skips).toEqual([
      { kind: 'unread-cell', label: TIDEWATER, column: 'Episode', text: 'two' },
    ]);
  });

  it('reports nothing for a number cell that parses, nor for a blank one', async () => {
    const { skips } = await readWithSkips([
      'Type,Folder,Title,Year,Rating,Runtime,TMDB rating,TMDB id,Air date',
      `Movie,${HEAT},Heat,1995,8,170,8.3,949,`,
      'Movie,Ronin (1998),Ronin,,,,,,',
    ]);

    expect(skips).toEqual([]);
  });
});

describe('readSheet: an unknown Type', () => {
  it('reads the row as a Movie and reports the cell', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Title,Year',
      `Film,${HEAT},Heat,1995`,
    ]);

    expect(rows[0].type).toBe('Movie');
    expect(skips).toEqual([unreadOnHeat('Type', 'Film')]);
  });
});

describe('readSheet: Status and Favorite by their lists', () => {
  it('reports a Status of neither list, read as not watched', async () => {
    const { rows, skips } = await readWithSkips(heatWith('Status', 'half'));

    expect(rows[0].watched).toBe(false);
    expect(skips).toEqual([unreadOnHeat('Status', 'half')]);
  });

  it('reports a Favorite of neither list, read as no favourite', async () => {
    const { rows, skips } = await readWithSkips(heatWith('Favorite', 'ja'));

    expect(rows[0].favorite).toBe(false);
    expect(skips).toEqual([unreadOnHeat('Favorite', 'ja')]);
  });

  it.each(['no', 'false', '0', 'unwatched', 'in progress', 'In progress'])(
    'reads Status "%s" as not watched, with no skip',
    async (cell) => {
      const { rows, skips } = await readWithSkips(heatWith('Status', cell));

      expect(rows[0].watched).toBe(false);
      expect(skips).toEqual([]);
    }
  );

  it.each(['no', 'false', '0', 'No'])(
    'reads Favorite "%s" as no favourite, with no skip',
    async (cell) => {
      const { rows, skips } = await readWithSkips(heatWith('Favorite', cell));

      expect(rows[0].favorite).toBe(false);
      expect(skips).toEqual([]);
    }
  );
});

describe('readSheet: an Episode row’s Synopsis', () => {
  it('reads a filled one as blank and reports it under the episode’s tag', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Season,Episode,Title,Synopsis',
      `Episode,${TIDEWATER},1,2,The Pier,${quoted('The tide comes in.')}`,
    ]);

    expect(rows[0].synopsis).toBeNull();
    expect(skips).toEqual([
      {
        kind: 'unread-cell',
        label: `${TIDEWATER} S01E02`,
        column: 'Synopsis',
        text: 'The tide comes in.',
      },
    ]);
  });

  it('still reads a Series row’s Synopsis, with no skip', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Title,Synopsis',
      `Series,${TIDEWATER},Tidewater,${quoted('A coast town.')}`,
    ]);

    expect(rows[0].synopsis).toBe('A coast town.');
    expect(skips).toEqual([]);
  });
});

describe('readSheet: a genre outside the pool', () => {
  it('is not the reader’s to report', async () => {
    const { rows, skips } = await readWithSkips(heatWith('Genre', 'Heist'));

    expect(rows[0].genres).toEqual(['Heist']);
    expect(skips).toEqual([]);
  });
});

describe('readSheet: the ticket’s finding 7 row', () => {
  it('reads 8,5 and 7,9 and names ja', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Title,Year,Rating,TMDB rating,Favorite',
      `Movie,${HEAT},Heat,1995,"8,5","7,9",ja`,
    ]);

    expect(rows[0].rating).toBe(9);
    expect(rows[0].tmdbScore).toBe(7.9);
    expect(rows[0].favorite).toBe(false);
    expect(skips).toEqual([unreadOnHeat('Favorite', 'ja')]);
  });
});
