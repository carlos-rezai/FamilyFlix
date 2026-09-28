import type { SqliteDatabase } from '../../db';
import type { EnrichScope, Movie } from '@/types';
import type { MovieReader, MovieRow } from '../read/read';

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

/** One key of an enrichment shape and the column it writes. */
export interface Column<K> {
  key: K;
  column: string;
  toDb?: (value: unknown) => unknown;
}

export const asJson = (value: unknown): string => JSON.stringify(value);

/** Each scalar key and the `movies` column it writes. */
const COLUMNS: ReadonlyArray<Column<Exclude<keyof MovieEnrichment, 'genres'>>> =
  [
    { key: 'tmdbId', column: 'tmdb_id' },
    { key: 'synopsis', column: 'synopsis' },
    { key: 'posterPath', column: 'poster_path' },
    { key: 'backdropPath', column: 'backdrop_path' },
    { key: 'runtimeMinutes', column: 'runtime_minutes' },
    { key: 'year', column: 'year' },
    { key: 'director', column: 'director' },
    { key: 'cast', column: 'cast', toDb: asJson },
    { key: 'originalTitle', column: 'original_title' },
    { key: 'tmdbScore', column: 'tmdb_score' },
  ];

/** The `SET` list and its parameters for the keys `fields` names. */
export function assignmentsOf<K extends string>(
  columns: ReadonlyArray<Column<K>>,
  fields: Partial<Record<K, unknown>>,
  id: string
): { assignments: string[]; params: Record<string, unknown> } {
  const assignments: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const { key, column, toDb } of columns) {
    const value = fields[key];
    if (value !== undefined) {
      assignments.push(`${column} = @${column}`);
      params[column] = toDb ? toDb(value) : value;
    }
  }
  assignments.push('updated_at = @updated_at');
  params.updated_at = new Date().toISOString();
  return { assignments, params };
}

export interface Enrich {
  /**
   * Write the columns `fields` names, and only those, in one transaction. A
   * key left out is a column left alone; `genres` replaces the movie's whole
   * set. Not `updateMovie`: that is the general edit path, this one's promise
   * is narrower.
   */
  enrichMovie(id: string, fields: MovieEnrichment): void;
  /**
   * The titles a library-wide Sync snapshots, with their current values:
   * `missing` is every film without **Full details** (a synopsis and a
   * poster), `all` every film.
   */
  moviesInScope(scope: Exclude<EnrichScope, 'single'>): Movie[];
  /**
   * Every **Movie** and **Series** in the library, and those of them with
   * **Full details** — a synopsis and a poster both. Zeros when empty.
   */
  enrichmentCounts(): { total: number; complete: number };
  /**
   * Record a **Movie**'s or **Series**' Source folder, relative to the Library
   * root, and nothing else. Answers whether the library holds that id.
   */
  setSourceFolder(id: string, folder: string): boolean;
  /** A Movie's or Series' recorded Source folder, `null` when none is. */
  sourceFolder(id: string): string | null;
}

/** The two columns a title needs for **Full details**: a synopsis and a poster. */
const DETAIL_COLUMNS = ['synopsis', 'poster_path'] as const;

/**
 * **Full details** as SQL over a `movies` or `series` row, under `alias` when
 * the query names one: every detail column filled — or, `missing`, any empty.
 */
export function fullDetails(missing: boolean, alias = ''): string {
  const at = alias === '' ? '' : `${alias}.`;
  return DETAIL_COLUMNS.map((column) =>
    missing
      ? `${at}${column} IS NULL OR ${at}${column} = ''`
      : `${at}${column} IS NOT NULL AND ${at}${column} <> ''`
  ).join(missing ? ' OR ' : ' AND ');
}

/** A pool genre's id by name; a name the pool does not hold is refused. */
export function poolGenreIds(db: SqliteDatabase): (name: string) => string {
  const selectGenreIdByName = db.prepare(
    'SELECT id FROM genres WHERE name = ?'
  );
  return (name) => {
    const genre = selectGenreIdByName.get(name) as { id: string } | undefined;
    if (!genre) {
      throw new Error(`Unknown genre: ${name}`);
    }
    return genre.id;
  };
}

export function createEnrich(db: SqliteDatabase, reader: MovieReader): Enrich {
  const genreId = poolGenreIds(db);
  const deleteMovieGenres = db.prepare(
    'DELETE FROM movie_genres WHERE movie_id = ?'
  );
  const insertMovieGenre = db.prepare(
    'INSERT INTO movie_genres (movie_id, genre_id, position) VALUES (@movie_id, @genre_id, @position)'
  );

  const enrichMovie = db.transaction((id: string, fields: MovieEnrichment) => {
    const { assignments, params } = assignmentsOf(COLUMNS, fields, id);
    db.prepare(
      `UPDATE movies SET ${assignments.join(', ')} WHERE id = @id`
    ).run(params);

    if (fields.genres !== undefined) {
      deleteMovieGenres.run(id);
      fields.genres.forEach((name, position) => {
        insertMovieGenre.run({
          movie_id: id,
          genre_id: genreId(name),
          position,
        });
      });
    }
  });

  function moviesInScope(scope: Exclude<EnrichScope, 'single'>): Movie[] {
    const where = scope === 'missing' ? `WHERE ${fullDetails(true, 'm')}` : '';
    const rows = db
      .prepare(
        `SELECT m.* FROM movies m ${where} ORDER BY m.title COLLATE NOCASE, m.id`
      )
      .all() as MovieRow[];
    return reader.assembleMany(rows, where, []);
  }

  const countTitles = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM movies) + (SELECT COUNT(*) FROM series) AS total,
       (SELECT COUNT(*) FROM movies WHERE ${fullDetails(false)})
         + (SELECT COUNT(*) FROM series WHERE ${fullDetails(false)}) AS complete`
  );

  function enrichmentCounts(): { total: number; complete: number } {
    const { total, complete } = countTitles.get() as {
      total: number;
      complete: number;
    };
    return { total, complete };
  }

  const updateMovieSource = db.prepare(
    'UPDATE movies SET source_folder = ? WHERE id = ?'
  );
  const updateSeriesSource = db.prepare(
    'UPDATE series SET source_folder = ? WHERE id = ?'
  );
  const selectSource = db.prepare(
    `SELECT source_folder FROM movies WHERE id = @id
     UNION ALL SELECT source_folder FROM series WHERE id = @id`
  );

  function setSourceFolder(id: string, folder: string): boolean {
    return (
      updateMovieSource.run(folder, id).changes +
        updateSeriesSource.run(folder, id).changes >
      0
    );
  }

  function sourceFolder(id: string): string | null {
    const row = selectSource.get({ id }) as
      | { source_folder: string | null }
      | undefined;
    return row?.source_folder ?? null;
  }

  return {
    setSourceFolder,
    sourceFolder,
    enrichMovie,
    moviesInScope,
    enrichmentCounts,
  };
}
