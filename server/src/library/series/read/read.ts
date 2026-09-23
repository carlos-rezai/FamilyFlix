import type { SqliteDatabase } from '../../../db';
import type {
  Episode,
  Genre,
  Series,
  SeriesHomePayload,
  Subtitle,
} from '@/types';
import { deriveStatus, type GenreRow, type SubtitleRow } from '../../read/read';

export interface SeriesRow {
  id: string;
  tmdb_id: number | null;
  title: string;
  year: number | null;
  end_year: number | null;
  synopsis: string | null;
  creator: string | null;
  cast: string | null;
  rating: number | null;
  is_favorite: number;
  poster_path: string | null;
  backdrop_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeRow {
  id: string;
  series_id: string;
  season_number: number;
  episode_number: number;
  title: string | null;
  air_date: string | null;
  runtime_minutes: number | null;
  watched: number;
  resume_position_seconds: number;
  last_watched_at: string | null;
  video_path: string;
  created_at: string;
  updated_at: string;
}

interface GenreRowWithSeries extends GenreRow {
  series_id: string;
}

const mapRowToSeries = (row: SeriesRow, genres: Genre[]): Series => ({
  id: row.id,
  tmdbId: row.tmdb_id,
  title: row.title,
  year: row.year,
  endYear: row.end_year,
  synopsis: row.synopsis,
  creator: row.creator,
  cast: row.cast ? (JSON.parse(row.cast) as string[]) : [],
  rating: row.rating,
  isFavorite: row.is_favorite !== 0,
  posterPath: row.poster_path,
  backdropPath: row.backdrop_path,
  genres,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRowToEpisode = (row: EpisodeRow, subtitles: Subtitle[]): Episode => {
  const watched = row.watched !== 0;
  return {
    id: row.id,
    seriesId: row.series_id,
    season: row.season_number,
    number: row.episode_number,
    title: row.title,
    airDate: row.air_date,
    runtimeMinutes: row.runtime_minutes,
    watched,
    resumePositionSeconds: row.resume_position_seconds,
    status: deriveStatus(watched, row.resume_position_seconds),
    videoPath: row.video_path,
    subtitles,
    lastWatchedAt: row.last_watched_at,
  };
};

export interface SeriesReader {
  /** One series, assembled, or `null` for an unknown id. */
  getSeries(id: string): Series | null;
  /** One episode, assembled, or `null` for an unknown id. */
  getEpisode(id: string): Episode | null;
  /** Every series by title, and the episode total across all of them. */
  getSeriesHome(): SeriesHomePayload;
  /** A series' episodes in season, then episode order; `[]` for none. */
  listEpisodes(seriesId: string): Episode[];
}

/**
 * The series' reads — the movie reader's shape over the series tables: a row
 * and its genres assembled into one {@link Series}, an episode and its
 * subtitles into one {@link Episode}, the watch status derived as a movie's.
 */
export function createSeriesReader(db: SqliteDatabase): SeriesReader {
  const selectSeries = db.prepare('SELECT * FROM series WHERE id = ?');
  const selectAllSeries = db.prepare(
    'SELECT * FROM series ORDER BY title COLLATE NOCASE, id'
  );
  const selectSeriesGenres = db.prepare(`
    SELECT g.id AS id, g.name AS name
    FROM series_genres sg
    JOIN genres g ON g.id = sg.genre_id
    WHERE sg.series_id = ?
    ORDER BY sg.position
  `);
  const selectAllSeriesGenres = db.prepare(`
    SELECT sg.series_id AS series_id, g.id AS id, g.name AS name
    FROM series_genres sg
    JOIN genres g ON g.id = sg.genre_id
    ORDER BY sg.series_id, sg.position
  `);
  const selectEpisode = db.prepare('SELECT * FROM episodes WHERE id = ?');
  const selectEpisodes = db.prepare(`
    SELECT * FROM episodes
    WHERE series_id = ?
    ORDER BY season_number, episode_number
  `);
  const selectEpisodeSubtitles = db.prepare(`
    SELECT id, path, language, position
    FROM episode_subtitles
    WHERE episode_id = ?
    ORDER BY position
  `);
  const countEpisodes = db.prepare('SELECT COUNT(*) AS n FROM episodes');

  const assembleEpisode = (row: EpisodeRow): Episode =>
    mapRowToEpisode(row, selectEpisodeSubtitles.all(row.id) as SubtitleRow[]);

  return {
    getSeries: (id) => {
      const row = selectSeries.get(id) as SeriesRow | undefined;
      return row === undefined
        ? null
        : mapRowToSeries(row, selectSeriesGenres.all(id) as GenreRow[]);
    },

    getEpisode: (id) => {
      const row = selectEpisode.get(id) as EpisodeRow | undefined;
      return row === undefined ? null : assembleEpisode(row);
    },

    getSeriesHome: () => {
      const genresBySeries = new Map<string, Genre[]>();
      for (const row of selectAllSeriesGenres.all() as GenreRowWithSeries[]) {
        const genre: Genre = { id: row.id, name: row.name };
        const list = genresBySeries.get(row.series_id);
        if (list) {
          list.push(genre);
        } else {
          genresBySeries.set(row.series_id, [genre]);
        }
      }
      const series = (selectAllSeries.all() as SeriesRow[]).map((row) =>
        mapRowToSeries(row, genresBySeries.get(row.id) ?? [])
      );
      const { n } = countEpisodes.get() as { n: number };
      return { series, episodeCount: n };
    },

    listEpisodes: (seriesId) =>
      (selectEpisodes.all(seriesId) as EpisodeRow[]).map(assembleEpisode),
  };
}
