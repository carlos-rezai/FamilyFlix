# Refactor plan: Export round trip, one naming rule the Export cannot skip, one placing loop for both runs, a Doubled place typed by its place, a path cell resolved against its Title folder, suites that say their phase, and the docs that close step 44

> Source initiative: `export-round-trip`, issue 581 (step 44).
> Shipped by issues 582 to 589: the build slices 582 to 588, RED and GREEN
> each (`96cda3c5` to `fb2f5eca`), and the documents (589, `9ad1de2d`).
> Design log: `docs/design-logs/61-export-round-trip.md`.
> PRD: `docs/PRDs/61-export-round-trip.md` (581). Plan:
> `docs/PRDs/61-export-round-trip-plan.md`.
> This is the initiative's closing round. It ticks **Export round trip** and
> closes 581. Filed as issue #590.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`export-round-trip` shipped every phase of its plan. An Export names each
Title folder and `Folder` cell by the title's **Source folder**
(`sourceFoldersOf`, the Library sheet's rule too), so a renamed title comes
back from it; an upload into a Library folder never scanned places that
folder by its own **Library sheet** first, through the Folder scan's
`placeFolder`, so an older Export never erases a newer record; every
**Doubled place** is one **Layout warning** and a Subtitles folder reads one
track per language; Folder keys compare by `foldFolderKey` (NFC, then case)
and a path cell reaches an NFD folder; _Play_ offers specials last.

At `9ad1de2d` the full suite has **11859 tests across 772 files, all
passing** (one skipped), against 11794 across 761 when rebuild-edges closed.
`tsc -b --force` is clean. `eslint src server electron` reports **3 errors
and 137 warnings**, against 1 and 137 at rebuild-edges' close: the two new
errors are this initiative's (below, family 5).

The design held. What is left is what seven slices written one finding at a
time leave behind: two seams left optional so older fixtures needn't change,
one loop written out twice, a type whose optional fields the wording papers
over with `?? 0`, a pair of parameters threaded where one path says it, and
suites whose headers name the wrong phase. Every finding below was checked
against the code at `9ad1de2d`. They fall into seven families.

### 1. The Export's naming rule is optional

- **`ExportContent.sourceFolders` is optional** (the journal's first
  follow-up). Slice 582 left it so the older `writeExport` fixtures needed
  no change; the route always passes it. An Export built without it
  silently falls back to spelling every key from the title: the very bug
  the step fixed. Log 61's _Types_ makes it required.
- **`exportRows`' `sourceFolderOf` defaults to `() => null`**, and both of
  its callers hand it the same lambda over a map they already hold:
  `createLibrarySheet` `(titleId) => sourceFolders.get(titleId) ?? null`,
  `writeExport` `(titleId) => content.sourceFolders?.get(titleId) ?? null`.
  The one rule log 61 Q3 settled for both sheets is spelled at each call,
  and a third caller could skip it without a type error.

### 2. Placing is written out twice

- **The per-folder placing loop is copied.** `executeScan` and `execute`'s
  first pass each build an empty `PlacedTitles`, call `placeFolder` for each
  walked folder, return on `null`, and push the folder's films, shows and
  found-again titles into it: thirteen identical lines. Log 61 Q7 drew the
  per-folder step out so the two runs could not drift; the loop around it
  can still.
- **`execute`'s second pass builds the held index by hand.** Four lines
  (`heldFilmsByKey`, `missingFilms`, `heldSeriesList`, `heldSeriesByKey`)
  that `heldIndex()`, added in the same slice, already answers, and which
  the first pass and `executeScan` call.

### 3. A Doubled place types its fields optional

- **`DoubledPlace` is one interface with three optional fields**
  (`season`, `episode`, `language`) whichever its `place`. The walk's
  `doubledWhere` covers the gap with fallbacks that can never fire:
  `place.season ?? 0`, `place.episode ?? 0`, `place.language ?? ''`. A
  Season poster always has a season, a Still a season and an episode, a
  track a language; a typo in the reader would print `S00E00` and compile.
  Every other kind-shaped type in `media/` and `import-export/`
  (`TitleFolderScan`, `SheetSkip`, `LeftOutReason`) is a union discriminated
  by its kind.
- **The season reader parses each tag twice.** It groups Stills by the tag
  `tagOf` spelled, then reads the episode back with `episodeTag(tag)?.episode`;
  the tag folders of `Subtitles/` likewise. The `?.` is there only because the
  type lost what the filter already proved.
- **One grouping, written twice.** `oneTrackPerLanguage`'s `byLanguage` and
  `readSeasonFolder`'s `stillsByTag` each grow a `Map<string, T[]>` by
  `set(key, [...(get(key) ?? []), item])`.

### 4. A path cell's folder travels as two parameters

- **`resolvePathCell`'s `name` is optional** (the journal's second
  follow-up): both callers pass it; only three unit tests don't. Without it
  an NFC cell silently misses an NFD folder again.
- **Both callers split one path to pass it.** `matchRows`' `resolvedRow`,
  `filmWithCells` and `showWithCells` each compute `dirname(dir)` and
  `basename(dir)` of the matched Title folder, and `pathCellFills` threads
  the pair through `resolvedCell` and `fill` (eight call sites). The cell is
  resolved against one thing, the Title folder it was matched to.

### 5. Suites and lint

- **Two suites name the wrong phase.** `readTitleFolder.tracks` and
  `createImporter.oneTrack` say _Phase 3 (issue #585)_; issue 585 is the
  plan's Phase 4.
- **Two lint errors**: `writeExport.sourceFolders.test` and
  `routes.exportSourceFolders.test` strip the BOM with a regex holding a
  literal U+FEFF (`no-irregular-whitespace`), the pattern rebuild-edges'
  refactor removed from `writeSheet.separator.test`.

### 6. Comments

- **Three docblocks left ragged by 589's edits**: `writeExport`'s (_Anything_
  stranded at a line's end), `createLibrarySheet`'s (_behind its_ broken
  before _BOM_) and `readTitleFolder`'s (_a name that is no **Folder key**_
  broken short).
- **`exportRows`' and `writeExport`'s docblocks name `sourceFolderOf`** and
  the optional map; they follow family 1.

### 7. The documents

- The feature checklist's row reads _Export round trip: an Export gives it
  all back_, 🔲 Planned, and step 44 is 🔜, _the refactor is still to come_.
- README's server tree names no `sourceFoldersOf` under `import-export/`,
  and its `folderKeyOf/` line says nothing of the fold.
- The release checklist has no smoke for the step's promise: a renamed
  title comes back from an Export after a Factory reset.

## Solution

One round in eight groups, each commit leaving the suite green and the
typecheck clean:

1. **One naming rule the Export cannot skip**: `exportRows` and
   `ExportContent` take the Source folders map, required.
2. **One placing loop**: `placeFolders` for both runs, `heldIndex` for the
   second pass.
3. **A Doubled place typed by its place**: one grouping helper, a union
   discriminated by `place`, the tag read once.
4. **A path cell resolved against its Title folder**: `resolvePathCell`
   takes the folder's path.
5. **Suites**: the headers' phases, the lint the round wrote.
6. **Comments** rewrapped and made true.
7. **The docs that close step 44.**
8. **The journal.**

No behaviour changes. No wire, schema, Settings, copy or prototype change.
Every log line, Layout warning and sheet byte stays as it is. The household
sees nothing new.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [export-round-trip] issue #590 …`, except where a commit is named
`test:` or `docs:`.

### Group 1: one naming rule the Export cannot skip

1. **`exportRows` takes the Source folders, required.** Its fourth
   parameter becomes `sourceFolders: ReadonlyMap<string, string>`, no
   default: a title it holds is named by it, any other spelled
   `Title (Year)`. `createLibrarySheet` passes its folder's map as it is;
   `writeExport` passes `content.sourceFolders ?? new Map()` until
   commit 2. The suites that call it with three arguments
   (`exportRows.test`, `filePlan.test`, `readSheet.oneSheet`,
   `writeSheet.test`) pass `new Map()`, their assertions unchanged. Its
   docblock names the map. Guarded by those suites, `exportRows.test`'s
   folded-key cases, `createLibrarySheet`'s suites, `.roundTrip`, and
   `writeExport.sourceFolders`.
2. **`ExportContent.sourceFolders` is required.** `writeExport` hands
   `content.sourceFolders` to `exportRows` as it is. Every `writeExport`
   call in a suite that builds its content without one
   (`writeExport.test`, `.edges`, `.layout`, `.name`, `.readOnly`,
   `.dialect`, `createEnrichment.frameUpgrade`) gains
   `sourceFolders: new Map()`, its assertions unchanged; the route already
   passes it. The field's docblock drops _a title found here_ for the rule
   itself. Guarded by `tsc -b --force` and the same suites,
   `routes.export`, `routes.exportSourceFolders`,
   `createImporter.exportRoundTrip`.

### Group 2: one placing loop

3. **`placeFolders`, the loop around `placeFolder`.** A step beside
   `placeFolder`: `placeFolders(current, walked, index, genres, signal)`
   places each walked folder in order and answers their titles gathered
   into one `PlacedTitles`, or `null` once the run was cancelled.
   `executeScan` calls it over every walked folder, `execute`'s first pass
   over its unscanned ones; the two loops go. Guarded by
   `createImporter.unscannedSheet`, `.exportRoundTrip`, `.roundTrip`,
   `.metaSheet`, `.sourceFolders`, `.doubledPlaces`, `.oneTrack`,
   `.foldedKeys`, `.nfdPathCells`, `.heldOneScan`, unchanged.
4. **`execute`'s second pass reads `heldIndex()`.** Its four hand-built
   lookups become one destructured `heldIndex()`, read after the first pass
   as now, so the uploaded rows still meet the titles it placed. Guarded by
   `createImporter.unscannedSheet` (the Heat repro's _Yours 9 |
   Spreadsheet 5_) and the sheet run's suites, unchanged.

### Group 3: a Doubled place typed by its place

5. **One grouping helper in the reader.** A module-private
   `groupedBy(items, keyOf)` in `readTitleFolder`, answering a
   `Map<string, T[]>` in first-seen order; `oneTrackPerLanguage` and
   `readSeasonFolder`'s Stills read it. Guarded by
   `readTitleFolder.doubled`, `.tracks`, `readTitleFolder.test`.
6. **`DoubledPlace` is a union discriminated by `place`.** The read file
   and count are shared; each member carries only what its line names, and
   carries it required: `poster` and `backdrop` nothing more,
   `season-poster` its `season`, `still` its `season` and `episode`, a
   film's `track` its `language`, an episode's `track` its `language`,
   `season` and `episode`. `doubledOf` takes the place half. The season
   reader keeps each Still's and each tag folder's episode number from the
   one parse that admitted it, so `episodeTag(…)?.episode` goes. The walk's
   `doubledWhere` narrows by `place` and loses its `?? 0` and `?? ''`;
   `NumberableSeries` is unchanged. Field names stay, so every `toEqual`
   over a Doubled place holds. Guarded by `tsc -b --force`,
   `readTitleFolder.doubled`, `.tracks`, `createImporter.doubledPlaces`,
   `.oneTrack`, `numberShow.test`, `layoutCells.test`, unchanged.

### Group 4: a path cell resolved against its Title folder

7. **`resolvePathCell(dir, cell)`.** It takes the matched **Title
   folder**'s path in place of the Library folder and the folder's name:
   the cell joined to the folder's parent, its first segment spelled as the
   folder's own name when it is the same Folder key by `sameFolderKey`. The
   optional `name` goes. `matchRows`' `resolvedRow` passes `folder.dir`;
   `pathCellFills`' `resolvedCell` and `fill` take the scan's `dir` in
   place of `base` and `name`, and `filmWithCells` and `showWithCells` stop
   splitting it. The containment rule is untouched (the reader's, not this
   function's). `readSheet.oneSheet`'s four calls pass a Title folder path,
   their expected paths unchanged. Guarded by `readSheet.oneSheet`,
   `.pathCells`, `matchRows.test`, `pathCellFills`' suites,
   `createImporter.nfdPathCells`, `.pathCells`, `.roundTrip`.

### Group 5: suites

8. **`test: [export-round-trip] issue #590 each suite names its phase`.**
   `readTitleFolder.tracks` and `createImporter.oneTrack` read _Phase 4
   (issue #585)_. Comments only.
9. **`test: [export-round-trip] issue #590 the lint the round wrote`.**
   `writeExport.sourceFolders.test` and `routes.exportSourceFolders.test`
   read the sheet's bytes and strip the BOM by `UTF8_BOM`'s length, as
   `writeSheet.separator.test` does; no literal U+FEFF left. Lint ends this
   group at 1 error and 137 warnings, rebuild-edges' close. No assertion
   changes.

### Group 6: comments

10. **The docblocks rewrapped and made true.**
    - Rewrapped to 80 columns: `writeExport`'s, `createLibrarySheet`'s and
      `readTitleFolder`'s, the three lines 589 left ragged.
    - `exportRows`' docblock says the Source folders are required and the
      one rule for both sheets; `writeExport`'s says the Export names every
      Title folder by them (after commits 1 and 2, the words _optional_ and
      _`sourceFolderOf`_ are gone).
    - `resolvePathCell`'s docblock says what it resolves against (after
      commit 7).

    Comments only.

### Group 7: the docs

11. **`docs: [export-round-trip] issue #590 the docs know the round trip`.**
    - **Feature checklist**: the row reads _Export round trip: an Export
      gives it all back_, ✅; step 44 goes ✅ with what shipped, in step
      43's shape (_Built in issues 582 to 588; the closing round in issue
      #590_), its lines rewrapped.
    - **README**: the server tree's `import-export/` names
      `sourceFoldersOf` (each title's Source folder, both sheets' Folder
      key) beside `exportRows`; `folderKeyOf/`'s line adds _compared
      folded, NFC then case_.
    - **Release checklist**: one smoke after _Rebuild edges_, in the shell
      over the sandbox Library folder: rename one title in the app and rate
      it, _Export_ to a folder outside the sandbox, Settings → _Factory
      reset_, list the sandbox again, then _Import from spreadsheet_ with
      the Export's `Meta\familyflix-library.csv`: the title comes back
      under its new name with its rating, and review lists no Problem.
    - **Glossary**: checked against the round; **Doubled place** and
      **Folder key** already say what the code does. The dialogue is a
      snapshot and stays.

### Group 8: the journal

12. **`docs: [export-round-trip] issue #590 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last refactor entry's shape: what
    shipped before the round, what each group changed, where the round left
    the plan, the test count and lint against `9ad1de2d`, the follow-ups
    (below). The commit closes 581 in words, not with a keyword, and this
    issue with one.

## Decision Document

- **The Export has one naming rule, and the types say so.** `exportRows`
  and `ExportContent` take the Source folders as a required map, not an
  optional one or a callback defaulting to none: log 61 Q3 made them the
  one rule for both sheets, and a caller that omits them should not
  compile. A map, not a function, since both callers already hold one and
  `exportRows` only looks titles up in it.
- **`FolderContent` stays the Library sheet's own.** It has
  `ExportContent`'s shape, but the Library sheet is not an Export: it is
  written per folder, never refuses, and has no File plan. Sharing the name
  would tie the writer to the Export's module for three fields.
- **`placeFolders` is a step of the importer, not a new unit.** It closes
  over the run as `placeFolder` does, and log 61 Q7 settled that the shared
  placing lives in `createImporter`. Its answer is `PlacedTitles | null`,
  the cancel convention of `placeFolder` and `importTitles`.
- **`DoubledPlace` keeps its name, its export and its field names.** Only
  its shape tightens, into the discriminated union the codebase uses for
  every kind-shaped type; the walk's `switch` stays exhaustive. The reader
  still holds no wording.
- **The groups' helper is private to `readTitleFolder`.** Two uses in one
  unit; `src/utils/` and `server/src` have no general grouping helper, and
  one helper for two lines of one module does not earn a unit of its own.
- **`resolvePathCell` resolves against the Title folder.** The cell's first
  segment is its row's Folder key and the row is matched to one Title
  folder (log 60 Q3, log 61 Q12), so the folder's path is the one input;
  its parent and its name are derived once, inside. Behaviour is unchanged:
  a cell naming another folder still resolves beside it, where the reader's
  containment rule has already refused it.
- **`importPlaced` keeps its positional parameters.** It grew `earlier` in
  slice 583; an options object is the folder-layout carry-over below, a
  round across the importer's steps, not this one.
- **Nothing on the schema, the wire, Settings, the prototype or any copy
  changes.** Every log line, Layout warning, Sheet difference and sheet
  byte stays as it is.

## Testing Decisions

- **A good test asserts what a caller or the household sees**: the rows an
  Export or a Library sheet writes, the folders on disk, the log lines, the
  library a run leaves, the review's rows, the episode offered. It never
  asserts which helper ran or where a rule lives.
- **The initiative's behavioural suites carry every refactor commit**:
  `sourceFoldersOf.test`; `writeExport.sourceFolders`, and
  `writeExport.test`, `.edges`, `.layout`, `.name`, `.readOnly`,
  `.dialect`; `exportRows.test`; `createLibrarySheet`'s suites;
  `routes.export`, `routes.exportSourceFolders`;
  `createImporter.exportRoundTrip`, `.unscannedSheet`, `.doubledPlaces`,
  `.oneTrack`,
  `.foldedKeys`, `.nfdPathCells`, and the Round trip's `.roundTrip`,
  `.metaSheet`, `.pathCells`; `readTitleFolder.doubled`, `.tracks`,
  `readTitleFolder.test`; `folderKeyOf.test`; `readSheet.oneSheet`,
  `.duplicates`, `.pathCells`; `matchRows.test`; `nextEpisodeOf.test`,
  `series/read/read.test`.
- **New tests: none.** Every unit the round touches is already covered at
  its public face by the build's RED suites; `placeFolders` and
  `groupedBy` are private and tested through the runs and the reader, as
  `placeFolder` and `doubledOf` are.
- **Assertions that change: none.** Commits 1, 2 and 7 add an argument or a
  field to suite calls (`new Map()`, a Title folder path) with the same
  expected values; commits 8 and 9 touch a header and a BOM strip. A suite
  that has to change anywhere else is reading an implementation detail, and
  is fixed in the same commit with the reason in the body.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at 1 error and 137
  warnings, or fewer, and 11859 tests.

## Out of Scope

- **A Still or a track whose tag names another season** (`S02E03.png` in
  `Season 01/Images/Stills/`) is reported under the folder's season, so its
  Doubled place line reads `S01E03`. Reading the tag's own season changes a
  log line, so it is a `fix:` issue of its own, not this round.
- **An upload whose sheet is a folder's own `Meta/` sheet is recognised by
  `resolve`d path**, which on Windows compares case-sensitively. A picker
  hands back the path as the disk spells it, so no case is known to differ;
  if one is found it is a `fix:` issue.
- **A shared `sheetRows` test helper.** Four suites read a sheet's rows
  their own way (two through `readSheet`, two through ExcelJS with a
  format); unifying them is the shared importer harness rebuild-whole and
  rebuild-edges put out of scope, a round across every importer suite.
- **`importPlaced`'s parameters as an object**, now eight with `earlier`.
  Carried from folder-layout with an options object for `createApiRouter`,
  a discriminated library scope, and the Sync's done summary still wording
  the retired Write targets.
- **Carried from rebuild-edges**: one `✓ Updated` line for a Found again
  film that takes files; a held series' failed file copy as a Warning line;
  `importShow`'s shape; one decode of a sheet's bytes.
- **The route's import order.** `routes/index.ts` imports are not sorted;
  `sourceFoldersOf`'s line sits where the slice put it.
- **Everything log 61 put out of scope**: the Up next card's order, merging
  an Export over a Library folder by name, a Library sheet newer than a
  scanned library, NFC keys written, refusing an upload or a newest-wins
  rule, the ticket's _Not covered_ list.
- **The frozen `handoff-export-round-trip/`.**

## Further Notes

- Groups 1 and 3 are the round's reason to exist: the step's whole promise
  is that an Export names folders by one rule, and an optional seam let the
  old rule back in; a Doubled place's line should not be able to print
  `S00E00`.
- Order: commit 1 before 2 (`writeExport`'s fallback goes in 2); 5 before
  6 (the union's members are built from the groups); 3 before 4; 10 after
  every code commit, so it rewraps what stays; 11 after 10. Groups are
  otherwise independent.
- Slice 582 ran over its token budget (the journal's third follow-up); the
  next plan should split a new pure unit from the acceptance test that
  needs it. A process note for `prd-to-plan`, not code.
- Follow-ups for the journal, not this round: the two `fix:` issues above
  (a Still or track tag of another season; the upload's own-sheet path
  compare), the shared importer harness, `importPlaced`'s parameters, and
  those carried from folder-layout and rebuild-edges.
