// @vitest-environment node
//
// 60, Rebuild edges, Phase 14 (issue #577): every sheet row is as wide as its
// header.
//
// The **Sheet writer** pads every row to its header's width, `,` or `;`, so a
// Season row under the 22-column header has 22 fields, its trailing blanks
// written as empty fields rather than dropped. The Library sheet and the
// Export both write through it (log 60, Q19).

import { describe, expect, it } from 'vitest';

import { SHEET_COLUMNS } from '@/types';
import type { SheetColumn } from '@/types';
import type { ExportCell, ExportTable } from '../exportRows/exportRows';
import type { SheetDialect } from '../sheetDialect/sheetDialect';
import { writeSheet } from './writeSheet';

/** One sheet row, every column not named left blank. */
const rowOf = (cells: Partial<Record<SheetColumn, ExportCell>>): ExportCell[] =>
  SHEET_COLUMNS.map((column) => cells[column] ?? null);

/** A series in its four row types, the Season row blank past `Season`. */
const TABLE: ExportTable = [
  [...SHEET_COLUMNS],
  rowOf({
    Type: 'Movie',
    Folder: 'Die Hard (1988)',
    Title: 'Die Hard',
    Year: 1988,
    Synopsis: 'Christmas Eve; a tower, one cop',
    'TMDB rating': 7.8,
  }),
  rowOf({
    Type: 'Series',
    Folder: 'Tidewater (2018)',
    Title: 'Tidewater',
    Year: 2018,
  }),
  rowOf({ Type: 'Season', Folder: 'Tidewater (2018)', Season: 1 }),
  rowOf({
    Type: 'Episode',
    Folder: 'Tidewater (2018)',
    Season: 1,
    Episode: 1,
    Title: 'Low Water',
  }),
];

/** A csv line's fields, a quoted field's separators its own. */
function fieldsOf(
  line: string,
  separator: SheetDialect['separator']
): string[] {
  const fields: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      fields.push(field);
      field = '';
    } else {
      field += char;
    }
  }
  fields.push(field);
  return fields;
}

/** The csv's lines, its BOM stripped. */
async function linesOf(
  separator: SheetDialect['separator']
): Promise<string[]> {
  const bytes = await writeSheet(TABLE, 'csv', separator);
  return bytes
    .subarray(3)
    .toString('utf8')
    .split(/\r?\n/)
    .filter((line) => line !== '');
}

describe('writeSheet: every row as wide as its header', () => {
  for (const separator of [',', ';'] as const) {
    it(`writes every \`${separator}\` row with as many fields as the header`, async () => {
      const lines = await linesOf(separator);

      expect(lines).toHaveLength(TABLE.length);
      expect(fieldsOf(lines[0], separator)).toHaveLength(SHEET_COLUMNS.length);
      expect(lines.map((line) => fieldsOf(line, separator).length)).toEqual(
        lines.map(() => SHEET_COLUMNS.length)
      );
    });

    it(`writes a \`${separator}\` Season row's trailing blanks as empty fields`, async () => {
      const lines = await linesOf(separator);
      const season = lines.find((line) => line.startsWith('Season'));

      expect(season).toBe(
        ['Season', 'Tidewater (2018)', '1']
          .concat(Array(SHEET_COLUMNS.length - 3).fill(''))
          .join(separator)
      );
    });
  }
});
