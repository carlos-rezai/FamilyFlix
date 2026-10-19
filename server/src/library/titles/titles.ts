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

  return { libraryTitles };
}
