## Problem Statement

FamilyFlix needs a foundation before any screen, player, or importer can exist:
a single, trustworthy place that holds the household's movies and answers
questions about them. Today the backend domain folders (`db/`, `library/`,
`media/`, …) are empty `.gitkeep` placeholders — there is no movie model, no
database, and nothing for the browse grid, search, player, or import flows to
read and write through.

The maintainer has a large real-world library (~12 TB at 720p ⇒ ~6,000–12,000
movies) living as one-folder-per-movie on a drive. He needs that library backed
by a fast, local, offline-first store where:

- browse / search / sort / filter stay responsive at ~10k rows,
- watch state (watched, in-progress, resume position) can never contradict
  itself,
- rich metadata (synopsis, cast, director, runtime, genres, poster, backdrop,
  rating) fetched from TMDB at import time slots in cleanly, and
- the multi-terabyte video files are **never duplicated** onto disk.

## Solution

Build the **library core**: the canonical Movie data model, its SQLite storage,
and a single repository seam (`LibraryStorage`) that every other feature reads
and writes through. Nothing in the app talks to SQLite except this layer.

Scope is deliberately narrow — schema + `db/` connection/migration layer +
`library/` repository **only**. No HTTP routes, no folder scanning or media
copy, no Electron wiring, and no TMDB fetching this round (those are downstream
media/metadata-layer and shell features). This round produces the deep,
in-isolation-testable storage module the rest of the app stands on.

Key shape, all settled during the grill (`docs/design-logs/01-library-core.md`):

- **Reference media in place.** `video_path` and subtitle paths are stored
  **relative to a configured `FAMILYFLIX_LIBRARY_ROOT`**; the app never copies
  the 12 TB of film. Only **posters/backdrops** (downloaded from TMDB) are owned,
  living in a managed image cache. This **reverses** the older "copy into managed
  storage" model still described in CLAUDE.md.
- **Normalize what you query, denormalize what you only display.** Genres are a
  junction table (a primary browse/filter dimension); cast is a JSON `string[]`
  column (display-only, never queried); subtitles are a normalized child table
  (real file assets the player consumes); director is a plain text column.
- **Derive watch status, never store it.** Store two facts — `watched` boolean +
  `resume_position_seconds` — and derive `unwatched | in-progress | watched`.
- **TMDB seeds the rating** at import (`round(vote_average)`, low `vote_count` →
  `NULL`/unrated); maintainer overrides anytime. One household 0–10 half-star
  score, not a separate community field.
- **UUID ids + UTC ISO-8601 timestamps**, repo-generated, for re-import/backup
  stability and correct recency ordering.

## User Stories

1. As the maintainer, I want a single SQLite database file created and migrated
   to the current schema the first time the app opens it, so that I never have to
   hand-build tables.
2. As the maintainer, I want the database opened with `foreign_keys=ON`,
   `journal_mode=WAL`, and a `busy_timeout`, so that cascades are enforced and
   concurrent reads during a write don't error.
3. As the maintainer, I want schema versions tracked via `PRAGMA user_version`
   and applied in order inside transactions, so that a future schema change
   upgrades an existing database safely without a migrations library.
4. As the maintainer, I want a fresh database to come pre-seeded with the
   12-genre pool, so that genre browse rows and filters work before any movie
   exists.
5. As the maintainer, I want re-running migrations on an already-current database
   to be a no-op, so that opening the app repeatedly never re-applies or
   double-seeds anything.
6. As a developer, I want one `createSqliteStorage(dbPath)` factory that returns
   the whole repository, so that every consumer (routes, importer, player) has a
   single seam over SQLite and `src/` never touches the database directly.
7. As the maintainer, I want to add a movie with title, year, runtime, synopsis,
   director, cast, rating, genres, a video path, optional poster/backdrop paths,
   and subtitles, all written in one transaction, so that a movie is never
   half-inserted across the movies/movie_genres/subtitles tables.
8. As the maintainer, I want the movie's id generated as a UUID and its
   `created_at`/`updated_at` set to the current UTC ISO-8601 time at insert, so
   that ids survive backup/re-import and recency ordering is correct across
   timezones and DST.
9. As the maintainer, I want a movie's genres stored with their order preserved
   (`genres[0]` = primary tag), so that the primary genre is stable for display
   and the genre row it belongs to.
10. As the maintainer, I want a movie's cast stored and returned as an ordered
    `string[]`, so that the detail page shows the billed order without a join.
11. As the maintainer, I want subtitles stored as child rows with a path, a human
    language label, and a track order, so that the player can offer each subtitle
    track in a stable order.
12. As the maintainer, I want a movie with no rating to read back as `null`
    (unrated), distinct from a movie rated 0, so that "unrated" and "rated zero
    stars" are never conflated.
13. As the maintainer, I want a rating outside 0–10 to be rejected by the
    database, so that an out-of-range half-star value can never be persisted.
14. As a parent (browsing), I want to fetch a single movie by id and get the full
    assembled model — ordered genres, parsed cast, subtitles, and a **derived**
    status — so that the detail page has everything it needs in one read.
15. As a parent, I want a movie that is `watched` to report status `watched`, one
    with `resume_position_seconds > 0` (and not watched) to report `in-progress`,
    and otherwise `unwatched`, so that the card badge always reflects reality.
16. As a parent, I want to list movies with a chosen sort — recently added, A–Z,
    year, highest rated, unwatched first — so that I can browse the way I prefer.
17. As a parent, I want to filter the movie list by genre, so that a genre row /
    genre page shows only its movies.
18. As a parent, I want to filter the movie list by minimum rating, so that I can
    narrow to highly-rated titles.
19. As a parent, I want to filter to favorites only, so that the Favorites row
    shows just the movies marked favorite.
20. As a parent, I want to filter to in-progress only, so that the Continue
    Watching row resumes the right titles.
21. As a parent, I want to search movies by title text, so that search-as-you-type
    finds a title quickly.
22. As a parent, I want filters and sort to combine in one query (e.g. a genre +
    minimum rating, sorted A–Z), so that browse and search behave consistently
    through one parameterized path.
23. As a parent, I want the home screen to list only genres that have at least one
    movie, each with its count, so that empty genre rows never render.
24. As the player, I want to report the current playback position frequently by
    writing only the `resume_position_seconds` column, so that resume survives a
    crash and constant writes stay cheap.
25. As the maintainer, I want to mark a movie watched — which flips `watched` and
    by convention zeroes `resume_position_seconds` — so that a finished movie
    leaves the Continue Watching row.
26. As the maintainer, I want to mark a movie unwatched, so that I can correct a
    mistaken "watched" flag.
27. As the maintainer, I want to toggle a movie's favorite flag, so that it
    appears in or leaves the Favorites row.
28. As the maintainer, I want to set or clear a movie's rating (0–10 half-star
    units, or `null` for unrated), so that I can override the TMDB-seeded score.
29. As the maintainer, I want to edit a movie's metadata (title, year, genres,
    cast, subtitles, paths, etc.) and have `updated_at` refreshed, so that
    corrections persist and recency-of-edit is tracked.
30. As the maintainer, I want deleting a movie to also remove its genre links and
    subtitle rows via cascade, so that no orphaned child rows are left behind.
31. As a developer, I want every mutator to return or reflect the persisted state
    (full model on add/update), so that callers don't need a second read to get
    the updated movie.
32. As a parent, I want a browse query that matches nothing to return an empty
    list (not an error), so that an empty library or an over-narrow filter renders
    a clean empty state.
33. As the maintainer, I want fetching a non-existent movie id to return `null`
    (not throw), so that a deleted/stale link is handled gracefully.
34. As the maintainer, I want `video_path` required but `poster_path` and
    `backdrop_path` optional, so that a movie can exist before its TMDB images are
    cached, while a movie with no video file is impossible.
35. As the maintainer, I want all stored paths to be relative (to the library root
    or image cache), so that reassigning a Windows drive letter or restoring a
    backup on another machine doesn't break the library.
36. As a developer, I want the repository's behavior verified against a real
    in-memory SQLite database, so that the actual SQL, CHECK constraints,
    cascades, and row→model assembly are exercised — not mocked away.

## Implementation Decisions

- **Three modules, built bottom-up:**
  1. **`db/` — connection + migration layer (deep module).** A small interface
     that, given a `dbPath`, opens `better-sqlite3`, sets pragmas
     (`foreign_keys=ON`, `journal_mode=WAL`, `busy_timeout`), runs pending
     migrations keyed on `PRAGMA user_version` (each migration `{ version, up }`
     in its own transaction), and returns a ready handle. The v1 schema (movies,
     genres, movie_genres, subtitles, indexes) **and** the 12-genre seed are
     migration #1. Verbose logging is `DEBUG_SQL === '1' ? console.info :
undefined` — the single sanctioned, gated `console.*`.
  2. **`library/` — `LibraryStorage` repository (the deep module).** One
     `createSqliteStorage(dbPath)` factory that runs migrations, prepares all
     statements once at init, and exposes the interface below. Multi-table writes
     are transactional; reads assemble the full model.
  3. **Pure assembly/query helpers inside `library/`** — a row→`Movie` mapper
     (parse cast JSON, attach ordered genres/subtitles, compute derived status)
     and a `MovieQuery`→parameterized-SQL builder. Kept as pure functions so the
     mapping and query construction are testable without a database.

- **Repository interface (shape locked in the design log):**
  - lifecycle (transactional): `addMovie(input)`, `updateMovie(id, patch)`,
    `deleteMovie(id)`
  - reads (full-model assembly): `getMovie(id)` → `Movie | null`,
    `listMovies(query)`, `listGenres()` → genres-with-count (≥1 movie),
    `searchMovies(text)`
  - watch: `setResumePosition(id, seconds)` (one-column write), `markWatched(id)`
    (flips `watched`, zeroes resume), `markUnwatched(id)`
  - curation: `setFavorite(id, value)`, `setRating(id, units | null)`
  - `MovieQuery` fields: `sort`, `genre?`, `minRating?`, `search?`,
    `favoritesOnly?`, `inProgressOnly?`; `sort` ∈ recently-added (`created_at
DESC`, `id` tiebreak), A–Z, year, highest-rated, unwatched-first.

- **Schema v1** (see design log for full DDL): `movies` keyed by text UUID with
  `tmdb_id` (indexed, not unique), metadata columns, `rating INTEGER CHECK(rating
BETWEEN 0 AND 10)` nullable, `is_favorite`/`watched`/`resume_position_seconds`
  with defaults, `video_path NOT NULL`, nullable `poster_path`/`backdrop_path`,
  and repo-generated `created_at`/`updated_at` UTC ISO-8601 text. `genres`
  (unique name, 12 seeded). `movie_genres` junction with `position` and
  `ON DELETE CASCADE`. `subtitles` child with `path`/`language`/`position` and
  `ON DELETE CASCADE`. Indexes on `movies(title, year, created_at, rating,
tmdb_id)`, `movie_genres(genre_id)`, `subtitles(movie_id)`, and a partial index
  on `movies(is_favorite) WHERE is_favorite = 1`.

- **Derived status, never stored:** `watched=1 → 'watched'`;
  `resume_position_seconds > 0 → 'in-progress'`; else `'unwatched'`. Computed in
  the row→model mapper.

- **Ids + timestamps repo-generated:** `crypto.randomUUID()` for every row id;
  `created_at`/`updated_at` set to current UTC ISO-8601 by the repo, **not**
  SQLite `CURRENT_TIMESTAMP`.

- **Media model:** `video_path` + subtitle paths are relative to
  `FAMILYFLIX_LIBRARY_ROOT`; `poster_path`/`backdrop_path` are relative to the
  managed image cache. The repository only stores/returns strings — path
  resolution (`root + relative`) belongs to the media layer, out of scope here.
  No path-shape CHECK in the schema.

- **New dependency:** add `better-sqlite3` (+ types) to the workspace — no backend
  runtime deps are installed yet.

- **Shared `Movie` / `Genre` / `Subtitle` / `MovieQuery` / `WatchStatus` types**
  live in `src/types/` (CLAUDE.md's home for shared interfaces) so the frontend
  and the repository agree on one model; the repository imports them rather than
  redefining its own. No `any` anywhere.

- **Doc debt acknowledged (not done in this round):** CLAUDE.md still describes
  the retired copy-into-managed-storage model, omits `FAMILYFLIX_LIBRARY_ROOT`,
  and says metadata is hand-entered. Trust the design log + ubiquitous language
  over CLAUDE.md on the media/TMDB model until CLAUDE.md is amended.

## Testing Decisions

- **What makes a good test here:** assert externally observable behavior through
  the `LibraryStorage` interface — what you put in comes back out correctly, the
  derived status truth table holds, constraints reject bad data, cascades clean
  up children, and each query/sort/filter returns the right rows in the right
  order. Do **not** assert on prepared-statement internals, SQL text, or private
  helpers' call order.
- **Real in-memory SQLite, not a mock.** Each test gets a fresh `:memory:`
  database via `createSqliteStorage(':memory:')`, exercising the actual SQL,
  CHECK constraints, foreign-key cascades, and row→model assembly. A mock would
  prove nothing about the schema this PRD's whole value rests on.
- **Modules tested:**
  - **`db/` migration layer:** a fresh database reports `user_version = 1` and
    contains exactly the 12 seeded genres; re-running migrations is a no-op
    (version unchanged, no duplicate genres).
  - **`library/` repository (primary coverage):** add→get round-trip (genres
    ordered, cast parsed, subtitles attached); derived-status truth table
    (watched / in-progress / unwatched); rating boundaries + out-of-range CHECK
    rejection; unrated (`null`) vs rated-0 distinction; `listMovies` across every
    sort and every filter (genre, minRating, favoritesOnly, inProgressOnly,
    search) and their combinations; empty-result and unknown-id (`null`) cases;
    `listGenres` counts only genres with ≥1 movie; mutators
    (`setResumePosition`, `markWatched`/`markUnwatched`, `setFavorite`,
    `setRating`, `updateMovie` refreshes `updated_at`); `deleteMovie` cascades to
    `movie_genres` + `subtitles`.
  - **Pure helpers:** the row→`Movie` mapper and the `MovieQuery`→SQL builder can
    additionally be unit-tested directly, but the `:memory:` integration tests are
    the source of truth for behavior.
- **Prior art:** none yet — this is the first backend code in the repo, so these
  tests establish the pattern (fresh `:memory:` DB per test via the factory) that
  later backend domains (`media/`, `import-export/`) will follow. Frontend tests
  use Vitest + @testing-library/react; the backend uses Vitest against
  `better-sqlite3`.

## Out of Scope

- HTTP routes (`server/src/routes/`) — no Express surface this round.
- Media layer: folder scanning, file existence checks, path resolution
  (`root + relative`), subtitle detection, and anything that touches the
  filesystem.
- **TMDB fetching itself**: token-stripping folder names, title+year search, the
  import review/match-confirm step, throttling/resume/offline-graceful behavior,
  and genre-vocabulary mapping. This round only provides the columns TMDB data
  lands in.
- Electron main-process / window / packaging wiring.
- Missing-file detection and a "file not found" movie state (the accepted
  downside of reference-in-place) — deferred to the media layer.
- Folder-mtime recency backfill (import-time timestamp only for now).
- Multi-edition support (4K / Director's Cut). v1 is one video file per movie; a
  folder with multiple video files is a later import-review concern, not a schema
  one.
- Amending CLAUDE.md / DESIGN_BRIEF (the TMDB match-confirm affordance) — flagged,
  done outside this PRD.

## Further Notes

- This is the foundation every 🔜 feature depends on; its interface is intended to
  rarely change, so depth (lots of functionality behind the simple
  `createSqliteStorage` seam) is preferred over breadth.
- The grill surfaced two facts that reshaped the model and now diverge from
  CLAUDE.md: **reference-in-place media** (driven by the ~12 TB library) and
  **TMDB as the metadata/rating source** (not AI — a metadata lookup, so it does
  not touch the "No AI" rule). The design log
  (`docs/design-logs/01-library-core.md`) and `docs/ubiquitous-language.md` are
  authoritative over CLAUDE.md until CLAUDE.md is amended.
- Timestamps are stored UTC ISO-8601 but will be **displayed** in `de-DE` /
  `Europe/Berlin` by the frontend — a display concern, not a storage one, so no
  impact on this layer beyond storing UTC.
- Suggested build order matches the design log's implementation plan: (1) db +
  migration runner + v1 schema/seed; (2) add/get round-trip; (3) listMovies +
  listGenres browse query; (4) remaining mutators + cascade.
