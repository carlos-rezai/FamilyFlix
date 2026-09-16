/**
 * The **Export** contracts both build targets read: the two **Export
 * formats** the dialog offers and the route answers, the eight **Export
 * columns** the **Sheet writer** heads its sheet with and the dialog draws as
 * pills, the **Export file**'s name per format, and the **Export summary**
 * `GET /api/export` answers. See `docs/PRDs/14-export.md` and
 * `docs/design-logs/14-export.md`.
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
 * The eight columns an **Export file** carries, in the prototype's order —
 * spelled once, for the header row the writer puts first and the pills the
 * dialog lists under _Columns included_.
 */
export const EXPORT_COLUMNS = [
  'Title',
  'Year',
  'Genres',
  'Director',
  'Cast',
  'Rating',
  'Status',
  'Subtitles',
] as const;

/** One of the columns in {@link EXPORT_COLUMNS}. */
export type ExportColumn = (typeof EXPORT_COLUMNS)[number];

/** The name the **Export file** lands under, per format. */
export const EXPORT_FILENAME: Record<ExportFormat, string> = {
  csv: 'family-library.csv',
  xlsx: 'family-library.xlsx',
};

/** What `GET /api/export` answers: how many movies an export would carry. */
export interface ExportSummary {
  movieCount: number;
}
