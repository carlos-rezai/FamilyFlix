import {
  SHEET_COLUMNS,
  SHEET_PATH_SEPARATOR,
  type Episode,
  type Movie,
  type SeasonSummary,
  type SeriesDetail,
  type SheetColumn,
  type Subtitle,
  type WatchStatus,
} from '@/types';
import { spellYearSpan } from '../../library/series/yearSpan/yearSpan';
import { spellFolderKey } from '../../media/folderKeyOf/folderKeyOf';
import { spellSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';
import { FORBIDDEN_IN_NAME } from '../exportName/exportName';

/** A cell's value: text or a number, or `null` for an empty cell. */
export type ExportCell = string | number | null;

/** The one sheet of an **Export**: its header row first, then one row each. */
export type ExportTable = ExportCell[][];

/** What `exportRows` answers: the one table and its Warning lines. */
export interface ExportRows {
  table: ExportTable;
  warnings: string[];
}

/** A title's or a season's image place, or an episode's Still. */
export type ImagePlace =
  | { kind: 'poster' | 'backdrop'; folder: string }
  | { kind: 'season-poster'; folder: string; season: number }
  | { kind: 'still'; folder: string; season: number; episode: number };

/** A film's tracks (no season), or an episode's. */
export interface TracksPlace {
  kind: 'tracks';
  folder: string;
  season?: number;
  episode?: number;
}

/** A film's video (no season), or an episode's, with its **Source file**. */
export interface VideoPlace {
  kind: 'video';
  folder: string;
  season?: number;
  sourceFile?: string | null;
}

/** Where a video place's video lies: an episode's Source file as it lies. */
function videoPath(place: VideoPlace, storedPath: string): string {
  if (place.season === undefined) {
    return `${place.folder}/${basenameOf(storedPath)}`;
  }
  return place.sourceFile
    ? `${place.folder}/${place.sourceFile}`
    : `${place.folder}/${spellSeasonFolder(place.season)}/${basenameOf(storedPath)}`;
}

/**
 * A Video cell: where the video lies, blank for none stored. Both **Path
 * cells** answer it alike.
 */
export const videoCell = (
  place: VideoPlace,
  storedPath: string | null
): string | null => (storedPath ? videoPath(place, storedPath) : null);

/**
 * A **Layout place**: where in its **Title folder** a path cell's file
 * belongs, named by what it is, not by a spelled path.
 */
export type LayoutPlace = ImagePlace | TracksPlace | VideoPlace;

/**
 * The **Path cells**: what each path cell holds, answered by place. The
 * Export's is its **File plan**; `null` or none is a blank cell.
 */
export interface PathCells {
  image: (place: ImagePlace, storedPath: string | null) => string | null;
  tracks: (place: TracksPlace, subtitles: readonly Subtitle[]) => string[];
  video: (place: VideoPlace, storedPath: string | null) => string | null;
}

/** What separates one genre or name from the next inside a cell. */
const CELL_SEPARATOR = ', ';

/** The word the Status column carries for each derived watch state. */
const STATUS_CELL: Record<WatchStatus, string> = {
  watched: 'Watched',
  'in-progress': 'In progress',
  unwatched: 'Unwatched',
};

/**
 * What Windows refuses in a folder name, every occurrence: a global copy of
 * `exportName`'s {@link FORBIDDEN_IN_NAME}, the one spelling, made here so no
 * `lastIndex` is shared with the check that refuses a typed name.
 */
const UNSAFE_IN_NAME = new RegExp(FORBIDDEN_IN_NAME.source, 'g');

/** What a title whose name leaves nothing usable is filed under instead. */
const FALLBACK_FOLDER = 'Untitled';

/** A name with anything a filename cannot hold taken out. */
export const safeName = (name: string): string =>
  name.replace(UNSAFE_IN_NAME, '').trim() || FALLBACK_FOLDER;

/**
 * A title's **Folder key** as a folder's name, `Heat (1995)`, a series keyed
 * by its first year; the title alone with no year. Through {@link safeName},
 * and with no trailing dot or space, which Windows drops from a folder's name.
 */
function folderKeyName(title: string, year: number | null): string {
  const name = year === null ? title : spellFolderKey(title, year);
  return safeName(safeName(name).replace(/[. ]+$/, ''));
}

/** A stored path's last segment. */
export const basenameOf = (storedPath: string): string =>
  storedPath.slice(storedPath.lastIndexOf('/') + 1);

/**
 * Claim `base` as a Title folder, or the first of `base (1)`, `base (2)`, …
 * not yet taken, compared without regard to case, as Windows compares names.
 */
function claimFolder(base: string, taken: Set<string>): string {
  for (let n = 0; ; n += 1) {
    const name = n === 0 ? base : `${base} (${n})`;
    const key = name.toLowerCase();
    if (!taken.has(key)) {
      taken.add(key);
      return name;
    }
  }
}

/** A row's cells by column; a column left out is a blank cell. */
type RowCells = Partial<Record<SheetColumn, ExportCell>>;

/** A row's cells laid out in {@link SHEET_COLUMNS} order. */
const rowOf = (cells: RowCells): ExportCell[] =>
  SHEET_COLUMNS.map((column) => cells[column] ?? null);

/** A path cell: its paths joined by `|`, blank for none. */
const pathCell = (paths: readonly string[]): string | null =>
  paths.length === 0 ? null : paths.join(SHEET_PATH_SEPARATOR);

/** A title before it has a folder: its Folder key and how its rows are made. */
interface Planned {
  key: string;
  rows: (folder: string, cells: PathCells) => ExportCell[][];
}

/** A film's one row, its path cells asked of `cells` by place. */
const movieRows =
  (movie: Movie) =>
  (folder: string, cells: PathCells): ExportCell[][] => [
    rowOf({
      Type: 'Movie',
      Folder: folder,
      Title: movie.title,
      Year: movie.year,
      Runtime: movie.runtimeMinutes,
      Genres: movie.genres.map((genre) => genre.name).join(CELL_SEPARATOR),
      Director: movie.director,
      Cast: movie.cast.join(CELL_SEPARATOR),
      Synopsis: movie.synopsis,
      Rating: movie.rating,
      'TMDB rating': movie.tmdbScore,
      'TMDB id': movie.tmdbId,
      Status: STATUS_CELL[movie.status],
      Favorite: movie.isFavorite ? 'Yes' : null,
      Video: cells.video({ kind: 'video', folder }, movie.videoPath || null),
      Subtitles: pathCell(
        cells.tracks({ kind: 'tracks', folder }, movie.subtitles)
      ),
      Poster: cells.image({ kind: 'poster', folder }, movie.posterPath),
      Backdrop: cells.image({ kind: 'backdrop', folder }, movie.backdropPath),
    }),
  ];

/** An episode's row, its path cells asked of `cells` by place. */
function episodeRow(
  episode: Episode,
  folder: string,
  cells: PathCells
): ExportCell[] {
  const { season, number } = episode;
  return rowOf({
    Type: 'Episode',
    Folder: folder,
    Season: season,
    Episode: number,
    Title: episode.title,
    'Air date': episode.airDate,
    Runtime: episode.runtimeMinutes,
    Status: STATUS_CELL[episode.status],
    Video: cells.video(
      { kind: 'video', folder, season, sourceFile: episode.sourceFile },
      episode.videoPath || null
    ),
    Subtitles: pathCell(
      cells.tracks(
        { kind: 'tracks', folder, season, episode: number },
        episode.subtitles
      )
    ),
    Still: cells.image(
      { kind: 'still', folder, season, episode: number },
      episode.stillPath
    ),
  });
}

/** A season's row, then its episodes' by number. */
const seasonRows = (
  season: SeasonSummary,
  folder: string,
  cells: PathCells
): ExportCell[][] => [
  rowOf({
    Type: 'Season',
    Folder: folder,
    Season: season.number,
    Poster: cells.image(
      { kind: 'season-poster', folder, season: season.number },
      season.posterPath
    ),
  }),
  ...[...season.episodes]
    .sort((a, b) => a.number - b.number)
    .map((episode) => episodeRow(episode, folder, cells)),
];

/** A series' row, then each season's rows by number. */
const seriesRows =
  ({ series, seasons }: SeriesDetail) =>
  (folder: string, cells: PathCells): ExportCell[][] => [
    rowOf({
      Type: 'Series',
      Folder: folder,
      Title: series.title,
      Year: spellYearSpan(series.year, series.endYear),
      Genres: series.genres.map((genre) => genre.name).join(CELL_SEPARATOR),
      Director: series.creator,
      Cast: series.cast.join(CELL_SEPARATOR),
      Synopsis: series.synopsis,
      Rating: series.rating,
      'TMDB rating': series.tmdbScore,
      'TMDB id': series.tmdbId,
      Favorite: series.isFavorite ? 'Yes' : null,
      Poster: cells.image({ kind: 'poster', folder }, series.posterPath),
      Backdrop: cells.image({ kind: 'backdrop', folder }, series.backdropPath),
    }),
    ...[...seasons]
      .sort((a, b) => a.number - b.number)
      .flatMap((season) => seasonRows(season, folder, cells)),
  ];

/** Folder-key order, A to Z, without regard to case. */
const byKey = (a: Planned, b: Planned): number =>
  a.key.localeCompare(b.key, undefined, { sensitivity: 'base' });

/**
 * The library in, the one sheet of an **Export** or a **Library sheet** out:
 * pure, and the one place every cell rule is spelled. The table is the
 * **Sheet columns** header ({@link SHEET_COLUMNS}), then a Movie row per film
 * and, per series, a Series row, each season's Season row and its Episode
 * rows, A to Z by **Folder key**, then season, then number. A cell is blank
 * where its type has no such field; resume positions, the Details state, the
 * Still source and Import mode are never written.
 *
 * Each path cell is what `cells`, the **Path cells**, answers for its
 * **Layout place** (log 59): the Export hands it its **File plan**
 * (`filePlan`), the Library sheet the cells of each Title folder's
 * **Layout read** (`layoutCells`). Two titles sharing a Folder key are numbered `(1)`, `(2)`, …
 * in sheet order, each with a Warning line. `sourceFolderOf`, the **Library
 * sheet**'s, names a title's Folder key by its **Source folder** instead of
 * spelling it from its title and year.
 */
export function exportRows(
  movies: readonly Movie[],
  series: readonly SeriesDetail[],
  cells: PathCells,
  sourceFolderOf: (titleId: string) => string | null = () => null
): ExportRows {
  const planned: Planned[] = [
    ...movies.map(
      (movie): Planned => ({
        key: sourceFolderOf(movie.id) ?? folderKeyName(movie.title, movie.year),
        rows: movieRows(movie),
      })
    ),
    ...series.map(
      (detail): Planned => ({
        key:
          sourceFolderOf(detail.series.id) ??
          folderKeyName(detail.series.title, detail.series.year),
        rows: seriesRows(detail),
      })
    ),
  ].sort(byKey);

  const warnings: string[] = [];
  const taken = new Set<string>();
  const body = planned.flatMap((title) => {
    const folder = claimFolder(title.key, taken);
    if (folder !== title.key) {
      warnings.push(
        `⚠ Two titles share the folder ${title.key}: one is exported as ${folder}`
      );
    }
    return title.rows(folder, cells);
  });

  return { table: [[...SHEET_COLUMNS], ...body], warnings };
}
