# Plan: Row view, either Library tab browsed either way

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/607

Either **Library tab** can be browsed **All** (every title in one grid) or
**By genre** (a row per genre), chosen by the **Row view switch**, a _View_
pill in the browse header after Sort. The choice is the household's and per
tab, kept in the `settings` table beside the Start tab; today's faces are the
defaults (Movies _By genre_, Series _All_). The spec is
`docs/handoff/handoff-row-view/README.md` until phase 1 amends the prototype
to it.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** The live walk of log 63's slice 4 is replaced by phase 7, an
App-level walk written as tests, so the walk's acceptance is proved by the
suite instead of by hand. No decision is left open: the maintainer approved
every recommendation of log 63 in advance, and this plan adds none.

- The phases are log 63's _Implementation Plan_ slices, thinned: slice 1
  into the spec (phase 1), the switch (phase 2) and Movies' grid (phase 3);
  slice 2 into the series rows (phase 4) and the series Genre page (phase
  5); slice 3 is phase 6; slice 4 into the walk as tests (phase 7) and the
  documents (phase 8).
- **Each phase starts from its own RED test**, except phase 1 (a prototype
  amendment, proved by `COMPONENT-SPEC.md` and the handoff agreeing) and
  phase 8 (its checklist and a green suite).
- **Every existing browse, Genre page, settings and provider test stays
  green after every phase.** `HomeRows` and `SeriesHome` are unchanged.
- The glossary already holds log 63's terms. The feature checklist's step
  46 row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: no migration. Two more rows in the `settings` table,
  `movie-row-view` and `series-row-view`, each `'all'` or `'genre'`, read
  with `choiceOf(key, ROW_VIEWS, default)` so an off-list value reads as the
  tab's default, written one key per request as `start-tab` is.
- **Routes** (all narrowed by the one Library query):
  - `GET /api/movies` via `libraryQueryOr400`, answering `MovieGridPayload`.
  - `GET /api/series/rows` via `libraryQueryOr400`, answering
    `SeriesRowsPayload`.
  - `GET /api/series/genre/:name` and `GET /api/series/genre-less` via
    `genreQueryOr400`, answering `GenrePayload`'s shape in series.
  - The three `/series/...` reads are registered ahead of `/series/:id`.
  - The settings write accepts `movieRowView` and `seriesRowView`, one field
    per body, and refuses an off-list value.
  - Domains stay injected into `createApiRouter`; routes only parse, call
    and respond.
- **Client routes**: none new. A series row's View all opens
  `/genre/:name?tab=series`, the Other series row's `/genre-less?tab=series`,
  the Carried sort riding beside the tab; `tab` is omitted at Movies. The
  Row view is never in the URL and never in `localStorage`.
- **Key models**:
  - `ROW_VIEWS = ['all', 'genre'] as const` and `RowView`, beside
    `LIBRARY_TABS`; `DEFAULT_MOVIE_ROW_VIEW = 'genre'`,
    `DEFAULT_SERIES_ROW_VIEW = 'all'`.
  - `Settings` gains flat `movieRowView` and `seriesRowView`.
  - `MovieGridPayload { movies: Movie[]; continueWatching: Movie[] }`.
  - `SeriesRow { genre; count; series: Series[] }` and
    `SeriesRowsPayload { rows: SeriesRow[]; other: SeriesRow | null;
favorites: Series[]; continueWatching: EpisodeContinueEntry[] }`.
  - `DisplayPreferenceApi` gains `movieRowView`, `setMovieRowView`,
    `seriesRowView`, `setSeriesRowView`, each `null` until the read lands.
  - `useRowView()` returns `{ rowView: RowView | null; setRowView(view) }`
    for the current Library tab.
- **The rules**:
  - A switch is shown at once, posted, the echo kept, put back on refusal,
    no snackbar; it writes no URL and keeps search, genre, rating and sort.
  - A refused settings read lands the two Row view defaults alone; every
    other preference keeps `null` as today.
  - Series rows follow `getHome`'s rules: `HOME_ROW_LIMIT` (15) per row, the
    true count on View all, genres busiest first as `/api/series/genres`
    orders them, only populated genres, Other last and `null` when empty, a
    genre filter leaving that genre's row and no Other.
  - No Settings row for the view; no new domain; CLAUDE.md untouched.

---

## Phase 1: The spec amended

**User stories**: 68

### What to build

`page.LibraryPage.dc.html`, the model in `FamilyFlix.dc.html` and
`COMPONENT-SPEC.md` are amended to `handoff-row-view/README.md`, as issue
445 did for log 51's Other row: the _View_ pill after Sort, Movies under
_All_, Series under _By genre_ with the _Other series_ row, and the series
Genre page. Nothing new is designed; each face is composed of drawn pieces.
No code.

### Acceptance criteria

- [ ] The prototype draws the _View_ pill after Sort with _All_ then _By
      genre_, the current one checked, no counts.
- [ ] The prototype's model holds both Row views per tab, defaulting Movies
      to _By genre_ and Series to _All_.
- [ ] Movies under _All_ and Series under _By genre_ are drawn as the README
      says, the _Other series_ row last.
- [ ] `COMPONENT-SPEC.md` names `RowViewSwitch`, `MovieGrid`, `SeriesRows`
      and the series Genre page at their rungs and points at
      `handoff-row-view/`.
- [ ] No em dash in any amended prose.

---

## Phase 2: The switch, kept by the household

**User stories**: 1 to 5, 7 to 9, 12 to 18, 22, 58, 59

### What to build

The two settings keys with their defaults and off-list fallback; the settings
write accepting both fields; `saveMovieRowView` and `saveSeriesRowView`;
the provider holding both values; `useRowView` over the current Library tab;
`rowViewOptions`; `RowViewSwitch`, a `FilterDropdown` labelled _View_,
rendered by `LibraryPage` in `headerEnd` after `LibraryFilters`. The bodies
don't follow the switch yet. Demo: each tab's pill holds its own value, and
still does after a relaunch.

### Acceptance criteria

- [ ] `settings`: Movies reads `genre` and Series `all` by default; each
      written and read back; an off-list stored value reads as the default;
      a write touches its one key.
- [ ] The settings route accepts `movieRowView` and `seriesRowView` and
      answers 400 on an off-list value.
- [ ] `rowViewOptions`: _All_ then _By genre_, the current one checked, no
      counts, choosing calls back with its value.
- [ ] `useRowView` returns Movies' view under Movies and Series' under
      Series; its setter sets only the current tab's.
- [ ] The provider lands both values from the read; a set shows at once and
      posts; a refused save is put back; no snackbar.
- [ ] `RowViewSwitch` is named _View_, shows the current value, and a choice
      writes no URL; search text and the genre, rating and sort pills
      survive it.
- [ ] `LibraryPage` draws the switch after the filters; switching tabs shows
      that tab's own value.

---

## Phase 3: Movies as one grid

**User stories**: 6, 23 to 35, 60

### What to build

`GET /api/movies` answers `MovieGridPayload`: the browse query uncapped in
the caller's sort, genre-less movies included, and the continue section
built as `getHome` builds it. `MovieGrid`, `SeriesHome`'s shape in films:
Continue row, Favorites row from the grid via `shelvedFavorites` (at most
15, the grid's order), _All movies_, `N movies` / `1 movie`, the Library
grid; a card opens the film's page, and a heart reaches the shelf.
`LibraryBody` picks `MovieGrid` or `HomeRows` off Movies' Row view. Demo:
Movies switched to _All_ shows every film in one grid, which search, genre
and rating narrow; Series is untouched.

### Acceptance criteria

- [ ] `getMovieGrid`: more than 15 movies all returned; narrowed by search,
      genre and rating; in the query's sort; genre-less movies included; its
      continue section equals `getHome`'s.
- [ ] `GET /api/movies` answers the payload's shape and 400 on a bad query.
- [ ] `MovieGrid` draws the Continue row, the Favorites row, _All movies_
      and the count line, singular and plural.
- [ ] The Favorites row holds the grid's hearted films in the grid's order,
      at most 15; hearting a film in the grid reaches the row.
- [ ] A grid card opens the film's page.
- [ ] `LibraryBody` draws `MovieGrid` under _All_ and `HomeRows` under _By
      genre_ on Movies, and nothing while the view is `null`.
- [ ] Back from a title returns to the view the household holds.

---

## Phase 4: Series by genre

**User stories**: 36 to 47

### What to build

`GET /api/series/rows` answers `SeriesRowsPayload` by `getHome`'s rules over
series. `SeriesRows` + `useSeriesRows`, `HomeRows` / `useHomeRows`' shape
over `seriesCardView`: the episode Continue row, the Favorites row, a
`GenreRow` per populated series genre busiest first, and the _Other series_
row last. View all builds `/genre/:name?tab=series` and
`/genre-less?tab=series`, the Carried sort beside the tab (the page honours
them from phase 5). `LibraryBody` picks `SeriesRows` or `SeriesHome` off
Series' Row view. Demo: Series switched to _By genre_ shows a row per genre.

### Acceptance criteria

- [ ] `getSeriesRows`: 15 per row with the true count; busiest genre first;
      only populated genres; Other holds the genre-less and is `null` when
      none; a genre filter leaves one row and no Other; search narrows every
      row; favorites capped at 15 in the caller's sort; the episode continue
      section.
- [ ] `GET /api/series/rows` answers the payload's shape, 400 on a bad
      query, and is not read as a series id.
- [ ] `SeriesRows` draws the rows with their View all counts, _Other series_
      last, and no Other row when it is `null`.
- [ ] A row card opens the series page.
- [ ] View all links carry `?tab=series` and the Carried sort.
- [ ] `LibraryBody` draws `SeriesRows` under _By genre_ and `SeriesHome`
      under _All_ on Series.

---

## Phase 5: The Genre page for series

**User stories**: 49 to 57

### What to build

`GET /api/series/genre/:name` and `GET /api/series/genre-less` answer one
genre's series and the genre-less series, uncapped, in `GenrePayload`'s
shape. `GenreMovies` reads the Library tab off the URL with
`useLibraryTab()`; under Series it loads the two series reads, opens the
series page from its cards, and heads its `other` mode _Other series_.
Heading, `N of M titles`, search, Sort and the Carried sort are unchanged.
Back returns to the Series tab in the view the household holds. Demo: View
all on a series row and on _Other series_ opens its series.

### Acceptance criteria

- [ ] The series genre reads: one genre's series uncapped; the genre-less
      series; search and sort applied.
- [ ] Both routes answer 400 on a bad query and are not read as a series id.
- [ ] `GenreMovies` under `?tab=series` calls the series reads and draws
      Back, the genre's name over `N of M titles`, search, Sort and the
      grid.
- [ ] Its cards open the series page; the `other` mode is headed _Other
      series_.
- [ ] The Carried sort from the home is the page's Sort.
- [ ] Back returns to `/series` (the Series tab) in the held view.
- [ ] `GenreMovies` without `tab` behaves as today.

---

## Phase 6: Every face

**User stories**: 10, 11, 19 to 21, 48, 61 to 67

### What to build

Q16's faces in both new bodies: Movies draws a skeleton grid under _All_
(skeleton rows under _By genre_, as today), Series draws nothing until it
loads; empty, miss and failure copy as each tab has it today, with Retry
reloading the body on screen. One heart on Series shows on every row and
the shelf it appears on, by `withHeart`'s rule. A refused settings read
lands the two Row view defaults and leaves the other preferences `null`;
the switch and the body draw nothing until the read lands, so the home is
drawn once, in the household's view.

### Acceptance criteria

- [ ] `MovieGrid`: a skeleton grid while loading; _Your library is empty_ /
      _Add a movie to start filling your shelves._ when empty; today's miss
      copy; _Couldn't load your library_ with Retry on failure.
- [ ] `SeriesRows`: nothing while loading; _All series_ over `0 series · 0
episodes` when empty; today's miss copy; _Couldn't load your series_
      with Retry on failure.
- [ ] Retry reloads the body on screen.
- [ ] Hearting a show on a row shows the heart on every row and the shelf.
- [ ] A refused settings read lands Movies _By genre_ and Series _All_;
      every other preference stays `null`.
- [ ] Neither the switch nor the body is drawn until the read lands; the
      home is never drawn in the default and then redrawn.

---

## Phase 7: The walk, as tests

**User stories**: 6, 8, 9, 12, 13, 58 to 60 (proved end to end)

### What to build

Log 63's live walk written as tests, so no step needs a hand. An App-level
test over a stubbed wire walks each tab both ways: Movies to _All_ and back,
Series to _By genre_ and back, a filter and a search under each, a heart on
a row and on the grid, View all on a series row and on _Other series_
landing on the series Genre page, Back to the held view, and a remount
(a relaunch) drawing both choices from the settings read. A server test
proves the relaunch end to end: both views written, the database reopened,
both read back. Any gap the walk finds is fixed in its phase's unit and its
test first.

### Acceptance criteria

- [ ] Each tab is walked both ways in one App-level test; each switch posts
      its one setting and redraws only that tab's body.
- [ ] A filter and a search under each view narrow the body and survive a
      switch.
- [ ] A heart on a row and on the grid reaches the Favorites row.
- [ ] View all on a series row and on _Other series_ opens the series Genre
      page, and Back returns to the Series tab in _By genre_.
- [ ] A remount draws both tabs in the stored views on first paint.
- [ ] Both views written survive the database being closed and reopened.

---

## Phase 8: The documents

**User stories**: 69 to 72

### What to build

The docblocks of `LibraryBody`, `SeriesHome`, `GenreMovies`, `GenrePage`,
`DisplayPreferenceProvider` and the `/home` and `/series` routes say what
they now do, naming the **Row view**, **All**, **By genre**, the **Row view
switch** and the **Other series row**. The feature checklist's step 46 row
is written to what was built and stays 🔜 until the refactor. The dev
journal gains this step's entry. The glossary is checked against what was
built. CLAUDE.md is untouched. No em dash in any prose.

### Acceptance criteria

- [ ] Every listed docblock describes its unit's current behaviour.
- [ ] Step 46's row in `docs/feature-checklist.md` describes the build and
      stays 🔜.
- [ ] `docs/dev-journal.md` has a step 46 entry.
- [ ] `docs/ubiquitous-language.md` holds **Row view**, **All**, **By
      genre**, **Row view switch** and **Other series row**, and its
      **Browse home**, **Series tab**, **Genre page**, **Other row**, **View
      all**, **Library grid** and **Favorites row** match the build.
- [ ] CLAUDE.md is unchanged.
- [ ] The full suite is green.
