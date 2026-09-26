import type { SqliteDatabase } from '../../db';

/**
 * What a **Sync** may write on a **Movie**, and nothing else: no `rating`, no
 * `watched`, no resume position, no `last_watched_at` — those are the
 * household's own signals, and not a key this shape has.
 */
export interface MovieEnrichment {
  tmdbId?: number;
  synopsis?: string;
  posterPath?: string;
  backdropPath?: string;
  runtimeMinutes?: number;
  year?: number;
  genres?: readonly string[];
  director?: string;
  cast?: readonly string[];
  originalTitle?: string;
  tmdbScore?: number;
}

/** Each scalar key and the `movies` column it writes. */
const COLUMNS: ReadonlyArray<{
  key: Exclude<keyof MovieEnrichment, 'genres'>;
  column: string;
  toDb?: (value: unknown) => unknown;
}> = [
  { key: 'tmdbId', column: 'tmdb_id' },
  { key: 'synopsis', column: 'synopsis' },
  { key: 'posterPath', column: 'poster_path' },
  { key: 'backdropPath', column: 'backdrop_path' },
  { key: 'runtimeMinutes', column: 'runtime_minutes' },
  { key: 'year', column: 'year' },
  { key: 'director', column: 'director' },
  { key: 'cast', column: 'cast', toDb: (v) => JSON.stringify(v) },
  { key: 'originalTitle', column: 'original_title' },
  { key: 'tmdbScore', column: 'tmdb_score' },
];

export interface Enrich {
  /**
   * Write the columns `fields` names, and only those, in one transaction. A
   * key left out is a column left alone; `genres` replaces the movie's whole
   * set. Not `updateMovie`: that is the general edit path, this one's promise
   * is narrower.
   */
  enrichMovie(id: string, fields: MovieEnrichment): void;
}

export function createEnrich(db: SqliteDatabase): Enrich {
  const selectGenreIdByName = db.prepare(
    'SELECT id FROM genres WHERE name = ?'
  );
  const deleteMovieGenres = db.prepare(
    'DELETE FROM movie_genres WHERE movie_id = ?'
  );
  const insertMovieGenre = db.prepare(
    'INSERT INTO movie_genres (movie_id, genre_id, position) VALUES (@movie_id, @genre_id, @position)'
  );

  const enrichMovie = db.transaction((id: string, fields: MovieEnrichment) => {
    const assignments: string[] = [];
    const params: Record<string, unknown> = { id };
    for (const { key, column, toDb } of COLUMNS) {
      const value = fields[key];
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

    if (fields.genres !== undefined) {
      deleteMovieGenres.run(id);
      fields.genres.forEach((name, position) => {
        const genre = selectGenreIdByName.get(name) as
          | { id: string }
          | undefined;
        if (!genre) {
          throw new Error(`Unknown genre: ${name}`);
        }
        insertMovieGenre.run({ movie_id: id, genre_id: genre.id, position });
      });
    }
  });

  return { enrichMovie };
}
