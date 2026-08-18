import { openDatabase } from '../db';
import type {
  GenreCount,
  HomePayload,
  HomeQuery,
  Movie,
  MoviePatch,
  MovieQuery,
  NewMovie,
} from '@/types';
import { createMovieReader } from './read/read';
import { createBrowse } from './browse/browse';
import { createHome } from './home/home';
import { createWrite } from './write/write';
import { createWatch } from './watch/watch';
import { createCuration } from './curation/curation';

/**
 * The repository seam every consumer (routes, importer, player) reads and writes
 * the library through; nothing else in the app talks to SQLite.
 *
 * The movie lifecycle, browse, watch, and curation methods land in later slices
 * (issues for Phases 3–4); this slice (issue #3) adds the write→read tracer
 * bullet: a transactional `addMovie` and a full-model `getMovie`.
 */
export interface LibraryStorage {
  /**
   * Insert a movie and its genres (ordered), cast, and subtitles in one
   * transaction, returning the fully-assembled persisted model. A failure inside
   * the transaction commits nothing.
   */
  addMovie(input: NewMovie): Movie;
  /**
   * Edit a movie in one transaction, refresh `updated_at`, and return the
   * persisted full model. This is the single general write path: any column can
   * be patched (including watch state, favorite, and rating), a supplied
   * `genres`/`subtitles` replaces that whole collection, and an omitted key
   * leaves its column/collection untouched. It applies no side-effect conventions
   * — the dedicated mutators (`markWatched`, `setResumePosition`, `setFavorite`,
   * `setRating`) own the hot-path and side-effect behaviors. Throws on an unknown
   * id; a failure inside the transaction commits nothing.
   */
  updateMovie(id: string, patch: MoviePatch): Movie;
  /**
   * Delete a movie, cascading to its `movie_genres` and `subtitles` rows so no
   * orphans remain. A silent, idempotent no-op for an unknown id.
   */
  deleteMovie(id: string): void;
  /** Assemble and return the full movie model, or `null` for an unknown id. */
  getMovie(id: string): Movie | null;
  /**
   * Browse the library through one parameterized query: a required sort plus any
   * combination of genre / minRating / search / favoritesOnly / inProgressOnly
   * filters. Returns fully-assembled movies, or `[]` when nothing matches.
   */
  listMovies(query: MovieQuery): Movie[];
  /**
   * Search movies by case-insensitive substring of the title, the synopsis, or a
   * genre name, returning fully-assembled movies (or `[]`) — one entry per movie
   * however many of those arms match. Equivalent to a `listMovies` call with the
   * `search` filter.
   */
  searchMovies(text: string): Movie[];
  /** List only genres with at least one movie, each with its movie count. */
  listGenres(): GenreCount[];
  /**
   * How many movies the library holds — the "All Genres" tally behind the genre
   * dropdown. Deliberately not a sum of {@link listGenres}: a movie tagged with
   * several genres is counted once, and an untagged one — which earns no genre
   * row — is counted too. `0` for an empty library.
   */
  countMovies(): number;
  /**
   * The browse home in one call: the in-progress movies as `continueWatching`,
   * plus a `rows` entry per populated genre (alphabetical), each carrying the
   * genre's true movie count. Both sections are ordered recently-added-first and
   * capped at 15; both are `[]` for an empty library.
   *
   * An optional `query` narrows **both** sections alike, and drops any row it
   * empties; a row's `count` stays the genre's unfiltered total. Omitting it is
   * the unfiltered home.
   */
  getHome(query?: HomeQuery): HomePayload;
  /**
   * Persist the resume position (seconds into the file). Called constantly during
   * playback, so it stays a cheap single-column write — only
   * `resume_position_seconds` is touched, not `updated_at`.
   */
  setResumePosition(id: string, seconds: number): void;
  /**
   * Mark a movie watched. By convention this also zeroes
   * `resume_position_seconds`, so a finished movie leaves the Continue Watching
   * row.
   */
  markWatched(id: string): void;
  /** Clear the watched flag, leaving any resume position untouched. */
  markUnwatched(id: string): void;
  /**
   * Toggle the favorite flag, surfaced through the partial `is_favorite` index
   * that powers the Favorites row.
   */
  setFavorite(id: string, value: boolean): void;
  /**
   * Set a 0–10 half-star rating, or clear it to unrated with `null` (distinct
   * from a stored `0`). An out-of-range value is rejected by the schema CHECK
   * and never persisted.
   */
  setRating(id: string, units: number | null): void;
  /** Close the underlying database connection. */
  close(): void;
}

/**
 * Build a {@link LibraryStorage} backed by a SQLite database at `dbPath`. Opening
 * runs pending migrations, so a fresh database is created and seeded on first use.
 * Statements are prepared once here and reused per call.
 */
export function createSqliteStorage(dbPath: string): LibraryStorage {
  const db = openDatabase(dbPath);

  const reader = createMovieReader(db);
  const browse = createBrowse(db, reader);
  const home = createHome(browse);
  const write = createWrite(db, reader);
  const watch = createWatch(db);
  const curation = createCuration(db);

  return {
    addMovie: write.addMovie,
    updateMovie: write.updateMovie,
    deleteMovie: write.deleteMovie,
    getMovie: reader.getMovie,
    listMovies: browse.listMovies,
    searchMovies: browse.searchMovies,
    listGenres: browse.listGenres,
    countMovies: browse.countMovies,
    getHome: home.getHome,
    setResumePosition: watch.setResumePosition,
    markWatched: watch.markWatched,
    markUnwatched: watch.markUnwatched,
    setFavorite: curation.setFavorite,
    setRating: curation.setRating,
    close() {
      db.close();
    },
  };
}
