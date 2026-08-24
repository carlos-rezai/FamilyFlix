# Dev Journal

Running record of what shipped, what was deliberately left alone, and what a
later session should know before touching something. Design logs are immutable
snapshots of a decision at a moment; PRDs and refactor plans describe intent
before the work. This file is the thing in between — written _after_ the work,
and the place a known-but-not-yet-fixed problem goes so that it surfaces as a
follow-up rather than as somebody's later surprise.

Newest entry first.

---

## 2026-08-24 — Genre page refactor (issue #55)

Twenty commits in eight groups, against
`docs/refactor-plans/06-genre-page-refactor.md`. The genre page shipped working
and left behind a **second browse screen that had re-derived, rather than reused,
the machinery the first one already had** — two copies of the load machine, two
of the optimistic favorite, two skeleton cards, two sets of chrome styles, and
three route handlers that disagreed about what an empty `?sort=` means. All of it
is written once now. 1352 tests pass, up from 1308.

### The suite was not green, and nothing had noticed

`vitest run` had been failing on `src/App/App.test.tsx` in full runs while passing
in isolation. Not a product bug: `GENRE_MOVIES.Action` was a module-level array
of 214 movies, and **six** of that file's twenty tests navigated into that genre
page, each rendering 214 real `PosterCard`s through jsdom and styled-components.
Under 43 parallel workers the two heaviest crossed vitest's default 5000ms
`testTimeout`, which `vite.config.mts` did not override.

A refactor whose safety net is intermittently red is not a safety net, so this
was fixed first. The fixture is a genre of eight now, and the one test that is
genuinely about the number — "opens every movie in the genre, uncapped" — grows
Action to 214 for itself. That file went from 12.5s to 4.9s. An explicit
`testTimeout` was set alongside it as margin, not as the fix.

**Worth naming as a shape rather than an incident:** a fixture grew to 214
because one test needed it, then five more reused it because it was there. That
gets worse rather than better, and the genre page was the first screen in this
codebase with a fixture big enough for it to matter.

**Where the plan was wrong.** It called for the fixture to shrink with _no
assertion changed anywhere_, reasoning that a genre's `total` comes from
`listGenres()` and was never the length of anything the fixture held. True of the
server — but `genreCountLabel` renders `shown === all` as "214 titles" and
anything else as "8 of 214 titles", so a fixture reporting a total of 214 behind
eight movies produces a count line no server could ever send. The decoupling is
visible in product code. Two tests' awaited count text changed instead, and two
more now press "View all" without asserting the number on it, which leaves 214 in
the one test it belongs to. The fixture stays a response the server could
actually produce, which is worth more than an untouched line of text.

### What shipped

**One load machine.** `useBrowseLoad` holds the `attempt` counter, the in-flight
guard, and the **skeleton latch** — the rule that a refetch keeps what is already
painted, and only a load with nothing behind it falls back to the skeleton. That
rule had been a policy stated in two hooks with nothing holding it together; its
docblock is where it lives now. `useHomeRows` and `GenreMoviesProvider` are
substitutions on top of it, and **neither test file was edited** — 52 and 34
tests respectively still pass, which is the evidence that nothing a caller can
see moved.

The hook returns `setData` as well as `data`. That was not in the plan and is
load-bearing: the optimistic favorite writes into the same state the load fills,
so without a setter the two would drift into separate copies of the movie list.
The fetchers map the payload as it lands, so `data` is the render-ready shape and
the heart edits exactly what the grid renders.

**One optimistic save.** `useOptimisticSave` holds the bargain: show the new
value at once, take the route's echo over what was assumed, put the old one back
if the save is refused. It was written verbatim four times across the codebase;
two of those are one line each now. It is typed to a boolean flag deliberately —
the revert is `!value`, and a save with more than two values (a resume position)
has to be told what to put back, which is a parameter to add when one arrives.

**One skeleton card, one retryable failure, one piece of chrome.** The poster
placeholder and the Retry block were byte-identical between the two screens; the
one real difference — the home's card is fixed to `CARD_WIDTH` because it sits in
a strip, the genre's takes its grid track — is kept where it belongs, as the
extension each screen's styles apply. `layouts/chrome.styles.ts` holds the
gradient, the 100vh flex column, the translucent blurred strip and the
`z-index: 40`; both layouts extend it and state only their own differences.
Deliberately **not** `GenreLayout` extending `MainLayout`, which would make one
screen's styles another screen's public surface right before Settings and the
player arrive wanting chrome that is neither.

**`range` went to `src/utils/`, not to the feature.** The plan put it beside the
shared skeleton. It turned out to be written **three** times, the third in
`movie-detail/LoadingDetail` — a different feature, so keeping it inside
`features/library` would have been wrong on the codebase's own rules. It is a
pure helper with a test, which is what `src/utils/` is for.

**Two folders.** `features/library/home/` and `features/library/genre/`, with
what both screens draw on left at the top: `api`, `view`, `withFavorite`,
`CardCarousel`, `LibraryGrid`, `SkeletonCard`, `RetryableFailure`,
`useBrowseLoad` and `useOptimisticSave`. Sixteen flat folders serving two screens
is nine that say which, now. No barrel was added at either — `features/` has
never had one.

### One behaviour change, deliberately

`GET /api/movies?sort=` answered **400** for an empty value, where `/home` and
`/genre/:name` both answered the default order and both had a test saying so. All
three endpoints' comments already claimed the shared rule; only two of them kept
it. It had no test asserting the 400 and no client sends an empty `?sort=`, so it
was a drift rather than a contract. One `parseSort` serves all three now, and the
correction is pinned by a new test — verified failing against the old rule before
it was kept. An unknown sort is still a 400 everywhere. `GET /api/movies` had
**no tests at all** before this; it has three now.

### Retracted from the 2026-08-22 entry

**"The production line bent to suit a test runner" was wrong.** `GenreLayout`'s
`Spacer` was written as `flex-grow` / `flex-shrink` / `flex-basis` longhand,
commented as being that way because jsdom does not expand the `flex` shorthand.
`MainLayout`'s `Spacer` has always been `flex: 1 1 auto`, and `MainLayout.test`
asserts on it with the identical `getComputedStyle(child).flexGrow === '1'`
predicate — and passes. Measured against this repo's jsdom: the shorthand reports
`flexGrow === "1"`, exactly as the longhand does. The shorthand is restored with
**no test change at all**, which is the proof. The claim is retracted rather than
reworded; the paragraph in that entry is marked accordingly.

### Left alone, on purpose

- **`useMovieDetail`** keeps its own load machine and its own two optimistic
  saves. It is the same mechanics around a genuinely different state shape — four
  statuses and a discriminated union, because a 404 and a failure earn different
  buttons. Folding it in would mean expressing `not-found` as a payload value and
  bending a union that exists precisely so the page cannot read `ready` beside an
  absent movie. Two verbatim copies justify an extraction; a third near-miss does
  not.
- **`parseGenreQuery` / `parseLibraryQuery`** stay parallel, per the design log's
  Q12. A shared parser would build a screen that silently honours a hand-edited
  `?rating=7` it has no control to display. #53 already took the shareable half.
- **`GenreMovies` stays a context.** A fixed header and a scrolling body over one
  payload cannot be served by a hook called in both subtrees without making it
  two requests. Only its innards were extracted; its value shape is unchanged.
- **The shared hooks stay at `features/library`'s rung**, not `src/hooks/`, whose
  stated rule is "only hooks used across 2+ features". The promotion trigger is
  recorded: the first consumer outside `features/library` — most likely Favorites
  — is when they move, and that is a one-commit move with no call-site churn.

### Follow-ups

- **The `api/` modules' `fetch` → `!ok` → `throw` → `json` bodies** are four
  copies across three features, and the fourth (`fetchMovie`) resolves `null` on
  a 404 rather than throwing — so they are not four copies of one thing. Noted,
  not done.
- **`GenreLayout`'s header `gap` is `18px`**, which is not on the 4px spacing
  scale (`s5` is 24px). It matches the prototype and was left exactly as it was —
  this refactor changed no design — but a hard-coded pixel gap beside tokenised
  padding is the kind of thing a later reader will assume is a mistake.

---

## 2026-08-22 — Genre page (issues #42–#51)

Closed the last dead end in browse-and-discover. `/genre/:name` had been a
registered placeholder since `03-card-carousel`, and every genre row still ended
in a "View all 214 →" that landed on an `<h1>` and a line of prose. A row caps at
`HOME_ROW_LIMIT`, so for a 214-title genre the other 199 were unreachable by any
route in the app — not by scrolling, not by search, not by any filter. Eight
build issues, #43–#50, each a `test:` commit stopping at RED and a `feat:` commit
taking it green, plus the prototype amendment. 1279 tests pass. Plan:
`docs/PRDs/06-genre-page-plan.md`.

Nothing new is stored and no schema moved. `listMovies` already took every filter
this screen needs and `listGenres` already returned the count "View all 214"
promised, so what this feature built is a second screen over primitives that were
already there — and the header/body split that a screen whose heading depends on
its body's payload forces.

### The decision everything else follows from

**The heading is a fact about what the grid below it loaded.** "12 of 214 titles"
is not something the header can know on its own, and a header that fetches
separately from its body is two requests and two chances to disagree with each
other. `GenreMovies` is the answer: a feature-local provider owning the one
fetch, the `loading` / `ready` / `error` machine, `retry` and the optimistic
`toggleFavorite`, with `useGenreMovies()` as what the heading and the grid both
read. Calling a hook in both subtrees would mean two requests; lifting the fetch
into `GenrePage` would put data logic in a page, which the layer rules forbid.

That shape — a fixed header and a scrolling body over one payload — is the thing
this feature actually contributes to the codebase. Favorites, a flat
search-results page and a collection all copy it rather than re-deriving it.

### What shipped

**One request answers the whole screen.** `GET /api/genre/:name?q=&sort=`, served
by `createGenre(browse)` sitting beside `createHome(browse)` and built the same
way — a composition over the existing `Browse` slice, so no new SQL and no new
repository primitive appeared. `total` is `listGenres()` matched by name; `movies`
is `listMovies({ ...query, genre: name })` with **no cap**, because this screen
_is_ "View all". The rejected alternative — `/movies` for the list plus `/genres`
for the number — is the fan-out `getHome` was built to avoid, and would have
forced `features/library` to import `features/search`'s `useGenreList` so that one
screen could print a number.

**`total` is the genre's unfiltered count, on purpose.** It stays the number the
row's "View all 214" already promised while a search narrows the grid underneath
it, which is what makes "12 of 214 titles" true rather than a tautology. Both the
count label and the grid are built from that one payload, so the header can never
disagree with what is under it.

**The genre travels in the path; the query travels in the URL.** Two parameters,
each omitted at its default, so a plain genre page is a clean `/genre/Drama`.
`parseGenreQuery` and `toGenreQueryParams` are exact inverses carrying the same
round-trip property test their library-query siblings carry, and they share
`isMovieSort` with them. Deliberately **not** a parametrised `parseLibraryQuery`:
one shared parser would build a screen that silently honours a hand-edited
`?rating=7` it has no control to display.

**The rating filter does not apply here at all.** A deliberate deviation from the
prototype's _behaviour_ — `FamilyFlix.dc.html:320`'s `genrePageMovies()` calls
`passRating` — but not from its _surface_, where the genre header has no rating
pill. Reproduce the surface exactly; never port a filter with no control. The
route ignores `genre` and `rating` outright rather than rejecting them, so an old
bookmark still opens.

**A second layout, not a `MainLayout` variant.** `GenreLayout` is a Back pill, a
`heading` slot, a `headerEnd` slot and a `useRestoredScroll` body that is the only
thing on the screen that overflows — so the header stays reachable all the way
down a 214-card shelf. No logo, no gear. Bending `MainLayout` to cover both would
have made it a component with two unrelated modes. `MainLayout` is untouched.

**Two extractions, each switching its existing call site in the same commit**, so
no interim second copy ever existed. `useGoBack` came out of `MoviePage` in the
phase `GenreLayout`'s Back pill became its second consumer — a history step with a
`/` fallback only when `location.key` is the session's first entry, so a
deep-linked genre page never shows a dead button, and a step rather than a link
home is what preserves the library's filters and its restored scroll.
`useSettledText` came out of `LibrarySearch` in the phase `GenreControls` became
_its_ second consumer. `LibrarySearch`'s docblock claimed the debounce "lives here
and nowhere else"; the extraction is what kept that sentence true rather than
letting it quietly become false. Both existing test files are unmodified and still
pass, which is the guard that the extractions changed nothing.

**The two empty states are told apart by the genre's unfiltered total**, not by
whether a search is present. "Nothing here — There are no movies in Action." has
no Retry; "No matches — Nothing in Action matches “lighthouse”." quotes the term
back so a typo is spottable. Keying off the total is what stops a search running
over an already-empty genre being blamed for a miss it did not cause.

**The skeleton does not come back.** Twelve cards on the very first load only; a
refetch on a settled-query change keeps the grid on screen rather than flashing
the skeleton back, the same discipline `useHomeRows` follows. The in-flight latch
covers `retry` as well as a query change, so a stale response can never overwrite
a newer one.

**The carried sort travels through the link, not through hidden state.**
`HomeRows` serializes the order through `toGenreQueryParams` — the same writer the
genre page reads back — and off the _settled_ query rather than the raw URL, so a
stale or unrecognised `?sort=` carries nothing. At the default it writes nothing
and the path stays a clean `/genre/Drama`. The search text stays behind
deliberately: the genre's box is a fresh, narrower search, relabelled
"Search in {genre}".

**`LibraryGrid` reuses the exported `CARD_WIDTH`** rather than declaring a second
magic number, so the uncapped grid and the capped carousels cannot drift apart. A
wide window gets more columns rather than wider cards.

**`withFavorite` gained a flat-list sibling**, with the existing rows variant
expressed in terms of it — one concept, two shapes, one folder.

### Two ordering corrections the plan made against the PRD

Both closed a gap where a phase would otherwise have depended on something
shipping later.

- **`useGoBack` moved from Phase 5 into Phase 3.** `GenreLayout` owns the Back
  pill, so Phase 3 was the rule's first new consumer; extracting in Phase 5 would
  have meant Phases 3–4 carrying an inline second copy of exactly the rule the
  extraction exists to prevent.
- **The prototype amendment moved from Phase 6 into Phase 4.**
  `FamilyFlix.dc.html:490` read "1 titles". CLAUDE.md says amend the prototype
  first, then build to the amended prototype, and `genreCountLabel` singularises
  in Phase 4 — so the amendment opened that phase as `0f19a23` rather than
  trailing the build it governs.

### Deliberately not changed

- **`GET /api/movies` kept its behaviour exactly.** Only its comment changed: it
  stopped claiming to serve the genre page and is now described as the generic
  browse endpoint the CSV exporter will read the library through.
- **`GenreQuery` keeps a required `sort`** because it is the URL contract type and
  a URL always carries an order, even an implicit one. The repository method takes
  a `Partial` of it instead, so a server caller can name only the part it cares
  about and an omitted sort means the default order. Two shapes for two jobs, in
  preference to one optional field pretending to serve both.
- **No client-side re-sorting of a loaded grid, and no client-side filtering of a
  payload already held.** The server owns order and narrowing, as `05` decided.
- **The two query parsers stay separate**, per the reasoning above. Note that this
  was an argument about _vocabulary_, not about mechanics — see the follow-ups.

### The production line bent to suit a test runner

> **Retracted 2026-08-24 (issue #55).** This was wrong. jsdom _does_ report
> `flexGrow === "1"` for the `flex` shorthand — `MainLayout` had always relied on
> exactly that — so the longhand was never needed and no test ever required it.
> The shorthand is restored, with no test change. The paragraph is kept as
> written, below, because the record of a wrong call is worth more than a tidy
> one.

`GenreLayout`'s spacer is `flex-grow` / `flex-shrink` / `flex-basis` longhand
rather than the `flex` shorthand `MainLayout` uses, purely because jsdom does not
expand the shorthand and the test reads `flexGrow` back off the computed style.
It is one line and it is commented where it sits, but it is a stylesheet written
around a limitation of the test environment rather than around the design, and
that is worth naming out loud rather than leaving as a curiosity for whoever next
diffs the two layouts and wonders why they disagree.

A smaller one in the same family: `App.test`'s `posterCards()` helper counted any
labelled button as a card, so the genre header's new Sort pill read as a 215th. It
is now scoped to the scrolling body, where the grid actually is; the two
assertions it feeds are unchanged.

### Follow-ups this feature surfaced

- **The URL-write mechanic is duplicated verbatim.** `useGenreQuery` and
  `useLibraryQuery` hold byte-identical copies of `setParam` — copy the current
  params, set or delete one name, write with `replace: true` — and identical
  `setSearch` and `setSort` on top of it. The design log's argument for keeping the
  two hooks apart was about _vocabulary_: a shared **parser** would let a screen
  accept filters it cannot display. That argument does not reach the **writer**,
  which knows nothing about which parameters exist. Filed as #53.
- **Router and scroll test scaffolding is copied ten and five times.** A
  `LocationProbe` component appears in ten test files (with two different
  `data-testid` values, so an assertion cannot be moved between them), and the
  thirty-line jsdom scroll-metrics stub — `scrollTop` through a `WeakMap`, a fixed
  `scrollHeight`, the `afterEach` that deletes the shadowing own-properties — in
  five, differing only in one number. This feature added four copies of the first
  and one of the second. Filed as #54.
- **The genre page's five units sit flat in `features/library/`** alongside the
  home-row units: `GenreGrid`, `GenreHeading`, `GenreMovies`, `genreCountLabel`
  and `LibraryGrid` next to `GenreRow`, `HomeRows`, `RowSection` and the rest.
  Sixteen folders in one feature, serving two screens. Whether that wants a
  sub-grouping is a judgement call for the refactor rather than a defect.

### The rows this feature did not tick

The genre page is recorded in both feature lists as **🔜 Planned**, not ✅ Done,
and issue #51 asked for it ticked. The standing rule is that a feature is Done
after step 7–8 of the workflow — `request-refactor-plan` → `refactor` — and not
when its build issues close; `813b546` reverted exactly such a tick on Search +
Filter for exactly this reason. No refactor issue exists for the genre page yet,
so the rows go in at 🔜 and the refactor is what flips them. The row did not
previously exist in either list at all, so this is an addition rather than a
deferred tick.

The Sort ✅ correction, which `813b546` also reverted and which _has_ cleared the
bar twice over (#35 built it, #41 refactored it), is deliberately not part of this
entry — it is its own docs commit, tracked as #52.

---

## 2026-08-19 — Search + Filter refactor (issue #41)

Closed the debt the search + filter build left behind. The plan's fifteen commits
landed as fourteen — D1 and D2 were both one-file test fixes on the same theme
and went together — plus a fifteenth ticking the two README rows that `a087304`
had reverted to Planned pending exactly this work. Plan:
`docs/refactor-plans/05-search-filter-refactor.md`.

Nothing here was about behaviour. The feature worked and 956 tests passed; what
it had cost was a **settled query that five modules each knew how to read, write
and name for themselves**. The URL-as-state decision was right and stands — the
router is still the only seam between `features/search` and `features/library`,
and no import crosses between them. What that decision never resolved was where
the shared _vocabulary_ for the seam lives, so each side grew its own copy.

### What shipped

**One sort vocabulary.** `MOVIE_SORTS` is now an `as const` tuple in
`src/types/browse.ts` and `MovieSort` is derived from it, so the union and the
runtime list cannot drift — one is made out of the other. The route layer's
verbatim copy is gone. `DEFAULT_MOVIE_SORT` joins it and collapses six
declarations of `'recently-added'` spanning both build targets.

**One parser, one serializer, and a tested round trip.** `parseLibraryQuery`
moved to `src/utils/`, and `homeUrl()`'s hand-written omit-at-default rules came
out beside it as `toLibraryQueryParams`. The pair are inverses and nothing had
ever checked it; thirteen settled queries now assert the property directly.
Both duplicate readers were deleted rather than bypassed — `useHomeRows` calls
the parser, and `HomeRows` reads its miss copy off the query the hook loaded
for, so the message can no longer name a filter the request ignored.

**The third dropdown got the shape the other two had.** `SORT_LABELS` and
`SORT_ORDER` collapsed into one exhaustive record in `features/search/sortOptions/`,
carrying each order's label _and_ its place in the panel. `LibraryFilters` is now
three near-identical dropdown calls with no vocabulary of its own.

**`HomeQuery` became `LibraryQuery`**, so the glossary's headline term, the hook,
the parser and the type all say the same word.

### The verified finding the next person will need

**A value import crosses the `@/types` boundary safely under both server
runtimes.** All seven of the server's imports from `@/types` were `import type`
and therefore erased, so nothing had ever proven the alias resolves at runtime
for the backend. It does: verified under `tsx` (the dev server and the seed) and
under `vitest` (every server test) before the route layer was allowed to depend
on it. `tsconfig.server.json` includes `src/types/**` and nothing else of the
frontend, so the boundary widens from "shared type vocabulary" to "shared type
and constant vocabulary" — and no further. This is the fact to check first
before sharing anything else across it.

### The rule this settles

**If two features read the same thing out of the URL, the thing that reads it is
a util.** Not new — it is the rule the build already applied twice mid-flight,
when `isMovieSort` and `parseMinRating` were promoted for exactly this reason,
and then stopped applying. Everything in Group B is that same discovery carried
to its conclusion.

A related one, worth its own sentence: **a parser and its inverse are one unit of
correctness even in two folders**, and the round-trip test is what says so.
`useHomeRows` now leans on it directly — its memo is keyed on the query's
canonical serialization, which is what keeps a scroll offset or a sort spelled at
its default from reloading the library, and reading the query back from that
string is only sound because the round trip holds.

### Deliberately not changed

- **The server keeps a local one-line sort guard.** Sharing the type predicate
  would mean widening the server build to include the frontend's `utils/`
  directory. The five-item list was the duplication with teeth; a single
  `.includes()` is not worth coupling two build targets over.
- **The two `parseMinRating` implementations stay different.** The route is a
  general API over the stored 0–10 scale; the client accepts only the three
  cut-offs the dropdown can produce. Not duplication — two different contracts.
- **`HomePayload` and `HomeRow` keep their home names.** A payload really is one
  screen's, where the query narrows the whole library.
- **`LibraryFilters.test.tsx` was not redistributed.** At 880 lines it is the
  largest test file in the feature, and the obvious move after extracting
  `sortOptions` was to move its sort cases down to the new unit. It stays: it is
  now the integration proof above the unit test, and every one of its assertions
  passing unedited is what proved the extraction pure.
- **No behaviour, no request and no pixel changed.** The verification rule for
  every commit was that the existing tests pass unedited — `useHomeRows.test.tsx`
  and `HomeRows.test.tsx` in particular were never opened, and their forty-odd
  URL-to-request assertions are the entire proof of Group B.

### Two things found along the way

- **`npm run typecheck` was red on `main`.** A `TS2488` in
  `MainLayout.test.tsx`: spreading an `HTMLCollection` under an ES2015 target
  without `downlevelIteration`. It sat on the same helper as the repo's only
  three ESLint warnings, so it was fixed with them rather than left as a
  half-clean file. **Nothing in the pre-commit hook or CI runs `typecheck`**,
  which is why a compile error could live on the default branch — that gap is
  the real finding, and it is not this refactor's to close.
- **`App.test.tsx` emits three `act(...)` warnings**, from a `HomeRows` update
  landing after a synchronous render. Pre-existing on `main` and confirmed as
  such against `08013fd`; distinct from the `LibraryFilters` warning the plan
  flagged, which is fixed. Left alone deliberately: it is outside the plan, and
  the repo is otherwise at zero warnings now, which is what makes it visible.

### The guard that could not be committed

The plan's last item was a line in `.claude/CLAUDE.md`'s commit conventions:
never write a closing keyword — `close`, `fix`, `resolve` and their inflections
— before a `#n` for an issue the commit does not close. GitHub's parser accepts
a colon between the two and does not read the sentence around them, so a commit
body saying follow-ups were filed _rather than_ fixed closed one of them on the
spot, with nothing shipped against it. The other survived only because it came
after an "and". The rule is now in that file, and the fix when listing follow-ups
is to write the bare number: "filed as 39 and 40".

**It is not in version control.** `.claude/` is gitignored, so the project's own
instructions live on one disk. That was already flagged in the movie-detail entry
below as a decision worth making deliberately; this is the second time it has
cost something — a rule written to stop a recurrence that no clone of this repo
will ever see. Worth its own issue.

### The pattern worth keeping

The build discovered the right rule halfway through, applied it twice, wrote down
why in this journal — and then left the other five copies standing. A shared unit
with its duplicates still beside it is the situation that produces this debt, not
the fix for it. The deletion is the deliverable; the extraction is the easy half.

---

## 2026-08-19 — Search + Filter + Sort (issues #30–#38)

The browse home's header controls, filling the gap `MainLayout` has carried
since `02-browse-grid`: a search box, a Genre pill, a rating pill and a Sort
pill. Sixteen commits across seven build issues (#31–#37), red tests then green
for each. PRD: `docs/PRDs/05-search-filter.md`; plan:
`docs/PRDs/05-search-filter-plan.md`.

Almost nothing new was stored. `MovieQuery` has carried `search`, `genre`,
`minRating` and `sort` since Library Core, and `buildListQuery` already
assembled every one of them into parameterized SQL. What this feature built was
the path from a header control down to that query — plus the two arms of
`search` the prototype implies and the repository did not have. No migration:
the only new SQL in the whole feature is `countMovies()`, a `SELECT COUNT(*)`.

### The decision everything else follows from

**The query is the URL.** `/?q=&genre=&rating=&sort=` is the entire state of
this feature — no component state above the controls, no context provider. The
controls only ever _write_ it; `useHomeRows`, the pills' own selected values and
`HomeRows`' miss copy only ever _read_ it. That is what lets `features/search/`
and `features/library/` both act on the query without a single import crossing
between them: the router is the seam, and it already existed.

Three consequences worth knowing before touching any of it:

- **Every parameter is omitted at its default**, so an unfiltered home is a
  clean `/`, and "All Genres" / "All ratings" _remove_ their parameter rather
  than writing an empty one.
- **Writes are `replace: true`**, so typing does not stack a history entry per
  keystroke and one Back escapes a search of any length. The price is that each
  settled query mints a fresh history key, which resets scroll to the top —
  right for a reshuffled list, but a consequence rather than a goal. Remember it
  if `useRestoredScroll` is ever revisited.
- **A hostile or stale URL is made safe in exactly one place.**
  `parseLibraryQuery` turns `URLSearchParams` into a `HomeQuery`; an unknown
  sort falls back to the default and an unrecognised rating is dropped, so a
  bookmark from an older build opens rather than crashes.

### What shipped

**Search widened from a title substring to title OR synopsis OR genre name.**
The genre arm reuses the genre filter's `m.id IN (SELECT …)` subquery shape
rather than joining, so a movie matching on several arms — or on several
genres — still comes back exactly once, and `assembleMany` keeps re-running the
`WHERE` as a subquery unchanged. `searchMovies` widened with it, since it is
documented as a `listMovies` call with the `search` filter and should keep
meaning that.

**`getHome` takes a `HomeQuery` and threads it into both `listMovies` calls**,
so the genre rows and the Continue Watching row narrow off one query and the top
of the screen can never disagree with the rest of it. Rows that matched nothing
are dropped — moved forward from the genre slice into Phase 1, because a search
that leaves every genre row standing renders a screenful of empty rows. A
narrowed row's `count` still comes from `listGenres()`, so "View all 24" keeps
saying 24 while the row shows the three that matched.

**Filtering happens on the server, never on the payload already held.**
Filtering 15 of a genre's 40 movies would silently miss the other 25, and every
user-facing symptom of that bug looks exactly like "we don't own that film".

**`GET /api/genres` → `{ total, genres }`, its own endpoint.** Not a field on
`HomePayload`, because it has a different lifetime: it is fetched once per mount
where `/home` refetches per settled query, and the counts must not reshuffle
under a finger already reaching for them. `total` needs `countMovies()` rather
than a sum of genre counts, which would double-count anything tagged twice.
`useGenreList` resolves to an **empty list on failure** — the Genre pill renders
with "All Genres" alone and the other two are untouched, because the prototype
designs no error surface here.

**`FilterDropdown` is built on `Menu`.** The dismissal contract it needs —
Escape, outside pointerdown, select-to-close, focus back to the trigger —
already existed, and taking it buys the prototype's single-open behaviour for
free with no coordinating state anywhere. The deliberate price: the prototype's
`open` / `onToggle` props are **dropped**, because `Menu` owns open state.
`Menu` gained only `MenuItem`'s `selected` and `trailing`, and a scrollable
panel; its existing dismissal tests were not edited and still pass.

**`label` on `FilterDropdown` is always required and always forms the accessible
name**, rather than an `aria-label` a caller can forget. That is what lets the
rating pill wear a ★ with no visible caption and still announce "Minimum rating:
3+ stars".

**The debounce lives in `LibrarySearch` and nowhere else** — local input state
for instant typing, a 250ms debounced URL write. It is the only holder of
un-settled input in the app; everything downstream treats the URL as already
settled and knows nothing about debouncing. That is the deliberate price of
keeping `useHomeRows` free of any import from `features/search`.

**The skeleton does not come back.** Rows already on screen stay put through a
refetch — first load only, because flashing the whole screen every 250ms of
typing would be unreadable. A stale in-flight response cannot overwrite a newer
one.

**`HomeRows` distinguishes three misses, not two.** A search miss quotes the
text back; a filter-only miss talks about genre and rating; "Your library is
empty" still means there are no movies at all. The prototype conflates the first
two into one string that renders as empty quotes when nobody typed anything.

**427 new tests.** The suite went from 519 to 946 written cases — 956 executed,
across 64 files.

### Two shared utils that were not on the plan

`isMovieSort` and `parseMinRating` (with `RATING_CUTOFFS`) landed in
`src/utils/` rather than inside `features/search/`, because the sort and the
minimum arrive from the URL and **two features read them from there
independently**: the search feature parses the settled query and draws the pill,
the library feature builds the home request. A feature-local helper would have
meant one of them importing the other, or — worse — two parsers that could
disagree, which shows up as a screen contradicting itself rather than as a
crash.

`parseMinRating` is also **stricter on the client than the route is**, which was
a build-time discovery rather than a planned one. `/api/home` stays a general
API over the whole stored 0–10 scale and `400`s only what is off it; the client
accepts **only the three cut-offs the dropdown can produce** (8 / 6 / 4). A
hand-edited `?rating=7` would otherwise narrow the library behind a pill still
reading "All ratings". `0` is "All ratings" too, not a floor of nought — a
literal minimum of zero would exclude every unrated movie, the opposite of what
that row promises.

### Deliberately not changed

- **`getHome` still runs one query per genre**, so a library with many genres
  pays a statement each. Sub-millisecond against a local SQLite file, and the
  seam to batch it later is one function.
- **`/api/movies` did not gain `q` or `rating`.** Nothing calls it with them
  until the GenrePage grid exists.
- **The GenrePage header, the Favorites row and persisted filters** are all
  absent from the prototype. Each would have been inventing design at build
  time.
- **Nothing was made "smart".** Substring `LIKE` over three columns — no fuzzy
  matching, no stemming, no ranking. FamilyFlix has no AI, and this is not the
  seam to hide a scoring function behind.
- **`docs/handoff/` is now ignored by ESLint.** Its vendored `support.js` was
  the only thing in the repo `eslint .` had ever failed on, and it is a
  prototype we read rather than a source we own — correcting it would edit the
  visual source of truth. Recorded here because it is a config change made while
  closing out a feature, not part of the feature.

### Follow-ups this feature surfaced

- **Home-row ordering is knowingly inconsistent with the Genre dropdown.** The
  **Browse home** orders its rows alphabetically (`listGenres()` is
  `ORDER BY g.name`); the Genre dropdown orders its options by count descending,
  because that is what the prototype does (`FamilyFlix.dc.html:409`). The
  prototype orders the rows that way too (`:328`), so the rows are the surface
  that is wrong — a pre-existing `02-browse-grid` divergence, not this feature's
  to change silently under a filter. Filed as #39.
- **`Menu` promises more ARIA than it implements.** The trigger says
  `aria-haspopup="menu"`, but the panel carries no `role="menu"` and the items
  are plain buttons with `aria-current` — chosen deliberately, because
  `role="menu"` and `menuitemradio` promise the arrow-key navigation of the full
  ARIA menu pattern, which does not exist here. `aria-current` is valid and
  meaningful without promising it. Promoting the pattern is its own piece of
  work. Filed as #40.
- **`MainLayout.test.tsx` has three non-null assertions** left by the
  header-slot work — ESLint warnings, not errors. Small, but they are the only
  lint noise in `src/` and worth clearing whenever that file is next opened.
- **`LibraryFilters`' tests log an `act(...)` warning.** The suite passes; a
  state update from the genre-list fetch settles outside `act`. Worth tightening
  before the next hook in that feature is written, so a real warning is not lost
  in a familiar one.

---

## 2026-08-13 — Movie Detail refactor (issue #29)

Closed the debt left behind by the shipped movie detail page. Twenty-five
commits, in eight independent groups. Plan:
`docs/refactor-plans/04-movie-detail-refactor.md`.

The page worked and was well tested; it had simply been built as one screen
rather than as a set of parts. `MovieDetail.tsx` held four components plus a
helper in 415 lines, beside a styles file exporting 35 styled components, and
pieces that were obviously reusable had been written where nothing else could
reach them. It now holds one component in 212 lines, beside 14 styled
components, and everything that left it went somewhere another screen can use.

### What shipped

**Six shared units, each with every existing copy migrated onto it.** The
extraction is the easy half; the deliverable is the deletion. A shared unit with
one consumer is the situation that produced this debt, not the fix for it.

- **`prim.IconButton`** — the round icon-only button, now under all seven
  hand-styled ones: the header gear, both carousel arrows, the card's favorite
  heart, the ⋯ overflow trigger, and the detail page's two circles.
- **`mol.Menu`** — the popup, and the whole contract for getting rid of it:
  Escape, an outside press, an activated item, focus back to the trigger every
  time, and the ARIA wiring.
- **`mol.LoadMessage`** — the centred title/body/action block behind all four
  **Load state** screens.
- **`prim.Skeleton`** — the pulsing placeholder surface, previously two copies
  of the same keyframe and base.
- **`prim.Artwork`** — artwork or the **Gradient fallback**, previously three
  hand-written copies of one `linear-gradient`.
- **`prim.Button` gained a router-link form**, so the one bordered control that
  must be an anchor stopped being a fourth copy of the same styling.

**`IconButton` owns behaviour and geometry; chrome comes from
`styled(IconButton)`.** A five-member variant enum was rejected: three of those
five would have existed only because two hand-written CSS blocks picked
different blur radii, and an enum would have frozen that accident into the API.
The spec'd `ghost` and `outline` ship as defaults because the handoff names
those two deliberately.

**`IconButton`'s accessible name is a required `label`, separate from the
optional `title`.** COMPONENT-SPEC's table has one `title` doing both; following
it would have given four call sites a hover tooltip they do not have today and
cost the two toggles their `aria-pressed`. A required `label` also makes an
unnamed icon-only button unrepresentable, which the seven buttons it replaces
could not guarantee.

**The edit menu's hardest behaviour is no longer hoarded.** Escape-close,
outside-pointerdown close, close-on-activation and focus return lived inside
`MovieDetail.tsx` where `FilterDropdown` and the `LibraryHeader` gear menu could
not reach them. They are `mol.Menu`'s now, and the eight existing edit-menu
assertions passed untouched through the move — which is the proof the contract
survived it.

**`MovieDetail.tsx` decomposed last, not first.** Groups A–E removed roughly a
third of the file by moving pieces into shared units, so the split was over what
genuinely remained: `EditMenu`, `MetaLine`, `CreditsRow` and `LoadingDetail`
each got their own folder, test and styles, and the two failure wrappers
disappeared into `LoadMessage` call sites.

### The one moved pixel

`HomeRows.RetryButton` had `border-radius: 10px`. It is now `radius.md` (12px),
which is what COMPONENT-SPEC specifies for `size="md"` and what every other
button in the app already used. The 10px was a hand-typed literal that predated
`prim.Button`. Adding a radius escape hatch to `prim.Button` to preserve it
would have been encoding a typo as API. **Everything else in this refactor moves
nothing.** If something looks different, that is a bug in the refactor.

### Deliberately not changed

- **`MoviePage.BackPill` was not migrated.** It is a labelled pill, not an
  icon-only button, so `IconButton` is the wrong home for it. It keeps its own
  copy of the translucent-over-artwork chrome, now shared with nothing —
  recorded as accepted rather than fixed.
- **No shared "chrome over artwork" treatment.** `BackPill`, `MoreButton`, the
  carousel arrows and `FavButton` differ in alpha, blur radius, border and
  hover. Deciding what they _should_ be is a design question for a grill, not
  something to settle inside a refactor.
- **`IconButton` has no `active` face**, though the prototype draws one. Every
  toggle in the app paints its own on-state, so the face has no caller;
  `pressed` carries the part a screen reader needs.
- **`Menu`'s items are plain buttons, not `role="menuitem"`.** Adding the role
  would have changed the accessibility tree and rewritten the assertions that
  were this refactor's safety net. It is a real question, and it belongs to
  whoever builds the second and third menus.
- **The existing 459 tests were not edited.** They passed before and after every
  one of the twenty-five commits. An untouched test file passing after an
  extraction _is_ the proof the extraction was pure. The suite grew to 520.

### Follow-ups this refactor surfaced

- **The prototype designs no failure or empty states at all.** Searching
  `docs/handoff/` for a retry, an error or an empty state returns nothing —
  which is exactly why the four that exist drifted apart unnoticed, and why this
  refactor had to invent the name `LoadMessage` with no handoff file to check it
  against. Two of these screens will be seen by a parent (an empty library on
  first run, and a failure) and neither has ever been designed. Worth raising at
  the next grill.
- **A `styled(IconButton)` that replaces the hover must replace all of it.**
  Both built-in faces move `background` and `color` on hover, so a call site
  that sets only one inherits the other from underneath, and a bare `&:hover` is
  one selector shorter than the guarded `&:hover:enabled` it is trying to beat.
  Both rules are written at the top of `IconButton.styles.ts`; this is the kind
  of thing that is obvious once and invisible forever after.
- **`Menu`'s panel is hard-coded to hang below-right of the trigger.**
  `FilterDropdown` is the next consumer and may want left alignment. The prop
  was not added speculatively — it is noted here so the next person adds it
  rather than working around it.

---

## 2026-08-09 — Card Carousel refactor (issue #21)

Closed the debt left behind by the shipped card carousel and Continue Watching
row. Seventeen commits, in six independent groups. Plan:
`docs/refactor-plans/03-card-carousel-refactor.md`.

### What shipped

**A committed dev seed (`server/src/db/seed/`, `npm run db:seed`).** The screen
could not be looked at: the database held twelve genres and zero movies, Add
Movie and bulk import are both unbuilt, and nothing writes a resume position
until the player ships, so the browse home rendered "Your library is empty" and
every visual claim about the feature was unverifiable. The seed writes twenty
fixtures through the ordinary `LibraryStorage` interface, covering every state
the home screen can show: an Action row of twelve (so that row overflows and the
carousel arrows actually appear), six in-progress with a known runtime, one with
an unknown runtime, one in-progress with no genre tags (Continue Watching is the
only row that can show it), three watched, three favorites, and one deliberately
unrated.

**Seed rows are marked by a reserved video-path prefix (`__seed__/`), not by
fixed ids.** Fixed ids were the obvious design and are unreachable: `addMovie`
mints its own identifier, so using them would mean widening a production write
interface to serve a development tool. The prefix buys the same two guarantees —
a run is idempotent, and it can never delete a movie that arrived any other way
— using only the interface that already exists. No production module changed for
the seed's benefit.

**The carousel's internals.** One geometry record per variant instead of two
parallel maps, with `CarouselVariant` derived from its keys, so a variant cannot
join the type without also being given a width and an arrow position. The tile
wrapper is written once rather than duplicated across the two render arms. And
the comment claiming the continue tile is 16:9 now says 16:10, which is what the
stylesheet has always said.

**`RowSection`.** `GenreRow` and `ContinueRow` were structural twins — a
`<section>`, a serif heading, a carousel, near-identical styles. Both now
compose one unit that owns the section, the heading and the optional trailing
action. Favorites drops in later without a fourth copy.

**Both cards are keyboard-reachable.** This was the only real defect in the
plan rather than untidiness: both cards hung `onClick` on a bare `<div>`, so
somebody navigating without a mouse could not open a movie at all. `ContinueCard`
holds nothing else interactive, so its root became a real `<button>` and inherits
the platform's Enter/Space handling. `PosterCard` contains the favorite heart, so
a button root would nest a button inside a button; it got an explicit role, a tab
stop, a label and a key handler instead, and the heart now stops activation keys
the way it already stopped clicks.

**One rule extracted, `toRuntimeSeconds`.** "A runtime that is null or
non-positive is unknown" was encoded twice, in opposite polarity, in the continue
mapper and the progress helper.

**Eight devDependencies removed** — `@types/styled-components` (v5 types against
a v6 package that ships its own), the swc toolchain, the Vitest UI, and Nx's
generator-only packages. Each verified by a full typecheck, lint, test and build,
and the Nx one and jiti additionally by starting the dev server.

### Deliberately not changed

- **Nx stays.** Dropping it entirely was the larger dependency win (~10 packages
  rather than 4) but costs a tech-stack amendment, two deleted config files, and
  a hand-rewritten ESLint config, because the flat React preset pulls in four
  ESLint plugins nothing else declares. The workspace scaffold is a listed
  foundation feature. Took the free half of the win.
- **Four ESLint plugins that look unused are load-bearing.** `eslint-plugin-import`,
  `-react`, `-react-hooks` and `-jsx-a11y` appear in no config file and are
  declared by no package in the tree — the Nx flat React preset requires them at
  runtime. `eslint-config-prettier` is likewise a required peer of the Nx ESLint
  plugin. `tslib` is required by `importHelpers`, and `@testing-library/dom` is a
  peer of its React counterpart. **None of these are removable, and all of them
  look removable.** Written down here because the next person doing a dependency
  cleanup will reach for exactly this list.
- **The mappers keep their overlapping calls.** `view()` and `continueView()`
  both derive gradient stops from the id and a progress percent from the same two
  fields. That is incidental similarity between two functions producing two
  different shapes; a shared base would couple them for no gain.
- **The two heading sizes stay different.** Continue Watching is 24px and a genre
  row is 22px in the prototype. `RowSection` parameterises the size; it does not
  harmonise it. The prototype is the spec.
- **The props union keeps its per-variant arm** even though the geometry is now
  one record. The asymmetry is the price of illegal item/variant pairings being a
  compile error, which is worth more than symmetry.
- **No visual change anywhere.** Nothing in this refactor moves a pixel. If
  something looks different, that is a bug in the refactor.

### The seed's end date

The seed is scaffolding, and it has a stated expiry: **the commit that ships bulk
import is the commit that deletes it.** It exists only because Add Movie and bulk
import do not. Once real imports can fill the library, a fixture writer living in
the database folder is dead weight with a delete pass pointed at real data.

### Follow-ups this refactor surfaced

- **`eslint-plugin-jsx-a11y` is installed, loaded, and did not report the
  keyboard defect**, which means its rules are not at error severity under the Nx
  preset. Turning them up is the change that stops this recurring; it would likely
  light up more than this one feature, so it wants its own issue.
- **`ContinueCard`'s Enter/Space test asserts the element, not the keypress.**
  Browsers synthesise a click from Enter and Space on a `<button>`; jsdom does not
  simulate that, and `@testing-library/user-event` (which does) is not installed —
  adding a dependency inside a dependency-cutting refactor was the wrong trade to
  make unilaterally. So the assertion that carries the guarantee is that the
  control really is a `<button>` rather than a div wearing a role. `PosterCard`'s
  handler is hand-written and therefore tested directly, keypress by keypress. If
  `user-event` is ever added for another reason, tighten this test.
- **The rest of the tsconfig scaffolding is untouched.** Decorator metadata, the
  ES2015 target and the legacy `node` module resolution are Nx leftovers in the
  same family as the dead dependencies, but changing compiler settings can move
  emitted output and is not a dependency cleanup. Worth its own small issue. (The
  two `@nx/react/typings` entries went with `@nx/react` in this refactor, because
  they pointed at a package that no longer exists — nothing imports a CSS module
  or an image.)
- **`.claude/CLAUDE.md` is gitignored**, so the amendment naming the dev seed in
  the `db/` boundary and the `FAMILYFLIX_DB_PATH` note exists on disk but is not
  version-controlled. Worth deciding deliberately whether the project's own
  instructions should be tracked.

### Why this file now exists

Five of the six problems in this refactor were known or knowable at build time.
The 16:9 comment was explicitly on the build plan and was skipped. The geometry
sync cost was written into the design log and accepted. The row twins were named
"structural twins" in that same document. None of it was recorded anywhere a
later session would look, so all of it resurfaced as a refactor instead of as a
follow-up. That is the gap this journal is for.
