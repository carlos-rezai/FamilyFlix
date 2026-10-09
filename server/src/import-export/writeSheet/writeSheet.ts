import ExcelJS from 'exceljs';

import type { ExportFormat } from '@/types';
import type { ExportTable, ExportTables } from '../exportRows/exportRows';

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
 * As csv, the Titles table is `<name>.csv` and the Episodes table
 * `<name>-episodes.csv`, each behind a UTF-8 BOM, which is what makes Excel
 * open `Amélie` as `Amélie`; the reader strips it on the way back in. As
 * xlsx, it is `<name>.xlsx`, a workbook whose worksheets are `Titles` then
 * `Episodes` — a number where a number was stored, and no styling: no bold
 * header, no widths, no frozen panes. Titles is first in both, so the Sheet
 * reader's first-worksheet rule reads it and never an episode.
 */
export async function writeSheet(
  tables: ExportTables,
  format: ExportFormat,
  name: string
): Promise<SheetFile[]> {
  // `exceljs` declares its own `Buffer` — a bare `ArrayBuffer` shape — for
  // what is a Node `Buffer` at runtime, the same mismatch the reader notes.
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook();
    addSheet(workbook, 'Titles', tables.titles);
    addSheet(workbook, 'Episodes', tables.episodes);
    const bytes = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
    return [{ filename: `${name}.xlsx`, bytes }];
  }
  return [
    { filename: `${name}.csv`, bytes: await csvOf(tables.titles) },
    { filename: `${name}-episodes.csv`, bytes: await csvOf(tables.episodes) },
  ];
}

/** Add one worksheet holding `table`, row for row. */
function addSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  table: ExportTable
): void {
  const sheet = workbook.addWorksheet(sheetName);
  for (const row of table) {
    sheet.addRow(row);
  }
}

/** One table as a csv file's bytes, behind its own UTF-8 BOM. */
async function csvOf(table: ExportTable): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  addSheet(workbook, 'Sheet', table);
  const csv = (await workbook.csv.writeBuffer()) as unknown as Buffer;
  return Buffer.concat([UTF8_BOM, csv]);
}
