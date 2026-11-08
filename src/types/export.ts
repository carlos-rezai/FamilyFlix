/**
 * The **Export** contracts both build targets read: the two **Export
 * formats** the dialog offers and the route answers, the **Row types** and
 * **Sheet columns** of the one sheet, the **Export name**'s prefix, the **Export
 * summary** `GET /api/export` answers and the `POST`'s request and result.
 * See `docs/PRDs/14-export.md` and `docs/PRDs/31-export-options.md`.
 */

/**
 * The formats an export can be asked for — the wire's own names, which are
 * also the route's last segment and the file's extension. An `as const` list
 * its union is derived from, on `MOVIE_SORTS`' precedent, so the names a
 * format can have and the names a format can be checked against are one
 * declaration.
 */
export const EXPORT_FORMATS = ['csv', 'xlsx'] as const;

/** One of the formats in {@link EXPORT_FORMATS}, and never anything else. */
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

/**
 * The four **Row types** of the one sheet, in the order a title's rows run:
 * a film's one row, or a series' row, then each season's, then its episodes'.
 */
export const ROW_TYPES = ['Movie', 'Series', 'Season', 'Episode'] as const;

/** One of the types in {@link ROW_TYPES}. */
export type RowType = (typeof ROW_TYPES)[number];

/**
 * The twenty-two **Sheet columns** of the one sheet, in order: every row type
 * in one table, a cell blank where its type has no such field (log 58, Q13).
 * Spelled once, for the header row `exportRows` puts first and the pills the
 * dialog lists under _Columns included_.
 */
export const SHEET_COLUMNS = [
  'Type',
  'Folder',
  'Season',
  'Episode',
  'Title',
  'Year',
  'Air date',
  'Runtime',
  'Genres',
  'Director',
  'Cast',
  'Synopsis',
  'Rating',
  'TMDB rating',
  'TMDB id',
  'Status',
  'Favorite',
  'Video',
  'Subtitles',
  'Poster',
  'Backdrop',
  'Still',
] as const;

/** One of the columns in {@link SHEET_COLUMNS}. */
export type SheetColumn = (typeof SHEET_COLUMNS)[number];

/** What every **Export name** begins with, ahead of `_DD-MM-YYYY`. */
export const EXPORT_NAME_PREFIX = 'familyflix-collection';

/**
 * What `GET /api/export` answers: how many titles an export would carry, where
 * _Save to_ starts, and today's **Export name**.
 */
export interface ExportSummary {
  movieCount: number;
  seriesCount: number;
  episodeCount: number;
  /**
   * The first **Library folder**, in the order added, that can be read now;
   * `<home>\Downloads` with none.
   */
  defaultDestination: string;
  /**
   * Today's **Export name** — the folder an export made now would be called.
   */
  defaultName: string;
}

/**
 * The fields an Export refusal can name — the dialog draws its sentence under
 * the one it names. `IMPORT_FIELDS`' precedent: an `as const` list its union
 * is derived from.
 */
export const EXPORT_FIELDS = ['destination', 'name'] as const;

/** One of the fields in {@link EXPORT_FIELDS}. */
export type ExportField = (typeof EXPORT_FIELDS)[number];

/** What `POST /api/export` is sent: the format, where to, and what travels. */
export interface StartExport {
  format: ExportFormat;
  /** The absolute folder the **Export folder** is made inside. */
  destination: string;
  /**
   * The **Export name** as typed — the folder and its sheet are called this,
   * numbered when taken. Never trimmed.
   */
  name: string;
  /** Whether posters and backdrops travel beside the sheet. */
  images: boolean;
  /** Whether subtitle files travel beside the sheet. */
  subtitles: boolean;
}

/**
 * What `POST /api/export` answers with a `201`: the folder it wrote, and its
 * counts.
 */
export interface ExportResult {
  /** The **Export folder** actually made — numbered if the name was taken. */
  folder: string;
  movieCount: number;
  seriesCount: number;
}
