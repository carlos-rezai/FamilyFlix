import ExcelJS from 'exceljs';
import { extname, join } from 'node:path';
import { Readable } from 'node:stream';

import {
  ROW_TYPES,
  SHEET_PATH_SEPARATOR,
  type RowType,
  type SheetColumn,
} from '@/types';
import { yearSpan } from '../../library/series/yearSpan/yearSpan';
import {
  isImageFilename,
  isSubtitleFilename,
} from '../../media/fileKinds/fileKinds';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import {
  sameFolderKey,
  spellFolderKey,
} from '../../media/folderKeyOf/folderKeyOf';
import { sheetDialect } from '../sheetDialect/sheetDialect';

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
  /** Its **Row type**: `Movie` for a blank cell or a sheet with no Type column. */
  type: RowType;
  /**
   * Its **Folder key**: the Folder cell, or `Title (Year)` spelled from the
   * row's Title and first year when the cell is blank or the column absent.
   */
  folder: string;
  /** A Season or Episode row's season number. */
  season: number | null;
  /** An Episode row's number within its season. */
  episode: number | null;
  /** The title; empty for a Season row, which has none. */
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
  /** An Episode row's air date, `YYYY-MM-DD`. */
  airDate: string | null;
  /** Minutes. */
  runtime: number | null;
  tmdbScore: number | null;
  tmdbId: number | null;
  favorite: boolean;
  /**
   * The path cells, as the sheet spells them: relative, forward slashes,
   * several tracks split on `|`. The matcher resolves them.
   */
  video: string | null;
  subtitles: string[];
  poster: string | null;
  backdrop: string | null;
  still: string | null;
}

/**
 * What the reader passes over and tells its caller about, so each can be a
 * **Log line** (by {@link skipLine}) rather than silence: a Movie or Series
 * row with no title; an **Unread cell**, a filled cell read as blank (a
 * number, date or Type that doesn't parse, a Status or Favorite on neither
 * list, an Episode row's Synopsis, a path cell that isn't contained under
 * **Path cells**' rule); or a row repeating an earlier one, the first read.
 */
export type SheetSkip =
  | { kind: 'blank-title'; rowNumber: number }
  | {
      kind: 'unread-cell';
      /**
       * The row as its line names it: a Movie or Series row by its **Folder
       * key**, a Season row by its season (`Tidewater (2018) Season 1`), an
       * Episode row by its tag (`Tidewater (2018) S01E02`).
       */
      label: string;
      /** The column's header, as the **Sheet writer** spells it. */
      column: SheetColumn;
      /** The cell's text, or the one `Subtitles` path, as the sheet spells it. */
      text: string;
    }
  | {
      kind: 'duplicate';
      /** The repeated row, named as an `unread-cell`'s label names it. */
      label: string;
    };

/** A skip's **Log line** text, as the handoff's _Copy_ table spells it. */
export function skipLine(skip: SheetSkip): string {
  switch (skip.kind) {
    case 'blank-title':
      return `⚠ Row ${skip.rowNumber} has no title, skipped`;
    case 'unread-cell':
      return `⚠ ${skip.label}: ${skip.column} "${skip.text}" not read`;
    case 'duplicate':
      return `⚠ ${skip.label} is in the sheet twice, the first row read`;
  }
}

/** The columns the reader knows, each under every header the maintainer may spell it by. */
type Column =
  | 'type'
  | 'folder'
  | 'season'
  | 'episode'
  | 'airDate'
  | 'runtime'
  | 'tmdbScore'
  | 'tmdbId'
  | 'favorite'
  | 'video'
  | 'subtitles'
  | 'poster'
  | 'backdrop'
  | 'still'
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
  // The rest are the one sheet's own **Sheet columns**, as `exportRows` writes them.
  type: ['type'],
  folder: ['folder'],
  season: ['season'],
  episode: ['episode'],
  airDate: ['air date'],
  runtime: ['runtime'],
  tmdbScore: ['tmdb rating'],
  tmdbId: ['tmdb id'],
  favorite: ['favorite'],
  video: ['video'],
  subtitles: ['subtitles'],
  poster: ['poster'],
  backdrop: ['backdrop'],
  still: ['still'],
};

/** What separates one genre from the next inside a cell — a comma, a slash or a semicolon. */
const GENRE_SEPARATORS = /[,/;]/;

/** What separates one name from the next in a cast cell. */
const CAST_SEPARATORS = /,/;

/**
 * The cell values that say a film has been watched, case folded. `watched` is
 * the word the **Sheet writer** writes under `Status`; its other two,
 * `In progress` and `Unwatched`, are on the no-list below.
 */
const WATCHED = new Set(['yes', 'true', '1', '✓', 'watched']);

/**
 * The cell values that say a film has not been watched, case folded: the
 * spelled no-words and the **Sheet writer**'s other two. A value on neither
 * list reads as not watched too, and is an **Unread cell**.
 */
const UNWATCHED = new Set(['no', 'false', '0', 'unwatched', 'in progress']);

/** The cell values that say a title is a favourite, case folded. */
const FAVORITE = new Set(['yes', 'true', '1', '✓', 'favorite']);

/** The cell values that say a title is not a favourite, case folded. */
const NOT_FAVORITE = new Set(['no', 'false', '0']);

/** The row types that name a title, and so are skipped without one. */
const TITLED: ReadonlySet<RowType> = new Set<RowType>(['Movie', 'Series']);

/**
 * A **Path cell** as the file it names: the cell, relative with forward
 * slashes as the sheet spells it, joined to its **Library folder** `base`.
 */
export const resolvePathCell = (base: string, cell: string): string =>
  join(base, ...cell.split('/'));

/** The path cells the reader checks, each with its header and the kind of file it may name. */
const CHECKED_PATHS = {
  poster: { header: 'Poster', isKind: isImageFilename },
  backdrop: { header: 'Backdrop', isKind: isImageFilename },
  still: { header: 'Still', isKind: isImageFilename },
  subtitles: { header: 'Subtitles', isKind: isSubtitleFilename },
} as const satisfies Record<
  string,
  { header: SheetColumn; isKind: (filename: string) => boolean }
>;

/**
 * Whether a path cell stays inside its row's **Title folder**, checked
 * lexically: its first segment the row's **Folder key** (by `sameFolderKey`,
 * so another Excel's casing still reads), no segment empty, `.` or `..`,
 * none holding a backslash or a colon, and the file naming its column's kind.
 */
function isContained(
  cell: string,
  folder: string,
  isKind: (filename: string) => boolean
): boolean {
  const segments = cell.split('/');
  return (
    segments.length > 1 &&
    sameFolderKey(segments[0], folder) &&
    segments.every(
      (segment) =>
        segment !== '' &&
        segment !== '.' &&
        segment !== '..' &&
        !segment.includes('\\') &&
        !segment.includes(':')
    ) &&
    isKind(segments[segments.length - 1])
  );
}

/**
 * Whether a row names a title, a Movie or a Series row, and so a **Title
 * folder**; a Season or Episode row is read with the series it names.
 */
export const isTitleRow = (row: SheetRow): boolean => TITLED.has(row.type);

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
 * `19x5`, nothing at all. A decimal comma reads as a decimal point, as a
 * European Excel spells `8,5`.
 */
function cellNumber(text: string): number | null {
  if (text === '' || !/^-?\d+([.,]\d+)?$/.test(text)) {
    return null;
  }
  return Number(text.replace(',', '.'));
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
function cellList(text: string, separators: RegExp | string): string[] {
  return text
    .split(separators)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');
}

/** A whole number in a cell, or `null`. */
function cellWhole(text: string): number | null {
  const value = cellNumber(text);
  return value === null || !Number.isInteger(value) ? null : value;
}

/** A cell's **Row type**, case folded, or `null` for one that names none. */
function cellType(text: string): RowType | null {
  const folded = text.toLowerCase();
  return ROW_TYPES.find((type) => type.toLowerCase() === folded) ?? null;
}

/** A date cell as `YYYY-MM-DD`, or `null` for anything not shaped as one. */
function cellDate(text: string): string | null {
  const found = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return found === null ? null : found[1];
}

/** A **Folder key** spelled from a title and its first year: `Title (Year)`. */
const spelledKey = (title: string, year: number | null): string =>
  year === null ? title : spellFolderKey(title, year);

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
    // that shape is text parsed here. The bytes are decoded by their
    // **Sheet dialect**, the decoder dropping a BOM, so a sheet a European
    // Excel resaved, `;`-separated and cp1252, reads whole.
    const dialect = sheetDialect(bytes);
    const text = new TextDecoder(dialect.encoding).decode(bytes);
    await workbook.csv.read(Readable.from([text]), {
      map: (value: string) => value,
      parserOptions: { delimiter: dialect.separator },
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
 * ignored.
 *
 * A csv is decoded by its **Sheet dialect** (`sheetDialect`: UTF-8 or
 * cp1252, `,` or `;`); an xlsx opens as it is. A number cell takes a decimal
 * comma in any sheet, so `8,5` reads as 8.5.
 *
 * Three things are passed over, each a {@link SheetSkip} told to `onSkip`: a
 * Movie or Series row with a blank title; an **Unread cell**, read as blank;
 * and a row repeating an earlier one's type, **Folder key**, season and
 * episode, the first row read. A path cell reads only when it is contained,
 * under **Path cells**' rule; `Video` is read unchecked.
 */
export async function readSheet(
  bytes: Buffer,
  filename: string,
  onSkip: (skip: SheetSkip) => void = () => undefined
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
      'The spreadsheet has no title column (a Title, Name, Movie or Film header).'
    );
  }

  /** The text of one row's cell under a known column — empty when the sheet has no such column. */
  const read = (row: ExcelJS.Row, column: Column): string => {
    const number = columns.get(column);
    return number === undefined ? '' : cellText(row.getCell(number).value);
  };

  const rows: SheetRow[] = [];
  /** Each read row's type, Folder key (case folded, as `sameFolderKey` compares), season and episode. */
  const seen = new Set<string>();
  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    if (number === 1) {
      return;
    }
    const typeText = read(row, 'type');
    // A blank or unknown Type reads as a Movie; an unknown one is reported.
    const type = cellType(typeText) ?? 'Movie';
    const title = read(row, 'title');
    if (title === '' && TITLED.has(type)) {
      onSkip({ kind: 'blank-title', rowNumber: number });
      return;
    }
    const yearText = read(row, 'year');
    const span = yearSpan(yearText) ?? { year: null, endYear: null };
    const folder = read(row, 'folder') || spelledKey(title, span.year);
    const seasonText = read(row, 'season');
    const season = cellWhole(seasonText);
    const episodeText = read(row, 'episode');
    const episode = cellWhole(episodeText);
    /** The row as a skip names it: a Season by its season, an Episode by its tag. */
    const label =
      type === 'Season' && season !== null
        ? `${folder} Season ${season}`
        : type === 'Episode' && season !== null && episode !== null
          ? `${folder} ${spellEpisodeTag(season, episode)}`
          : folder;
    // The first of two rows naming one row is read; each repeat is reported.
    const key = JSON.stringify([type, folder.toLowerCase(), season, episode]);
    if (seen.has(key)) {
      onSkip({ kind: 'duplicate', label });
      return;
    }
    seen.add(key);

    /** The paths in a checked cell that stay in the Title folder; each other one is reported. */
    const contained = (
      column: keyof typeof CHECKED_PATHS,
      paths: string[]
    ): string[] => {
      const { header, isKind } = CHECKED_PATHS[column];
      return paths.filter((text) => {
        if (isContained(text, folder, isKind)) {
          return true;
        }
        onSkip({ kind: 'unread-cell', label, column: header, text });
        return false;
      });
    };
    /** A single checked path cell, or `null` for a blank or uncontained one. */
    const containedOne = (
      column: 'poster' | 'backdrop' | 'still'
    ): string | null => {
      const text = read(row, column);
      return text === '' ? null : (contained(column, [text])[0] ?? null);
    };

    /** Report a filled cell the reader can't take, under its writer's header. */
    const unread = (header: SheetColumn, text: string): void => {
      onSkip({ kind: 'unread-cell', label, column: header, text });
    };
    /** A cell parsed by `parse`; a filled one that doesn't parse is reported. */
    const parsed = <T>(
      column: Column,
      header: SheetColumn,
      parse: (text: string) => T | null
    ): T | null => {
      const text = read(row, column);
      const value = parse(text);
      if (value === null && text !== '') {
        unread(header, text);
      }
      return value;
    };
    /** A yes/no cell by its two lists; a value on neither is reported, read as no. */
    const flag = (
      column: Column,
      header: SheetColumn,
      yes: ReadonlySet<string>,
      no: ReadonlySet<string>
    ): boolean => {
      const text = read(row, column);
      const folded = text.toLowerCase();
      if (text !== '' && !yes.has(folded) && !no.has(folded)) {
        unread(header, text);
      }
      return yes.has(folded);
    };

    if (typeText !== '' && cellType(typeText) === null) {
      unread('Type', typeText);
    }
    if (yearText !== '' && span.year === null) {
      unread('Year', yearText);
    }
    if (seasonText !== '' && season === null) {
      unread('Season', seasonText);
    }
    if (episodeText !== '' && episode === null) {
      unread('Episode', episodeText);
    }
    // A synopsis is not an episode's field: an Episode row's is reported.
    const synopsisText = read(row, 'synopsis');
    if (type === 'Episode' && synopsisText !== '') {
      unread('Synopsis', synopsisText);
    }

    rows.push({
      type,
      folder,
      season,
      episode,
      title,
      ...span,
      genres: cellList(read(row, 'genres'), GENRE_SEPARATORS),
      director: cellOptional(read(row, 'director')),
      cast: cellList(read(row, 'cast'), CAST_SEPARATORS),
      synopsis: type === 'Episode' ? null : cellOptional(synopsisText),
      rating: parsed('rating', 'Rating', cellRating),
      watched: flag('watched', 'Status', WATCHED, UNWATCHED),
      airDate: parsed('airDate', 'Air date', cellDate),
      runtime: parsed('runtime', 'Runtime', cellWhole),
      tmdbScore: parsed('tmdbScore', 'TMDB rating', cellNumber),
      tmdbId: parsed('tmdbId', 'TMDB id', cellWhole),
      favorite: flag('favorite', 'Favorite', FAVORITE, NOT_FAVORITE),
      video: cellOptional(read(row, 'video')),
      subtitles: contained(
        'subtitles',
        cellList(read(row, 'subtitles'), SHEET_PATH_SEPARATOR)
      ),
      poster: containedOne('poster'),
      backdrop: containedOne('backdrop'),
      still: containedOne('still'),
    });
  });

  return rows;
}
