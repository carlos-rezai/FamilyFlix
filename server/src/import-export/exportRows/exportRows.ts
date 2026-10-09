import {
  EXPORT_COLUMNS,
  EXPORT_EPISODE_COLUMNS,
  type Episode,
  type ExportColumn,
  type ExportEpisodeColumn,
  type Movie,
  type SeriesDetail,
  type StartExport,
  type Subtitle,
  type WatchStatus,
} from '@/types';
import { spellEpisodeTag } from '../../media/episodeTag/episodeTag';

/** A cell's value: text or a number, or `null` for an empty cell. */
export type ExportCell = string | number | null;

/** One table of an **Export**: its header row first, then one row per title. */
export type ExportTable = ExportCell[][];

/** The tables an **Export** is written from. */
export interface ExportTables {
  /**
   * The Titles table: the sixteen {@link EXPORT_COLUMNS}, then every title
   * A–Z.
   */
  titles: ExportTable;
  /**
   * The Episodes table: the nine {@link EXPORT_EPISODE_COLUMNS}, then every
   * episode by series A–Z, then season, then number.
   */
  episodes: ExportTable;
}

/**
 * One file of the **File plan**: a **Stored path**, and the relative,
 * forward-slash path it is written to inside the **Export folder**.
 */
export interface ExportFile {
  storedPath: string;
  path: string;
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

/** A title's tracks in track order. */
const inTrackOrder = (subtitles: readonly Subtitle[]): Subtitle[] =>
  [...subtitles].sort((a, b) => a.position - b.position);

/** The languages of a title's tracks, in track order. */
const languagesOf = (subtitles: readonly Subtitle[]): string =>
  inTrackOrder(subtitles)
    .map((subtitle) => subtitle.language)
    .join(CELL_SEPARATOR);

/**
 * The film cell rules, one per **Export column** — the only place in the app
 * that knows what a film looks like as a row. Type `Movie`; Title as stored;
 * Year, Runtime (minutes) and Rating the stored number or empty; Genres and
 * Cast joined in stored order; Director and Synopsis or empty; Status the
 * derived state's word; Favorite `Yes` or empty; Seasons and Episodes empty, a
 * film having neither; Subtitles the languages in track order; Poster and
 * Backdrop the planned path, or empty. No video path, ever.
 */
const FILM_CELLS: Record<
  ExportColumn,
  (movie: Movie, art: TitleArt) => ExportCell
> = {
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
  Subtitles: (movie) => languagesOf(movie.subtitles),
  Poster: (_, art) => art.poster,
  Backdrop: (_, art) => art.backdrop,
};

/** Every episode of a series, by season, then number. */
const episodesOf = (detail: SeriesDetail): Episode[] =>
  detail.seasons
    .flatMap((season) => season.episodes)
    .sort((a, b) => a.season - b.season || a.number - b.number);

/**
 * A series' **Year range** as the Sheet reader reads it back: `2022` for a run
 * of one year, `2019–2023` for a finished run, `2021–` for one still open.
 */
function yearRange(year: number | null, endYear: number | null): string | null {
  if (year === null) {
    return null;
  }
  if (endYear === year) {
    return String(year);
  }
  return `${year}–${endYear ?? ''}`;
}

/**
 * A series' Status off its episodes: every one watched is `Watched`; none
 * watched or started is `Unwatched`; anything else is `In progress`.
 */
function seriesStatus(episodes: readonly Episode[]): string {
  if (episodes.length > 0 && episodes.every((episode) => episode.watched)) {
    return STATUS_CELL.watched;
  }
  if (episodes.every((episode) => episode.status === 'unwatched')) {
    return STATUS_CELL.unwatched;
  }
  return STATUS_CELL['in-progress'];
}

/**
 * The series cell rules: Type `Series`; Year its Year range; Runtime blank;
 * the creator under Director; Status off its episodes; its Seasons and
 * Episodes counts; Favorite the series heart; Subtitles blank, the tracks
 * being its episodes'.
 */
const SERIES_CELLS: Record<
  ExportColumn,
  (
    detail: SeriesDetail,
    episodes: readonly Episode[],
    art: TitleArt
  ) => ExportCell
> = {
  Type: () => 'Series',
  Title: ({ series }) => series.title,
  Year: ({ series }) => yearRange(series.year, series.endYear),
  Runtime: () => null,
  Genres: ({ series }) =>
    series.genres.map((genre) => genre.name).join(CELL_SEPARATOR),
  Director: ({ series }) => series.creator,
  Cast: ({ series }) => series.cast.join(CELL_SEPARATOR),
  Synopsis: ({ series }) => series.synopsis,
  Rating: ({ series }) => series.rating,
  Status: (_, episodes) => seriesStatus(episodes),
  Favorite: ({ series }) => (series.isFavorite ? 'Yes' : null),
  Seasons: ({ seasons }) => seasons.length,
  Episodes: (_, episodes) => episodes.length,
  Subtitles: () => null,
  Poster: (_, __, art) => art.poster,
  Backdrop: (_, __, art) => art.backdrop,
};

/**
 * The episode cell rules, one per Episodes column; Still the planned path or
 * blank.
 */
const EPISODE_CELLS: Record<
  ExportEpisodeColumn,
  (episode: Episode, seriesTitle: string, still: string | null) => ExportCell
> = {
  Series: (_, seriesTitle) => seriesTitle,
  Season: (episode) => episode.season,
  Episode: (episode) => episode.number,
  Title: (episode) => episode.title,
  'Air date': (episode) => episode.airDate,
  Runtime: (episode) => episode.runtimeMinutes,
  Status: (episode) => STATUS_CELL[episode.status],
  Subtitles: (episode) => languagesOf(episode.subtitles),
  Still: (_, __, still) => still,
};

/** Title order, A–Z, without regard to case. */
const byTitle = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

/** The planned paths a title's image cells carry — `null` for a blank cell. */
interface TitleArt {
  poster: string | null;
  backdrop: string | null;
}

const NO_ART: TitleArt = { poster: null, backdrop: null };

/**
 * What Windows refuses in a folder name, and the control characters with
 * it.
 */
// eslint-disable-next-line no-control-regex
const UNSAFE_IN_NAME = /[<>:"/\\|?*\u0000-\u001f]/g;

/** What a title whose name leaves nothing usable is filed under instead. */
const FALLBACK_FOLDER = 'Untitled';

/** A name with anything a filename cannot hold taken out. */
const safeName = (name: string): string =>
  name.replace(UNSAFE_IN_NAME, '').trim() || FALLBACK_FOLDER;

/**
 * A title's folder, named as a Movie folder is in the maintainer's own
 * collection — `Heat (1995)`, `Severance (2022–)` — with anything a folder
 * name cannot hold taken out, and no trailing dot or space.
 */
function titleFolderName(title: string, years: string | null): string {
  const name = years === null ? title : `${title} (${years})`;
  const safe = name
    .replace(UNSAFE_IN_NAME, '')
    .replace(/[. ]+$/, '')
    .trim();
  return safe === '' ? FALLBACK_FOLDER : safe;
}

/** A stored file's own extension, its dot included — `''` for none. */
function extensionOf(storedPath: string): string {
  const name = storedPath.slice(storedPath.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot) : '';
}

/**
 * Claim `base` as a title folder, or the first of `base (1)`, `base (2)`, …
 * not yet taken — compared without regard to case, as Windows compares names.
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

/** One title as the plan sees it: its name, its folder's base and its art. */
interface PlannedTitle {
  title: string;
  folderBase: string;
  poster: string | null;
  backdrop: string | null;
  /** Each episode with a still stored. */
  stills: Episode[];
  /**
   * Each subtitle file the title carries, as the name it is planned under
   * inside the title's folder, its extension still to come.
   */
  tracks: { storedPath: string; name: string }[];
  row: (art: TitleArt) => ExportCell[];
}

/**
 * The library in, the tables an **Export** is written from and its **File
 * plan** out — pure, and the one place every cell rule is spelled. The Titles
 * table is the sixteen columns, then every film and series A–Z by title, every
 * column written whatever the options; the Episodes table is the nine columns,
 * then every episode by series A–Z, then season, then number.
 *
 * With Images on, each title holding art gets a folder named as a Movie
 * folder is, numbered `(1)`, `(2)`, … on a clash, in title order: `poster`
 * and `backdrop` with the stored file's own extension, and each still under
 * `stills/` by its **Episode tag**. The Poster, Backdrop and Still cells carry
 * those same paths, and stay blank with Images off or no stored file — so the
 * drawn **Default poster** is never mistaken for a picture.
 *
 * With Subtitles on, each title holding a track gets that folder too: a
 * film's track beside its art, named by its language (`English.srt`), and an
 * episode's under `subtitles/` by its Episode tag and language
 * (`S01E03 English.srt`), each with the stored file's own extension. A video
 * is never planned.
 */
export function exportRows(
  movies: readonly Movie[],
  series: readonly SeriesDetail[],
  include: ExportInclude
): { tables: ExportTables; files: ExportFile[] } {
  const planned: PlannedTitle[] = [
    ...movies.map(
      (movie): PlannedTitle => ({
        title: movie.title,
        folderBase: titleFolderName(
          movie.title,
          movie.year === null ? null : String(movie.year)
        ),
        poster: movie.posterPath,
        backdrop: movie.backdropPath,
        stills: [],
        tracks: inTrackOrder(movie.subtitles).map((subtitle) => ({
          storedPath: subtitle.path,
          name: safeName(subtitle.language),
        })),
        row: (art) =>
          EXPORT_COLUMNS.map((column) => FILM_CELLS[column](movie, art)),
      })
    ),
    ...series.map((detail): PlannedTitle => {
      const episodes = episodesOf(detail);
      return {
        title: detail.series.title,
        folderBase: titleFolderName(
          detail.series.title,
          yearRange(detail.series.year, detail.series.endYear)
        ),
        poster: detail.series.posterPath,
        backdrop: detail.series.backdropPath,
        stills: episodes.filter((episode) => episode.stillPath !== null),
        tracks: episodes.flatMap((episode) =>
          inTrackOrder(episode.subtitles).map((subtitle) => ({
            storedPath: subtitle.path,
            name: `subtitles/${spellEpisodeTag(episode.season, episode.number)} ${safeName(subtitle.language)}`,
          }))
        ),
        row: (art) =>
          EXPORT_COLUMNS.map((column) =>
            SERIES_CELLS[column](detail, episodes, art)
          ),
      };
    }),
  ].sort((a, b) => byTitle(a.title, b.title));

  const files: ExportFile[] = [];
  const stillPaths = new Map<Episode, string>();
  const taken = new Set<string>();

  const titleRows = planned.map((title) => {
    const images =
      include.images &&
      (title.poster !== null ||
        title.backdrop !== null ||
        title.stills.length > 0);
    const subtitles = include.subtitles && title.tracks.length > 0;
    if (!images && !subtitles) {
      return title.row(NO_ART);
    }
    const folder = claimFolder(title.folderBase, taken);
    const plan = (storedPath: string | null, name: string): string | null => {
      if (storedPath === null) {
        return null;
      }
      const path = `${folder}/${name}${extensionOf(storedPath)}`;
      files.push({ storedPath, path });
      return path;
    };
    if (subtitles) {
      for (const track of title.tracks) {
        plan(track.storedPath, track.name);
      }
    }
    if (!images) {
      return title.row(NO_ART);
    }
    const art: TitleArt = {
      poster: plan(title.poster, 'poster'),
      backdrop: plan(title.backdrop, 'backdrop'),
    };
    for (const episode of title.stills) {
      const path = plan(
        episode.stillPath,
        `stills/${spellEpisodeTag(episode.season, episode.number)}`
      );
      if (path !== null) {
        stillPaths.set(episode, path);
      }
    }
    return title.row(art);
  });

  const episodeRows = [...series]
    .sort((a, b) => byTitle(a.series.title, b.series.title))
    .flatMap((detail) =>
      episodesOf(detail).map((episode) =>
        EXPORT_EPISODE_COLUMNS.map((column) =>
          EPISODE_CELLS[column](
            episode,
            detail.series.title,
            stillPaths.get(episode) ?? null
          )
        )
      )
    );

  return {
    tables: {
      titles: [[...EXPORT_COLUMNS], ...titleRows],
      episodes: [[...EXPORT_EPISODE_COLUMNS], ...episodeRows],
    },
    files,
  };
}
