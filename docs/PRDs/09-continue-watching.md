## Problem Statement

The Continue Watching row already ships. `03-card-carousel` built it end to end —
the `ContinueCard` tile, the `ContinueRow` section, the `continueView` mapper,
`CardCarousel variant="continue"`, and `HomePayload.continueWatching` — and the
translation is 1:1 against `docs/handoff/page.LibraryPage.dc.html`. Nothing on
that screen is missing.

What is wrong is the order the shelf comes back in. The row is ordered
`recently-added` — by when a movie was **added to the library** — because that
was the only order the repository had. So the family's resume queue answers a
different question from the one the shelf asks. The film they stopped half way
through last night sits wherever its import date put it, and behind the row's
15-item cap it can fall off the shelf entirely while films they have never
touched stay on it.

03's Q11 recorded this and deferred it: the correct order is
most-recently-watched, which needs an `updated_at`-backed sort `MovieSort` does
not have, and it declined to add a sort with no writer behind it. The player has
still not shipped — `PlayerPage` is a stub and `setResumePosition` has no HTTP
route and no caller — so today the shelf is filled only by the dev seed. But the
defect is in the shelf's own contract, not in playback, and it is fixable now.

## Solution

Record **when a movie was last watched**, and order the Continue Watching row by
it.

A new nullable `last_watched_at` column is stamped by exactly the two mutators
that mean "we watched this": `setResumePosition` and `markWatched`. The
repository gains a `last-watched` order over it, and `getHome` pins that order
for the `continueWatching` section only. The row then answers its own question —
what you were watching last, most recent first — and the 15-cap keeps the right
fifteen, because the order is applied in SQL before the `LIMIT`.

Nothing user-facing moves. No screen renders the timestamp, no frontend shipping
file changes, and no pixel shifts. When the player lands it calls
`setResumePosition` and the row orders itself with no further work.

## User Stories

1. As a **parent**, I want the Continue Watching row to start with the film I
   was watching most recently, so that resuming last night's film is the first
   thing on the screen rather than something I have to hunt for.
2. As a **parent**, I want a film I started weeks ago to sit behind one I
   started last night, so that the shelf reads as a queue and not as a pile.
3. As a **parent**, I want the 15 tiles on the shelf to be the 15 films I most
   recently watched, so that a film I am part way through never silently falls
   off the end because of when it was imported.
4. As a **parent**, I want marking a film watched to still remove it from the
   shelf, so that finishing something clears it out of my way.
5. As a **parent**, I want un-marking a film as watched not to move anything on
   the shelf, so that correcting a mis-tap does not reshuffle my queue.
6. As a **parent**, I want favoriting or re-rating a film not to move it up my
   resume queue, so that tidying up my library does not scramble what I was
   watching.
7. As a **parent**, I want the header's filters (search, genre, minimum rating)
   still to narrow the Continue Watching row, so that filtering the screen
   filters the whole screen.
8. As a **parent**, I want the Continue Watching row to keep its own order even
   when I pick "A–Z" from Sort, so that alphabetising the library does not bury
   last night's film behind the alphabet.
9. As a **parent**, I want the Favorites row and the genre rows to keep obeying
   Sort, so that the control I just used still does something.
10. As a **parent**, I want a library where nothing has been watched yet to look
    exactly as it does today, so that the change is invisible until it has
    something to say.
11. As a **parent**, I want the Continue Watching row to stay hidden when there
    is nothing in progress, so that an empty shelf is never drawn.
12. As a **maintainer**, I want the timestamp recorded only by watching, so that
    the column means one thing and can be trusted as an order.
13. As a **maintainer**, I want existing dev databases to migrate cleanly rather
    than needing to be deleted and re-seeded, so that upgrading is not a
    data-loss event.
14. As a **maintainer**, I want existing rows to migrate to "never watched"
    rather than being backfilled with a guess, so that the app never presents an
    invented watch history as fact.
15. As a **maintainer**, I want films with no recorded watch time to sort last
    and then in exactly today's order, so that an unstamped library is
    byte-for-byte the shelf it is now.
16. As a **maintainer**, I want the timestamp on the movie record I read back,
    so that a value the system stores is a value the system can show me.
17. As a **maintainer**, I want to be able to supply the timestamp when adding a
    movie, so that bulk import can carry watch history in from the spreadsheet
    rather than flattening it.
18. As a **maintainer**, I want the general metadata edit path to be unable to
    write the timestamp, so that an ordinary edit form can never reorder the
    resume queue by accident.
19. As a **maintainer**, I want the new order to be unreachable from a URL, so
    that a hand-edited address cannot ask for an order no control can undo.
20. As a **maintainer**, I want the Sort dropdown to keep the prototype's five
    options, so that the menu I ship is the menu that was designed.
21. As a **developer**, I want the dev seed's in-progress fixtures to carry
    staggered watch stamps, so that I can verify the row's order by looking at
    the running app instead of only by reading a test.
22. As a **developer**, I want running the seed twice to leave the same library,
    so that re-seeding stays the safe, repeatable operation it is today.
23. As a **developer**, I want the column indexed for the rows that have it, so
    that ordering the shelf stays cheap as the library grows.
24. As a **developer**, I want no HTTP route, no `api/` module and no dropdown
    option added for this, so that the change ships without dead code waiting
    for a caller that does not exist.
25. As a **developer**, I want the ordering decided in SQL rather than by
    re-sorting the returned array, so that the cap and the order cannot disagree.
26. As a **developer**, I want the migration runner exercised by a real second
    migration, so that the mechanism is known to work before a migration that
    matters arrives.
27. As a **future developer of the player**, I want `setResumePosition` to be the
    only call I need to make, so that playback reporting orders the shelf with no
    extra wiring.

## Implementation Decisions

### Schema — migration #2

- A second `Migration` joins the ordered list run by the `PRAGMA user_version`
  runner. `V1_SCHEMA` is **not** edited: every existing dev database would
  silently lack the column.
- `ALTER TABLE movies ADD COLUMN last_watched_at TEXT` — nullable, no default.
- A **partial index** on `last_watched_at` restricted to non-null rows, the same
  shape the existing favorite index already uses.
- **No backfill.** Every existing row migrates to `NULL`, meaning "never watched,
  as far as we recorded". Backfilling from `updated_at` would invent a watch time
  and scramble the queue with fiction on first launch.

### The column is `last_watched_at`, not `updated_at`

`updateMovie` bumps `updated_at` on **any** edit, so reusing it would let
favoriting or re-rating a film shove it to the front of the resume queue.
Ordering by "when did anything about this record change" is not ordering by "when
did we last watch it".

### Types

- `Movie` gains `lastWatchedAt: string | null` — assembled beside
  `createdAt`/`updatedAt`, which are the direct precedent for a field on the
  record that no screen renders. Writable-but-unreadable would be a smell.
- `NewMovie` gains an optional `lastWatchedAt`. It is what lets the dev seed
  stagger its stamps, and it outlives the seed: bulk import will carry watch
  history in. `watched` and `resumePositionSeconds` are already on `NewMovie` for
  the same reason.
- `MoviePatch` does **not** gain it. It is maintained by the dedicated watch
  mutators, exactly as `updated_at` is.
- `MOVIE_SORTS` is **unchanged** — it stays the five orders the wire and the Sort
  dropdown share, per the rule that a sort a URL can name must be one a control
  can show.
- A new `ListSort = MovieSort | 'last-watched'` types the repository instead —
  one member wider than the wire's vocabulary. `MovieQuery.sort` widens to
  `ListSort`; `LibraryQuery.sort` and `GenreQuery.sort` stay `MovieSort`, because
  that is what a URL carries. The route keeps validating against `MOVIE_SORTS`,
  so `last-watched` can never arrive from a hand-edited URL.

### Writers

- `setResumePosition` and `markWatched` both stamp the column. The column records
  when the movie was last watched, and finishing it is watching it.
- `markUnwatched` does **not** stamp it. Un-marking is not watching, and it leaves
  the resume position at 0, so the movie cannot re-enter the row anyway.
- `updateMovie` does not touch it — same reason `MoviePatch` omits it.
- The timestamp is `new Date().toISOString()` generated in the mutators, matching
  the existing write path. SQLite's `datetime('now')` yields
  `YYYY-MM-DD HH:MM:SS`, which violates the ISO-strings code rule.
- `addMovie` writes `NewMovie.lastWatchedAt` when supplied, `NULL` otherwise.

### Ordering

- The repository's `ORDER BY` record gains a `last-watched` entry: nulls-last via
  a leading `IS NULL` key (the idiom `year` and `highest-rated` already use), then
  the stamp descending, then **`recently-added`'s exact body** as the tiebreak. An
  unstamped library therefore orders precisely as it does today.
- The order is applied in **SQL**, not by re-sorting the returned array. The
  15-cap is a `LIMIT` applied after the `ORDER BY`; sorting afterwards would take
  the 15 most recently _added_ and then order those — the wrong fifteen, silently.

### The home aggregate

`listSection` — the helper already shared by the two flat sections — takes the
sort beside the flag, both being "what makes this section that section".
`getHome` passes `'last-watched'` for `continueWatching` and the caller's own
sort for `favorites`. `getHome` already overrides part of the caller's query per
section (`inProgressOnly`, `favoritesOnly`, `genre`, `limit`); the sort is one
more addition of the same kind.

**The continue section pins its order and ignores the header's Sort.** Its
filters still narrow it exactly as `05-search-filter` decided. A filter answers
_which_ movies are on the shelf; the resume queue's order is part of what the
shelf **means**.

**Accepted asymmetry:** the Favorites shelf keeps obeying Sort. Nothing about a
shelf of favorites implies an intrinsic order; a resume queue has one.

### Dev seed

The seed's in-progress fixtures get explicit, staggered `lastWatchedAt` stamps.
Without them every stamp is `NULL`, the row falls to the `created_at` tiebreak,
and the change is invisible in the running app until the player ships. The
reserved-video-path idempotency guarantee is untouched.

### Frontend

**No shipping frontend file changes.** `ContinueCard`, `continueView`,
`ContinueRow`, `HomeRows` and `useHomeRows` are untouched; the row simply arrives
in a different order. Zero pixels move.

**Test fixtures do change.** `Movie` is built as a full object literal by a local
`makeMovie` factory in 16 frontend test files; each gains `lastWatchedAt: null`.
This is mechanical and deliberate — keeping the field honestly required on the
assembled read model is worth 16 one-line edits, and an optional key that the
reader always populates would be a lie the type tells. Collapsing those 16
duplicated factories into one shared builder is worth doing, but it is a
refactor, not this feature — file it separately.

### Not built

- `POST /api/movies/:id/resume` and a shared `saveResume` wire call — a route and
  an `api/` module with zero callers until the player lands, which is the
  dead-code shape 03 rejected in the first place.
- A `last-watched` option in the Sort dropdown — the prototype's menu has five;
  a sixth is a prototype amendment.
- A "remove from Continue Watching" control — there is none in the prototype. The
  existing exit is the detail page's watched tick, which zeroes the resume
  position.

### Documentation

The home aggregate's contract comment (every section is built from the one query
— now true of its _filters_, not of the continue section's order), the
`MOVIE_SORTS` doc comment, the storage interface's `getHome` /
`setResumePosition` / `markWatched` docs, and 03's Q11 marked answered by 09. The
glossary is already updated (**Last watched at**, **List sort**, and the amended
**Continue Watching row** and **Sort order**).

## Testing Decisions

**What makes a good test here.** These tests exercise external behaviour through
the repository's public `LibraryStorage` interface against a real, fully migrated
`:memory:` SQLite database — never a mock, and never a private function. The
mutators return `void`, so every assertion reads the persisted state back through
`getMovie` / `listMovies` / `getHome`. Prior art is the suite convention
established in 01/02 and followed by every slice since: a `freshStorage()`
factory over `createSqliteStorage(':memory:')`, per-test resource tracking closed
in `afterEach`, and fixtures written through `addMovie`. Fake timers are already
used in this suite where a test needs to control a timestamp, and are the tool
for asserting the stamps.

**Modules under test:**

- **The watch mutators** — `setResumePosition` stamps; `markWatched` stamps;
  `markUnwatched` does not (and leaves an existing stamp alone). This is the
  behavioural heart of the change and the place a regression would be silent.
- **The read path** — `lastWatchedAt` round-trips: `null` for a movie never
  watched, the supplied value when `addMovie` is given one, the stamped value
  after a mutator.
- **The browse order** — `last-watched` returns most-recently-stamped first,
  sorts unstamped rows last, and falls back to `recently-added`'s exact
  `created_at`/`id` tiebreak among them. Reached directly through `listMovies`,
  since no route can ask for it.
- **The home aggregate** — the continue section comes back last-watched-first
  while the caller's sort is something else (`a-z`); the favorites section and
  the genre rows still obey that caller's sort; every filter still narrows the
  continue section; the section is still `[]` and the row still hidden when
  nothing is in progress; the 15-cap still selects by the pinned order.
- **The dev seed** — the in-progress fixtures carry stamps, and they are
  staggered rather than identical.

**Not separately tested:** the migration mechanism itself (the existing db test
covers the runner, and migration #2 is exercised implicitly by every test above
since `freshStorage()` runs it), and the frontend, which has no behaviour change
— its 16 fixture edits are type-level only and are covered by the existing suite
continuing to pass.

## Out of Scope

- **Resume writes.** `POST /api/movies/:id/resume`, a `saveResume` wire call, and
  the player that would call them. That is Watch tracking's, as 03 said.
- **The built-in player.** `PlayerPage` stays a stub.
- **A `last-watched` Sort dropdown option.** Prototype amendment.
- **"Remove from Continue Watching".** Not in the prototype.
- **Real artwork on the continue tile.** Still open from 03 Q6, still a prototype
  amendment.
- **Rendering the timestamp anywhere.** No screen shows "last watched"; the
  column exists to order a shelf.
- **Backfilling watch history for existing rows.**
- **Extracting a shared `makeMovie` test builder.** Worth filing as a refactor;
  not this feature.

## Further Notes

- This closes out 03's Q11, the last open item from the card-carousel round.
- Until the player ships, the whole change is observable only through the dev
  seed and the tests — which is exactly why the seed change is in scope rather
  than deferred.
- A second sort vocabulary now exists: `MovieSort` (the wire and the dropdown)
  versus `ListSort` (the repository). That is one more distinction to hold, and
  the `ORDER BY` record must stay exhaustive over the wider one — TypeScript
  enforces that, since the record is typed over `ListSort`.
- The asymmetry between the two `listSection` calls — one pinning its sort, one
  obeying the caller's — is deliberate and will read as an inconsistency to
  anyone comparing them without the design log. The code comment should say why.
- This is the first migration since #1, so the `user_version` runner gets its
  first real exercise against a live dev database.
- Per the project's convention, the feature is only ✅ Done after its refactor
  round, not when the build issues close.

Design log: `docs/design-logs/09-continue-watching.md`
