import ExcelJS from 'exceljs';
import { extname } from 'node:path';
import { Readable } from 'node:stream';

/**
 * One row of the maintainer's spreadsheet, as the **Sheet reader** answers it:
 * every column the importer can carry onto a movie, in one shape whichever
 * file format it came from and whichever synonym the header used.
 *
 * `year` and `rating` are numbers or `null`, `director` and `synopsis` text or
 * `null`, `cast` and `genres` lists that may be empty, `watched` a boolean —
 * the same "absent reads back as nothing" the library's own rows keep.
 */
export interface SheetRow {
  title: string;
  year: number | null;
  /** The last year of a run: `year` itself for a lone year, `null` for an open range or no year. */
  endYear: number | null;
  genres: string[];
  director: string | null;
  cast: string[];
  synopsis: string | null;
  rating: number | null;
  watched: boolean;
}

/** The columns the reader knows, each under every header the maintainer may spell it by. */
type Column =
  | 'title'
  | 'year'
  | 'genres'
  | 'director'
  | 'cast'
  | 'synopsis'
  | 'rating'
  | 'watched';

/**
 * The synonym table. The real sheet says `Title`, `Year` and `Genre` today, and
 * the rest exist for the day the maintainer adds a column under whichever
 * header they think of first. Matched case-insensitively, surrounding space
 * ignored. Adding a synonym is one line here.
 */
const SYNONYMS: Record<Column, string[]> = {
  title: ['title', 'name', 'movie', 'film'],
  year: ['year'],
  genres: ['genre', 'genres'],
  director: ['director'],
  cast: ['cast', 'actors'],
  synopsis: ['description', 'synopsis'],
  rating: ['rating'],
  // `status` is the header the **Sheet writer** puts over the watch state, so
  // an untouched **Export file** reads back as the library it came from.
  watched: ['watched', 'status'],
};

/** What separates one genre from the next inside a cell — a comma, a slash or a semicolon. */
const GENRE_SEPARATORS = /[,/;]/;

/** What separates one name from the next in a cast cell. */
const CAST_SEPARATORS = /,/;

/**
 * The cell values that say a film has been watched, case folded. `watched` is
 * the word the **Sheet writer** writes under `Status`; its other two —
 * `In progress` and `Unwatched` — fall through to `false`, as does every value
 * not listed here.
 */
const WATCHED = new Set(['yes', 'true', '1', '✓', 'watched']);

/** The rating column's own scale — the same ten the library stores. */
const MAX_RATING = 10;

/**
 * A cell's text, whatever `exceljs` typed it as. Excel stores `1988` as a
 * number and a CSV as the digits; a formula cell carries its result, a rich
 * text cell its runs, a hyperlink its text. Every one of them is text to a
 * reader whose columns are then parsed from text.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if ('richText' in value) {
    return value.richText
      .map((run) => run.text)
      .join('')
      .trim();
  }
  if ('text' in value) {
    return cellText(value.text as ExcelJS.CellValue);
  }
  if ('result' in value) {
    return cellText(value.result as ExcelJS.CellValue);
  }
  if ('error' in value) {
    return '';
  }
  return String(value).trim();
}

/**
 * The header cell's name, the way the synonym table spells it. A BOM is
 * stripped: Excel — and the **Sheet writer** — put one ahead of a UTF-8 CSV,
 * and `exceljs`'s CSV parser hands it back glued to the first header, where
 * it would turn `Title` into no title column at all.
 */
const headerKey = (text: string): string =>
  text
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();

/**
 * A number in a cell, or `null` for a cell that is not one — `unknown`,
 * `19x5`, nothing at all.
 */
function cellNumber(text: string): number | null {
  if (text === '' || !/^-?\d+(\.\d+)?$/.test(text)) {
    return null;
  }
  return Number(text);
}

/**
 * A Year cell's first and last year: `2022` is a finished run of one year,
 * `2019–2023` (or `2019-2023`) a range, `2021–` a run still going. Anything
 * else is neither year.
 */
function cellYears(text: string): Pick<SheetRow, 'year' | 'endYear'> {
  const lone = /^(\d{4})$/.exec(text);
  if (lone) {
    return { year: Number(lone[1]), endYear: Number(lone[1]) };
  }
  const range = /^(\d{4})\s*[–-]\s*(\d{4})?$/.exec(text);
  if (range) {
    return {
      year: Number(range[1]),
      endYear: range[2] === undefined ? null : Number(range[2]),
    };
  }
  return { year: null, endYear: null };
}

/**
 * A rating on the column's own 0–10 scale, rounded to the whole star the
 * library's half-star units count in; off the scale is no rating.
 */
function cellRating(text: string): number | null {
  const value = cellNumber(text);
  if (value === null || value < 0 || value > MAX_RATING) {
    return null;
  }
  return Math.round(value);
}

/** A cell split on separators, each piece trimmed, the empty ones dropped. */
function cellList(text: string, separators: RegExp): string[] {
  return text
    .split(separators)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');
}

/** Text, or `null` for an empty cell. */
const cellOptional = (text: string): string | null =>
  text === '' ? null : text;

/**
 * Open the bytes as the format the extension says, or refuse them.
 *
 * `.xlsx` and `.csv` are the two formats the maintainer's sheet can be in, and
 * the extension is what says which — a `.txt` holding perfectly good CSV is
 * still refused, because guessing at bytes is how a reader ends up opening a
 * file as something it is not.
 */
async function openWorkbook(
  bytes: Buffer,
  filename: string
): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const extension = extname(filename).toLowerCase();

  if (extension === '.xlsx') {
    // `exceljs` declares its own `Buffer` — a bare `ArrayBuffer` shape — which
    // Node's typed `Buffer<ArrayBufferLike>` is not assignable to, though it
    // is exactly what `load` reads at runtime.
    await workbook.xlsx.load(bytes as unknown as ArrayBuffer);
    return workbook;
  }
  if (extension === '.csv') {
    // `exceljs` would otherwise read `1988` as a number and a date-shaped cell
    // as a date; the reader owes the caller one shape for both formats, and
    // that shape is text parsed here.
    await workbook.csv.read(Readable.from([bytes]), {
      map: (value: string) => value,
    });
    return workbook;
  }
  throw new Error('The spreadsheet must be an .xlsx or .csv file.');
}

/**
 * The **Sheet reader**: bytes and a filename in, **Sheet rows** out. Pure over
 * a buffer — it opens no file and knows no path, which is what lets every case
 * in its test be a string typed in place.
 *
 * The first worksheet is the sheet, its first row the header, and the header
 * is matched through the synonym table case-insensitively. Only a title column
 * is required — a sheet with none is the one refusal the reader makes, and it
 * is the sheet field's `400` upstream. A column it does not recognise is
 * ignored; a row with a blank title is skipped, and `onBlankTitle` is told
 * its row number so the skip can be a **Log line** rather than silence.
 */
export async function readSheet(
  bytes: Buffer,
  filename: string,
  onBlankTitle: (rowNumber: number) => void = () => undefined
): Promise<SheetRow[]> {
  const workbook = await openWorkbook(bytes, filename);
  const sheet = workbook.worksheets[0];
  if (sheet === undefined) {
    throw new Error('The spreadsheet has no title column.');
  }

  // Which column number each known column sits at, from the header row.
  const columns = new Map<Column, number>();
  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, number) => {
    const key = headerKey(cellText(cell.value));
    for (const column of Object.keys(SYNONYMS) as Column[]) {
      if (!columns.has(column) && SYNONYMS[column].includes(key)) {
        columns.set(column, number);
      }
    }
  });

  const titleColumn = columns.get('title');
  if (titleColumn === undefined) {
    throw new Error(
      'The spreadsheet has no title column — a Title, Name, Movie or Film header.'
    );
  }

  /** The text of one row's cell under a known column — empty when the sheet has no such column. */
  const read = (row: ExcelJS.Row, column: Column): string => {
    const number = columns.get(column);
    return number === undefined ? '' : cellText(row.getCell(number).value);
  };

  const rows: SheetRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    if (number === 1) {
      return;
    }
    const title = read(row, 'title');
    if (title === '') {
      onBlankTitle(number);
      return;
    }
    rows.push({
      title,
      ...cellYears(read(row, 'year')),
      genres: cellList(read(row, 'genres'), GENRE_SEPARATORS),
      director: cellOptional(read(row, 'director')),
      cast: cellList(read(row, 'cast'), CAST_SEPARATORS),
      synopsis: cellOptional(read(row, 'synopsis')),
      rating: cellRating(read(row, 'rating')),
      watched: WATCHED.has(read(row, 'watched').toLowerCase()),
    });
  });

  return rows;
}
