import {
  EXPORT_COLUMNS,
  type ExportColumn,
  type Movie,
  type Series,
  type StartExport,
  type WatchStatus,
} from '@/types';

/** A cell's value: text or a number, or `null` for an empty cell. */
export type ExportCell = string | number | null;

/** One table of an **Export**: its header row first, then one row per title. */
export type ExportTable = ExportCell[][];

/** The tables an **Export** is written from. */
export interface ExportTables {
  /** The Titles table: the sixteen {@link EXPORT_COLUMNS}, then every title A–Z. */
  titles: ExportTable;
}

/** What travels beside the sheet — the two toggles of _Include_. */
export type ExportInclude = Pick<StartExport, 'images' | 'subtitles'>;

/** What separates one genre, name or language from the next inside a cell. */
const CELL_SEPARATOR = ', ';

/** The word the Status column carries for each derived watch state. */
const STATUS_CELL: Record<WatchStatus, string> = {
  watched: 'Watched',
  'in-progress': 'In progress',
  unwatched: 'Unwatched',
};

/**
 * The film cell rules, one per **Export column** — the only place in the app
 * that knows what a film looks like as a row. Type `Movie`; Title as stored;
 * Year, Runtime (minutes) and Rating the stored number or empty; Genres and
 * Cast joined in stored order; Director and Synopsis or empty; Status the
 * derived state's word; Favorite `Yes` or empty; Seasons and Episodes empty, a
 * film having neither; Subtitles the languages in track order; Poster and
 * Backdrop empty until Images travels. No video path, ever.
 */
const FILM_CELLS: Record<ExportColumn, (movie: Movie) => ExportCell> = {
  Type: () => 'Movie',
  Title: (movie) => movie.title,
  Year: (movie) => movie.year,
  Runtime: (movie) => movie.runtimeMinutes,
  Genres: (movie) =>
    movie.genres.map((genre) => genre.name).join(CELL_SEPARATOR),
  Director: (movie) => movie.director,
  Cast: (movie) => movie.cast.join(CELL_SEPARATOR),
  Synopsis: (movie) => movie.synopsis,
  Rating: (movie) => movie.rating,
  Status: (movie) => STATUS_CELL[movie.status],
  Favorite: (movie) => (movie.isFavorite ? 'Yes' : null),
  Seasons: () => null,
  Episodes: () => null,
  Subtitles: (movie) =>
    [...movie.subtitles]
      .sort((a, b) => a.position - b.position)
      .map((subtitle) => subtitle.language)
      .join(CELL_SEPARATOR),
  Poster: () => null,
  Backdrop: () => null,
};

/** Title order, A–Z, without regard to case. */
const byTitle = (a: Movie, b: Movie): number =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

/**
 * The library in, the tables an **Export** is written from out — pure, and
 * the one place every cell rule is spelled. The Titles table is the sixteen
 * columns, then every film A–Z, every column written whatever the options.
 *
 * Phase 1 writes films alone; `series` and `include` are the seams the
 * initiative's later phases fill.
 */
export function exportRows(
  movies: readonly Movie[],
  series: readonly Series[],
  include: ExportInclude
): { tables: ExportTables } {
  void series;
  void include;
  const rows = [...movies]
    .sort(byTitle)
    .map((movie) => EXPORT_COLUMNS.map((column) => FILM_CELLS[column](movie)));
  return { tables: { titles: [[...EXPORT_COLUMNS], ...rows] } };
}
