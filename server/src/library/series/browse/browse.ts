import type { SqliteDatabase } from '../../../db';
import {
  DEFAULT_MOVIE_SORT,
  type EpisodeContinueEntry,
  type GenreCount,
  type GenreListPayload,
  type LibraryQuery,
  type MovieSort,
  type SeriesHomePayload,
} from '@/types';
import type { EpisodeRow, SeriesReader, SeriesRow } from '../read/read';

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

/** The read-only browse slice of series storage: the Series tab and its
 *  Genre dropdown. */
export interface SeriesBrowse {
  /**
   * The series the query keeps in its sort, the episode total across them, and
   * the Continue Watching entries narrowed by the same filters.
   */
  getSeriesHome(query?: LibraryQuery): SeriesHomePayload;
  /** Each genre series carry, counted in series, with the series total. */
  listSeriesGenres(): GenreListPayload;
}

/**
 * The Series tab's reads, created from the series reader the way the movie's
 * `createBrowse` is from the movie reader: the filters, the sort and the
 * Continue row's rules here, the assembly there.
 */
export function createSeriesBrowse(
  db: SqliteDatabase,
  reader: SeriesReader
): SeriesBrowse {
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

  return {
    getSeriesHome: (query = { sort: DEFAULT_MOVIE_SORT }) => {
      const where = seriesWhere(query);
      const rows = db
        .prepare(
          `SELECT s.* FROM series s ${where.sql} ORDER BY ${SERIES_ORDER_BY[query.sort]}`
        )
        .all(...where.params) as SeriesRow[];
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
        episode: reader.assembleEpisode(row),
      }));
      return {
        series: reader.assembleMany(rows),
        episodeCount: n,
        continueWatching,
      };
    },

    listSeriesGenres: () => ({
      total: (countSeries.get() as { n: number }).n,
      genres: selectSeriesGenreCounts.all() as GenreCount[],
    }),
  };
}
