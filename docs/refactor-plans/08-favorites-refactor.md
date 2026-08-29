# 08 — Favorites refactor

Follows the build in issues #68–#72. Six items, and the first of them is a
question `07-ratings-refactor` deferred to this feature **by name**: _"Whether
the browse screens later migrate is a question for the Favorites feature, which
CLAUDE.md already assigns both surfaces."_ Favorites has now shipped, so the
question is answerable rather than open.

Several of the six are small on purpose. They are here because the alternative
to arguing them is leaving them to be re-noticed by whoever builds the next
shelf, and a duplication nobody has ruled on gets copied a third time by
default.

**One thing found while planning is not a refactor item at all.** The browse
home can render completely blank — no shelf, no message, no copy — and that is
a defect, filed separately as **74** and fixed first. It is described below
because it changes what one of these commits is allowed to assume, not because
this plan fixes it.

## Problem Statement

Favorites works, the suite is green at 1593 across 96 files, and the feature
list still says 🔜. Unlike Ratings, this feature left behind almost no new
duplication — it was built out of pieces five earlier initiatives had already
placed, and the build reopened none of them. What it left instead is **six
decisions nobody has written down**, three of which are about whether something
written twice should be written once.

### 0. The empty guard reads what the sections hold, not what they render — and the screen goes blank

This is a defect, verified rather than reasoned about, and it is filed as its
own issue, **74**. It is item zero because it lands on the same three lines
Group D wants to rewrite, and a refactor that generalised the guard without
knowing this would carry the bug forward inside a tidier expression.

`HomeRows` guards the empty-library message on the three sections' raw lengths:

```
rows.length === 0 && continueWatching.length === 0 && favorites.length === 0
```

For two of the three that is exactly right — `ContinueRow` renders `null` on an
empty list, so "holds nothing" and "draws nothing" are the same condition.
**For the shelf they are not.** `FavoritesRow` renders
`movies.filter((m) => m.favorite)`, and the hook deliberately never removes a
movie from the `favorites` section — that indirection is what gives a refused
save a card to put back, and #71 shipped it on purpose.

So a section holding only un-hearted movies has a non-zero length and draws
nothing. The guard sees a populated library, skips every message, and the three
rows each render `null`.

**Reproduced, not inferred.** A library whose only matching movie is a watched,
untagged favorite — the exact fixture #69 added for the guard's third term — and
one click on its heart. Rendered output: **0 bytes of HTML.** An empty
`container.innerHTML`, no heading, no "Your library is empty", nothing. The
parent's browse home is a blank page, and the only way back is a reload.

It is narrow but reachable, and a search or a rating filter narrowing to that
same set reaches it too. It is also precisely the bug #69's acceptance criterion
existed to prevent, arriving through the back door: the term was added to stop
the message showing over a populated shelf, and it now stops the message showing
over an empty one.

The existing suite does not catch it. Every test that un-hearts the last
favorite serves populated genre rows alongside it, so the guard is never the
thing under test at the moment the shelf empties.

### 1. The deferred question comes due, and the hook that raised it is now wrong about itself

`useOptimisticSave` and `useOptimisticEdit` are two hooks keeping one bargain.
The Ratings refactor built the second, kept the first, and named this feature as
the place to decide whether the browse screens migrate.

That decision is now makeable, and the evidence moved while nobody was looking.
`useOptimisticSave`'s docblock argues its own scope like this:

> `apply` is what writes the value into whatever the screen is holding …
> `withFavorite` over genre rows and `withFavoriteInList` over a flat grid are
> the same bargain over two shapes.

Since #71 that is no longer what its busiest caller does. `useHomeRows`'s
`applyFavorite` writes into **two sections of one payload inside a single
`setData`** — `withFavorite` over the rows _and_ `withFavoriteInList` over the
favorites — which is neither of the two shapes the docblock enumerates. The
glossary's **Optimistic save** entry was updated for this when the design log
landed; the hook's own comment was not.

So the hook is under-describing what it already serves, and the question of
whether it should exist at all has an answer in the codebase that nothing
states.

### 2. `saveFavorite` never moved to the rung that was built for it

`src/api/postValue/postValue.ts` exists because of an argument the Ratings
refactor made, written into its own docblock:

> This lives above `features/` because three saves across two features keep the
> contract — the detail page's watched flag and rating, and the shelf's favorite
> heart — and **neither feature should be importing the other's wire**.

The rung was built and only `postValue` moved onto it. `saveFavorite` is still
in `src/features/library/api/api.ts`, and `useMovieDetail` still imports it
across the feature boundary — with a comment apologising for doing so:

```
// `saveFavorite` lives with the browse shelf because that is where the heart
```

The comment is the tell. An import that has to explain itself is the one the
shared rung was created to retire, and the reasoning is already written down —
it was just applied to the helper and not to the caller that motivated it.

Favorites is what makes this worth doing now rather than later: `saveFavorite`
has three call sites across two features (`useHomeRows`, `GenreMovies`,
`useMovieDetail`), where `saveWatched` and `saveRating` have one each.

### 3. The rung it moves onto is in no document

`src/api/` is not in CLAUDE.md's **Folder Structure**, not in its **Layer
Responsibilities** table, and not in README's tree. Neither are `src/App/` or
`src/test-support/`, which are also real and also undocumented. Both documents
still describe an `src/` of eleven folders; there are fourteen on disk.

That was survivable while the rung held one function nobody had to find. Group A
doubles its population and makes it the answer to "where does a save that two
features call live?" — a question the next feature will ask, of a folder whose
rule is written nowhere. A boundary that exists only in the code is one the next
author is entitled to guess at.

The catch worth naming: **`.claude/` is gitignored in its entirety**, so the
CLAUDE.md half of this edit is on-disk only and invisible to review. README's
tree and its Atomic Design table are the tracked copy, and they carry the same
amendment. (Whether the project's own instructions should be tracked is an open
question from `03-card-carousel-refactor` and is not reopened here.)

### 4. One concept, two spellings, and two hops that exist to translate between them

The glossary's term is **Favorite**, with "liked, starred, bookmark" recorded as
rejected synonyms. In code, the molecule rung abbreviates it and the feature
rung does not:

- `PosterCard` takes `onToggleFav`, and styles it with `FavButton` and
  `FAV_SIZE`.
- `CardCarousel`, `LibraryGrid`, `GenreRow`, `FavoritesRow`, `HomeRows` and
  `GenreGrid` all say `onToggleFavorite`.

Because the two disagree, two call sites exist mainly to translate:
`CardCarousel` passes `onToggleFav={item.onToggleFavorite}`, and `LibraryGrid`
does the same rename inline. A prop that has to be renamed on the way through is
the shape of a name that was never settled.

**The prototype does not settle it, because the prototype does both.**
`mol.PosterCard` and COMPONENT-SPEC say `onToggleFav`; `page.MoviePage` and
`FamilyFlix.dc.html` say `onToggleFavorite`. This is exactly the case CLAUDE.md's
1:1 rule already anticipates — the prototype is the source of truth for _what
the UI is_, and COMPONENT-SPEC itself flags its own prop table as an authoring
shortcut where our conventions should win ("In code, make it composable…", and
the `IconButton` `label`/`title` split that `02-browse-grid-refactor` already
took over the spec's single `title`). The pixels are 1:1 already and stay so;
only the identifier moves.

### 5. Three shelves build the same two closures

`GenreRow` and `FavoritesRow` both do this, character for character:

```
const items: PosterCarouselItem[] = <movies>.map((movie) => ({
  movie,
  onOpen: () => onOpenMovie?.(movie.id),
  onToggleFavorite: () => onToggleFavorite?.(movie.id, !movie.favorite),
}));
```

`LibraryGrid` writes **the same two closures** against `PosterCard`'s props
directly rather than into an item object, and `ContinueRow` does the `onOpen`
half of it for a `ContinueCarouselItem`.

This corrects the count the first draft of this plan carried. The **item
object** is written twice. The **closure pair** — id out, negated flag out — is
written three times, and this project's own rule, argued at length in `07`, is
that two examples are not enough to design a generalisation against and three
are. So the rule now triggers, and the item is in scope to be **tried and ruled
on** rather than declined on sight.

The neighbouring `TITLE_SIZE = 22`, duplicated in `GenreRow` and `FavoritesRow`,
is **not** part of this. Both files carry a comment saying it is passed
explicitly because the difference between the three headings is specified in the
prototype rather than incidental. Sharing that constant would overturn a written
decision, not tidy an oversight.

### 6. Two places a fourth shelf has to be added by hand

Adding the Favorites section touched two spots that will need touching again in
exactly the same way, and neither announces that:

- **`HomeRows`' empty guard** grew its third term. A section that joins and is
  not added here prints "Your library is empty" over a populated shelf — and,
  per item 0, a section that draws less than it holds breaks it the other way.
- **`createHome`'s section builders.** `listContinueWatching` and
  `listFavorites` are literal twins differing by one flag key. `getHome`'s own
  docblock already describes the pattern in prose — "every section is a
  composition of the two existing browse queries" — while the code writes the
  composition out once per section.

### What is _not_ wrong

- **The write path.** The route, `writeSignal`, `setFavorite`, the column and
  its partial index were not reopened by this feature and are covered on both
  sides. Nothing here touches them.
- **The prototype's pixels.** Checked against `docs/handoff/` line by line: the
  shelf's 22px serif heading, the 20px accent heart with its 2px optical nudge,
  the 10px gap, the section's `--space-7` bottom margin and `--space-6` inset,
  the absent "View all", the order Continue → Favorites → genres, and
  `PosterCard`'s 34px corner heart with its accent fill, white outline,
  `rgba(18,14,10,.5)` ground and `.82` hover. All 1:1. **No pixel in this plan
  moves.**
- **`Movie.isFavorite` beside `PosterCardMovie.favorite`.** Two spellings, both
  deliberate and both 1:1 with the prototype's own `data-props` — the domain
  record's field and the card view model's field are different things, and
  `view()` documents the crossing. Item 4 is about an abbreviation, not about
  these. Recorded here so the next reader does not "finish the job".
- **`withFavorite` / `withFavoriteInList`.** One concept over two shapes, with a
  docblock that already argues exactly that, and the pair is what makes the
  two-section edit expressible. Leave both.
- **`FavoritesRow`'s `filter`.** The row rendering a derived view of hook state
  rather than the state itself is load-bearing, not incidental — it is the only
  reason a refused save has a card to put back. It reads like something to
  simplify and must not be. Item 0 is a bug in the **guard**, not in this
  filter, and fixing it by deleting the filter would trade a blank screen for a
  broken revert.
- **`RowSection`'s `aria-label`.** #70 changed the heading to name itself from
  `title` rather than from its own children, because the icon glyph leaked into
  the accessible name. Recent, correct, and pinned by six tests.
- **`NO_SECTIONS`.** One frozen value with three empty arrays, held deliberately
  so a memoised consumer keeps its identity. Not a candidate.

## Solution

Six groups. The shared rung's last occupant moves onto it and the rung gets
written down; the deferred question is answered where it was asked; one concept
gets one spelling; the two growth points are addressed; the item mapping is
tried and ruled on. Then the record, which is also where Favorites is finally
ticked ✅.

**The defect in item 0 is fixed under issue 74, before Group D starts.**
That ordering is the point rather than bookkeeping. This plan's whole safety
argument is that the 1593 existing tests are the specification and that no
commit here changes what a component draws — and the fix for item 0 changes what
a component draws, on purpose, with a RED test of its own. Smuggling it into a
refactor group would cost the group its alibi. So it goes first, as a `fix:`
pair, and Group D inherits a guard that is already correct and merely
generalises it.

With that exception carved out, no commit in this plan changes an HTTP contract,
a rendered pixel, or a stored value.

## Commits

Ten commits in six groups, after the defect fix in 74. Each leaves the tree
compiling, linting, formatted and green.

### Group A — `saveFavorite` onto the rung built for it

**A1.** Add `src/api/saveFavorite/saveFavorite.ts` with its test, carrying
`isFavoriteEcho` and the endpoint helper across with it. The tests are the five
already in `features/library/api/api.test.ts`'s `saveFavorite` describe, moved
verbatim — including the one pinning that an id is encoded into the path. The
old export stays for one commit so this one stands alone and green.

**A2.** Point all three callers at the new module — `useHomeRows`,
`GenreMovies`, `useMovieDetail` — and delete `saveFavorite`, `isFavoriteEcho`
and `favoriteEndpoint` from `features/library/api/api.ts` along with the moved
describe. `features/library/api` is left holding the two fetches that are
genuinely the browse feature's.

**A3.** Delete `useMovieDetail`'s apologising comment. The import is ordinary
now and an explanation of why it is not would be worse than none. Comment-only.

**A4.** Write the rung down. README's folder tree and its Atomic Design /
layer-responsibility prose gain `api/`, `App/` and `test-support/` with one line
each: `api/` is a wire call two or more features share, one folder per call with
its test, no barrel, imported by path; `App/` is the router and providers;
`test-support/` is shared test doubles. The same amendment goes into
`.claude/CLAUDE.md` on disk, where the canonical table lives. Docs-only, and the
commit body says plainly that the CLAUDE.md half is untracked.

### Group B — the deferred question, answered where it was asked

**B1.** Correct `useOptimisticSave`'s docblock and record the decision in it: the
two hooks stay two, `apply` may write into as many places as the screen holds
one movie's card, and the axis the two differ on is that this one **derives**
the revert from the value (`!value`) where `useOptimisticEdit` is **told** it.
Add the matching sentence to `useOptimisticEdit`'s docblock so the pair reads
the same from either side. Comment-only, no signature moves.

The decision itself: **no migration.** Both hooks have callers that are correct,
tested and shaped differently — one edits a movie by id wherever the screen
holds it, the other edits the single movie a page is holding — and the general
form that would serve both is parameterised over two axes at once. Two examples,
again, are not enough; and unlike the three bargains in `07`, here the second
example is not a third copy of the first.

### Group C — one name for one concept

**C1.** `PosterCard`'s `onToggleFav` becomes `onToggleFavorite`; `FavButton`
becomes `FavoriteButton` and `FAV_SIZE` becomes `FAVORITE_SIZE` beside it.
`CardCarousel` and `LibraryGrid` stop renaming on the way through. Mechanical
and total — after it, a search for `Fav` not followed by `orite` returns
nothing in `src/`.

This is the one commit that edits test files rather than moving them, and the
distinction is worth stating: an identifier changes, no assertion does.
`PosterCard.test.tsx`'s local prop bag and its four references to the handler
change name; what each test asserts, and the accessible names it queries by
(`{ name: /favorite/i }`, which reads the button's `label`, not its prop), are
untouched. If any assertion has to change to keep this green, the rename is
wrong.

### Group D — what a fourth shelf costs

**D1.** `HomeRows`' empty guard reads over the sections rather than naming each
one, so a section that joins is counted by construction. **It counts what each
section renders, not what it holds** — which is the correction the defect issue
makes, inherited here rather than made here. The three miss branches inside it
are untouched. Its existing tests, plus 74's new one, pass
unmodified.

**D2.** `createHome`'s `listContinueWatching` and `listFavorites` collapse into
one section builder taking the flag that makes it that section, with `listRows`
left alone (it is genuinely a different shape — it fans out over genres and
filters empties). **Conditional:** if the shared builder does not read more
plainly than the two twins it replaces, keep the twins and say so in the commit
body. Two copies of four lines is close enough to the line that the code as
written decides this, not the plan.

### Group E — the three shelves' closures

**E1.** **Conditional.** Try the closure pair over `GenreRow`, `FavoritesRow`
and `LibraryGrid`. Three call sites is the count that makes this worth
attempting rather than declining; it is not the count that makes it worth
keeping. Take it only if the extracted helper is plainly better than the three
copies, which means both of:

- it must not require a caller to pass a bag of optional handlers just to
  describe what it wants, and
- it must serve `LibraryGrid`'s prop-spreading shape and the rows' item-object
  shape without a second variant — an extraction that needs two forms to cover
  three call sites has found two concepts, not one.

If it does not clear both bars, the commit is the argument instead: a line in
the journal recording that three copies were compared and kept, so the next
reader is looking at a decision rather than an oversight.

### Group F — the record

**F1.** The dev-journal entry for the refactor; a glossary line recording that
**Favorite** is spelled in full everywhere in code and that `Movie.isFavorite`
beside `PosterCardMovie.favorite` is the one deliberate pair; and Favorites
ticked ✅ in `README.md` and `.claude/CLAUDE.md` — issue #72's last acceptance
criterion, which is written against this issue closing. F1 also records that
issue 67 (no route past the 15th favorite) was **closed as not-planned** on
2026-08-29, after the journal entry that called it open was written — so the
15-cap's missing route now lives in the glossary's flagged ambiguities and
nowhere else. It does not block the tick either way.

## Decision Document

- **The blank-screen defect is a bug, not a refactor item.** It is filed as 74
  and fixed there with its own RED test, ahead of this one. A refactor
  whose safety argument is "no test changed and nothing draws differently"
  cannot also contain the commit that makes something draw differently. Group D
  depends on that fix and does not repeat it.
- **The guard's rule is "what does this section render", not "what does it
  hold".** Two of the three sections make those identical; the shelf does not,
  and the shelf is the one with a filter. Any future section that renders a
  derived view of its data joins the same rule.
- **The two optimistic hooks stay two.** The deferral from `07` is answered no,
  with the reason written into both hooks rather than only into the journal. A
  hook general enough for both would be parameterised over what it edits _and_
  over how it reverts, and neither existing caller is asking for that.
- **`saveFavorite` moves; `saveWatched` and `saveRating` do not.** The rule that
  put `postValue` above `features/` is that neither feature should import the
  other's wire, and only the favorite save is imported across a feature
  boundary. Moving all three for symmetry would be churn against one-caller
  functions that are correctly placed today. If a second feature ever calls one
  of them, it moves then.
- **`src/api/` keeps its no-barrel shape, and gains a written rule.** One folder
  per unit with its test, imported by path, following `test-support/`'s
  precedent and the rung's own existing occupant — now stated in README and
  CLAUDE.md rather than inferred from two folders.
- **The abbreviation loses; the glossary term wins.** `onToggleFavorite`
  everywhere, because the prototype spells it both ways and therefore does not
  decide it, and because `docs/ubiquitous-language.md` does. The 1:1 rule binds
  the UI surface — layout, spacing, states, copy, interaction — not the
  prototype's identifiers, and COMPONENT-SPEC's prop table has already been
  overridden once on the same reasoning.
- **Two growth points are worth closing; the item mapping is tried on a rule,
  not on taste.** The empty guard and the section builders are places where
  forgetting to add something produces a visible bug; the closures are a place
  where copying two lines produces two correct lines. Those are different risks.
  The third call site is what obliges an attempt; the two bars in E1 are what
  decide the outcome.
- **`TITLE_SIZE` stays duplicated.** Deliberate, argued in both files, straight
  from the prototype. Out of scope by decision, not by omission.
- **Nothing in this plan changes an HTTP contract, a rendered pixel, or a stored
  value.** Any diff that changes what a route answers or what a component draws
  is a bug in this plan, not a feature of it. The one exception is fixed
  elsewhere, on purpose, for exactly this reason.

## Testing Decisions

A good test here asserts what a caller can observe: what the screen renders,
what reaches the wire, what the hook hands back. Almost none of these commits
should need a test that names an internal collaborator, because almost none of
them changes behaviour — the existing suite is the specification and its passing
unmodified is the whole safety argument.

- **The defect gets the one genuinely new test, and it belongs to 74.** It is a
  screen-level test in `HomeRows.test.tsx`: serve a home whose only populated
  section is the shelf, holding one watched, untagged favorite;
  click its heart; assert the empty-library message is on screen. It fails today
  against a blank document — verified, not predicted — which is what makes it a
  RED test rather than a regression guard written after the fact.
  `WATCHED_UNTAGGED_FAVORITE` already exists as a fixture for exactly this
  movie.
- **`saveFavorite`'s five tests move file, not shape.** They already assert the
  observable contract — the body posted, the id encoded into the path, the echo
  taken over the value sent, a rejection on a non-2xx. Moving them is a move; if
  any needs rewriting to pass in its new home, the move is wrong.
- **The rename edits test files and must not edit tests.** C1 changes
  identifiers in `PosterCard.test.tsx` and nothing else. The queries that carry
  the guarantees go through the accessible name, which the rename does not
  touch, so a diff that changes a `getByRole` is a diff that has gone wrong.
- **`useOptimisticSave` and `useOptimisticEdit` get no new tests.** Group B is
  comment-only. Their existing files (`useOptimisticSave.test.tsx`,
  `useOptimisticEdit.test.tsx`) already pin apply/reconcile/revert on both
  sides.
- **`HomeRows`' guard is tested through the screen it guards.** Its existing
  tests cover an empty library, a search miss, a filter miss, and the
  watched-untagged-favorite that must show its shelf. D1 passes if all four, and
  74's fifth, are unmodified.
- **`createHome`'s builders are tested through `getHome`**, which is where a
  section's behaviour is observable — the same reasoning that kept `writeSignal`
  tested through the router in `07`. `home.test.ts` already pins that every
  section obeys the caller's search, genre, minRating and sort, and takes the
  shared cap.
- **Prior art:** `07-ratings-refactor`'s Groups C–E are the model — a
  characterisation-first move where existing tests pass untouched, and a helper
  tested through its caller rather than given a test that reaches under it. For
  the defect, #70's RED tests are the model: a screen-level assertion about what
  a parent can see, written before the fix.

## Out of Scope

- **The write path.** Route, `writeSignal`, `setFavorite`, the column and its
  index. Untouched by the build, untouched here.
- **A Favorites page behind "View all"** — issue 67, now closed as not-planned.
  It is a prototype amendment, and CLAUDE.md's rule is that the prototype is
  amended in a grill-me first. A refactor is the wrong instrument entirely, and
  a closed issue does not make it the right one.
- **A favorites filter pill, a `/favorites` route, per-person favorites.** All
  three are ruled out in `08-favorites` and the glossary; nothing here reopens
  them.
- **`Movie.isFavorite` → `favorite`, or the reverse.** Two deliberate spellings
  of two different things, both matching the prototype. Named in the plan only
  so it is visibly a decision.
- **Whether `.claude/` should be tracked.** Surfaced again by A4, open since
  `03-card-carousel-refactor`, and a repository-policy question rather than a
  refactor one.
- **`GenreMovies`' two `act()` warnings.** Noted and left by the Ratings
  refactor, pre-date Favorites, and belong to whoever refactors the genre
  screen. If the suite is otherwise silent they stay the only two, which is the
  state `07` left them in deliberately.
- **Any cross-screen favorite store.** A heart set on one screen reaches the
  others on their next load. Unchanged.

## Further Notes

The honest summary of the _refactor_ is that **Favorites left very little
behind**, and that is worth stating rather than padding around. It was built out
of a column, a route, a client call, a query flag, a molecule and a chrome
component that all already existed — the design log opens by saying so — and the
build added one payload section, one component, one `RowSection` prop and the
wiring between them. Most of what is here is decisions rather than extractions,
and two of them are expected to end in "kept as it was". That is the right
outcome for a feature assembled from finished parts, and it is the reason the
plan is explicit about which items are conditional. A refactor that manufactures
work to look substantial is how a codebase acquires abstractions nobody asked
for.

The one thing that is **not** a small item is the blank screen, and the way it
was found is worth recording. It did not come out of reading the diff; it came
out of asking what the empty guard's third term actually counts, and then
running the case rather than reasoning about it. The reasoning alone would have
produced "probably fine — `favorites` is a favorites-only section". The run
produced an empty document.

Two general facts fall out of it, both larger than this feature:

- **#71's precedent has a cost nobody priced.** "A row whose rendered contents
  are a derived view of hook state" is a good pattern and the journal argues it
  well — it is what makes the revert possible. But it silently breaks every
  other place that treats section length as a proxy for section content, and the
  guard was the only such place at the time. The next derived-view row inherits
  the same trap.
- **The suite was green over a blank page.** Every existing test that empties
  the shelf serves populated genre rows beside it, so the guard is never under
  test at the moment it matters. 1593 passing tests are the specification of
  what was thought of, and this was the one combination nobody wrote down.
