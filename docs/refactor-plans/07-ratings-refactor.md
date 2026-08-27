# 07 — Ratings refactor

Follows the build in issues #57–#63 and the candidate already filed against it,
64 (`useOptimisticEdit`). This plan covers that one, plus four things the dev
journal and the design log did not catch.

## Problem Statement

Ratings works, the suite is green at 1478, and the feature list still says 🔜.
What it cost to build was **the third copy of three different bargains**. The
journal names one of them and files it; the other two it does not mention,
because each was already written twice before this feature started and Ratings
only added the copy that makes the pattern undeniable.

That is the through-line here, and it is the same argument 64 makes for itself:
two examples were not enough to design a generalisation against, and three are.
This refactor cashes that in three times over, not once.

### 1. The optimistic bargain is hand-rolled three times in one hook

`useMovieDetail` holds `toggleWatched` (`:140`), `toggleFavorite` (`:164`) and
`rate` (`:193`), and all three write out the same five steps longhand: bail if
there is no movie, capture what the click cost, apply the new value through the
`editMovie` guard, reconcile against the route's echo, restore the captured value
on rejection.

This is 64, already filed with the three writes tabulated. It is restated here
only so the plan reads whole; the reasoning lives on that issue.

### 2. The wire contract is written three times, across two feature modules

`saveFavorite` (`features/library/api/api.ts:59`), `saveWatched`
(`features/movie-detail/api/api.ts:43`) and `saveRating` (`:74`) are the same
function three times: POST `{ value }` as JSON, throw on a non-2xx, parse the
body as `{ value?: unknown }`, type-guard the echo, and fall back to what was
sent when the key is missing.

Only two things genuinely differ — the endpoint segment, and what counts as a
usable echo (`typeof saved.value === 'boolean'` for the two flags,
`'number' || null` for the rating). Everything else is copied prose, including
the three near-identical throw messages.

The journal celebrates `saveRating`'s one real distinction — that a `null` echo
is a cleared rating rather than an unusable answer, so only a _missing_ key falls
back. That distinction is exactly the thing a shared helper should be asked to
express, and it is currently defended by a comment in one of three copies.

### 3. The single-signal write route is written three times

`POST /movies/:id/favorite` (`server/src/routes/index.ts:312`), `/watched`
(`:334`) and `/rating` (`:369`) share one skeleton: read `{ value }` off the
body, validate it, look the movie up and 404 before writing, dispatch to a
dedicated mutator, echo `{ value }`.

The 404-before-write block is written **four** times in the file, character for
character. The `res.json({ value })` echo is written three times. Only the
validation and the mutation are actually per-route, and those are the two parts
worth reading.

The journal argues at length that the rating route is "the third sibling of the
two toggles above: the same shape, the same 404-before-write check and the same
echo-is-truth bargain". It is right, and a shape described that precisely in a
comment is a shape the code should be holding instead.

### 4. The half-star display number is computed twice

`StarRating.tsx:30` and `RatingPicker.tsx:72` both round a percent to the nearest
half star and print it to one decimal — `Math.round(percent / 20 * 2) / 2` then
`.toFixed(1)`. The primitive renders `4.0`; the molecule renders `4.0 / 5`.

This is the one arithmetic in the feature with no test of its own on either side.
Both are covered only through their components' render assertions, and the rule
in CLAUDE.md — every function in `src/utils/` has a test — has no purchase while
the function is an expression inline in a `.tsx`.

It is also the seam most likely to drift silently: a rounding change on one side
produces two controls on the same page disagreeing about what 70% is called, and
nothing in the suite would fail on the arithmetic itself.

### 5. The suite prints eight `act()` warnings, seven of them this feature's

`vitest run` is green and noisy. Seven of the eight warnings come from the
Ratings build:

- `RatingPicker.test.tsx` × 4 — the whole `Enter and Space` block
- `MovieDetail.test.tsx` × 2 — both "reachable without a mouse" rating tests

All seven have one cause. They call `segment(n).focus()` as a raw DOM call, which
fires the picker's `onFocus`, which sets the **Rating preview** — a React state
update outside `act()`. The neighbouring watched/favorite focus tests
(`MovieDetail.test.tsx:733`) do not warn, because those buttons have no focus
handler that writes state.

`@testing-library/user-event` arrived at #60 and the journal flags the arrival as
worth a line. What it did not flag is that the file uses the dependency correctly
in its tab-order tests (`await user.tab()`) and then reaches around it in the
keyboard block. The eighth warning (`GenreMovies`) predates this feature.

A suite that prints warnings while passing is a suite where the next real
`act()` warning arrives pre-camouflaged.

### What is _not_ wrong

- **`StarRating` and `RatingPicker` do not merge.** They draw the same five
  stars with a clipped accent fill and they are not the same control — and,
  decisively, **the prototype has them differing exactly as the code does**:
  `rgba(255,255,255,.22)` against `.2` for the dim glyph, `--color-text-faint`
  against `--color-text-dim` for the value, a `6px` root gap against `14px`, a
  value scaled at `size * 0.86` against a fixed `14px`. Unifying the strips would
  be a redesign wearing a refactor's clothes, and CLAUDE.md's rule is that the
  prototype is amended in grill-me first or not at all. The shared _arithmetic_
  moves (item 4); the shared _pixels_ do not, because they are not shared.
- **The raw `rgba(255, 255, 255, …)` literals stay.** They are 1:1 translations
  of inline prototype values, `tokens.css` has no token for them, and eight style
  modules across the codebase already do this. Tokenising them here would put the
  Ratings styles out of step with every neighbour.
- **`useOptimisticSave` is not widened in place.** Design log Q20 declined this
  explicitly and its own docblock names the arrival. It is correct as it stands
  and stays boolean; item 1 builds beside it, not through it.
- **The picker keeps speaking percent.** A `components/` unit knowing the stored
  0–10 scale is the boundary violation the journal spent a paragraph avoiding.
  The conversion stays at the `useMovieDetail` seam.
- **`toRatingPercent` / `toRatingUnits` stay two functions.** They are pinned
  against each other in both directions already, and collapsing an inverse pair
  into one parameterised function makes the `null` case — the one that must not
  round — harder to read, not easier.
- **No cross-screen rating store.** Out of scope by the journal's own
  "deliberately not built" list, and unchanged by anything here.

## Solution

Six groups, ordered so each one's safety net is green before it starts.

**Green the suite first** (Group A). Seven `act()` warnings, one cause, no
production code touched. Doing this first means every later group can use "the
suite is silent" as its own check rather than "green apart from the known ones".

**Take the pure win next** (Group B). The half-star label is a two-line
extraction into `utils/` with a real test, and it is the only item here that
cannot break anything.

**Then the client bargain** (Group C). `useOptimisticEdit(previous, apply, save)`
at `features/movie-detail`, taking all three of `useMovieDetail`'s writes. This
is 64, and closing it is what unblocks the ✅ tick.

**Then the wire** (Group D). One `postValue` helper holding the
POST/echo/fallback contract, with the echo guard as its one parameter, so
`saveRating`'s `null` rule is a stated argument rather than a comment in the
third copy.

**Then the server** (Group E). One single-signal-write helper holding
validate → 404 → mutate → echo, so three routes read as their validation and
their mutation and nothing else.

**Then the record** (Group F). Journal, glossary, and the ✅ tick that #63 is
still holding open.

Groups C, D and E are independent of one another and each is independently
revertable. Group A precedes all of them because a noisy suite is a worse safety
net than a quiet one, and Group F is last because it describes what the others
did.

## Commits

Sixteen commits in six groups. Each leaves the tree compiling, linting and green
— and from A2 onward, green means **silent**, not "green apart from the known
seven".

### Group A — a safety net that is actually quiet

**A1.** Replace the four raw `.focus()` calls in `RatingPicker.test.tsx`'s
`Enter and Space` block with the file's own established idiom — `await
user.tab()` to reach the segment, or `act()` around the focus where a specific
segment index is the point of the test. No assertion changes: each test still
proves the same thing about Enter and Space. Four warnings gone.

**A2.** The same treatment for the two rating tests in `MovieDetail.test.tsx`.
Leave the watched/favorite focus tests alone — they do not warn and they are not
this feature's. Six of seven gone; the `GenreMovies` one is out of scope and
noted in the commit body so the next reader knows it was seen and left.

### Group B — one half-star number

**B1.** `src/utils/toStarLabel/` — takes a 0–100 percent, returns the rounded
half-star value as a one-decimal string. Its test pins every half-star point,
both ends of the scale, and the rounding boundaries between them. RED first.

**B2.** `StarRating` uses it. Its rendered output is byte-identical; its own
tests do not change.

**B3.** `RatingPicker` uses it, appending ` / 5`. The `Not rated` branch stays
where it is — that is the molecule's copy, not shared arithmetic. Rendered output
byte-identical, tests unchanged.

### Group C — one optimistic bargain (closes 64)

**C1.** `features/movie-detail/useOptimisticEdit/` with its test, written against
the three shapes it must serve: a restore that is a captured pair
(`{ isWatched, playLabel }`), a restore that is a derived boolean, and a restore
that is a captured value which may be `null`. RED first, hook does not exist yet.

**C2.** `rate` moves onto it. The rating first, deliberately: it is the write
with the widest value set and the one whose `null` restore `useOptimisticSave`
could not express, so if the new hook cannot hold it the plan finds out at the
first call site rather than the third.

**C3.** `toggleFavorite` moves onto it.

**C4.** `toggleWatched` moves onto it — last, because its restore is the pair
rather than a single value, and it is the one most likely to want a small
adjustment to the hook's shape.

**C5.** Delete the three hand-rolled bodies' now-redundant comments and rewrite
`useMovieDetail`'s docblock: it currently explains the bargain three times over.
No behaviour change.

### Group D — one wire contract

**D1.** A `postValue` helper — endpoint, value, and a guard saying what counts as
a usable echo — with its own test covering: the echo taken over what was sent, a
missing key falling back, a non-2xx rejecting, and (the case that earns the
parameter) a `null` echo accepted as a value rather than treated as missing. RED
first.

Where it lives is a real question and the answer is `features/movie-detail/api/`
only if it has one consumer. It has three, two of them in `features/library`, so
it goes wherever the two api modules can both reach without either feature
importing the other — which on today's structure means a shared rung. The
existing cross-feature import (`useMovieDetail` reaching for
`features/library/api`'s `saveFavorite`, with a comment apologising for it) is
evidence this seam already exists and is currently paid for by an import that
CLAUDE.md's layer rules would rather not have.

**D2.** `saveWatched` uses it.

**D3.** `saveRating` uses it, passing the `number | null` guard. Its comment about
the `null` echo shrinks to a line, because the rule is now in the argument.

**D4.** `saveFavorite` uses it.

### Group E — one single-signal write

**E1.** A route helper holding validate → look up → 404 → mutate → echo, with its
test. RED first. The validator and the mutator are its parameters; nothing else
is.

**E2.** `/favorite` uses it.

**E3.** `/watched` uses it — the mutator is the `markWatched` / `markUnwatched`
branch, which stays exactly where the journal put it.

**E4.** `/rating` uses it, passing `isRatingValue` and keeping its two distinct
400s: the missing-key case and the off-scale case are different messages and must
stay so, since one of them is the write that erases data.

**E5.** If the helper leaves `routes/index.ts` meaningfully thinner, extract it to
its own folder with its test per the one-folder-per-unit rule. If it does not, it
stays local to the file — the rule's trigger is companion files, and a helper
with a test has one.

### Group F — the record

**F1.** `docs/dev-journal.md` — the refactor entry. What the three-copies
through-line was, why item 4's arithmetic moved while item 4's pixels explicitly
did not, and the `act()` warnings as a note about a new test dependency being
half-adopted.

**F2.** `docs/ubiquitous-language.md` — the **Optimistic save** entry currently
says `useMovieDetail` hand-rolls all three writes. After Group C that sentence is
false and needs to name the shared hook instead.

**F3.** Tick Ratings ✅ in README.md and `.claude/CLAUDE.md`, closing #63's last
acceptance criterion.

## Decision Document

- **Three separate generalisations, not one.** The optimistic bargain, the wire
  contract and the route skeleton are three different duplications that happen to
  share one cause. Each gets its own module, its own test and its own group. No
  attempt is made to unify them with each other.
- **`useOptimisticEdit` takes the previous value as an argument.** The revert is
  told, never derived — that is the whole reason `useOptimisticSave` could not
  take the rating, and it is the interface decision this refactor exists to make.
- **`useOptimisticSave` survives unchanged.** Two hooks, one boolean-only and
  one general. The boolean one has two browse call sites that are correct and
  tested; churning them to prove a point costs more than the second hook does.
  Whether the browse screens later migrate is a question for the Favorites
  feature, which CLAUDE.md already assigns both surfaces.
- **The echo guard is a parameter, not a union.** The wire helper does not
  inspect the value's type to decide what a good echo looks like. The caller says
  so, because "a `null` echo is a cleared rating" is a per-route fact and encoding
  it as a type check would make it a global one.
- **The route helper does not own validation.** It owns lookup, 404, dispatch and
  echo. What a valid body is stays per-route, because the three routes disagree
  and should — two accept exactly a boolean, one accepts an allow-list with two
  distinct rejection messages.
- **Nothing in this refactor changes an HTTP contract, a rendered pixel, or a
  stored value.** Every group is a pure internal move. Any diff that changes what
  a route answers or what a component draws is a bug in this plan, not a feature
  of it.
- **The prototype is not touched.** Ratings already spent this project's first
  prototype amendment and it was argued for on its own. A refactor is not where a
  second one gets taken quietly.

## Testing Decisions

A good test here asserts what a caller can observe and would survive every one of
these six groups being rewritten. The bar for this refactor specifically: **the
existing 1478 tests are the specification**, and a passing suite before and after
each commit is the evidence that nothing moved. New tests are added only for the
new modules' own contracts.

- **`toStarLabel`** — a pure function with a table of percents and expected
  strings. Prior art: `toRatingPercent` / `toRatingUnits`, which pin each other at
  every half-star point in both directions.
- **`useOptimisticEdit`** — tested through its three real restore shapes, not
  through a synthetic one. Prior art: `useOptimisticSave.test.ts`, which drives
  apply/echo/revert through a fake save and asserts on what `apply` was called
  with.
- **The wire helper** — tested through a stubbed `fetch`, asserting the request
  body and the resolved value. Prior art: both `api.test.ts` files, which already
  do exactly this for all three save functions.
- **The route helper** — tested through the router with a fake `LibraryStorage`,
  asserting status and body. Prior art: `routes.test.ts`, which already covers all
  three write routes this way, including the 404-before-write case.
- **No new test doubles for internal collaborators.** If a group needs a mock of
  something inside the module under test to be provable, the interface is wrong.
- **The suite must be silent, not merely green**, from A2 onward. That is the
  check Group A exists to make available.

## Out of Scope

- **Unifying the two star strips.** Item 4's "what is not wrong" states the case:
  the prototype has them differing, so merging them is a design change and belongs
  in a grill-me, not here.
- **Tokenising the raw `rgba` literals**, in Ratings or anywhere else. A
  codebase-wide question about eight files, not a Ratings refactor.
- **The `GenreMovies` `act()` warning.** Pre-dates this feature; noted in A2's
  commit body and left for whoever refactors that screen next.
- **The two `parseMinRating` functions** — one in `src/utils/`, one local to the
  route layer, same name, different rules (an allow-list of the dropdown's
  cut-offs against a 0–10 range check). Both are correct and the separation is
  deliberate per the `isMovieSort` precedent in `05`'s refactor. Only the shared
  _name_ is unfortunate. Left alone; see Further Notes.
- **Migrating the browse screens onto `useOptimisticEdit`.** A Favorites-feature
  question.
- **`saveFavorite`'s home.** It stays in `features/library/api` with its comment
  intact. Group D changes what it is built from, not where it lives; re-homing it
  is the job CLAUDE.md already assigns to Favorites.
- **Anything TMDB, MovieForm, snackbar, or cross-screen cache.** All named in the
  journal's "deliberately not built" and none of it becomes in-scope because a
  refactor is happening nearby.

## Further Notes

**On the ✅ tick.** #63's fourth acceptance criterion is written against "that
refactor issue" — meaning 64 specifically, which at the time was the only one
filed. Group C closes 64; Group F ticks the feature. If the groups land
separately, the tick waits for **this plan**, not for C alone — a feature is Done
after step 8, and step 8 is all of it.

**On the name collision.** `parseMinRating` existing twice with two different
contracts is the kind of thing that reads fine until someone greps for it. It is
left alone here because renaming a server-local function is unrelated to Ratings
and would put a stray hunk in a refactor whose defining property is that it
changes no behaviour. Worth a follow-up if it ever bites.

**On why item 3 is worth doing at all.** Three routes of roughly ten lines each
is not a lot of duplication by volume. The argument is not volume — it is that
the 404-before-write check is a _correctness_ rule (never write to a movie that
is gone) currently upheld by having remembered to paste it four times. That is
the class of duplication where the fourth author forgets, and the bug is silent.
