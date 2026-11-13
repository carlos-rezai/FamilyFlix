# Refactor plan: Row view, four bodies named kind then shape, one owner for each shared piece, a series shelf that settles as the movie shelf does, a Genre page whose chrome knows nothing, and the docs that close step 46

> Source initiative: `row-view`, issue 607 (step 46).
> Shipped by issues 608 to 615: the spec amended (608), the build slices 609
> to 613, RED and GREEN each, the live walk as tests (614, no GREEN needed)
> and the documents (615, `103c24ac`).
> Design log: `docs/design-logs/63-row-view.md`.
> PRD: `docs/PRDs/63-row-view.md` (607). Plan:
> `docs/PRDs/63-row-view-plan.md`.
> Handoff: `docs/handoff/handoff-row-view/README.md`.
> This is the initiative's closing round. It ticks **Row view** and closes 607. Filed as issue #616.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`row-view` shipped every phase of its plan. Either **Library tab** browses
**All** or **By genre**, chosen by the **Row view switch** and kept per tab
in the household's settings; Movies under All is `MovieGrid` over
`GET /api/movies`, Series under By genre is `SeriesRows` over
`GET /api/series/rows`, and the **Genre page** serves series under
`?tab=series`, the **Other series row**'s _View all_ included.

At `103c24ac` the full suite has **12132 tests across 794 files, all
passing** (one skipped). `tsc -b --force` is clean. `eslint src server
electron` reports **1 error and 137 warnings**, the count welcome-tune closed
on: the build added none.

The design held. What is left is what five slices built side by side leave
behind: two of four bodies off the name pattern log 63 set, constants and
helpers each owned by a unit that only happens to be first, the same three
blocks written four times, one heart rule held two ways, a layout that reads
the library, a positional helper on the server, and the documents. Every
finding below was checked against the code at `103c24ac`. They fall into
seven families.

### 1. Two bodies off the name pattern

- **Log 63 Q18 named the pattern _kind then shape_** and left the two bodies
  that existed untouched: `MovieGrid` and `SeriesRows` follow it, `HomeRows`
  (Movies By genre) and `SeriesHome` (Series All) do not. Read side by side
  in `LibraryBody`, the four are `HomeRows`, `MovieGrid`, `SeriesHome`,
  `SeriesRows`, and nothing in the first and third names says which tab or
  which view they draw. `useHomeRows` pairs with `useSeriesRows` the same
  way.
- **`GenreMovies` serves series** (the journal's first follow-up). Log 63
  Q18 kept the name _for now_ and left the rename to this round; its
  docblock still says _the name keeps Movies for now_. The glossary's
  **Title** is _a film or a series: the one word for either_.

### 2. Shared pieces owned by whichever unit came first

- **The Other rows' titles cross three units.** `OTHER_MOVIES_TITLE` is
  exported by the Genre page's provider and read by `HomeRows`;
  `OTHER_SERIES_TITLE` is exported by `SeriesRows` and read by the Genre
  page's provider. A home body imports from the genre screen and the genre
  screen imports from a series body, for one word each.
- **Genre page links are built inline twice, two ways.** `HomeRows` has a
  `genrePath` closure and a `GENRE_LESS_PATH` constant; `SeriesRows` sets
  `tab` on the genre query's params by hand off a module `SERIES_TAB`. Every
  other route the app builds is a pure util beside `moviePath`,
  `seriesPath` and `seriesTabPath`.
- **The settled query block is written four times.** `useHomeRows`,
  `useSeriesRows`, `MovieGrid` and `SeriesHome` each reduce the URL to the
  canonical string and parse it back in the same six lines; only
  `useHomeRows` explains why. The glossary already names the result, the
  **Settled query**, and its string is the **Load key**.
- **The heading and count line are styled twice and borrowed once.**
  `MovieGrid.styles` is `SeriesHome.styles` with two comments changed, and
  `SeriesRows` imports `Heading` and `Count` from `SeriesHome.styles`, the
  only cross-unit styles import in the feature apart from the grid's.
- **The skeleton grid is drawn twice.** `GenreGrid` and `MovieGrid` each
  hold a `LoadingGrid` of 12 `SkeletonCard`s on `LibraryGrid`'s `Grid`, the
  first through a `SkeletonGrid` style, the second by importing `Grid` from
  `LibraryGrid.styles` directly.
- **The shelf's 15 is spelled four times.** `FAVORITES_LIMIT = 15` in
  `MovieGrid` and in `SeriesHome`; on the server `ROW_LIMIT = 15` in the
  series browse slice beside the movie home's exported `HOME_ROW_LIMIT`.

### 3. One heart rule, held two ways

- **The series heart helpers restate the movie ones.** `useSeriesRows`
  writes `withFlag` (which is `withFavoriteInList` over series) and finds the
  hearted record across rows by hand (which is `withShelved`), because both
  movie helpers are typed to `Movie` and `HomeRow`. `MovieGrid`,
  `SeriesHome` and the Genre page's provider each write the same flag map
  inline once more.
- **A series heart does not settle the By genre shelf** (the journal's third
  follow-up). Movies By genre reads `/api/home` again once a confirmed heart
  and every save in flight have landed, because a heart puts its card at the
  shelf's front, which is not where the server's sort or its cap of 15
  would. `/api/series/rows` builds its shelf by the same rule (the caller's
  sort, capped at 15), so the reason holds word for word, and the series
  shelf keeps a hearted series at its front until the next load. The two By
  genre bodies differ in a rule the family can see, for no reason either log
  gives.

### 4. A layout that reads the library

- **`GenreLayout` reads the Library tab** (the journal's second follow-up)
  to choose Back's fallback, `/?tab=series` or `/`. A template is structure
  only (CLAUDE.md's Atomic Design table) and its own docblock says it
  _learns nothing about the library from what fills its slots_. The heading
  and the trailing controls are already slots filled by feature units.

### 5. A positional helper on the server

- **`listCapped(query, on, extra?, limit = ROW_LIMIT)`** takes an optional
  clause and a `null`-means-uncapped limit by position, so the two genre
  reads call it as `listCapped(…, undefined, null)`. Its name says capped
  and two of its five callers are not. `getSeriesHome` still writes the same
  uncapped select inline beside it. The movie home's `listSection` passes
  its options as an object.

### 6. Small tidies

- **`DisplayPreferenceProvider` lands its values out of order**: the margins'
  and ratings' `land`s are pulled out, then the two Row views are made, then
  the Start tab's `land` follows them. Each preference should read as one
  line made and one line landed, in the order the API lists them.
- **Comment lines the build left past 80 columns**: `LibraryPage`'s
  docblock, `fetchSeriesRows`' docblock, three in the Genre page's provider
  and the series browse slice's row-limit comment.

### 7. The documents

- The feature checklist's row reads _Row view: genre rows or one grid,
  Movies and Series_, 🔲 Planned, and step 46 is 🔜.
- `COMPONENT-SPEC.md` names `HomeRows` and `SeriesHome` as the units under
  the Library page.
- The release checklist has no smoke for the Row view.

## Solution

One round in seven groups, each commit leaving the suite green and the
typecheck clean:

1. **Kind then shape**: `MovieRows`, `SeriesGrid`, and the Genre page's
   `GenreTitles`.
2. **One owner for each shared piece**: the Other titles, the Genre page
   paths, the settled query, the grid heading, the skeleton grid and the 15.
3. **One heart rule**: the movie helpers made kind-neutral, the settling
   load lifted out, and the series shelf settling on it.
4. **A Genre page whose chrome knows nothing**: Back as a slot.
5. **A series list with named options** on the server.
6. **Tidies**: the provider's order and the comments.
7. **The docs that close step 46**, then the journal.

One behaviour changes, in group 3: a confirmed series heart under By genre
reloads the rows, as a movie heart under By genre does. Nothing else moves:
no wire, schema, setting, copy, prototype or drawn pixel changes, and no
route's name or payload changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [row-view] issue #616 …`, except where a commit is named `fix:`
or `docs:`.

### Group 1: kind then shape

1. **`HomeRows` becomes `MovieRows`.** The unit, its folder, its styles and
   its test; `useHomeRows` becomes `useMovieRows`, with `HomeRowsStatus` and
   `UseHomeRowsResult` as `MovieRowsStatus` and `UseMovieRowsResult`. Both
   stay in `home/`, the **Browse home**'s folder (the glossary's _grouped by
   screen_ rule). `LibraryBody` and every test that names them follow; the
   suites' `describe` titles read the new names. The wire keeps its names:
   `/api/home`, `getHome`, `HomePayload`, `fetchHomePayload`. Guarded by
   the renamed `MovieRows.test` and `useMovieRows.test`, `LibraryBody.test`,
   `LibraryPage.test` and `App.rowViewWalk`, assertions unchanged.
2. **`SeriesHome` becomes `SeriesGrid`.** The unit, its folder, its styles
   and its test, and `SeriesRows`' styles import. The wire keeps
   `/api/series`, `getSeriesHome`, `SeriesHomePayload` and
   `fetchSeriesHome`. Its docblock and `LibraryBody`'s name the four bodies
   `MovieRows`, `MovieGrid`, `SeriesGrid`, `SeriesRows`. Guarded by the
   renamed `SeriesGrid.test`, `LibraryBody.test` and the series walk suites,
   assertions unchanged.
3. **`GenreMovies` becomes `GenreTitles`.** `GenreTitlesProvider`,
   `useGenreTitles`, `GenreTitlesValue` and `GenreTitlesStatus`; the value's
   `movies` becomes `titles`, read by `GenreGrid` and `GenreHeading`. The
   docblock loses _the name keeps Movies for now_. `GenrePage` composes the
   new provider. Guarded by the renamed `GenreTitles.test`, `GenreGrid.test`,
   `GenrePage.test` and `GenrePage.series.test`, assertions unchanged.

### Group 2: one owner for each shared piece

4. **`otherRowTitle`, one place for both Other titles.** A feature module,
   `otherRowTitle(tab)`, answering _Other movies_ or _Other series_, with its
   test. `MovieRows`, `SeriesRows` and `GenreTitles` read it;
   `OTHER_MOVIES_TITLE` and `OTHER_SERIES_TITLE` and the two cross-screen
   imports go. Guarded by every suite asserting either title, unchanged.
5. **`genrePath` and `genreLessPath`, pure routes.** Two utils beside
   `seriesTabPath`, each with its test: `genrePath(genre, { sort, tab })`
   encodes the name and writes the genre query's params through
   `toGenreQueryParams`, then `tab=series` when the tab is Series; at the
   default sort and Movies it is a clean `/genre/Drama`. `genreLessPath({
sort, tab })` is the same over `/genre-less`. `MovieRows` and
   `SeriesRows` build every _View all_ through them; the `genrePath`
   closure, `GENRE_LESS_PATH`, `SERIES_TAB` and the hand-set param go.
   `MovieRows`' Other row still passes no sort, as today (see _Out of
   Scope_). Guarded by `MovieRows.test`'s and `SeriesRows.test`'s link
   cases and `App.rowViewWalk`, unchanged.
6. **`useSettledLibraryQuery`, one reading of the URL.** A feature hook
   answering `{ settled, query }`: the **Settled query** and its canonical
   string, the **Load key**. `useMovieRows`' explanation of why the string
   comes first moves into its docblock. `useMovieRows`, `useSeriesRows`,
   `MovieGrid` and `SeriesGrid` call it. Its own test: a stale, empty or
   default-spelled parameter leaves the string unchanged, and an unchanged
   string keeps the query's identity across renders. Guarded by the four
   callers' reload suites, unchanged.
7. **`LibraryGridHeading`, the heading over its count line.** A feature
   unit at the feature's top, beside `LibraryGrid`, taking `title` and
   `count` strings, with its test (a level-2 heading, the count line under
   it). `MovieGrid`, `SeriesGrid` and `SeriesRows`' empty face draw it;
   `MovieGrid.styles` and `SeriesGrid.styles` go with the cross-unit import.
   The styles are `SeriesHome`'s as they are. Guarded by every suite reading
   _All movies_, _All series_ or a count line, unchanged.
8. **`SkeletonGrid`, one loading grid.** A feature unit beside
   `SkeletonCard`, taking the status `label`, drawing 12 skeleton cards on
   `LibraryGrid`'s grid, with its test. `GenreGrid` (labelled _Loading
   {genre}_) and `MovieGrid` (_Loading your library_) draw it;
   `GenreGrid.styles` and `MovieGrid`'s import of `LibraryGrid.styles` go.
   Guarded by `GenreGrid.test`'s and `MovieGrid.test`'s loading faces,
   unchanged.
9. **One copy of the 15.** `shelvedFavorites`' module exports the shelf's
   cap, `FAVORITES_LIMIT`, read by `MovieGrid` and `SeriesGrid`, whose own
   constants go. On the server the series browse slice reads the movie
   home's `HOME_ROW_LIMIT`, and its `ROW_LIMIT` goes. Guarded by the cap
   cases in `MovieGrid.test`, `SeriesGrid.test`, `seriesRows.test` and
   `seriesGenre.test`, unchanged.

### Group 3: one heart rule

10. **The heart helpers take any title.** `withFavoriteInList` is generic
    over a record with an `id` and an `isFavorite`; `withShelved` takes the
    shelf and the records the heart can come from (the caller flattens its
    rows), generic the same way. `useMovieRows` flattens its rows and Other
    for it, as it does now inline. `useSeriesRows`' `withFlag` and its
    hand-rolled find go; `MovieGrid`, `SeriesGrid` and `GenreTitles` set
    their flags through `withFavoriteInList`. `withFavorite` over rows stays
    movie-typed: its one caller is the movie rows. Guarded by
    `withFavorite.test` (its cases unchanged, one series case added for
    each generic helper) and every heart suite, unchanged.
11. **`useRowsLoad`, the settling load, lifted out of `useMovieRows`.** A
    feature hook beside `useBrowseLoad`, over it: handed the load, the
    **Load key**, the payload's `withHeart` and the save, it answers
    `{ status, data, retry, toggleFavorite }`. It owns what `useMovieRows`
    owns today: each title's newest pending save laid over every answer,
    the count of saves in flight, and the one reload a confirmed heart
    earns once they have all landed. `useMovieRows` keeps its sections and
    its `withHeart` and calls it. No behaviour changes. Guarded by
    `useMovieRows.test`'s heart, reload and overtaken-save cases and
    `MovieRows.test`, unchanged. `useRowsLoad` keeps no suite of its own:
    the two rows hooks drive it through their public faces, as
    `useBrowseLoad` is driven.
12. **`fix: [row-view] issue #616 the series shelf settles after a heart`.**
    `useSeriesRows` loads through `useRowsLoad` with its `withHeart`, so a
    confirmed series heart under By genre reads `/api/series/rows` again
    once every save in flight has landed, and the shelf settles in the
    server's sort and cap. An un-heart and a refused heart reload nothing.
    A new `useSeriesRows.test`, in `useMovieRows.test`'s shape, pins it: one
    reload after a confirmed heart, none after an un-heart or a refusal, one
    after two quick hearts, and a heart in flight laid over a reload that
    lands before it. Lands with its test, since the old behaviour has no
    test to turn red first.

### Group 4: a Genre page whose chrome knows nothing

13. **Back becomes `GenreLayout`'s slot.** The layout takes a `back` slot
    and draws it where it draws Back today, pinned before the header; it
    loses `useGoBack`, `useLibraryTab` and `seriesTabPath`. A feature unit,
    `GenreBack`, reads the tab off `useGenreTitles` and draws the **Back
    button** over `useGoBack`, its fallback `seriesTabPath()` under Series
    and `/` under Movies. `GenrePage` composes it into the slot as it does
    `GenreHeading`. Tests: `GenreLayout.test`'s Back cases hand the slot a
    Back and assert where it is drawn; the history and fallback cases move
    to `GenreBack.test`; `GenrePage.series.test`'s Back with no history,
    unchanged, guards the join.

### Group 5: a series list with named options

14. **`listSeries(query, on, { where, limit })`.** The series browse slice's
    `listCapped` is renamed and takes its clause and its cap as named
    options, uncapped when no limit is given. The rows, Other and favorites
    pass `limit: HOME_ROW_LIMIT`; the two genre reads pass none;
    `getSeriesHome`'s inline select becomes a call to it. Guarded by
    `seriesRows.test`, `seriesGenre.test`, the series browse tests and
    `routes.seriesRows`, `routes.seriesGenre` and `routes.series`,
    unchanged.

### Group 6: tidies

15. **The provider makes and lands in one order.** `DisplayPreferenceProvider`
    makes its five held values, then pulls their five `land`s, each in the
    API's order (margins, ratings, Start tab, Movies' Row view, Series'),
    and its effect lands them in that order. Guarded by
    `DisplayPreferenceProvider.test`, unchanged.
16. **Comments rewrapped.** To 80 columns: `LibraryPage`'s docblock,
    `fetchSeriesRows`' docblock, the three long lines in `GenreTitles`, and
    the series browse slice's limit comment (after commit 14). Docblocks
    that name a renamed unit read the new name. Comments only.

### Group 7: the docs

17. **`docs: [row-view] issue #616 the docs know the Row view`.**
    - **Feature checklist**: the row reads _Row view: genre rows or one
      grid, Movies and Series_, ✅; step 46 goes ✅ with what shipped, in
      step 45's shape (_Built in issues 608 to 614; the closing round in
      issue #616_), and names the four bodies by their new names.
    - **`COMPONENT-SPEC.md`**: `MovieRows` and `SeriesGrid` in place of
      `HomeRows` and `SeriesHome`.
    - **Release checklist**: one smoke after the Series tab's, in the shell
      on the dev library with `npm run db:seed-series`: Movies switched to
      _All_ shows every film in one grid; Series switched to _By genre_
      shows a row per genre and _Other series_ last; _View all_ on a series
      row opens its series and Back returns to the rows; a heart on a
      series row lands on the shelf; quit and open: both tabs keep their
      view.
    - **Glossary**: checked against the round; no term names a renamed
      unit, and **Row view**, **Row view switch** and **Other series row**
      already say what the code does. The dialogue is a snapshot and
      stays.
18. **`docs: [row-view] issue #616 the journal`.** A newest-first entry in
    `docs/dev-journal.md`, in the last refactor entry's shape: what shipped
    before the round, what each group changed, the one behaviour change and
    why, where the round left the plan, the test count and lint against
    `103c24ac`, the follow-ups (below). The commit closes 607 in words, not
    with a keyword, and this issue with one.

## Decision Document

- **The four bodies are named kind then shape**: `MovieRows`, `MovieGrid`,
  `SeriesGrid`, `SeriesRows`, and their hooks `useMovieRows` and
  `useSeriesRows`. Log 63 Q18 set the pattern and left the rename of the
  two older bodies to this round.
- **The wire keeps its names.** `/api/home`, `getHome`, `HomePayload` and
  `fetchHomePayload` name the **Browse home**'s read; `/api/series`,
  `getSeriesHome`, `SeriesHomePayload` and `fetchSeriesHome` name the
  Series tab's. Renaming routes and payloads crosses both tiers for no
  reader on the screen, and the route comments already say which view each
  serves.
- **Folders stay by screen.** `MovieRows` and `MovieGrid` stay in `home/`,
  the series bodies in `series/`, as the glossary's _grouped by screen_ rule
  has it; the shared row pieces stay where both tabs already reach them.
- **The Genre page's provider is `GenreTitles`**, after the glossary's
  **Title**; its value's list is `titles`. It keeps holding two lists, one
  left empty per tab, because the cards are drawn per render under the
  ratings preference and each kind has its own card view.
- **New units, each in its own folder with its test**:
  `otherRowTitle` (a feature module: the copy is the library's, not a
  util's), `useSettledLibraryQuery` (feature hook; its four callers are all
  the library's), `LibraryGridHeading` and `SkeletonGrid` (feature units at
  the feature's top, beside `LibraryGrid` and `SkeletonCard`, which they
  serve), `useRowsLoad` (feature hook beside `useBrowseLoad`), `GenreBack`
  (a genre unit beside `GenreHeading`). Two utils, `genrePath` and
  `genreLessPath`, join `src/utils/` beside `seriesTabPath`, since they are
  pure routes like it. None is a molecule: each knows the library.
- **The shelf's cap has one copy per tier.** The client's lives with
  `shelvedFavorites`, the server's is `HOME_ROW_LIMIT`. The server's
  Continue cap for series (`CONTINUE_LIMIT`) is its own number and stays.
- **The heart helpers are generic over `{ id, isFavorite }`**, which both
  `Movie` and `Series` carry. `withShelved` takes records, not rows, so the
  row's field name (`movies` or `series`) is the caller's concern.
- **A series heart settles its shelf.** The movie shelf's reload exists for
  a reason the series payload shares exactly (the caller's sort, the cap of
  15); the two By genre bodies keep one rule, held once in `useRowsLoad`.
  This is the round's one behaviour change, and the journal raised it.
- **`GenreLayout`'s Back is a slot**, as its heading and controls are; the
  layout no longer reads the URL. `useGoBack` stays the one Back rule.
- **The settings write loop stays.** The two Row view writes share one
  handler in a loop; each route is still one **Single-signal** write with
  its own path, and splitting them would copy twelve lines for nothing.
- **Nothing on the wire, the schema, Settings, the copy, the prototype or
  any drawn pixel changes.**

## Testing Decisions

- **A good test asserts what the family sees or what the wire carries**:
  which bodies draw, which cards, headings and counts, where a link goes,
  which request is made and how often, what Back lands on. It never asserts
  which helper ran or how a hook holds its state.
- **The initiative's suites carry every refactor commit**: `LibraryBody`,
  `RowViewSwitch`, `useRowView`, `rowViewOptions`, `MovieGrid`,
  `SeriesRows`, `GenrePage.series`, `LibraryPage`, `App.rowViewWalk`,
  `DisplayPreferenceProvider`, the server's `movieGrid`, `seriesRows`,
  `seriesGenre` and `settings` tests and the routes' `movieGrid`,
  `seriesRows`, `seriesGenre`, `settings` and `rowViewRelaunch` suites;
  and the older suites the round touches: `MovieRows` and `useMovieRows`
  (today `HomeRows`, `useHomeRows`), `SeriesGrid` (today `SeriesHome`),
  `GenreTitles` (today `GenreMovies`), `GenreGrid`, `GenreLayout`,
  `GenrePage` and `withFavorite`.
- **New suites**: `otherRowTitle`, `genrePath`, `genreLessPath`,
  `useSettledLibraryQuery`, `LibraryGridHeading`, `SkeletonGrid`,
  `GenreBack` and `useSeriesRows`. Prior art: `seriesTabPath.test` and
  `moviePath.test` for the paths; `useLibraryTab.test` for a URL-reading
  hook; `SkeletonCard`'s and `LibraryGrid`'s tests for the drawn units;
  `SettingsHeader`'s Back cases for `GenreBack`; `useHomeRows.test` for
  `useSeriesRows`. `useRowsLoad` keeps no suite of its own, as
  `useBrowseLoad` is driven through its callers.
- **Assertions that change**: renames change only imports and `describe`
  titles (group 1); `GenreLayout.test`'s Back cases hand the slot a Back
  (commit 13); `withFavorite.test` gains series cases (commit 10). A suite
  that has to change anywhere else is reading an implementation detail,
  and is fixed in the same commit with the reason in the body.
- **The one behaviour change lands with its test** (commit 12): the old
  rule has no test that says _no reload_, so there is nothing to turn red
  first. If `App.rowViewWalk` counts series rows reads after a heart, it is
  updated in that commit, its body saying why.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at 1 error and 137
  warnings, or fewer, and 12132 tests or more.
- **A short live walk after group 3**, in the shell on the dev library with
  `npm run db:seed-series`: Series By genre, heart a series in a row and
  watch it settle on the shelf; Movies By genre, the same. Then the release
  smoke of commit 17.

## Out of Scope

- **The Other movies row's _View all_ carries no sort**, where every genre
  row's and the Other series row's do. It predates this initiative (log
  51), and carrying it would change what Movies does; `genreLessPath` takes
  a sort, so the fix is one argument when someone decides it.
- **Renaming the wire** (`/api/home`, `HomePayload`, `getHome`,
  `/api/series`, `SeriesHomePayload`, `getSeriesHome`): see the Decision
  Document.
- **One generic body over both kinds** (a `TitleRows`, a `TitleGrid`). The
  two kinds' payloads still differ (episodes against movies in Continue,
  the episode count); the round shares the pieces, not the bodies.
- **The no-results copy**, which differs per tab on purpose (the handoff's
  _The faces belong to the tab_).
- **The library's other lines past 80 columns** in `server/src/routes/`,
  `server/src/library/index.ts` and `src/types/` that this initiative did
  not write.
- **The `exhaustive-deps` and other lint warnings** that predate the
  initiative.

## Further Notes

- Groups 1 and 3 are the round's reason to exist: the names log 63 left to
  it, and the one heart rule the two By genre bodies should share.
- Order: group 1 first, so every later commit uses the final names; 6
  before 7 and 8 is not required but keeps `MovieGrid`'s diffs small; 10
  before 11, 11 before 12; 3 before 13 (`GenreBack` reads
  `useGenreTitles`); 14 before 16; 17 after every code commit, 18 last.
  Groups are otherwise independent.
- Follow-ups for the journal, not this round: the Other movies row's sort,
  and a kind-neutral body if a third kind ever joins.
