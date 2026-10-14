import { randomUUID } from 'node:crypto';

import type { SqliteDatabase } from '../../../db';
import type {
  Episode,
  NewEpisode,
  NewSeries,
  NewSubtitle,
  Series,
} from '@/types';
import { parentOf } from '../../write/write';
import type { SeriesReader } from '../read/read';

export interface SeriesWrite {
  /**
   * Insert a series and its genres (ordered) in one transaction, returning the
   * assembled model. An unknown genre throws and commits nothing. Given
   * episodes, they and their tracks are written in the same transaction, so a
   * duplicate episode commits nothing either; the importer's one-argument call
   * writes the series alone.
   */
  addSeries(input: NewSeries, episodes?: readonly NewEpisode[]): Series;
  /**
   * Insert one episode under a series the library holds, unwatched at zero,
   * returning the assembled model, its subtitle tracks written with it in one
   * transaction. A second episode under one series, season
   * and number is refused by the schema.
   */
  addEpisode(seriesId: string, input: NewEpisode): Episode;
  /**
   * Delete a series; the cascade takes its episodes, `series_genres` and
   * `episode_subtitles`. A silent no-op for an unknown id, `deleteMovie`'s
   * shape.
   */
  deleteSeries(id: string): void;
  /**
   * The **Series edit job**'s save, in one transaction: the fields, then the
   * **Two-pass renumber** of the held episodes, then the inserts and the
   * removals. A held episode keeps its id, so its watch state, resume position
   * and still survive, and so does its **Source file** while its video stays;
   * a replaced video clears it. Answers the series and the **Stored paths** no row
   * points at any more, to clean up after the commit — or `null` for a series
   * the library does not hold. An id the series does not hold, an id twice or
   * a pair of numbers twice throws and commits nothing.
   */
  updateSeries(id: string, edit: SeriesEdit): SeriesUpdate | null;
}

/** One episode of a {@link SeriesEdit}: held under its `id`, or new without. */
export interface EpisodeEdit {
  id?: string;
  season: number;
  number: number;
  title?: string | null;
  videoPath: string;
  /** Set only when the video was replaced; an omitted key keeps the column. */
  runtimeMinutes?: number | null;
  subtitles?: NewSubtitle[];
}

/** The whole record a series edit describes — every held episode it keeps. */
export interface SeriesEdit {
  title: string;
  year: number | null;
  endYear: number | null;
  synopsis: string | null;
  creator: string | null;
  cast: string[];
  rating: number | null;
  genres: string[];
  posterPath: string | null;
  /** `null` is the **Match unlink**; an omitted key keeps the match. */
  tmdbId?: null;
  episodes: EpisodeEdit[];
}

/** What a series edit answers: the series now, and the files to clean up. */
export interface SeriesUpdate {
  series: Series;
  removedPaths: string[];
}

/** The series' writes — the movie's `addMovie` over the series tables. */
export function createSeriesWrite(
  db: SqliteDatabase,
  reader: SeriesReader
): SeriesWrite {
  const insertSeries = db.prepare(`
    INSERT INTO series (
      id, tmdb_id, title, year, end_year, synopsis, creator, cast, rating,
      is_favorite, poster_path, backdrop_path, created_at, updated_at,
      media_folder
    ) VALUES (
      @id, @tmdb_id, @title, @year, @end_year, @synopsis, @creator, @cast, @rating,
      0, @poster_path, @backdrop_path, @created_at, @updated_at,
      @media_folder
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
      runtime_minutes, video_path, source_file, video_folder_id, created_at,
      updated_at
    ) VALUES (
      @id, @series_id, @season_number, @episode_number, @title, @air_date,
      @runtime_minutes, @video_path, @source_file, @video_folder_id, @created_at,
      @updated_at
    )
  `);
  const fillSeriesFolder = db.prepare(
    'UPDATE series SET media_folder = ? WHERE id = ? AND media_folder IS NULL'
  );
  const insertEpisodeSubtitle = db.prepare(`
    INSERT INTO episode_subtitles (id, episode_id, path, language, position)
    VALUES (@id, @episode_id, @path, @language, @position)
  `);

  const insertSeriesGraph = db.transaction(
    (id: string, input: NewSeries, firstVideo?: string) => {
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
        media_folder:
          input.mediaFolder ??
          parentOf(firstVideo, 2) ??
          parentOf(input.posterPath, 1),
      });
      input.genres?.forEach((name, position) => {
        const genre = selectGenreIdByName.get(name) as
          | { id: string }
          | undefined;
        if (!genre) {
          throw new Error(`Unknown genre: ${name}`);
        }
        insertSeriesGenre.run(id, genre.id, position);
      });
    }
  );

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
        source_file: input.sourceFile ?? null,
        video_folder_id: input.videoFolderId ?? null,
        created_at: now,
        updated_at: now,
      });
      // A series added bare takes its Media folder off its first episode.
      // A linked video sits in a Library folder, so its path names none.
      if (input.videoFolderId === undefined) {
        fillSeriesFolder.run(parentOf(input.videoPath, 2), seriesId);
      }
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

  const deleteSeriesRow = db.prepare('DELETE FROM series WHERE id = ?');

  const insertSeriesWithEpisodes = db.transaction(
    (id: string, input: NewSeries, episodes: readonly NewEpisode[]) => {
      const first = episodes[0];
      insertSeriesGraph(
        id,
        input,
        first?.videoFolderId === undefined ? first?.videoPath : undefined
      );
      for (const episode of episodes) {
        insertEpisodeGraph(randomUUID(), id, episode);
      }
    }
  );

  const updateSeriesRow = db.prepare(`
    UPDATE series SET
      title = @title, year = @year, end_year = @end_year, synopsis = @synopsis,
      creator = @creator, cast = @cast, rating = @rating,
      poster_path = @poster_path, updated_at = @updated_at
    WHERE id = @id
  `);
  const clearSeriesMatch = db.prepare(
    'UPDATE series SET tmdb_id = NULL WHERE id = ?'
  );
  const deleteSeriesGenres = db.prepare(
    'DELETE FROM series_genres WHERE series_id = ?'
  );
  const deleteEpisodeRow = db.prepare('DELETE FROM episodes WHERE id = ?');
  const moveEpisode = db.prepare(
    'UPDATE episodes SET episode_number = ? WHERE id = ?'
  );
  const updateEpisodeRow = db.prepare(`
    UPDATE episodes SET
      season_number = @season_number, episode_number = @episode_number,
      title = @title,
      source_file = CASE WHEN video_path = @video_path THEN source_file END,
      video_folder_id = CASE WHEN video_path = @video_path THEN video_folder_id END,
      video_path = @video_path, updated_at = @updated_at
    WHERE id = @id
  `);
  const setEpisodeRuntime = db.prepare(
    'UPDATE episodes SET runtime_minutes = ? WHERE id = ?'
  );
  const deleteEpisodeSubtitles = db.prepare(
    'DELETE FROM episode_subtitles WHERE episode_id = ?'
  );

  /** Every **Stored path** a series' rows point at. */
  const pathsOf = (series: Series, episodes: readonly Episode[]): string[] => [
    ...(series.posterPath === null ? [] : [series.posterPath]),
    ...episodes.flatMap((episode) => [
      // A Linked video is not a Stored path, and never the app's to remove.
      ...(episode.videoFolderId === null ? [episode.videoPath] : []),
      ...episode.subtitles.map((track) => track.path),
    ]),
  ];

  /** Throw for an id the series does not hold, an id twice or a pair twice. */
  const checkEpisodes = (
    held: ReadonlyMap<string, Episode>,
    episodes: readonly EpisodeEdit[]
  ): Set<string> => {
    const ids = new Set<string>();
    const pairs = new Set<string>();
    for (const episode of episodes) {
      if (episode.id !== undefined) {
        if (!held.has(episode.id)) {
          throw new Error(`Unknown episode: ${episode.id}`);
        }
        if (ids.has(episode.id)) {
          throw new Error(`Episode sent twice: ${episode.id}`);
        }
        ids.add(episode.id);
      }
      const pair = `${episode.season}x${episode.number}`;
      if (pairs.has(pair)) {
        throw new Error(`Duplicate episode: ${pair}`);
      }
      pairs.add(pair);
    }
    return ids;
  };

  const updateSeriesGraph = db.transaction(
    (id: string, edit: SeriesEdit): SeriesUpdate | null => {
      const before = reader.getSeries(id);
      if (before === null) {
        return null;
      }
      const held = reader.listEpisodes(id);
      const heldById = new Map(held.map((episode) => [episode.id, episode]));
      const beforePaths = pathsOf(before, held);
      const keptIds = checkEpisodes(heldById, edit.episodes);

      const now = new Date().toISOString();
      updateSeriesRow.run({
        id,
        title: edit.title,
        year: edit.year,
        end_year: edit.endYear,
        synopsis: edit.synopsis,
        creator: edit.creator,
        cast: edit.cast.length === 0 ? null : JSON.stringify(edit.cast),
        rating: edit.rating,
        poster_path: edit.posterPath,
        updated_at: now,
      });
      if (edit.tmdbId === null) {
        clearSeriesMatch.run(id);
      }
      deleteSeriesGenres.run(id);
      edit.genres.forEach((name, position) => {
        const genre = selectGenreIdByName.get(name) as
          | { id: string }
          | undefined;
        if (!genre) {
          throw new Error(`Unknown genre: ${name}`);
        }
        insertSeriesGenre.run(id, genre.id, position);
      });

      // The removals first, so their numbers are free to be taken.
      for (const episode of held) {
        if (!keptIds.has(episode.id)) {
          deleteEpisodeRow.run(episode.id);
        }
      }

      // The **Two-pass renumber**: every held episode being renumbered steps
      // aside onto a negative placeholder, then each takes its new number, so
      // the UNIQUE index never sees two at one pair.
      const kept = edit.episodes.flatMap((episode) => {
        const was =
          episode.id === undefined ? undefined : heldById.get(episode.id);
        return was === undefined ? [] : [{ episode, was }];
      });
      let placeholder = 0;
      for (const { episode, was } of kept) {
        if (was.season !== episode.season || was.number !== episode.number) {
          placeholder -= 1;
          moveEpisode.run(placeholder, was.id);
        }
      }
      for (const { episode, was } of kept) {
        updateEpisodeRow.run({
          id: was.id,
          season_number: episode.season,
          episode_number: episode.number,
          title: episode.title ?? null,
          video_path: episode.videoPath,
          updated_at: now,
        });
        if (episode.runtimeMinutes !== undefined) {
          setEpisodeRuntime.run(episode.runtimeMinutes, was.id);
        }
        deleteEpisodeSubtitles.run(was.id);
        episode.subtitles?.forEach((track, position) => {
          insertEpisodeSubtitle.run({
            id: randomUUID(),
            episode_id: was.id,
            path: track.path,
            language: track.language,
            position,
          });
        });
      }

      for (const episode of edit.episodes) {
        if (episode.id === undefined) {
          insertEpisodeGraph(randomUUID(), id, {
            season: episode.season,
            number: episode.number,
            videoPath: episode.videoPath,
            ...(episode.title == null ? {} : { title: episode.title }),
            ...(episode.runtimeMinutes == null
              ? {}
              : { runtimeMinutes: episode.runtimeMinutes }),
            ...(episode.subtitles === undefined
              ? {}
              : { subtitles: episode.subtitles }),
          });
        }
      }

      const series = reader.getSeries(id) as Series;
      const afterPaths = new Set(pathsOf(series, reader.listEpisodes(id)));
      return {
        series,
        removedPaths: [...new Set(beforePaths)].filter(
          (path) => !afterPaths.has(path)
        ),
      };
    }
  );

  return {
    updateSeries: (id, edit) => updateSeriesGraph(id, edit),

    addSeries: (input, episodes = []) => {
      const id = randomUUID();
      insertSeriesWithEpisodes(id, input, episodes);
      return reader.getSeries(id) as Series;
    },

    addEpisode: (seriesId, input) => {
      const id = randomUUID();
      insertEpisodeGraph(id, seriesId, input);
      return reader.getEpisode(id) as Episode;
    },

    deleteSeries: (id) => {
      deleteSeriesRow.run(id);
    },
  };
}
