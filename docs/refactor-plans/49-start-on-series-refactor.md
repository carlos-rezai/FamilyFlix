# Refactor plan: Start on Series, one guard per build target, one spelling of the Library tab, a hook named for what it answers, and the docs that close the initiative

> Source initiative: `start-on-series`, issue 425 (step 32).
> Shipped by issues 426–432. The prototype revision is 426 `add62d8` and
> 427 `6f1a869`; the build slices, RED and GREEN each, are 428
> `df9c844`/`a1b0c97`, 429 `cf680c8`/`78e935c`, 430 `8f6c0f9`/`bc33a47`,
> 431 `2b84abb`/`df1ce3f`, 432 `8c5db49`/`39adc9d`.
> Design log: `docs/design-logs/49-start-on-series.md`. PRD:
> `docs/PRDs/49-start-on-series.md` (425). Plan:
> `docs/PRDs/49-start-on-series-plan.md`.
> This is the initiative's closing round. It ticks **Start on Series** and
> closes 425. Filed as issue 433.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`start-on-series` shipped every slice of log 49's implementation plan. At
`39adc9d` the full suite has **10653 tests, all passing**. `tsc -b --force`
is clean. `eslint src server electron` reports one error and 150 warnings,
against one error and 148 warnings when Add a show folder closed. The two new
warnings are both in this initiative's files:

- `react-hooks/exhaustive-deps` on `navigate` in `useStartTab`;
- `react/jsx-no-useless-fragment` in `StartTabGate`.

The design held: the **Start tab** is a `LibraryTab`, not a flag; the server
stores it under `start-tab` and reads nonsense as Movies; the Display group
holds it beside the two flags over one `useHeldValue<T>` bargain; the
**Launch entry** alone is replaced onto the Series tab, by the library, on
the client, with nothing drawn first.

The five build slices were built one at a time by agents that each saw one
slice, and the seams show. Every finding below was checked against the code
for this plan. They fall into five families.

### 1. A guard in the shared types, against a documented rule

- **`isLibraryTab` is the only function in `src/types/`.** Every other file
  there holds lists, unions, defaults and interfaces. The guard's twin,
  `isMovieSort`, lives in `src/utils/isMovieSort/` with its own test.
- **The server imports it from the shared types.** The routes file already
  settled this question for `isMovieSort`, in writing: the server build
  includes the shared types and nothing else of the frontend, so the server
  keeps its own one-line guard over the shared list; "the vocabulary was the
  duplication that mattered". `start-tab` reversed that silently, in two
  places: the route's refusal and the repository's read.
- **The guard's test lives in the wrong suite.** Its rows (and a row pinning
  `LIBRARY_TABS`' order) sit in the server's `settings.test.ts`, under a
  describe about the shared types, though the repository is only one of
  three callers. CLAUDE.md asks that every `src/utils/` function has a test
  of its own.
- **The repository spells its read in a shape of its own.** Every other
  preference is read inline in `settings()` through a helper (`valueOf`,
  `flagOf`). The Start tab has a private `startTab()` function instead, and
  it and `setStartTab` sit between `settings()` and `setUltrawideMargins`,
  out of the order the interface lists them in.
- **The route is the only settings write without its comment.** Its four
  siblings each say what a valid body is and why. `start-tab` says nothing.

### 2. The Library tab, spelled four ways

The PRD's story 34: _the two tabs spelled once as a list the type is derived
from, so that the Library tabs, the route and the Settings row can't drift._
That holds for the type, not for its readers:

- **The labelled options are spelled twice.** `LibraryTabs` builds its pills
  from `LIBRARY_TABS` and an exhaustive `Record<LibraryTab, string>`, the
  `sortOptions` way. `DisplaySection`'s `START_TABS` is a hand-written
  literal list with its own `Movies` / `Series` labels. Log 49 Q16 chose the
  same switch on purpose, so the two can only drift by accident.
- **The URL's tab is read as a string comparison in four places, across two
  features**: `LibraryBody`, `LibraryTabs`, `LibrarySearch` and
  `useGenreList` each repeat `searchParams.get('tab') === 'series'`, and
  `LibraryTabs` turns it back into `'series' : 'movies'` by hand. None of
  them names `LibraryTab`, so the type the initiative introduced reaches the
  wire and the Settings row but not the four places that read it.
  CLAUDE.md: a hook two features use lives in `src/hooks/`.

### 3. A hook named for something it does not answer

- **`useStartTab()` answers a boolean**, "the browse home may draw". Every
  other `use<Noun>` hook in the app answers that noun:
  `useDisplayPreference`, `useSettings`, `useGenreList`, and the nearest
  twin, `useTmdbRatings(): boolean`, which answers the TMDB ratings flag. A
  reader of `LibraryPage` or the glossary expects `useStartTab()` to answer
  the **Start tab**. The boolean hooks that name a condition, like
  `useKeyStored`, name it in full.
- **The Launch entry's key is a bare `'default'`.** `useGoBack` reads the same
  React Router fact through a named, documented `NO_HISTORY` constant.
- **The effect leaves `navigate` out of its dependencies**, with a comment
  instead of a reason the linter accepts. `useGoBack` and `EnrichmentFlow`
  both list `navigate`. In React Router 6.30 a non-data router keeps
  `navigate` stable while the pathname holds, and the replace keeps `/`, so
  listing it costs nothing, and the once-per-mount leaf already proves it.
- **`StartTabGate` wraps its children in a fragment** it does not need.

### 4. Prose this initiative wrote against the house rules

- **The provider's docblock was edited mid-sentence and never rewrapped.**
  `DisplayPreferenceProvider`'s docblock now breaks after "a flip on the" /
  "Settings page reaches" / "the **Content frame**"; `useDisplayPreference`'s
  breaks after "startTab, setStartTab }` off".
- **`saveStartTab`'s docblock lost its twin's second sentence**, the one
  saying where the read it pairs with lives and why.
- **24 em dashes were added to code on 2026-10-22**, a day after the rule
  against them: in the docblocks above, in eight new suites' header comments
  (an em dash after `49`, before _Start on Series, Phase n_) and in twelve
  new `describe` and `it` titles. The provider's suite already wrote its
  header with commas, so the initiative disagrees with itself.

### 5. Every new preference touches twenty suites

- **Of the 29 test files the build touched, nineteen changed only to add one
  line**: `startTab: 'movies'` to every `Settings` literal, or
  `startTab: null, setStartTab` to every hand-built `DisplayPreferenceApi`.
- **There are 61 `Settings` literals across 19 suites**, 39 of them on the
  client, and **six local factories** that build one: three
  `household(overrides)` in the player's suites, each identical, and three
  `settingsWith(startTab)` this initiative added to `useStartTab`,
  `StartTabGate` and `LibraryPage`'s suites.
- **Nine suites hand-build a `DisplayPreferenceApi`**, each spelling all six
  members to set the one it cares about.
- The codebase answered this exact shape once already: `makeMovie` replaced
  "the twelve identical local factories" with one builder in
  `test-support/`, overrides at the call site. Log 27's refactor named the
  fixture cost and fixed its cause in the hook, but the next two preferences
  paid it again.

## Solution

One round, in five groups, each commit leaving the suite green and the
typecheck clean:

1. **One guard per build target.** The repository reads the Start tab
   through a `choiceOf` helper beside `flagOf`; the route keeps its own
   `isLibraryTab` beside `isMovieSort`, under the same note, with the comment
   its siblings carry.
2. **One spelling of the Library tab on the client.** A `libraryTabOptions()`
   util draws both switches; `isLibraryTab` leaves the shared types for
   `src/utils/`; a `useLibraryTab()` hook in `src/hooks/` is the one reader
   of `tab` for the library and search features.
3. **The launch, named for what it answers.** `useStartTab` becomes
   `useStartTabSettled`; its key is named; `navigate` joins its
   dependencies; the gate returns its children.
4. **The prose.** The two docblocks rewrapped, `saveStartTab`'s sentence
   back, and the initiative's 24 em dashes rewritten.
5. **Test builders.** `makeSettings` and `makeDisplayPreferenceApi` in
   `src/test-support/`, `makeMovie`'s shape, replacing the six local
   factories and every client fixture, so the next preference adds one line
   to each builder.

Then the docs that close the initiative and the journal.

Nothing a household sees changes. No wire, schema or prototype changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [start-on-series] issue #433 …`, except where a commit is named
`docs:`. The test builder commits are `refactor:`, not `test:`, on purpose:
a `test:` commit typechecks only the shipping projects, and these commits
change nothing else.

### Group 1: one guard per build target (server)

1. **The repository reads a choice the way it reads a flag.**
   - `library/settings` gains a private `choiceOf(key, choices, fallback)`
     beside `flagOf`: the stored value when it is one of `choices`, else
     `fallback`. It finds the stored string in the list, so it answers the
     list's own type with no cast and no guard function.
   - `settings()` reads `startTab: choiceOf(START_TAB_KEY, LIBRARY_TABS,
DEFAULT_START_TAB)` inline, like its siblings. The private `startTab()`
     goes.
   - `setStartTab` moves below `setTmdbRatings`, the order the interface and
     the returned object list them in.
   - The repository no longer imports `isLibraryTab`.
   - Guarded by the module's existing Start tab leaves: the default, the
     round trip, the three hand-stored nonsense values read as Movies, and
     the reset. No test changes.

2. **The route keeps its own guard, and says what a valid body is.**
   - `routes/index.ts` gains a private `isLibraryTab(value: unknown)` beside
     `isMovieSort`, over the shared `LIBRARY_TABS`. `isMovieSort`'s note
     ("the guard itself stays local …") is widened to speak for both guards
     rather than repeated.
   - The `start-tab` route gains its siblings' comment: the Start tab, the
     `tmdb-ratings` route's sibling, the same Single-signal write; a valid
     body is exactly one of the **Library tabs**, so case, an unknown name
     and a non-string are refused, not coerced.
   - The refusal's text stays derived from the list.
   - The routes file no longer imports `isLibraryTab`.
   - Guarded by `routes.settings.test.ts`' `start-tab` block: both tabs
     echoed, the seven refused bodies, nothing stored on a refusal. No test
     changes.

### Group 2: one spelling of the Library tab (client)

3. **`libraryTabOptions()` draws both switches.**
   - A new util, `src/utils/libraryTabOptions/`, exports
     `libraryTabOptions()`: the **Library tabs** as `PillTabs` options, in
     `LIBRARY_TABS`' order, labelled from one exhaustive
     `Record<LibraryTab, string>`. That is `LibraryTabs`' current `LABELS`
     and `TABS`, moved, and `sortOptions`' shape: the compiler asks a third
     tab for its label.
   - `LibraryTabs` and `DisplaySection` both pass `libraryTabOptions()`;
     `LibraryTabs`' `LABELS`/`TABS` and `DisplaySection`'s `START_TABS` go.
   - The util is exported from the `utils/` barrel.
   - `libraryTabOptions.test.ts` is born with three rows: Movies then
     Series, by value; their labels; and one option per member of
     `LIBRARY_TABS`. The server suite's "lists Movies then Series" row goes,
     since this test pins the order where it is drawn.
   - Guarded by `LibraryTabs`' and `DisplaySection`'s suites, unchanged.

4. **`isLibraryTab` is a util, with its own test.**
   - A new util, `src/utils/isLibraryTab/`, exports `isLibraryTab(value:
unknown): value is LibraryTab`, moved from `src/types/browse.ts`. Its
     docblock follows `isMovieSort`'s: why a util, and that it checks the
     shared list. It takes `unknown` (not `string`, as `isMovieSort` does)
     because one caller checks a wire echo.
   - `src/types/browse.ts` and the types barrel lose it; the types are
     declarations again.
   - `saveStartTab` imports it from `@/utils`.
   - `isLibraryTab.test.ts` is born with the server suite's rows, moved:
     both tabs recognised; an unknown name, a different case, an empty
     string, a number, a null and an absent value refused.
   - The server suite's "the Library tabs" describe goes. Its last row, the
     default being a member of the list, folds into the repository's
     existing "answers movies on a fresh database" leaf.

5. **`useLibraryTab()` reads `tab` for the library feature.**
   - A new hook, `src/hooks/useLibraryTab/`, answers the **Library tab** the
     URL names: `tab` when `isLibraryTab` accepts it, else `'movies'`, the
     tab the URL omits. Same behaviour as today's comparisons, given two
     tabs.
   - `LibraryBody` and `LibraryTabs` read through it. `LibraryTabs` keeps
     `useSearchParams` only if it still needs it for the writer (it does
     not: the writer is `useQueryParamWriter`).
   - `useLibraryTab.test.tsx`, over a memory router, is born with these rows:
     no `tab`, `tab=series`, `tab=movies`, an unknown `tab`, a different
     case, and a `tab` beside other parameters.
   - Guarded by `LibraryBody`'s, `LibraryTabs`' and `LibraryPage`'s suites,
     unchanged.

6. **The search feature reads `tab` through the same hook.**
   - `LibrarySearch`'s placeholder and `useGenreList`'s `series` read
     `useLibraryTab() === 'series'`. Neither keeps `useSearchParams` for the
     tab.
   - The hook now has its second feature, which is why it is in
     `src/hooks/`. `useGoBack`'s docblock sets the precedent of saying so;
     this one says the same.
   - `ManageLibrary`'s `tab` is not this vocabulary (its values are the
     **Kind**'s `movie` / `series`) and is untouched.
   - Guarded by `LibrarySearch`'s and `useGenreList`'s suites, unchanged.

### Group 3: the launch, named for what it answers

7. **`useStartTab` becomes `useStartTabSettled`.**
   - The folder, the file, the export and the suite are renamed;
     `StartTabGate` imports the new name. The docblock's first line says
     what `true` means: the **Launch entry** has been settled (read and, for
     Series, replaced) or there was none to settle.
   - The suite's describes and header name the new hook. No row changes.
   - The glossary follows in commit 14.

8. **The Launch entry's key is named, and `navigate` is a dependency.**
   - A module constant names React Router's first-entry key, with
     `useGoBack`'s `NO_HISTORY` docblock as its model. It stays local, not
     shared with `useGoBack`: the two hooks ask different questions of one
     fact, and an export across `hooks/` and a feature for one string would
     cost more than it saves.
   - The effect lists `onLaunchEntry` and `navigate`; the comment excusing
     the omission goes. The `exhaustive-deps` warning goes with it.
   - Guarded by the suite's "reads the settings route once per mount" leaf
     and the gate's "never on bare /" leaf. If either goes red, the fix is a
     ref that marks the read as started, not dropping the dependency again.

9. **`StartTabGate` returns its children.**
   - `allowed ? children : null`. The `jsx-no-useless-fragment` warning
     goes.
   - Guarded by `StartTabGate`'s and `LibraryPage`'s suites, unchanged.

### Group 4: the prose

10. **The docblocks say it once, wrapped.**
    - `DisplayPreferenceProvider`'s and `useDisplayPreference`'s docblocks
      are rewrapped, with no em dashes in the sentences they touch.
    - `saveStartTab`'s docblock gains its twin's second sentence: the read it
      pairs with, `fetchSettings`, lives in `src/api/` because the player and
      the gate ask for it too.
    - No code changes.

11. **The initiative's em dashes go.**
    - Every em dash this initiative added to code, 24 of them, is rewritten
      by sense: a suite header's em dash after `49` becomes a comma
      (`49, Start on Series, Phase n`), the provider suite's own form; a title's
      aside becomes a comma or a colon.
    - That includes the twelve new `describe` and `it` titles. Their older
      neighbours in the same files keep theirs until the repo-wide pass.
    - The en dashes in ranges (`426–432`) stay.
    - No code changes; every suite passes with the same count.

### Group 5: test builders

12. **`makeSettings` replaces the six local factories.**
    - A new builder, `src/test-support/makeSettings/`, answers a complete
      `Settings` with overrides, `makeMovie`'s shape. Its specimen is the
      household's defaults, built from the shared `DEFAULT_*` constants, so a
      new preference's default is spelled once.
    - `makeSettings.test.ts`, `makeMovie.test.ts`'s shape: the defaults, an
      override, and that every key of `Settings` is present.
    - The player's three `household(overrides)` and the three
      `settingsWith(startTab)` go; their call sites call `makeSettings`.

13. **The client's `Settings` fixtures use the builder.**
    - Every remaining `Settings` literal in a client suite becomes
      `makeSettings({ … })`, naming only what that test cares about. That is
      33 sites in `App/`, `api/`, `features/settings/`,
      `features/movie-form/`, `features/player/` and `pages/`.
    - If one commit is too large to review, split it by folder; each part is
      independent.
    - Server suites are untouched: there the literal is the assertion that
      the wire answers exactly these keys, not a fixture.

14. **`makeDisplayPreferenceApi` replaces the nine hand-built stubs.**
    - A new builder, `src/test-support/makeDisplayPreferenceApi/`, answers
      a `DisplayPreferenceApi`: every value `null` (**Blank until it
      lands**) and every setter a resolved no-op, with overrides.
    - Its own small test, the same shape as commit 12's.
    - The nine suites that hand-build one (`ContentFrame`,
      `SnackbarProvider`, `useTmdbRatings`, `GenreMovies`, `HomeRows`,
      `SeriesHome`, `MovieDetail`, `MovieForm`, `SeriesDetail`) pass only
      the member they care about.

### Group 6: the docs

15. **`docs: [start-on-series] issue #433 the docs know start on series shipped`.**
    - **Feature checklist**: the _Start on Series_ row and step 32's entry go
      ✅, rewritten to what shipped: the _Start on_ row in Settings' Display
      group, the app opening on the chosen tab with nothing drawn first, and
      every link and Back keeping its own destination.
    - **README**: the folder tree's `library/` line names the Start tab
      gate; `hooks/` gains `useLibraryTab`; `utils/` gains `isLibraryTab`
      and `libraryTabOptions`. The build order's sentence names step 32 as
      done.
    - **Glossary**: the _Start on Series_ section's "Planned (🔜)" becomes
      shipped. **Launch entry** names `useStartTabSettled`. **Library tab**
      says `isLibraryTab` and `libraryTabOptions` are in `src/utils/` and
      `useLibraryTab` reads it off the URL. The dialogue sections are
      snapshots and stay as they are.
    - **CLAUDE.md** is unchanged: its layout names no unit this round adds.

16. **`docs: [start-on-series] issue #433 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - where the round left the plan;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 425 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **One guard per build target, the `isMovieSort` precedent.** The routes
  file's written rule wins over the shortcut the build took. The shared list
  is the vocabulary; each side checks it locally. The client's guard is a
  `src/utils/` unit with its own test, like `isMovieSort`. The server's is a
  private function in the routes file, like the server's `isMovieSort`.
- **The repository needs no guard at all.** `choiceOf` finds the stored
  string in the list it is handed. It is the third read helper beside
  `valueOf` and `flagOf`, so a future choice preference reads in one line.
  It is private to the module, as `flagOf` is.
- **`isLibraryTab` takes `unknown`.** Its client callers are a wire echo
  (`postValue`'s `isEcho` takes `unknown`) and a URL parameter (`string |
null`). `isMovieSort` takes `string` because both its callers already hold
  one.
- **`libraryTabOptions()` is a function in `src/utils/`.** It is used by two
  features (library and settings), so it cannot be either's. It is a
  function, not a constant, for `sortOptions`' shape and so the barrel stays
  "pure helpers". Its labels are one exhaustive record, so a third tab
  cannot be drawn without a name.
- **`useLibraryTab()` lives in `src/hooks/`.** Two features read it (library
  and search). It answers `LibraryTab`, so its name follows the `use<Noun>`
  convention. It returns `'movies'` for anything `isLibraryTab` refuses: the
  URL writer omits `movies`, so absence is the Movies tab.
- **`useStartTabSettled`, not `useStartTab`.** A `use<Noun>` hook answers the
  noun. This one answers whether the Launch entry is settled, and the design
  log's own words for the wait are "until the read settles". `StartTabGate`
  keeps its name: it says what it gates.
- **The first-entry key stays a local constant.** It is not shared with
  `useGoBack`.
- **`navigate` is listed, not excused.** This is the codebase's own pattern
  (`useGoBack`, `EnrichmentFlow`). The once-per-mount leaf is the proof; a
  started ref is the fallback, never an omitted dependency.
- **Test builders follow `makeMovie`.** One builder per shared shape in
  `src/test-support/`, overrides at the call site, never a parameter per
  specimen. `makeSettings`' specimen is the defaults, built from
  `DEFAULT_*`. `makeDisplayPreferenceApi`'s is the blank state, the state
  every hand-built stub but the one member under test already used.
- **Server literals stay.** In `settings.test.ts` and
  `routes.settings.test.ts` the full literal is an assertion that the wire
  answers exactly these keys. A builder there would make the assertion
  agree with itself.
- **Commit types.** Fixture commits are `refactor:` so the commit gate
  typechecks the spec project too. Only the two closing commits are `docs:`.
- **No behaviour change.** Every commit is guarded by the suites that shipped
  in 428–432, and none of those suites' rows changes meaning.

## Testing Decisions

- **A good test asserts what a caller or a household sees**: the tab a URL
  names, the pills drawn and their order, the body a save posts, the screen
  drawn first at launch. It never asserts which helper ran, how a hook
  stores its state, or a fixture's shape.
- **Characterization before change.** Groups 1 and 3 change no test; they
  are guarded by the suites the build added (the repository's and the
  route's Start tab blocks, `useStartTab`'s 11 rows, `StartTabGate`'s 4,
  `LibraryPage`'s and `App`'s launch blocks). Group 2 moves rows and adds
  suites; the four readers' suites pass unchanged. Group 4 changes words.
  Group 5 changes how fixtures are built; every suite passes with the same
  count.
- **New suites:**
  - `isLibraryTab`: the rows moved from the server suite.
  - `libraryTabOptions`: order, labels, one option per tab.
  - `useLibraryTab`: six URL rows over a memory router. Prior art: the
    library feature's `LibraryTabs` suite and `LocationProbe`.
  - `makeSettings`, `makeDisplayPreferenceApi`: `makeMovie.test.ts`' shape.
- **Prior art:** `isMovieSort.test.ts` for a guard over a shared list;
  `sortOptions.test.ts` for labelled options; `makeMovie` and its test for
  the builders.
- **The gate:** `npm test` at the end of each commit, and `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at one error and 148
  warnings, the two this initiative added gone.

## Out of Scope

- **Two settings reads at launch.** The provider's and the gate's. Log 49 Q13
  chose this deliberately; changing it is a grill, not a refactor.
- **`seriesTabPath()` generalised to a path per tab.** The gate replaces onto
  the Series tab alone, and Movies is bare `/`, which three callers already
  push by name. One caller would gain nothing.
- **`ManageLibrary`'s `tab`.** It holds the **Kind** (`movie` / `series`),
  another vocabulary on another screen.
- **The URL writer's omitted default `'movies'`** in `LibraryTabs`. It is
  the URL's convention, not the Start tab's default, and the writer spells
  defaults at its call sites everywhere.
- **The route's refusal wording.** Its siblings spell a fixed string; this
  one derives the list. Both are true, and the derived form cannot drift.
- **Em dashes older than this initiative**, including the older `describe`
  titles beside the renamed ones. That is the repo-wide pass the maintainer
  has planned.
- **Held-response helpers in tests** (`held()`, `servePending()`), spelled
  per suite across the app. A builder for those is its own round.
- **Server test literals** (Decision Document).
- Anything log 49 put out of scope:
  - the logo or a Landing following the choice;
  - a third tab;
  - a remembered last tab;
  - a per-person choice;
  - any change to the shell, static serving or the handshake.

## Further Notes

- Groups 1 and 2 are the round's reason to exist. They put a documented
  architectural rule back and finish the PRD's own story 34. Group 5 is
  the one that pays off next time: the next Display preference should touch
  two builders, not nineteen suites.
- Group 2's commit 5 must land before commit 6, so the hook exists before its
  second feature uses it. Commit 3 must land before commit 4, which deletes
  the server describe that commit 3 has already thinned.
- Follow-ups this plan already sees, each for the journal, not this round:
  - a shared held-response test helper;
  - the repo-wide em dash pass;
  - from earlier entries: the sandbox teardown flake, and the lint error in
    `EnrichmentReview.test.tsx`.
