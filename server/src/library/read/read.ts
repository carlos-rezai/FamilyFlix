import type { SqliteDatabase } from '../../db';
import type {
  Genre,
  Movie,
  Subtitle,
  WatchStatus,
} from '../../../../src/types';

// --- raw row shapes (SELECT results) -------------------------------------------

export interface MovieRow {
  id: string;
  tmdb_id: number | null;
  title: string;
  year: number | null;
  runtime_minutes: number | null;
  synopsis: string | null;
  director: string | null;
  cast: string | null;
  rating: number | null;
  is_favorite: number;
  watched: number;
  resume_position_seconds: number;
  video_path: string;
  poster_path: string | null;
  backdrop_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface GenreRow {
  id: string;
  name: string;
}

export interface SubtitleRow {
  id: string;
  path: string;
  language: string;
  position: number;
}

/** Derive the three-way watch status from the two stored facts. */
export function deriveStatus(
  watched: boolean,
  resumePositionSeconds: number
): WatchStatus {
  if (watched) {
    return 'watched';
  }
  if (resumePositionSeconds > 0) {
    return 'in-progress';
  }
  return 'unwatched';
}

/** Pure row→model assembly: parse cast JSON, attach ordered genres/subtitles,
 *  coerce SQLite integer booleans, and compute the derived status. */
export function mapRowToMovie(
  row: MovieRow,
  genres: Genre[],
  subtitles: Subtitle[]
): Movie {
  const watched = row.watched !== 0;
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    title: row.title,
    year: row.year,
    runtimeMinutes: row.runtime_minutes,
    synopsis: row.synopsis,
    director: row.director,
    cast: row.cast ? (JSON.parse(row.cast) as string[]) : [],
    rating: row.rating,
    isFavorite: row.is_favorite !== 0,
    watched,
    resumePositionSeconds: row.resume_position_seconds,
    status: deriveStatus(watched, row.resume_position_seconds),
    videoPath: row.video_path,
    posterPath: row.poster_path,
    backdropPath: row.backdrop_path,
    genres,
    subtitles,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * The shared read path: `getMovie` plus the `assemble` step that turns a movie
 * row into a full {@link Movie} by attaching its ordered genres and subtitles.
 * `browse/` reuses `assemble` per listed row and `write/` reuses `getMovie` for
 * its post-write return value, so the movie-row select and the two ordered
 * child selects are prepared once here and never leak past this factory.
 */
export interface MovieReader {
  /** Assemble and return the full movie model, or `null` for an unknown id. */
  getMovie(id: string): Movie | null;
  /** Attach a row's ordered genres and subtitles and map it to a full model. */
  assemble(row: MovieRow): Movie;
}

export function createMovieReader(db: SqliteDatabase): MovieReader {
  const selectMovie = db.prepare('SELECT * FROM movies WHERE id = ?');
  const selectMovieGenres = db.prepare(`
    SELECT g.id AS id, g.name AS name
    FROM movie_genres mg
    JOIN genres g ON g.id = mg.genre_id
    WHERE mg.movie_id = ?
    ORDER BY mg.position
  `);
  const selectMovieSubtitles = db.prepare(`
    SELECT id, path, language, position
    FROM subtitles
    WHERE movie_id = ?
    ORDER BY position
  `);

  function assemble(row: MovieRow): Movie {
    const genres = selectMovieGenres.all(row.id) as GenreRow[];
    const subtitles = selectMovieSubtitles.all(row.id) as SubtitleRow[];
    return mapRowToMovie(row, genres, subtitles);
  }

  function getMovie(id: string): Movie | null {
    const row = selectMovie.get(id) as MovieRow | undefined;
    if (!row) {
      return null;
    }
    return assemble(row);
  }

  return { getMovie, assemble };
}
