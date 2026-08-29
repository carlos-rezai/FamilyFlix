# 08 — Favorites refactor

Follows the build in issues #68–#72. Four items, and the first of them is a
question `07-ratings-refactor` deferred to this feature **by name**: _"Whether
the browse screens later migrate is a question for the Favorites feature, which
CLAUDE.md already assigns both surfaces."_ Favorites has now shipped, so the
question is answerable rather than open.

Two of the four are small on purpose. They are here because the alternative to
arguing them is leaving them to be re-noticed by whoever builds the next shelf,
and a duplication nobody has ruled on gets copied a third time by default.

## Problem Statement

Favorites works, the suite is green at 1593 across 96 files, and the feature
list still says 🔜. Unlike Ratings, this feature left behind almost no new
duplication — it was built out of pieces five earlier initiatives had already
placed, and the build reopened none of them. What it left instead is **four
decisions nobody has written down**, three of which are about whether something
written twice should be written once.

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
whether it should exist at all has an answer in the codebase that nothing states.

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

### 3. Two shelves build their carousel items identically

`GenreRow` and `FavoritesRow` both do this, character for character:

```
const items: PosterCarouselItem[] = <movies>.map((movie) => ({
  movie,
  onOpen: () => onOpenMovie?.(movie.id),
  onToggleFavorite: () => onToggleFavorite?.(movie.id, !movie.favorite),
}));
```

`ContinueRow` does the `onOpen` half of it for a `ContinueCarouselItem`.

Two copies — and this project's own rule, argued at length in `07`, is that two
examples are not enough to design a generalisation against and three are. This
item is in scope to be **ruled on**, not to be extracted on sight. The plan's
expectation is that it is declined; the commit is conditional on what the code
looks like when it is tried.

The neighbouring `TITLE_SIZE = 22`, duplicated in the same two files, is **not**
part of this. Both files carry a comment saying it is passed explicitly because
the difference between the three headings is specified in the prototype rather
than incidental. Sharing that constant would overturn a written decision, not
tidy an oversight.

### 4. Two places a fourth shelf has to be added by hand

Adding the Favorites section touched two spots that will need touching again in
exactly the same way, and neither announces that:

- **`HomeRows`' empty guard** grew its third term (`rows.length === 0 &&
continueWatching.length === 0 && favorites.length === 0`). A section that
  joins and is not added here prints "Your library is empty" over a populated
  shelf — which is precisely the bug #69's AC existed to prevent, waiting to be
  reintroduced by the next author who forgets a term.
- **`createHome`'s section builders.** `listContinueWatching` and
  `listFavorites` are literal twins differing by one flag key. `getHome`'s own
  docblock already describes the pattern in prose — "every section is a
  composition of the two existing browse queries" — while the code writes the
  composition out once per section.

### What is _not_ wrong

- **The write path.** The route, `writeSignal`, `setFavorite`, the column and
  its partial index were not reopened by this feature and are covered on both
  sides. Nothing here touches them.
- **`withFavorite` / `withFavoriteInList`.** One concept over two shapes, with a
  docblock that already argues exactly that, and the pair is what makes the
  two-section edit expressible. Leave both.
- **`FavoritesRow`'s `filter`.** The row rendering a derived view of hook state
  rather than the state itself is load-bearing, not incidental — it is the only
  reason a refused save has a card to put back. It reads like something to
  simplify and must not be.
- **`RowSection`'s `aria-label`.** #70 changed the heading to name itself from
  `title` rather than from its own children, because the icon glyph leaked into
  the accessible name. Recent, correct, and pinned by six tests.
- **`NO_SECTIONS`.** One frozen value with three empty arrays, held deliberately
  so a memoised consumer keeps its identity. Not a candidate.

## Solution

Four groups, in order of how much they are worth: the shared rung's last
occupant moves onto it, the deferred question is answered where it was asked,
the two growth points are addressed, and the item mapping is tried and ruled on.
Then the record, which is also where Favorites is finally ticked ✅.

No group changes an HTTP contract, a rendered pixel, or a stored value. The 1593
existing tests are the specification, and no test file should be edited to make
a refactor commit pass — a moved test file is a move, not an edit.

## Commits

Eight commits in five groups. Each leaves the tree compiling, linting, formatted
and green.

### Group A — `saveFavorite` onto the rung built for it

**A1.** Add `src/api/saveFavorite/saveFavorite.ts` with its test, carrying
`isFavoriteEcho` and the endpoint helper across with it. The tests are the five
already in `features/library/api/api.test.ts`'s `saveFavorite` describe, moved
verbatim — including the one pinning that an id is encoded into the path. The
old export stays for one commit so this one stands alone and green.

**A2.** Point all three callers at the new module — `useHomeRows`, `GenreMovies`,
`useMovieDetail` — and delete `saveFavorite`, `isFavoriteEcho` and
`favoriteEndpoint` from `features/library/api/api.ts` along with the moved
describe. `features/library/api` is left holding the two fetches that are
genuinely the browse feature's.

**A3.** Delete `useMovieDetail`'s apologising comment. The import is ordinary
now and an explanation of why it is not would be worse than none. Comment-only.

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

### Group C — what a fourth shelf costs

**C1.** `HomeRows`' empty guard reads over the sections rather than naming each
one, so a section that joins is counted by construction. The three miss branches
inside it are untouched. Its existing tests — including the watched-untagged-
favorite case — pass unmodified.

**C2.** `createHome`'s `listContinueWatching` and `listFavorites` collapse into
one section builder taking the flag that makes it that section, with `listRows`
left alone (it is genuinely a different shape — it fans out over genres and
filters empties). **Conditional:** if the shared builder does not read more
plainly than the two twins it replaces, keep the twins and say so in the commit
body. Two copies of four lines is close enough to the line that the code as
written decides this, not the plan.

### Group D — the two shelves' items

**D1.** **Conditional, and expected to be declined.** Try `toPosterItems` over
`GenreRow` and `FavoritesRow`. Take it only if the extracted helper is plainly
better than the two copies — which means it must not require either caller to
pass a bag of optional handlers just to describe what it wants. If it does not
clear that bar, the commit is the argument instead: a comment in neither file
and a line in the journal saying two copies were compared and kept, so the next
reader is looking at a decision rather than an oversight.

### Group E — the record

**E1.** The dev-journal entry for the refactor, and Favorites ticked ✅ in
`README.md` and `.claude/CLAUDE.md` — issue #72's last acceptance criterion,
which is written against this issue closing. Issue 67 (no route past the 15th
favorite) stays open as a recorded prototype gap and does not block the tick, per
that issue's own terms.

## Decision Document

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
- **`src/api/` keeps its no-barrel shape.** One folder per unit with its test,
  imported by path, following `test-support/`'s precedent and the rung's own
  existing occupant.
- **Two growth points are worth closing, one duplication probably is not.** The
  empty guard and the section builders are places where forgetting to add
  something produces a visible bug; the item mapping is a place where copying
  four lines produces four correct lines. Those are different risks and get
  different answers.
- **`TITLE_SIZE` stays duplicated.** Deliberate, argued in both files, straight
  from the prototype. Out of scope by decision, not by omission.
- **Nothing here changes an HTTP contract, a rendered pixel, or a stored
  value.** Any diff that changes what a route answers or what a component draws
  is a bug in this plan, not a feature of it.

## Testing Decisions

A good test here asserts what a caller can observe: what the screen renders,
what reaches the wire, what the hook hands back. None of these commits should
need a test that names an internal collaborator, because none of them changes
behaviour — the existing suite is the specification and its passing unmodified
is the whole safety argument.

- **`saveFavorite`'s five tests move file, not shape.** They already assert the
  observable contract — the body posted, the id encoded into the path, the echo
  taken over the value sent, a rejection on a non-2xx. Moving them is a move; if
  any needs rewriting to pass in its new home, the move is wrong.
- **`useOptimisticSave` and `useOptimisticEdit` get no new tests.** Group B is
  comment-only. Their existing files (`useOptimisticSave.test.tsx`,
  `useOptimisticEdit.test.tsx`) already pin apply/reconcile/revert on both sides.
- **`HomeRows`' guard is tested through the screen it guards.** Its existing
  tests cover an empty library, a search miss, a filter miss, and the watched-
  untagged-favorite that must show its shelf. C1 passes if all four are
  unmodified.
- **`createHome`'s builders are tested through `getHome`**, which is where a
  section's behaviour is observable — the same reasoning that kept `writeSignal`
  tested through the router in `07`. `home.test.ts` already pins that every
  section obeys the caller's search, genre, minRating and sort, and takes the
  shared cap.
- **Prior art:** `07-ratings-refactor`'s Groups C–E are the model — a
  characterisation-first move where existing tests pass untouched, and a helper
  tested through its caller rather than given a test that reaches under it.

## Out of Scope

- **The write path.** Route, `writeSignal`, `setFavorite`, the column and its
  index. Untouched by the build, untouched here.
- **A Favorites page behind "View all"** — issue 67. It is a prototype
  amendment, and CLAUDE.md's rule is that the prototype is amended in a grill-me
  first. A refactor is the wrong instrument entirely.
- **A favorites filter pill, a `/favorites` route, per-person favorites.** All
  three are ruled out in `08-favorites` and the glossary; nothing here reopens
  them.
- **`GenreMovies`' two `act()` warnings.** Noted and left by the Ratings
  refactor, pre-date Favorites, and belong to whoever refactors the genre screen.
  If the suite is otherwise silent they stay the only two, which is the state
  `07` left them in deliberately.
- **Any cross-screen favorite store.** A heart set on one screen reaches the
  others on their next load. Unchanged.

## Further Notes

The honest summary of this refactor is that **Favorites left very little
behind**, and that is worth stating rather than padding around. It was built out
of a column, a route, a client call, a query flag, a molecule and a chrome
component that all already existed — the design log opens by saying so — and the
build added one payload section, one component, one `RowSection` prop and the
wiring between them. Three of the four items here are decisions rather than
extractions, and one of them is expected to end in "kept as it was".

That is the right outcome for a feature assembled from finished parts, and it is
the reason the plan is explicit about which items are conditional. A refactor
that manufactures work to look substantial is how a codebase acquires
abstractions nobody asked for.
