import type { SqliteDatabase } from '../../../db';
import type { EnrichScope, Series } from '@/types';
import {
  asJson,
  assignmentsOf,
  fullDetails,
  poolGenreIds,
  type Column,
} from '../../enrich/enrich';
import type { SeriesReader, SeriesRow } from '../read/read';

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

export interface SeriesEnrich {
  /** `enrichMovie` over a **Series**: the columns named, only those. */
  enrichSeries(id: string, fields: SeriesEnrichment): void;
  /** `enrichMovie` over one **Episode**; never its watch state. */
  enrichEpisode(id: string, fields: EpisodeEnrichment): void;
  /**
   * The series a library-wide Sync snapshots, with their current values:
   * `missing` is every series without **Full details**, `all` every series.
   */
  seriesInScope(scope: Exclude<EnrichScope, 'single'>): Series[];
}

/**
 * The series' enrichment writes, created from the series reader the way
 * `series/browse` is: the rules are the movie's, the tables are these.
 */
export function createSeriesEnrich(
  db: SqliteDatabase,
  seriesReader: SeriesReader
): SeriesEnrich {
  const genreId = poolGenreIds(db);
  const deleteSeriesGenres = db.prepare(
    'DELETE FROM series_genres WHERE series_id = ?'
  );
  const insertSeriesGenre = db.prepare(
    'INSERT INTO series_genres (series_id, genre_id, position) VALUES (@series_id, @genre_id, @position)'
  );

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

  function seriesInScope(scope: Exclude<EnrichScope, 'single'>): Series[] {
    const where = scope === 'missing' ? `WHERE ${fullDetails(true)}` : '';
    const rows = db
      .prepare(
        `SELECT * FROM series ${where} ORDER BY title COLLATE NOCASE, id`
      )
      .all() as SeriesRow[];
    return seriesReader.assembleMany(rows);
  }

  return { enrichSeries, enrichEpisode, seriesInScope };
}
