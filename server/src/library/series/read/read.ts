import type { SqliteDatabase } from '../../../db';
import {
  DEFAULT_MOVIE_SORT,
  type Episode,
  type EpisodeContinueEntry,
  type EpisodeRead,
  type Genre,
  type GenreCount,
  type GenreListPayload,
  type LibraryQuery,
  type MovieSort,
  type Series,
  type SeasonSummary,
  type SeriesDetail,
  type SeriesHomePayload,
  type Subtitle,
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

/** The Series tab's Continue Watching row holds at most this many entries. */
const CONTINUE_LIMIT = 15;

/** A series is fully watched when it has episodes and none is unwatched. */
const FULLY_WATCHED =
  's.id IN (SELECT series_id FROM episodes GROUP BY series_id HAVING MIN(watched) = 1)';

/**
 * Each **Sort order** over the `series s` alias, the movie's five read for
 * series: `unwatched-first` puts every series not fully watched ahead of the
 * fully watched ones, A–Z inside each group.
 */
const SERIES_ORDER_BY: Record<MovieSort, string> = {
  'recently-added': 's.created_at DESC, s.id',
  'a-z': 's.title COLLATE NOCASE ASC, s.id',
  year: 's.year IS NULL, s.year DESC, s.title COLLATE NOCASE',
  'highest-rated': 's.rating IS NULL, s.rating DESC, s.title COLLATE NOCASE',
  'unwatched-first': `CASE WHEN ${FULLY_WATCHED} THEN 1 ELSE 0 END, s.title COLLATE NOCASE`,
};

/**
 * A {@link LibraryQuery}'s filters as a `WHERE` over `series s` and its bound
 * parameters — search by title, one genre, a minimum rating. `''` for none.
 */
function seriesWhere(query: LibraryQuery): { sql: string; params: unknown[] } {
  const where: string[] = [];
  const params: unknown[] = [];
  if (query.search !== undefined) {
    where.push('s.title LIKE ?');
    params.push(`%${query.search}%`);
  }
  if (query.genre !== undefined) {
    where.push(
      's.id IN (SELECT sg.series_id FROM series_genres sg ' +
        'JOIN genres g ON g.id = sg.genre_id WHERE g.name = ?)'
    );
    params.push(query.genre);
  }
  if (query.minRating !== undefined) {
    where.push('s.rating >= ?');
    params.push(query.minRating);
  }
  return {
    sql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '',
    params,
  };
}

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
  /**
   * The series the query keeps in its sort, the episode total across them, and
   * the Continue Watching entries narrowed by the same filters.
   */
  getSeriesHome(query?: LibraryQuery): SeriesHomePayload;
  /** Each genre series carry, counted in series, with the series total. */
  listSeriesGenres(): GenreListPayload;
  /** A series' episodes in season, then episode order; `[]` for none. */
  listEpisodes(seriesId: string): Episode[];
  /** The series page's read — its seasons and next episodes — or `null`. */
  getSeriesDetail(id: string): SeriesDetail | null;
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
  // Continue Watching: per series, its earliest part-watched episode — not
  // watched, a resume position — most recently watched first, at most 15.
  const continueEpisodesSql = (where: string) => `
    SELECT e.*, s.title AS series_title
    FROM episodes e
    JOIN series s ON s.id = e.series_id
    WHERE e.watched = 0 AND e.resume_position_seconds > 0
      AND NOT EXISTS (
        SELECT 1 FROM episodes p
        WHERE p.series_id = e.series_id
          AND p.watched = 0 AND p.resume_position_seconds > 0
          AND (p.season_number < e.season_number
            OR (p.season_number = e.season_number
              AND p.episode_number < e.episode_number))
      )
      AND e.series_id IN (SELECT s.id FROM series s ${where})
    ORDER BY e.last_watched_at IS NULL, e.last_watched_at DESC, e.id
    LIMIT ${CONTINUE_LIMIT}
  `;
  const selectSeriesGenreCounts = db.prepare(`
    SELECT g.id AS id, g.name AS name, COUNT(sg.series_id) AS count
    FROM genres g
    JOIN series_genres sg ON sg.genre_id = g.id
    GROUP BY g.id, g.name
    ORDER BY COUNT(sg.series_id) DESC, g.name
  `);
  const countSeries = db.prepare('SELECT COUNT(*) AS n FROM series');
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

    getSeriesHome: (query = { sort: DEFAULT_MOVIE_SORT }) => {
      const where = seriesWhere(query);
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
      const rows = db
        .prepare(
          `SELECT s.* FROM series s ${where.sql} ORDER BY ${SERIES_ORDER_BY[query.sort]}`
        )
        .all(...where.params) as SeriesRow[];
      const series = rows.map((row) =>
        mapRowToSeries(
          row,
          genresBySeries.get(row.id) ?? [],
          watched.has(row.id)
        )
      );
      const { n } = db
        .prepare(
          `SELECT COUNT(*) AS n FROM episodes
           WHERE series_id IN (SELECT s.id FROM series s ${where.sql})`
        )
        .get(...where.params) as { n: number };
      const continueWatching: EpisodeContinueEntry[] = (
        db
          .prepare(continueEpisodesSql(where.sql))
          .all(...where.params) as (EpisodeRow & {
          series_title: string;
        })[]
      ).map((row) => ({
        series: { id: row.series_id, title: row.series_title },
        episode: assembleEpisode(row),
      }));
      return { series, episodeCount: n, continueWatching };
    },

    listSeriesGenres: () => ({
      total: (countSeries.get() as { n: number }).n,
      genres: selectSeriesGenreCounts.all() as GenreCount[],
    }),

    listEpisodes,
  };
}
