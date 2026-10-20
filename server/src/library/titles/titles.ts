import type { SqliteDatabase } from '../../db';
import type { DetailsState } from '@/types';

/** One linked video as recorded: its Library folder and its path under it. */
export interface LinkedVideo {
  folderId: string;
  videoPath: string;
}

/** What both kinds of stored **Library title** carry, as recorded. */
interface StoredTitleFacts {
  id: string;
  title: string;
  year: number | null;
  details: DetailsState;
  /** The **Library folder** the title was found under, `null` for none. */
  libraryFolderId: string | null;
  /** Its **Source folder**, relative to that Library folder. */
  sourceFolder: string | null;
  /** Its **Media folder**, relative to the Managed media directory. */
  mediaFolder: string | null;
  /** Its linked videos — `[]` for a copied title. */
  linkedVideos: LinkedVideo[];
}

export interface StoredLibraryMovie extends StoredTitleFacts {
  /** A **Collection folder** film's **Source file**, else `null`. */
  sourceFile: string | null;
  /** Its video and its subtitles. */
  files: number;
}

export interface StoredLibrarySeries extends StoredTitleFacts {
  endYear: number | null;
  seasons: number;
  episodes: number;
}

/** The **Manage library page**'s raw facts, each list A–Z by title. */
export interface StoredLibraryTitles {
  movies: StoredLibraryMovie[];
  series: StoredLibrarySeries[];
}

const filled = (column: string) =>
  `(${column} IS NOT NULL AND ${column} <> '')`;

/**
 * The **Details state** as SQL over a `movies` or `series` row under `alias`:
 * `synced` with a `tmdb_id`; `none` with none of year, synopsis, director
 * (a show's creator), cast, original title, poster, backdrop, genres and TMDB
 * score held — a runtime is not a detail; `own` for anything else.
 */
export function detailsStateSql(
  alias: string,
  kind: 'movies' | 'series'
): string {
  const at = `${alias}.`;
  const credit = kind === 'movies' ? 'director' : 'creator';
  const genres =
    kind === 'movies'
      ? `EXISTS (SELECT 1 FROM movie_genres dg WHERE dg.movie_id = ${at}id)`
      : `EXISTS (SELECT 1 FROM series_genres dg WHERE dg.series_id = ${at}id)`;
  const held = [
    `${at}year IS NOT NULL`,
    filled(`${at}synopsis`),
    filled(`${at}${credit}`),
    `(${filled(`${at}cast`)} AND ${at}cast <> '[]')`,
    filled(`${at}original_title`),
    filled(`${at}poster_path`),
    filled(`${at}backdrop_path`),
    genres,
    `${at}tmdb_score IS NOT NULL`,
  ].join(' OR ');
  return `CASE WHEN ${at}tmdb_id IS NOT NULL THEN 'synced'
    WHEN ${held} THEN 'own' ELSE 'none' END`;
}

interface TitleRow {
  id: string;
  title: string;
  year: number | null;
  details: DetailsState;
  library_folder_id: string | null;
  source_folder: string | null;
  media_folder: string | null;
}

interface MovieRow extends TitleRow {
  video_folder_id: string | null;
  video_path: string;
  source_file: string | null;
  files: number;
}

interface SeriesRow extends TitleRow {
  end_year: number | null;
  seasons: number;
  episodes: number;
}

interface LinkedEpisodeRow {
  series_id: string;
  video_folder_id: string;
  video_path: string;
}

export interface Titles {
  /** Every title's raw facts, films and series apart, each A–Z by title. */
  libraryTitles(): StoredLibraryTitles;
  /**
   * **Clear details** on a film, in one transaction: its match, every field a
   * Sync writes but the runtime, its genres and its art emptied. Answers the
   * **Stored paths** let go, or `null` for an id not held as a film.
   */
  clearMovieDetails(id: string): string[] | null;
  /**
   * **Clear details** on a series, in one transaction: the film's columns,
   * the end year, every **Season poster**, and each episode's title, air
   * date, **Still** and **Still source**. Answers the **Stored paths** let
   * go, or `null` for an id not held as a series.
   */
  clearSeriesDetails(id: string): string[] | null;
}

const factsOf = (row: TitleRow, linkedVideos: LinkedVideo[]) => ({
  id: row.id,
  title: row.title,
  year: row.year,
  details: row.details,
  libraryFolderId: row.library_folder_id,
  sourceFolder: row.source_folder,
  mediaFolder: row.media_folder,
  linkedVideos,
});

export function createTitles(db: SqliteDatabase): Titles {
  const selectMovies = db.prepare(
    `SELECT m.id, m.title, m.year, m.library_folder_id, m.source_folder,
       m.source_file, m.media_folder, m.video_folder_id, m.video_path,
       1 + (SELECT COUNT(*) FROM subtitles st WHERE st.movie_id = m.id) AS files,
       ${detailsStateSql('m', 'movies')} AS details
     FROM movies m ORDER BY m.title COLLATE NOCASE, m.id`
  );
  const selectSeries = db.prepare(
    `SELECT s.id, s.title, s.year, s.end_year, s.library_folder_id,
       s.source_folder, s.media_folder,
       (SELECT COUNT(DISTINCT e.season_number) FROM episodes e
         WHERE e.series_id = s.id) AS seasons,
       (SELECT COUNT(*) FROM episodes e WHERE e.series_id = s.id) AS episodes,
       ${detailsStateSql('s', 'series')} AS details
     FROM series s ORDER BY s.title COLLATE NOCASE, s.id`
  );
  const selectLinkedEpisodes = db.prepare(
    `SELECT series_id, video_folder_id, video_path FROM episodes
     WHERE video_folder_id IS NOT NULL
     ORDER BY season_number, episode_number`
  );

  function libraryTitles(): StoredLibraryTitles {
    const linkedEpisodes = new Map<string, LinkedVideo[]>();
    for (const row of selectLinkedEpisodes.all() as LinkedEpisodeRow[]) {
      const videos = linkedEpisodes.get(row.series_id) ?? [];
      videos.push({ folderId: row.video_folder_id, videoPath: row.video_path });
      linkedEpisodes.set(row.series_id, videos);
    }

    const movies = (selectMovies.all() as MovieRow[]).map((row) => ({
      ...factsOf(
        row,
        row.video_folder_id === null
          ? []
          : [{ folderId: row.video_folder_id, videoPath: row.video_path }]
      ),
      sourceFile: row.source_file,
      files: row.files,
    }));
    const series = (selectSeries.all() as SeriesRow[]).map((row) => ({
      ...factsOf(row, linkedEpisodes.get(row.id) ?? []),
      endYear: row.end_year,
      seasons: row.seasons,
      episodes: row.episodes,
    }));
    return { movies, series };
  }

  const movieArt = db.prepare(
    'SELECT poster_path, backdrop_path FROM movies WHERE id = ?'
  );
  const clearMovie = db.prepare(
    `UPDATE movies SET tmdb_id = NULL, year = NULL, synopsis = NULL,
       director = NULL, cast = NULL, original_title = NULL, tmdb_score = NULL,
       poster_path = NULL, backdrop_path = NULL, updated_at = ?
     WHERE id = ?`
  );
  const clearMovieGenres = db.prepare(
    'DELETE FROM movie_genres WHERE movie_id = ?'
  );
  const seriesArt = db.prepare(
    'SELECT poster_path, backdrop_path FROM series WHERE id = ?'
  );
  const seasonPosterPaths = db.prepare(
    'SELECT poster_path FROM season_posters WHERE series_id = ?'
  );
  const stillPaths = db.prepare(
    `SELECT still_path FROM episodes
     WHERE series_id = ? AND still_path IS NOT NULL`
  );
  const clearSeries = db.prepare(
    `UPDATE series SET tmdb_id = NULL, year = NULL, end_year = NULL,
       synopsis = NULL, creator = NULL, cast = NULL, original_title = NULL,
       tmdb_score = NULL, poster_path = NULL, backdrop_path = NULL,
       updated_at = ?
     WHERE id = ?`
  );
  const clearSeriesGenres = db.prepare(
    'DELETE FROM series_genres WHERE series_id = ?'
  );
  const clearSeasonPosters = db.prepare(
    'DELETE FROM season_posters WHERE series_id = ?'
  );
  const clearEpisodes = db.prepare(
    `UPDATE episodes SET title = NULL, air_date = NULL, still_path = NULL,
       still_source = NULL, updated_at = ?
     WHERE series_id = ?`
  );

  interface ArtRow {
    poster_path: string | null;
    backdrop_path: string | null;
  }
  /** The Stored paths a clear lets go: every one held, `null` and `''` dropped. */
  const heldPaths = (paths: readonly (string | null)[]): string[] =>
    paths.filter((path): path is string => path !== null && path !== '');

  const clearMovieDetails = db.transaction((id: string): string[] | null => {
    const row = movieArt.get(id) as ArtRow | undefined;
    if (row === undefined) {
      return null;
    }
    clearMovie.run(new Date().toISOString(), id);
    clearMovieGenres.run(id);
    return heldPaths([row.poster_path, row.backdrop_path]);
  });

  const clearSeriesDetails = db.transaction((id: string): string[] | null => {
    const row = seriesArt.get(id) as ArtRow | undefined;
    if (row === undefined) {
      return null;
    }
    const seasons = (
      seasonPosterPaths.all(id) as { poster_path: string }[]
    ).map((season) => season.poster_path);
    const stills = (stillPaths.all(id) as { still_path: string }[]).map(
      (episode) => episode.still_path
    );
    const now = new Date().toISOString();
    clearSeries.run(now, id);
    clearSeriesGenres.run(id);
    clearSeasonPosters.run(id);
    clearEpisodes.run(now, id);
    return heldPaths([
      row.poster_path,
      row.backdrop_path,
      ...seasons,
      ...stills,
    ]);
  });

  return { libraryTitles, clearMovieDetails, clearSeriesDetails };
}
