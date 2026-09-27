import type { SqliteDatabase } from '../../db';
import type { EnrichScope, Movie, Series } from '@/types';
import type { MovieReader, MovieRow } from '../read/read';
import type { SeriesReader, SeriesRow } from '../series/read/read';

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

/**
 * What a **Sync** may write on a **Series**: the movie's fields at show level,
 * the creator where a film has its director, and the year range. No `rating`
 * and no favorite — the household's own.
 */
export interface SeriesEnrichment {
  tmdbId?: number;
  synopsis?: string;
  posterPath?: string;
  backdropPath?: string;
  year?: number;
  endYear?: number;
  genres?: readonly string[];
  creator?: string;
  cast?: readonly string[];
  originalTitle?: string;
  tmdbScore?: number;
}

/**
 * What a **Sync** may write on an **Episode**: no `watched`, no resume
 * position, no `last_watched_at` — the household's own.
 */
export interface EpisodeEnrichment {
  title?: string;
  airDate?: string;
  stillPath?: string;
  runtimeMinutes?: number;
}

/** One key of an enrichment shape and the column it writes. */
interface Column<K> {
  key: K;
  column: string;
  toDb?: (value: unknown) => unknown;
}

const asJson = (value: unknown): string => JSON.stringify(value);

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

/** Each scalar key and the `series` column it writes. */
const SERIES_COLUMNS: ReadonlyArray<
  Column<Exclude<keyof SeriesEnrichment, 'genres'>>
> = [
  { key: 'tmdbId', column: 'tmdb_id' },
  { key: 'synopsis', column: 'synopsis' },
  { key: 'posterPath', column: 'poster_path' },
  { key: 'backdropPath', column: 'backdrop_path' },
  { key: 'year', column: 'year' },
  { key: 'endYear', column: 'end_year' },
  { key: 'creator', column: 'creator' },
  { key: 'cast', column: 'cast', toDb: asJson },
  { key: 'originalTitle', column: 'original_title' },
  { key: 'tmdbScore', column: 'tmdb_score' },
];

/** Each key and the `episodes` column it writes. */
const EPISODE_COLUMNS: ReadonlyArray<Column<keyof EpisodeEnrichment>> = [
  { key: 'title', column: 'title' },
  { key: 'airDate', column: 'air_date' },
  { key: 'stillPath', column: 'still_path' },
  { key: 'runtimeMinutes', column: 'runtime_minutes' },
];

/** The `SET` list and its parameters for the keys `fields` names. */
function assignmentsOf<K extends string>(
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
  /** {@link enrichMovie} over a **Series**: the columns named, only those. */
  enrichSeries(id: string, fields: SeriesEnrichment): void;
  /** {@link enrichMovie} over one **Episode**; never its watch state. */
  enrichEpisode(id: string, fields: EpisodeEnrichment): void;
  /**
   * The titles a library-wide Sync snapshots, with their current values:
   * `missing` is every film without **Full details** (a synopsis and a
   * poster), `all` every film.
   */
  moviesInScope(scope: Exclude<EnrichScope, 'single'>): Movie[];
  /** {@link moviesInScope} over the series. */
  seriesInScope(scope: Exclude<EnrichScope, 'single'>): Series[];
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

/** No synopsis or no poster: a title without **Full details**. */
const MISSING =
  "synopsis IS NULL OR synopsis = '' OR poster_path IS NULL OR poster_path = ''";

/** {@link MISSING} over the movie reader's `m` alias. */
const MISSING_WHERE =
  "WHERE m.synopsis IS NULL OR m.synopsis = '' OR m.poster_path IS NULL OR m.poster_path = ''";

/** A synopsis and a poster both: a row with **Full details**. */
const FULL_DETAILS =
  "synopsis IS NOT NULL AND synopsis <> '' AND poster_path IS NOT NULL AND poster_path <> ''";

export function createEnrich(
  db: SqliteDatabase,
  reader: MovieReader,
  seriesReader: SeriesReader
): Enrich {
  const selectGenreIdByName = db.prepare(
    'SELECT id FROM genres WHERE name = ?'
  );
  const deleteMovieGenres = db.prepare(
    'DELETE FROM movie_genres WHERE movie_id = ?'
  );
  const insertMovieGenre = db.prepare(
    'INSERT INTO movie_genres (movie_id, genre_id, position) VALUES (@movie_id, @genre_id, @position)'
  );
  const deleteSeriesGenres = db.prepare(
    'DELETE FROM series_genres WHERE series_id = ?'
  );
  const insertSeriesGenre = db.prepare(
    'INSERT INTO series_genres (series_id, genre_id, position) VALUES (@series_id, @genre_id, @position)'
  );

  /** A pool genre's id; a name the pool does not hold is refused. */
  function genreId(name: string): string {
    const genre = selectGenreIdByName.get(name) as { id: string } | undefined;
    if (!genre) {
      throw new Error(`Unknown genre: ${name}`);
    }
    return genre.id;
  }

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

  const enrichSeries = db.transaction(
    (id: string, fields: SeriesEnrichment) => {
      const { assignments, params } = assignmentsOf(SERIES_COLUMNS, fields, id);
      db.prepare(
        `UPDATE series SET ${assignments.join(', ')} WHERE id = @id`
      ).run(params);

      if (fields.genres !== undefined) {
        deleteSeriesGenres.run(id);
        fields.genres.forEach((name, position) => {
          insertSeriesGenre.run({
            series_id: id,
            genre_id: genreId(name),
            position,
          });
        });
      }
    }
  );

  function enrichEpisode(id: string, fields: EpisodeEnrichment): void {
    const { assignments, params } = assignmentsOf(EPISODE_COLUMNS, fields, id);
    db.prepare(
      `UPDATE episodes SET ${assignments.join(', ')} WHERE id = @id`
    ).run(params);
  }

  function moviesInScope(scope: Exclude<EnrichScope, 'single'>): Movie[] {
    const where = scope === 'missing' ? MISSING_WHERE : '';
    const rows = db
      .prepare(
        `SELECT m.* FROM movies m ${where} ORDER BY m.title COLLATE NOCASE, m.id`
      )
      .all() as MovieRow[];
    return reader.assembleMany(rows, where, []);
  }

  function seriesInScope(scope: Exclude<EnrichScope, 'single'>): Series[] {
    const where = scope === 'missing' ? `WHERE ${MISSING}` : '';
    const rows = db
      .prepare(
        `SELECT * FROM series ${where} ORDER BY title COLLATE NOCASE, id`
      )
      .all() as SeriesRow[];
    return seriesReader.assembleMany(rows);
  }

  const countTitles = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM movies) + (SELECT COUNT(*) FROM series) AS total,
       (SELECT COUNT(*) FROM movies WHERE ${FULL_DETAILS})
         + (SELECT COUNT(*) FROM series WHERE ${FULL_DETAILS}) AS complete`
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
    enrichSeries,
    enrichEpisode,
    moviesInScope,
    seriesInScope,
    enrichmentCounts,
  };
}
