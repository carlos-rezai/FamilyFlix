# Plan: Continue Watching (ordering the resume shelf)

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/75

The Continue Watching row already ships. `03-card-carousel` built it end to end
— `ContinueCard`, `ContinueRow`, `continueView`, `CardCarousel
variant="continue"`, `HomePayload.continueWatching` — and the translation is 1:1
against `docs/handoff/page.LibraryPage.dc.html`. **No shipping frontend file
changes in any phase of this plan.** Zero pixels move. What is wrong is the
order the shelf comes back in: `recently-added` answers "when was this
imported", and the shelf asks "what was I watching". Behind the 15-cap that is
not just a wrong order, it is the wrong fifteen.

The fix is one nullable column stamped by exactly two mutators, one `ORDER BY`
entry over it, and one section of the home aggregate pinning that order instead
of taking the caller's. Everything else — the route, the wire, the hook, the
components — is untouched.

The slicing follows the direction the data flows: **write it** (Phase 1),
**order by it** (Phase 2), **pin the shelf to that order** (Phase 3), **say why
in the docs** (Phase 4). Each phase is verifiable through the public
`LibraryStorage` interface against a real migrated `:memory:` database, and
Phase 3 is verifiable by looking at the running app.

**Two ordering calls worth naming up front:**

- **The dev seed's staggered stamps ride in Phase 1**, not a phase of their own
  and not with the ordering work. The seed is the first real consumer of
  `NewMovie.lastWatchedAt`, which is Phase 1's own addition, and stamping the
  fixtures before anything orders by them is what makes Phase 3 demoable the
  moment it lands rather than a phase later. The honest cost: a Phase 1 reviewer
  sees the seed writing a column nothing yet reads.
- **The 16 frontend fixture edits ride in Phase 1 too**, because they must.
  `Movie` gains a required `lastWatchedAt`, and every `makeMovie` factory that
  builds the record as a full object literal stops type-checking in the same
  commit. They are mechanical, they are not a phase, and collapsing them into
  one shared builder is a refactor filed in Phase 4 — not done here.

**One intermediate state worth naming.** Phase 2 adds a `last-watched` entry to
the `ORDER_BY` record whose only caller, for one phase, is a test — no route can
ask for it and `getHome` does not yet pin it. That is the cost of reviewing the
ordering semantics (nulls-last, the exact tiebreak, the second sort vocabulary)
separately from the aggregate's deliberate asymmetry, and it is one phase long.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema: migration #2.** A second `Migration` joins the ordered list run by
  the `PRAGMA user_version` runner. `V1_SCHEMA` is **not** edited — every
  existing dev database would silently lack the column. `ALTER TABLE movies ADD
COLUMN last_watched_at TEXT`, nullable, no default, plus a **partial index**
  restricted to non-null rows, the same shape `idx_movies_is_favorite` already
  uses. This is the runner's first real exercise since #1.
- **No backfill.** Every existing row migrates to `NULL`, meaning "never
  watched, as far as we recorded". Backfilling from `updated_at` would invent a
  watch history and scramble the queue with fiction on first launch.
- **The column is `last_watched_at`, not `updated_at`.** `updateMovie` bumps
  `updated_at` on any edit, so reusing it would let favoriting or re-rating a
  film shove it to the front of the resume queue. "When did anything about this
  record change" is not "when did we last watch it".
- **Two writers, and only two.** `setResumePosition` and `markWatched` stamp it
  — finishing a film is watching it. `markUnwatched` does not (un-marking is not
  watching, and it leaves the resume position at 0 so the movie cannot re-enter
  the row anyway). `updateMovie` does not. The timestamp is
  `new Date().toISOString()` generated in the mutators, matching the existing
  write path: SQLite's `datetime('now')` yields `YYYY-MM-DD HH:MM:SS`, which
  violates the ISO-strings code rule.
- **Key models.** `Movie` gains `lastWatchedAt: string | null`, assembled beside
  `createdAt`/`updatedAt` — the direct precedent for a stored field no screen
  renders. `NewMovie` gains it as optional (the seed needs it; bulk import will
  carry watch history in). `MoviePatch` does **not** gain it, so an ordinary
  edit form can never reorder the resume queue.
- **Two sort vocabularies.** `MOVIE_SORTS` is **unchanged** — it stays the five
  orders the wire and the Sort dropdown share, per the rule that a sort a URL
  can name must be one a control can show. A new `ListSort = MovieSort |
'last-watched'` types the repository instead: `MovieQuery.sort` widens to
  `ListSort`; `LibraryQuery.sort` and `GenreQuery.sort` stay `MovieSort`,
  because that is what a URL carries. The `ORDER_BY` record is typed over
  `ListSort`, so TypeScript enforces that it stays exhaustive over the wider
  one.
- **Routes: unchanged.** No new endpoint. `parseSort` keeps validating against
  `MOVIE_SORTS`, so `last-watched` can never arrive from a hand-edited URL —
  `?sort=last-watched` is a 400 exactly as any other unknown sort is.
- **The order is decided in SQL, never by re-sorting the returned array.** The
  15-cap is a `LIMIT` applied after the `ORDER BY`; sorting afterwards would
  take the 15 most recently _added_ and then order those — the wrong fifteen,
  silently.
- **Nulls sort last, then in exactly today's order.** The `last-watched`
  `ORDER BY` body is a leading `IS NULL` key (the idiom `year` and
  `highest-rated` already use), then the stamp descending, then
  `recently-added`'s **exact** body as the tiebreak. An unstamped library is
  therefore byte-for-byte the shelf it is now.
- **The continue section pins its order; the favorites shelf does not.** Both
  sections' _filters_ still come from the caller's **Library query** — a filter
  answers _which_ movies are on the shelf. The resume queue's order is part of
  what the shelf **means**, so it is not the caller's to set. Nothing about a
  shelf of favorites implies an intrinsic order, so it keeps obeying Sort. The
  asymmetry is deliberate and the code comment must say so.
- **Nothing is built that has no caller.** No `POST /api/movies/:id/resume`, no
  `saveResume` wire call, no `api/` module, no sixth Sort dropdown option, no
  "remove from Continue Watching" control, and nothing renders the timestamp.
  When the player lands it calls `setResumePosition` and the row orders itself
  with no further wiring. (Story 24, and it constrains every phase.)

---

## Phase 1: The stamp

**User stories**: 4, 5, 6, 12, 13, 14, 16, 17, 18, 21, 22, 23, 26, 27

### What to build

The library learns to record when a movie was last watched, end to end: the
column exists, the two watch mutators stamp it, `addMovie` accepts it, and every
read hands it back.

Migration #2 adds the nullable column and its partial index and runs against
existing dev databases without a re-seed. The row shape and the row→model
assembly gain the field beside `createdAt`/`updatedAt`. `setResumePosition` and
`markWatched` each write `new Date().toISOString()` alongside the column they
already write; `markUnwatched` is untouched and leaves any existing stamp alone.
`addMovie` writes the supplied value or `NULL`.

The dev seed's in-progress fixtures gain explicit, staggered stamps in the same
phase — they are the first caller of `NewMovie.lastWatchedAt`, and without them
Phase 3 would be invisible in the running app. The reserved-video-path
idempotency guarantee is untouched: the stamps are ordinary field values on
fixtures the delete pass already scopes.

The 16 frontend `makeMovie` factories each gain `lastWatchedAt: null`. This is
type-level only; no frontend behaviour changes and no frontend test changes what
it asserts.

Nothing orders by the column yet.

### Acceptance criteria

- [ ] A fresh `:memory:` database is at `user_version = 2` and holds
      `last_watched_at` plus a partial index restricted to non-null rows
- [ ] A database already at version 1 migrates to 2 in place, keeps its rows,
      and every existing row reads back `lastWatchedAt: null` — no backfilled
      value anywhere
- [ ] `V1_SCHEMA` is unedited
- [ ] A movie added without `lastWatchedAt` reads back `null`; one added with a
      value reads back exactly that value, through `getMovie` and `listMovies`
      alike
- [ ] `setResumePosition` stamps the column with an ISO string, and the stamped
      value is the frozen clock's time
- [ ] `markWatched` stamps it too
- [ ] `markUnwatched` does not stamp it, and leaves an existing stamp exactly as
      it was
- [ ] `updateMovie` cannot write it: `MoviePatch` has no such key, and an edit
      that bumps `updated_at` leaves `last_watched_at` unchanged
- [ ] The seed's in-progress fixtures all carry a `lastWatchedAt`, and the
      values are staggered rather than identical
- [ ] Running the seed twice leaves the same library, stamps included
- [ ] `node_modules/.bin/tsc --noEmit` is clean and the full suite passes with
      the 16 fixture edits and no other frontend change

---

## Phase 2: The order

**User stories**: 15, 19, 20, 25

### What to build

The repository gains an order it can be asked for by name, one member wider than
the wire's vocabulary.

`ListSort` is declared as `MovieSort | 'last-watched'` and `MovieQuery.sort`
widens to it, while `LibraryQuery.sort` and `GenreQuery.sort` stay `MovieSort`.
The `ORDER_BY` record is retyped over `ListSort` — which is what forces the new
entry to exist — and gains the `last-watched` body: `IS NULL` first, stamp
descending, then `recently-added`'s exact body as the tiebreak.

`MOVIE_SORTS` and the route are untouched, which is the point: the new order is
reachable from `listMovies` and from nowhere else. Assert that, rather than
assuming it.

Its only production caller arrives in Phase 3.

### Acceptance criteria

- [ ] `listMovies({ sort: 'last-watched' })` returns most-recently-stamped first
- [ ] Unstamped movies sort after every stamped one
- [ ] Among unstamped movies the order is `recently-added`'s exactly — same
      `created_at DESC`, same `id` tiebreak — so a library with no stamps at all
      returns the identical list `recently-added` returns
- [ ] The `ORDER BY` is in the SQL: a `limit` takes the first N of the
      last-watched order, not the first N of any other order re-sorted
- [ ] `MOVIE_SORTS` still has exactly its five members
- [ ] `GET /api/home?sort=last-watched`, `/api/movies?sort=last-watched` and
      `/api/genre/:name?sort=last-watched` are each a 400 with an
      `Unknown sort:` body
- [ ] `LibraryQuery.sort` and `GenreQuery.sort` still reject `'last-watched'` at
      the type level

---

## Phase 3: The shelf pins its order

**User stories**: 1, 2, 3, 7, 8, 9, 10, 11

### What to build

The tracer bullet reaches the screen. `listSection` takes the sort beside the
flag — both being "what makes this section that section" — and `getHome` passes
`'last-watched'` for `continueWatching` and the caller's own sort for
`favorites`. `getHome` already overrides part of the caller's query per section
(`inProgressOnly`, `favoritesOnly`, `genre`, `limit`); the sort is one more
addition of the same kind.

The continue section's _filters_ are untouched: search, genre and minimum rating
still narrow it exactly as `05-search-filter` decided. Only its order stops
being the caller's.

**Demoable**: `npm run db:seed`, start the app, open the browse home. The
Continue Watching row reads as a queue, most recently watched first. Pick "A–Z"
from Sort and the row holds its order while the Favorites shelf and every genre
row alphabetise underneath it.

### Acceptance criteria

- [ ] With the caller's sort set to `a-z`, `continueWatching` comes back
      last-watched-first while `favorites` and every genre row come back A–Z
- [ ] The same holds for each of the other four sorts
- [ ] A film stamped last night precedes one stamped weeks ago regardless of
      which was added first
- [ ] Favoriting or re-rating a film does not move it within `continueWatching`
- [ ] `markWatched` still removes a film from the section entirely
- [ ] `markUnwatched` reorders nothing
- [ ] Every filter still narrows the section: `search`, `genre` and `minRating`
      each drop non-matching movies from `continueWatching`
- [ ] The 15-cap selects the 15 most recently watched — with more than 15
      in-progress movies, the 16th-most-recently-watched is absent and no
      recently-_added_ straggler is present
- [ ] `continueWatching` is `[]` when nothing is in progress, and the row stays
      hidden
- [ ] A library where nothing has ever been stamped returns exactly today's
      section, in today's order
- [ ] No shipping frontend file has changed across Phases 1–3

---

## Phase 4: Docs and the filing

**User stories**: none directly — the documentation obligations the PRD records,
plus the refactor it defers.

### What to build

No behaviour change. The comments that would otherwise leave the next reader
guessing why two adjacent `listSection` calls disagree.

The home aggregate's contract comment is amended: every section is built from
the one **Library query** — now true of its _filters_, not of the continue
section's order — and the asymmetry between the two flat sections is stated with
its reason, not merely observed. The `MOVIE_SORTS` doc comment gains the
`ListSort` distinction. The `LibraryStorage` docs for `getHome`,
`setResumePosition` and `markWatched` say what they now do. `03-card-carousel`'s
Q11 is marked answered by 09.

The shared `makeMovie` test builder — 16 duplicated factories that this feature
just edited in lockstep — is filed as its own refactor issue, not done here.

### Acceptance criteria

- [ ] `home.ts`'s module docblock distinguishes the sections' shared filters
      from the continue section's pinned order
- [ ] The `listSection` call site says why one section pins its sort and the
      other does not
- [ ] The `MOVIE_SORTS` doc comment names `ListSort` and says why the repository
      knows one more order than the wire
- [ ] `LibraryStorage`'s `getHome`, `setResumePosition` and `markWatched` docs
      match their behaviour
- [ ] `03-card-carousel`'s Q11 records that 09 answered it
- [ ] A refactor issue exists for the shared `makeMovie` builder
- [ ] The feature is **not** ticked ✅ in `README.md`/`CLAUDE.md` — per project
      convention that waits for the refactor round
