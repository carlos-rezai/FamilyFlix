import ExcelJS from 'exceljs';

import {
  EXPORT_COLUMNS,
  type ExportColumn,
  type ExportFormat,
  type Movie,
  type WatchStatus,
} from '@/types';

/** The bytes Excel expects ahead of a UTF-8 CSV, so a diacritic opens as itself. */
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

/** What separates one genre, name or language from the next inside a cell. */
const CELL_SEPARATOR = ', ';

/** The word the Status column carries for each derived watch state. */
const STATUS_CELL: Record<WatchStatus, string> = {
  watched: 'Watched',
  'in-progress': 'In progress',
  unwatched: 'Unwatched',
};

/** A cell's value: text or a number, or `null` for an empty cell. */
type Cell = string | number | null;

/**
 * The eight cell rules, one per **Export column** — the only place in the
 * app that knows what a movie looks like as a row. Title as stored; Year the
 * number or empty; Genres joined in stored order; Director or empty; Cast
 * joined in stored order; Rating the stored 0–10 integer or empty; Status the
 * derived state's word; Subtitles the languages in track order. No synopsis,
 * runtime or path — the export is the spreadsheet, not the library.
 */
const CELL_RULES: Record<ExportColumn, (movie: Movie) => Cell> = {
  Title: (movie) => movie.title,
  Year: (movie) => movie.year,
  Genres: (movie) =>
    movie.genres.map((genre) => genre.name).join(CELL_SEPARATOR),
  Director: (movie) => movie.director,
  Cast: (movie) => movie.cast.join(CELL_SEPARATOR),
  Rating: (movie) => movie.rating,
  Status: (movie) => STATUS_CELL[movie.status],
  Subtitles: (movie) =>
    [...movie.subtitles]
      .sort((a, b) => a.position - b.position)
      .map((subtitle) => subtitle.language)
      .join(CELL_SEPARATOR),
};

/**
 * The **Sheet writer**: a list of movies and an **Export format** in, the
 * bytes of one **Export file** out — the **Sheet reader**'s mirror. Pure over
 * the list it is given: it opens no file, reads no storage and sorts nothing,
 * so the order written is the order given.
 *
 * The header row is {@link EXPORT_COLUMNS} in its own order, then one row per
 * movie under the eight cell rules above. The CSV arm begins with a UTF-8 BOM,
 * which is what makes Excel open `Amélie` as `Amélie`; the reader strips it
 * on the way back in. The Excel arm is Phase 2's — until it exists the writer
 * refuses `xlsx`, and the route refuses it before asking.
 */
export async function writeSheet(
  movies: Movie[],
  format: ExportFormat
): Promise<Buffer> {
  if (format !== 'csv') {
    throw new Error(`The Sheet writer has no ${format} arm yet.`);
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Library');
  sheet.addRow([...EXPORT_COLUMNS]);
  for (const movie of movies) {
    sheet.addRow(EXPORT_COLUMNS.map((column) => CELL_RULES[column](movie)));
  }

  // `exceljs` declares its own `Buffer` — a bare `ArrayBuffer` shape — for
  // what is a Node `Buffer` at runtime, the same mismatch the reader notes.
  const csv = (await workbook.csv.writeBuffer()) as unknown as Buffer;
  return Buffer.concat([UTF8_BOM, csv]);
}
