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
  {
    // The last-watched stamp that orders the Continue Watching row. Added here
    // rather than in `V1_SCHEMA` so every existing dev database gains the
    // column instead of silently lacking it, and with no backfill: an existing
    // row migrates to NULL, which means "never watched, as far as we
    // recorded". Borrowing `updated_at` would invent a watch history.
    //
    // The index is partial, the same shape `idx_movies_is_favorite` uses —
    // only the rows that carry a stamp are worth indexing, and they are the
    // only ones the resume shelf orders by.
    version: 2,
    up(db) {
      db.exec(`
        ALTER TABLE movies ADD COLUMN last_watched_at TEXT;

        CREATE INDEX idx_movies_last_watched_at ON movies(last_watched_at)
          WHERE last_watched_at IS NOT NULL;
      `);
    },
  },
  {
    // The household's settings — one preference today, `subtitle-language`.
    // A key/value table rather than a column per setting, so the roadmap's
    // auto-on adds a row and not a migration; in the library's own database
    // rather than `localStorage`, because this is the household's choice and
    // must travel with the backup. Nothing is seeded: the default is applied
    // by the repository when the row is absent, not written down as if
    // someone chose it.
    version: 3,
    up(db) {
      db.exec(`
        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    },
  },
  {
    // Series (TV): a `series`, its `episodes` carrying the movie's watch trio
    // exactly — so the watch rules transfer untouched — and the two children
    // mirroring the movie's. No `seasons` table: a season is `season_number`
    // on its episodes, and nothing about one is stored. `movies` is not
    // touched; the whole initiative is additive.
    version: 4,
    up(db) {
      db.exec(`
        CREATE TABLE series (
          id            TEXT PRIMARY KEY,
          tmdb_id       INTEGER,
          title         TEXT NOT NULL,
          year          INTEGER,
          end_year      INTEGER,
          synopsis      TEXT,
          creator       TEXT,
          cast          TEXT,
          rating        INTEGER CHECK (rating BETWEEN 0 AND 10),
          is_favorite   INTEGER NOT NULL DEFAULT 0,
          poster_path   TEXT,
          backdrop_path TEXT,
          created_at    TEXT NOT NULL,
          updated_at    TEXT NOT NULL
        );

        CREATE TABLE episodes (
          id                      TEXT PRIMARY KEY,
          series_id               TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
          season_number           INTEGER NOT NULL,
          episode_number          INTEGER NOT NULL,
          title                   TEXT,
          air_date                TEXT,
          runtime_minutes         INTEGER,
          watched                 INTEGER NOT NULL DEFAULT 0,
          resume_position_seconds INTEGER NOT NULL DEFAULT 0,
          last_watched_at         TEXT,
          video_path              TEXT NOT NULL,
          created_at              TEXT NOT NULL,
          updated_at              TEXT NOT NULL,
          UNIQUE (series_id, season_number, episode_number)
        );

        CREATE TABLE series_genres (
          series_id TEXT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
          genre_id  TEXT NOT NULL REFERENCES genres(id),
          position  INTEGER NOT NULL,
          PRIMARY KEY (series_id, genre_id)
        );

        CREATE TABLE episode_subtitles (
          id         TEXT PRIMARY KEY,
          episode_id TEXT NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
          path       TEXT NOT NULL,
          language   TEXT NOT NULL,
          position   INTEGER NOT NULL
        );

        CREATE INDEX idx_series_title ON series(title);
        CREATE INDEX idx_series_genres_genre_id ON series_genres(genre_id);
        CREATE INDEX idx_episode_subtitles_episode_id ON episode_subtitles(episode_id);
        CREATE INDEX idx_episodes_last_watched_at ON episodes(last_watched_at)
          WHERE last_watched_at IS NOT NULL;
      `);
    },
  },
];
