import ExcelJS from 'exceljs';

import type { ExportFormat } from '@/types';
import type { ExportTables } from '../exportRows/exportRows';

/** The bytes Excel expects ahead of a UTF-8 CSV, so a diacritic opens as itself. */
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** One file the writer answers: its name inside the **Export folder**, and its bytes. */
export interface SheetFile {
  filename: string;
  bytes: Buffer;
}

/**
 * The **Sheet writer**: `exportRows`' tables, an **Export format** and the
 * **Export name** in, the named files out — the **Sheet reader**'s mirror.
 * Pure over the tables it is given: it opens no file, reads no storage and
 * sorts nothing, so the order written is the order given.
 *
 * As csv, the Titles table is `<name>.csv` behind a UTF-8 BOM, which is what
 * makes Excel open `Amélie` as `Amélie`; the reader strips it on the way back
 * in. As xlsx, it is `<name>.xlsx`, a workbook whose first worksheet is
 * `Titles` — a number where a number was stored, and no styling: no bold
 * header, no widths, no frozen panes.
 */
export async function writeSheet(
  tables: ExportTables,
  format: ExportFormat,
  name: string
): Promise<SheetFile[]> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Titles');
  for (const row of tables.titles) {
    sheet.addRow(row);
  }

  // `exceljs` declares its own `Buffer` — a bare `ArrayBuffer` shape — for
  // what is a Node `Buffer` at runtime, the same mismatch the reader notes.
  if (format === 'xlsx') {
    const bytes = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    return [{ filename: `${name}.xlsx`, bytes }];
  }
  const csv = (await workbook.csv.writeBuffer()) as unknown as Buffer;
  return [{ filename: `${name}.csv`, bytes: Buffer.concat([UTF8_BOM, csv]) }];
}
