/**
 * Rewrites each fixture's `library.xlsx` from its `library.csv`, through the
 * shipping **Sheet writer**, so the two spellings of a fixture's one sheet
 * never drift apart. The CSV is the source; run after editing one:
 *
 *   node_modules/.bin/tsx server/src/test-support/fixtureSheets/fixtureSheets.ts
 *
 * A cell of digits alone is written as a number, as an Export writes a year
 * or a rating; every other cell as its text.
 */
import ExcelJS from 'exceljs';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import type {
  ExportCell,
  ExportTable,
} from '../../import-export/exportRows/exportRows';
import { writeSheet } from '../../import-export/writeSheet/writeSheet';

/** The fixture folders holding a `library.csv` and `library.xlsx` pair. */
const FIXTURES = ['fixture', 'seriesFixture'].map((name) =>
  fileURLToPath(
    new URL(`../../import-export/createImporter/${name}/`, import.meta.url)
  )
);

/** A CSV cell as an Export would have written it. */
const cellOf = (text: string): ExportCell =>
  text === '' ? null : /^\d+$/.test(text) ? Number(text) : text;

/** A fixture's CSV read into the table the Sheet writer takes. */
async function tableOf(csvPath: string): Promise<ExportTable> {
  const workbook = new ExcelJS.Workbook();
  const sheet = await workbook.csv.read(
    Readable.from([readFileSync(csvPath)]),
    { map: (value: string) => value }
  );
  const width = sheet.getRow(1).cellCount;
  const table: ExportTable = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const cells: ExportCell[] = [];
    for (let column = 1; column <= width; column += 1) {
      cells.push(cellOf(String(row.getCell(column).value ?? '')));
    }
    table.push(cells);
  });
  return table;
}

/** Each fixture's xlsx rewritten from its CSV. */
async function writeFixtureSheets(): Promise<void> {
  for (const dir of FIXTURES) {
    const table = await tableOf(join(dir, 'library.csv'));
    writeFileSync(join(dir, 'library.xlsx'), await writeSheet(table, 'xlsx'));
  }
}

void writeFixtureSheets();
