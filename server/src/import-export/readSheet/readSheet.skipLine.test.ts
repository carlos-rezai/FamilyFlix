// @vitest-environment node
//
// 60, Rebuild edges, Phase 2 (issue #565): both runs log every skip.
//
// `skipLine(skip)` gives each `SheetSkip` its **Log line** text, as the
// handoff's _Copy_ table spells it: a Movie or Series row named by its
// **Folder key**, a Season row by its season, an Episode row by its tag. The
// row-typed cases go through `readSheet`, so the line is the one a caller
// logs for the skip the reader reported.

import { describe, expect, it } from 'vitest';

import { readSheet, skipLine, type SheetSkip } from './readSheet';

/** A sheet typed in place, as the bytes a CSV file would hold. */
const csv = (lines: string[]): Buffer =>
  Buffer.from(`${lines.join('\n')}\n`, 'utf8');

/** The Log line of every skip the reader reports for a sheet, in order. */
async function linesOf(lines: string[]): Promise<string[]> {
  const skips: SheetSkip[] = [];
  await readSheet(csv(lines), 'library.csv', (skip) => {
    skips.push(skip);
  });
  return skips.map(skipLine);
}

const HEADER = 'Type,Folder,Season,Episode,Title,Year,Poster,Still';

describe('skipLine: the handoff’s Copy table', () => {
  it('names a titleless row by its number', () => {
    expect(skipLine({ kind: 'blank-title', rowNumber: 12 })).toBe(
      '⚠ Row 12 has no title, skipped'
    );
  });

  it('names an Unread cell on a Movie row by its Folder key', () => {
    expect(
      skipLine({
        kind: 'unread-cell',
        label: 'Heat (1995)',
        column: 'Rating',
        text: '8½',
      })
    ).toBe('⚠ Heat (1995): Rating "8½" not read');
  });

  it('names a second row for one Folder key, the first read', () => {
    expect(skipLine({ kind: 'duplicate', label: 'Heat (1995)' })).toBe(
      '⚠ Heat (1995) is in the sheet twice, the first row read'
    );
  });
});

describe('skipLine: the line for each skip the reader reports', () => {
  it('names a Movie row’s Unread cell by its Folder key', async () => {
    expect(
      await linesOf([HEADER, 'Movie,Heat (1995),,,Heat,1995,../secret.txt,'])
    ).toEqual(['⚠ Heat (1995): Poster "../secret.txt" not read']);
  });

  it('names a Series row’s Unread cell by its Folder key', async () => {
    expect(
      await linesOf([HEADER, 'Series,Tidewater (2018),,,Tidewater,2018,x.txt,'])
    ).toEqual(['⚠ Tidewater (2018): Poster "x.txt" not read']);
  });

  it('names a Season row’s Unread cell by its season', async () => {
    expect(
      await linesOf([HEADER, 'Season,Tidewater (2018),1,,,,x.txt,'])
    ).toEqual(['⚠ Tidewater (2018) Season 1: Poster "x.txt" not read']);
  });

  it('names an Episode row’s Unread cell by its tag', async () => {
    expect(
      await linesOf([
        HEADER,
        'Episode,Tidewater (2018),1,2,The Crossing,,,x.txt',
      ])
    ).toEqual(['⚠ Tidewater (2018) S01E02: Still "x.txt" not read']);
  });

  it('names a titleless row by its row number in the sheet', async () => {
    expect(
      await linesOf([
        HEADER,
        'Movie,Heat (1995),,,Heat,1995,,',
        'Movie,,,,,1998,,',
      ])
    ).toEqual(['⚠ Row 3 has no title, skipped']);
  });
});
