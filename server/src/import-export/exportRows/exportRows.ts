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

/** A cell's value: text or a number, or `null` for an empty cell. */
export type ExportCell = string | number | null;

/** One table of an **Export**: its header row first, then one row per title. */
export type ExportTable = ExportCell[][];

/** The tables an **Export** is written from. */
export interface ExportTables {
  /** The Titles table: the sixteen {@link EXPORT_COLUMNS}, then every title A–Z. */
  titles: ExportTable;
  /**
   * The Episodes table: the nine {@link EXPORT_EPISODE_COLUMNS}, then every
   * episode by series A–Z, then season, then number.
   */
  episodes: ExportTable;
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

/** The languages of a title's tracks, in track order. */
const languagesOf = (subtitles: readonly Subtitle[]): string =>
  [...subtitles]
    .sort((a, b) => a.position - b.position)
    .map((subtitle) => subtitle.language)
    .join(CELL_SEPARATOR);

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
  Subtitles: (movie) => languagesOf(movie.subtitles),
  Poster: () => null,
  Backdrop: () => null,
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
  (detail: SeriesDetail, episodes: readonly Episode[]) => ExportCell
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
  Poster: () => null,
  Backdrop: () => null,
};

/** The episode cell rules, one per Episodes column; Still blank until Images travels. */
const EPISODE_CELLS: Record<
  ExportEpisodeColumn,
  (episode: Episode, seriesTitle: string) => ExportCell
> = {
  Series: (_, seriesTitle) => seriesTitle,
  Season: (episode) => episode.season,
  Episode: (episode) => episode.number,
  Title: (episode) => episode.title,
  'Air date': (episode) => episode.airDate,
  Runtime: (episode) => episode.runtimeMinutes,
  Status: (episode) => STATUS_CELL[episode.status],
  Subtitles: (episode) => languagesOf(episode.subtitles),
  Still: () => null,
};

/** Title order, A–Z, without regard to case. */
const byTitle = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

/**
 * The library in, the tables an **Export** is written from out — pure, and
 * the one place every cell rule is spelled. The Titles table is the sixteen
 * columns, then every film and series A–Z by title, every column written
 * whatever the options; the Episodes table is the nine columns, then every
 * episode by series A–Z, then season, then number.
 *
 * `include` is the seam the images and subtitles phases fill.
 */
export function exportRows(
  movies: readonly Movie[],
  series: readonly SeriesDetail[],
  include: ExportInclude
): { tables: ExportTables } {
  void include;
  const titled: { title: string; row: ExportCell[] }[] = [
    ...movies.map((movie) => ({
      title: movie.title,
      row: EXPORT_COLUMNS.map((column) => FILM_CELLS[column](movie)),
    })),
    ...series.map((detail) => {
      const episodes = episodesOf(detail);
      return {
        title: detail.series.title,
        row: EXPORT_COLUMNS.map((column) =>
          SERIES_CELLS[column](detail, episodes)
        ),
      };
    }),
  ].sort((a, b) => byTitle(a.title, b.title));

  const episodeRows = [...series]
    .sort((a, b) => byTitle(a.series.title, b.series.title))
    .flatMap((detail) =>
      episodesOf(detail).map((episode) =>
        EXPORT_EPISODE_COLUMNS.map((column) =>
          EPISODE_CELLS[column](episode, detail.series.title)
        )
      )
    );

  return {
    tables: {
      titles: [[...EXPORT_COLUMNS], ...titled.map(({ row }) => row)],
      episodes: [[...EXPORT_EPISODE_COLUMNS], ...episodeRows],
    },
  };
}
