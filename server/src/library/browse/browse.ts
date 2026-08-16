import type { SqliteDatabase } from '../../db';
import type { GenreCount, Movie, MovieQuery, MovieSort } from '@/types';
import type { MovieReader, MovieRow } from '../read/read';

/**
 * Each {@link MovieSort} mapped to its `ORDER BY` body (over the `movies m`
 * alias). `null` year/rating sort last via the `IS NULL` leading key; the
 * `unwatched-first` rank groups unwatched (0) → in-progress (1) → watched (2),
 * with a case-insensitive title tiebreak inside every group.
 */
const ORDER_BY: Record<MovieSort, string> = {
  'recently-added': 'm.created_at DESC, m.id',
  'a-z': 'm.title COLLATE NOCASE ASC',
  year: 'm.year IS NULL, m.year DESC, m.title COLLATE NOCASE',
  'highest-rated': 'm.rating IS NULL, m.rating DESC, m.title COLLATE NOCASE',
  'unwatched-first':
    'CASE WHEN m.watched = 1 THEN 2 WHEN m.resume_position_seconds > 0 THEN 1 ELSE 0 END, m.title COLLATE NOCASE',
};

/**
 * Pure {@link MovieQuery} → parameterized SQL builder. Each present filter adds
 * one `AND`-joined `WHERE` term and its bound parameter(s); omitted filters are
 * no-ops. The genre filter matches via a subquery so the row set stays one row
 * per movie regardless of how many genres it carries. An optional `limit` caps
 * the result with a trailing `LIMIT ?`, so the cap lands after the filters and
 * the sort.
 *
 * The `WHERE` clause and its parameters come back separately from the full
 * statement: the assembly pass re-runs the filter as a subquery and must not be
 * handed the trailing `LIMIT` placeholder.
 */
function buildListQuery(query: MovieQuery): {
  sql: string;
  params: unknown[];
  whereClause: string;
  whereParams: unknown[];
} {
  const where: string[] = [];
  const whereParams: unknown[] = [];

  if (query.genre !== undefined) {
    where.push(
      'm.id IN (SELECT mg.movie_id FROM movie_genres mg ' +
        'JOIN genres g ON g.id = mg.genre_id WHERE g.name = ?)'
    );
    whereParams.push(query.genre);
  }
  if (query.minRating !== undefined) {
    where.push('m.rating >= ?');
    whereParams.push(query.minRating);
  }
  if (query.search !== undefined) {
    // Title OR synopsis OR genre name, so a half-remembered plot fragment or a
    // genre typed into the box both find the film. The genre arm reuses the
    // genre filter's subquery shape rather than joining, so a movie matching on
    // several arms — or on several genres — still yields exactly one row.
    where.push(
      '(m.title LIKE ? OR m.synopsis LIKE ? OR m.id IN (' +
        'SELECT mg.movie_id FROM movie_genres mg ' +
        'JOIN genres g ON g.id = mg.genre_id WHERE g.name LIKE ?))'
    );
    const pattern = `%${query.search}%`;
    whereParams.push(pattern, pattern, pattern);
  }
  if (query.favoritesOnly) {
    where.push('m.is_favorite = 1');
  }
  if (query.inProgressOnly) {
    where.push('m.watched = 0 AND m.resume_position_seconds > 0');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limitClause = query.limit === undefined ? '' : ' LIMIT ?';
  const sql = `SELECT m.* FROM movies m ${whereClause} ORDER BY ${ORDER_BY[query.sort]}${limitClause}`;
  const params =
    query.limit === undefined ? whereParams : [...whereParams, query.limit];

  return { sql, params, whereClause, whereParams };
}

/** The read-only browse slice of the repository: the parameterized `listMovies`
 *  query, the `searchMovies` shorthand over it, and the home-screen genre rows. */
export interface Browse {
  listMovies(query: MovieQuery): Movie[];
  searchMovies(text: string): Movie[];
  listGenres(): GenreCount[];
}

export function createBrowse(db: SqliteDatabase, reader: MovieReader): Browse {
  const selectGenreCounts = db.prepare(`
    SELECT g.id AS id, g.name AS name, COUNT(mg.movie_id) AS count
    FROM genres g
    JOIN movie_genres mg ON mg.genre_id = g.id
    GROUP BY g.id, g.name
    ORDER BY g.name
  `);

  function listMovies(query: MovieQuery): Movie[] {
    const { sql, params, whereClause, whereParams } = buildListQuery(query);
    const rows = db.prepare(sql).all(...params) as MovieRow[];
    return reader.assembleMany(rows, whereClause, whereParams);
  }

  /** Case-insensitive substring match on title, synopsis, or genre name, A–Z —
   *  exactly a `listMovies` call with the `search` filter, and nothing more. */
  function searchMovies(text: string): Movie[] {
    return listMovies({ sort: 'a-z', search: text });
  }

  function listGenres(): GenreCount[] {
    return selectGenreCounts.all() as GenreCount[];
  }

  return { listMovies, searchMovies, listGenres };
}
