# Refactor plan: Back navigation — one spelling of a route, the form's own words, and one structural guard instead of four

> Source initiative: [`back-navigation`, issue #170](https://github.com/carlos-rezai/FamilyFlix/issues/170)
> Shipped by issues 171–175. Design log: `docs/design-logs/20-back-navigation.md`.
> Filed as issue 177. The docs-and-glossary slice filed as 176 is folded in here
> as Group 0 and Group 4, on the precedent of 168 into 169, 163 into 164, 156
> into 157, 148 into 149 and 140 into 141, and was closed at filing so the
> initiative has one closing issue rather than two; the feature table ticks ✅
> when this one closes.

## Problem Statement

`back-navigation` is step 3 of the seven that were left, the first initiative
found by auditing the build against the prototype rather than by reading the
prototype for something new, and the smallest since the FAB: one parameter on
one hook, four screens changed from a push to a step, one new spelling on a
test double. The maintainer's standing instruction was the scope — _translate
the prototype 1:1 into the codebase, in its naming, conventions, patterns and
architecture_ — and here the prototype could only supply half the answer, since
a stateless screen switcher can say where a **Leaving** lands but never whether
it pushes or steps.

What shipped is the rule the log settled. `useGoBack(fallback = '/')` is still
the one **Back rule**: a **History step**, or the screen's own **Landing**
pushed when `location.key === 'default'`. The player's Back pill and its Escape
share one `leave` and it is the hook with the film's page behind it; Import's
Back is the hook with Settings behind it; the **Movie form**'s Back, Cancel,
_Skip this one_, _Save changes_ and _Save & continue_ are all one `goBack`
whose **Landing** is read off the URL's two query parameters on the first
render, before either fetch has answered. The two **Fresh homes** the prototype
keeps — _Add to library_ and Import's _Finish_ — are still pushes to `/`.
`useDeleteMovie`, `useRestoredScroll`, `GenreLayout`, `MoviePage` and
`SettingsHeader` were not touched and did not need to be; the delete-after-Play
case and the detail page's lost scroll both came right on their own, which is
what the App-level journeys assert. `LocationProbe` grew a fourth spelling,
`navigationType`, so a suite can say `POP` where it could previously only say
_landed on the right URL_ — the assertion whose absence let this survive three
initiatives.

Every log-20 ruling was read against the code for this filing and holds: Q1 the
rule, Q2 one hook and one parameter, Q3 the **Landing** pushed and not
replaced, Q4 the player's two ways out through one handler, Q5 Import's Back
leaving a running import alone, Q6 the landing off the URL and never off
fetched state, Q7 the **Review step** surviving a step because it is the
**Current run**'s state, Q8 the delete case fixed by the player alone, Q9 the
two **Fresh homes** as pushes, Q10 the default `'/'`, Q11 the probe's fourth
spelling, Q12 no prototype amendment, Q13 nothing for the shell to change, Q14
the vocabulary. The rule is complete, too, and this was checked rather than
assumed: every `navigate(` left in shipping code is either an _arrival_ — a
card, Play, _Edit details_, the gear, the logo, the Library rows — or one of
the two **Fresh homes**.

4783 tests pass across 247 files, from 4748 across 247 before the initiative;
`tsc -b` and `eslint src server` are clean. Nothing in this round moves a
pixel, changes a wire or changes what any press does.

What is left is of the usual kind: three names that predate the vocabulary the
round created, one route spelled five ways, and four structural guards where
one is enough.

### 1. The movie page's route is spelled five times, and this round added one

`Player.tsx` has a private `moviePath(movieId)` — `encodeURIComponent`, one
caller, a docblock that now explains the **Landing**. `useMovieForm.ts` has a
private `afterEdit(id)` that builds the same route without encoding it. The
browse home and the genre grid each build it inline, encoded, to open a card.
The movie page builds the player's route from it unencoded, inline. Five
spellings of `/movie/<id>`, three of them encoding and two not.

No bug is being fixed here: a movie id is an RFC-4122 UUID minted by
`randomUUID()`, so every character of it is already URL-safe and all five
spellings agree today. What is wrong is that the round made two screens name
the _same destination_ — the film's page is the player's **Landing** and the
edit job's — in two files, in two spellings, with no link between them, and the
next screen to need it would make a sixth. The project has a rule for exactly
this: a call moves up a rung when a second feature asks for it. Four features
ask for this one.

### 2. The form's constants are named for the saves they used to follow

`useMovieForm` carries `AFTER_ADD`, `AFTER_ADD_FALLBACK`, `AFTER_RESOLVE` and
`afterEdit`. Before this round every one of them was "where this save goes".
After it, only the first still is — and it is the thing the glossary now calls
a **Fresh home**. The other three are **Landings**: routes taken only when a
deep link left no history to step onto. The docblocks say so in as many words —
`AFTER_RESOLVE`'s opens _"It is a landing and nothing else"_ — which is a
comment apologising for a name. The vocabulary exists, it is in the glossary,
and this file is the one place in the app where three **Landings** sit together.

`const back = goBack;` in the same file is a line that renames nothing: the
hook's callback goes out under the member's name a few lines later anyway.

### 3. Four structural guards, three of which repeat a press in the same file

`Player.test.tsx`, `ImportFlow.test.tsx` and `MovieForm.test.tsx` each end with
a test that reads its own shipping file off disk and counts `navigate(`. Each
claim is already made, in the same file, by a press: Back is a `POP`, Escape is
the same handler, _Finish_ and _Add to library_ are `PUSH`es to `/`, and every
other leaving is a `POP` onto a named URL. The scans add no coverage; they add
coupling — to the file's path, to how many times the word appears, and to
prose, because they match raw source. The initiative's own docblocks are full
of sentences about pushing and stepping, and one of them writing `navigate('/')`
in prose would fail a test about behaviour that had not changed.

The fourth guard is different in kind and worth keeping: `useGoBack.test.tsx`
walks every shipping file under `src/` and asserts that `navigate(-1)` appears
in exactly one of them, and that no file puts a `from` in route state. That is
the initiative's closing claim — _one Back rule_ — and no press can make it.

### 4. The guard that stays reads comments, and its walker already exists

`useGoBack.test.tsx` matches raw text, so a comment that mentions `navigate(-1)`
— exactly the kind of comment this initiative added — would fail it.
`usePlayback.test.ts` solved that in #87 for the player feature's duration
rule: it has a `withoutComments` and a `sourceFiles` walker, and matches the
stripped text. So the codebase now walks its own shipping sources in two files,
in two spellings, one comment-blind and one not. This is the shape #164 and
#169 already settled twice: when two suites hand-roll the same double, it
becomes one `test-support/` unit with its own test and both suites read it.

### 5. The probe's newest spelling is hand-read in four suites

`navigationType` is fetched with the same `getByTestId(...).textContent` line in
`useGoBack`, `Player`, `ImportFlow` and `MovieForm` tests. The probe is a
`test-support/` unit and can hand its reader out the way `fakeResponse` hands
out `fileResponse` and `snackbarStack` hands out a node reached by geometry.
(The three older spellings are read this way in twenty-four files; that sweep is
its own mechanical issue and not this one — see _Out of scope_.)

### 6. App's four journeys press Back four ways

`App.test.tsx` gained four `describe` blocks — the player, Import, an edit and a
Resolve — and only the first defines a `pressBack`. The other three inline the
same `fireEvent.click(screen.getByRole('button', { name: 'Back' }))`, once or
twice each. The file already keeps `renderApp`, `cardFor`, `currentPath` and
`currentSearch` at the top for every block to share.

### 7. The documents that close the initiative (issue 176, folded in here)

The glossary's five new rows — **Back rule**, **History step**, **Leaving**,
**Landing**, **Fresh home** — were written at grill time and have not been read
against the shipped code. CLAUDE.md's `hooks/` line still describes a hook with
no parameter, and neither map names `LocationProbe` among the frontend's test
doubles, though every routing suite in the app uses it. The journal has no entry
for the initiative. And the feature row is still `🔜 3 — next` in both files,
which is right: a feature is Done only after its refactor.

## Solution

Five groups, each leaving a working tree after every commit: the record of the
build first, so the journal describes what shipped before this round edits it;
the one route spelling second, because it is the only change that touches
screens; the form's words third; the tests fourth, where most of the round is;
the documents last, because the folder map has to describe the tree the earlier
groups leave. Thirteen commits. Nothing the family or the maintainer can see
changes, and no behaviour test's meaning changes — three tests are deleted as
duplicative, and two new units bring their own.

## Commits

### Group 0 — the record of what was built

1. **The journal's back-navigation entry.** `docs/dev-journal.md` gets the
   initiative's entry, dated by the last build commit (2026-09-22): what
   shipped across 171–175, slice by slice — the hook's parameter and the
   probe's fourth spelling, the player, Import, the form's **Landing**, the
   form in **Import context**; that the bug was invisible until the _second_
   press, which is why it outlived three initiatives and why the probe's new
   spelling is what makes it assertable; that it was found by auditing the
   build against the prototype rather than by reading the prototype for
   something new; that the prototype needed no amendment, because push-versus-
   step is a distinction a stateless screen switcher cannot draw and log 04 Q13
   had already settled how that distinction is translated; the three journeys
   reproduced in the browser on 2026-09-21 and where each one now lives as a
   test; that `useDeleteMovie` and `useRestoredScroll` were fixed by not being
   touched; the judgment calls the subagents made alone that the log did not
   name — `formLanding` where the log sketched `landingFor`, the journeys
   placed in `App.test.tsx` as well as in the screens' own suites because in
   each of them the second press belongs to a different screen, and the three
   per-file source scans this round removes; what was deliberately not built (a
   second hook, a `from` in route state, a replace anywhere, browser-chrome
   handling, any prototype edit); the test count (4783 across 247, from 4748
   across 247); and the follow-ups, by bare number.

### Group 1 — one spelling of the movie page's route

2. **`utils/moviePath/` — the film's page, as a route.** A new pure helper on
   `toGenreQueryParams`'s shape: an id in, `/movie/<id>` out, the id encoded
   because an id on its way into a URL is encoded wherever the app already does
   it, with a docblock saying that the encoding is consistency rather than a
   live need, since ids are UUIDs. Its own test file, as every `src/utils/`
   helper has: a plain id, an id holding a character that must travel encoded,
   and an empty id, which is a route to nowhere rather than a route to the
   library. Added to the `utils/` barrel. No caller yet in this commit; the
   tree is green.

3. **The four callers read it, and the five spellings become one.** `Player`'s
   private `moviePath` goes and `leave` takes the helper — the **Landing**
   paragraph that sat on the private function moves onto `leave`, where the
   rule it explains actually lives. `useMovieForm`'s `afterEdit` goes the same
   way. `HomeRows`' `openMovie` and `GenreGrid`'s `onOpenMovie` read it instead
   of building the string. `MovieDetail`'s Play builds the player's route from
   it, so the last unencoded id in a route goes with the rest. `HomeRows`'
   `genrePath` stays exactly where it is: one caller, and it carries a sort the
   home is the only screen that knows about. No test changes — every one of
   these is asserted through a URL that does not move.

### Group 2 — the form says what the glossary says

4. **The form's routes are a Fresh home and three Landings.** In
   `useMovieForm`: `AFTER_ADD` becomes `FRESH_HOME`, `AFTER_ADD_FALLBACK`
   becomes `ADD_LANDING`, `AFTER_RESOLVE` becomes `REVIEW_LANDING`, and the
   edit **Landing** is `moviePath(...)` from Group 1. `formLanding`'s docblock
   keeps its two reasons — the URL over fetched state, and `?problem=` winning
   over `?movie=` — and `REVIEW_LANDING`'s loses the sentence apologising for
   its name. Names and comments only; no behaviour, no test changes.

5. **`back` is the hook's own callback.** The `const back = goBack;` line goes
   and the returned member is `back: goBack`, with the docblock that explained
   the alias kept on the member it describes.

### Group 3 — one structural guard, on a helper two suites share

6. **`test-support/shippingSources/` — every file that ships, and what is in
   its code.** A new test-support unit on `stubScrollTo`'s and `snackbarStack`'s
   shape: a walk of the `.ts`/`.tsx` files under a root that are neither tests
   nor `test-support/`, a comment stripper, and a matcher returning the shipping
   files whose _code_ matches a pattern — by path, so a failure names them. Its
   own test file: a pattern matching one known file finds it and nothing else, a
   pattern that appears only inside a `//` line or a `/* */` block finds
   nothing, a test file holding the pattern is not returned, and neither is a
   file under `test-support/`. No caller yet; the tree is green.

7. **The two suites read the helper, and the copies go.** `useGoBack.test.tsx`
   drops its `shippingSources`/`filesMatching` pair and its two guards read the
   helper — which also makes them comment-blind, so the prose this initiative
   added may say `navigate(-1)` without failing a test about code.
   `usePlayback.test.ts` drops its `sourceFiles`/`withoutComments` pair and its
   duration rule reads the helper, rooted at the player feature as it is today.
   Both leaves keep their names and their meaning.

8. **Three per-file source scans go.** The last test of `Player.test.tsx`,
   `ImportFlow.test.tsx` and `MovieForm.test.tsx` — each reading its own
   shipping file and counting `navigate(` — is deleted, along with the
   `node:fs` import each one needed for it. Every claim they made is left
   standing by a press in the same file, and the docblock above each suite says
   which press carries it. The one repo-wide guard in the hook's suite is
   untouched.

9. **The probe hands out its newest reader.** `LocationProbe`'s unit exports a
   `navigationType()` reader beside the component, on `fakeResponse`'s
   precedent of a unit with a second export; its own suite gains a leaf for it.
   `useGoBack`, `Player`, `ImportFlow` and `MovieForm` tests read it and drop
   their four copies of the same line. The three older spellings stay as they
   are read today, here and in the twenty other suites.

10. **App's journeys press Back the same way.** `pressBack` moves from the
    player journey's block to the file's own helpers, beside `renderApp` and
    `cardFor`, and the Import, edit and Resolve blocks use it. No leaf's name
    or meaning changes.

### Group 4 — the documents that close the initiative

11. **The glossary checked against what shipped.** **Back rule**, **History
    step**, **Leaving**, **Landing** and **Fresh home**, and the three
    relationship lines that name them, read row by row against the code and
    left as written where they hold. The _Flagged ambiguities_ list gains the
    round's entry on 164's and 169's shape: that log 20's design sketch wrote
    `landingFor` where the code says `formLanding` — kept, because it names the
    concept and reads as the form's own; that the log placed the three journeys
    "in the screens' own suites" and the build put them in `App.test.tsx` as
    well, because in each of them the second press belongs to a different
    screen and only the router composed in `App` has both; and that `fallback`
    remains the hook's parameter name against **Landing** as the concept's,
    which the glossary already rules and this round does not reopen.

12. **CLAUDE.md's folder map and README's tree.** The `hooks/` line becomes
    `useGoBack(fallback)` — the one **Back rule**, a **History step** with the
    screen's own **Landing** behind it — beside `useRestoredScroll`; `utils/`
    gains `moviePath/`; `test-support/` gains `LocationProbe/` (the four
    spellings, `navigationType` among them, and its reader) and
    `shippingSources/` (the shipping-source walk the structural guards read).
    README's tree in the same three places. Both files tracked, on 141's
    precedent.

13. **The journal's paragraph and the tick.** The round's own journal entry —
    what each group changed, the test count before and after, what was
    deliberately left, in the shape the decision document below gives. Then the
    tick: **Back navigation** ✅ in README's and CLAUDE.md's feature lists, the
    build-order chain in both files losing step 3, the remaining six keeping
    their numbers and their gates, and **Motion & interaction states** becoming
    "next". Closes this issue; 170 closed by comment alongside — by bare
    number, never a closing keyword. 176 was already closed as folded in when
    this plan was filed. _(The closure is done at closing time, not as a
    commit.)_

## Decision Document

- **A route is a unit, and the rung is `utils/`.** The film's page is named by
  four features — the browse home, the genre grid, the player's **Landing** and
  the form's edit **Landing** — and the project's own rule for a call with a
  second caller is that it moves up. `utils/` is where a pure string helper
  lives and where the two query serialisers already live; a new category folder
  for routes would be the `services/` catch-all the architecture rules forbid,
  for one function.
- **One caller keeps its helper.** The genre page's route stays in `HomeRows`
  (it carries a sort only the home knows) and the player's route stays at the
  movie page's Play button — built on the shared helper, but the `/play` suffix
  is that screen's own. The same rule that moves `moviePath` up keeps these
  down, and it is the `api/` rule read the other way round.
- **Encoding is consistency, not a fix.** Movie ids are RFC-4122 UUIDs, so
  every current spelling is correct today. The helper encodes because three of
  the five spellings already did, and because the next id-shaped thing in a
  route may not be a UUID.
- **The glossary's words win over the build's.** `FRESH_HOME`, `ADD_LANDING`
  and `REVIEW_LANDING` are the vocabulary the grill settled; `AFTER_*` was the
  vocabulary from before there was one. `formLanding` keeps the name the build
  gave it rather than the log's sketched `landingFor`, and the glossary records
  the difference so the next reader of the sketch knows which of the two is a
  decision.
- **`fallback` stays the hook's parameter.** The glossary already ruled this at
  grill time — _say **Landing** when talking about where a screen goes,
  `fallback` only when reading the signature_ — and a rename would touch the
  hook's docblock, its suite and nothing else, while making the log, the PRD
  and the glossary all wrong at once.
- **One structural guard, and it is the one no press can make.** "Only one file
  steps back through history" and "no screen carries a `from`" are claims about
  what the codebase does _not_ contain, and they belong beside the hook that is
  the exception. "This screen's Back is a step" is a claim about a press, and it
  belongs in that screen's suite as a press. Where the two overlapped, the press
  wins and the scan goes.
- **A structural guard reads code, not prose.** Every source-matching test in
  the codebase strips comments after this round, because a codebase whose
  docblocks discuss the very pattern being guarded will otherwise fail tests for
  sentences.
- **The test double grows the reader, not the suites.** A `test-support/` unit
  that renders something for suites to assert on can hand out the accessor for
  it; `fakeResponse` and `snackbarStack` are the precedent, and #164 and #169
  are the precedent for extracting it the moment a second suite writes the same
  line.
- **Nothing the maintainer or the family can see changes.** No route, no press,
  no **Landing**, no order, no pixel. If something behaves differently after
  this round, that is a bug in the round.

## Testing Decisions

- **A good test here asserts what a press does, not what a file contains.**
  Every **Leaving** in the app is a control somebody presses, and the observable
  result is a URL _and_ how the router reached it — exactly the pair the probe
  now spells. The three tests this round deletes assert the shape of a source
  file; the tests they leave behind assert a press, and they were green through
  the same build.
- **The two new units get the tests their rung requires.** `moviePath` is a
  `src/utils/` helper, so it has a test file — the project's rule is that every
  util does. `shippingSources` is a `test-support/` unit, so it has one for the
  same reason `stubScrollTo`, `stubFullscreen` and `snackbarStack` do: a double
  that lies is worse than no double, and its comment-stripping is the half the
  older copy lacked.
- **No behaviour test is rewritten, renamed or re-scoped.** The suites of the
  five screens the initiative touched keep every leaf they have, including the
  journeys in `App.test.tsx` and the two-press journeys in `Player.test.tsx` and
  `ImportFlow.test.tsx`. Groups 1 and 2 are a rename and a move, and the tests
  that cover them are the ones already asserting the URLs those names produce.
- **Prior art.** `usePlayback.test.ts`'s duration rule, for a structural guard
  that reads shipping source; `stubScrollTo` (#169) and `snackbarStack` (#164),
  for extracting a double two suites wrote twice; `fakeResponse`, for a
  test-support unit with more than one export; `toGenreQueryParams` and
  `formatBytes`, for a pure helper with its own folder, its own test and a line
  in the barrel.
- **The round is finished when `node_modules/.bin/vitest run`,
  `node_modules/.bin/tsc -b tsconfig.json` and
  `node_modules/.bin/eslint src server` are all clean**, with the count moved
  only by the two new units' leaves and the three deleted scans.

## Out of Scope

- **The twenty-four suites that read `pathname`, `search` and `url` by hand.**
  Forty-three occurrences, all older than this initiative, all working. Handing
  those three readers out of the probe and sweeping the suites is mechanical,
  touches a quarter of the frontend's test files, and is its own issue; this
  round moves only the spelling it added.
- **Renaming the hook's `fallback` parameter.** Settled in the glossary at grill
  time; reopening it would make three documents wrong to make one signature
  prettier.
- **`encodeURIComponent` on the two query parameters** — the ⋯ menu's `?movie=`
  and the Review row's `?problem=`. Same class as the route spellings, same
  absence of a live bug (both are UUIDs), but they are a query string rather
  than a path and neither is a **Landing**; filed as a follow-up rather than
  done here.
- **`docs/handoff/` — no prototype amendment.** The PRD and the log are
  explicit: push versus step is not a distinction the prototype can draw, and
  COMPONENT-SPEC describes no navigation, so there is nothing in the handoff
  this round could make more true.
- **`useDeleteMovie`, `useRestoredScroll`, `GenreLayout`, `MoviePage` and
  `SettingsHeader`.** Untouched by the build on purpose and untouched here: the
  fix was where the bug was, and these are the screens that already had the rule
  right.
- **Browser-chrome Back, and anything the Electron shell adds.** The app draws
  no chrome, and the shell is step 7.
- **Series' and Enrichment's landings.** They inherit the rule when they are
  built — `backFromSeries`, `backFromSeason` and `backFromEnrich` are steps with
  a **Landing** each — which is why this was step 3 and they are 5 and 6.

## Further Notes

- **The follow-ups this round files rather than fixes**: the probe's three older
  readers across twenty-four suites, and the two unencoded query parameters.
  Both are mechanical, neither is a defect today, and both are cheaper as their
  own issue than as a widening of a refactor round.
- **What the next initiative inherits.** After this round there is one spelling
  of the film's route, one place a **History step** may appear, one walk over
  shipping source, and a probe that can say how the router arrived. Series is
  the first test of all four: it adds an episode route, three screens with three
  **Landings**, and a player that leaves to a season rather than a movie. If its
  Backs are steps with a landing each on the day they are written, this round
  did its job.
- **Why the scans were written in the first place.** They are not a mistake so
  much as a build doing the right thing with one issue in front of it: each
  slice was asked to prove its screen no longer pushed, and reading the file was
  the most direct proof available inside that slice. Only from above the whole
  initiative is it visible that the presses in the same files already said it,
  and that one guard beside the hook says the part they could not.
