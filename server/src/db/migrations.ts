import { randomUUID } from 'node:crypto';
import type { Database } from 'better-sqlite3';

/**
 * A single, ordered schema migration. Applied in its own transaction by the
 * `PRAGMA user_version` runner in {@link ./index.ts} when the database's current
 * version is below {@link version}.
 */
export interface Migration {
  readonly version: number;
  up(db: Database): void;
}

/**
 * The canonical 12-genre pool seeded by migration #1. Source of truth:
 * `docs/handoff/FamilyFlix.dc.html` `genrePool` (order preserved).
 */
const GENRE_POOL = [
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Thriller',
  'Sci-Fi',
  'Romance',
  'Documentary',
  'Animation',
  'Family',
  'Adventure',
  'Crime',
] as const;

const V1_SCHEMA = `
  CREATE TABLE movies (
    id                      TEXT PRIMARY KEY,
    tmdb_id                 INTEGER,
    title                   TEXT NOT NULL,
    year                    INTEGER,
    runtime_minutes         INTEGER,
    synopsis                TEXT,
    director                TEXT,
    cast                    TEXT,
    rating                  INTEGER CHECK (rating BETWEEN 0 AND 10),
    is_favorite             INTEGER NOT NULL DEFAULT 0,
    watched                 INTEGER NOT NULL DEFAULT 0,
    resume_position_seconds INTEGER NOT NULL DEFAULT 0,
    video_path              TEXT NOT NULL,
    poster_path             TEXT,
    backdrop_path           TEXT,
    created_at              TEXT NOT NULL,
    updated_at              TEXT NOT NULL
  );

  CREATE TABLE genres (
    id   TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE movie_genres (
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    genre_id TEXT NOT NULL REFERENCES genres(id),
    position INTEGER NOT NULL,
    PRIMARY KEY (movie_id, genre_id)
  );

  CREATE TABLE subtitles (
    id       TEXT PRIMARY KEY,
    movie_id TEXT NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    path     TEXT NOT NULL,
    language TEXT NOT NULL,
    position INTEGER NOT NULL
  );

  CREATE INDEX idx_movies_title ON movies(title);
  CREATE INDEX idx_movies_year ON movies(year);
  CREATE INDEX idx_movies_created_at ON movies(created_at);
  CREATE INDEX idx_movies_rating ON movies(rating);
  CREATE INDEX idx_movies_tmdb_id ON movies(tmdb_id);
  CREATE INDEX idx_movies_is_favorite ON movies(is_favorite) WHERE is_favorite = 1;
  CREATE INDEX idx_movie_genres_genre_id ON movie_genres(genre_id);
  CREATE INDEX idx_subtitles_movie_id ON subtitles(movie_id);
`;

export const migrations: readonly Migration[] = [
  {
    version: 1,
    up(db) {
      db.exec(V1_SCHEMA);

      const insertGenre = db.prepare(
        'INSERT INTO genres (id, name) VALUES (?, ?)'
      );
      for (const name of GENRE_POOL) {
        insertGenre.run(randomUUID(), name);
      }
    },
  },
];
