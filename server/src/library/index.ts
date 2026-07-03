import { randomUUID } from 'node:crypto';

import { openDatabase } from '../db';
import type {
  GenreCount,
  Movie,
  MoviePatch,
  MovieQuery,
  MovieSort,
  NewMovie,
} from '../../../src/types';
import { createMovieReader, type MovieRow } from './read/read';

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
  /**
   * Edit a movie's metadata (scalars, plus genre/subtitle collections) in one
   * transaction, refresh `updated_at`, and return the persisted full model. A
   * supplied `genres`/`subtitles` replaces that whole collection; an omitted key
   * leaves it untouched. Watch state, favorite, and rating are out of scope.
   * Throws on an unknown id; a failure inside the transaction commits nothing.
   */
  updateMovie(id: string, patch: MoviePatch): Movie;
  /**
   * Delete a movie, cascading to its `movie_genres` and `subtitles` rows so no
   * orphans remain. A silent, idempotent no-op for an unknown id.
   */
  deleteMovie(id: string): void;
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
  /**
   * Persist the resume position (seconds into the file). Called constantly during
   * playback, so it stays a cheap single-column write — only
   * `resume_position_seconds` is touched, not `updated_at`.
   */
  setResumePosition(id: string, seconds: number): void;
  /**
   * Mark a movie watched. By convention this also zeroes
   * `resume_position_seconds`, so a finished movie leaves the Continue Watching
   * row.
   */
  markWatched(id: string): void;
  /** Clear the watched flag, leaving any resume position untouched. */
  markUnwatched(id: string): void;
  /**
   * Toggle the favorite flag, surfaced through the partial `is_favorite` index
   * that powers the Favorites row.
   */
  setFavorite(id: string, value: boolean): void;
  /**
   * Set a 0–10 half-star rating, or clear it to unrated with `null` (distinct
   * from a stored `0`). An out-of-range value is rejected by the schema CHECK
   * and never persisted.
   */
  setRating(id: string, units: number | null): void;
  /** Close the underlying database connection. */
  close(): void;
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
 * The scalar {@link MoviePatch} keys mapped to their `movies` column and (where
 * needed) a value coercion. Drives {@link updateMovie}'s dynamic `SET` list: only
 * keys present on the patch are emitted, so an omitted key leaves its column
 * untouched. `genres`/`subtitles` are handled separately (they touch other tables).
 */
const PATCH_SCALARS: ReadonlyArray<{
  key: keyof MoviePatch;
  column: string;
  toDb?: (value: unknown) => unknown;
}> = [
  { key: 'title', column: 'title' },
  { key: 'tmdbId', column: 'tmdb_id' },
  { key: 'year', column: 'year' },
  { key: 'runtimeMinutes', column: 'runtime_minutes' },
  { key: 'synopsis', column: 'synopsis' },
  { key: 'director', column: 'director' },
  { key: 'cast', column: 'cast', toDb: (v) => (v ? JSON.stringify(v) : null) },
  { key: 'videoPath', column: 'video_path' },
  { key: 'posterPath', column: 'poster_path' },
  { key: 'backdropPath', column: 'backdrop_path' },
];

/**
 * Build a {@link LibraryStorage} backed by a SQLite database at `dbPath`. Opening
 * runs pending migrations, so a fresh database is created and seeded on first use.
 * Statements are prepared once here and reused per call.
 */
export function createSqliteStorage(dbPath: string): LibraryStorage {
  const db = openDatabase(dbPath);

  const reader = createMovieReader(db);

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

  const updateResumePosition = db.prepare(
    'UPDATE movies SET resume_position_seconds = ? WHERE id = ?'
  );
  const updateMarkWatched = db.prepare(
    'UPDATE movies SET watched = 1, resume_position_seconds = 0 WHERE id = ?'
  );
  const updateMarkUnwatched = db.prepare(
    'UPDATE movies SET watched = 0 WHERE id = ?'
  );
  const updateFavorite = db.prepare(
    'UPDATE movies SET is_favorite = ? WHERE id = ?'
  );
  const updateRating = db.prepare('UPDATE movies SET rating = ? WHERE id = ?');
  const deleteMovieGenres = db.prepare(
    'DELETE FROM movie_genres WHERE movie_id = ?'
  );
  const deleteMovieSubtitles = db.prepare(
    'DELETE FROM subtitles WHERE movie_id = ?'
  );
  const deleteMovieRow = db.prepare('DELETE FROM movies WHERE id = ?');

  const selectGenreCounts = db.prepare(`
    SELECT g.id AS id, g.name AS name, COUNT(mg.movie_id) AS count
    FROM genres g
    JOIN movie_genres mg ON mg.genre_id = g.id
    GROUP BY g.id, g.name
    ORDER BY g.name
  `);

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
    const movie = reader.getMovie(id);
    if (!movie) {
      throw new Error(`Failed to persist movie ${id}`);
    }
    return movie;
  }

  const updateMovieGraph = db.transaction((id: string, patch: MoviePatch) => {
    const existing = reader.getMovie(id);
    if (!existing) {
      throw new Error(`Unknown movie: ${id}`);
    }

    // Emit a `SET` only for the scalar keys actually present on the patch; an
    // omitted key leaves its column untouched. `updated_at` always refreshes.
    const assignments: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const { key, column, toDb } of PATCH_SCALARS) {
      const value = patch[key];
      if (value !== undefined) {
        assignments.push(`${column} = @${column}`);
        params[column] = toDb ? toDb(value) : value;
      }
    }
    assignments.push('updated_at = @updated_at');
    params.updated_at = new Date().toISOString();
    db.prepare(
      `UPDATE movies SET ${assignments.join(', ')} WHERE id = @id`
    ).run(params);

    // A supplied collection replaces the whole set: drop the old links/tracks,
    // then re-insert in the given order with fresh positions (and subtitle ids).
    if (patch.genres !== undefined) {
      deleteMovieGenres.run(id);
      patch.genres.forEach((name, position) => {
        const genre = selectGenreIdByName.get(name) as
          | { id: string }
          | undefined;
        if (!genre) {
          throw new Error(`Unknown genre: ${name}`);
        }
        insertMovieGenre.run({ movie_id: id, genre_id: genre.id, position });
      });
    }

    if (patch.subtitles !== undefined) {
      deleteMovieSubtitles.run(id);
      patch.subtitles.forEach((subtitle, position) => {
        insertSubtitle.run({
          id: randomUUID(),
          movie_id: id,
          path: subtitle.path,
          language: subtitle.language,
          position,
        });
      });
    }
  });

  function updateMovie(id: string, patch: MoviePatch): Movie {
    updateMovieGraph(id, patch);
    const movie = reader.getMovie(id);
    if (!movie) {
      throw new Error(`Failed to persist movie ${id}`);
    }
    return movie;
  }

  function deleteMovie(id: string): void {
    // FK `ON DELETE CASCADE` on movie_genres/subtitles clears the children; an
    // unknown id simply affects zero rows (idempotent no-op).
    deleteMovieRow.run(id);
  }

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

  function setResumePosition(id: string, seconds: number): void {
    updateResumePosition.run(seconds, id);
  }

  function markWatched(id: string): void {
    updateMarkWatched.run(id);
  }

  function markUnwatched(id: string): void {
    updateMarkUnwatched.run(id);
  }

  function setFavorite(id: string, value: boolean): void {
    updateFavorite.run(value ? 1 : 0, id);
  }

  function setRating(id: string, units: number | null): void {
    updateRating.run(units, id);
  }

  return {
    addMovie,
    updateMovie,
    deleteMovie,
    getMovie: reader.getMovie,
    listMovies,
    searchMovies,
    listGenres,
    setResumePosition,
    markWatched,
    markUnwatched,
    setFavorite,
    setRating,
    close() {
      db.close();
    },
  };
}
