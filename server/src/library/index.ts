import { randomUUID } from 'node:crypto';

import { openDatabase } from '../db';
import type {
  Genre,
  GenreCount,
  Movie,
  MovieQuery,
  MovieSort,
  NewMovie,
  Subtitle,
  WatchStatus,
} from '../../../src/types';

/**
 * The repository seam every consumer (routes, importer, player) reads and writes
 * the library through; nothing else in the app talks to SQLite.
 *
 * The movie lifecycle, browse, watch, and curation methods land in later slices
 * (issues for Phases 3–4); this slice (issue #3) adds the write→read tracer
 * bullet: a transactional `addMovie` and a full-model `getMovie`.
 */
export interface LibraryStorage {
  /**
   * Insert a movie and its genres (ordered), cast, and subtitles in one
   * transaction, returning the fully-assembled persisted model. A failure inside
   * the transaction commits nothing.
   */
  addMovie(input: NewMovie): Movie;
  /** Assemble and return the full movie model, or `null` for an unknown id. */
  getMovie(id: string): Movie | null;
  /**
   * Browse the library through one parameterized query: a required sort plus any
   * combination of genre / minRating / search / favoritesOnly / inProgressOnly
   * filters. Returns fully-assembled movies, or `[]` when nothing matches.
   */
  listMovies(query: MovieQuery): Movie[];
  /**
   * Search movies by case-insensitive title substring, returning fully-assembled
   * movies (or `[]`). Equivalent to a `listMovies` call with the `search` filter.
   */
  searchMovies(text: string): Movie[];
  /** List only genres with at least one movie, each with its movie count. */
  listGenres(): GenreCount[];
  /** Close the underlying database connection. */
  close(): void;
}

// --- raw row shapes (SELECT results) -------------------------------------------

interface MovieRow {
  id: string;
  tmdb_id: number | null;
  title: string;
  year: number | null;
  runtime_minutes: number | null;
  synopsis: string | null;
  director: string | null;
  cast: string | null;
  rating: number | null;
  is_favorite: number;
  watched: number;
  resume_position_seconds: number;
  video_path: string;
  poster_path: string | null;
  backdrop_path: string | null;
  created_at: string;
  updated_at: string;
}

interface GenreRow {
  id: string;
  name: string;
}

interface SubtitleRow {
  id: string;
  path: string;
  language: string;
  position: number;
}

/** Derive the three-way watch status from the two stored facts. */
function deriveStatus(
  watched: boolean,
  resumePositionSeconds: number
): WatchStatus {
  if (watched) {
    return 'watched';
  }
  if (resumePositionSeconds > 0) {
    return 'in-progress';
  }
  return 'unwatched';
}

/** Pure row→model assembly: parse cast JSON, attach ordered genres/subtitles,
 *  coerce SQLite integer booleans, and compute the derived status. */
function mapRowToMovie(
  row: MovieRow,
  genres: Genre[],
  subtitles: Subtitle[]
): Movie {
  const watched = row.watched !== 0;
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year,
    runtimeMinutes: row.runtime_minutes,
    synopsis: row.synopsis,
    director: row.director,
    cast: row.cast ? (JSON.parse(row.cast) as string[]) : [],
    rating: row.rating,
    isFavorite: row.is_favorite !== 0,
    watched,
    resumePositionSeconds: row.resume_position_seconds,
    status: deriveStatus(watched, row.resume_position_seconds),
    videoPath: row.video_path,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    genres,
    subtitles,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

/**
 * Build a {@link LibraryStorage} backed by a SQLite database at `dbPath`. Opening
 * runs pending migrations, so a fresh database is created and seeded on first use.
 * Statements are prepared once here and reused per call.
 */
export function createSqliteStorage(dbPath: string): LibraryStorage {
  const db = openDatabase(dbPath);

  const insertMovie = db.prepare(`
    INSERT INTO movies (
      id, tmdb_id, title, year, runtime_minutes, synopsis, director, cast,
      rating, is_favorite, watched, resume_position_seconds, video_path,
      poster_path, backdrop_path, created_at, updated_at
    ) VALUES (
      @id, @tmdb_id, @title, @year, @runtime_minutes, @synopsis, @director, @cast,
      @rating, @is_favorite, @watched, @resume_position_seconds, @video_path,
      @poster_path, @backdrop_path, @created_at, @updated_at
    )
  `);
  const selectGenreIdByName = db.prepare(
    'SELECT id FROM genres WHERE name = ?'
  );
  const insertMovieGenre = db.prepare(
    'INSERT INTO movie_genres (movie_id, genre_id, position) VALUES (@movie_id, @genre_id, @position)'
  );
  const insertSubtitle = db.prepare(`
    INSERT INTO subtitles (id, movie_id, path, language, position)
    VALUES (@id, @movie_id, @path, @language, @position)
  `);

  const selectMovie = db.prepare('SELECT * FROM movies WHERE id = ?');
  const selectMovieGenres = db.prepare(`
    SELECT g.id AS id, g.name AS name
    FROM movie_genres mg
    JOIN genres g ON g.id = mg.genre_id
    WHERE mg.movie_id = ?
    ORDER BY mg.position
  `);
  const selectMovieSubtitles = db.prepare(`
    SELECT id, path, language, position
    FROM subtitles
    WHERE movie_id = ?
    ORDER BY position
  `);
  const selectGenreCounts = db.prepare(`
    SELECT g.id AS id, g.name AS name, COUNT(mg.movie_id) AS count
    FROM genres g
    JOIN movie_genres mg ON mg.genre_id = g.id
    GROUP BY g.id, g.name
    ORDER BY g.name
  `);

  function getMovie(id: string): Movie | null {
    const row = selectMovie.get(id) as MovieRow | undefined;
    if (!row) {
      return null;
    }
    const genres = selectMovieGenres.all(id) as GenreRow[];
    const subtitles = selectMovieSubtitles.all(id) as SubtitleRow[];
    return mapRowToMovie(row, genres, subtitles);
  }

  const insertMovieGraph = db.transaction((id: string, input: NewMovie) => {
    const now = new Date().toISOString();

    insertMovie.run({
      id,
      tmdb_id: input.tmdbId ?? null,
      title: input.title,
      year: input.year ?? null,
      runtime_minutes: input.runtimeMinutes ?? null,
      synopsis: input.synopsis ?? null,
      director: input.director ?? null,
      cast: input.cast ? JSON.stringify(input.cast) : null,
      rating: input.rating ?? null,
      is_favorite: input.isFavorite ? 1 : 0,
      watched: input.watched ? 1 : 0,
      resume_position_seconds: input.resumePositionSeconds ?? 0,
      video_path: input.videoPath ?? null,
      poster_path: input.posterPath ?? null,
      backdrop_path: input.backdropPath ?? null,
      created_at: now,
      updated_at: now,
    });

    input.genres?.forEach((name, position) => {
      const genre = selectGenreIdByName.get(name) as { id: string } | undefined;
      if (!genre) {
        throw new Error(`Unknown genre: ${name}`);
      }
      insertMovieGenre.run({ movie_id: id, genre_id: genre.id, position });
    });

    input.subtitles?.forEach((subtitle, position) => {
      insertSubtitle.run({
        id: randomUUID(),
        movie_id: id,
        path: subtitle.path,
        language: subtitle.language,
        position,
      });
    });
  });

  function addMovie(input: NewMovie): Movie {
    const id = randomUUID();
    insertMovieGraph(id, input);
    const movie = getMovie(id);
    if (!movie) {
      throw new Error(`Failed to persist movie ${id}`);
    }
    return movie;
  }

  function listMovies(query: MovieQuery): Movie[] {
    const { sql, params } = buildListQuery(query);
    const rows = db.prepare(sql).all(...params) as MovieRow[];
    return rows.map((row) => {
      const genres = selectMovieGenres.all(row.id) as GenreRow[];
      const subtitles = selectMovieSubtitles.all(row.id) as SubtitleRow[];
      return mapRowToMovie(row, genres, subtitles);
    });
  }

  function searchMovies(text: string): Movie[] {
    return listMovies({ sort: 'a-z', search: text });
  }

  function listGenres(): GenreCount[] {
    return selectGenreCounts.all() as GenreCount[];
  }

  return {
    addMovie,
    getMovie,
    listMovies,
    searchMovies,
    listGenres,
    close() {
      db.close();
    },
  };
}
