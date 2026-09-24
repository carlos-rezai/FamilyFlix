import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from '../../../db';
import type { Episode, NewEpisode, NewSeries, Series } from '@/types';
import type { SeriesReader } from '../read/read';

export interface SeriesWrite {
  /**
   * Insert a series and its genres (ordered) in one transaction, returning the
   * assembled model. An unknown genre throws and commits nothing.
   */
  addSeries(input: NewSeries): Series;
  /**
   * Insert one episode under a series the library holds, unwatched at zero,
   * returning the assembled model, its subtitle tracks written with it in one
   * transaction. A second episode under one series, season
   * and number is refused by the schema.
   */
  addEpisode(seriesId: string, input: NewEpisode): Episode;
  /**
   * Set one series' favorite flag. Answers whether the library holds that
   * series — `false` for an unknown id, a movie's among them, touching nothing.
   */
  setSeriesFavorite(id: string, value: boolean): boolean;
}

/** The series' writes — the movie's `addMovie` over the series tables. */
export function createSeriesWrite(
  db: SqliteDatabase,
  reader: SeriesReader
): SeriesWrite {
  const insertSeries = db.prepare(`
    INSERT INTO series (
      id, tmdb_id, title, year, end_year, synopsis, creator, cast, rating,
      is_favorite, poster_path, backdrop_path, created_at, updated_at
    ) VALUES (
      @id, @tmdb_id, @title, @year, @end_year, @synopsis, @creator, @cast, @rating,
      0, @poster_path, @backdrop_path, @created_at, @updated_at
    )
  `);
  const selectGenreIdByName = db.prepare(
    'SELECT id FROM genres WHERE name = ?'
  );
  const insertSeriesGenre = db.prepare(
    'INSERT INTO series_genres (series_id, genre_id, position) VALUES (?, ?, ?)'
  );
  const insertEpisode = db.prepare(`
    INSERT INTO episodes (
      id, series_id, season_number, episode_number, title, air_date,
      runtime_minutes, video_path, created_at, updated_at
    ) VALUES (
      @id, @series_id, @season_number, @episode_number, @title, @air_date,
      @runtime_minutes, @video_path, @created_at, @updated_at
    )
  `);
  const insertEpisodeSubtitle = db.prepare(`
    INSERT INTO episode_subtitles (id, episode_id, path, language, position)
    VALUES (@id, @episode_id, @path, @language, @position)
  `);

  const updateFavorite = db.prepare(
    'UPDATE series SET is_favorite = ? WHERE id = ?'
  );

  const insertSeriesGraph = db.transaction((id: string, input: NewSeries) => {
    const now = new Date().toISOString();
    insertSeries.run({
      id,
      tmdb_id: input.tmdbId ?? null,
      title: input.title,
      year: input.year ?? null,
      end_year: input.endYear ?? null,
      synopsis: input.synopsis ?? null,
      creator: input.creator ?? null,
      cast: input.cast ? JSON.stringify(input.cast) : null,
      rating: input.rating ?? null,
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
      insertSeriesGenre.run(id, genre.id, position);
    });
  });

  const insertEpisodeGraph = db.transaction(
    (id: string, seriesId: string, input: NewEpisode) => {
      const now = new Date().toISOString();
      insertEpisode.run({
        id,
        series_id: seriesId,
        season_number: input.season,
        episode_number: input.number,
        title: input.title ?? null,
        air_date: input.airDate ?? null,
        runtime_minutes: input.runtimeMinutes ?? null,
        video_path: input.videoPath,
        created_at: now,
        updated_at: now,
      });
      input.subtitles?.forEach((track, position) => {
        insertEpisodeSubtitle.run({
          id: randomUUID(),
          episode_id: id,
          path: track.path,
          language: track.language,
          position,
        });
      });
    }
  );

  return {
    addSeries: (input) => {
      const id = randomUUID();
      insertSeriesGraph(id, input);
      return reader.getSeries(id) as Series;
    },

    addEpisode: (seriesId, input) => {
      const id = randomUUID();
      insertEpisodeGraph(id, seriesId, input);
      return reader.getEpisode(id) as Episode;
    },

    setSeriesFavorite: (id, value) =>
      updateFavorite.run(value ? 1 : 0, id).changes > 0,
  };
}
