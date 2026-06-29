# Plan: Library Core

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/1

Backend-only foundation: the SQLite schema, the `db/` connection + migration
layer, and the `library/` repository (`createSqliteStorage`). No HTTP routes, no
media/filesystem access, no TMDB fetching, no Electron this round. Each phase is
a vertical slice through the layers this feature actually has —
**schema → migration → repository method → real `:memory:` SQLite test** — and
is verifiable on its own.

## Architectural decisions

Durable decisions that apply across all phases:

- **Seam**: one `createSqliteStorage(dbPath)` factory returns the whole
  `LibraryStorage` repository. It is the only thing in the app that talks to
  SQLite; `src/` never touches the database directly. Statements are prepared
  once at init; multi-table writes are transactional; reads assemble the full
  model.
- **Schema (v1)** — four tables, created as migration #1:
  - `movies`: `id` TEXT PK (`crypto.randomUUID()`), `tmdb_id` INTEGER (indexed,
    not unique), `title` NOT NULL, `year`, `runtime_minutes`, `synopsis`,
    `director`, `cast` (JSON `string[]`), `rating` INTEGER
    `CHECK(rating BETWEEN 0 AND 10)` nullable (NULL = unrated), `is_favorite` /
    `watched` / `resume_position_seconds` NOT NULL with defaults, `video_path`
    NOT NULL, `poster_path` / `backdrop_path` nullable, `created_at` /
    `updated_at` UTC ISO-8601 text (repo-generated, not `CURRENT_TIMESTAMP`).
  - `genres`: `id` TEXT PK, `name` TEXT UNIQUE NOT NULL (12 seeded).
  - `movie_genres`: junction with `position`, `ON DELETE CASCADE` to movies; PK
    `(movie_id, genre_id)`.
  - `subtitles`: child with `path`, `language`, `position`, `ON DELETE CASCADE`.
  - Indexes: `movies(title, year, created_at, rating, tmdb_id)`,
    `movie_genres(genre_id)`, `subtitles(movie_id)`, partial
    `movies(is_favorite) WHERE is_favorite = 1`.
- **Key models** (shared, in `src/types/`): `Movie`, `Genre`, `Subtitle`,
  `MovieQuery`, `WatchStatus`. `WatchStatus` = `'unwatched' | 'in-progress' |
'watched'`, **derived** in the row→model mapper, never stored
  (`watched=1 → watched`; `resume_position_seconds > 0 → in-progress`; else
  `unwatched`).
- **Repository interface** (shape locked in the design log):
  `addMovie`, `updateMovie`, `deleteMovie`; `getMovie`, `listMovies(query)`,
  `listGenres`, `searchMovies`; `setResumePosition`, `markWatched`,
  `markUnwatched`; `setFavorite`, `setRating`. `MovieQuery` =
  `{ sort, genre?, minRating?, search?, favoritesOnly?, inProgressOnly? }`;
  `sort` ∈ recently-added (`created_at DESC`, `id` tiebreak), A–Z, year,
  highest-rated, unwatched-first.
- **Media paths**: stored as relative strings only — `video_path` + subtitle
  paths relative to `FAMILYFLIX_LIBRARY_ROOT`, `poster_path` / `backdrop_path`
  relative to the managed image cache. The repository never resolves paths.
- **Migrations**: hand-rolled `PRAGMA user_version` runner; ordered
  `{ version, up(db) }` list, each applied in its own transaction. Pragmas set
  on open: `foreign_keys=ON`, `journal_mode=WAL`, `busy_timeout`. Verbose logging
  gated on `DEBUG_SQL === '1'` (the only sanctioned `console.*`).
- **Testing**: real in-memory SQLite per test via `createSqliteStorage(':memory:')`
  — exercise actual SQL, CHECKs, cascades, and row→model assembly; never mock the
  store. These tests establish the backend test pattern for later domains.

---

## Phase 1: Database opens, migrates, and seeds

**User stories**: 1, 2, 3, 4, 5, 6, 36

### What to build

Add `better-sqlite3` (+ types) to the workspace. Implement the `db/` connection +
migration layer and the `createSqliteStorage(dbPath)` factory shell: open the
database, set pragmas, run the `user_version` migration runner, and apply
migration #1 — the full v1 schema (all four tables + indexes) and the 12-genre
seed. No movie methods yet; this phase proves the database stands itself up
correctly and repeatably.

### Acceptance criteria

- [ ] `better-sqlite3` and its types are added; the workspace builds.
- [ ] `createSqliteStorage(dbPath)` opens the DB with `foreign_keys=ON`,
      `journal_mode=WAL`, and a `busy_timeout` set.
- [ ] A fresh `:memory:` database reports `PRAGMA user_version = 1`.
- [ ] A fresh database contains exactly the 12 seeded genres.
- [ ] Re-running migrations on an already-current database is a no-op (version
      unchanged, no duplicate genres).
- [ ] All four tables and the declared indexes (incl. the partial favorite index)
      exist after migration.
- [ ] Verbose SQL logging is wired to `DEBUG_SQL === '1'` and off otherwise.

---

## Phase 2: Add and read a movie (full round-trip)

**User stories**: 7, 8, 9, 10, 11, 12, 13, 14, 15, 31, 33, 34, 36

### What to build

The write→read tracer bullet. `addMovie(input)` inserts across
movies/movie_genres/subtitles in one transaction, generating a UUID id and UTC
ISO-8601 `created_at`/`updated_at`. `getMovie(id)` assembles the full `Movie`
model — genres in order, cast parsed from JSON, subtitles attached, and the
**derived** watch status. Introduces the shared `Movie`/`Genre`/`Subtitle` types
and the pure row→model mapper.

### Acceptance criteria

- [ ] `addMovie` persists a movie with its genres (ordered), cast, and subtitles
      atomically; a failure inserts nothing (no half-written rows).
- [ ] `addMovie` generates a UUID `id` and sets `created_at`/`updated_at` to the
      current UTC ISO-8601 time.
- [ ] `getMovie(id)` returns the full model: genres in `position` order
      (`genres[0]` = primary), cast as an ordered `string[]`, subtitles in track
      order.
- [ ] Derived status truth table holds: `watched` → `watched`;
      `resume_position_seconds > 0` and not watched → `in-progress`; else
      `unwatched`.
- [ ] Rating round-trips across 0–10; an out-of-range value is rejected by the
      CHECK; `null` reads back as unrated and is distinct from a stored 0.
- [ ] `video_path` is required; `poster_path`/`backdrop_path` may be omitted.
- [ ] `getMovie` on an unknown id returns `null` (does not throw).

---

## Phase 3: Browse — list, filter, sort, search, genre rows

**User stories**: 16, 17, 18, 19, 20, 21, 22, 23, 32, 36

### What to build

The browse query layer over the data from Phase 2. One parameterized
`listMovies(query)` covering every sort and every filter, plus `searchMovies` and
`listGenres()` for the home rows. Introduces the shared `MovieQuery` type and the
pure `MovieQuery`→SQL builder.

### Acceptance criteria

- [ ] `listMovies` supports each sort: recently-added (`created_at DESC`, `id`
      tiebreak), A–Z, year, highest-rated, unwatched-first.
- [ ] `listMovies` filters by genre, by minimum rating, by favorites-only, and by
      in-progress-only.
- [ ] Filters and sort combine in a single query (e.g. genre + minRating sorted
      A–Z) and return correct rows.
- [ ] `searchMovies(text)` / a `search` query matches by title text.
- [ ] `listGenres()` returns only genres with ≥ 1 movie, each with its count.
- [ ] A query matching nothing returns `[]` (not an error); each returned item is
      a full assembled `Movie`.

---

## Phase 4: Mutate — watch state, curation, edit, delete

**User stories**: 24, 25, 26, 27, 28, 29, 30, 35, 36

### What to build

The discrete mutators. `setResumePosition` writes only its one column (called
constantly during playback). `markWatched` flips `watched` and zeroes
`resume_position_seconds`; `markUnwatched` reverses it. `setFavorite` and
`setRating` (0–10 or `null`) handle curation. `updateMovie(id, patch)` edits
metadata and refreshes `updated_at`. `deleteMovie(id)` removes the movie and
cascades to its genre links and subtitles.

### Acceptance criteria

- [ ] `setResumePosition(id, seconds)` updates only `resume_position_seconds`.
- [ ] `markWatched` sets `watched` and zeroes `resume_position_seconds`;
      `markUnwatched` clears `watched`; derived status reflects both.
- [ ] `setFavorite(id, value)` toggles the favorite flag (surfaced via the partial
      index).
- [ ] `setRating(id, units | null)` sets a 0–10 rating or clears to unrated;
      out-of-range is rejected.
- [ ] `updateMovie(id, patch)` edits metadata (incl. genres/subtitles) and
      refreshes `updated_at`; returns the persisted full model.
- [ ] `deleteMovie(id)` removes the movie and cascades to `movie_genres` and
      `subtitles` (no orphans).
