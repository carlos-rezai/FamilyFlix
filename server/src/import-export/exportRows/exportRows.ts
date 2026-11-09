import {
  SHEET_COLUMNS,
  type Episode,
  type Movie,
  type SeasonSummary,
  type SeriesDetail,
  type SheetColumn,
  type StartExport,
  type Subtitle,
  type WatchStatus,
} from '@/types';
import { spellYearSpan } from '../../library/series/yearSpan/yearSpan';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';
import { spellFolderKey } from '../../media/folderKeyOf/folderKeyOf';
import {
  IMAGES_FOLDER,
  spellTrackName,
  STILLS_FOLDER,
  SUBTITLES_FOLDER,
} from '../../media/folderLayout/folderLayout';
import { spellSeasonFolder } from '../../media/seasonNumberOf/seasonNumberOf';
import { FORBIDDEN_IN_NAME } from '../exportName/exportName';

/** A cell's value: text or a number, or `null` for an empty cell. */
export type ExportCell = string | number | null;

/** The one sheet of an **Export**: its header row first, then one row each. */
export type ExportTable = ExportCell[][];

/**
 * One file of the **File plan**: a **Stored path**, and the relative,
 * forward-slash path it is written to inside the **Export folder**.
 */
export interface ExportFile {
  storedPath: string;
  path: string;
}

/** What travels beside the sheet: the two toggles of _Include_. */
export type ExportInclude = Pick<StartExport, 'images' | 'subtitles'>;

/** What `exportRows` answers: the one table, its File plan, its Warning lines. */
export interface ExportRows {
  table: ExportTable;
  files: ExportFile[];
  warnings: string[];
}

/** What separates one genre or name from the next inside a cell. */
const CELL_SEPARATOR = ', ';

/** What separates one path from the next inside a path cell. */
const PATH_SEPARATOR = '|';

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
const safeName = (name: string): string =>
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
const basenameOf = (storedPath: string): string =>
  storedPath.slice(storedPath.lastIndexOf('/') + 1);

/** A stored file's own extension, its dot included; `''` for none. */
function extensionOf(storedPath: string): string {
  const name = basenameOf(storedPath);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}

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
  paths.length === 0 ? null : paths.join(PATH_SEPARATOR);

/** A title before it has a folder: its Folder key and how its rows are made. */
interface Planned {
  key: string;
  rows: (folder: string, plan: Planner) => ExportCell[][];
}

/**
 * Plans files into the **Export folder**: each call adds one stored file to
 * the File plan under its layout place and answers that path, or `null` when
 * nothing travels (no stored file, or its toggle off).
 */
interface Planner {
  image: (
    storedPath: string | null,
    dir: string,
    name: string
  ) => string | null;
  /** A title's or an episode's tracks, in track order, numbered per language. */
  tracks: (subtitles: readonly Subtitle[], dir: string) => string[];
}

/** A title's tracks in track order. */
const inTrackOrder = (subtitles: readonly Subtitle[]): Subtitle[] =>
  [...subtitles].sort((a, b) => a.position - b.position);

function plannerFor(include: ExportInclude, files: ExportFile[]): Planner {
  const add = (storedPath: string, path: string): string => {
    files.push({ storedPath, path });
    return path;
  };
  return {
    image: (storedPath, dir, name) =>
      include.images && storedPath !== null
        ? add(storedPath, `${dir}/${name}${extensionOf(storedPath)}`)
        : null,
    tracks: (subtitles, dir) => {
      if (!include.subtitles) {
        return [];
      }
      const seen = new Map<string, number>();
      return inTrackOrder(subtitles).map((subtitle) => {
        const language = safeName(subtitle.language);
        const count = (seen.get(language.toLowerCase()) ?? 0) + 1;
        seen.set(language.toLowerCase(), count);
        const name = spellTrackName(language, count);
        return add(
          subtitle.path,
          `${dir}/${name}${extensionOf(subtitle.path)}`
        );
      });
    },
  };
}

/** A film's one row, its files planned under its Title folder. */
const movieRows =
  (movie: Movie) =>
  (folder: string, plan: Planner): ExportCell[][] => [
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
      Video: movie.videoPath
        ? `${folder}/${basenameOf(movie.videoPath)}`
        : null,
      Subtitles: pathCell(
        plan.tracks(movie.subtitles, `${folder}/${SUBTITLES_FOLDER}`)
      ),
      Poster: plan.image(
        movie.posterPath,
        `${folder}/${IMAGES_FOLDER}`,
        'poster'
      ),
      Backdrop: plan.image(
        movie.backdropPath,
        `${folder}/${IMAGES_FOLDER}`,
        'backdrop'
      ),
    }),
  ];

/** An episode's row, its files planned under its Season folder. */
function episodeRow(
  episode: Episode,
  folder: string,
  plan: Planner
): ExportCell[] {
  const season = `${folder}/${spellSeasonFolder(episode.season)}`;
  const tag = spellEpisodeTag(episode.season, episode.number);
  return rowOf({
    Type: 'Episode',
    Folder: folder,
    Season: episode.season,
    Episode: episode.number,
    Title: episode.title,
    'Air date': episode.airDate,
    Runtime: episode.runtimeMinutes,
    Status: STATUS_CELL[episode.status],
    Video: episode.videoPath
      ? `${season}/${basenameOf(episode.videoPath)}`
      : null,
    Subtitles: pathCell(
      plan.tracks(episode.subtitles, `${season}/${SUBTITLES_FOLDER}/${tag}`)
    ),
    Still: plan.image(
      episode.stillPath,
      `${season}/${IMAGES_FOLDER}/${STILLS_FOLDER}`,
      tag
    ),
  });
}

/** A season's row, then its episodes' by number. */
const seasonRows = (
  season: SeasonSummary,
  folder: string,
  plan: Planner
): ExportCell[][] => [
  rowOf({
    Type: 'Season',
    Folder: folder,
    Season: season.number,
    Poster: plan.image(
      season.posterPath,
      `${folder}/${spellSeasonFolder(season.number)}/${IMAGES_FOLDER}`,
      'poster'
    ),
  }),
  ...[...season.episodes]
    .sort((a, b) => a.number - b.number)
    .map((episode) => episodeRow(episode, folder, plan)),
];

/** A series' row, then each season's rows by number. */
const seriesRows =
  ({ series, seasons }: SeriesDetail) =>
  (folder: string, plan: Planner): ExportCell[][] => [
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
      Poster: plan.image(
        series.posterPath,
        `${folder}/${IMAGES_FOLDER}`,
        'poster'
      ),
      Backdrop: plan.image(
        series.backdropPath,
        `${folder}/${IMAGES_FOLDER}`,
        'backdrop'
      ),
    }),
    ...[...seasons]
      .sort((a, b) => a.number - b.number)
      .flatMap((season) => seasonRows(season, folder, plan)),
  ];

/** Folder-key order, A to Z, without regard to case. */
const byKey = (a: Planned, b: Planned): number =>
  a.key.localeCompare(b.key, undefined, { sensitivity: 'base' });

/**
 * The library in, the one sheet of an **Export** and its **File plan** out:
 * pure, and the one place every cell rule is spelled. The table is the
 * **Sheet columns** header ({@link SHEET_COLUMNS}), then a Movie row per film and, per series, a
 * Series row, each season's Season row and its Episode rows, A to Z by
 * **Folder key**, then season, then number. A cell is blank where its type
 * has no such field; resume positions, the Details state, the Still source
 * and Import mode are never written.
 *
 * The File plan is the **Folder layout** less the videos (log 58, Q19): art
 * under each **Title folder**'s or Season folder's `Images/`, Stills (Frame stills too)
 * under `Season NN/Images/Stills/` by **Episode tag**, a film's tracks under
 * `Subtitles/` by language and an episode's under `Season NN/Subtitles/<tag>/`,
 * a second of one language `(2)`. The path cells carry those same paths,
 * blank when nothing travels; `Video` names where the video goes, though no
 * video is planned. Two titles sharing a Folder key are numbered `(1)`,
 * `(2)`, … in sheet order, each with a Warning line. `sourceFolderOf`, the
 * **Library sheet**'s, names a title's Folder key by its **Source folder**
 * instead of spelling it from its title and year.
 */
export function exportRows(
  movies: readonly Movie[],
  series: readonly SeriesDetail[],
  include: ExportInclude,
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

  const files: ExportFile[] = [];
  const warnings: string[] = [];
  const plan = plannerFor(include, files);
  const taken = new Set<string>();
  const body = planned.flatMap((title) => {
    const folder = claimFolder(title.key, taken);
    if (folder !== title.key) {
      warnings.push(
        `⚠ Two titles share the folder ${title.key}: one is exported as ${folder}`
      );
    }
    return title.rows(folder, plan);
  });

  return { table: [[...SHEET_COLUMNS], ...body], files, warnings };
}
