import { join } from 'node:path';

import type { SqliteDatabase } from '../../db';
import type { EnrichScope, Movie } from '@/types';
import type { MovieReader, MovieRow } from '../read/read';

/**
 * What a **Sync** may write on a **Movie**, and nothing else: no `rating`, no
 * `watched`, no resume position, no `last_watched_at` — those are the
 * household's own signals, and not a key this shape has.
 */
export interface MovieEnrichment {
  /** Written only by a pick from the review — the **Title fix**. */
  title?: string;
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

/** Where a title was recorded as coming from: both of its source columns. */
export interface TitleSource {
  folderId: string;
  sourceFolder: string;
  /**
   * A **Collection folder** film's **Source file**, its video's path relative
   * to the Source folder — present only for such a film.
   */
  sourceFile?: string;
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
    { key: 'title', column: 'title' },
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

/** The summary's three counts over every Movie and Series. */
export interface EnrichmentCounts {
  total: number;
  complete: number;
  gaps: number;
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
   * `missing` is every film with a **Sync gap** (`syncGap`), `all` every
   * film, `added` every film created at or after `since`.
   */
  moviesInScope(scope: Exclude<EnrichScope, 'single'>, since?: string): Movie[];
  /**
   * Every **Movie** and **Series** in the library, and those of them with
   * **Full details** — a synopsis and a poster both — and those with a
   * **Sync gap**, what _Only what's missing_ will sync. Zeros when empty.
   */
  enrichmentCounts(): EnrichmentCounts;
  /**
   * Record where a **Movie** or **Series** came from, both columns in one
   * call: the **Library folder** it was found under and its Source folder
   * relative to that folder — and for a **Collection folder** film its
   * **Source file**, `null` for any other. Answers whether the library holds
   * that id.
   */
  setSourceFolder(
    id: string,
    folderId: string,
    sourceFolder: string,
    sourceFile?: string | null
  ): boolean;
  /**
   * Where a Movie or Series was recorded as coming from, both columns in one
   * query: its Library folder's id and its Source folder — `null` for a title
   * with no folder.
   */
  titleSource(id: string): TitleSource | null;
  /**
   * A title's recorded **Media folder**, relative to the Managed media
   * directory — `null` for an id that kind does not hold, or none recorded.
   * Server side only: the assembled records never carry it.
   */
  mediaFolderOf(kind: 'movie' | 'series', id: string): string | null;
  /**
   * The title's Library folder path joined to its Source folder, in one query
   * over both columns — `null` for a title with no folder.
   */
  sourcePath(id: string): string | null;
  /**
   * The **Movie** or **Series** recorded at this Library folder and Source
   * folder, whatever its title says now — `null` when none is. Given a
   * **Source file**, only the Collection folder film recorded with it.
   */
  titleAt(
    folderId: string,
    sourceFolder: string,
    sourceFile?: string | null
  ): string | null;
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

/** An episode column a Sync fills, each empty one a **Sync gap**. */
const EPISODE_COLUMNS = ['title', 'air_date', 'still_path'] as const;

/**
 * The **Sync gap** as SQL over a `movies` or `series` row, under `alias` when
 * the query names one: not **Full details**, or **Unmatched** (no `tmdb_id`).
 * For a `series` row, also an **Episode** on disk without its title, air date
 * or **Still**, or a **Season** on disk without its **Season poster** —
 * season 0 never, since no Sync reads it.
 */
export function syncGap(
  alias = '',
  kind: 'movies' | 'series' = 'movies'
): string {
  const at = alias === '' ? '' : `${alias}.`;
  const own = `${fullDetails(true, alias)} OR ${at}tmdb_id IS NULL`;
  if (kind === 'movies') return own;
  const seriesId = alias === '' ? 'series.id' : `${alias}.id`;
  const emptyEpisode = EPISODE_COLUMNS.map(
    (column) => `gap_e.${column} IS NULL OR gap_e.${column} = ''`
  ).join(' OR ');
  return `${own}
    OR EXISTS (SELECT 1 FROM episodes gap_e
      WHERE gap_e.series_id = ${seriesId} AND gap_e.season_number > 0
        AND (${emptyEpisode}
          OR NOT EXISTS (SELECT 1 FROM season_posters gap_p
            WHERE gap_p.series_id = gap_e.series_id
              AND gap_p.season_number = gap_e.season_number)))`;
}

/**
 * The window _Just what was added_ syncs, as SQL over a `movies` or `series`
 * row, under `alias` when the query names one: a row created at or after
 * `@since`. For a `series` row, also an **Episode** created at or after it.
 */
export function addedSince(
  alias = '',
  kind: 'movies' | 'series' = 'movies'
): string {
  const at = alias === '' ? '' : `${alias}.`;
  const own = `${at}created_at >= @since`;
  if (kind === 'movies') return own;
  const seriesId = alias === '' ? 'series.id' : `${alias}.id`;
  return `${own}
    OR EXISTS (SELECT 1 FROM episodes added_e
      WHERE added_e.series_id = ${seriesId} AND added_e.created_at >= @since)`;
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

  function moviesInScope(
    scope: Exclude<EnrichScope, 'single'>,
    since?: string
  ): Movie[] {
    const added = scope === 'added';
    const where =
      scope === 'missing'
        ? `WHERE ${syncGap('m')}`
        : added
          ? `WHERE ${addedSince('m')}`
          : '';
    const params = added ? [{ since: since ?? '' }] : [];
    const rows = db
      .prepare(
        `SELECT m.* FROM movies m ${where} ORDER BY m.title COLLATE NOCASE, m.id`
      )
      .all(...params) as MovieRow[];
    return reader.assembleMany(rows, where, params);
  }

  const countTitles = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM movies) + (SELECT COUNT(*) FROM series) AS total,
       (SELECT COUNT(*) FROM movies WHERE ${fullDetails(false)})
         + (SELECT COUNT(*) FROM series WHERE ${fullDetails(false)}) AS complete,
       (SELECT COUNT(*) FROM movies WHERE ${syncGap()})
         + (SELECT COUNT(*) FROM series WHERE ${syncGap('', 'series')}) AS gaps`
  );

  function enrichmentCounts(): EnrichmentCounts {
    const { total, complete, gaps } = countTitles.get() as EnrichmentCounts;
    return { total, complete, gaps };
  }

  const updateMovieSource = db.prepare(
    'UPDATE movies SET library_folder_id = ?, source_folder = ?, source_file = ? WHERE id = ?'
  );
  const updateSeriesSource = db.prepare(
    'UPDATE series SET library_folder_id = ?, source_folder = ? WHERE id = ?'
  );
  const selectAt = db.prepare(
    `SELECT id FROM movies WHERE library_folder_id = @folderId AND source_folder = @sourceFolder
     UNION ALL SELECT id FROM series WHERE library_folder_id = @folderId AND source_folder = @sourceFolder
     LIMIT 1`
  );
  const selectFileAt = db.prepare(
    `SELECT id FROM movies WHERE library_folder_id = @folderId
       AND source_folder = @sourceFolder AND source_file = @sourceFile
     LIMIT 1`
  );
  const selectSource = db.prepare(
    `SELECT library_folder_id, source_folder, source_file FROM movies
       WHERE id = @id AND library_folder_id IS NOT NULL
         AND source_folder IS NOT NULL
     UNION ALL SELECT library_folder_id, source_folder, NULL FROM series
       WHERE id = @id AND library_folder_id IS NOT NULL
         AND source_folder IS NOT NULL`
  );

  const selectPath = db.prepare(
    `SELECT f.path, m.source_folder FROM movies m
       JOIN library_folders f ON f.id = m.library_folder_id
       WHERE m.id = @id AND m.source_folder IS NOT NULL
     UNION ALL SELECT f.path, s.source_folder FROM series s
       JOIN library_folders f ON f.id = s.library_folder_id
       WHERE s.id = @id AND s.source_folder IS NOT NULL`
  );

  function setSourceFolder(
    id: string,
    folderId: string,
    sourceFolder: string,
    sourceFile: string | null = null
  ): boolean {
    return (
      updateMovieSource.run(folderId, sourceFolder, sourceFile, id).changes +
        updateSeriesSource.run(folderId, sourceFolder, id).changes >
      0
    );
  }

  function titleAt(
    folderId: string,
    sourceFolder: string,
    sourceFile: string | null = null
  ): string | null {
    const row = (
      sourceFile === null
        ? selectAt.get({ folderId, sourceFolder })
        : selectFileAt.get({ folderId, sourceFolder, sourceFile })
    ) as { id: string } | undefined;
    return row?.id ?? null;
  }

  function sourcePath(id: string): string | null {
    const row = selectPath.get({ id }) as
      | { path: string; source_folder: string }
      | undefined;
    return row === undefined ? null : join(row.path, row.source_folder);
  }

  const selectMediaFolder = {
    movie: db.prepare('SELECT media_folder FROM movies WHERE id = ?'),
    series: db.prepare('SELECT media_folder FROM series WHERE id = ?'),
  };

  function mediaFolderOf(kind: 'movie' | 'series', id: string): string | null {
    const row = selectMediaFolder[kind].get(id) as
      | { media_folder: string | null }
      | undefined;
    return row?.media_folder ?? null;
  }

  function titleSource(id: string): TitleSource | null {
    const row = selectSource.get({ id }) as
      | {
          library_folder_id: string;
          source_folder: string;
          source_file: string | null;
        }
      | undefined;
    if (row === undefined) return null;
    return {
      folderId: row.library_folder_id,
      sourceFolder: row.source_folder,
      ...(row.source_file === null ? {} : { sourceFile: row.source_file }),
    };
  }

  return {
    setSourceFolder,
    titleSource,
    mediaFolderOf,
    sourcePath,
    titleAt,
    enrichMovie,
    moviesInScope,
    enrichmentCounts,
  };
}
