# Refactor plan: Rebuild whole, the build's leftovers named, one Watched rule, one path cell resolver, the cell rules in `exportRows`, the suites that test behaviour, and the docs that close step 42

> Source initiative: `rebuild-whole`, issue 547 (step 42).
> Shipped by issues 548 to 560: the build slices 548 to 559, RED and GREEN
> each (`fb385777` to `0e2d727e`), and the documents (560, `c5c19265`,
> `e0ece99b`).
> Design log: `docs/design-logs/59-rebuild-whole.md`.
> PRD: `docs/PRDs/59-rebuild-whole.md` (547). Plan:
> `docs/PRDs/59-rebuild-whole-plan.md`.
> This is the initiative's closing round. It ticks **Rebuild whole** and
> closes 547. Filed as issue 561.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`rebuild-whole` shipped every phase of its plan. A scan imports a series
whole (`numberShow` carries its art, `importShow` copies it in, a rescan fills
a held series' empty art); a new title takes every **Sheet column** its
**Row type** has and a held title fills only what is empty; the **Library
sheet**'s **Path cells** come from a **Layout read** (`layoutCells`) and the
Export's from its **File plan** (`filePlan`), both handed to `exportRows`; a
path cell fills a place the folder left empty (`pathCellFills`); the importer
runs the **Layout fill**; the **Show folder read** reads by
`readSeasonFolders`; a hollow show is `empty`; an **Orphaned row** is one
Warning line; every read folder is touched at review, equal bytes are not
written, and a **New folder**'s sheet is never written. The **Round trip**
suite proves it.

At `e0ece99b` the full suite has **11605 tests across 740 files, all
passing** (one skipped), against 11477 across 724 when folder-layout closed.
`tsc -b --force` is clean. `eslint src server electron` reports 1 error and
138 warnings; the one warning over folder-layout's 137 is this initiative's
(an unused `cpSync` import in `createImporter.seriesArt.test`).

The design held. What is left is what thirteen slices written one finding at a
time leave behind: names from the units the build retired, rules the build
spelled a second time beside the one that already existed, a rule placed in
the unit that first needed it rather than the one that owns it, and suites
that pin the repository instead of the behaviour. Every finding below was
checked against the code at `e0ece99b`. They fall into six families.

### 1. Leftovers of the retired units

- **`executeScan` still says `grouped`.** It destructures each walked folder
  as `{ folder, films: found, shows: grouped, sheet }` and loops
  `for (const show of grouped)`. Nothing is grouped since `groupShows` went;
  the walk reads a series whole and `numberShow` numbers it.
- **`readShowFolder` keeps `groupShows`' answer shape.** Its new `showUnder`
  answers at most one show, and `readShowFolder` wraps it back into an array
  (`const shows = read.show === null ? [] : [read.show]`) only to
  `flatMap` over it, as it did over `groupShows`' `shows`. The answer's type,
  `{ show: ShowScan | null; loose: string[] }`, is written inline twice.
- **`readShowFolder.test.ts`'s comments** still say a pick is "walked with
  `walkLibraryFolder`, grouped with `groupShows`" (three places).

### 2. A rule spelled a second time beside the one that exists

- **The Episode tag spelled by hand.** `fillHeldEpisodes` spells its
  `✓ Updated` line's `S01E01` with two `padStart(2, '0')`s, in a file that
  already imports `spellEpisodeTag`, the one spelling of the tag.
- **Watched planned through a borrowed series.** `planSheetFields` gained a
  third kind, `'episode'`, that returns before anything else with only the
  Watched mark. `fillHeldEpisodes` calls it with the episode's status spread
  over `heldSeriesValues(detail.series)`: a whole series' values built so one
  field can be read. The rule it needs is one line, "a row's Watched marks an
  unwatched title", which the film branch of `planSheetFields` spells again.
- **The fill-only fields listed in the caller.** `filledNames` names the
  fields a fill wrote by `SHEET_FIELDS` (the six that can differ) and then by
  an inline `['runtime', 'tmdbScore', 'tmdbId'] as const`. The list is
  `planSheetFields`' rule (_fills alone, never a difference_) and lives in its
  docblock, not beside it as a constant.
- **`HeldValues` speaks two vocabularies.** It names its fields as the sheet
  does (`director` for a series' creator, the new `runtime`), and then names
  the heart as storage does, `isFavorite`, while `SheetRow` and `SheetFill`
  call it `favorite`.
- **A path cell is resolved twice.** `matchRows` has a private `resolved(base,
cell)` (`join(base, ...cell.split('/'))`); `pathCellFills` has a private
  `resolvedCell(base, cell)` doing the same, behind an `isAbsolute` guard for
  a cell the matcher already resolved. The sheet's cell format is one rule.
- **A run's sheet held in two places.** `walkListed` now holds every folder
  its walk read (`heldSheets.add` then `librarySheet.hold`), and
  `readMetaSheet` still holds the same folder the same two lines later, as it
  had to before the walk did. The two lines are written twice beside
  `releaseSheets`, which has a name.
- **The scanned art looked up three times.** `importShow` finds a Season
  poster with `show.seasons.find((season) => season.number === n)?.poster ??
null` twice (a new series' and a held one's) and a Still with
  `show.episodes.find(...)` once, each inline.

### 3. A rule in the unit that first needed it

- **The Video cell is spelled in `filePlan`.** `videoCell` (a film's one loose
  video, an episode's **Source file**, the spelled Season folder only for
  none) is a cell rule both **Path cells** answer alike; `layoutCells`
  imports it from the Export's **File plan**. Log 59 Q12 keeps `exportRows`
  "the one place a cell rule is spelled", and `VideoPlace` already lives
  there.
- **The File plan's types live in `exportRows`.** `ExportFile` (its docblock:
  "One file of the **File plan**") and `ExportInclude` (the File plan's one
  parameter) are declared in `exportRows`, which no longer plans or reads
  them; `writeExport` and `filePlan` import them from there.
- **`createLibrarySheet`'s `readFolders` is a closure for no reason.** It
  reads nothing of the writer's state, beside `sameBytes`, which is
  module-level.

### 4. Suites that pin the repository, not the behaviour

- **`createImporter.documents.test.ts`** reads the feature checklist, the
  glossary and CLAUDE.md off the disk and shells out to `git` twice: once to
  grep for declarations, once to compare CLAUDE.md with a pinned commit
  (`SLICE_BASE = '0e2d727e'`). It asserts step 42 "is still 🔜", which this
  round's docs commit must break. It sits in `createImporter/` and tests
  nothing of it. No earlier initiative's documents slice had a suite: each
  was a `docs:` commit (544, 522, 509, 498).
- **Two retirement suites**: `numberShow.test`'s _groupShows is retired_
  (the folder does not exist; no source contains the name) and
  `readShowFolder.oneReader.test`'s _the old walk under a pick is retired_
  (the same for `scansUnder`, spelled in pieces so the suite does not match
  itself). They pin the absence of a file, which `tsc` already guarantees for
  any importer, and have no prior art.
- **`numberShow.test` carries `seasonNumberOf`'s cases.** _seasonNumberOf:
  Season NN only_ came with `groupShows.test`'s move; `seasonNumberOf.test`
  (folder-layout's refactor, issue 545) covers the reading through the shared
  `seasonFolderCases` table.
- **`pathCellFills.test` has no header**, the one new suite of the round
  without `59, Rebuild whole, Phase N (issue #n): …`.
- **One lint warning the round wrote**: `createImporter.seriesArt.test`
  imports `cpSync` and never calls it.

### 5. Comments

- **Docblocks edited mid-line and never rewrapped**: `layoutCells` (one line
  near 110 columns), `exportRows` (_Two titles sharing a Folder key_),
  `filePlan` (_relative to the **Export folder**_), `createLibrarySheet` (a
  short line, then one past 80), `readShowFolder` (_its subfolders not
  read_).
- **`importShow`'s docblock says what it no longer does**: "its _Status_ is
  not applied" (an episode's Watched is), "the held metadata is left as it
  is" (a held series' empty art is filled), the row's fields stop at cast
  (it takes the TMDB id, rating and heart too), and it does not say what it
  answers (the series' id, or `null`).
- **Two `INSERT`s overrun 80 columns** after the build added a column:
  `createWrite`'s movie insert and `createSeriesWrite`'s series insert.

### 6. The documents

- The feature checklist's row reads _Rebuild whole: every sheet field and
  series art_, 🔲 Planned, and step 42 is 🔜, one of its lines past 100
  columns.
- README's server tree still lists `groupShows` under `import-export/` and
  none of `numberShow`, `filePlan`, `layoutCells` or `pathCellFills`.
- The release checklist walks a Factory reset and a scan, but not the
  promises of step 42: a series' art, a heart and a Watched episode back
  after the reset, and the sheet unchanged by the rebuild.

## Solution

One round in seven groups, each commit leaving the suite green and the
typecheck clean:

1. **The retired units' leftovers named for what is there.**
2. **One rule each**: one Episode tag spelling, one Watched rule, one list of
   fill-only fields, one heart name, one path cell resolver, one hold, one
   lookup of scanned art.
3. **The cell rules in `exportRows`, the File plan's types in `filePlan`.**
4. **Small seams**: the Library sheet's folder read module-level.
5. **Suites that test behaviour**: the documents and retirement suites
   retired, the copied cases dropped, a header added.
6. **Comments** rewrapped and made true.
7. **The docs that close step 42.**

No behaviour changes. No wire, schema, Settings, copy or prototype change.
The household sees nothing new.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [rebuild-whole] issue #561 …`, except where a commit is
named `test:` or `docs:`.

### Group 1: the retired units' leftovers

1. **`executeScan` names what the walk found.** The destructuring reads
   `{ folder, films: foundFilms, shows: foundShows, sheet }` and the loops
   read those names. Guarded by `createImporter.folderScan`, `.series`,
   `.seriesArt`, `.metaSheet`, unchanged.
2. **`readShowFolder` reads one show.** `showUnder` answers a named
   `PickedFolder { show: ShowScan | null; loose: string[] }` (one docblock:
   a pick's numbered show, or its loose videos); `readShowFolder` reads
   `read.show?.episodes ?? []` and `read.show?.unplaced ?? []` without the
   one-element array. Guarded by the `readShowFolder` suites
   (`.layout`, `.relativePath`, `.oneReader`, the base suite) and
   `routes.showFolder*`, unchanged.

### Group 2: one rule each

3. **`fillHeldEpisodes` spells the tag through `spellEpisodeTag`.** Its line
   reads `${spellEpisodeTag(season, number)} watched`; the `padStart`s go.
   Guarded by `createImporter.heldFills`, whose line assertion is unchanged.
4. **`marksWatched`, the one Watched rule.**
   - `planSheetFields` exports `marksWatched(status, row)`: the row says
     Watched and the title is unwatched. One docblock, in the voice of the
     unit's own (_Watched only marks, never unmarks_).
   - `planSheetFields` reads it for a film and goes back to two kinds,
     `'movie' | 'series'`; the `'episode'` branch goes.
   - `fillHeldEpisodes` reads `marksWatched(episode.status, row)` and no
     longer builds a series' `HeldValues` for an episode.
   - `planSheetFields.test`'s Episode cases are the same cases asserted
     through `marksWatched` (an unwatched episode marked, a watched or in
     progress one not, `In progress` and `Unwatched` rows marking nothing);
     the commit body names the move. Guarded otherwise by
     `createImporter.heldFills`, `.sheetFills`, `.roundTrip`.
5. **`FILL_ONLY_FIELDS` beside the rule.** `planSheetFields` exports
   `FILL_ONLY_FIELDS = ['runtime', 'tmdbScore', 'tmdbId'] as const`, in the
   sheet's column order, its docblock carrying log 59 Q9's reason (a TMDB id
   is a Sync's business); `filledNames` reads it in place of its inline
   list. Guarded by `createImporter.heldFills`, whose `✓ Updated` lines are
   unchanged.
6. **`HeldValues` calls the heart `favorite`**, as `SheetRow` and
   `SheetFill` do; `heldValues`, `heldSeriesValues` and `planSheetFields`
   read the new name. Guarded by `heldValues.test` (its one assertion
   renamed, the commit body says so) and `planSheetFields.test`.
7. **`resolvePathCell`, the one path cell resolver.** `readSheet`, the unit
   that reads the sheet's cells and owns their spelling with
   `SHEET_PATH_SEPARATOR`, exports `resolvePathCell(base, cell)`: a cell,
   relative with forward slashes, joined to its **Library folder**.
   `matchRows` reads it in place of `resolved`; `pathCellFills` reads it in
   place of `resolvedCell`'s join and keeps its own `isAbsolute` guard, named
   for its reason (a cell the matcher already resolved). `readSheet.oneSheet`
   gains its cases: a nested cell, a cell with a space, a Windows root. Guarded
   by `matchRows.folderKey`, `pathCellFills.test`, `createImporter.pathCells`.
8. **One hold of a run's sheet.** `holdSheet(folderId)` beside
   `releaseSheets`, with a docblock: held until the run closes, so the sheet
   catches up then, not in review. `walkListed` calls it; `readMetaSheet` no
   longer holds (its only caller reads folders the walk read and held), and
   its docblock says the walk held the folder. Guarded by
   `createImporter.metaSheet`, `.sheetCatchUp`, `.roundTrip`.
9. **The scanned art looked up by name.** Two module-level helpers in
   `createImporter`, beside `episodeRowsOf`: `scannedSeasonPoster(show,
season)` and `scannedStill(show, season, episode)`, each answering the
   path or `null`. `importShow`'s three inline lookups read them. Guarded by
   `createImporter.seriesArt`, `.heldSeriesArt`, `.pathCells`.

### Group 3: the cell rules in `exportRows`, the File plan's types in `filePlan`

10. **`videoCell` moves to `exportRows`**, beside `VideoPlace`, with its
    private `videoPath`. `filePlan` and `layoutCells` import it from there;
    `layoutCells` no longer imports from the File plan. Guarded by
    `exportRows.test`, `filePlan.test` (_the Video cell_ describes),
    `layoutCells.test`, `createLibrarySheet.test`, unchanged.
11. **`ExportFile` and `ExportInclude` move to `filePlan`**, with their
    docblocks; `writeExport` imports them from there. `exportRows` keeps
    `ExportCell`, `ExportTable`, `ExportRows`, the places and `PathCells`.
    Types only; guarded by `tsc -b --force` and `writeExport`'s suites.

### Group 4: small seams

12. **`readTitleFolders`, module-level.** `createLibrarySheet`'s
    `readFolders` leaves the writer's closure as `readTitleFolders(root,
names)`, beside `sameBytes`, its docblock unchanged in substance.
    Guarded by `createLibrarySheet.test`.

### Group 5: suites that test behaviour

13. **`test: [rebuild-whole] issue #561 the documents suite retired`.**
    `createImporter.documents.test.ts` goes whole. What it guarded is
    either this round's own work (the docblocks of Group 6, the documents of
    Group 7) or a review's (CLAUDE.md unchanged, the glossary's names). The
    body names the four `docs:` commits of earlier initiatives that had no
    suite.
14. **`test: [rebuild-whole] issue #561 no retirement suites`.**
    _groupShows is retired_ leaves `numberShow.test`, with its `sourcesUnder`
    and `SERVER_SRC` helpers; _the old walk under a pick is retired_ leaves
    `readShowFolder.oneReader.test`, with its own. A retired unit's importer
    fails `tsc`; a retired folder is a fact of the tree.
15. **`test: [rebuild-whole] issue #561 each suite tests its own unit`.**
    - _seasonNumberOf: Season NN only_ leaves `numberShow.test`. Each of its
      22 names is first checked against `seasonFolderCases`; any the table
      lacks joins the table (and so `seasonNumberOf.test` and the client's
      drift guard), so no case is lost.
    - `pathCellFills.test` gains its header: `59, Rebuild whole, Phase 8
(issue #555): a path cell fills an empty place.`, and a sentence on
      what it pins, in its siblings' voice; its two `describe`s take a colon
      (`filmWithCells: …`, `showWithCells: …`).
    - `readShowFolder.test`'s three comments naming `groupShows` name
      `numberShow` and `readSeasonFolders`.
    - `createImporter.seriesArt.test` drops its unused `cpSync` import; lint
      ends this group at 1 error and 137 warnings.
      No assertion changes but the moved cases.

### Group 6: comments

16. **The docblocks rewrapped and made true.**
    - Rewrapped to 80 columns: `layoutCells`, `exportRows`, `filePlan`,
      `createLibrarySheet`, `readShowFolder`.
    - `importShow`'s docblock says what it does now: the row's fields
      include the TMDB id, TMDB rating and heart; each episode takes its
      row's Watched (an `In progress` one starts unwatched); a held series'
      empty art is filled, never replaced; it answers the series' id, or
      `null` when nothing was made or held.
    - The two `INSERT`s rewrapped inside their template strings.
      Comments and SQL whitespace only.

### Group 7: the docs

17. **`docs: [rebuild-whole] issue #561 the docs know the rebuild`.**
    - **Feature checklist**: the row reads _Rebuild whole: every sheet field
      and series art_, ✅; step 42 goes ✅ with what shipped, in step 41's
      shape, its lines rewrapped.
    - **README**: the server tree's `import-export/` names `numberShow` in
      place of `groupShows`, and `filePlan` (the Export's File plan),
      `layoutCells` (the Library sheet's cells) and `pathCellFills`.
    - **Release checklist**: one smoke over the sandbox Library folder in the
      shell, after the existing Factory reset smoke: a series with a poster,
      a Season poster and a Still in its Title folder, hearted, one episode
      Watched; a Factory reset, the folder listed again, _Scan new folders_,
      _Done_: the series comes back with all three pieces of art, the heart
      and the Watched, and `Meta\familyflix-library.csv` is unchanged
      (same size and modified time).
    - **Glossary**: **Sheet fill** names `marksWatched` and
      `FILL_ONLY_FIELDS`; **Path cells** says the Video cell's rule is
      `exportRows`' own. The dialogue is a snapshot and stays.
18. **`docs: [rebuild-whole] issue #561 the journal`.** A
    newest-first entry in `docs/dev-journal.md`, in the last entry's shape:
    what shipped, what each group changed, where the round left the plan,
    what was deliberately not changed, the follow-ups (below). The commit
    closes 547 in words, not with a keyword, and this issue with one.

## Decision Document

- **A rule has one home, the unit that owns its concept.** The Episode tag's
  spelling is `episodeTag`'s; the Watched rule and the fill-only list are
  `planSheetFields`' (the plan of what a row writes); a path cell's
  resolution is `readSheet`'s (the reader of the sheet's cells, beside
  `SHEET_PATH_SEPARATOR`); a cell's value is `exportRows`' (log 59 Q12). The
  File plan's own types are `filePlan`'s.
- **`planSheetFields` keeps two kinds.** An Episode row has one sheet value a
  held episode can take, its Watched; a third kind that returns before
  everything else is a second function inside the first. `marksWatched` is
  that function, named.
- **`HeldValues` follows the sheet's names**, as most of its fields already
  did (`director`, `runtime`), so a plan compares `row.favorite` with
  `current.favorite`.
- **`resolvePathCell` handles a relative cell only.** `pathCellFills`' guard
  for an absolute one stays in `pathCellFills`: it exists because the
  matcher resolved some rows before they reach it. Teaching the shared
  resolver about absolute cells would change what `matchRows` does with a
  hand-written absolute cell (today: joined, and not found), a behaviour
  change this round does not make.
- **`readMetaSheet` stops holding.** The walk holds every folder it read
  (log 59 Q19), and `readMetaSheet` is only ever called for a folder the walk
  read. The hold is a `Set`, so the second call did nothing; removing it
  changes no outcome.
- **The scanned-art lookups stay in `createImporter`**, module-level beside
  `episodeRowsOf`, not in `numberShow`: they are the importer's questions of
  a `ShowScan`, and `numberShow` is one function and its types.
- **`videoCell` belongs to `exportRows`, not to the File plan.** Both Path
  cells answer the Video cell the same way; the Layout read blanks it only
  for an unread folder, which `layoutCells` decides.
- **`pathCellFills` keeps its name.** Its two exports are named for what they
  answer (`filmWithCells`, `showWithCells`) and the folder for the rule, as
  `plannedSheetFill` holds `movieSheetPatch` and `seriesSheetPatch`.
- **Suites that read the repository go.** A good test asserts what a caller
  or the household sees; a file's absence, a commit's CLAUDE.md and a
  checklist's emoji are none of those. Documents are a `docs:` commit, as
  in every initiative before this one.
- **Nothing on the schema, the wire, Settings, the prototype or any copy
  changes.**

## Testing Decisions

- **A good test asserts what a caller or the household sees**: the library a
  scan leaves, the cells a row carries, the files on disk, the sheet's bytes,
  the log lines. It never asserts which helper ran, where a file lies in the
  repository, or what a document says.
- **The initiative's behavioural suites carry every refactor commit**:
  `createImporter.roundTrip`, `.seriesArt`, `.heldSeriesArt`,
  `.sheetFields`, `.heldFills`, `.pathCells`, `.layoutFill`,
  `.orphanedRows`, `.sheetCatchUp`, `.metaSheet`, `.folderScan`, `.series`,
  `.sheetFills`; `numberShow`, `readTitleFolder.seasonFolders`,
  `walkLibraryFolder.hollowShow`, the `readShowFolder` suites,
  `planSheetFields`, `heldValues`, `matchRows.folderKey`, `pathCellFills`,
  `exportRows`, `filePlan`, `layoutCells`, `createLibrarySheet`,
  `writeExport`'s suites, `series write`, `routes.showFolder*`.
- **Assertions that move, each named in its commit body**:
  `planSheetFields.test`'s Episode cases (to `marksWatched`, commit 4);
  `heldValues.test`'s heart field (commit 6); the moved Season folder cases
  (commit 15). No other assertion changes.
- **New tests**: `marksWatched` (commit 4), `resolvePathCell` (commit 7).
  Prior art: `planSheetFields.test`'s Watched cases; `readSheet.oneSheet`'s
  `isTitleRow` case from issue 545.
- **Retired suites**: the documents suite and the two retirement describes
  (commits 13 and 14). The full suite's count drops by their cases, and the
  commit bodies give the before and after.
- **Characterization before change.** A suite that has to change anywhere
  else than named here is reading an implementation detail, and is fixed in
  the same commit with the reason in the body.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at 1 error and 137
  warnings, or fewer.

## Out of Scope

- **A shared importer harness.** `untilReview` is written out in 50 suites,
  and each of this round's nine new importer suites also writes its own
  `sandbox`, `writeImage` or `sheetOf`. One `test-support/` harness is a
  round across every importer suite, older ones included, not this
  initiative's closing.
- **An absolute path cell in a hand-written sheet.** `matchRows` joins it to
  the Library folder and finds nothing; reading it as it stands is a
  behaviour change (see the Decision Document) and a `fix:` issue of its own.
- **`importShow`'s shape**: five positional parameters and two nested
  helpers (`copyArt`, `fillHeldArt`) that share its failure lists. Splitting
  it is its own round.
- **Carried from folder-layout**: an options object for `createApiRouter`,
  a discriminated library scope, `importPlaced`'s parameters as an object,
  the Sync's done summary still wording the retired Write targets.
- **Everything log 59 put out of scope**: a Sync against real TMDB, the
  Electron window's copy, the Ordered shutdown's flush on Windows, Linux case
  sensitivity beyond the Video cell, merging two installs' sheets.
- **The frozen `handoff-rebuild-whole/`.**

## Further Notes

- Group 2 is the round's reason to exist: the build added each rule where the
  slice in hand needed it, and four of them already had a home.
- Order: commit 1 and 2 before 15 (whose comments name what they read); 4
  before 5 (both edit `planSheetFields`' exports); 7 before 15 (the header's
  suite imports it); 10 before 11; 13 to 15 after every code commit; 16 after
  every code commit, so it rewraps what stays; 17 after 13, which removes the
  suite asserting step 42 is 🔜. Groups are otherwise independent.
- Follow-ups for the journal, not this round: the shared importer harness;
  the absolute path cell `fix:`; `importShow`'s shape; and those carried from
  folder-layout above.
