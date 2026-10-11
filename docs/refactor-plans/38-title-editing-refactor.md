# Refactor plan: Title editing — one reading per rule, the film's shape for every series twin, the form's five jobs split, two bugs the build left, and the ticks that close the initiative

> Source initiative: [`title-editing`, issue #302](https://github.com/carlos-rezai/FamilyFlix/issues/302)
> Shipped by issue 303 (`36547df`, the prototype revisions) and issues 304–310,
> one RED and one GREEN each: 304 `5b0d195`/`2e48ce0`, 305 `8fe2496`/`0e029c4`,
> 306 `479d9d8`/`472a159`, 307 `18a1e0e`/`3e7b75c`, 308 `613251f`/`6d89e97`,
> 309 `48ea06e`/`e6cd3a1`, 310 `349715b`/`4d8e0d9`.
> Design log: `docs/design-logs/38-title-editing.md`. Plan:
> `docs/PRDs/38-title-editing-plan.md`.
> This is the initiative's closing round: it ticks step 21 and closes 302.
> Filed as issue ISSUE*NUMBER.
> Planned alone, on the maintainer's standing instruction: \_keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture.*

## Problem Statement

`title-editing` shipped all seven slices of log 38 Q20 under `issue-loop`,
one subagent per step. The full suite is green at `4d8e0d9`: 8137 tests
across 486 files, with `tsc -b --force`, ESLint and Prettier clean. Every
acceptance criterion holds.

Each slice was built against its own failing tests by a subagent that saw only
those tests and the units they import. The result works, but the same rule is
now spelled in two or three places, several series twins don't take their
film's shape, and two bugs got through that no test covers. Every finding
below was checked against the code for this plan.

### 1. One rule, spelled more than once

- **The Series folder above an episode** is worked out three ways.
  `storeInSeriesFolder` takes `dirname` twice. `removeSeriesFolder` slices off
  two segments and checks containment. The `PATCH /api/series/:id` route calls
  `openFolder`, counts the path's segments itself and takes `dirname`. That
  route is path arithmetic in the HTTP layer, and CLAUDE.md gives managed
  storage paths to `media/` alone.
- **A Source file** is spelled twice in the importer: `sourceFileOf(show,
video)`, and an inline `relative(…).split(sep).join('/')` inside
  `resolveSeries`.
- **The Series tab as a route**, `/?tab=series`, is a literal in three places:
  `SeriesPage`'s Landing, `useDeleteSeries`'s Landing and `useMovieForm`'s
  series **Fresh home**. Every other route in the app has a path util beside
  `moviePath` and `seriesPath`.
- **The Year range** is spelled twice on the client, and the two disagree (see
  group 2). `seriesView`'s `toYearLabel` writes the open run `2021–` and the
  one-year run `2022`. `seriesFormValues` writes the open run as `2021` and the
  one-year run as `2022–2022`. The server's `spellYearSpan` is the reading both
  should mirror.
- **A Season folder's number** is read with two different rules. The server's
  `groupShows` reads `Season 01`, `Season 1` or `S01` and nothing else. The
  client's `folderSeason` in `formValues`, which seeds the **Numbering guess**,
  takes any digits in the folder's name. `readEpisodeTag` is already held to
  the server's `episodeTag` by a drift guard; this rule has no guard.
- **One single title, read four times.** `EnrichmentFlow` works out
  movie/series/none with a three-way ternary in four places: the Landing,
  Start's body, the scope card's kind and _Done_'s label.
  `useEnrichmentRun(movieId, seriesId)` takes the pair as two positional
  arguments. The server already holds the idea as a **Title reference**,
  `{ kind, id }`, but as an interface local to `createEnrichment`.

### 2. Series twins that don't take their film's shape

- **The delete.** `deleteMovie(id)` answers nothing; its route looks the movie
  up through `movieOr404`, deletes it and removes the folder off its
  `videoPath`. `deleteSeries(id)` answers `{ deleted, storedPath }` instead,
  and its route writes its own 404. `Unknown series: <id>` is now written out
  five times in the router, with no `seriesOr404` beside `movieOr404`.
- **Reading one series.** `LibraryStorage` has `getMovie(id)` but no
  `getSeries(id)`, though the series reader has one. To get one series,
  `createEnrichment`'s `titlesFor` and `titleOf` and the PATCH route read the
  whole `SeriesDetail`. `resolveSeries` reads `getSeriesHome()` and searches
  the whole shelf.
- **The ⋯ menus.** `SeriesEditMenu.styles.ts` is a copy of
  `EditMenu.styles.ts`, `CornerMenu` and `MoreButton` both. The two menus'
  `CornerMenu`/`MoreButton` scaffold is the same line for line. Log 38 Q8 and
  the PRD's Further Notes say that if the refactor finds the menus identical, it
  extracts them then.
- **A series' Field conflict.** A film with a conflict has its non-conflicting
  fields written during the run, and its row asks only about the conflicts.
  _Skip_ keeps the conflicted fields as they were. A series with a conflict is
  held whole in a `heldShows` map: nothing is written at show level until the
  row settles, and _Skip_ writes nothing at all. A test forced this in issue 306. It breaks **Title parity**, which the PRD's story 29 states directly ("a
  series row to look exactly like a film's"). It also needs a `settled`
  parameter threaded through `writeSeries` and `writeShow`, which the film path
  doesn't have.
- **The Title fix.** For a film it is written after the match, through
  `storage.enrichMovie`. For a series it is merged into that `settled`
  parameter.

### 3. Two bugs nothing tests

- **An untouched edit of a running series closes it.** `seriesFormValues`
  writes an open run (`endYear` null) as `2021`. The server's `yearSpan` reads
  a lone `2021` as a finished one-year run, so _Save changes_ on a series whose
  year nobody touched sets `endYear` to `2021`. A one-year series opens as
  `2022–2022`.
- **"Its 1 episodes."** `DeleteSeriesDialog` writes `` `its ${episodeCount}
episodes` `` with no singular, where every other count in the app has one.

### 4. Structure the build left

- **`useMovieForm` is 857 lines with five jobs**: the add, the **Edit job**,
  the film **Resolve**, the **Series edit job** and the **Series Resolve**. Its
  save is a ternary nested four deep. Its docblocks still describe three jobs:
  `formLanding` says "the one screen in the app with three ways in", the hook's
  docblock never mentions either series job, and `MOVIE_PARAM`'s says "One URL,
  two jobs". Log 32 flagged it, and the PRD's Further Notes name this round as
  when it is split.
- **`FoundFileChoice` is a second component inside `MovieFormFiles.tsx`**, with
  an inline props type and its own `nameOf`. That repeats `formValues`'
  `foundFilenameOf`. Every other component in the app has its own folder.
- **`ProblemRow` builds the Series Resolve's URL by string surgery**: it calls
  `movieFormPath(…)` and then `.replace('/add?', '/add?kind=series&')`.
  `movieFormPath` has no `kind`.
- **`SeriesDetail` sums the episode count inline.** Every other number on the
  page comes from `seriesView`'s model.
- **`EditedEpisode.tracks` merges held and picked tracks**, so the resolve
  route has to split them again by index (`index < found`).
- **Three detached docblocks.**
  - In the movie form's `api`, `updateSeries` was inserted between
    `updateMovie`'s docblock and `updateMovie`.
  - In the router, `resolveSeries` and its comment were inserted between the
    resolve route's comment and its handler.
  - `EnrichmentSetup`'s docblock carries two lines over the measure.
- **`files.videos` is optional on `ImportProblemDetail`.** The PRD types it
  `string[]`; the build made it optional so the older fixtures would compile,
  so a reader has to write `?? []`.
- **A Found-file choice option names its selected flag `$on`.** `ScopeCard` and
  `FormatCard`, the app's two other radio rows, call it `$selected`.
- **The prototype and the build disagree on one label.** The prototype's
  Found-file choice picker reads _Choose another video file_ (wording added in
  issue 303, not from the PRD). The build reads _Choose video file_, the
  slot's own label.

### 5. Docs that don't describe what shipped

- **The dev journal** has no entry for issues 303–310.
- **CLAUDE.md**:
  - It still lists steps 21–23 as **Episode links**, **Edit a series** and
    **Delete a series**. Log 38 Q1 folded them into one step 21, **Title
    editing**.
  - Its tree has no entry for `SeriesEditMenu/`, `DeleteSeriesDialog/`,
    `useDeleteSeries/` or `fetchSeriesDetail/`.
  - It still says "the nine" shared calls, "the four removals", and migrations
    up to 7.
- **The glossary's Unplaced entry** still says "Today its reason names the fix
  (rename, import again)".
- **The README** still lists the three old 🔜 rows.

## Solution

Six groups. The tree is working and green after every commit:

0. **The record.** The build's journal entry goes first, so it describes what
   shipped before this round changes anything.
1. **The server: one reading per rule, the film's shape for every twin.**
2. **The two bugs**, each with the leaf that would have caught it.
3. **The client: one reading per rule, units in their own folders.**
4. **The form's five jobs split.**
5. **The prototype and the docs**, then the ticks that close the initiative.

That's 30 commits. One behaviour changes on purpose: a series' Field conflict
writes what a film's does (commit 9). Two bugs are fixed (commits 12 and 13).
Nothing else moves on the wire or on screen. No schema, status or pixel
changes.

## Commits

### Group 0: the record of what was built

1. **The journal's title-editing build entry.** A new top entry, _Title
   editing — the seven slices (issues #303–#310)_, with the sections the
   factory-reset build entries have:
   - **What shipped:** the prototype revision by hand, then each slice's RED
     and GREEN by hash.
   - **The token counts per step:** every step was over the 100k budget, so
     `prd-to-issues` cut these slices too thick.
   - **The build's calls the PRD didn't make:**
     - `ImportProblem.seriesId`, where the PRD said the row gains no field. A
       Resolve on a held show needs the series id, and no other carrier
       reaches `ProblemRow`.
     - `files.videos` left optional.
     - The series conflict held whole.
     - A join keeping the held poster.
     - The series kind waiting for the problem to load before it switches.
     - The picker label.
     - `fetchSeriesDetail` promoted to `src/api/`.
   - **The gaps no test covers:** a series with no episodes strands its
     folder; a replacement with the stored file's name overwrites it.
   - **The counts** at `4d8e0d9`.
   - **The follow-ups:** this plan, by bare number.

   Docs only.

### Group 1: the server

2. **`getSeries` on `LibraryStorage`.** The series reader's own `getSeries(id)`
   is exposed beside `getMovie(id)`. The callers that want one series read it
   instead of a `SeriesDetail` or the whole shelf:
   - `createEnrichment`'s `titlesFor` and `titleOf`;
   - the PATCH route's lookup;
   - `resolveSeries`' held series.

   Every leaf passes unchanged.

3. **`seriesOr404` beside `movieOr404`.** It has the same shape: it answers
   the series, or `null` having already sent `404 { error: 'Unknown series:
<id>' }`. Its docblock cites `movieOr404`'s, and it stays local to the router
   on the same recorded argument. `PATCH /series/:id` looks its series up
   through it. Every leaf passes unchanged.

4. **The series delete takes the movie delete's shape.**
   - `deleteSeries(id)` answers nothing, like `deleteMovie`, so
     `SeriesDeletion` goes.
   - `DELETE /series/:id` looks the series up through `seriesOr404` and reads
     one episode's stored path. It deletes the row, then hands that path to
     `removeSeriesFolder`: row first, then bytes, best-effort, as before.
   - The write suite's unknown-id leaf becomes the movie's: deleting an id the
     library doesn't hold does not throw.
   - Every route leaf passes unchanged.

5. **One reading of the Series folder, in `media/`.** A single private reading
   inside `createMedia` gives the Series folder above an episode's **Stored
   path**: every segment but the last two, contained in the root, `null` for
   fewer than three segments or an escaping path.
   - `storeInSeriesFolder` and `removeSeriesFolder` read through it.
   - A new member, `openSeriesFolder(episodePath)`, is `openFolder`'s twin. It
     answers the Series folder of an episode whose file is there, else `null`.
   - The PATCH route's `seriesFolder` closure asks `openSeriesFolder` in place
     of `openFolder`, its segment count and `dirname`, and the route stops
     importing `dirname`.
   - New `createMedia` leaves for `openSeriesFolder`: a held episode's folder,
     `null` for a missing file, a two-segment path or an escaping one. Prior
     art: `openFolder`'s leaves.
   - Every other leaf passes unchanged.

6. **The Series Resolve's handler sits above its route's comment.**
   `resolveSeries` and its comment move, unchanged, to sit before the resolve
   route's own comment. That comment ("…`404` for a problem that is not
   there…") sits directly over `router.post(…/resolve)` again. Pure move;
   every leaf passes unchanged.

7. **An edited episode keeps its held and picked tracks apart.**
   - `EditedEpisode` answers `heldTracks` (the `storedSubtitles` it named) and
     `pickedTracks` (each landed part with its language) in place of the one
     merged `tracks`.
   - The PATCH route writes the held ones and then the picked ones, the order
     it writes today.
   - The resolve route maps held tracks to `found` files and picked ones to
     `stored`, with no index arithmetic.
   - `readSeriesEditFields`' docblock says the Series Resolve reads its body
     too.
   - Every leaf passes unchanged.

8. **A Source file spelled once.** The importer's `sourceFileOf` takes the
   Source folder's directory and the video, and both the scan and
   `resolveSeries` call it. Every leaf passes unchanged.

9. **A series' Field conflict writes what a film's does.** This is the round's
   one deliberate behaviour change, for **Title parity**.
   - `writeSeries` writes the plan's `fill` during the run and answers its
     conflicts, as the film's `write` does. `raiseConflict` puts the row up
     with TMDB's fields in `disputed`, as for a film.
   - _Apply choices_ writes `chosenSeriesEnrichment` through
     `storage.enrichSeries`, as a film's writes `chosenEnrichment` through
     `storage.enrichMovie`.
   - `heldShows` and the `settled` parameter of `writeSeries` and `writeShow`
     go.
   - The suite changes: the series-conflict _Skip_ leaf that expects the
     series unchanged becomes the film's leaf. _Skip_ keeps the conflicted
     fields as the household had them, and the gaps TMDB filled stay filled.
     One new leaf: the run writes a series' empty fields while its conflict
     waits for review. Prior art: the film conflict leaves in the same suite.

10. **The Title fix written the same way for both kinds.** A pick from a
    `missing` or `ambiguous` row writes the match. Then it writes
    `titleFix(…)` in its own call: `storage.enrichMovie` for a film,
    `storage.enrichSeries` for a series. The series path no longer folds it
    into the write. Every Title-fix leaf passes unchanged.

11. **The Title reference is a shared type.** `TitleReference`
    (`{ kind: 'movie' | 'series'; id: string }`) moves from `createEnrichment`'s
    local interface into the enrichment types, in both build targets, where
    the client can read it too (commit 21). It is still never on the wire
    `Decision`. Types only; every leaf passes unchanged.

### Group 2: the two bugs

12. **A Year range is spelled once on the client, and an edit keeps it.**
    - A new util, `spellYearSpan(year, endYear)`, mirrors the server's
      `spellYearSpan`: `2022`, `2019–2023`, `2021–`, or `null` with no year.
      It has its own suite.
    - A round-trip guard, on the `readEpisodeTag` drift guard's precedent, feeds
      its table through the server's `yearSpan` and expects the span back.
    - `seriesView`'s `toYearLabel` goes, and the series page reads the util.
    - `seriesFormValues` reads it too, so an open run opens as `2021–` and a
      one-year run as `2022`.
    - Two new `MovieForm.seriesEdit` leaves: an open run's _Save changes_ with
      the year untouched posts `2021–`, and a one-year run opens as `2022`.
      The existing `2019–2023` leaf passes unchanged.

13. **"Its 1 episode."** `DeleteSeriesDialog`'s body takes the singular at one,
    the ternary every other count in the app uses. A new dialog leaf: a
    one-episode series reads _its 1 episode leave your library_. The sentence
    is the PRD's at every other count.

### Group 3: the client

14. **The Series tab as a route.** A new util, `seriesTabPath()`, answers
    `/?tab=series`, `moviePath`'s precedent, with its own suite.
    `SeriesPage`'s Landing, `useDeleteSeries`' Landing and `useMovieForm`'s
    series Fresh home read it. Every leaf passes unchanged.

15. **`movieFormPath` learns the kind.** `MovieFormQuery` gains
    `kind?: 'series'`, set first so the URL reads
    `/add?kind=series&problem=<id>&series=<id>` as the glossary spells it. Its
    docblock names the Series Resolve and says `series` beside `problem` is the
    join. `ProblemRow`'s `resolveRoute` calls it with the kind, and the
    `.replace(…)` goes. There are new `movieFormPath` leaves for the kind, and
    every `ProblemRow` leaf passes unchanged.

16. **The episode count from the series' view model.** `SeriesPageModel` gains
    `episodeCount`, summed in `seriesView` beside `countLabel`, which already
    counts the same episodes. `SeriesDetail` passes it to the menu. There's a
    new `seriesView` leaf, and every `SeriesDetail` leaf passes unchanged.

17. **The movie form's api in declaration order.** `updateSeries` moves below
    `updateMovie`, so `updateMovie`'s docblock is its own again. Pure move.

18. **`CornerMenu`, the ⋯ menu's furniture, as a molecule.** A new
    `components/CornerMenu/` unit holds the furniture both menus draw:
    - `Menu` in the fixed top-right slot;
    - the translucent 44px ⋯ trigger named _More options_;
    - `MoreIcon` at 20.

    It takes its `MenuItem`s as children. It's presentational: it knows no
    route and no dialog. Its styles are `EditMenu.styles.ts`' two blocks,
    their docblocks kept. Its suite: the trigger's name, the items opening
    and closing, and the fixed slot. Prior art: `Menu`'s suite.
    `EditMenu` composes it, and its styles file goes. Every `EditMenu` leaf
    passes unchanged.

19. **`SeriesEditMenu` composes `CornerMenu`.** Its styles file goes. Every
    `SeriesEditMenu` leaf passes unchanged. The two menus stay in their
    features: each navigates and owns its feature's dialog (log 38 Q8).

20. **`FoundFileChoice` in its own folder.**
    - `features/movie-form/FoundFileChoice/` gets its own tsx, styles and
      test. Its props are `{ videos: MovieFormFile[], video, onChoose, onPick }`.
      The hook hands it `foundFile(path)` slots, so the component parses no
      path and `nameOf` goes.
    - Its option and dot take `$selected`, `ScopeCard`'s and `FormatCard`'s
      name.
    - `MovieFormFiles`' choice styles move with it, and `MovieFormFiles` keeps
      only the branch: the choice for two or more, the `FileField` otherwise.
    - The found-choice leaves move into the new suite, rendering the unit
      itself and asserting the same things. The `MovieFormFiles` suite keeps
      one leaf per branch.

21. **One reading of the single title in the Enrichment flow.**
    - `useEnrichmentRun(title: TitleReference | null)` replaces the
      `(movieId, seriesId)` pair, and `belongsHere` reads `title.kind`.
    - `EnrichmentFlow` reads `?movie=` / `?series=` into one `TitleReference`
      once. The Landing, Start's body, the scope card and _Done_ all read that
      one value.
    - The words go to `enrichmentView`, the flow's file of words:
      `singleScopeLabel(kind)` (_Just this movie_ / _Just this series_) and
      `finishLabel(title)` (_Back to the movie_ / _Back to the series_ /
      _Done_), each with leaves.
    - `EnrichmentSetup`'s `titleKind` is typed off `TitleReference['kind']`,
      and its docblock is wrapped to the measure.
    - Every flow leaf passes unchanged.

22. **`files.videos` is required.** `ImportProblemDetail['files'].videos`
    becomes `string[]`, empty for a problem with no folder. The server already
    sets it on every other detail. The `?? []` readers go, and the older
    fixtures gain `videos: []`. Types and fixtures; every leaf passes.

23. **A Season folder read by the server's rule, under a drift guard.**
    - `groupShows` exports its `seasonOf`.
    - The movie form gains `readSeasonFolder/`, its mirror: `Season 01`,
      `Season 1` or `S01`, else `null`.
    - The `readEpisodeTag` drift guard's table gains the season-folder cases
      and holds the two to one answer.
    - The Numbering guess's `folderSeason` reads it, with season 1 for a name
      that is not a Season folder.
    - A new Series Resolve leaf: a folder named `Disc 2` guesses season 1.
      That is the server's reading; the client's today guesses 2.

### Group 4: the form's five jobs

24. **`formJob`, the URL read once.** A new pure unit in the movie form:
    - `formJob(params)` answers one of `add` (with its **Form kind**), `edit`,
      `resolve` (with the movie it is over, whether the series kind was asked,
      and the series it would join) or `seriesEdit`.
    - `formLanding(job)` answers each job's **Landing**.
    - It holds today's precedence: `?problem=` over `?movie=` over
      `?series=`, and `?kind=` read on a plain add or beside a problem only.
    - Its suite covers every URL the screen is opened on.
    - `useMovieForm` reads it in place of its four `searchParams.get`s and the
      flags it built from them. Every `MovieForm` leaf passes unchanged.

25. **`loadFormRecord`, the reads in one place.** A new unit in the movie form:
    - `loadFormRecord(job)` makes the job's reads and answers what the form
      opens on: values, rows and taken pairs, found videos, the resolving
      banner and whether it is an `unplaced` show, or `null` for a record
      that is gone.
    - The reads are `fetchMovie`, `fetchSeriesDetail`, and `fetchProblem` with
      the held series beside it.
    - `useMovieForm`'s three effects become one: load, then seed once per job,
      with the same stale-response guard.
    - Its suite runs over `fakeResponse`, with one leaf per job, a gone record
      and a refused read. Prior art: `fetchMovie`'s and `fetchProblem`'s
      suites.
    - Every `MovieForm` leaf passes unchanged.

26. **The save as a switch over the job.** `save`'s four-deep ternary becomes a
    `switch` on the job's kind and the form's kind. It has the same five
    writes and the same landings, and each branch keeps its comment. Every
    leaf passes unchanged.

27. **`useMovieForm` says it has five jobs.**
    - The hook's docblock describes the Series edit job and the Series
      Resolve beside the three jobs it already describes.
    - The parameter constants' docblocks say which job each opens.
    - The "Why this file has no test" note names `formJob` and
      `loadFormRecord` as the units that took the testable halves.
    - Comments only.

### Group 5: the prototype and the docs

28. **The prototype and the spec match the build.**
    - In `feat.MovieForm` and the container, the Found-file choice's picker
      reads _Choose video file_, the slot's own label, which the build
      already draws.
    - `COMPONENT-SPEC.md`'s Found-file choice entry gives `FoundFileChoice`'s
      folder and its props as built.
    - A new entry, `CornerMenu`, says it is drawn inline in `page.MoviePage`
      and `page.SeriesPage` (the `DetailBackdrop` precedent).

    Docs only.

29. **The glossary and CLAUDE.md describe what shipped.**
    - **The glossary:**
      - **Unplaced** is one Problem per show with a _Resolve_, its reason the
        count, its row carrying `seriesId` when the show is held.
      - **Title reference** is a shared type.
      - Dialogue quoted from earlier sessions stays as it was said.
    - **CLAUDE.md:**
      - The tree gains `SeriesEditMenu/`, `DeleteSeriesDialog/`,
        `useDeleteSeries/`, `CornerMenu/`, `FoundFileChoice/`, `formJob/`,
        `loadFormRecord/`, `readSeasonFolder/`, `seriesTabPath/`,
        `spellYearSpan/` and `fetchSeriesDetail/`, which makes "the ten that
        earned it", with `fetchSeriesDetail`'s reason added to the `api/`
        paragraph.
      - `createMedia/` lists the five removals and `openSeriesFolder`.
      - `db/` names migration 8.
      - The `types/` line gains `sourceFile`, `seriesId` and `files.videos`.
      - The build order names step 21 **Title editing** and drops 22 and 23,
        as log 38 Q1 rules.
      - The Maintainer tools entries are folded into one.
      - No ticks yet.

    Docs only.

30. **The ticks, and the round's journal entry.**
    - CLAUDE.md's step 21 and its Maintainer tools entry become ✅, and the
      build-order line reads steps 16–21 done, closing the third chain.
    - The README's three 🔜 rows become one ✅ **Title editing** row, and its
      build order follows.
    - A new top journal entry, _Title editing — the refactor_, records what
      each group changed, the one deliberate behaviour change, the two fixes
      and the counts.
    - Docs only. Closes this issue, then 302.

## Decision Document

- **One reading per rule, owned by its domain.**
  - The Series folder of a Stored path is `media/`'s, read once and exposed as
    `openSeriesFolder`.
  - A Source file is the importer's, spelled once.
  - A Year range and a Season folder are the server's readings. The client
    mirrors each, and a drift guard holds them to one answer, as
    `readEpisodeTag` is held to `episodeTag`.
- **A series twin takes its film's shape** unless log 38 says otherwise:
  - `getSeries` beside `getMovie`, and `seriesOr404` beside `movieOr404`;
  - a `void` `deleteSeries`, with the route reading the path to clean up, as
    the movie delete reads `videoPath`;
  - a conflict that writes its gaps and asks about the rest;
  - the Title fix written after the match, in its own call.
- **Title parity outranks the issue-306 test.** The film's conflict behaviour
  is the rule; the series' held-whole behaviour was a build decision no log
  made. This is the round's one intended behaviour change, and its leaves move
  with it.
- **`TitleReference` is one shared type**, `{ kind: 'movie' | 'series'; id }`.
  The server keys Decisions with it and the client reads the single title
  with it. The wire `Decision` and `StartEnrichment` keep `movieId` and
  `seriesId`; nothing on the wire changes.
- **Routes are built by path utils.** `seriesTabPath()` joins `moviePath` and
  `seriesPath`, and `movieFormPath` takes `kind`. No caller writes a route
  literal or edits a built path.
- **Each component has its own folder.** `FoundFileChoice` gets one. A
  component takes `MovieFormFile` slots and parses no paths.
- **`CornerMenu` graduates to `components/`** as presentation alone. Both ⋯
  menus stay feature units, because each navigates and owns a feature's
  dialog (log 38 Q8).
- **`useMovieForm` splits by concern, not by job.** `formJob` reads the URL
  and `loadFormRecord` makes the reads, both pure or async units with suites.
  The hook keeps the state and the writes. One component still calls it, so
  it still has no suite of its own (its recorded rule).
- **`files.videos` is required**, as the PRD types it, and empty with no
  folder.
- **`ImportProblem.seriesId` stays.** The PRD said the row gains no field, but
  _Resolve_ on a held show needs the id, and the row is all `ProblemRow` has.
  The journal and the glossary record the deviation.
- **The prototype yields to the build on the picker label.** _Choose another
  video file_ was wording invented in issue 303's unreviewed revision.
  _Choose video file_ is the slot's own label everywhere else.
- **Unchanged:**
  - every route, status and sentence;
  - the schema and migration 8;
  - the Two-pass renumber;
  - the Match unlink;
  - the Numbering guess's order rules;
  - `seriesFormBody`'s refusal order;
  - every screen's pixels;
  - the design log.

## Testing Decisions

- A good test checks what a unit answers, what the wire carries, what lands
  on disk and in the database, or what a person sees and presses. It never
  checks how a unit is wired inside.
- **New suites:**
  - `seriesTabPath` and `spellYearSpan`, utils, which each need a test by
    rule;
  - `CornerMenu`, prior art `Menu`;
  - `FoundFileChoice`, its leaves moved from `MovieFormFiles`;
  - `formJob`, a pure table of URLs;
  - `loadFormRecord`, over `fakeResponse`, prior art `fetchProblem`;
  - `readSeasonFolder`.
- **New leaves:**
  - `openSeriesFolder` in `createMedia`'s suite;
  - a series conflict's gaps written during the run, in the review suite;
  - the open run round-tripped, in `MovieForm.seriesEdit`;
  - the singular, in `DeleteSeriesDialog`;
  - `movieFormPath`'s kind;
  - `seriesView`'s `episodeCount`;
  - `enrichmentView`'s two words;
  - a `Disc 2` folder guessing season 1, in `MovieForm.seriesResolve`.
- **Moved leaves:**
  - the series-conflict _Skip_ (commit 9);
  - the unknown-id delete, which becomes "does not throw" (commit 4);
  - the found-choice leaves (commit 20).
- **Drift guards:** the `readEpisodeTag` guard's table gains the season-folder
  cases, and a round-trip guard holds the client's `spellYearSpan` to the
  server's `yearSpan`. Both import across the two build targets, which is that
  guard's precedent.
- **Every other commit leaves every answer unchanged**, and the existing
  leaves check it.
- Every commit runs the touched suites, `tsc -b --force`, ESLint and Prettier,
  and they must be green. The full suite runs before group 5 and again before
  the last commit.

## Out of Scope

- **A `RadioDot` primitive.** `ScopeCard`, `FormatCard` and the Found-file
  choice each draw a radio dot. The third is 16px on a different ring by the
  prototype, and there is no `prim.*` file for one. Graduating it is a
  prototype question. Commit 20 aligns the prop name; the journal records the
  three.
- **The dialogs' `Copy` and `Actions`.** Each feature styles its own, an
  established convention across ten files.
- **A series with no episodes.** Its delete has no episode path to find the
  Series folder from. No path in the app makes one: the form's gate, the edit's
  gate and every import need an episode.
- **A replacement named like the stored file overwrites it**, and a refused
  edit then removes it. The movie edit already behaves this way, so it needs
  its own initiative over both kinds.
- **`createEnrichment`'s kind branches** in `held`, `search`, `pick` and
  `apply`. Each branch calls a different TMDB call and storage write, and
  commit 11's shared type is the seam a later extraction would need.
- **Splitting the router**, or moving the PATCH series route out of it. Every
  route lives there today.
- **The `issue-loop` budget.** The step token counts go in the journal (commit
  1. for whoever next runs `prd-to-issues`. Changing that skill isn't this
     round's job.

## Further Notes

- Log 38 is an immutable snapshot. The journal records the build's deviations,
  and this round brings the code back to it where it drifted: Title parity on
  conflicts, `files.videos` required. It records where the log was overtaken:
  `ImportProblem.seriesId`.
- Commit 9 is the only commit that changes what a maintainer sees. After a
  Sync, a series' empty fields are filled straight away, as a film's are, even
  while its conflict row waits.
- Commits 12 and 23 each fix a disagreement between the client and the server.
  Each comes with the guard that would have caught it.
