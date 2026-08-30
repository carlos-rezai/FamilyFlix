# 09 — Continue Watching refactor

Follows the build in issues #76–#79 (parent #75). The feature shipped in four
phases, the suite is green at **1644 tests across 98 files**, and the row is
still 🔜 in README and CLAUDE.md — deliberately, because a feature is not done
until its refactor round is.

Continue Watching is the second feature in a row to leave almost nothing
structurally wrong behind. The build changed **no frontend shipping file at
all**: one migration, one column, one type, two stamped mutators, one `ORDER BY`
entry, and one argument on a helper that already existed. Every acceptance
criterion was met, and the design log answered nineteen questions before a line
was written.

What it left instead is a **bill that had been accruing since #15 and finally
came due**, plus four small places where a comment is holding a guarantee the
code could hold itself.

The bill is issue **80**, filed from #79 rather than done there, and it asked in
writing to be folded into this plan rather than run standalone. It is Group A.
While confirming its measurements, the same duplication turned out to exist on
the **server** side too, in a worse form and with no shared rung to put it on —
that is Group B, and it is the largest thing in this plan.

## Problem Statement

`Movie` gained a required `lastWatchedAt` in issue #76. That one-line type change
broke **sixteen frontend test files** in the same commit, each needing the
identical one-line edit, because each carries its own `makeMovie` factory that
builds the record as a full 23-field object literal.

The edit was right and the field being required is right — an optional key the
reader always populates would be a lie the type tells. What is wrong is that
adding a field to the library's central record costs sixteen mechanical edits,
and `lastWatchedAt` is the **first** field `Movie` has gained since the type was
split out in #15. Add Movie, bulk import and the player are all ahead of us, and
each of them will send the same bill again.

The server side is the same problem one degree worse. Seven backend test files
open with a **byte-for-byte identical** forty-line preamble — a `Closeable`
interface, a `closeables` array, a `track` helper, a `freshStorage` factory, an
`afterEach` teardown, and a `newMovie` builder — and two of them additionally
share identical `seedByAge` and `seedGenre` fixtures. The frontend has a
`test-support/` rung for exactly this; `server/src/` has no such rung, so the
duplication had nowhere else to go and was copied file by file instead.

Beyond the test scaffolding, the build left four places where a **comment is
carrying a guarantee the code could carry itself**:

1. The `last-watched` `ORDER BY` body ends with `m.created_at DESC, m.id` —
   `recently-added`'s body character for character — and a comment promises the
   two stay identical ("with nothing stamped this order _is_ that one, down to
   the id tiebreak"). Nothing enforces it. Editing `recently-added`'s tiebreak
   silently breaks the unstamped-library guarantee the tests were written
   against, and the comment goes on claiming otherwise.
2. **"In progress" is written three times**, in two languages: the
   `inProgressOnly` `WHERE` term, the `CASE` inside `unwatched-first`, and
   `deriveStatus` in the reader. The Continue Watching row is _defined_ by this
   rule, and the row and its own sort now disagree about where it is written
   down.
3. `home.ts` states the pinned-order asymmetry **three times** — in the module
   contract, in `listSection`'s docblock, and inline at the call site — in three
   near-identical paragraphs. #79 added the third on purpose, because the two
   adjacent `listSection` calls would otherwise read as an oversight. Three
   copies of a rationale drift the same way three copies of a fixture do.
4. Two tests in `home.test.ts` — `'orders recently-added first'` and
   `'caps at the same 15 as the genre rows, newest first'` — now assert something
   other than what their names say, and #78 papered over it with a six-line
   caveat comment above each rather than renaming them. A test whose name has to
   be corrected by a comment is a test nobody will trust at a glance.

And `home.test.ts` itself has reached **1339 lines** with its helpers in two
separate blocks 950 lines apart, because Phase 4's fixtures could not be added to
the top of the file without moving everything below them.

## Solution

Nothing here changes a rendered pixel, an HTTP contract, a stored value, or a SQL
result. Every group is either scaffolding, a comment collapsing into the code
that should have carried it, or a document catching up with what shipped.

**One `Movie` builder, on the rung that already exists for it.** Sixteen local
factories become one `src/test-support/makeMovie/`, following the precedent
`LocationProbe` and `stubScrollMetrics` set in #54 — its own folder, its own
test, never imported by shipping code. The four files that want a different
specimen express that at the call site as overrides, because the specimen a test
wants is that test's business and the record's shape is not.

**A `server/src/test-support/` rung, and the seven files' preamble on it.** The
frontend's rung is a named layer in README's architecture table; the server gets
its mirror, documented the same way, and the identical preamble moves onto it
once. This is a new folder in a structure CLAUDE.md deliberately keeps closed
("if new backend logic doesn't fit `library/`, `media/` or `import-export/`,
that's a sign a new domain folder is needed, not a reason to add a miscellaneous
one") — so it is a **documented boundary amendment**, argued in the decision
document below, not a quiet addition. Test doubles are not backend logic, and the
frontend settled this exact question already.

**The `last-watched` tiebreak composed rather than copied**, so the guarantee is
the compiler's rather than a comment's. **The in-progress rule named once** in
the one place it is expressed in SQL. **The asymmetry stated once**, where a
reader actually lands. **Two tests renamed** to say what they assert, and their
caveat comments deleted along with the need for them.

Then the documents: the glossary's flagged ambiguity that this feature
_resolved_, the dev-journal entry, and the ✅ tick in README and CLAUDE.md.

## Commits

### Group A — one `Movie` builder, not sixteen (issue 80)

**A1. Add the shared builder, imported by nothing.**
`src/test-support/makeMovie/makeMovie.ts` plus `makeMovie.test.ts`. The defaults
are the twelve-copy specimen exactly as it stands today — _Comet Season_, 2018,
90 minutes — because that is already the suite's agreed specimen, and changing it
here would silently alter twelve files' fixtures under cover of a refactor. The
test asserts the two things that matter: the default record type-checks as a
complete `Movie`, and an override replaces exactly the field named and nothing
else. Suite green, nothing else touched.

**A2. Point the library feature's tests at it.** Delete the local factory from
`features/library/api`, `features/library/view`, `features/library/home/*`
(`HomeRows`, `continueView`, `toGenreRow`, `useHomeRows`) and
`features/library/genre/*` (`GenreGrid`, `GenreHeading`, `GenreMovies`); import
the shared one. Assertions untouched — if a test's expected values change, the
commit is wrong.

**A3. Point the movie-detail tests at it.** The same sweep for
`movie-detail/api`, `movie-detail/detailView`, `movie-detail/MovieDetail` and
`movie-detail/useMovieDetail`. Split from A2 only so a failure is bisectable to
one feature.

**A4. Point the page- and app-level tests at it.** `App.test.tsx`,
`LibraryPage.test.tsx`, `GenrePage.test.tsx`.

**A5. Express the four divergent specimens as overrides.** `movie-detail/api`'s
_Quiet Harbor_, `MovieDetail`'s _Northwind_ with its two genres and shared
synopsis constant, and the in-progress defaults `library/api` and `continueView`
need. Each becomes either an override object at the call site or a thin local
wrapper over the shared builder — never a parameter on the builder. A mapper that
builds a Resume label has nothing to map from an unwatched movie, and that fact
belongs in that mapper's test, not in everyone's factory.

**A6. Rule on the five view-model builders, in writing.** `CardCarousel`,
`GenreRow`, `ContinueRow`, `FavoritesRow` and `LibraryGrid` each define a
`makeMovie` too, but theirs build `PosterCardMovie` / `ContinueCardMovie` view
models, not `Movie` records. Measure them the way 80 measured the sixteen: if
they are the same duplication, fold them onto the rung as a second builder pair;
if they are two small independent shapes, say so in the commit message and leave
them. Either outcome is the commit — what is not allowed is leaving the question
open a third time.

### Group B — a server test-support rung

**B1. Document the rung before creating it.** README's architecture table and
folder tree gain `server/src/test-support/`, carrying the same one-line rule the
frontend's does: shared test doubles, never imported by shipping code. The same
amendment goes into CLAUDE.md's server structure — noting that CLAUDE.md is
gitignored, so that half of the edit lives on disk only. A docs-only commit, so
the boundary change is reviewable on its own rather than buried under a code
move.

**B2. Move the storage harness onto it.** `server/src/test-support/freshStorage/`
holds the `Closeable` interface, the `closeables` array, `track`, `freshStorage`,
and the `afterEach` teardown that closes what a test opened. Its own test asserts
what it promises: a fresh in-memory database per call, fully migrated, and closed
after the test that opened it. **Verify first** that a module-scope `afterEach`
registered inside an imported helper is registered per importing file under
Vitest — if it is not, the teardown stays at the call site and only the factory
moves. Say which of the two happened in the commit message.

**B3. Point `browse`, `home` and `watch` at the harness.** The three files most
central to this feature go first, so the change is exercised by the tests that
motivated it.

**B4. Point `read`, `curation`, `write` and `genre` at it.** `write` and `genre`
also carry a `tempDbPath` helper for their on-disk cases, and `write` a
`fullMovie` builder; leave both where they are for now — one is used by two files
and the other by one, and this commit is about the preamble every file shares.

**B5. Move the `NewMovie` builder onto the rung.**
`server/src/test-support/newMovie/`, the minimal-valid-input factory the seven
files share verbatim. Kept separate from B2–B4 because it is a different thing
moving for a different reason, and because a `NewMovie` builder is the one piece
of this group that Add Movie and bulk import will also want.

**B6. Move `seedByAge` and `seedGenre` onto the rung.** Identical in
`home.test.ts` and `genre.test.ts`, and both are what make `recently-added`
ordering deterministic rather than tie-dependent — a subtlety worth having in one
documented place before a third file needs it. `seedFavorites` and
`seedInProgress` are thin wrappers over `seedByAge` used by one file each; they
stay at their call site, and B6's message says so.

**B7. Consider `tempDbPath`.** Two files, byte-identical, and it is the only
remaining shared preamble. Move it, or write down why not. Conditional on B2–B6
landing cleanly; drop it rather than force it.

### Group C — the guarantees the comments are holding

**C1. Compose the `last-watched` tiebreak from `recently-added`.** The `ORDER_BY`
record builds `last-watched`'s body from the `recently-added` entry rather than
repeating its text, so "with nothing stamped this order _is_ that one" becomes
true by construction. The comment shrinks to the part that is still a decision —
why nulls sink rather than win the `DESC`. `browse.test.ts` already asserts both
halves; no test changes.

**C2. Name the in-progress rule once in SQL.** The `inProgressOnly` `WHERE` term
and the `unwatched-first` `CASE` both encode "started but not finished". Extract
the predicate to one named constant in `browse.ts` and build both from it. The
reader's `deriveStatus` stays exactly where it is — it is the same rule in a
different language doing a different job, and merging them would put SQL text and
TypeScript branching in one module — but it gains a cross-reference so the two
are findable from each other. No behaviour change; `browse.test.ts` covers both
call sites already.

**C3. State the asymmetry once.** `home.ts` currently argues the pinned order in
three places. Keep the inline note at the `listSection` call pair, since that is
where a reader meets the two disagreeing arguments and asks the question; reduce
the module contract and `listSection`'s docblock to a pointer at it. The module's
job is to say the continue section pins its order — not to re-argue why in full,
twice.

### Group D — the tests that outgrew their names

**D1. Rename the two drifted `home.test.ts` cases.**
`'orders recently-added first'` becomes what it now asserts — the nulls-last
fallback landing on `recently-added`'s body when nothing is stamped — and
`'caps at the same 15 as the genre rows, newest first'` likewise. Their six-line
caveat comments go with the rename: a name that is true needs no correction under
it. The assertions themselves do not change.

**D2. Hoist Phase 4's fixtures to the file's helper block.** `started`,
`seedQueueAgainstEverySort` and `seedQueue` sit at line 1019 because that is
where they could be added without moving the file; with the shared preamble gone
to `test-support/` (B3), the top of the file has room for them and the file has
one helper section again.

**D3. Split `home.test.ts` — conditional.** After B3 and D2, re-measure. If it is
still past a thousand lines, split along the seam it already has: the genre rows,
the continue section, the favorites shelf, and the payload shape are four
independent subjects sharing one set of fixtures that now live on a rung both
halves can import. If the earlier commits brought it back within sight of its
siblings, leave it and say so. **Do not split it to hit a number** — the file is
coherent, and four files that each import the same eight fixtures are not
obviously better than one.

### Group E — the documents

**E1. Resolve the glossary's flagged ambiguity.** _"Continue Watching does not
mean most-recently-watched"_ is now **false** — it says the row is ordered
`recently-added` "because no sort exists over when playback last touched this",
and issue #77 added exactly that sort. Rewrite it as resolved, in the shape 08
used for the empty-`?sort=` entry: what was ambiguous, what settled it, and which
issue. The neighbouring note about `markWatched` zeroing the resume position
stays flagged — it is the watch-tracking grill's, not this refactor's.

**E2. Write the dev-journal entry.** Newest first, in the established shape: what
shipped, what was deliberately not changed, and the follow-ups this round
surfaced. Two are worth recording regardless of outcome — the seed's absolute
`lastWatchedAt` stamps (dated to the week they were written, so "the past few
weeks" ages into "months ago"; harmless while nothing renders them, a trap the
day something does), and whatever A6, B7 and D3 decide.

**E3. Tick Continue Watching ✅.** README's feature table and CLAUDE.md's feature
list. Last commit of the round, because the tick is what the round is for.

## Decision Document

- **Issue 80 is folded in rather than run standalone**, as 80 itself requested.
  Its acceptance criteria are Group A's, unchanged.
- **`Movie`'s `lastWatchedAt` stays required.** The refactor removes the cost of
  a required field, not the field's honesty. The reader always populates it, so
  an optional key would be a lie the type tells — the same argument #76 made.
- **The shared builder's defaults are today's twelve-copy specimen**, adopted
  unchanged. A refactor that also moved every fixture's values would make its own
  diff unreadable and any resulting failure unattributable.
- **Divergent specimens live at the call site, never as builder parameters.** The
  variation across the sixteen is entirely in _what specimen a file wants_, never
  in the record's shape; a builder that grew a parameter per specimen would be
  the duplication again wearing a different hat.
- **`server/src/test-support/` is a new named rung**, mirroring the frontend's,
  and it is an amendment to a folder structure CLAUDE.md keeps deliberately
  closed. The argument for it: that rule is about _backend logic_ having a domain
  home, and test doubles are not backend logic — they are the same category the
  frontend already gave its own rung and its own rule ("never imported by
  shipping code"). The alternative is seven copies of a forty-line preamble,
  which is what we have.
- **The rung follows the frontend's conventions exactly**: one folder per unit
  with its test co-located, no per-unit barrel. Whether it gets a category barrel
  follows whatever the frontend `test-support/` does today — the two should not
  disagree.
- **`deriveStatus` does not merge with the SQL predicate.** Same rule, two
  languages, two jobs: one decides which rows the database returns, the other
  derives a display status from a row already in hand. They get a
  cross-reference, not a shared implementation.
- **The `ORDER_BY` record stays exhaustive over `ListSort`.** C1 changes how one
  entry's string is built, never that the compiler demands every member have one.
- **`MOVIE_SORTS` is not touched.** Still the wire's five, still what the route
  validates against, still what keeps `last-watched` unreachable from a URL.
- **No production behaviour changes anywhere in this plan.** C1 and C2 are the
  only commits that touch a shipping backend file, and both must leave every SQL
  statement byte-identical in what it produces. If a result order moves, the
  commit is wrong.
- **No frontend shipping file changes at all**, exactly as the build didn't.
- **A6, B7 and D3 are conditional commits with a stated escape hatch.** Each may
  end as "measured, decided against, here's why" — and that written decision is
  the deliverable, because a duplication nobody has ruled on gets copied a third
  time by default.
- **The ✅ tick is the last commit**, per the standing rule that a feature is done
  only after its refactor.

## Testing Decisions

**What makes a good test here:** every one of these commits is scaffolding or
prose. The suite is the instrument, not the subject. The bar for the whole round
is that **1644 tests across 98 files stay green and keep asserting exactly what
they assert today** — no expected value changes, no assertions added or removed
under cover of a move, and no fixture values silently altered. A commit in Group
A, B or D that changes what a test _checks_ is a wrong commit, not a bonus.

**New tests, and only these:**

- `makeMovie.test.ts` — the default builds a complete `Movie`, and an override
  replaces exactly the field named. Prior art: `comesBefore.test.ts` and
  `headerSpacer.test.tsx`, which test their own doubles for precisely this
  reason.
- `freshStorage.test.ts` on the server rung — a fresh, fully-migrated in-memory
  database per call, and the teardown closes what a test opened. Prior art: the
  same two frontend files, and `db.test.ts` for the migration assertions.
- `newMovie.test.ts` — the minimal input is valid input (title and `videoPath`
  are the only required fields) and overrides compose.
- `seedByAge` / `seedGenre` tests — the guarantee worth pinning is the one the
  helper exists for: _distinct_ creation instants, so `recently-added` ordering
  is deterministic rather than tie-dependent.

**Coverage of the area being refactored is already strong, and was checked rather
than assumed.** `browse.test.ts` (1005 lines) covers the `last-watched` order,
its nulls-last key and its `created_at`/`id` tiebreak; `home.test.ts` (1339)
covers the pinned order against all five wire sorts, the cap under the pinned
order, and every section narrowing off one query; `watch.test.ts` (319) covers
both stamping mutators and `markUnwatched`'s deliberate silence; `db.test.ts`
(406) covers the migration runner. C1 and C2 need no new tests, because both are
refactors _of_ code these files already pin.

**The seam that is not covered, and stays that way:** nothing exercises
`setResumePosition` through HTTP, because it has no route and no caller until the
player ships. That was #75's decision, and this round does not revisit it.

## Out of Scope

- **The player, `POST /api/movies/:id/resume`, and a shared `saveResume`.** Watch
  tracking's, as #75 said and #16 said before it. Adding them here re-creates the
  dead-code shape both rounds refused.
- **A `last-watched` option in the Sort dropdown.** The prototype's menu has
  five; a sixth is a prototype amendment, not a refactor.
- **"Remove from Continue Watching."** Not in the prototype.
- **Real artwork on the continue tile.** Open since #16 Q6, still a prototype
  amendment.
- **Whether `markWatched` should preserve the resume position.** Flagged in the
  glossary for the watch-tracking grill, and it changes stored values — the one
  thing this plan promises not to do.
- **The seed's absolute `lastWatchedAt` stamps.** Journalled in E2, not changed.
  Nothing renders the timestamp, so the aging is invisible today.
- **`routes.test.ts`'s twenty-odd local helpers.** It is 1881 lines with a
  fixture-builder per endpoint group, and it is a genuinely different problem —
  those helpers build _HTTP libraries_, not records. Its own round, if it earns
  one.
- **`eslint-plugin-jsx-a11y` severity**, still open from #21's follow-ups.
- **Nx, the tsconfig scaffolding, and the dependency tree.** All settled in #21.

## Further Notes

**This is the second consecutive feature to leave little behind, and that is a
result rather than a gap.** Favorites left six undocumented decisions; Continue
Watching left one accrued debt and four comments doing a compiler's job. Both
builds were preceded by a grill-me that answered the hard questions in advance —
nineteen of them here, before a line was written — and it shows in what the
refactor round has to do.

**The bill in Group A is the interesting one.** It did not arrive because #76 was
careless; it arrived because `Movie` had not gained a field since #15, so nothing
had ever tested what a change to the record costs. The answer turned out to be
sixteen edits. Add Movie, bulk import and the player each add fields to this
record, so the same bill was going to arrive three more times — and this is the
cheapest moment to stop it, while the last one is still fresh enough to point at.

**Group B is the same lesson with the invoice not yet delivered.** No server
change has broken those seven preambles yet, because `NewMovie`'s new field was
optional. The next one might not be.
