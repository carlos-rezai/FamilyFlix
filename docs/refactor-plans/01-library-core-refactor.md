# 01 — Library Core: split the repository into co-located modules

## Problem Statement

`server/src/library/index.ts` is a single ~390-line file that holds the
entire `LibraryStorage` repository: the public interface, every raw row
type, the row→model mapping, the ORDER BY table, the query builder, all
~15 prepared statements, the `addMovie` transaction, and every read,
browse, watch, and curation method. It works, but it's one flat file
that only grows — `updateMovie`/`deleteMovie`, missing-file detection,
and more are still coming — and its tests sit apart from it in
`server/src/__tests__/` (`library.test.ts`, `library-browse.test.ts`,
`library-watch.test.ts`, `library-curation.test.ts`).

Two things bother the developer:

1. **The file has no seams.** The concerns inside it (read, browse,
   write, watch, curation) are already implicitly separated — the test
   file names prove it — but they're all tangled in one closure.
2. **Tests aren't co-located.** CLAUDE.md's code rules say "Co-locate
   tests and styles with the file they belong to," and the frontend will
   follow a folder-per-unit convention. The backend library layer should
   read the same way: a folder per concern, each with its file and its
   test next to it, unified by one barrel at the library root.

## Solution

Break `library/` into one folder per concern, each holding its
implementation file and its co-located test, composed by a single root
`library/index.ts` barrel:

```
server/src/library/
  index.ts        barrel + createSqliteStorage wiring + LibraryStorage interface
  read/           read.ts   read.test.ts    getMovie + shared row→model assembler
  browse/         browse.ts browse.test.ts  listMovies, searchMovies, listGenres
  write/          write.ts  write.test.ts   addMovie, updateMovie, deleteMovie
  watch/          watch.ts  watch.test.ts   setResumePosition, markWatched/Unwatched
  curation/       curation.ts curation.test.ts  setFavorite, setRating
```

The one non-mechanical piece is the **shared row→model assembly**
(`deriveStatus`, `mapRowToMovie`, the `MovieRow`/`GenreRow`/`SubtitleRow`
row types, and the ordered genre/subtitle sub-selects). `getMovie` and
`listMovies` both need it, and `addMovie` calls `getMovie` for its return
value. This lives in `read/`, which exposes a `createMovieReader(db)`
factory that `browse/` and `write/` import. Each concern module is a
small factory that takes the `db` handle (and, where needed, the reader)
and returns just its slice of methods, so prepared statements are still
created once at `createSqliteStorage` init and the raw `db` handle never
leaks past the barrel.

The work happens in three phases, each commit leaving the suite green:

- **Phase A — extract modules.** Move code out of `index.ts` into the
  new modules one at a time. Tests stay in `__tests__/` and keep passing
  throughout (the public barrel API is unchanged), acting as the safety
  net for the risky code-move phase. Behavior-preserving.
- **Phase B — relocate tests.** Move each test next to the module it
  exercises. No logic change.
- **Phase C — additive changes.** On top of the clean structure, add
  `deleteMovie`, add `updateMovie`, and batch the `listMovies` genre/
  subtitle reads — each as its own isolated commit.

## Commits

Each bullet is one commit that leaves the whole test suite passing
(`nx test`). Substitute the real issue number for `#<n>`.

### Phase A — extract modules (behavior-preserving; tests stay in `__tests__/`)

1. **`refactor: [library-core] issue #<n> extract read mapping helpers`**
   Create `library/read/read.ts`. Move `deriveStatus`, `mapRowToMovie`,
   and the `MovieRow`/`GenreRow`/`SubtitleRow` interfaces there and
   export them. `index.ts` imports them and deletes its local copies.
   Nothing else moves yet. Run tests → green.

2. **`refactor: [library-core] issue #<n> add movie reader factory`**
   In `read/read.ts`, introduce `createMovieReader(db)` that owns
   `getMovie(id)` and `assemble(row)` plus the three prepared selects
   (`selectMovie`, the ordered genre select, the ordered subtitle
   select). `index.ts` builds the reader once and routes its `getMovie`,
   the per-row assembly inside `listMovies`, and the `addMovie` return
   value through it; delete the now-dead selects and local `getMovie`
   from `index.ts`. Green.

3. **`refactor: [library-core] issue #<n> extract browse module`**
   Create `library/browse/browse.ts` exporting `createBrowse(db, reader)`
   with `listMovies`, `searchMovies`, `listGenres`, plus the module-
   private `ORDER_BY` table, `buildListQuery`, and the genre-count
   select. Rows are assembled via `reader.assemble`. `index.ts` wires it.
   Green.

4. **`refactor: [library-core] issue #<n> extract write module`**
   Create `library/write/write.ts` exporting `createWrite(db, reader)`
   with `addMovie`, its prepared inserts, the `insertMovieGraph`
   transaction, and the genre-id lookup. Returns `reader.getMovie(id)`.
   `index.ts` wires it. Green.

5. **`refactor: [library-core] issue #<n> extract watch module`**
   Create `library/watch/watch.ts` exporting `createWatch(db)` with
   `setResumePosition`, `markWatched`, `markUnwatched` and their
   statements. `index.ts` wires it. Green.

6. **`refactor: [library-core] issue #<n> extract curation module`**
   Create `library/curation/curation.ts` exporting `createCuration(db)`
   with `setFavorite`, `setRating` and their statements. `index.ts` wires
   it. After this, `index.ts` is just: open db → build reader → build the
   four concern factories → merge into the `LibraryStorage` object →
   `close` — plus the `LibraryStorage` interface and the barrel exports.
   Green.

### Phase B — co-locate tests (no logic change)

7. **`refactor: [library-core] issue #<n> co-locate browse test`**
   Move `__tests__/library-browse.test.ts` → `browse/browse.test.ts`,
   updating its import to the library barrel (`..`). Green.

8. **`refactor: [library-core] issue #<n> co-locate watch test`**
   Move `__tests__/library-watch.test.ts` → `watch/watch.test.ts`. Green.

9. **`refactor: [library-core] issue #<n> co-locate curation test`**
   Move `__tests__/library-curation.test.ts` → `curation/curation.test.ts`.
   Green.

10. **`refactor: [library-core] issue #<n> co-locate read/write tests`**
    Split `__tests__/library.test.ts`: the `getMovie` assembly and
    derived-status truth-table cases go to `read/read.test.ts`; the
    `addMovie` round-trip, rating boundary/CHECK, and transactional-
    insert cases go to `write/write.test.ts`. Both assert through the
    public barrel. Green.

11. **`refactor: [library-core] issue #<n> co-locate db test`**
    Move `__tests__/db.test.ts` → `db/db.test.ts`. `__tests__/` is now
    empty — remove it. Green.

### Phase C — additive changes (each isolated, on the clean structure)

12. **`feat: [library-core] issue #<n> add deleteMovie`**
    Add `deleteMovie(id): void` to the `LibraryStorage` interface and the
    `write/` module — a single `DELETE FROM movies`, relying on the
    existing `ON DELETE CASCADE` FKs to remove `movie_genres` and
    `subtitles` rows. Add `write/write.test.ts` cases asserting the movie
    is gone and its genres/subtitles cascaded. No schema change. Green.

13. **`feat: [library-core] issue #<n> add updateMovie`**
    Add a `MoviePatch` type to `src/types` and `updateMovie(id, patch):
Movie` to the interface + `write/` module. Transactional: patch every
    provided column dynamically (including rating/is_favorite/watched/
    resume — a single general entry point); if `genres` is present,
    replace `movie_genres`; if `subtitles` is present, replace
    `subtitles`; bump `updated_at`; return `reader.getMovie(id)`. It
    carries no side-effect conventions (unlike `markWatched`, it does not
    auto-zero resume). Add `write/write.test.ts` cases. Green.

14. **`refactor: [library-core] issue #<n> batch listMovies reads`**
    Replace the per-row genre/subtitle fetches in `listMovies` with two
    set-based reads keyed off the same filtered movie subquery
    `buildListQuery` produces, grouped in memory in `read/` (e.g. an
    `assembleMany(rows, whereClause, params)` on the reader). Output —
    order, genres[0]-primary ordering, subtitle track order — is
    identical; the existing browse tests are the guard. Green.

## Decision Document

- **Module seams:** `read`, `browse`, `write`, `watch`, `curation` —
  mirroring the existing test-file split and the design-log phases.
  `read/` owns `getMovie` plus the shared assembler; `write/` owns
  `addMovie` (and, after Phase C, `updateMovie`/`deleteMovie`); `watch/`
  and `curation/` are the pure single-column mutators.
- **Shared assembly lives in `read/`.** `getMovie` is a public method
  anyway, so `read/` owns it and exports `createMovieReader(db)` →
  `{ getMovie, assemble }` (plus the `MovieRow` type). `browse/` and
  `write/` import it. No separate `shared/` or `mapper/` folder — that
  keeps the split within-domain and avoids anything that reads like a
  `services/`/`lib/` catch-all (forbidden by CLAUDE.md at the
  `server/src/` level).
- **Composition pattern:** each concern module is a factory —
  `createBrowse(db, reader)`, `createWrite(db, reader)`,
  `createWatch(db)`, `createCuration(db)` — returning only its slice of
  methods. `library/index.ts` opens the db, builds the reader once, wires
  each factory, merges the results into one `LibraryStorage`, and owns
  `close`. Prepared statements are created once per factory at init, as
  today. The raw `db` handle never escapes the barrel.
- **One barrel, not one per folder.** Only the root `library/index.ts`
  is a barrel (it re-exports `createSqliteStorage` and the
  `LibraryStorage` type). Sub-module folders do **not** get their own
  `index.ts`; internal imports reach the file directly
  (`./read/read`). Unlike the frontend's per-component barrels, these are
  internal backend modules with a single consumer (the root), so per-
  folder barrels would be ceremony with no benefit.
- **No `.styles` file.** This is the backend, so the unit shape is
  `folder + <name>.ts + <name>.test.ts` (plus the root barrel) — not the
  four-file frontend shape.
- **`LibraryStorage` interface stays the public contract in
  `index.ts`.** Each factory can type its return as its own slice; the
  merged object satisfies `LibraryStorage`.
- **`updateMovie` semantics — single general entry point.** `MoviePatch`
  may include any patchable column, including `rating`, `is_favorite`,
  `watched`, and `resume_position_seconds`. Provided fields are written;
  omitted fields are untouched. `genres`/`subtitles`, if present, replace
  the existing rows; if absent, they're left alone. `updated_at` is
  bumped. It applies **no** implicit conventions. The dedicated mutators
  remain because they serve different needs: `setResumePosition` is a hot
  single-column write that deliberately does not bump `updated_at`, and
  `markWatched` keeps its "flip watched + zero resume" convenience.
- **`deleteMovie` relies on existing FK cascade.** `movie_genres.movie_id`
  and `subtitles.movie_id` already declare `ON DELETE CASCADE`, and the
  connection sets `foreign_keys = ON`, so `deleteMovie` is a single
  `DELETE FROM movies`.
- **No schema change / migration #2.** `updateMovie`/`deleteMovie` use
  existing columns and existing cascade behavior. `PRAGMA user_version`
  stays at 1.
- **N+1 fix uses the filtered-subquery approach**, not an `IN (…id list)`
  — the batched genre/subtitle reads are scoped by re-running
  `buildListQuery`'s `WHERE` as a subquery, so there's no SQLite bound-
  parameter-limit concern at ~10k rows and the result is byte-identical
  to the current per-row assembly.
- **Import-path stability.** The only current importers of the
  `library`/`db` barrels are the tests. Keeping `createSqliteStorage`
  exported from `library/index.ts` means no downstream import churn.
- **Test discovery needs no config change.** The Vitest `include` glob
  (`{src,server,tests}/**/*.{test,spec}.…`) already matches co-located
  `*.test.ts` anywhere under `server/`.

## Testing Decisions

- **What makes a good test here:** exercise external behavior only —
  drive the public `LibraryStorage` methods against a real in-memory
  SQLite database and assert on returned `Movie` models and on
  observable DB side-effects (read back through the same API). Do not
  assert on implementation details: module boundaries, which file owns a
  statement, prepared-statement counts, or SQL text. A reader must be
  able to move a method between modules without touching a test.
- **The reorg commits (Phases A & B) add no tests.** The existing suite
  is the safety net; keeping it green through every extraction is the
  entire point of a behavior-preserving refactor. Phase B only relocates
  and (for `library.test.ts`) re-partitions existing cases.
- **Modules that gain new tests (Phase C):** `write/` gets `deleteMovie`
  (movie removed + genres/subtitles cascaded) and `updateMovie` (each
  patchable field written; omitted fields unchanged; genres/subtitles
  replaced when present; `updated_at` bumped; rating CHECK still
  enforced) cases. `browse/`/`read/` need no new behavioral tests for the
  N+1 fix — the existing multi-genre / multi-subtitle assembly and
  ordering assertions are the guard that batching changed nothing; add
  one only if a gap surfaces.
- **Prior art:** the current `__tests__/library*.test.ts` and
  `db.test.ts` are the model — real `:memory:` SQLite per test (no
  mocks), a `track()`/`afterEach` close helper for per-test isolation,
  `// @vitest-environment node`, and assertions made through the public
  interface. New and relocated tests follow the same shape.

## Out of Scope

- HTTP routes, the `media/` scan/reference layer, Electron wiring — all
  still deferred per the design log.
- TMDB fetching (token-strip → title+year search → review step, genre-
  vocabulary mapping) — a media/metadata-layer feature.
- Missing-file detection, folder-mtime recency backfill, and multi-
  edition support — still roadmap/deferred.
- Any schema migration (no migration #2); the v1 schema and the 12-genre
  seed are untouched.
- Reworking the pragmas, the migration runner, or `openDatabase` — `db/`
  is touched only to relocate its test file.
- Per-folder barrels and any frontend-style `.styles` files.

## Further Notes

- Suggested phase gating: land Phase A + B first (pure structural move,
  fully green, easy to review as "no behavior change"), then Phase C. If
  review pressure mounts, Phase C's three commits (`deleteMovie`,
  `updateMovie`, N+1) can each be split into their own follow-up PR
  without affecting the reorg.
- `updateMovie` as an all-columns patcher overlaps the dedicated
  mutators by design (developer's call). The mitigation against write-
  path drift is documentation, not code: `updateMovie` writes exactly
  what it's given with no conventions, while the mutators own the
  hot-path and side-effect behaviors. Worth a short note in the
  `LibraryStorage` interface doc-comment when it's added.
