// @vitest-environment node
//
// 60, Rebuild edges, Phase 8 (issue #571): two rows for one title, the first
// read.
//
// Two rows with the same **Row type**, **Folder key**, season and episode:
// the **Sheet reader** reads the first and reports a `duplicate` skip for
// each repeated row, which `skipLine` spells `⚠ Heat (1995) is in the sheet
// twice, the first row read`. Rows differing only in season or episode are
// both read.

import { describe, expect, it } from 'vitest';

import { readSheet, type SheetRow, type SheetSkip } from './readSheet';

/** A sheet typed in place, as the bytes a CSV file would hold. */
const csv = (lines: string[]): Buffer =>
  Buffer.from(`${lines.join('\n')}\n`, 'utf8');

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

const duplicateOf = (label: string): SheetSkip => ({
  kind: 'duplicate',
  label,
});

describe('readSheet: two Movie rows for one Folder key', () => {
  it('reads the first and not the second', async () => {
    const { rows } = await readWithSkips([
      'Type,Folder,Title,Year,Rating',
      `Movie,${HEAT},Heat,1995,8`,
      `Movie,${HEAT},Heat (director's cut),1995,3`,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Heat');
    expect(rows[0].rating).toBe(8);
  });

  it('reports one duplicate skip naming the Folder key', async () => {
    const { skips } = await readWithSkips([
      'Type,Folder,Title,Year',
      `Movie,${HEAT},Heat,1995`,
      `Movie,${HEAT},Heat,1995`,
    ]);

    expect(skips).toEqual([duplicateOf(HEAT)]);
  });

  it('reports one duplicate skip per repeated row', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Title,Year',
      `Movie,${HEAT},Heat,1995`,
      `Movie,${HEAT},Heat,1995`,
      'Movie,Ronin (1998),Ronin,1998',
      `Movie,${HEAT},Heat,1995`,
    ]);

    expect(rows.map((row) => row.folder)).toEqual([HEAT, 'Ronin (1998)']);
    expect(skips).toEqual([duplicateOf(HEAT), duplicateOf(HEAT)]);
  });
});

describe('readSheet: the ticket’s finding 7 table', () => {
  it('names and ignores the second Heat row', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Title,Year,Rating,TMDB rating',
      `Movie,${HEAT},Heat,1995,"8,5","7,9"`,
      `Movie,${HEAT},Heat,1995,2,3`,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].rating).toBe(9);
    expect(rows[0].tmdbScore).toBe(7.9);
    expect(skips).toEqual([duplicateOf(HEAT)]);
  });
});

describe('readSheet: two Episode rows for one episode', () => {
  it('reads the first and reports the second as a duplicate', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Season,Episode,Title',
      `Episode,${TIDEWATER},1,2,The Pier`,
      `Episode,${TIDEWATER},1,2,The Jetty`,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('The Pier');
    expect(skips).toEqual([expect.objectContaining({ kind: 'duplicate' })]);
  });
});

describe('readSheet: rows that only look alike', () => {
  it('reads two Episode rows differing only in episode', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Season,Episode,Title',
      `Episode,${TIDEWATER},1,2,The Pier`,
      `Episode,${TIDEWATER},1,3,The Pier`,
    ]);

    expect(rows.map((row) => row.episode)).toEqual([2, 3]);
    expect(skips).toEqual([]);
  });

  it('reads two Episode rows differing only in season', async () => {
    const { rows, skips } = await readWithSkips([
      'Type,Folder,Season,Episode,Title',
      `Episode,${TIDEWATER},1,2,The Pier`,
      `Episode,${TIDEWATER},2,2,The Pier`,
    ]);

    expect(rows.map((row) => row.season)).toEqual([1, 2]);
    expect(skips).toEqual([]);
  });
});
