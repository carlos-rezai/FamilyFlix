import { openDatabase } from '../db';
import { resetDatabase } from '../db/resetDatabase/resetDatabase';
import type {
  Genre,
  GenreCount,
  GenreListPayload,
  GenrePayload,
  GenreQuery,
  Episode,
  EpisodeRead,
  HomePayload,
  LibraryQuery,
  LibraryTab,
  Movie,
  MoviePatch,
  MovieQuery,
  NewEpisode,
  NewMovie,
  NewSeries,
  Series,
  SeriesDetail,
  SeriesHomePayload,
  Settings,
} from '@/types';
import { createMovieReader } from './read/read';
import { createBrowse } from './browse/browse';
import { createHome } from './home/home';
import { createGenre } from './genre/genre';
import { createWrite } from './write/write';
import { createWatch } from './watch/watch';
import { createCuration } from './curation/curation';
import { createSettings } from './settings/settings';
import {
  createFolders,
  type FolderRemoval,
  type StoredLibraryFolder,
} from './folders/folders';
import {
  createEnrich,
  type EnrichmentCounts,
  type MovieEnrichment,
  type TitleSource,
} from './enrich/enrich';
import {
  createSeriesEnrich,
  type EpisodeEnrichment,
  type SeriesEnrichment,
  type StillSource,
} from './series/enrich/enrich';
import { createSeriesReader } from './series/read/read';
import { createSeriesBrowse } from './series/browse/browse';
import {
  createSeriesWrite,
  type SeriesEdit,
  type SeasonPosterEdit,
  type SeriesUpdate,
} from './series/write/write';
import { createSeriesCuration } from './series/curation/curation';
import { createSeriesWatch } from './series/watch/watch';
import { createTitles, type StoredLibraryTitles } from './titles/titles';
import { createHolding, type HeldTitle } from './holding/holding';
import { createLeftOut, type LeftOutVideo } from './leftOut/leftOut';

export type { MovieEnrichment, TitleSource } from './enrich/enrich';
export type { FolderRemoval, StoredLibraryFolder } from './folders/folders';
export type { HeldTitle } from './holding/holding';
export type { LeftOutVideo } from './leftOut/leftOut';
export type {
  LinkedVideo,
  StoredLibraryMovie,
  StoredLibrarySeries,
  StoredLibraryTitles,
} from './titles/titles';
export type {
  EpisodeEdit,
  SeriesEdit,
  SeasonPosterEdit,
  SeriesUpdate,
} from './series/write/write';
export type {
  EpisodeEnrichment,
  SeriesEnrichment,
  StillSource,
} from './series/enrich/enrich';

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
   * A **Sync**'s write: the columns `fields` names and only those — never
   * `rating`, `watched`, `resume_position_seconds` or `last_watched_at`.
   */
  enrichMovie(id: string, fields: MovieEnrichment): void;
  /** {@link enrichMovie} over a **Series** — never its rating or favorite. */
  enrichSeries(id: string, fields: SeriesEnrichment): void;
  /**
   * {@link enrichMovie} over one **Episode** — never `watched`,
   * `resume_position_seconds` or `last_watched_at`.
   */
  enrichEpisode(id: string, fields: EpisodeEnrichment): void;
  /**
   * A **Sync**'s write of one season's **Season poster** — an upsert over
   * `(seriesId, season)`, refusing a series the library does not hold.
   */
  setSeasonPoster(seriesId: string, season: number, posterPath: string): void;
  /**
   * Each episode's **Still source** by episode id for one series; an episode
   * with no still is absent.
   */
  stillSourcesOf(seriesId: string): ReadonlyMap<string, StillSource>;
  /**
   * {@link moviesInScope} over the series: those without a synopsis or a
   * poster, all of them, or those created or given a new episode since.
   */
  seriesInScope(scope: 'missing' | 'all' | 'added', since?: string): Series[];
  /**
   * The titles a library-wide **Sync** snapshots, with their current values:
   * `missing` — every film without a synopsis or without a poster — `all`, or
   * `added`, every film created at or after `since`.
   */
  moviesInScope(scope: 'missing' | 'all' | 'added', since?: string): Movie[];
  /**
   * Every **Movie** and **Series** in the library, and those of them with
   * **Full details** — a synopsis and a poster both — and those with a
   * **Sync gap**, what _Only what's missing_ will sync. Zeros when empty.
   * Given a `since`, also those created at or after it.
   */
  enrichmentCounts(since?: string): EnrichmentCounts;
  /**
   * Delete a movie, cascading to its `movie_genres` and `subtitles` rows so no
   * orphans remain. A silent, idempotent no-op for an unknown id.
   */
  deleteMovie(id: string): void;
  /** Assemble and return the full movie model, or `null` for an unknown id. */
  getMovie(id: string): Movie | null;
  /**
   * {@link getMovie} over a **Series**: the assembled series, or `null` for an
   * id the library does not hold as one, a movie's among them.
   */
  getSeries(id: string): Series | null;
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
   * Every genre a film may be filed under — the whole seeded pool, in migration
   * order, including the ones no movie carries. Deliberately a different answer
   * from {@link listGenres}: that one draws a filter over what is on the
   * shelves, this one draws the **Movie form**'s chips, and only the second can
   * file a film under a genre that has no row yet.
   */
  listGenrePool(): Genre[];
  /**
   * How many movies the library holds — the "All Genres" tally behind the genre
   * dropdown. Deliberately not a sum of {@link listGenres}: a movie tagged with
   * several genres is counted once, and an untagged one — which earns no genre
   * row — is counted too. `0` for an empty library.
   */
  countMovies(): number;
  /** How many films the library holds under no genre: the **Other row**'s count. */
  countGenreLess(): number;
  /**
   * The browse home in one call: the in-progress movies as `continueWatching`,
   * the favorited ones as `favorites`, plus a `rows` entry per populated genre
   * (busiest genre first), each carrying the genre's true movie count. Every
   * section is capped at 15, and every one is `[]` for an empty library. The
   * sections overlap freely — one movie can be in all three.
   *
   * An optional `query` **filters** every section alike, and drops any row it
   * empties; a row's `count` stays the genre's unfiltered total. Omitting it is
   * the unfiltered home in the default order.
   *
   * Its **sort** reaches every section but one: `continueWatching` always comes
   * back most-recently-watched-first, whatever the query asks for, because a
   * resume queue's order is part of what that shelf means rather than something
   * the header sets. `favorites` and the genre rows take the caller's sort.
   */
  getHome(query?: LibraryQuery): HomePayload;
  /**
   * One genre in full, in one call: the name as it was asked for, the genre's
   * **unfiltered** movie count, and every movie tagged with it — uncapped,
   * because this is the call behind a genre row's "View all".
   *
   * An optional `query` narrows the list to a search term and orders it; `total`
   * stays the genre's own count however far the search narrows the list, so "12
   * of 214 titles" keeps the number the row promised. Omitting the query — or
   * just its sort — is the genre in the default order. A genre the library does
   * not hold is `{ genre, total: 0, movies: [] }`, not an error.
   */
  getGenre(name: string, query?: Partial<GenreQuery>): GenrePayload;
  /**
   * Every film with no genre in full, the Genre page's `other` mode: `getGenre`'s
   * shape with a blank `genre`, uncapped, `total` the unfiltered count.
   */
  getGenreLess(query?: Partial<GenreQuery>): GenrePayload;
  /**
   * Persist the resume position (seconds into the file), and stamp
   * `last_watched_at` with the current ISO time — this is the call that means
   * "we are watching this", and that stamp is what orders the Continue Watching
   * row. Called constantly during playback, so it stays a cheap two-column
   * write; `updated_at` is still untouched, a general edit's timestamp being a
   * different fact from a watch.
   */
  setResumePosition(id: string, seconds: number): void;
  /**
   * Mark a movie watched. By convention this also zeroes
   * `resume_position_seconds`, so a finished movie leaves the Continue Watching
   * row, and it stamps `last_watched_at` alongside {@link setResumePosition} —
   * finishing a movie is watching it.
   */
  markWatched(id: string): void;
  /** Clear the watched flag, leaving any resume position untouched. */
  markUnwatched(id: string): void;
  /** `setResumePosition` over an **Episode**: the position, stamped. */
  setEpisodeResumePosition(id: string, seconds: number): void;
  /**
   * The movie's watched toggle over one **Episode** — watched zeroes the resume
   * position, unwatched keeps it. Answers whether the library holds it.
   */
  setEpisodeWatched(id: string, value: boolean): boolean;
  /**
   * {@link setEpisodeWatched} over every episode of one season. Answers
   * whether the series holds that season — `false` for an unknown series, a
   * movie's id among them, or a season with no episodes.
   */
  setSeasonWatched(seriesId: string, season: number, value: boolean): boolean;
  /**
   * {@link setEpisodeWatched} over every episode of the series. Answers
   * whether the series holds an episode — `false` for an unknown series, a
   * movie's id among them, or a series with none.
   */
  setSeriesWatched(seriesId: string, value: boolean): boolean;
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
  /**
   * The household's settings, the default applied where a row is absent, so
   * no caller has to know what it is. Reading never writes the default down.
   * `library/` is the one SQLite door: two methods over one table is not a
   * domain, and `localStorage` is a device's, not the household's.
   */
  settings(): Settings;
  /**
   * Store the preferred subtitle language — an upsert, so the second write
   * replaces the first. Membership in the **Language pool** is not checked: a
   * display vocabulary, not a constraint, the rule a **Subtitle**'s own
   * language follows.
   */
  setSubtitleLanguage(language: string): void;
  /**
   * Store the **Preferred audio language** — the subtitle language's twin: an
   * upsert, membership in the **Language pool** not checked.
   */
  setAudioLanguage(language: string): void;
  /**
   * Store **Ultrawide margins** — an upsert, so the second write replaces the
   * first. `settings()` reads it back with the default, off, applied.
   */
  setUltrawideMargins(on: boolean): void;
  /**
   * Store _Fill in ratings from TMDB_ — an upsert; `settings()` reads it back
   * with the default, on, applied.
   */
  setTmdbRatings(on: boolean): void;
  /**
   * Store the **Start tab**: an upsert; `settings()` reads it back with the
   * default, Movies, applied to an absent or unknown value.
   */
  setStartTab(tab: LibraryTab): void;
  /**
   * The maintainer's TMDB key, `null` when none is stored — no default. Kept
   * in the same `settings` table but not a household preference, so
   * `settings()` never carries it.
   */
  tmdbKey(): string | null;
  /** Store the TMDB key — an upsert, so the second write replaces the first. */
  setTmdbKey(key: string): void;
  /** When a Sync last reached review, as an ISO string; `null` for never. */
  enrichmentLastSyncedAt(): string | null;
  /** Stamp when a Sync reached review — an upsert, like the key. */
  setEnrichmentLastSyncedAt(at: string): void;
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
   * Where a Movie or Series was recorded as coming from: its Library folder's
   * id and its Source folder, read together — `null` for a title with no
   * folder.
   */
  titleSource(id: string): TitleSource | null;
  /**
   * A title's recorded **Media folder**, relative to the Managed media
   * directory — the one way `Media` finds its folder; `null` for an id that
   * kind does not hold. Never on the wire.
   */
  mediaFolderOf(kind: 'movie' | 'series', id: string): string | null;
  /**
   * Where a Movie or Series sits on disk: its Library folder's path joined to
   * its Source folder — `null` for a title with no folder.
   */
  sourcePath(id: string): string | null;
  /**
   * The id of the **Movie** or **Series** recorded at this Library folder and
   * Source folder, whatever its title says now — `null` when none is. Given
   * a **Source file**, only the Collection folder film recorded with it.
   */
  titleAt(
    folderId: string,
    sourceFolder: string,
    sourceFile?: string | null
  ): string | null;
  /**
   * The **Held video** rule: the title whose video already lies at this path
   * under this Library folder, relative to it with forward slashes, as a
   * **Linked video** is spelled: a film's or an episode's Linked video, or
   * an episode's **Source file** under its series' Source folder. `null`
   * when none does; one of a double rather than a refusal.
   */
  titleHolding(folderId: string, videoPath: string): HeldTitle | null;
  /**
   * Record **Left-out videos**, each a Library folder's id and a path spelled
   * as a **Linked video**'s; one already recorded is kept once, not refused.
   */
  leaveOut(entries: readonly LeftOutVideo[]): void;
  /** One Library folder's **Left-out videos**, and only that folder's. */
  leftOut(folderId: string): ReadonlySet<string>;
  /** Forget exactly these **Left-out videos**. */
  clearLeftOut(entries: readonly LeftOutVideo[]): void;
  /** Forget every **Left-out video** of one folder, answering how many went. */
  bringBack(folderId: string): number;
  /**
   * Insert a **Series** and its genres (ordered) in one transaction, and
   * return the assembled model. It carries no watch state: that lives on its
   * episodes. Given episodes, they are written in the same transaction, so a
   * refused one commits nothing.
   */
  addSeries(
    input: NewSeries,
    episodes?: readonly NewEpisode[],
    seasonPosters?: readonly SeasonPosterEdit[]
  ): Series;
  /**
   * Insert one **Episode** under a held series, unwatched at zero. A second
   * episode under one series, season and number is refused by the schema.
   */
  addEpisode(seriesId: string, input: NewEpisode): Episode;
  /**
   * Delete a **Series**; the cascade takes its episodes, genres and subtitle
   * tracks. A silent, idempotent no-op for an unknown id, {@link deleteMovie}'s
   * shape.
   */
  deleteSeries(id: string): void;
  /**
   * The **Series edit job**'s save in one transaction — the fields, the
   * **Two-pass renumber**, the inserts and the removals — answering the series
   * and the **Stored paths** left unreferenced, or `null` for a series not
   * held. An unknown or repeated id, or a pair of numbers twice, throws.
   */
  updateSeries(id: string, edit: SeriesEdit): SeriesUpdate | null;
  /**
   * The series' Favorites toggle — `setFavorite` over the series table.
   * Answers whether the library holds that series; a movie's id is not one.
   */
  setSeriesFavorite(id: string, value: boolean): boolean;
  /**
   * The series' household rating — `setRating` over the series table, `null`
   * clearing it. Answers whether the library holds that series.
   */
  setSeriesRating(id: string, units: number | null): boolean;
  /**
   * One **Episode** as the player opens it: the episode, its series' id and
   * title, and the next episode the series holds — or `null` for an id the
   * library does not hold as an episode, a movie's among them.
   */
  getEpisodeRead(id: string): EpisodeRead | null;
  /**
   * The series the **Library query** keeps, in its sort; the episode total
   * across them; and the Continue row narrowed by the same filters.
   */
  getSeriesHome(query?: LibraryQuery): SeriesHomePayload;
  /** Each genre series carry, counted in series, with the series total. */
  listSeriesGenres(): GenreListPayload;
  /** A series' episodes in season, then episode order; `[]` for none. */
  listEpisodes(seriesId: string): Episode[];
  /**
   * The series page in one read: the series, its seasons in order each with
   * its episodes and its **Next episode**, and the series' own — or `null`
   * for an id the library does not hold as a series.
   */
  getSeriesDetail(id: string): SeriesDetail | null;
  /**
   * The **Library folders** in the order they were added, each with its title
   * count — the movies and series recorded against it.
   */
  libraryFolders(): StoredLibraryFolder[];
  /** List a folder, answering it. Throws on a path already listed. */
  addLibraryFolder(path: string): StoredLibraryFolder;
  /**
   * Take a folder off the list in one transaction, keeping its titles and
   * forgetting only where they came from — `library_folder_id` and
   * `source_folder` nulled on that folder's titles alone. A folder a **Linked
   * video** plays from is not removed: `in-use`, with how many titles do,
   * counted in the same transaction.
   */
  removeLibraryFolder(id: string): FolderRemoval;
  /** Stamp exactly the folders named as read by a run at `at`, an ISO moment. */
  markScanned(ids: readonly string[], at: string): void;
  /**
   * The **Manage library page**'s raw facts: every film and every series, each
   * list A–Z by title, with its **Details state**, its counts, its Library,
   * Source and Media folders as recorded, and its linked videos.
   */
  libraryTitles(): StoredLibraryTitles;
  /**
   * **Clear details** on a film, one transaction — the **Stored paths** it
   * let go, or `null` for an id not held as a film.
   */
  clearMovieDetails(id: string): string[] | null;
  /**
   * **Clear details** on a series, one transaction — the **Stored paths** it
   * let go, or `null` for an id not held as a series.
   */
  clearSeriesDetails(id: string): string[] | null;
  /**
   * **Factory reset**'s erase: every row of every table but the **Genre
   * pool**, in one transaction — all or nothing. The same kind of seam
   * {@link close} is, so the router never reaches `db/` itself.
   */
  reset(): void;
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

  const settingsRepository = createSettings(db);
  const tmdbRatings = () => settingsRepository.settings().tmdbRatings;
  const reader = createMovieReader(db);
  const browse = createBrowse(db, reader, tmdbRatings);
  const home = createHome(browse);
  const genre = createGenre(browse);
  const write = createWrite(db, reader);
  const watch = createWatch(db);
  const curation = createCuration(db);
  const folders = createFolders(db);
  const seriesReader = createSeriesReader(db);
  const enrich = createEnrich(db, reader);
  const seriesEnrich = createSeriesEnrich(db, seriesReader);
  const seriesBrowse = createSeriesBrowse(db, seriesReader, tmdbRatings);
  const seriesWrite = createSeriesWrite(db, seriesReader);
  const seriesCuration = createSeriesCuration(db);
  const seriesWatch = createSeriesWatch(db);
  const titles = createTitles(db);
  const holding = createHolding(db);
  const leftOut = createLeftOut(db);

  return {
    addMovie: write.addMovie,
    updateMovie: write.updateMovie,
    enrichMovie: enrich.enrichMovie,
    enrichSeries: seriesEnrich.enrichSeries,
    enrichEpisode: seriesEnrich.enrichEpisode,
    setSeasonPoster: seriesEnrich.setSeasonPoster,
    stillSourcesOf: seriesEnrich.stillSourcesOf,
    moviesInScope: enrich.moviesInScope,
    seriesInScope: seriesEnrich.seriesInScope,
    enrichmentCounts: enrich.enrichmentCounts,
    deleteMovie: write.deleteMovie,
    getMovie: reader.getMovie,
    getSeries: seriesReader.getSeries,
    listMovies: browse.listMovies,
    searchMovies: browse.searchMovies,
    listGenres: browse.listGenres,
    listGenrePool: browse.listGenrePool,
    countMovies: browse.countMovies,
    countGenreLess: browse.countGenreLess,
    getHome: home.getHome,
    getGenre: genre.getGenre,
    getGenreLess: genre.getGenreLess,
    setResumePosition: watch.setResumePosition,
    markWatched: watch.markWatched,
    markUnwatched: watch.markUnwatched,
    setEpisodeResumePosition: seriesWatch.setEpisodeResumePosition,
    setEpisodeWatched: seriesWatch.setEpisodeWatched,
    setSeasonWatched: seriesWatch.setSeasonWatched,
    setSeriesWatched: seriesWatch.setSeriesWatched,
    setFavorite: curation.setFavorite,
    setRating: curation.setRating,
    settings: settingsRepository.settings,
    setSubtitleLanguage: settingsRepository.setSubtitleLanguage,
    setAudioLanguage: settingsRepository.setAudioLanguage,
    setUltrawideMargins: settingsRepository.setUltrawideMargins,
    setTmdbRatings: settingsRepository.setTmdbRatings,
    setStartTab: settingsRepository.setStartTab,
    tmdbKey: settingsRepository.tmdbKey,
    setTmdbKey: settingsRepository.setTmdbKey,
    enrichmentLastSyncedAt: settingsRepository.enrichmentLastSyncedAt,
    setEnrichmentLastSyncedAt: settingsRepository.setEnrichmentLastSyncedAt,
    setSourceFolder: enrich.setSourceFolder,
    titleSource: enrich.titleSource,
    mediaFolderOf: enrich.mediaFolderOf,
    sourcePath: enrich.sourcePath,
    titleAt: enrich.titleAt,
    titleHolding: holding.titleHolding,
    leaveOut: leftOut.leaveOut,
    leftOut: leftOut.leftOut,
    clearLeftOut: leftOut.clearLeftOut,
    bringBack: leftOut.bringBack,
    addSeries: seriesWrite.addSeries,
    addEpisode: seriesWrite.addEpisode,
    deleteSeries: seriesWrite.deleteSeries,
    updateSeries: seriesWrite.updateSeries,
    setSeriesFavorite: seriesCuration.setSeriesFavorite,
    setSeriesRating: seriesCuration.setSeriesRating,
    getEpisodeRead: seriesReader.getEpisodeRead,
    getSeriesHome: seriesBrowse.getSeriesHome,
    listSeriesGenres: seriesBrowse.listSeriesGenres,
    listEpisodes: seriesReader.listEpisodes,
    getSeriesDetail: seriesReader.getSeriesDetail,
    libraryFolders: folders.libraryFolders,
    addLibraryFolder: folders.addLibraryFolder,
    removeLibraryFolder: folders.removeLibraryFolder,
    markScanned: folders.markScanned,
    libraryTitles: titles.libraryTitles,
    clearMovieDetails: titles.clearMovieDetails,
    clearSeriesDetails: titles.clearSeriesDetails,
    reset() {
      resetDatabase(db);
    },
    close() {
      db.close();
    },
  };
}
