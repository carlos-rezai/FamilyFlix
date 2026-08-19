# 05 — Search + Filter refactor: one vocabulary, one parser

> Feature shipped across issues #31–#38 (design log
> [`05-search-filter.md`](../design-logs/05-search-filter.md), PRD
> [`05-search-filter.md`](../PRDs/05-search-filter.md), plan
> [`05-search-filter-plan.md`](../PRDs/05-search-filter-plan.md)).

## Problem Statement

Search, filter and sort work. 956 tests pass across 64 files, the behaviour
matches the prototype, and the URL-as-state decision the design log built the
feature around holds up. This refactor is not about behaviour.

It is about the thing that decision quietly cost: **the settled query became a
shape that five different modules each know how to read, write and name for
themselves.** The design log was right that `features/library` must not import
from `features/search` — the router is the seam. What it did not resolve is
where the _shared vocabulary_ for that seam lives, so each side grew its own
copy. The build discovered this halfway through and promoted two helpers
(`isMovieSort`, `parseMinRating`) to `src/utils/` for exactly this reason; the
dev journal records why, in the words that describe every remaining item below:

> two parsers that could disagree, which shows up as a screen contradicting
> itself rather than as a crash

The promotion stopped at two helpers. Everything else stayed where it was
written.

### 1. The settled query is parsed in three places, in three shapes

| Where                                             | What it does                                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `src/features/search/parseLibraryQuery/`          | `URLSearchParams` → `HomeQuery`; documented as "the one place a stale URL is made safe"      |
| `src/features/library/useHomeRows/useHomeRows.ts` | re-derives the same shape inline — its own default, its own empty-string rules, its own memo |
| `src/features/library/HomeRows/HomeRows.tsx`      | reads `q` / `genre` / `rating` a third time, for the miss copy                               |

All three agree today. Nothing makes them agree tomorrow. The failure mode is
not a crash: it is the request narrowing on something the pill does not show, or
the miss message naming a filter the request ignored — a screen contradicting
itself.

### 2. `MovieSort` is listed five times; three listings are not compiler-checked

| Listing                           | Where                                 | Checked?                  |
| --------------------------------- | ------------------------------------- | ------------------------- |
| `ORDER_BY`                        | `server/src/library/browse/`          | ✅ `Record<MovieSort, …>` |
| `SORT_LABELS`                     | `src/features/search/LibraryFilters/` | ✅ `Record<MovieSort, …>` |
| `MOVIE_SORTS`                     | `src/utils/isMovieSort/`              | ❌ bare array             |
| `SORTS` + a private `isMovieSort` | `server/src/routes/index.ts`          | ❌ bare array             |
| `SORT_ORDER`                      | `src/features/search/LibraryFilters/` | ❌ bare array             |

Add a sixth sort order and the build breaks in two places and stays silent in
three. The two silent ones that matter are validators: the route would reject a
sort the repository can order by, and the client guard would refuse to parse it
out of a URL. `server/src/routes/index.ts` holds a verbatim copy of a util that
already exists.

### 3. `DEFAULT_SORT` is written six times

`useLibraryQuery`, `parseLibraryQuery`, `useHomeRows`, `features/library/api/`,
`server/src/routes/index.ts`, and `home.ts` as `DEFAULT_HOME_QUERY`. Six
declarations of `'recently-added'`, spanning both build targets, each one the
value that some other module's correctness depends on matching.

### 4. The serializer is the parser's inverse and shares nothing with it

`homeUrl()` in `src/features/library/api/api.ts` encodes the omit-at-default
rules a fourth time — search, sort, genre and rating each with a hand-written
"is this the default?" test mirroring one in `parseLibraryQuery`. **Nothing
tests that the pair round-trips.** A query written to the URL and read back must
be the same query, and that property is currently protected only by two
independently-written functions happening to agree.

### 5. The glossary name and the type name disagree

`docs/ubiquitous-language.md:92` defines **Library query** as the headline term
for this feature's central concept. The hook is `useLibraryQuery`, the parser is
`parseLibraryQuery` — and the type they both produce is `HomeQuery`. The parser
named "library" returns a type named "home". `CLAUDE.md` says to read the
glossary before naming anything.

### 6. Two of the three dropdowns have a tested options builder; the third does not

`genreOptions/` and `ratingOptions/` are each their own folder with their own
test, exactly as the folder convention requires. The sort dropdown's vocabulary
— `SORT_LABELS` and `SORT_ORDER` — is inline in `LibraryFilters` instead. That
asymmetry is part of why `LibraryFilters.test.tsx` is 880 lines, the largest
test file in the feature: the sort options can only be tested through the
component.

### 7. The two the dev journal already flagged

Three non-null assertions in `MainLayout.test.tsx` — the only ESLint warnings in
the entire repo — and an `act(...)` warning from `LibraryFilters.test.tsx`,
where `useGenreList`'s fetch settles outside `act`. The suite passes, but a
familiar warning is where a real one goes to hide.

### What is _not_ wrong

Worth recording, because a consistency refactor invites inventing work:

- **Barrels are correct.** Only the five category barrels exist; no per-unit
  barrel anywhere.
- **`LibraryFilters` and `LibrarySearch` having no `.styles.ts` is not a
  deviation.** It matches `ContinueRow` and all five pages: a component that
  adds no styling of its own gets no styles file.
- **`SearchIcon` joining flat `primitives/Icon/` matches the established icon
  pattern**, and `CLAUDE.md`'s single-file-modules-stay-flat exception.
- **The two `parseMinRating` implementations are deliberately different** — the
  route is a general API over the stored 0–10 scale, the client accepts only the
  three cut-offs the dropdown can produce. The dev journal explains why. Not
  duplication.

## Solution

Give the settled query **one vocabulary and one implementation of every rule
about it**, without putting a single import between `features/search` and
`features/library`. The router stays the seam; `src/types/` and `src/utils/`
become the shared vocabulary that seam was always missing.

Four moves, in dependency order:

**1. The sort vocabulary becomes one `as const` tuple, and the type is derived
from it.** `MOVIE_SORTS` moves into `src/types/browse.ts` and `MovieSort`
becomes `typeof MOVIE_SORTS[number]`. The type and the runtime list can then
never disagree, because one is made out of the other. `CLAUDE.md` already
sanctions `as const` data living flat in `types/`. `DEFAULT_MOVIE_SORT` joins it,
collapsing all six declarations.

This is the one move that changes an architectural boundary: the server gains
its first _value_ import from `@/types`, where all seven of its current imports
are `import type`. **Verified before planning** — a value import through the
`@/types` barrel resolves correctly under both `tsx` (the dev server and the
seed) and `vitest` (every server test). The client already aliases `@/` in Vite.

**2. The parser and its inverse move to `src/utils/`, beside their own
precedent.** `parseLibraryQuery` (URL → query) and a new
`toLibraryQueryParams` (query → URL), each in its own folder with its own test,
sitting next to `isMovieSort` and `parseMinRating` — which are already there for
this exact reason. Then the round-trip property gets the test it has never had.

**3. Every duplicate reader is deleted, not merely bypassed.** `useHomeRows`
calls the parser instead of re-deriving; it returns the parsed query, and
`HomeRows` reads its miss-copy conditions from that instead of parsing the URL a
third time. A shared unit with the copies still standing beside it is the
situation that produced this debt, not the fix for it.

**4. `HomeQuery` is renamed `LibraryQuery`**, so the glossary's headline term,
the hook, the parser and the type all say the same word.

Plus the symmetry fix (`sortOptions/` as its own tested unit) and the two
flagged nits.

**Nothing in this refactor moves a pixel or changes a request.** The existing
tests are the proof: `useHomeRows.test.tsx` asserts URL in → fetch URL out
without ever naming the parser, so it survives every one of these commits
unedited. An untouched test file passing after the swap _is_ the evidence the
swap was pure.

## Commits

Fifteen commits in five groups. Each leaves the tree compiling, linting and
green.

### Group A — one sort vocabulary

**A1. Derive `MovieSort` from an `as const` tuple.** In `src/types/browse.ts`,
declare `MOVIE_SORTS` as an `as const` tuple of the five orders and redefine
`MovieSort` as its indexed access type. Export the value (not just the type)
from the types barrel — the barrel is `export type`-only today, so this is the
first plain `export` in it. Then point `src/utils/isMovieSort` at the shared
tuple and delete its own hand-typed list, keeping the type-predicate guard and
its test exactly as they are. Nothing else changes; the type resolves to the
same five string literals it always did.

**A2. Delete the server's private sort listing.** `server/src/routes/index.ts`
drops its `SORTS` array and its local `isMovieSort`, and validates against the
imported `MOVIE_SORTS` instead. The guard itself stays a local one-liner — the
util it mirrors lives in `src/utils/`, which `tsconfig.server.json` does not
include, and widening that include to share a single `.includes()` call would
couple both build targets for less than it costs. The _vocabulary_ was the
duplication that mattered, and it is now shared. Route tests unedited.

**A3. One `DEFAULT_MOVIE_SORT`.** Declare it beside `MOVIE_SORTS` in
`src/types/browse.ts`, then delete all six local declarations in favour of it:
`useLibraryQuery`, `parseLibraryQuery`, `useHomeRows`, the library feature's
`api`, `server/src/routes/index.ts`, and `home.ts`'s `DEFAULT_HOME_QUERY` (which
keeps its name and its docblock, but is now built from the shared constant).

### Group B — one query, one parser, one serializer

**B1. Rename `HomeQuery` → `LibraryQuery`.** A pure rename with no logic
change, across the type declaration, the types barrel, `home.ts`, the library
repository interface, the routes, and every client consumer. `HomePayload` and
`HomeRow` keep their names deliberately — they are the _payload_ of the home
screen, where the query is the library's. `DEFAULT_HOME_QUERY` becomes
`DEFAULT_LIBRARY_QUERY`. Verified by the typechecker; no test should need
editing beyond type-only imports.

**B2. Move the parser into `src/utils/`.** `parseLibraryQuery` and its 231-line
test move from `features/search/` to `src/utils/parseLibraryQuery/` unchanged,
and it joins the utils barrel. `useLibraryQuery` updates its import. The
docblock gains the sentence explaining _why_ it lives at this rung — the same
reason `isMovieSort` and `parseMinRating` give: two features read the query from
the URL independently and must never disagree about what it says.

**B3. Extract the serializer to `src/utils/`.** Lift the body of `homeUrl()`
out of the library feature's `api` into `src/utils/toLibraryQueryParams/`,
returning a `URLSearchParams`, with its own test — the `to*` prefix matching
`toRatingPercent`, `toProgressPercent` and `toRuntimeSeconds`. `homeUrl` becomes
three lines: call it, stringify, join to the endpoint with a `?` if non-empty.
The omit-at-default rules now exist once. The library `api` test is unedited and
still asserts the URLs it always did.

**B4. Test the round-trip.** A new case in the serializer's test asserting
`parseLibraryQuery(toLibraryQueryParams(q))` deep-equals `q`, over a table
covering: the empty query, each parameter alone, all four together, a genre with
a space in it, each rating cut-off, and every sort order. This is the property
the two functions have always had to satisfy and that nothing has ever checked.
It is also what makes the next change to either one safe.

**B5. `useHomeRows` stops parsing.** Delete the ~25 lines of inline derivation
and call `parseLibraryQuery(searchParams)` inside the existing memo. Its local
`DEFAULT_SORT` and its `isMovieSort` / `parseMinRating` imports go with them.
**`useHomeRows.test.tsx` is not edited** — all 40-odd of its URL-to-request
assertions must pass untouched, including the two that pin the safety behaviour
(`?sort=by-vibes` falls back to the default; `?sort=recently-added` triggers no
reload). That is this commit's entire proof.

**B6. `HomeRows` stops parsing.** `useHomeRows` adds the parsed `query` to its
result; `HomeRows` reads `query.search`, `query.genre` and `query.minRating`
from it and drops its `useSearchParams` and `parseMinRating` imports. The third
parser is gone, and the miss copy is now driven by the identical value the
request was built from — which is the guarantee the message was always making
implicitly. `HomeRows.test.tsx` unedited.

### Group C — the third dropdown gets the shape the other two have

**C1. Extract `features/search/sortOptions/`.** A folder and a test, matching
`genreOptions/` and `ratingOptions/`. `SORT_LABELS` and `SORT_ORDER` collapse
into **one exhaustive record keyed by `MovieSort`**, carrying each order's label
and its position in the panel — so the panel's deliberately-not-declaration
order (Unwatched First above Highest Rated, per the prototype) survives, and a
new sort order can no longer join the type without also being given both. The
builder returns `FilterOption[]` like its two siblings. `LibraryFilters` shrinks
to three near-identical dropdown calls with no vocabulary of its own.
`LibraryFilters.test.tsx` is left untouched — it becomes the integration proof
above the new unit test, not a file to redistribute.

### Group D — the two flagged warnings

**D1. Clear the non-null assertions.** Replace the three in
`MainLayout.test.tsx` with assertions that fail loudly instead — the repo goes
to zero ESLint warnings, which is what makes the next one visible.

**D2. Silence the `act(...)` warning honestly.** The warning is
`useGenreList`'s fetch resolving after the test's synchronous render. Fix it in
the _test_, by awaiting the settle before asserting — not by changing the hook,
which is behaving correctly. The hook is not touched in this commit.

### Group E — the record

**E1. Glossary.** Update `docs/ubiquitous-language.md` for the `LibraryQuery`
rename and note that the sort vocabulary is now a single derived tuple.

**E2. Dev journal.** The entry: what moved, what deliberately did not, and the
verified finding that a value import crosses the `@/types` boundary safely under
both runtimes — which is the fact the next person will need before sharing
anything else across it.

**E3. A one-line guard in `CLAUDE.md`'s commit conventions.** Never write
`fixed: #n` (or any closing keyword) in a commit body for an issue the commit
does not fix. This is not hypothetical: commit `0c51aaf`'s body read "Follow-ups
filed rather than **fixed: #39**", and GitHub closed #39 on the spot. #40
survived only because it came after an "and".

## Decision Document

- **The router remains the only seam between the search and library features.**
  No import crosses between them, before or after. What changes is that the
  vocabulary both sides read the seam with now has one definition instead of
  several.
- **`src/types/` may carry `as const` data, and the server may value-import
  it.** This is the one architectural boundary this refactor moves. It is
  already sanctioned by the project's own folder convention, which describes
  `types/` as "single leaves of `as const` data / shared interfaces". The server
  target's config includes the shared types directory and nothing else of the
  frontend, so the boundary widens from "shared type vocabulary" to "shared type
  and constant vocabulary" — and no further. Verified working under both server
  runtimes before this plan was written.
- **The sort type is derived from the runtime tuple, not declared beside it.**
  The union and the list cannot drift because there is only one of them. Every
  remaining listing of the orders is either an exhaustive record the compiler
  checks, or derived from the tuple.
- **The server keeps a local one-line sort guard.** Sharing the type-predicate
  helper would mean widening the server build to include the frontend's utils
  directory. The five-item list was the duplication with teeth; a single
  `.includes()` is not worth coupling two build targets over. Accepted, and
  recorded rather than fixed.
- **Pure functions about the query live at the utils rung, not in a feature.**
  The rule this refactor settles: _if two features read the same thing out of
  the URL, the thing that reads it is a util._ This is not new — it is the rule
  the build already applied twice, mid-flight, and then stopped applying.
- **A parser and its inverse are one unit of correctness even in two folders**,
  and the round-trip property is the test that says so.
- **The query type takes the glossary's name.** The ubiquitous language is the
  declared source of truth for naming, and two of the three code units already
  agreed with it. The payload types keep theirs: a home payload really is the
  home screen's, where the query is the whole library's.
- **The dropdown option builders are one pattern with three instances.** Each
  is a pure function from domain data plus the current selection to
  `FilterOption[]`, in its own folder, with its own test, and no dropdown's
  vocabulary lives in the component that renders it.
- **No behaviour, no request and no pixel changes.** The verification rule for
  every commit is that the existing tests pass unedited. Where a test must
  change, it is because a type was renamed — never because an assertion moved.
- **Issue #39 is out of scope and gets reopened.** It changes what the browse
  home looks like, and folding a visible reorder into a refactor whose entire
  safety net is "nothing looks different" would make that net unreadable.

## Testing Decisions

**What makes a good test here.** The tests this feature already has are the
model, and they are the reason this refactor is safe: they assert _external
behaviour at a public seam_ — a URL goes in, a `fetch` URL comes out — and never
name the internal function that does the translating. `useHomeRows.test.tsx`
asserts "asks with the search the URL was opened on" and "falls back to the
default order for a sort it does not recognise". Both statements stay true
through every commit in Group B, which is precisely why the file is never
opened. A test that had asserted "calls `parseLibraryQuery`" would have to be
rewritten by this refactor and would prove nothing afterwards.

**The existing suite is the safety net, and it is not to be edited.** 956 tests
across 64 files pass today. The bar for Groups A, B and C is that they still
pass with no assertion changed — type-only import updates from the `B1` rename
excepted. Any commit that needs an assertion rewritten to go green has changed
behaviour and should be reconsidered rather than accommodated.

**Modules that get new tests:**

| Unit                    | Why it is new                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| `toLibraryQueryParams`  | The serializer has never been tested directly, only through the library feature's request URLs |
| The round-trip property | Never tested at all; the pair's correctness has rested on two functions independently agreeing |
| `sortOptions`           | The sort vocabulary has only ever been testable through an 880-line component test             |

**Modules whose tests move unchanged:** `parseLibraryQuery`'s 231-line test
travels with it to the utils rung, untouched.

**Prior art to follow.** `src/utils/parseMinRating` and `src/utils/isMovieSort`
are the closest models for the two relocated/new utils — pure, table-driven,
covering every wrong-input shape a hand-edited URL can present.
`genreOptions.test.ts` and `ratingOptions.test.ts` are the model for
`sortOptions` — build the options, assert the labels, the order, which one
reports selected, and what selecting each one reports back. The round-trip test
has no prior art in this repo; it is a table of queries asserted to survive a
write and a read.

**Coverage of the area is not a concern.** Every module this refactor touches
is already tested at its public surface, which is the condition that makes a
refactor of this size safe to attempt in the first place.

## Out of Scope

- **Issue #39 — genre row ordering.** Reopened, not fixed. It moves the browse
  home visibly; this refactor's verification rule is that nothing does.
- **Issue #40 — promoting `Menu` to the full ARIA menu pattern.** Arrow-key
  navigation is a feature, not a cleanup, and it would rewrite the dismissal
  assertions that are this area's safety net.
- **`useHomeRows`' favorite-toggle responsibility.** The hook does two things —
  load the rows, and own the optimistic favorite write. That is pre-existing
  from `02-browse-grid`, unrelated to the query, and splitting it is its own
  decision.
- **`getHome`'s one-query-per-genre fan-out.** Named in the design log's
  trade-offs and accepted there. Still sub-millisecond on local SQLite.
- **`/api/movies` gaining `q` and `rating`.** No caller until the GenrePage grid
  exists.
- **`Menu`'s hard-coded below-right panel placement**, and `FilterDropdown`'s
  `top: 54px` component-selector override. Flagged in the movie-detail journal
  as something the _next_ consumer should resolve; `FilterDropdown` did not need
  left alignment, so the prop still has no caller.
- **The two `parseMinRating` implementations.** Deliberately different, and
  documented as such.
- **Anything in the tsconfig scaffolding**, the ESLint plugin set, or the Nx
  configuration. Separate concerns with their own open questions.

## Further Notes

**On the sequencing.** Group A must land before Group B: the rename in `B1` and
the parser move in `B2` both touch modules that Group A also edits, and doing
the vocabulary first means the parser arrives at its new rung already importing
the shared constants rather than carrying copies that a later commit removes.

**On what this refactor is really fixing.** Every item here was knowable at
build time, and several were _known_ — the dev journal names the promotion of
`isMovieSort` and `parseMinRating` as "two shared utils that were not on the
plan", which is the same discovery, made once, applied twice, and then not
carried to its conclusion. The pattern worth keeping is the one that discovery
implies: **a rule about the settled query belongs wherever both features can
reach it, and there is exactly one place like that.**

**On the accidental close.** #39 spent this entire session closed as COMPLETED
with nothing shipped against it, because a commit body used the words "filed
rather than fixed: #39". It is worth knowing that GitHub's closing-keyword
parser accepts a colon, and that a follow-up listed in a commit body is exactly
the shape of sentence that trips it.
