import type { SqliteDatabase } from '../../../db';
import type { EnrichScope, Series } from '@/types';
import {
  addedSince,
  asJson,
  assignmentsOf,
  poolGenreIds,
  syncGap,
  type Column,
} from '../../enrich/enrich';
import type { SeriesReader, SeriesRow } from '../read/read';

/**
 * What a **Sync** may write on a **Series**: the movie's fields at show level,
 * the creator where a film has its director, and the year range. No `rating`
 * and no favorite — the household's own.
 */
export interface SeriesEnrichment {
  /** Written only by a pick from the review — the **Title fix**. */
  title?: string;
  tmdbId?: number;
  synopsis?: string;
  posterPath?: string;
  backdropPath?: string;
  year?: number;
  /** `null` clears it: an open run, _Apply choices_' sheet side. */
  endYear?: number | null;
  genres?: readonly string[];
  creator?: string;
  cast?: readonly string[];
  originalTitle?: string;
  tmdbScore?: number;
}

/**
 * Where an episode's **Still** came from — a Sync's TMDB still, a frame off
 * its own video, or one picked in the series form. Server side only: the
 * assembled `Episode` does not carry it.
 */
export type StillSource = 'tmdb' | 'frame' | 'picked';

/**
 * What a **Sync** may write on an **Episode**: no `watched`, no resume
 * position, no `last_watched_at` — the household's own.
 */
export interface EpisodeEnrichment {
  title?: string;
  airDate?: string;
  stillPath?: string;
  /** Written with `stillPath`, never alone. */
  stillSource?: StillSource;
  runtimeMinutes?: number;
}

/** Each scalar key and the `series` column it writes. */
const SERIES_COLUMNS: ReadonlyArray<
  Column<Exclude<keyof SeriesEnrichment, 'genres'>>
> = [
  { key: 'title', column: 'title' },
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
  { key: 'stillSource', column: 'still_source' },
  { key: 'runtimeMinutes', column: 'runtime_minutes' },
];

export interface SeriesEnrich {
  /** `enrichMovie` over a **Series**: the columns named, only those. */
  enrichSeries(id: string, fields: SeriesEnrichment): void;
  /** `enrichMovie` over one **Episode**; never its watch state. */
  enrichEpisode(id: string, fields: EpisodeEnrichment): void;
  /**
   * The series a library-wide Sync snapshots, with their current values:
   * `missing` is every series with a **Sync gap** (`syncGap`), `all` every
   * series, `added` every series created at or after `since` or holding an
   * **Episode** created at or after it.
   */
  seriesInScope(
    scope: Exclude<EnrichScope, 'single'>,
    since?: string
  ): Series[];
  /**
   * Store one season's **Season poster**, a Stored path: an upsert over
   * `(seriesId, season)`. Refuses a series the library does not hold.
   */
  setSeasonPoster(seriesId: string, season: number, posterPath: string): void;
  /**
   * Each episode's **Still source** by episode id, for one series — read once
   * per show by a Sync's pass. An episode with no still is absent.
   */
  stillSourcesOf(seriesId: string): ReadonlyMap<string, StillSource>;
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

  function seriesInScope(
    scope: Exclude<EnrichScope, 'single'>,
    since?: string
  ): Series[] {
    const added = scope === 'added';
    const where =
      scope === 'missing'
        ? `WHERE ${syncGap('', 'series')}`
        : added
          ? `WHERE ${addedSince('', 'series')}`
          : '';
    const params = added ? [{ since: since ?? '' }] : [];
    const rows = db
      .prepare(
        `SELECT * FROM series ${where} ORDER BY title COLLATE NOCASE, id`
      )
      .all(...params) as SeriesRow[];
    return seriesReader.assembleMany(rows);
  }

  const upsertSeasonPoster = db.prepare(
    `INSERT INTO season_posters (series_id, season_number, poster_path)
     VALUES (?, ?, ?)
     ON CONFLICT (series_id, season_number)
     DO UPDATE SET poster_path = excluded.poster_path`
  );

  function setSeasonPoster(
    seriesId: string,
    season: number,
    posterPath: string
  ): void {
    upsertSeasonPoster.run(seriesId, season, posterPath);
  }

  const selectStillSources = db.prepare(
    `SELECT id, still_source FROM episodes
     WHERE series_id = ? AND still_path IS NOT NULL AND still_source IS NOT NULL`
  );

  function stillSourcesOf(seriesId: string): ReadonlyMap<string, StillSource> {
    const rows = selectStillSources.all(seriesId) as Array<{
      id: string;
      still_source: StillSource;
    }>;
    return new Map(rows.map((row) => [row.id, row.still_source]));
  }

  return {
    enrichSeries,
    enrichEpisode,
    seriesInScope,
    setSeasonPoster,
    stillSourcesOf,
  };
}
