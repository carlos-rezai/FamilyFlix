# Refactor plan: Export paths, one rule for a path's segments, one search for a path cell's file, the Source folder's depth by its own spelling, the Resolve's found video by name, and the docs that close step 50

> Source initiative: `export-paths`, issue 643 (step 50).
> Shipped by issues 644 to 649: five slices, RED and GREEN each, and the
> walk and documents slice (`b36a89fe` to `da070a63`).
> Design log: `docs/design-logs/67-export-paths.md`.
> PRD: `docs/PRDs/67-export-paths.md` (643). Plan:
> `docs/PRDs/67-export-paths-plan.md`.
> Handoff: none; no screen changed and no prototype was amended.
> This is the initiative's closing round. It ticks **Export paths** and
> closes 643. Filed as issue #651.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`export-paths` shipped every phase of its plan. A **Source folder** is
spelled with `/` by one `sourceFolderOf`; a sheet's `Folder` cell is the
**Title folder**'s own name (`titleFolderName`), so an Export is flat; a
`Folder` cell is read as a **Folder path**, `\` as `/`, and matched by its
last segment; a path cell's file is looked for in the matched Title folder,
then under the run's **Sheet root** (`sheetRootOf`); and a shell **Resolve**
whose picked video lies under a **Library folder** sends it as a **Found
file**, which the run's **Import mode** places.

At `da070a63` the full suite has **12448 tests across 841 files, all
passing** (one skipped). `tsc -b --force` is clean. `eslint src server
electron` reports **1 error and 137 warnings**, as the missing-videos round
closed on: the build added none.

The design held. What is left is what six slices built one after another
leave behind: one rule (split a path on either slash) spelled four ways, a
magic `'Meta'` beside the constant that names it, a value computed per match
that is one per run, five positional arguments threaded through every fill,
a depth check written backwards to slip past a source-text test, a fallback
no caller reaches, an add helper called with a literal mode on a Resolve, a
flag defaulted where its sibling is required, docblocks the build wrapped by
hand, and the documents. Every finding below was checked against the code at
`da070a63`. They fall into six families.

### 1. A path's segments: one rule, four spellings

- **"Split on `/` and `\` alike" is written four times.**
  `titleFolderName` splits on `/[/\\]+/` and filters empty segments;
  `readSheet`'s `folderCell` splits on its own `FOLDER_SEPARATORS`
  (`/[\\/]/`) and filters empty segments; `createLibrarySheet` declares a
  third constant, `SEGMENT` (`/[/\\]/`), to `join` a stored Source folder
  under its root; and `cellSegments` replaces `\` with `/` and splits.
  The first three are one rule: a path's non-empty segments. The fourth is
  deliberately different (it keeps empty segments, so `isContained` can
  refuse `a//b`), and says so nowhere.
- **`sheetRootOf` spells `'Meta'` by hand.** `folderLayout` exports
  `META_FOLDER`, which `createLibrarySheet` and `writeExport` already read.

### 2. The Sheet root: per match, and threaded by hand

- **`sheetRootOf(sheetPath)` is computed inside the match loop**, once per
  matched show and once per matched film, in `execute`'s sheet run, where it
  can only ever answer one folder. `placeFolder` computes its `sheetRoot`
  once, as a `const`, before its loop: the two runs read it two ways.
- **Every fill takes five positional arguments.** `foundCell`, `fill` and
  `withTrackCells` each take `dir`, `folderPath` and `sheetRoot` before
  their own two, and `filmWithCells` and `showWithCells` repeat the same
  triple at eight call sites. The three name one thing, _where this row's
  cells are looked for_, and never vary within an export's call.
- **The fills' docblocks predate the Sheet root.** `filmWithCells` and
  `showWithCells` say what is filled and that the read wins, but not where a
  cell's file is looked for, which is now the whole of log 67 Q10.
- **One comment still says cells are resolved by the match.**
  `placeFolder`'s _Each folder a row names, with that row, its path cells
  resolved_ described `resolvedRow`, which log 67 Q12 removed: a **Match**
  now carries its row as read.

### 3. The Source folder's depth

- **`placeTitleFolder`'s depth check reads backwards.** Issue 647 swapped it
  from `relative(listed.path, dirname(dir))` to
  `relative(dirname(dir), listed.path)` so the source-text guard in
  `sourceFolderOf.test` would let it through: same answer, but it reads as
  a test-shaped accident. The check it means is _the Source folder is one
  segment_, and `sourceFolderOf` already spells that Source folder two lines
  down.
- **`sourceFolderOf.test` asserts source text.** Its second suite reads four
  shipping files and matches them against a regex, with a negative
  lookahead carved out for one call shape. It is the only test in the repo
  that reads a shipping file's text; every other suite asserts what a unit
  answers. It guards nothing a caller can see: every placer takes only a
  Title folder lying in the root (log 58), so a one-segment Source folder
  is spelled the same with either separator. The journal's build entry
  names it: _the pattern wants fixing_.

### 4. `layoutCells` and two docblocks

- **`cellIn` looks its read up again by key, with a fallback no caller
  reaches.** Every `cellOrNull` call is handed a path only when `readOf`
  found a read, then `cellIn` reads `reads.get(folder)?.dir ?? ''` for the
  same read: the `?? ''` would join a cell under `dirname('')`.
- **Two docblocks the build wrapped by hand**, each with a line past 80
  columns or one cut short: `layoutCells`' (_names what the folder holds at
  its **Layout place**, never what storage holds: a poster or_) and
  `exportRows`' (_whatever depth its titles lie at. Every_). Prettier leaves
  comments alone.

### 5. The Resolve's picked video

- **A Resolve calls an add's helper with a literal mode.**
  `useMovieForm`'s Resolve branch sends
  `movieAddValues(values, 'link', videoPath)` when the pick lies under a
  Library folder, beside a comment saying the run's own mode places it. The
  `'link'` is not a mode anyone chose; it is a key into the half of
  `movieAddValues` that turns a picked video into a Found file. That half
  has no name.
- **`useImportMode` takes one flag required and its sibling defaulted.**
  `plainAdd: boolean` is required; `resolve?: boolean` defaults to `false`.
  Both are `useMovieForm`'s `job.kind` read one way each, and the hook's
  only shipping caller passes both.

### 6. The documents

- **The feature checklist's row reads _Export paths_, ⬜ Planned**, and
  step 50 is 🔜.
- **The checklist's step 50 and the glossary's Source folder row** place
  `sourceFolderOf` _beside `placeTitleFolder`_; the build gave it its own
  folder, as the conventions ask of a unit with its own test.
- **The README** says an export fed back adds nothing, and nothing of an
  Export giving the library back whatever shape its folders were in.
- **The release checklist's** _Export round trip_ smoke exports one flat
  library and reads it back; nothing checks an older Export's sheet, or
  that a new Export is flat.
- **The journal's build entry** names two follow-ups: the source-text guard
  (family 3) and a Resolve's poster slot prefilled from its row's `Poster`
  cell, a product question filed as issue #650.

## Solution

One round in six groups, each commit leaving the suite green and the
typecheck clean:

1. **A path's segments, one rule**: `pathSegments` beside `titleFolderName`,
   called by every site that splits on either slash; `sheetRootOf` reads
   `META_FOLDER`.
2. **One search for a path cell's file**: the Sheet root read once per run,
   and the fills handed one `CellSearch`.
3. **The Source folder's depth by its own spelling**, and its test
   asserting only what the unit answers.
4. **`layoutCells` cells from the read itself**, and two docblocks
   reflowed.
5. **The Resolve's found video by name**: `withFoundVideo`, and
   `useImportMode`'s two flags alike.
6. **The docs that close step 50**, then the journal.

No behaviour changes. No wire, schema, route, setting, sheet column, copy,
drawn pixel or prototype state changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [export-paths] issue #651 …`, except where a commit is named
`docs:`.

### Group 1: a path's segments, one rule

1. **`pathSegments(path)`.** Exported from `media/folderKeyOf/` beside
   `titleFolderName`: a path's non-empty segments, `/` and `\` both
   separating, as a stored Source folder, a Folder cell and a Folder path
   are read (log 67 Q4, Q7). `titleFolderName` becomes its last segment;
   `readSheet`'s `folderCell` takes its segments from it and
   `FOLDER_SEPARATORS` goes; `createLibrarySheet`'s `readTitleFolders` joins
   `pathSegments(source)` under its root and `SEGMENT` goes.
   `cellSegments` stays as it is, and its docblock gains the reason it is
   not `pathSegments`: it keeps an empty segment, so the **Sheet reader**
   refuses a cell holding one. A `folderKeyOf.pathSegments.test` beside
   `folderKeyOf.titleFolderName.test` tables the unit: one segment, both
   separators mixed, a leading, trailing and doubled separator, the empty
   path. Guarded besides by `folderKeyOf.titleFolderName.test`,
   `readSheet.folderPath.test`, `readSheet.exportCells.test` and
   `createLibrarySheet.nested.test`, unchanged.
2. **`sheetRootOf` reads `META_FOLDER`.** The literal `'Meta'` goes for
   `folderLayout`'s constant, as `createLibrarySheet` and `writeExport`
   read it. Guarded by `sheetRootOf.test`, unchanged.

### Group 2: one search for a path cell's file

3. **The Sheet root once per run.** `execute`'s sheet run reads
   `const sheetRoot = sheetRootOf(sheetPath)` once, before its match loop,
   as `placeFolder` does, and hands it to both fills. `placeFolder`'s
   comment over `named` says each folder a row names, with that row as read
   (log 67 Q12), not _its path cells resolved_. Guarded by
   `createImporter.sheetRoot.test`, `createImporter.oldExport.test` and
   `createImporter.newExport.test`, unchanged.
4. **`CellSearch`.** A private interface in `pathCellFills`: the matched
   **Title folder** `dir`, its row's **Folder path** and the run's **Sheet
   root**, documented as where one row's cells are looked for, in log 67
   Q10's order. `foundCell(search, cell)`, `fill(search, found, cell)` and
   `withTrackCells(search, found, cells)` take it first; `filmWithCells`
   builds one from its scan and row, `showWithCells` one from its show and
   Series row, and every call inside reads two arguments, not five. The
   exports' signatures do not change. Both export docblocks gain where a
   cell's file is looked for: in the matched Title folder, then under the
   Sheet root, which is only read. Guarded by `pathCellFills.test` and
   `pathCellFills.sheetRoot.test` (the film, the show's Season posters and
   Stills, and the episode's track), unchanged.

### Group 3: the Source folder's depth by its own spelling

5. **`placeTitleFolder` checks the Source folder it records.** The listed
   folder found, the unit spells `sourceFolderOf(listed.path, dir)` once and
   answers `null` when it holds a `/`: a folder deeper than the root, which
   its docblock already names. `relative` and `dirname` leave its imports.
   `listedFolderOf` already answers only a folder strictly inside, so a
   Source folder here is never empty and never climbs. Guarded by
   `placeTitleFolder.test` and `placeFilmFolder.test` (a nested folder, a
   loose root video, a folder under no listed folder, a listed folder
   itself), and the importer's `folderLayout` suites, unchanged.
6. **`sourceFolderOf.test` asserts what the unit answers.** The suite that
   reads four shipping files' text goes, with `HAND_SPELLED`, `SITES` and
   the `readFileSync` import; the file's header says the unit's rule and no
   longer that no `relative(...)` spells one anywhere else. The behaviour
   suite (a nested folder answers `/`, a one-segment folder as before)
   stays. The spelling at each site is guarded by what each site records:
   `createImporter.linkMode.test`, `createImporter.linkShows.test`,
   `createImporter.heldVideo.test`, `enrich.titleAt.test` and the
   `readShowFolder` suites, unchanged.

### Group 4: `layoutCells` and two docblocks

7. **`layoutCells` reads a cell from the read itself.** `cellIn` takes the
   `TitleFolderScan` it is relative to, not the key to look it up by again;
   each place's branch reads `readOf(place.folder)` once and hands that read
   on, and the `?? ''` fallback goes. `seasonOf` keeps its shape. Guarded
   by `layoutCells.test`, `createLibrarySheet.nested.test` and the **Round
   trip** suites, unchanged.
8. **Two docblocks reflowed.** `layoutCells`' and `exportRows`'
   rewrapped at 80 columns in the words they hold. Comments only.

### Group 5: the Resolve's found video by name

9. **`withFoundVideo(values, videoPath)`.** Exported from `formValues`
   beside `foundFile`: a picked video the **Path bridge** read a path for,
   as a **Found file** of that path with its name kept; otherwise the values
   as they are. `movieAddValues` becomes Link's `withFoundVideo`, Copy's
   values as given; `useMovieForm`'s Resolve sends `withFoundVideo` when the
   pick lies under a Library folder, and its comment keeps saying the run's
   own Import mode places it. No literal mode is left on a Resolve.
   `formValues.test` gains `withFoundVideo` rows (a pick with a path, a
   pick with none, a held file left as it is); its `movieAddValues` rows
   are unchanged. Guarded besides by `MovieForm.resolveLink.test`,
   unchanged.
10. **`useImportMode`'s two flags alike.** `resolve` is required, as
    `plainAdd` is, its default gone; `useImportMode.test`'s one render call
    passes `resolve: false` beside its `plainAdd`, and no assertion moves.
    Guarded by `useImportMode.test` and `MovieForm.resolveLink.test`.

### Group 6: the docs

11. **`docs: [export-paths] issue #651 the docs know any Export comes
back`.**
    - **Feature checklist**: the row reads _Export paths: a nested Export
      imports back whole_, ✅; step 50 goes ✅ in step 49's shape (_Built in
      issues 644 to 649; the walk ran in the shell on a sandbox copy. The
      closing round (issue #651) …_), its `sourceFolderOf` named as its
      own unit, its _Out_ bullet naming issue 650 as a bare number.
    - **Glossary**: the **Source folder** (log 67) row names
      `sourceFolderOf` as its own unit rather than _beside
      `placeTitleFolder`_. **Sheet root**, **Folder path**, **Folder key**
      and the other updated rows already say what the code does;
      `pathSegments`, `CellSearch` and `withFoundVideo` are unit names, not
      terms.
    - **README**: the bulk-import paragraph's last sentence adds that an
      export fed back to the importer gives the whole library back, its art
      included, from its sheet or copied over the library's folders,
      whatever shape those folders were in.
    - **Release checklist**: an _Export paths_ smoke after _Export round
      trip_: on a sandbox holding a copy of the
      `createImporter/v0.16.1-export/` fixture and the dev library's Title
      folders under one inner folder, list that inner folder and _Import
      from spreadsheet_ with the fixture's `Meta\familyflix-library.csv`:
      every title comes back with its poster, backdrop, Season poster,
      Still and tracks, and review lists no Problem; a new _Export_ is
      flat, one folder per title beside `Meta/`.
12. **`docs: [export-paths] issue #651 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the missing-videos round's shape:
    what each group changed, where the round left the plan, the test count
    and lint against `da070a63`, and the follow-ups: issue 650, as a
    bare number. The commit closes 643 in words, not with a keyword, and
    this issue with one.

## Decision Document

- **`pathSegments` lives in `media/folderKeyOf/`**, beside the
  `titleFolderName` it is the first half of. `import-export` already reads
  `folderKeyOf`; `media` reads nothing from `import-export`, so the one
  home both sides reach is `media`. It answers non-empty segments only.
- **`cellSegments` stays in `readSheet` and stays different.** It keeps
  empty segments on purpose: the containment check refuses a cell holding
  one. Its docblock names the difference so the next reader does not fold
  it into `pathSegments`.
- **`resolvePathCell` stays in `readSheet`.** Only `pathCellFills` calls it
  since log 67 Q12, but its two suites live in `readSheet`'s tests and pin
  the cell's rule with the containment it relies on.
- **`CellSearch` is private to `pathCellFills`**, an interface rather than
  a closure factory, as `readShowFolder`'s context and the importer's
  `HeldIndex` are: data handed in, not functions made. `filmWithCells` and
  `showWithCells` keep the signatures log 67 gave them.
- **The Sheet root is one `const` per run** in both runs that read a sheet.
- **`placeTitleFolder`'s depth is its Source folder holding no `/`**, the
  spelling `sourceFolderOf` guarantees on every platform. No `relative`
  call is left in the unit.
- **No test reads a shipping file's text.** A rule a caller cannot observe
  is pinned at the unit that spells it (`sourceFolderOf.test`) and by what
  each site records, not by a regex over the source.
- **`withFoundVideo` is exported from `formValues`**, beside `foundFile`
  and `movieAddValues`, the module that already shapes a save's values; the
  hook only decides when.
- **`useImportMode` keeps two booleans.** Folding them into the job's kind
  would move `FormJob` into the hook's API for one caller; making both
  required is the consistent half.
- **Nothing on the wire, the schema, the routes, the sheet, the Export's
  folders, the drawn screens or the prototype changes.**

## Testing Decisions

- **A good test asserts what a caller or the household sees**: the rows a
  sheet reads, the folders an Export writes, which art a run fills and from
  where, what a Resolve sends. It never asserts which helper ran, how a
  path was split, or the text of a source file.
- **The initiative's suites carry every refactor commit**:
  `createImporter`'s `oldExport`, `newExport` and `sheetRoot`;
  `pathCellFills.test` and `pathCellFills.sheetRoot.test`; `readSheet`'s
  `folderPath`, `exportCells`, `pathCells` and `oneSheet`;
  `matchRows.folderPath.test`; `createLibrarySheet.nested.test`;
  `exportRows.nested.test`; `writeExport.flat.test`; `layoutCells.test`;
  `enrich.titleAt.test`; `routes.exportPaths.test`;
  `MovieForm.resolveLink.test`. Beside them, the **Round trip** and
  **Export round trip** suites guard that a flat library is unchanged.
- **New tests: two units' own rows.** `pathSegments` and `withFoundVideo`
  are new exports, so each gets its own table beside its module's
  existing tests (`folderKeyOf.titleFolderName.test`, `formValues.test`'s
  `movieAddValues`). Every other unit this round names is private
  (`CellSearch`, the reshaped `fill`, `foundCell`, `withTrackCells`,
  `cellIn`) and driven through an export whose suite already tables it.
- **One test removed**: `sourceFolderOf.test`'s source-text suite (commit
  6), for the reason in family 3. Its behaviour suite stays.
- **One test call site edited**: `useImportMode.test`'s render passes
  `resolve: false` (commit 10). No assertion changes.
- **Prior art for the rhythm**: the missing-videos round (issue 641) and
  the show-folder-title round (issue 632).

## Out of Scope

- **Issue 650**: a Resolve's poster slot prefilled from its row's
  contained `Poster` cell under the Sheet root, as the run's own fills are.
  The prototype draws the slot empty, so it is a product question for a
  grill-me first.
- **One home for _a path relative to a folder, spelled with `/`_.**
  `sourceFolderOf`, `sourceFileOf`, `layoutCells`' `cellIn`,
  `createMedia`'s managed path and `playback`'s `linkedVideoPath` each
  write `relative(...).split(sep).join('/')`, across three domains. Each
  names a different thing, and a shared helper has no domain to live in
  without a `lib/` catch-all, which the architecture forbids.
- **`sourceFileOf` moving beside `sourceFolderOf`.** It lives in
  `placeFilmFolder`, its suite with it, and nothing new reads it.
- **One state for the movie pick's containing answer.** `videoLinkDisabled`
  and `videoUnderFolder` look like one answer read twice, but they differ
  while a later pick's answer is pending (the first keeps the last answer,
  the second resets), so folding them changes what a save sends mid-read.
- **`enrich`'s `REPLACE(source_folder, char(92), '/')`** in its three
  statements: log 67 Q4's read, written where the SQL is.
- **Everything log 67 left out**: loose art (Q14), fuzzy matching for
  hand-typed keys (Q8), a v0.16.1 Export's nested folders copied over a
  Library folder (Q13), migrating stored Source folders (Q4).
- **The lint error and the warnings that predate the initiative.**

## Further Notes

- **Commit 4 depends on commit 3** only to keep the diff small (both touch
  the fills' call sites). Commit 6 depends on commit 5: with the depth
  check still `relative`, removing the guard first is harmless but leaves
  the backwards check behind. Commit 8 can ride after 7. Groups 1, 4 and 5
  are independent of each other and of groups 2 and 3.
- **Every refactor commit is green**; there is no RED `test:` commit in
  this round. The two new test tables land in the commit that exports
  their unit.
