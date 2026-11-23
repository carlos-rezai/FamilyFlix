# Plan: Header fit, every filter pill and Settings in reach

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/693

The browse header loses two pills and learns to wrap. How a tab is browsed is
chosen in the Genre dropdown, the Quality filter goes end to end, and the
three pills and Settings form the **Header end**, which moves whole to a
second line, right-aligned, when the first can't hold it. The spec is design
log 73 and `docs/handoff/handoff-header-fit/README.md` until phase 1 amends
the prototype.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** Phase 5's walk is done by the agent itself in the dev app, with the
window sized to each width. No decision is left open: log 73 settled them
all.

- The phases are log 73's _Implementation Plan_ slices. Slice 1's prototype
  amendment is its own phase (phase 1), as in log 63's plan, and slice 3's
  walk and documents are their own phase (phase 5).
- **Phases 2 to 4 each start from their own RED test** (`tdd`). Phase 1 is
  the prototype and the spec, proved by reading them against the handoff.
  Phase 5's documents are proved by the walk and a green suite.
- **Every existing test stays green after every phase.** A test is deleted
  only with the unit it covers, or replaced in the same phase (the route's
  quality test by its `?quality=` answers 200 test).
- The glossary's **Header fit** section was written in the grill-me. The
  checklist's step 55 row stays 🔜 until the refactor. CLAUDE.md and the
  README are not touched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none new. `GET /api/home` and `GET /api/series` stop reading
  `quality`; a request carrying it answers 200 with the whole library, as for
  any unknown parameter. The `400 Invalid quality` is gone.
- **Schema**: no migration. The **Row view** stays the household's setting,
  one per tab, as log 63 stored it. The Video quality, the Quality sweep and
  the sheet column are untouched.
- **Dependencies**: none new.
- **URL**: `?genre=` stays the only Genre pill state in the URL. The Row view
  is never in the URL. A held `?quality=` is read past and never stripped.
- **Key models**:
  - `RowView` (`'genre' | 'all'`), unchanged, read and written through
    `useRowView`, which moves to `src/hooks/useRowView/` unchanged.
  - `allTitlesLabel(tab)` in `src/utils/`: _All movies_ for Movies,
    _All series_ for Series. The one place those words are written.
  - `GenreSelection = { genre: string } | { rowView: RowView }`, kept in the
    `genreOptions` unit.
  - `genreOptions(genres, selection, allTitles, onSelect)` answers
    _All Genres_, the _All_ row, then each genre, busiest first, A to Z on a
    tie. Both View rows carry the list total. Exactly one row is checked.
    `genreLabel(selection, allTitles)` answers the pill's value.
  - The **Header end**: a styled box in `MainLayout` around the `headerEnd`
    slot and the Settings button. It is flex with the header's 24px gap,
    never shrinks, never wraps inside, and is pushed right by an auto left
    margin. The header gains `flex-wrap` and a 12px row gap (`space.s3`).
    No breakpoint, no media or container query.
- **The rules**:
  - A View row clears `?genre=`, then saves the tab's Row view, shown at
    once, with no snackbar. A genre writes `?genre=` alone and leaves the
    view as it was.
  - The Genre pill draws nothing while the Row view is `null`.
  - Every body, the Genre rows, View all and the Genre page are unchanged.
  - Removing the filter removes nothing else: the Quality tag, the Series
    quality, `qualityRankSql` and the _Show video quality_ toggle stay.

---

## Phase 1: The spec amended

**User stories**: none directly; it is the spec every later phase builds to

### What to build

The prototype and its spec brought to the handoff README. In
`page.LibraryPage.dc.html` the browse header draws three pills, Genre,
Rating and Sort, then Settings, as one Header end that wraps whole below
about 1347px. The Genre dropdown gains _All Genres_ and _All movies_ /
_All series_, and the pill reads the checked row. The _View_ and _Quality_
pills are gone. The model in `FamilyFlix.dc.html` keeps the Row view per tab
and drops the quality filter. In `page.SettingsPage.dc.html` the toggle
carries its new sentence. `COMPONENT-SPEC.md` describes the Header end, the
Genre dropdown's rows and the removals. After this phase the prototype
rules, and the handoff README is history. Demo: the prototype, opened in a
browser and narrowed, wraps the Header end onto a second line, and the
Genre dropdown switches a tab between rows and grid.

### Acceptance criteria

- [ ] The browse page draws Genre, Rating, Sort and Settings, and no View
      or Quality pill.
- [ ] The Header end moves whole to a right-aligned second line, 12px below
      the first, when the first line can't hold it, and the search grows
      into the room it left.
- [ ] The Genre dropdown's rows, counts, checked row and pill value match
      the handoff's tables on both tabs.
- [ ] A fresh model reads _All Genres_ on Movies and _All series_ on Series.
- [ ] The Settings page's _Show video quality_ description reads
      _Tag each poster with how sharp its video is: 4K, 1080p, 720p, 480p or
      SD._
- [ ] `COMPONENT-SPEC.md` names the Header end, the View rows and the
      removed pills.

---

## Phase 2: The Row view in the Genre dropdown

**User stories**: 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
26, 27, 28, 29, 30, 31, 32, 40

### What to build

The Genre pill now chooses how a tab is browsed. `allTitlesLabel` writes
_All movies_ and _All series_, and `MovieGrid`, `SeriesGrid` and
`SeriesRows` draw their headings through it. `useRowView` moves to the
shared hooks, because the search feature now reads it beside the library
feature. `genreOptions` builds the two View rows ahead of the genres from a
`GenreSelection`, and `genreLabel` answers the pill's value. `LibraryFilters`
builds the selection from the URL's genre, else the tab's Row view. A View
row clears the genre and saves the view, and a genre writes `?genre=` alone.
`RowViewSwitch` and `rowViewOptions` are deleted, and `LibraryPage`'s end
slot is `LibraryFilters` alone. Demo: on Movies, _All movies_ draws the
grid and _All Genres_ the rows, and the choice holds over a relaunch. On
Series the pill starts on _All series_.

### Acceptance criteria

- [ ] `allTitlesLabel` answers _All movies_ and _All series_; the three
      grid headings read the same words as before.
- [ ] `useRowView` lives in `src/hooks/` with its test, unchanged, and
      both features import it from there.
- [ ] `genreOptions`: the order; both View rows' labels and totals on each
      tab; exactly one row checked for a genre, for `rowView: 'genre'` and
      for `rowView: 'all'`; what each row reports to `onSelect`; an empty
      genre list still offers both View rows.
- [ ] `genreLabel` answers the genre, _All Genres_ or the tab's _All_
      label for each selection.
- [ ] `LibraryFilters`: a View row clears `?genre=` and saves the tab's
      view; a genre writes `?genre=` and leaves the view; search, rating and
      sort are kept; no snackbar; the pill is blank while the view is
      `null`; the Series tab reads _All series_.
- [ ] `LibraryPage` draws no View pill, and its body still follows the
      tab's view.
- [ ] `RowViewSwitch` and `rowViewOptions` are gone with their tests.

---

## Phase 3: The Quality filter goes

**User stories**: 33, 34, 35, 36, 37, 38, 39

### What to build

The filter by quality removed end to end. On the client: the Quality pill,
`qualityOptions`, `setQuality`, `honouredLibraryQuery`, `parseMinQuality`,
and `quality` in `parseLibraryQuery` and `toLibraryQueryParams`.
`useLibraryQuery` and `useSettledLibraryQuery` stop reading
`useQualityTags`. On the wire, `minQuality` leaves `LibraryQuery` and
`MovieQuery`. On the server: the route's quality parse and its 400, and the
movie and series browses' `WHERE`s. The toggle's description becomes its new
sentence. A held `?quality=` is read past, client and server. Demo:
`/?quality=4k` shows the whole library, and the toggle still hides and shows
the Quality tags.

### Acceptance criteria

- [ ] `GET /api/home?quality=4k` and `GET /api/series?quality=nope` answer
      200 with the whole library, replacing `routes.qualityFilter.test.ts`.
- [ ] `LibraryFilters` draws no Quality pill with _Show video quality_ on.
- [ ] A URL carrying `?quality=` shows every title, and the parameter is
      left on the URL.
- [ ] `DisplaySection` shows the new one-sentence description.
- [ ] The Quality tag, the Series quality, `qualityRankSql`, the Quality
      sweep and the sheet column are untouched, and their tests stay green.
- [ ] Every removed unit leaves with its tests, and nothing still names
      `minQuality`.

---

## Phase 4: The Header end

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 41

### What to build

The fit rule in the template. `MainLayout` wraps its `headerEnd` slot and
the Settings button in the Header end box, and the header gains `flex-wrap`
and its 12px row gap. The search bar keeps its floor and grows into a freed
first line. No page learns that the header wraps, and `GenreLayout` is
untouched. Demo: narrowing the dev app's window below about 1347px moves the
three pills and Settings, together, to a right-aligned second line, and
widening it brings them back.

### Acceptance criteria

- [ ] `MainLayout` draws the Settings button inside the Header end, beside
      the `headerEnd` slot, and never apart from it.
- [ ] The header wraps by content alone: no breakpoint and no media or
      container query.
- [ ] `LibraryPage` and `GenreLayout` carry no fit logic.

---

## Phase 5: Walk it live, then the documents

**User stories**: 42 (and 1 to 11, 26, 27 checked live)

### What to build

The acceptance walk in the dev app. Both tabs at 1024, 1280, 1366 and 1920px
wide, with _Documentary_ (or the longest genre held) chosen. At each, the
header's elements are measured: every pill and Settings is inside the
window and nothing is truncated. One line is expected at 1366 and 1920, and
two at 1024 and 1280. Each View row is chosen on each tab, then the app is
relaunched and both choices hold. Then the documents: the checklist's step
55 entry, and the docblocks of `MainLayout`, `LibraryPage`,
`LibraryFilters`, `genreOptions`, `useLibraryQuery`, `useQualityTags`,
`DisplaySection`, `LibraryBody` and the routes' Library query reader.

### Acceptance criteria

- [ ] At each of the four widths, on both tabs, with a long genre chosen,
      every pill and Settings is on screen and no pill's words are cut.
- [ ] The header is one line at 1366 and 1920px, and two lines at 1024 and
      1280px, with the Header end at the right of the second.
- [ ] Each View row draws its body on each tab, and both choices hold over
      a relaunch.
- [ ] The checklist's step 55 entry describes the initiative and stays 🔜.
- [ ] Every touched unit's docblock describes its new face.
- [ ] The full suite and the typecheck (`--force`) are green.
