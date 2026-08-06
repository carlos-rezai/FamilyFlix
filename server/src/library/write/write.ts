import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from '../../db';
import type { Movie, MoviePatch, NewMovie } from '@/types';
import type { MovieReader } from '../read/read';

/**
 * Every scalar {@link MoviePatch} key mapped to its `movies` column and (where
 * needed) a value coercion. Drives {@link Write.updateMovie}'s dynamic `SET`
 * list: only keys present on the patch are emitted, so an omitted key leaves its
 * column untouched. `genres`/`subtitles` are handled separately (other tables).
 *
 * This spans all patchable columns — including `rating`, `is_favorite`,
 * `watched`, and `resume_position_seconds` — so `updateMovie` is the single
 * general write path; it applies no side-effect conventions (e.g. setting
 * `watched` does not zero the resume position).
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
  { key: 'rating', column: 'rating' },
  { key: 'isFavorite', column: 'is_favorite', toDb: (v) => (v ? 1 : 0) },
  { key: 'watched', column: 'watched', toDb: (v) => (v ? 1 : 0) },
  { key: 'resumePositionSeconds', column: 'resume_position_seconds' },
  { key: 'videoPath', column: 'video_path' },
  { key: 'posterPath', column: 'poster_path' },
  { key: 'backdropPath', column: 'backdrop_path' },
];

/** The movie-lifecycle slice: the transactional insert, the all-or-nothing
 *  metadata patch, and the cascading delete. Each write returns through the
 *  shared {@link MovieReader} so callers get the fully-assembled persisted model. */
export interface Write {
  addMovie(input: NewMovie): Movie;
  updateMovie(id: string, patch: MoviePatch): Movie;
  deleteMovie(id: string): void;
}

export function createWrite(db: SqliteDatabase, reader: MovieReader): Write {
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
  const deleteMovieGenres = db.prepare(
    'DELETE FROM movie_genres WHERE movie_id = ?'
  );
  const deleteMovieSubtitles = db.prepare(
    'DELETE FROM subtitles WHERE movie_id = ?'
  );
  const deleteMovieRow = db.prepare('DELETE FROM movies WHERE id = ?');

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

  return { addMovie, updateMovie, deleteMovie };
}
