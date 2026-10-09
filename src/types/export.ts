/**
 * The **Export** contracts both build targets read: the two **Export
 * formats** the dialog offers and the route answers, the sixteen **Export
 * columns** of the Titles table, the **Export name**'s prefix, the **Export
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
 * The sixteen columns of an **Export**'s Titles table, in the PRD's order —
 * spelled once, for the header row `exportRows` puts first and the pills the
 * dialog lists under _Columns included_. Log 14's eight keep their relative
 * order and their cell rules.
 */
export const EXPORT_COLUMNS = [
  'Type',
  'Title',
  'Year',
  'Runtime',
  'Genres',
  'Director',
  'Cast',
  'Synopsis',
  'Rating',
  'Status',
  'Favorite',
  'Seasons',
  'Episodes',
  'Subtitles',
  'Poster',
  'Backdrop',
] as const;

/** One of the columns in {@link EXPORT_COLUMNS}. */
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

/** What every **Export name** begins with, ahead of `_DD-MM-YYYY`. */
export const EXPORT_NAME_PREFIX = 'familyflix-collection';

/** The name the **Export file** lands under, per format. */
export const EXPORT_FILENAME: Record<ExportFormat, string> = {
  csv: 'family-library.csv',
  xlsx: 'family-library.xlsx',
};

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
  /** Today's **Export name** — the folder an export made now would be called. */
  folderName: string;
}

/** What `POST /api/export` is sent: the format, where to, and what travels. */
export interface StartExport {
  format: ExportFormat;
  /** The absolute folder the **Export folder** is made inside. */
  destination: string;
  /** Whether posters and backdrops travel beside the sheet. */
  images: boolean;
  /** Whether subtitle files travel beside the sheet. */
  subtitles: boolean;
}

/** What `POST /api/export` answers with a `201`: the folder it wrote, and its counts. */
export interface ExportResult {
  /** The **Export folder** actually made — numbered if the name was taken. */
  folder: string;
  movieCount: number;
  seriesCount: number;
}
