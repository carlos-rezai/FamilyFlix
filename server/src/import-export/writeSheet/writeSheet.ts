import ExcelJS from 'exceljs';

import type { ExportFormat, SheetColumn } from '@/types';
import type { ExportTable } from '../exportRows/exportRows';

/** The bytes Excel expects ahead of a UTF-8 CSV, so a diacritic opens as itself. */
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** The one worksheet of an xlsx sheet. */
const WORKSHEET = 'Library';

/**
 * The columns whose cells are each one path into the **Export folder**, a
 * link in Excel. Built from the column list's own names, so a renamed column
 * fails the typecheck rather than quietly stopping linking; read by any
 * header cell.
 */
const PATH_COLUMNS: ReadonlySet<string> = new Set<SheetColumn>([
  'Poster',
  'Backdrop',
  'Still',
]);

/**
 * The **Sheet writer**: `exportRows`' one table and an **Export format** in,
 * the sheet's bytes out, the **Sheet reader**'s mirror. Pure over the table
 * it is given: it opens no file, sorts nothing and names nothing, so the
 * order written is the order given and the caller decides where it lands.
 *
 * As csv, one file behind a UTF-8 BOM, which is what makes Excel open
 * `Amélie` as `Amélie`; the reader strips it on the way back in. As xlsx, a
 * workbook of one worksheet, `Library`: a number where a number was stored,
 * no styling (no bold header, no widths, no frozen panes), and each Poster,
 * Backdrop and Still cell holding a path a hyperlink whose text is that path.
 */
export async function writeSheet(
  table: ExportTable,
  format: ExportFormat
): Promise<Buffer> {
  // `exceljs` declares its own `Buffer`, a bare `ArrayBuffer` shape, for
  // what is a Node `Buffer` at runtime, the same mismatch the reader notes.
  const workbook = new ExcelJS.Workbook();
  if (format === 'xlsx') {
    addSheet(workbook, WORKSHEET, table, true);
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }
  addSheet(workbook, WORKSHEET, table);
  const csv = (await workbook.csv.writeBuffer()) as unknown as Buffer;
  return Buffer.concat([UTF8_BOM, csv]);
}

/**
 * Add one worksheet holding `table`, row for row; with `links`, each filled
 * cell under a path column becomes a hyperlink whose text is the path.
 */
function addSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  table: ExportTable,
  links = false
): void {
  const sheet = workbook.addWorksheet(sheetName);
  const [header = []] = table;
  for (const [index, row] of table.entries()) {
    if (!links || index === 0) {
      sheet.addRow(row);
      continue;
    }
    sheet.addRow(
      row.map((cell, column) =>
        typeof cell === 'string' &&
        cell !== '' &&
        PATH_COLUMNS.has(String(header[column]))
          ? { text: cell, hyperlink: cell }
          : cell
      )
    );
  }
}
