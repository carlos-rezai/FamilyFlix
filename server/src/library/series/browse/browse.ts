import type { SqliteDatabase } from '../../../db';
import {
  DEFAULT_MOVIE_SORT,
  type EpisodeContinueEntry,
  type GenreCount,
  type GenreListPayload,
  type GenreQuery,
  type LibraryQuery,
  type MovieSort,
  type SeriesGenrePayload,
  type SeriesHomePayload,
  type SeriesRowsPayload,
} from '@/types';
import type { EpisodeRow, SeriesReader, SeriesRow } from '../read/read';
import { highestRatedSql, shownRatingSql } from '../../browse/browse';
import { HOME_ROW_LIMIT } from '../../home/home';

/** The Series tab's Continue Watching row holds at most this many entries. */
const CONTINUE_LIMIT = 15;

/** What `listSeries` narrows and caps by, beyond the query. */
interface ListSeriesOptions {
  /** One more SQL clause over `s`, ANDed onto the query's. */
  where?: string;
  /** At most this many; every match when omitted. */
  limit?: number;
}

/** A series carrying no genre at all: the **Other row**'s clause. */
const GENRE_LESS = 's.id NOT IN (SELECT series_id FROM series_genres)';

/** A series is fully watched when it has episodes and none is unwatched. */
const FULLY_WATCHED =
  's.id IN (SELECT series_id FROM episodes GROUP BY series_id HAVING MIN(watched) = 1)';

/**
 * Each **Sort order** over the `series s` alias, the movie's five read for
 * series: `unwatched-first` puts every series not fully watched ahead of the
 * fully watched ones, A–Z inside each group.
 *
 * Every body but `highest-rated`'s, which reads the **Shown rating** under the
 * preference and so is filled in per query by {@link seriesOrderBy}, where the
 * full table is checked — so the compiler demands every body exists.
 */
const SERIES_ORDER_BY: Record<Exclude<MovieSort, 'highest-rated'>, string> = {
  'recently-added': 's.created_at DESC, s.id',
  'a-z': 's.title COLLATE NOCASE ASC, s.id',
  year: 's.year IS NULL, s.year DESC, s.title COLLATE NOCASE',
  'unwatched-first': `CASE WHEN ${FULLY_WATCHED} THEN 1 ELSE 0 END, s.title COLLATE NOCASE`,
};

/** {@link SERIES_ORDER_BY} with `highest-rated` filled in under the preference. */
function seriesOrderBy(sort: MovieSort, tmdbRatings: boolean): string {
  const bodies: Record<MovieSort, string> = {
    ...SERIES_ORDER_BY,
    'highest-rated': highestRatedSql('s', tmdbRatings),
  };
  return bodies[sort];
}

/**
 * A {@link LibraryQuery}'s filters as a `WHERE` over `series s` and its bound
 * parameters — search by title, one genre, a minimum rating. `''` for none.
 */
function seriesWhere(
  query: LibraryQuery,
  tmdbRatings: boolean
): { sql: string; params: unknown[] } {
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
    where.push(`${shownRatingSql('s', tmdbRatings)} >= ?`);
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
  /**
   * Series under **By genre**, `getHome`'s rules over series: a row per
   * populated genre busiest first, each capped with the genre's true count;
   * the genre-less series as `other`; the favorites capped in the caller's
   * sort; and the Continue row exactly as {@link getSeriesHome} builds it.
   */
  getSeriesRows(query: LibraryQuery): SeriesRowsPayload;
  /** Each genre series carry, counted in series, with the series total. */
  listSeriesGenres(): GenreListPayload;
  /**
   * One genre's series in full, the Genre page under Series: uncapped, the
   * search and sort applied, `total` the genre's unfiltered count.
   */
  getSeriesGenre(name: string, query?: Partial<GenreQuery>): SeriesGenrePayload;
  /** The genre-less series in full: {@link getSeriesGenre}'s rules, blank genre. */
  getSeriesGenreLess(query?: Partial<GenreQuery>): SeriesGenrePayload;
}

/**
 * The Series tab's reads, created from the series reader the way the movie's
 * `createBrowse` is from the movie reader: the filters, the sort and the
 * Continue row's rules here, the assembly there.
 *
 * @param tmdbRatings the **TMDB ratings** preference, asked on every query so a
 *   flip is read by the next request without a restart.
 */
export function createSeriesBrowse(
  db: SqliteDatabase,
  reader: SeriesReader,
  tmdbRatings: () => boolean
): SeriesBrowse {
  // Continue Watching: per series, its earliest part-watched episode — not
  // watched, a resume position — most recently watched first, at most 15.
  const continueEpisodesSql = (where: string) => `
    SELECT e.*, s.title AS series_title, s.poster_path AS series_poster_path
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
  const countGenreLess = db.prepare(
    `SELECT COUNT(*) AS n FROM series s WHERE ${GENRE_LESS}`
  );

  /** The Continue row, narrowed by the query's filters. */
  function continueWatchingOf(where: {
    sql: string;
    params: unknown[];
  }): EpisodeContinueEntry[] {
    return (
      db
        .prepare(continueEpisodesSql(where.sql))
        .all(...where.params) as (EpisodeRow & {
        series_title: string;
        series_poster_path: string | null;
      })[]
    ).map((row) => ({
      series: {
        id: row.series_id,
        title: row.series_title,
        posterPath: row.series_poster_path,
      },
      episode: reader.assembleEpisode(row),
    }));
  }

  /**
   * The series the query keeps, in its sort: narrowed by one more clause when
   * `where` is given, capped at `limit` when one is, uncapped otherwise.
   */
  function listSeries(
    query: LibraryQuery,
    on: boolean,
    { where: extra, limit }: ListSeriesOptions = {}
  ) {
    const where = seriesWhere(query, on);
    const filter =
      extra === undefined
        ? where.sql
        : where.sql === ''
          ? `WHERE ${extra}`
          : `${where.sql} AND ${extra}`;
    const cap = limit === undefined ? '' : ` LIMIT ${limit}`;
    const rows = db
      .prepare(
        `SELECT s.* FROM series s ${filter}
         ORDER BY ${seriesOrderBy(query.sort, on)}${cap}`
      )
      .all(...where.params) as SeriesRow[];
    return reader.assembleMany(rows);
  }

  return {
    getSeriesHome: (query = { sort: DEFAULT_MOVIE_SORT }) => {
      const on = tmdbRatings();
      const where = seriesWhere(query, on);
      const { n } = db
        .prepare(
          `SELECT COUNT(*) AS n FROM episodes
           WHERE series_id IN (SELECT s.id FROM series s ${where.sql})`
        )
        .get(...where.params) as { n: number };
      return {
        series: listSeries(query, on),
        episodeCount: n,
        continueWatching: continueWatchingOf(where),
      };
    },

    getSeriesRows: (query) => {
      const on = tmdbRatings();
      // Busiest first, as the Genre dropdown lists them; a genre filter keeps
      // only its own row, and a row the query empties is dropped.
      const genres = (selectSeriesGenreCounts.all() as GenreCount[]).filter(
        (genre) => query.genre === undefined || genre.name === query.genre
      );
      const rows = genres
        .map((genre) => ({
          genre: genre.name,
          count: genre.count,
          series: listSeries({ ...query, genre: genre.name }, on, {
            limit: HOME_ROW_LIMIT,
          }),
        }))
        .filter((row) => row.series.length > 0);

      // The genre-less series: none under a genre filter, `null` when empty,
      // its count the unfiltered genre-less total and its genre blank.
      const otherSeries =
        query.genre === undefined
          ? listSeries(query, on, { where: GENRE_LESS, limit: HOME_ROW_LIMIT })
          : [];
      const other =
        otherSeries.length === 0
          ? null
          : {
              genre: '',
              count: (countGenreLess.get() as { n: number }).n,
              series: otherSeries,
            };

      return {
        rows,
        other,
        favorites: listSeries(query, on, {
          where: 's.is_favorite = 1',
          limit: HOME_ROW_LIMIT,
        }),
        continueWatching: continueWatchingOf(seriesWhere(query, on)),
      };
    },

    listSeriesGenres: () => ({
      total: (countSeries.get() as { n: number }).n,
      genres: selectSeriesGenreCounts.all() as GenreCount[],
    }),

    getSeriesGenre: (name, query = {}) => {
      const genre = (selectSeriesGenreCounts.all() as GenreCount[]).find(
        (entry) => entry.name === name
      );
      return {
        genre: name,
        total: genre?.count ?? 0,
        series: listSeries(
          {
            search: query.search,
            sort: query.sort ?? DEFAULT_MOVIE_SORT,
            genre: name,
          },
          tmdbRatings()
        ),
      };
    },

    getSeriesGenreLess: (query = {}) => ({
      genre: '',
      total: (countGenreLess.get() as { n: number }).n,
      series: listSeries(
        { search: query.search, sort: query.sort ?? DEFAULT_MOVIE_SORT },
        tmdbRatings(),
        { where: GENRE_LESS }
      ),
    }),
  };
}
