import type { SqliteDatabase } from '../../db';
import type {
  GenreCount,
  Movie,
  MovieQuery,
  MovieSort,
} from '../../../../src/types';
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
 * per movie regardless of how many genres it carries.
 */
function buildListQuery(query: MovieQuery): {
  sql: string;
  params: unknown[];
} {
  const where: string[] = [];
  const params: unknown[] = [];

  if (query.genre !== undefined) {
    where.push(
      'm.id IN (SELECT mg.movie_id FROM movie_genres mg ' +
        'JOIN genres g ON g.id = mg.genre_id WHERE g.name = ?)'
    );
    params.push(query.genre);
  }
  if (query.minRating !== undefined) {
    where.push('m.rating >= ?');
    params.push(query.minRating);
  }
  if (query.search !== undefined) {
    where.push('m.title LIKE ?');
    params.push(`%${query.search}%`);
  }
  if (query.favoritesOnly) {
    where.push('m.is_favorite = 1');
  }
  if (query.inProgressOnly) {
    where.push('m.watched = 0 AND m.resume_position_seconds > 0');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sql = `SELECT m.* FROM movies m ${whereClause} ORDER BY ${ORDER_BY[query.sort]}`;
  return { sql, params };
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
    const { sql, params } = buildListQuery(query);
    const rows = db.prepare(sql).all(...params) as MovieRow[];
    return rows.map((row) => reader.assemble(row));
  }

  function searchMovies(text: string): Movie[] {
    return listMovies({ sort: 'a-z', search: text });
  }

  function listGenres(): GenreCount[] {
    return selectGenreCounts.all() as GenreCount[];
  }

  return { listMovies, searchMovies, listGenres };
}
