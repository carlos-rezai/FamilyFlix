# 06 — Genre page refactor

Follows the build in issues #42–#51 and the two follow-ups already closed
against it, #53 (`useQueryParamWriter`) and #54 (`src/test-support/`). This plan
covers what those two left, plus four things the dev journal did not catch.

## Problem Statement

The genre page works and the feature list still says 🔜. What it cost to build
was a **second browse screen that re-derived, rather than reused, the machinery
the first one already had** — and the two screens now sit side by side in the
same feature folder with the duplication in plain sight.

### 1. The load machine is written three times

`useHomeRows`, `GenreMoviesProvider` and `useMovieDetail` each hold their own
copy of the same four mechanics:

- an `attempt` counter with `retry` incrementing it,
- the `let current = true` in-flight guard and its cleanup,
- the `.then` / `.catch` that sets the payload or resets it, and
- for the first two, the skeleton latch —
  `setStatus(prev => prev === 'ready' ? 'ready' : 'loading')`.

The first two are near-byte-identical **including their comments**: "A retry —
or a newer genre or query — landing while an earlier load is still in flight
must not have the abandoned response overwrite it" and "A retry — or a newer
query — that lands while an earlier load is still in flight must not have the
abandoned response overwrite it" are the same sentence twice. The skeleton-latch
rule — a refetch keeps the grid on screen, only a load with nothing to show
falls back to the skeleton — is a **policy**, and it is currently a policy stated
in two places that nothing holds together.

`useMovieDetail` is the same mechanics around a different state shape: four
statuses rather than three, and a discriminated union rather than separate
fields, because a 404 and a failure want different buttons. It is deliberately
**not** part of this extraction (see Out of Scope).

### 2. The optimistic favorite save is written three times

Apply the new value at once, take the route's echo over what was assumed, put it
back if the save is refused. `useHomeRows` and `GenreMoviesProvider` differ only
in which pure updater they call — `withFavorite` over rows, `withFavoriteInList`
over a flat list — and `useMovieDetail` runs it twice more, for watched and for
favorite. The `.then(saved => { if (saved !== value) ... })` shape is copied
verbatim four times in the codebase.

### 3. The skeleton card is written twice

`SkeletonCard`, `SkeletonPoster` and `SkeletonLine` are byte-identical between
`HomeRows.styles.ts` and `GenreGrid.styles.ts` — save that the home's card
carries the carousel's fixed width and the genre's takes its grid track. The
`range` helper above them is duplicated too, as is the `LoadMessage` + Retry
`<Button>` block, which differs between the two files only in its two strings.

### 4. The two layouts' styles are near-duplicates

`Root` differs by one `position: relative`. `Header` differs by one `gap`.
`Spacer` and `Body` differ by a spelling and a padding respectively. The gradient
background, the 100vh flex column, the translucent blurred strip, the
`z-index: 40`, the border — all written twice, and every one of them is app
chrome rather than anything either screen owns. Settings and the player are two
more screens due to arrive behind chrome that is not `MainLayout`'s.

### 5. The jsdom flex hack is unnecessary, and its comment is wrong

`GenreLayout.styles.ts`'s `Spacer` is `flex-grow` / `flex-shrink` / `flex-basis`
longhand, commented "because the tests read `flexGrow` back off the computed
style, and jsdom does not expand the `flex` shorthand". The dev journal calls
this out as "the production line bent to suit a test runner".

**It is not true.** `MainLayout.styles.ts`'s `Spacer` uses the `flex: 1 1 auto`
shorthand, and `MainLayout.test.tsx` asserts on it with exactly the same
`getComputedStyle(child).flexGrow === '1'` predicate — and passes. Measured
directly against this repo's jsdom: a styled `flex: 1 1 auto` reports
`flexGrow === "1"`, identical to the longhand. The hack can be reverted to the
shorthand with **no test change at all**, and the journal's paragraph about it
retracted.

### 6. The route layer parses `sort` three times, and the three disagree

`/home`, `/genre/:name` and `/movies` each carry their own sort-parsing block.
The first two are identical:

> absent or empty → the default; otherwise validate, or 400.

`/movies` is written differently — `sortParam !== undefined && !isMovieSort(...)`
— so `GET /api/movies?sort=` (an empty value) is a **400**, where the same empty
value on the other two endpoints is documented and tested as "no sort at all".
Both `/home` and `/genre` have a test named "treats an empty `?sort=` as the
default order, not as a bad request". `/movies` has no such test, and would fail
it. The `q` → `search` translation, with its own "empty means absent" rule, is
likewise copied between `/home` and `/genre`.

### 7. Sixteen folders in one feature, serving two screens

The dev journal's third follow-up, left open as "a judgement call for the
refactor rather than a defect": `GenreGrid`, `GenreHeading`, `GenreMovies`,
`genreCountLabel` and `LibraryGrid` sit flat in `features/library/` beside
`GenreRow`, `HomeRows`, `RowSection`, `useHomeRows`, `toGenreRow`,
`continueView`, `ContinueRow`, `CardCarousel`, `view`, `withFavorite` and `api`.
Nothing says which of the two screens a folder serves except its name, and
`GenreRow` (a home unit) and `GenreGrid` (a genre-page unit) are adjacent and
alphabetically interleaved.

### 8. The suite is not reliably green

`vitest run` fails on `src/App/App.test.tsx` — the same test, in both of two
consecutive full runs — while passing in isolation. It is not a product bug.
`GENRE_MOVIES.Action` is built at module level with 214 movies, and **six** of
that file's twenty tests navigate into that genre page, each rendering all 214
real `PosterCard`s through jsdom and styled-components. The file needs 7.7s for
its twenty tests with the machine to itself; under 43 parallel workers the two
heaviest cross vitest's default 5000ms `testTimeout`, which `vite.config.mts`
does not override. Exactly one test — "opens every movie in the genre,
uncapped" — actually asserts on the number 214.

A refactor whose safety net is intermittently red is not a safety net, so this is
fixed **first**.

### What is _not_ wrong

- **The two query parsers stay separate.** `parseGenreQuery` /
  `parseLibraryQuery` and their serializers are deliberately parallel, per the
  design log's Q12: a shared parser would build a screen that silently honours a
  hand-edited `?rating=7` it has no control to display. #53 already extracted the
  one part of that pair which is genuinely vocabulary-free — the **writer**.
  Nothing further is shared here.
- **`GenreMovies` being a context is right.** A fixed header and a scrolling body
  over one payload cannot be served by a hook called in both subtrees without
  making it two requests. The provider stays; only its innards are extracted.
- **`GET /api/movies` keeps its behaviour**, except for the empty-`?sort=`
  correction in item 6, which brings it into line with the two endpoints that
  already document and test that rule.
- **The `GenreQuery` / `Partial<GenreQuery>` split stays.** Two shapes for two
  jobs, as the journal records.

## Solution

Eight groups, in an order where each one's safety net is already green when it
starts.

**Green the suite first** (Group A). Shrink the 214-movie fixture to the one test
that asserts on it, so the file stops rendering 1284 poster cards to prove five
things that do not need them.

**Take the free win next** (Group B). The flex hack is one line and the
measurement is already done.

**Then the machinery** (Groups C and D). One `useBrowseLoad` hook holding the
load machine and the skeleton-latch policy, and one `useOptimisticSave` holding
the apply/echo/revert bargain — both at `features/library`'s shared rung, both
covering exactly the two call sites that are identical today. One shared skeleton
card and one shared retryable-failure block beside them.

**Then the chrome** (Group E). A shared chrome styles module both layouts extend,
and the two layout test helpers into `src/test-support/` where #54 put the
others.

**Then the server** (Group F). One sort parser, one search-term reader, three
endpoints that cannot drift on what an empty value means.

**Then the shape** (Group G). `features/library/home/` and
`features/library/genre/`, with the units both screens share left at the top —
pure moves, no logic, done last so nothing else in this plan has to be written
against paths that are about to change.

**Then the record** (Group H).

## Commits

Twenty commits in eight groups. Each leaves the tree compiling, linting and
green — and from A1 onward, green means _the whole suite_, not "green apart from
the known one".

### Group A — a safety net that is actually green

**A1. Shrink the genre fixture to the test that asserts on it.** In
`src/App/App.test.tsx`, `GENRE_MOVIES.Action` stops being a module-level array of 214. The five tests that merely navigate into Action get a small genre — enough
cards to be a grid, no more — and the single test that proves the screen is
uncapped builds the 214 for itself. `HOME_PAYLOAD`'s `count: 214` and the "View
all 214" label stay exactly as they are: the row's count is the **genre total**
from `listGenres()` and has never been the length of anything the fixture holds,
which is the whole point of the number. The assertions are unchanged in every
test; only how many cards each one renders behind them changes.

**A2. Set an explicit `testTimeout`.** In `vite.config.mts`, state the timeout
rather than inheriting vitest's 5000ms, with a comment naming why: this suite
renders real component trees through jsdom under 43 workers, and the default is
tuned for unit tests. A1 fixes the cause; this is the margin, so a slower machine
or a busier one does not re-open the same failure. Nothing else in the config
moves.

**A3. Clear the `act()` warnings in `App.test.tsx`.** Three "An update to
HomeRows inside a test was not wrapped in act(...)" warnings fire from the tests
that navigate away while the home's fetch is still in flight. Same treatment as
the two warnings #41 cleared: wait for the load the test actually depends on
rather than leaving a floating promise to resolve into an unmounted tree. No
assertion changes.

### Group B — the free win

**B1. Restore the `flex` shorthand in `GenreLayout.styles.ts`.** `Spacer` becomes
`flex: 1 1 auto`, matching `MainLayout`, and the comment explaining the longhand
is deleted rather than reworded — it was wrong. Measured: jsdom reports
`flexGrow === "1"` for both spellings, which is why `MainLayout`'s identical
assertion has always passed against the shorthand. **No test changes**;
`GenreLayout.test.tsx` is untouched and still passes, which is the proof.

### Group C — one load machine

**C1. Add `useBrowseLoad`.** A new unit at `features/library`'s shared rung, with
its own test file. It takes a fetcher and the value that identifies the load it
is for, and hands back `{ status, data, retry }`. It owns, in one place:

- the `attempt` counter and the `retry` that increments it,
- the in-flight guard, so an abandoned response can never overwrite a newer one,
- the **skeleton latch**: once `ready`, a refetch stays `ready`, and only a load
  with nothing on screen falls back to `loading`.

Its docblock is where the latch is explained from now on. Nothing calls it yet;
this commit is the unit and its test alone, so the two that follow are each a
substitution against a hook that is already proven.

**C2. Point `useHomeRows` at it.** The hook keeps its name, its
`UseHomeRowsResult` shape, its `query` derivation and its `toggleFavorite`
exactly as they are. Its `useState` trio, its `useEffect` and its `attempt`
counter are replaced by one `useBrowseLoad` call and the mapping of the payload
into `rows` and `continueWatching`. **`useHomeRows.test.tsx` is not edited** —
all 52 of its tests still pass, which is the guard that the substitution changed
nothing a caller can see.

**C3. Point `GenreMoviesProvider` at it.** The same substitution. The provider
keeps its context, its `GenreMoviesValue` shape, its `genre`-from-the-path rule
and its settled-query canonicalisation. **`GenreMovies.test.tsx` is not edited** —
all 34 tests still pass.

**C4. Delete the duplicated comments.** With the mechanics in one place, the
in-flight and skeleton-latch paragraphs in `useHomeRows` and `GenreMovies` become
two copies of a sentence that now has a home. Each is replaced by a reference to
`useBrowseLoad`, and each hook keeps only what is true of _it_ — what it loads,
what it maps, what it hands back. A comment-only commit, deliberately separate so
the substitutions in C2 and C3 read as pure substitutions in the diff.

### Group D — one optimistic save, one skeleton, one failure block

**D1. Add `useOptimisticSave`.** Beside `useBrowseLoad`, with its own test. It
holds the bargain the hearts keep: show the new value at once, take the route's
echo over what was assumed, put it back if the save is refused. It is
parameterised by the pure updater, which is what lets `withFavorite` over rows
and `withFavoriteInList` over a flat list both use it — the shapes differ, the
bargain does not. Nothing calls it yet.

**D2. Point both favorite toggles at it.** `useHomeRows` and
`GenreMoviesProvider` each drop their `.then` / `.catch` block for a call to it.
Neither test file is edited; the favorite tests in both — including the
revert-on-failure ones — still pass.

**D3. One skeleton card.** `SkeletonCard`, `SkeletonPoster` and `SkeletonLine`
move to a shared styles unit at the feature's shared rung, and both
`HomeRows.styles.ts` and `GenreGrid.styles.ts` import them. The one real
difference is kept where it belongs: the home's card is fixed to `CARD_WIDTH`
because it sits in a strip, the genre's takes its grid track. The `range` helper
goes with them. Neither component's markup changes.

**D4. One retryable failure.** The `LoadMessage` + Retry `<Button>` block is
identical in `HomeRows` and `GenreGrid` but for its two strings. It becomes one
small unit taking `title` and `body`, so the Retry affordance — its label, its
variant, the fact that there is one at all — is decided once. The two copy
strings stay at their call sites, where the wording is the screen's own.

### Group E — one piece of chrome

**E1. Extract the shared chrome styles.** `Root`, `Header`, `Spacer` and `Body`
move to a shared styles module in `layouts/`, and both layouts extend it with
their own differences: `MainLayout`'s `position: relative` and its body padding,
`GenreLayout`'s tighter header `gap`. The gradient, the 100vh flex column, the
translucent blurred strip and the `z-index: 40` are written once. Neither layout
test file is edited; both suites of eleven still pass.

**E2. Move the layout test helpers into `src/test-support/`.** `headerSpacer()`
and `comesBefore()` are copied verbatim into both layout test files, right down
to their docblocks and their thrown error message. They join `LocationProbe` and
`stubScrollMetrics` under the home #54 established, each in its own folder with
its own test. The assertions that use them are unchanged.

### Group F — one sort parser, one search reader

**F1. Extract the route layer's sort parser.** One helper in
`server/src/routes/`, returning either the validated sort or the signal to answer
400, replacing the three hand-written blocks. `/home` and `/genre/:name` are pure
substitutions — their existing "treats an empty `?sort=` as the default order"
tests pass unedited.

**F2. Bring `/movies` onto the same rule.** This is the one **behaviour change**
in this plan: `GET /api/movies?sort=` stops answering 400 and answers the default
order, which is what `/home` and `/genre/:name` have always done and what all
three endpoints' comments already claim. A new test pins it, named to match the
two that already exist. An unknown sort is still a 400 on all three.

**F3. Extract the `q` → `search` reader.** The "wire name `q`, domain name
`search`, empty means absent" translation is written once and used by `/home` and
`/genre/:name`. The existing "treats an empty `?q=` as no search at all" tests on
both endpoints pass unedited.

### Group G — two screens, two folders

**G1. Group the home's units under `features/library/home/`.** `HomeRows`,
`useHomeRows`, `GenreRow`, `RowSection`, `ContinueRow`, `toGenreRow` and
`continueView` move down one rung, keeping their own folders and their tests
beside them. Imports update; `LibraryPage.tsx` updates. **No file's contents
change** beyond import paths.

**G2. Group the genre page's units under `features/library/genre/`.**
`GenreGrid`, `GenreHeading`, `GenreMovies` and `genreCountLabel` likewise.
`GenrePage.tsx` updates. What is left at the top of `features/library/` is
exactly the shared rung: `api`, `view`, `withFavorite`, `CardCarousel`,
`LibraryGrid`, `useBrowseLoad`, `useOptimisticSave` and the two units from D3 and
D4 — which is now a statement rather than an accident.

No barrel is added at either new folder. CLAUDE.md's rule stands: only
`primitives/`, `components/`, `utils/` and `tokens/` carry an `index.ts`, and
`features/` never has.

### Group H — the record

**H1. Glossary.** `docs/ubiquitous-language.md` gains the terms this refactor
names — the **browse load** and its skeleton latch, the **optimistic save**
bargain — and the note that `features/library` is grouped by screen. The
flagged-ambiguities section gains the `?sort=` correction from F2.

**H2. Dev journal.** A new entry, newest first. It records what shipped, and it
**retracts** the "production line bent to suit a test runner" paragraph from the
2026-08-22 entry: the claim was wrong, jsdom does expand the shorthand, and the
longhand was never needed. It also records the A1 finding — that an integration
fixture's size, not any product code, was what made the suite red.

**H3. Tick the genre page ✅.** In both README.md and CLAUDE.md, the Genre page
row goes from 🔜 to ✅ — the standing rule is that a feature is Done after
`request-refactor-plan` → `refactor`, and this is that commit. The same thing
#41's final commit did for Search + Filter.

## Decision Document

- **The load machine is extracted for two call sites, not three.** `useHomeRows`
  and `GenreMoviesProvider` are identical today; `useMovieDetail` is the same
  mechanics around a genuinely different state shape — four statuses and a
  discriminated union, because a 404 and a failure earn different buttons.
  Folding it in would mean expressing `not-found` as a payload value and bending
  a union that exists precisely so the page cannot read `ready` beside an absent
  movie. Two verbatim copies justify an extraction; a third near-miss does not.
- **The shared hooks live at `features/library`'s shared rung, not in
  `src/hooks/`.** `src/hooks/`'s stated rule is "only hooks used across 2+
  features", and these serve one. It is also a better fit on the merits:
  `src/hooks/` holds `useGoBack` and `useRestoredScroll`, both pure router/DOM
  concerns with no fetch and no status vocabulary, where `useBrowseLoad` returns
  `'loading' | 'ready' | 'error'` and encodes the skeleton-latch **policy**.
  **The promotion trigger is recorded**: the first consumer outside
  `features/library` — most likely Favorites — is when it moves up, and that is a
  one-commit move with no call-site churn. Demoting it after three features have
  imported it would not be.
- **`useBrowseLoad` is a proposed name, not a settled one.** It is the term this
  plan writes into the glossary; if the refactor session prefers another, the
  glossary entry is what changes with it. What is settled is that the hook exists
  and that the skeleton-latch policy is documented in exactly one place.
- **`GenreMovies` stays a context.** The provider is the answer to a fixed header
  and a scrolling body over one payload; only its innards are extracted. Its
  public value shape does not change.
- **`features/library` is grouped by screen, not by kind.** `home/` and `genre/`,
  with what both screens use left at the top. Grouping by kind — `components/`,
  `hooks/`, `utils/` inside the feature — would sort `GenreGrid` next to
  `HomeRows` by what they are rather than by which screen needs them, which is
  the question a reader of this folder is actually asking.
- **The two query parsers are untouched.** The design log's Q12 argument stands
  and #53 already took the shareable half.
- **`GET /api/movies?sort=` changes behaviour, deliberately.** Empty means "no
  sort" on `/home` and `/genre/:name`, is documented as such in all three
  endpoints' comments, and is tested on two of the three. `/movies` disagreeing
  is a drift, not a contract — it has no test asserting the 400, and no client
  sends an empty `?sort=`. Consistency across three endpoints beats preserving an
  untested inconsistency.
- **The layouts share styles; they do not share a component.** A shared styles
  module both extend, not `GenreLayout` importing `MainLayout`'s — which would
  make `MainLayout` an implicit base class and its styles a public surface, right
  before Settings and the player arrive wanting chrome that is neither.
- **The `flex` hack is reverted with no test change.** Measured against this
  repo's jsdom: `flex: 1 1 auto` reports `flexGrow === "1"`. `MainLayout` has
  always relied on this. The journal's paragraph is retracted rather than
  reworded.
- **The red test is fixed by shrinking the fixture, and the timeout is set as
  margin.** The cause is 1284 poster cards rendered to prove five things that do
  not need them. Raising the timeout alone would have left the cause in place and
  hidden the next slow test with it.

## Testing Decisions

**What makes a good test here.** Every commit in Groups B through G is a
substitution: the code moves, and what a caller can observe does not. The
strongest possible evidence for that is an **unedited test file that still
passes**. So the rule for this refactor is that a test file is edited only when
the behaviour it describes has genuinely changed — which happens exactly twice,
in A1 (fixture size, assertions unchanged) and F2 (the `?sort=` correction).

If a substitution _requires_ its test file to be edited, that is the signal the
test was coupled to the implementation, and the commit stops to ask why rather
than editing the test to match.

**Modules that get new tests of their own:**

- `useBrowseLoad` — the skeleton latch (a refetch with data on screen stays
  `ready`), the in-flight guard (an abandoned response never overwrites a newer
  one), and `retry` re-running a failed load. Prior art: `useHomeRows.test.tsx`
  and `GenreMovies.test.tsx` already test all three through their callers, so the
  new test asserts them directly and the existing ones keep asserting them
  through the screens.
- `useOptimisticSave` — the value shows before the save resolves, the route's
  echo wins over the assumption, and a rejection reverts. Prior art: the favorite
  tests in both `useHomeRows.test.tsx` and `GenreMovies.test.tsx`.
- The shared skeleton unit and the retryable-failure unit — rendered shape and
  accessible name only; they are presentational. Prior art: `LoadMessage`'s own
  test in `components/`.
- `headerSpacer` and `comesBefore` in `src/test-support/` — each gets its own
  test, the way `LocationProbe` and `stubScrollMetrics` did under #54.
- The route helpers from F1 and F3 — covered through the endpoints, as the route
  layer already is. `routes.test.ts`'s 69 tests are the net; F2 adds one.

**Modules whose tests must not be edited:** `useHomeRows.test.tsx` (52),
`GenreMovies.test.tsx` (34), `GenreGrid.test.tsx` (27), `GenreLayout.test.tsx`
(11), `MainLayout.test.tsx` (11), and the `/home` and `/genre/:name` blocks of
`routes.test.ts`. Their passing unedited is the guard on Groups B–G.

**Coverage of the area is good, and that is why this refactor is safe.** 1308
tests, 83 files; every unit this plan touches has a test file already, and the
integration net in `App.test.tsx` covers the genre page end to end — the routing,
the uncapped grid, the carried sort, the count label and the two empty states.

## Out of Scope

- **`useMovieDetail`.** It keeps its own load machine and its own two optimistic
  saves. Folding a four-status discriminated union into a three-status hook is a
  redesign of that page's state, not a deduplication, and this refactor is the
  genre page's.
- **`parseGenreQuery` / `parseLibraryQuery` and their serializers.** Deliberately
  parallel per the design log's Q12; #53 took the shareable half.
- **The `api/` modules' `fetch` → `!ok` → `throw` → `json` bodies.** Four copies
  across three features, and the fourth (`fetchMovie`) resolves `null` on a 404
  rather than throwing, so they are not four copies of one thing. Noted as a
  follow-up rather than done here.
- **Any change to what `GET /api/movies` returns.** F2 changes only how it reads
  an empty `?sort=`.
- **The genre page's design.** No copy, no layout, no state, no interaction
  changes. The prototype is unamended by this plan.
- **The rating filter on the genre page.** Ruled out at Q9 and still out.
- **`src/hooks/`'s stated rule.** This plan honours it rather than amending it.
- **The back-to-top FAB, Favorites, and the Continue Watching row.** Separate
  features on the list, however much `GenreMovies` is the shape they will copy.

## Further Notes

**On ordering.** Group G moves files that Groups C through F edit, so it is
deliberately last among the code groups — the alternative is writing four groups
of commits against paths that are about to change, and then a move that touches
every one of them again.

**On what this refactor is really buying.** Favorites and a flat search-results
page are both on the feature list, and both are the same screen shape the genre
page just built: a fixed header, a scrolling body, one payload, a skeleton on
first load only, an optimistic heart. Today that shape exists as two copies with
no shared name. After this, it is a hook, a policy documented once, and a folder
called `genre/` sitting next to a folder called `home/` that a third folder can
be built beside without reading either one first.

**On the red test as a finding.** It is worth naming that the suite has been
failing in full runs and passing in isolation, and that nothing in the build
noticed. The cause is entirely test-side, but the shape of it — a module-level
fixture grown to 214 because one test needed it, then reused by five that did
not — is the kind of thing that gets worse rather than better, and the genre page
is the first screen in this codebase with a fixture big enough for it to matter.
