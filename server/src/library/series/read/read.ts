import type { SqliteDatabase } from '../../../db';
import type {
  Episode,
  EpisodeRead,
  Genre,
  Series,
  SeasonSummary,
  SeriesDetail,
  Subtitle,
} from '@/types';
import { nextEpisodeOf } from '../nextEpisodeOf/nextEpisodeOf';
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
  original_title: string | null;
  tmdb_score: number | null;
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

const mapRowToSeries = (
  row: SeriesRow,
  genres: Genre[],
  watched: boolean
): Series => ({
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
  originalTitle: row.original_title,
  tmdbScore: row.tmdb_score,
  genres,
  watched,
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
  /**
   * The player's read of one episode: the episode, its series' id and title,
   * and the next episode its series holds in season, then episode order —
   * watched or not — or `null` for an unknown id.
   */
  getEpisodeRead(id: string): EpisodeRead | null;
  /** A series' episodes in season, then episode order; `[]` for none. */
  listEpisodes(seriesId: string): Episode[];
  /** The series page's read — its seasons and next episodes — or `null`. */
  getSeriesDetail(id: string): SeriesDetail | null;
  /**
   * A whole ordered set of series rows assembled with two set reads — every
   * series' genres, and which series are fully watched — instead of two per
   * row. Order preserved. `browse/` reads the Series tab through it.
   */
  assembleMany(rows: SeriesRow[]): Series[];
  /** Attach an episode row's subtitles and map it to a full model. */
  assembleEpisode(row: EpisodeRow): Episode;
}

/**
 * The series' reads — the movie reader's shape over the series tables: a row
 * and its genres assembled into one {@link Series}, an episode and its
 * subtitles into one {@link Episode}, the watch status derived as a movie's.
 */
export function createSeriesReader(db: SqliteDatabase): SeriesReader {
  const selectSeries = db.prepare('SELECT * FROM series WHERE id = ?');
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
  const selectNextEpisode = db.prepare(`
    SELECT id, season_number, episode_number, title FROM episodes
    WHERE series_id = ?
      AND (season_number > ? OR (season_number = ? AND episode_number > ?))
    ORDER BY season_number, episode_number
    LIMIT 1
  `);
  // A series is watched when it has episodes and none of them is unwatched —
  // derived on every read, never stored, so it cannot drift from its episodes.
  const selectWatchedSeries = db.prepare(`
    SELECT series_id AS id FROM episodes
    GROUP BY series_id
    HAVING MIN(watched) = 1
  `);
  const selectSeriesWatched = db.prepare(`
    SELECT COUNT(*) > 0 AND MIN(watched) = 1 AS watched
    FROM episodes WHERE series_id = ?
  `);

  const assembleEpisode = (row: EpisodeRow): Episode =>
    mapRowToEpisode(row, selectEpisodeSubtitles.all(row.id) as SubtitleRow[]);

  const getSeries = (id: string): Series | null => {
    const row = selectSeries.get(id) as SeriesRow | undefined;
    return row === undefined
      ? null
      : mapRowToSeries(
          row,
          selectSeriesGenres.all(id) as GenreRow[],
          (selectSeriesWatched.get(id) as { watched: number }).watched === 1
        );
  };

  const listEpisodes = (seriesId: string): Episode[] =>
    (selectEpisodes.all(seriesId) as EpisodeRow[]).map(assembleEpisode);

  return {
    getSeries,

    getSeriesDetail: (id) => {
      const series = getSeries(id);
      if (series === null) {
        return null;
      }
      const episodes = listEpisodes(id);
      // Already in season, then episode order: a season is each run of one
      // `season` number, and its next episode is asked of that run alone.
      const seasons: SeasonSummary[] = [];
      for (const episode of episodes) {
        const last = seasons[seasons.length - 1];
        if (last !== undefined && last.number === episode.season) {
          last.episodes.push(episode);
        } else {
          seasons.push({
            number: episode.season,
            episodes: [episode],
            next: null,
          });
        }
      }
      for (const season of seasons) {
        season.next = nextEpisodeOf(season.episodes);
      }
      return { series, seasons, next: nextEpisodeOf(episodes) };
    },

    getEpisode: (id) => {
      const row = selectEpisode.get(id) as EpisodeRow | undefined;
      return row === undefined ? null : assembleEpisode(row);
    },

    getEpisodeRead: (id) => {
      const row = selectEpisode.get(id) as EpisodeRow | undefined;
      if (row === undefined) {
        return null;
      }
      const series = selectSeries.get(row.series_id) as SeriesRow;
      const next = selectNextEpisode.get(
        row.series_id,
        row.season_number,
        row.season_number,
        row.episode_number
      ) as
        | Pick<EpisodeRow, 'id' | 'season_number' | 'episode_number' | 'title'>
        | undefined;
      return {
        episode: assembleEpisode(row),
        series: { id: series.id, title: series.title },
        next:
          next === undefined
            ? null
            : {
                id: next.id,
                season: next.season_number,
                number: next.episode_number,
                title: next.title,
              },
      };
    },

    assembleMany: (rows) => {
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
      const watched = new Set(
        (selectWatchedSeries.all() as { id: string }[]).map(({ id }) => id)
      );
      return rows.map((row) =>
        mapRowToSeries(
          row,
          genresBySeries.get(row.id) ?? [],
          watched.has(row.id)
        )
      );
    },

    assembleEpisode,

    listEpisodes,
  };
}
