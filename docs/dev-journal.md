# Dev Journal

Running record of what shipped, what was deliberately left alone, and what a
later session should know before touching something. Design logs are immutable
snapshots of a decision at a moment; PRDs and refactor plans describe intent
before the work. This file is the thing in between — written _after_ the work,
and the place a known-but-not-yet-fixed problem goes so that it surfaces as a
follow-up rather than as somebody's later surprise.

Newest entry first.

---

## 2026-08-30 — Continue Watching refactor (issues #80, #81)

Fourteen commits in five groups against
`docs/refactor-plans/09-continue-watching-refactor.md`, with issue 80 folded in
as Group A exactly as 80 asked in writing. **1677 tests pass across 104 files**,
up from 1644 across 98 — every one of the 33 new tests belongs to a helper that
moved onto a test-support rung, and not one existing assertion changed.

Nothing here changes a rendered pixel, an HTTP contract, a stored value, or a
SQL result. No frontend shipping file changed at all, exactly as the build
didn't. Two backend shipping files changed, both in Group C, and both only in
how a SQL string is built rather than in what it produces.

### The bill that had been accruing since #15

`Movie` gained a required `lastWatchedAt` in issue #76, and **sixteen frontend
test files stopped type-checking in the same commit** — each carrying its own
23-field `makeMovie` literal, each needing the identical one-line edit.

It arrived not because #76 was careless but because `Movie` had not gained a
field since the type was split out in #15, so nothing had ever tested what a
change to the library's central record costs. The answer was sixteen edits. Add
Movie, bulk import and the player each add fields to this record, so the same
bill was going to arrive three more times.

Measured before it was fixed: twelve of the sixteen were byte-for-byte
identical, and the other four differed **only in what specimen the file wanted**
— never in the record's shape. That is what an override factory is for. One
`src/test-support/makeMovie/` now holds the shape; the four specimens live at
their call sites as thin local wrappers named for what they build
(`makeStartedMovie`, `makeNorthwind`, `makeQuietHarbor`). The builder never grew
a parameter per specimen, because that would be the same duplication wearing a
different hat.

**The same measurement then found four more, one rung down.** `CardCarousel`,
`GenreRow`, `LibraryGrid` and `FavoritesRow` all build `PosterCardMovie`, three
of them from a byte-identical literal — so `makePosterCardMovie` joined the rung
on the same argument. `ContinueRow`'s `ContinueCardMovie` builder stayed put: one
caller is not duplication, and moving it would be the mirror of the `api/` rule
this codebase already follows.

### The server had the same problem, worse, with nowhere to put the answer

Seven backend test files opened with a **byte-identical forty-line preamble** —
`Closeable`, `closeables`, `track`, `freshStorage`, an `afterEach` teardown, and
a `newMovie` builder — and two of them additionally shared `seedByAge` and
`seedGenre`. The frontend has had a `test-support/` rung since #54. `server/src/`
had none, so the duplication had nowhere to go and was copied file by file.

`server/src/test-support/` is a **documented boundary amendment**, argued in the
plan and landed as a docs-only commit before any code moved. CLAUDE.md keeps
`server/src/` deliberately closed to catch-all folders — but that rule is about
_backend logic_ having a domain home, and test doubles are not backend logic.
They are the category the frontend already gave its own rung and its own
one-line rule.

**No invoice had been delivered on the server yet.** `NewMovie`'s new field was
optional, so nothing broke. The next one might not be.

Two things the move taught, neither of them guessed:

- **A module-scope `afterEach` inside an imported helper registers per importing
  file.** This was verified with a throwaway two-file probe before the harness
  was written, rather than assumed: under Vitest's default isolation each test
  file gets its own module registry, so each gets its own `closeables` array and
  its own teardown. `freshStorage.test.ts` pins it permanently.
- **Splitting one `afterEach` into two exposed an ordering rule.** Vitest runs
  `afterEach` hooks in **reverse** registration order, so a file's own hook runs
  _before_ an imported one — and Windows will not delete a directory holding an
  open database file. `write` and `genre` went red immediately. The harness now
  exports `closeTracked()` for exactly that case. Found by the suite, not by
  reading.

### Four comments doing a compiler's job

The build left four places where a comment held a guarantee the code could hold
itself. All four are now the code's.

- `last-watched`'s `ORDER BY` tail was `recently-added`'s body copied character
  for character, with a comment promising the two stay identical. It is composed
  from the same named constant now, so editing `recently-added`'s tiebreak can
  no longer silently break the unstamped-library guarantee while the comment
  goes on claiming otherwise.
- **"Started but not finished" was written twice in SQL** — the `inProgressOnly`
  `WHERE` term and the middle rank of `unwatched-first` — for the rule the
  Continue Watching row is _defined_ by. One `IN_PROGRESS` constant now. Its
  TypeScript twin `deriveStatus` deliberately did **not** merge: same rule, two
  languages, two jobs, and merging them would put SQL text and TypeScript
  branching in one module. They got a cross-reference instead.
- `home.ts` argued the pinned-order asymmetry in three near-identical paragraphs.
  The inline note at the `listSection` call pair stays — that is where a reader
  meets the two disagreeing arguments — and the other two are pointers at it.
- **Two tests asserted something other than what their names said**, and #78
  papered over both with a six-line caveat rather than renaming them. A test
  whose name has to be corrected by a comment is a test nobody trusts at a
  glance. Renamed; caveats deleted along with the need for them.

### The three conditional commits, and what they decided

The plan made three commits explicitly conditional with a stated escape hatch,
because _a duplication nobody has ruled on gets copied a third time by default_.
All three were measured rather than eyeballed.

- **The five view-model builders (A6): folded, four of five.** Covered above.
- **`tempDbPath` (B7): not moved.** The plan called `write`'s and `genre`'s
  copies byte-identical; they are not. `write` memoises one directory and
  returns many random filenames inside it; `genre` creates a fresh directory per
  call and returns a fixed filename; `db.test.ts` has a third shape again on
  `beforeEach`/`afterEach`. Three ownership models, three lifetimes. A shared
  helper would have to invent a fourth shape satisfying all three, which is
  forcing it, so it was dropped as the plan permitted.
- **Splitting `home.test.ts` (D3): not split.** 1339 lines before, **1269**
  after, against `browse.test.ts`'s 972 and `routes.test.ts`'s 1881. It is not an
  outlier, it now has one helper block instead of two 950 lines apart, and the
  plan was explicit: do not split it to hit a number.

### Known and deliberately not fixed

- **The dev seed's `lastWatchedAt` stamps are absolute dates**, written to the
  week they were authored. "The past few weeks" will age into "months ago" and
  eventually into something that reads as wrong. Harmless while nothing renders
  the timestamp — no screen does — and a trap the day something does.
- **`setResumePosition` still has no HTTP seam.** No route, no caller, until the
  player ships. That was #75's decision and this round did not revisit it; adding
  one now re-creates the dead-code shape two previous rounds refused.
- **Whether `markWatched` should preserve the resume position** stays flagged in
  the glossary for the watch-tracking grill. It changes stored values, which is
  the one thing this plan promised not to do.
- **`routes.test.ts`'s twenty-odd local helpers.** 1881 lines with a fixture
  builder per endpoint group — but those build _HTTP libraries_, not records. A
  genuinely different problem, and its own round if it earns one.

### Two features in a row have left almost nothing behind

Favorites left six undocumented decisions; Continue Watching left one accrued
debt and four comments doing a compiler's job. Both builds were preceded by a
`grill-me` that answered the hard questions in advance — nineteen of them here,
before a line was written — and both refactor rounds spent most of their commits
on scaffolding and prose rather than on repairing the feature. That is a result,
not a gap.

---

## 2026-08-29 — Favorites refactor (issue #73)

Nine commits in six groups against
`docs/refactor-plans/08-favorites-refactor.md`, plus a `test:`/`fix:` pair for
the defect the plan found while being written, which went first under its own
issue (74). 1600 tests pass across 97 files, up from 1593 across 96.

**Favorites left very little behind**, and the plan said so in advance rather
than manufacturing work to look substantial. The feature was assembled from a
column, a route, a client call, a query flag, a molecule and a chrome component
that all already existed; the build added one payload section, one component,
one `RowSection` prop and the wiring between them. So most of this refactor is
**decisions written down**, and two of the six groups were explicitly conditional
— one was taken, one was tried and reverted.

Nothing here changes an HTTP contract, a rendered pixel, or a stored value. The
one commit that changes what a component draws is the defect fix, which is why it
is a `fix:` under a different issue and not a group in this plan.

### The suite was green over a blank page

The browse home rendered **zero bytes of HTML** — no shelf, no heading, no
message — when the last movie on the Favorites shelf was un-hearted and the shelf
was the only populated section. The only way back was a reload.

`HomeRows`' empty guard counted the three sections' raw lengths. For two of them
that is right: `ContinueRow` draws a card per movie it was given, so "holds
nothing" and "draws nothing" are the same condition. **For the shelf they are
not.** `useHomeRows` deliberately never removes an un-hearted movie from
`favorites` — that indirection is what gives a refused save a card to put back,
and #71 shipped it on purpose — so a section of nothing but un-hearted movies has
a non-zero length and draws no cards. The guard read a populated library and
skipped all three messages.

Two general facts fall out of it, both larger than this feature:

- **#71's precedent has a cost nobody priced.** "A row whose rendered contents
  are a derived view of hook state" is a good pattern, and it is what makes the
  revert possible. But it silently breaks every other place that treats section
  length as a proxy for section content, and the guard was the only such place at
  the time. The next derived-view row inherits the same trap. The rule now has a
  name — `shelvedFavorites` — and both the row and the guard read it, so the two
  cannot disagree about what is on screen.
- **1593 passing tests are the specification of what was thought of.** Every
  existing test that empties the shelf serves populated genre rows beside it, so
  the guard was never the thing under test at the moment it mattered.

And the way it was found is worth recording: not by reading the diff, but by
asking what the guard's third term actually counts and then **running the case
rather than reasoning about it**. The reasoning alone produced "probably fine —
`favorites` is a favorites-only section". The run produced an empty document.

### What moved

**`saveFavorite` onto the rung built for it.** `src/api/postValue` exists
because of an argument the Ratings refactor made and wrote into its own
docblock — three saves across two features keep one contract, and neither feature
should import the other's wire. The rung was built and only `postValue` moved
onto it; `saveFavorite`, the one of the three actually called from both sides,
stayed in `features/library/api` with a comment in `useMovieDetail` apologising
for reaching across. **The comment was the tell.** An import that has to explain
itself is the one the shared rung was created to retire.

`saveWatched` and `saveRating` did **not** move. They have one caller each and
are correctly placed today; moving them for symmetry would be churn. The rule is
"a second feature asked for it", not "it looks like its siblings".

**The rung itself got written down.** `src/api/`, `src/App/` and
`src/test-support/` were all real, all undocumented, and both README and
CLAUDE.md still described an `src/` of eleven folders where there are fourteen.
A boundary that exists only in the code is one the next author is entitled to
guess at — and Group A doubled `api/`'s population, making it the answer to a
question the next feature will ask.

**One spelling for one concept.** The molecule rung said `onToggleFav` and the
feature rung said `onToggleFavorite`, so two call sites existed mainly to
translate between them. The prototype spells it both ways — `mol.PosterCard` and
COMPONENT-SPEC abbreviate, `page.MoviePage` and `FamilyFlix.dc.html` do not — so
it does not decide this and the glossary does. The 1:1 rule binds the UI surface,
not the prototype's identifiers, and COMPONENT-SPEC's prop table has been
overridden on the same reasoning once before.

**Two growth points closed.** The empty guard now reads over one list of what
the sections draw rather than a term per section in a chain of `&&`; and
`createHome`'s `listContinueWatching` and `listFavorites`, literal twins
differing by one flag key, collapsed into one `listSection(query, flag)`. Both
were places where forgetting to add something produces a visible bug — which is a
different risk from a place where copying two lines produces two correct lines.

**The deferred question, answered where it was asked.** `07-ratings-refactor`
named this feature, by name, as the place to decide whether the browse screens
migrate onto `useOptimisticEdit`. The answer is **no**, and it is written into
both hooks rather than only into a plan: a hook general enough for both would be
parameterised over what it edits _and_ over how it reverts, and neither caller is
asking for that. Unlike the three bargains `07` did merge, the second example
here is not a third copy of the first.

`useOptimisticSave` was also **wrong about itself**. Its docblock claimed `apply`
was `withFavorite` over genre rows _or_ `withFavoriteInList` over a flat grid;
since #71 its busiest caller writes both, into two sections of one payload inside
a single `setData`. The glossary was updated for that when the design log landed
and the hook was not — a reminder that a docblock arguing its own scope is a
thing that goes stale when the scope moves.

### Three copies of two closures, compared and kept

`GenreRow` and `FavoritesRow` build the same item object character for
character, and `LibraryGrid` writes the same two closures straight onto
`PosterCard`'s props:

```
onOpen: () => onOpenMovie?.(movie.id),
onToggleFavorite: () => onToggleFavorite?.(movie.id, !movie.favorite),
```

Three call sites is this project's own threshold for attempting a
generalisation, so it was attempted rather than declined on sight — written,
compiled, and run green — against the two bars the plan set in advance. **It
failed both, and was reverted.**

The helper was `posterCardItems(movies, onOpenMovie?, onToggleFavorite?)`.

- **A bag of optional handlers.** Every call site passed both handlers
  positionally and unlabelled. Nothing at the call site said what the second and
  third arguments were for, and the two rows ended up reading identically to each
  other while saying nothing about what a card can do.
- **It served the third call site by making it pretend to be the other two.**
  `LibraryGrid` has no carousel, and the extraction had it build a
  `PosterCarouselItem` and spread it onto a card. The two shapes share three
  field names by coincidence, not because they are one concept — and after the
  change the grid's JSX no longer named the props the card receives.

So the count that obliged the attempt is not the count that decides the outcome.
The two closures are the most legible lines in all three files — "open me", and
"save the opposite of what I am now" — and a reader who wants to know what a card
raises should not have to open a fourth file to find out. The extraction cost a
module, a test file and three imports to hide six lines that were never unclear.

Recorded here so the next reader is looking at a decision rather than an
oversight. If a fourth shelf arrives, this is the note to re-read — but a fourth
copy is not on its own an argument, since these three were not either.

### Deliberately not changed

- **`TITLE_SIZE` stays duplicated** in `GenreRow` and `FavoritesRow`. Both files
  carry a comment saying the value is passed explicitly because the difference
  between the three headings is specified in the prototype rather than
  incidental. Sharing the constant would overturn a written decision, not tidy an
  oversight.
- **`FavoritesRow`'s narrowing stays.** It reads like something to simplify and
  must not be: it is the only reason a refused save has a card to put back. The
  defect was in the guard, and fixing it by deleting the narrowing would have
  traded a blank screen for a broken revert.
- **`withFavorite` / `withFavoriteInList` stay two.** One concept over two
  shapes, with a docblock that already argues exactly that, and the pair is what
  makes the two-section edit expressible.
- **`Movie.isFavorite` beside `PosterCardMovie.favorite` stays.** Two spellings
  of two different things, both 1:1 with the prototype's `data-props`. Named in
  the plan and now in the glossary so it is visibly a decision and nobody
  "finishes the job" the rename started.
- **`NO_SECTIONS` stays one frozen value.** Held deliberately so a memoised
  consumer keeps its identity.
- **The write path was not reopened.** Route, `writeSignal`, `setFavorite`, the
  column and its partial index — untouched by the build and untouched here.

### Follow-ups this refactor surfaced

- **README's component shape is stale.** It documents a four-file component
  folder with a per-component `index.ts`; CLAUDE.md documents three files and
  only category barrels, and the code follows CLAUDE.md — no unit folder in
  `src/` has an `index.ts`. Found while amending the same section for `api/` and
  left alone, because rewriting a rung's documented shape is not a Favorites
  refactor. It is a docs-only fix and wants its own small issue.
- **`.claude/CLAUDE.md` is still gitignored**, so the `api/` / `App/` /
  `test-support/` amendment and the ✅ tick exist on disk and not in review.
  Open since `03-card-carousel-refactor`, surfaced again here, still a
  repository-policy question rather than a refactor one.
- **`GenreMovies` still prints two `act()` warnings.** They pre-date Favorites,
  the Ratings refactor noted and left them, and they belong to whoever refactors
  the genre screen. The suite is otherwise silent, which is the state `07` left
  it in deliberately.
- **Issue 67 — no route past the 15th favorite — was closed as not-planned** on
  2026-08-29, after the Favorites build entry below was written calling it open.
  The 15-cap's missing route now lives in the glossary's flagged ambiguities and
  nowhere else. A closed issue is not a decision that the gap does not exist; the
  gap wants a grill-me and a prototype amendment, which is exactly what a
  refactor is the wrong instrument for.

---

## 2026-08-29 — Favorites (issues #68–#72)

**The feature was already built.** `is_favorite` and its partial index and
`setFavorite` shipped in `01-library-core`. `POST /api/movies/:id/favorite` and
`saveFavorite` shipped with the browse grid, along with `PosterCard`'s corner
heart, `withFavorite`, `withFavoriteInList` and `useOptimisticSave` wiring it on
both browse screens. The detail page's heart arrived with `useOptimisticEdit` in
`07-ratings`. `RowSection` was written one feature ago carrying a docblock that
named what was coming: _"the prototype has a third of them coming (Favorites,
22px with a leading icon)"_. CLAUDE.md's "mark from card and detail" had been
done for months.

What did not exist was the shelf. Four build issues, #68–#71, each a `test:`
commit stopping at RED and a `feat:` commit taking it green. 1593 tests pass
across 96 files, up from 1531. Plan: `docs/PRDs/08-favorites-plan.md`.

No migration, no schema change, no new route, no new repository primitive, no
new primitive, molecule or util. One payload section, one feature component, one
`RowSection` prop, and the wiring between them. That is the rarest shape a
feature comes in here, and the reason it was possible is the rest of this entry.

### The flag that waited two months for its only caller

This is the thing about this feature worth remembering, and like the last one it
is a process fact rather than a code one.

`favoritesOnly` went onto `MovieQuery` and was honoured by `browse.listMovies`
in `ff0e97c` — `feat: [library-core] issue #4 add browse query layer`, 29 June.
Its first caller anywhere in the app is `home.ts:104`, in `33b7c7b`, 28 August.
**Two months less a day, six initiatives, and nothing ever called it.**

The design log records this as `02-browse-grid`'s doing (`08-favorites.md:20`),
which is where the flag's _type_ moved when `14ddc70` split the types into topic
files, not where the flag was born. Git says library-core. The log is an
immutable snapshot and stays exactly as written; the correction lives here, and
it makes the point larger rather than smaller — the wait was six initiatives,
not five.

**Why it survived instead of rotting.** A branch nobody calls is normally the
definition of dead code, and this one was not, for two reasons worth separating:

- It was **honoured and tested from the day it landed**. `browse.listMovies`
  applied it, and `curation.test.ts` has asserted the `favoritesOnly` set since
  library-core — a movie entering it when hearted, leaving it when cleared. So
  it was an uncalled branch with a specification, not an unexercised one.
- It was **built for a named future caller**, and the name was right. The row it
  was put there for is the row that eventually called it.

**Why it is still the pattern to watch for.** A flag with no call site is a
design guess that nothing can check. This one happened to be correct, and the
way we know it was correct is that #68 needed one function of four lines to cash
it in — `listFavorites`, the structural twin of `listContinueWatching`, the
caller's whole query spread first and then the flag. Had the guess been wrong,
nothing would have failed for two months; it would simply have been rewritten at
first use, and the two months of carrying it would have bought nothing.

So the rule this suggests is not "never build ahead of the caller". It is that
**building ahead is only free when the thing built is small, tested, and named
for the caller it is waiting on** — all three, not two of them. `RowSection`'s
icon slot passed the same test one feature later and cost one prop.

### What shipped

**One section on an aggregate that was built to take one** (#68). `HomePayload`
gains `favorites: Movie[]`, declared `continueWatching, favorites, rows` — the
order the screen renders them in. Named sections were chosen back in
`02-browse-grid` precisely so a section could join without disturbing the ones
already there, and this is the first time that is cashed in. `GET /api/home`
already forwarded the whole **Library query** and serialised what came back, so
it served the new section unchanged: the only edit to the route was a comment,
recording that the shelf rides this wire rather than an `/api/favorites` of its
own. Five frontend fixtures gained `favorites: []` to keep `tsc` clean — a type
ripple, not feature work.

The invariant that made it a four-line function is `getHome`'s own: spread the
caller's query first, then add only what makes this section that section. The
shelf obeys the search box, the genre dropdown, the rating pill and the sort for
the same reason the continue row does, and neither had to be taught to.

**The shelf** (#69). `FavoritesRow` is `RowSection` at 22px — a genre row's
size, not Continue Watching's 24 — around a poster `CardCarousel`, rendering
`null` when handed nothing. No "View all": the prototype's section has no
trailing action and `docs/handoff/` has no Favorites page behind one.
`useHomeRows` maps the section through the same `view()` a genre row's movies go
through rather than a mapper of its own, and `NO_SECTIONS` stayed one frozen
value with a third empty array on it, so a memoised consumer keeps its identity
across a render with nothing new in it. All three sections still come out of the
one `fetchHomePayload`, so the screen keeps its single ready transition.

`HomeRows`' empty-library guard gained its third term in the same commit. A
**watched, untagged** favorite earns no genre row and no resume tile, so without
it the screen would have printed "Your library is empty" directly above a
populated shelf.

**The heart in the heading** (#70). `RowSection` gains one optional `icon` prop,
dropped into the heading ahead of the title and coloured by nobody; `Title`
becomes inline-flex with a 10px gap, inline-level so `Header` keeps a baseline
for a genre row's "View all" to sit on. The accent lives in
`FavoritesRow.styles.ts` for `currentColor` to pick up, along with the
prototype's 2px optical nudge. `RowSection` references no hearts, no favorites
and no accent anywhere, docblocks included — the promise its docblock made when
it was extracted, kept at the first opportunity to break it.

**Pruning the shelf** (#71). `FavoritesRow` takes `onToggleFavorite` and hands
back the clicked movie's id with the negated value — the same contract a genre
row's cards already use — and renders `movies.filter((m) => m.favorite)` rather
than everything it is handed. `useHomeRows` applies the flag to both sections
inside one `setData`. Three files, no new hook, no new signature.

### The two precedents #71 set

Both are small, both are about the same click, and the next shelf will follow
them rather than rediscover them.

**One optimistic edit reaching two sections of one payload, in a single
`setData`.** `applyFavorite` runs `withFavorite` over the rows _and_
`withFavoriteInList` over the favorites in one update, so the shelf card and
every genre card of one film move on the same render. Two cards of one film
telling a parent different things is not a state we ship, and "the same render"
is the only version of that guarantee worth having — one behind the other is
still a frame in which they disagree. `useOptimisticSave` is called exactly as
before; nothing about the bargain changed, only how many places `apply` writes.

**A row whose rendered contents are a derived view of hook state.** The hook
never removes a movie. An un-favorited film stays in the `favorites` section with
its flag false, and the row filters it out on render. That indirection is what
makes the revert possible: `useOptimisticSave` puts the old value back by
flipping the flag, and a movie spliced out of state has nothing to flip. So the
card leaves the shelf the instant the heart empties — a shelf called Favorites
holding a non-favorite is a lie — and comes back if the save is refused.

It is worth naming because it reads backwards. A list called `favorites`, then
filtered for favorites, looks like something to simplify away, and the empty
guard reads the _filtered_ list for the same reason — a shelf handed only
non-favorites renders nothing rather than a heading over an empty carousel.
Anyone who deletes the filter will find every test still green except the
refused-save ones, which is exactly the shape of a change that gets merged.

### Worth naming

**The heading was naming itself out of its own children, and the heart leaked
into it.** #70's RED tests pinned the region's accessible name using a mark that
carried visible text, and six of them failed on the leaked glyph. The heading
now names itself from `title` via `aria-label` rather than from its content.
Callers are still asked for a hidden mark — `HeartIcon` with no `title` renders
`aria-hidden` — but the guarantee no longer rests on their remembering to, and
the label repeats the visible text exactly so voice control still matches the
words on screen. The alternative, an id-bearing span around the title text, is
ruled out by the test asserting the heading has no element child when no icon is
passed.

The general shape: a slot that accepts arbitrary caller content cannot also
derive its name from its content. Adding the slot is what turned a safe pattern
into an unsafe one, and the tests caught it because they were written against a
mark with text in it rather than against the icon that was actually coming.

**A prop named for the issue that would delete it.** #69 shipped the shelf with
its hearts drawn but inert, because `PosterCarouselItem` requires a handler.
Rather than making the prop optional or leaving a bare `() => {}`, the row
passed `NO_TOGGLE`, named for the issue that would replace it. #71 deleted it. A
placeholder that says when it expires is cheap; the version of this that rots is
the anonymous no-op.

**Three tests green on arrival, reported as guards.** #71 landed 22 tests of
which 19 were RED, and the commit says which three were not and why: keyboard
parity on the heart, the optional toggle callback, and no refetch on a toggle.
All three are ACs the issue asks for that earlier work already satisfied —
`PosterCard` has stopped activation keys propagating since it shipped, and
`useBrowseLoad` reloads on the load key alone. Breaking working components to
manufacture a RED would have been a lie about what the phase owed. Same call
Ratings made at #59 and #60, made the same way.

### Deliberately not built

- **A "View all" and a Favorites page behind it.** The prototype has neither,
  and CLAUDE.md's rule is that the prototype is amended in a grill-me first.
  Filed as **67** and still open: past the 15th favorite there is no route in the
  app, and a genre row's identical cap is safe only because "View all" exists.
  Recorded as a prototype gap, not improvised around mid-build.
- **A favorites filter pill, a `/favorites` route, `favoritesOnly` in a Library
  query.** Favorites is a shelf, not a filter. The flag exists on the
  repository's `MovieQuery` only, where `getHome` sets it — nothing a URL can ask
  for.
- **A `/api/favorites` endpoint.** A second request for one screen is what
  `/home` was built to avoid.
- **A Favorites skeleton.** `LoadingRows`' three skeleton sections already stand
  in for the whole body, and the prototype has no favorites-shaped placeholder.
- **Per-person favorites.** One shared household profile, permanently.
- **Any cross-screen store.** A heart set on one screen reaches the others on
  their next load, as it already did.

### The row this feature did not tick

Favorites stays **🔜 Planned** in both feature lists. The standing rule is that a
feature is Done after steps 7–8 of the workflow — `request-refactor-plan` →
`refactor` — not when its build issues close; `813b546` reverted exactly such a
premature tick on Search + Filter, and the genre page and Ratings both waited the
same way. The refactor issue is filed as **73**, and the tick is its last commit.

Issue 67 does not block that tick. It is a prototype amendment rather than a
refactor, and the plan for 73 says so explicitly so that neither swallows the
other.

The glossary needed no rewriting here. **Favorites row**, **Home section** and
**Row section** were added and **Favorite** and **Home payload** amended when the
design log landed, ahead of the build, and what shipped matches them — including
the two entries that are easiest to drift: the **Optimistic save** entry that now
describes one edit reaching every **Home section** a movie has a card in, and the
flagged ambiguity recording that what the row renders is not what its section
holds. Confirmed rather than rewritten, which is the outcome writing the glossary
first is supposed to produce.

---

## 2026-08-27 — Ratings refactor (issue #65)

Twenty commits in six groups, against
`docs/refactor-plans/07-ratings-refactor.md`. Ratings shipped working and left
behind **the third copy of three different bargains** — the optimistic write, the
wire contract, and the single-signal write route. The plan's argument was that
two examples are not enough to design a generalisation against and three are, so
this cashes that in three times rather than once. All three are written once now.
1511 tests pass, up from 1478.

Nothing here changes an HTTP contract, a rendered pixel, or a stored value. The
1478 existing tests were the specification, and no test file was edited to make a
refactor commit pass — the two that were touched were touched to stop them
printing warnings, before any production code moved.

### The suite was green and noisy, which is worse than it sounds

`vitest run` printed eight `act()` warnings while passing, seven of them this
feature's: four in `RatingPicker.test.tsx`'s `Enter and Space` block, two in
`MovieDetail.test.tsx`'s rating focus tests. One cause for all seven — a raw
`segment(n).focus()` fires the picker's `onFocus`, which sets the **Rating
preview**, which is a React state update outside `act()`. The neighbouring
watched/favorite focus tests do not warn because those buttons have no focus
handler that writes state.

Worth naming as a shape: `@testing-library/user-event` arrived at #60 and the
file uses it correctly in its tab-order tests (`await user.tab()`), then reaches
around it four tests later. **A dependency half-adopted inside one file is the
version of this that is hardest to see**, because the correct idiom is right
there in the same describe block. The fix was the file's own existing `act()`
idiom, not a new one.

This went first so every later group could use "the suite is silent" as its
check rather than "green apart from the known seven". A suite that prints
warnings while passing is a suite where the next real `act()` warning arrives
pre-camouflaged.

`GenreMoviesProvider` still warns twice. It pre-dates Ratings, it is noted in the
commit body that left it, and it belongs to whoever refactors that screen next.

### The favorite route had no tests at all

Not in the plan, found one commit before it mattered. `POST /movies/:id/favorite`
was the only one of the three single-signal writes with **no test at the route
layer** — its two siblings have five each, including the 404-before-write check.
It shipped with the browse shelf's heart in `02-browse-grid` and was never
covered here.

That is the wrong state to be in one commit before all three routes move onto a
shared helper, since "the existing tests are the specification" is the entire
safety argument of this refactor and for that route there were none. Five
characterisation tests went in first, asserting only what the route already did.

**The general shape:** a duplication audit finds missing coverage, because the
thing that makes three copies hard to see — that they are spread across files
nobody reads together — is the same thing that lets one of them go untested. The
sibling routes' tests made the gap look filled.

### What shipped

**One half-star number.** `StarRating` and `RatingPicker` both rounded a percent
to the nearest half star and printed it to one decimal. It was the only
arithmetic in the feature with no test of its own on either side — covered only
through two components' render assertions — and the seam where a rounding change
on one side leaves two controls on the same page disagreeing about what 70% is
called. `src/utils/toStarLabel/` is that rule once, with a table pinning every
half-star point and the ties between them. Both components' rendered output is
byte-identical and neither's tests changed.

**One optimistic bargain** (closes 64). `useOptimisticEdit(movie, editMovie)`
returns a runner each write describes itself to — `next`, `capture`, `apply`,
`restore`, `save`. The reconcile and the revert are written once. The rating
moved first, deliberately: widest value set, and the one restore
`useOptimisticSave` could not express, so a hook that could not hold it would
have failed at the first call site rather than the third. It held.
`useMovieDetail.test.ts` and `MovieDetail.test.tsx` both pass unmodified.

`useOptimisticSave` survives unchanged and stays boolean. Two hooks, two shapes:
it reverts by negating a flag and addresses a movie **by id inside a list**,
where this one is told what to put back and edits **the one movie a page holds**.
Whether the browse screens ever migrate is a Favorites question.

**One wire contract.** `postValue` at `src/api/` — a new shared rung, following
`test-support/`'s precedent of a top-level folder with no barrel. Three saves
across two features kept the same contract, and `useMovieDetail` was already
reaching into `features/library/api` for `saveFavorite` with a comment
apologising for it; the shared rung is where that import had been pointing all
along. The echo guard is a **parameter**, because "a `null` echo is a cleared
rating" is a per-route fact — true of the rating route, nonsense from a flag
route — and inspecting the value's type to decide would make one route's rule
everybody's. That distinction had been defended by a comment in one of three
copies; it is an argument now, with a test either side of it.

The three near-identical throw messages collapsed into `POST ${endpoint} failed:
${status}`, which is the idiom `fetchMovie` and `fetchHomePayload` already use
and names the request that failed. No test asserted the old wording.

**One single-signal write.** `writeSignal` holds lookup → 404 → mutate → echo.
Validation is deliberately **not** in it: the three routes genuinely disagree
about what a valid body is, and the rating's disagreement — a missing `value` key
is a 400 rather than a clear — guards the one write that erases data. Each route
now reads as its validation and its mutation and nothing else.

The argument for this one was never volume. Three routes of ten lines is not much
duplication; the point is that the 404-before-write check is a **correctness
rule** — never write to a movie that is gone — that was written four times in one
file, character for character, and upheld by everyone having remembered to paste
it. That is the class of duplication where the fourth author forgets and nothing
fails loudly.

### Where the plan was wrong, twice

**E1 could not be its own commit.** The plan called for the route helper to land
with its own test, RED first. But its own Testing Decisions section says the
helper is tested _through the router_ with a fake `LibraryStorage`, which is the
only place a route helper's behaviour is observable — so there is no RED to write
that `routes.test.ts` does not already have. A helper committed alone with no
caller leaves an unused-vars warning in a tree the plan requires to lint clean.
E1 and E2 landed together, which is why this is twenty commits and not the
sixteen the plan counted.

**E5 answered itself the other way.** Its condition was "if the helper leaves
`routes/index.ts` meaningfully thinner, extract it to its own folder". It does
not — the file went from 398 lines to 416, because the correctness rule costs
more to explain once than it did to paste three times. The one-folder-per-unit
trigger is companion files, and a helper tested through the router has none.
Both halves point the same way, so `writeSignal` stays local, with the reasoning
written next to it the way `isMovieSort`'s already is.

### Deliberately not done

- **The two star strips do not merge.** The prototype has them differing exactly
  as the code does — `.22` against `.2` on the dim glyph, `--color-text-faint`
  against `--color-text-dim`, a 6px root gap against 14px, a value scaled at
  `size * 0.86` against a fixed 14px. Unifying them is a redesign wearing a
  refactor's clothes, and the rule is that the prototype gets amended in a
  grill-me first or not at all. The shared _arithmetic_ moved; the pixels did not,
  because they are not shared.
- **The raw `rgba(255, 255, 255, …)` literals stay.** 1:1 translations of inline
  prototype values, no token exists for them, and eight style modules already do
  this. A codebase-wide question, not a Ratings one.
- **`parseMinRating` still exists twice** with two different contracts — an
  allow-list of the dropdown's cut-offs in `src/utils/`, a 0–10 range check local
  to the route layer. Both correct, the separation deliberate per the
  `isMovieSort` precedent. Only the shared _name_ is unfortunate, and it reads
  fine until someone greps for it. Left alone; worth a follow-up if it ever bites.
- **`toRatingPercent` / `toRatingUnits` stay two functions.** Pinned against each
  other in both directions already, and collapsing an inverse pair into one
  parameterised function makes the `null` case — the one that must not round —
  harder to read.
- **The picker still speaks percent.** A `components/` unit knowing the stored
  0–10 scale is the boundary the build spent a paragraph avoiding; the conversion
  stays at the `useMovieDetail` seam.
- **No cross-screen rating store, no snackbar, no retry.** Unchanged by anything
  here.

### The row this feature finally ticks

Ratings goes ✅ in README.md and `.claude/CLAUDE.md` with this refactor, closing
issue 63's last acceptance criterion. That criterion was written against 64
specifically, which was the only refactor issue filed at the time — but a feature
is Done after workflow step 8, and step 8 is all of this, not just Group C.

---

## 2026-08-26 — Ratings (issues #57–#63)

The stars have been on screen since `02-browse-grid` and unreachable that whole
time. Thirteen pixels on every **Poster card**, twenty on the **Movie detail
page**, a `4+ stars` **Minimum rating** pill, a `highest-rated` **Sort order** —
and no route, no client call, and no control anywhere that a person could click.
Every rating in the database got there through the dev seed. Six build issues,
#57–#62, each a `test:` commit stopping at RED and a `feat:` commit taking it
green, plus the prototype amendment ahead of all of them. 1478 tests pass, up
from 1352. Plan: `docs/PRDs/07-ratings-plan.md`.

No schema moved and no migration ran. The column has been
`rating INTEGER CHECK(rating BETWEEN 0 AND 10)` with `NULL` meaning **Unrated**
since `01-library-core`, and `storage.setRating(id, units | null)` has been
sitting in the `curation` slice beside `setFavorite` for the same six features.
What this feature built is the path from a click to that mutator, and the
honesty to stop pretending an absence is a zero on the way.

### The project's first prototype amendment

This is the thing about this feature worth remembering, and it is a process fact
rather than a code one.

`page.MoviePage.dc.html` rendered `prim.StarRating`, display-only. The
prototype's only **Rating picker** lives inside `feat.MovieForm` — a 🔜,
unscheduled maintainer screen. So the prototype, read literally, says a
**Rating** is something the maintainer sets in a form that does not exist, while
README and CLAUDE.md both file Ratings under **Browse & discover
(parent-facing)** and `setRating`'s own sibling `setFavorite` is settable from
the detail page today.

CLAUDE.md's rule for this case is exact: "If something seems wrong, raise it in
the grill-me session and amend the prototype first, then build to the amended
prototype." That is what happened, and the commit order is the evidence —
`f8b8f5b` amends `page.MoviePage.dc.html` and `COMPONENT-SPEC.md`, and `8a14170`
is the first line of implementation, after it. Nothing in `src/` or `server/`
moved until the spec said what was being built.

**The precedent is the sequence, not the outcome.** _Raise it in grill-me, amend
the prototype, then build to the amended prototype_ — never _build something
different and reconcile the prototype later_. The second order is how "the
prototype is the spec" quietly becomes "the prototype is where we started",
which is exactly the failure that CLAUDE.md section exists to prevent. The
amendment itself is small — one `dc-import` swapped, one row in
`COMPONENT-SPEC.md`'s page table, two prop tables widened — and its size is the
point: an amendment that has to be argued for and committed on its own is cheap
when it is honest and expensive when it is a redesign in disguise.

The reasoning is on the record in `07-ratings.md` Q2 rather than here, so the
next amendment has a shape to copy rather than a precedent to infer.

### Two deferrals closing, both as deferred halves arriving

Neither of these is a reversal, and it matters that the journal says so. Both
questions were answered correctly for the app as it stood, and both named this
feature as the successor that would change the conditions.

**`04-movie-detail` Q10 — the hidden Meta segment.** An **Unrated** movie showed
no rating **Meta segment** at all, treated as a missing segment under Q9's
interleaving rule. The reason was sound: with `showValue`, five empty stars
print `0.0`, and that is the household asserting it watched the film and scored
it nothing — the opposite of nobody having said anything. Q10 wrote down what
would change it, in those words: "an 'unrated, tap to rate' state wants the
affordance that acts on it." The affordance is here. Empty stars that are
visibly an input, labelled `Not rated`, read as an invitation rather than a
verdict, so the segment comes back and stops being omissible (#62). The movies
most in need of a rating had been precisely the ones offering nothing to click.

**`02-browse-grid` Q10 — unrated as zero on the card.** That log mapped `null` →
0 stars and flagged it in the same sentence as "visually identical to a real 0",
and `ubiquitous-language.md` has carried it as an open ambiguity ever since, to
be "revisit[ed] with the **Ratings** feature". Resolved at #61 by splitting the
tile's two halves rather than choosing between them: the **star row stays**,
because it is fixed furniture in a fixed-height tile and dropping it would leave
cards in a carousel row at uneven heights — which is why Q10 deferred rather
than solved — and the **numeric value goes**. **Unrated** reads `★★★★★`; a movie
scored nought reads `★★★★★ 0.0`.

Both are marked resolved in the glossary rather than deleted from it. The older
design logs still describe the old rules and are left exactly as written.

### What shipped

**One route, the third of a set.** `POST /api/movies/:id/rating`, body
`{ value: number | null }`, echoing `{ value }` — the same shape, the same
404-before-write check and the same echo-is-truth bargain as `/favorite` and
`/watched`. Deliberately not `PATCH /movies/:id`: `updateMovie` is the _form's_
path, it refreshes `updated_at`, and a newly scored 1974 film jumping to the top
of a `recently-added` shelf is the kind of bug nobody would think to look for.
`setRating` is a single-column write and stays one.

**The accepted set is an allow-list, and that is load-bearing.** "Exactly `null`,
or an integer 0–10", not `typeof value !== 'number'` → reject. The second test
lets every non-numeric value through as a clear, and a clear is the one write
that erases data. A body with **no `value` key** is a 400 rather than a clear,
for the same reason: a malformed request and a deliberate `null` must not be the
same wire message.

**`null` is carried, never re-derived.** Four types widened from `number` to
`number | null` — `StarRatingProps.rating`, `PosterCardMovie.rating`,
`toRatingPercent`'s return, and `RatingPickerProps.value`. **Unrated** stopped
being a `value > 0` test at four separate rungs and became a value the whole
path carries. `toRatingPercent` losing its flattening is what forced the rest,
and `view()` needed no code change at all once it went — it had always forwarded
what the mapper handed it. `detailView`'s `movie.rating === null ? null : …`
collapsed to a plain call in the same pass.

**`toRatingUnits` is a util with a test, not an inline `/ 10`.** The pure inverse
of `toRatingPercent`, and the one place the component layer's percent scale meets
the domain's stored units. It exists as its own unit because the `null` case must
not round: erasing a rating and scoring a movie nothing are two different facts,
and a `/ 10` written inline is one keystroke from conflating them. The two are
pinned against each other at every half-star point in both directions.

**The molecule speaks percent in both directions.** `RatingPicker` takes and
emits 0–100, exactly as `StarRating` does. A `components/` unit that is meant to
know nothing about the domain must not start speaking in the 0–10 the column
happens to store, so `useMovieDetail` converts at the seam and nothing below it
ever sees stored units.

**Ten `<button>` segments where the prototype had ten `<div onClick>`.** The
pixels are the prototype's exactly — each star is a span carrying the glyph and
its clipped accent fill, with two 50%-wide segments laid over it — and the hit
areas are real elements with real semantics. Every segment names the rating it
would set, worded grammatically rather than uniformly (`Rate ½ a star`,
`Rate 3½ stars`, `Rate 1 star`), because a parent would otherwise hear "Rate 1
stars". The strip arrives as a `role="group"` called "Your rating" rather than as
ten pieces of loose furniture. Same trade `prim.Toggle` already made with
`role="switch"`: identical pixels, honest semantics.

**Clearing is click-the-current-segment.** No X, no second control, no copy the
prototype does not contain — the same "click it again to turn it off" grammar the
favorite heart and the watched tick already use. It is also the only undo a
mis-click has until MovieForm ships. The segment holding the current value
announces `Clear rating` instead of a rating, so the grammar is spoken rather
than guessed at.

**The Rating preview never leaves the molecule.** Hover and focus preview the
same fill, the label keeps reading the _stored_ value throughout, and nothing
outside the component ever sees an uncommitted rating — so a hover can never look
like a rating that took. The blur is read on the strip rather than on each
segment, because moving between segments inside it is not leaving.

**The seed grew a pair.** `Cold Open` (Action, `rating: 0`) sits beside
`Havoc Line` (Action, unrated) so the two share a shelf row. Phases 3 and 4 exist
precisely to tell those two apart, and without fixtures the distinction was
provable in unit tests and invisible in the running app — which is the one thing
CLAUDE.md says the seed is for. It goes in through the ordinary `LibraryStorage`
interface under the reserved prefix, so a re-run stays idempotent.

### The known cost, taken deliberately

`useMovieDetail` now holds **three** hand-rolled optimistic writes — the watched
tick, the favorite heart and the rating — each keeping the same bargain by hand:
capture what the click cost, apply the new value at once, reconcile against the
route's echo, put the captured value back if the save is refused, all routed
through the `editMovie` guard so a response landing after the page has moved on
is discarded rather than resurrecting a movie the state let go of.

`useOptimisticSave` could not take the third. It is boolean-only by explicit
design and its own comment named this arrival a feature ago: "a save with more
than two values … has to be told what to put back." A rating has eleven values
plus an absence, and `!value` cannot express any of it.

So the duplication is real and it is filed rather than fixed:
**`useOptimisticEdit(previous, apply, save)`**, against all three writes. The
reason for filing rather than generalising mid-build is worth stating plainly —
**two examples were not enough to design the generalisation against, and three
are.** The `04-movie-detail` refactor looked at two and correctly declined; the
genre-page refactor looked at the boolean pair and extracted exactly the boolean
case, no wider. Guessing the shape from two would have produced a hook the third
write then had to be bent into. The cost of waiting is one build cycle carrying a
third copy, which is cheap and visible; the cost of guessing early is an
abstraction nobody can change afterwards.

### Worth naming

**The suite took its first new dependency.** `@testing-library/user-event`, at
#60. jsdom does not synthesise a click from Enter or Space on a `<button>`, so
"the segments activate from the keyboard" is otherwise untestable, and a real tab
walk is what the accessibility AC actually asks for. Recorded because a test
dependency arriving is worth one line in a journal — the next one should have to
justify itself the same way.

**Tests that were green on arrival, reported as green.** Both #59 and #60 landed
tests that passed the moment they were written: tab reach and Enter/Space were
already delivered by #59 promoting the hit areas to real buttons, and several
"still works" clauses restated behaviour an earlier phase had satisfied. The
alternative was breaking the component to manufacture a RED, which would have
been a lie about what the phase owed. They land as regression guards instead, and
the commit messages say which ones and why. A RED phase is a specification
device, not a quota.

**A phase boundary that was visible in a test, and then wasn't.** #59 made the
picker able to clear a rating, but the **Meta line**'s rating segment was still
conditional on a rating existing — so a cleared rating lost its segment rather
than showing `Not rated`. `MovieDetail`'s assertion was narrowed to what that
phase actually owed (no `0.0 / 5` on screen, no segments left, `{ value: null }`
on the wire), and the retraction restored the full claim at #62. The narrowing is
in `5845a4c`'s message with the reason attached, which is what stops a later
reader taking it for a weakened test.

**The picker cannot write a literal `0`.** Its smallest click is half a star, so
`0` arrives only from a TMDB-seeded import. When a person clears, they mean
**Unrated** — the same asymmetry **Minimum rating** already documents, where an
**Unrated** movie shows five empty stars but is excluded by any floor rather than
behaving as a zero.

### Deliberately not built

- **Rating from a Poster card.** The prototype gives the card a heart and nothing
  else, and ten **Half-star segments** on a 210px tile is a mis-click hazard on
  the screen the parents use most.
- **A snackbar when a save is refused.** The snackbar system is its own 🔜
  feature. The revert is the feedback, exactly as it is for the heart and the
  tick.
- **Any cross-screen store.** A rating set on the detail page reaches the browse
  grid on its next load, as **Favorite** and watched already do. Nothing here
  introduces a cache that would let a poster card restyle itself without a
  reload.
- **TMDB seeding and MovieForm's rating field.** Those belong to import-export
  and movie-form respectively. `RatingPicker` lands fully built and tested, so
  MovieForm consumes it later with no rating work of its own.

### The row this feature did not tick

Ratings stays **🔜 Planned** in both feature lists, and issue #63 asks for it
ticked. The standing rule is that a feature is Done after steps 7–8 of the
workflow — `request-refactor-plan` → `refactor` — and not when its build issues
close. `813b546` reverted exactly such a premature tick on Search + Filter, and
the genre page waited the same way one feature ago. The `useOptimisticEdit` issue
is filed; the tick is a separate docs commit once it closes.

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
