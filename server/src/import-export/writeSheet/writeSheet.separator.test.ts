// @vitest-environment node
//
// 60, Rebuild edges, Phase 4 (issue #567): the Sheet writer takes a separator.
//
// `writeSheet(table, format, separator = ',')`: a `;` separator writes the
// csv `;`-separated, the decimal mark a comma with it, so a TMDB rating of
// 7.9 writes as `7,9`; a field holding `;` is quoted. A `,` sheet, given or by
// default, is byte for byte what the writer wrote before. Either way the
// bytes are UTF-8 behind a BOM (log 60, Q6).

import { describe, expect, it } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
import type { SheetColumn } from '@/types';
import type { ExportCell, ExportTable } from '../exportRows/exportRows';
import { writeSheet } from './writeSheet';

const UTF8_BOM = [0xef, 0xbb, 0xbf];

/** One sheet row, every column not named left blank. */
const rowOf = (cells: Partial<Record<SheetColumn, ExportCell>>): ExportCell[] =>
  SHEET_COLUMNS.map((column) => cells[column] ?? null);

const column = (name: SheetColumn): number => SHEET_COLUMNS.indexOf(name);

/** A film with a decimal TMDB rating, its synopsis holding a full stop. */
const AMELIE = rowOf({
  Type: 'Movie',
  Folder: 'Amélie (2001)',
  Title: 'Amélie',
  Year: 2001,
  Runtime: 122,
  Synopsis: 'A shy waitress. Paris 1997.',
  Rating: 7,
  'TMDB rating': 7.9,
  'TMDB id': 194,
});

/** A film whose synopsis holds the `;` separator. */
const DIE_HARD = rowOf({
  Type: 'Movie',
  Folder: 'Die Hard (1988)',
  Title: 'Die Hard',
  Year: 1988,
  Synopsis: 'Christmas Eve; a tower; one cop',
  'TMDB rating': 7.8,
});

const TABLE: ExportTable = [[...SHEET_COLUMNS], AMELIE, DIE_HARD];

/** The csv's lines, its BOM stripped. */
async function linesOf(separator?: ',' | ';'): Promise<string[]> {
  const bytes = await writeSheet(TABLE, 'csv', separator);
  return bytes
    .toString('utf8')
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((line) => line !== '');
}

describe('writeSheet: a `;` separator', () => {
  it('writes `;` between fields, the header and every row', async () => {
    const [header, amelie] = await linesOf(';');

    expect(header).toBe(SHEET_COLUMNS.join(';'));
    expect(amelie.split(';')[column('Type')]).toBe('Movie');
    expect(amelie.split(';')[column('Title')]).toBe('Amélie');
  });

  it('writes a decimal number with a decimal comma, a whole one as it is', async () => {
    const [, amelie] = await linesOf(';');
    const cells = amelie.split(';');

    expect(cells[column('TMDB rating')]).toBe('7,9');
    expect(cells[column('Year')]).toBe('2001');
    expect(cells[column('Runtime')]).toBe('122');
    expect(cells[column('Rating')]).toBe('7');
  });

  it('leaves a full stop in a text cell as it is', async () => {
    const [, amelie] = await linesOf(';');

    expect(amelie).toContain(';A shy waitress. Paris 1997.;');
  });

  it('quotes a field holding `;`', async () => {
    const [, , dieHard] = await linesOf(';');

    expect(dieHard).toContain(';"Christmas Eve; a tower; one cop";');
    // The rating may close the line: rows are padded only in phase 14.
    expect(dieHard).toMatch(/;7,8(;|$)/);
  });
});

describe('writeSheet: the `,` default', () => {
  it('writes a `,` sheet byte for byte as before, given or by default, and only `;` changes it', async () => {
    const byDefault = await writeSheet(TABLE, 'csv');
    const given = await writeSheet(TABLE, 'csv', ',');
    const semicolon = await writeSheet(TABLE, 'csv', ';');

    expect(given.equals(byDefault)).toBe(true);
    const [header, amelie] = byDefault
      .toString('utf8')
      .replace(/^﻿/, '')
      .split(/\r?\n/);
    expect(header).toBe(SHEET_COLUMNS.join(','));
    expect(amelie).toContain(',7.9,');
    expect(semicolon.equals(byDefault)).toBe(false);
  });
});

describe('writeSheet: the encoding', () => {
  it('writes both separators as UTF-8 behind one BOM', async () => {
    for (const separator of [',', ';'] as const) {
      const bytes = await writeSheet(TABLE, 'csv', separator);

      expect([...bytes.subarray(0, 3)]).toEqual(UTF8_BOM);
      const text = new TextDecoder('utf-8', { fatal: true }).decode(
        bytes.subarray(3)
      );
      expect(text.startsWith('﻿')).toBe(false);
      expect(text.split(/\r?\n/)[0]).toBe(SHEET_COLUMNS.join(separator));
      expect(text).toContain('Amélie');
    }
  });
});
