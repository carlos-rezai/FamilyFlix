# Refactor plan: Rebuild edges, one home for the dialect, the reader's row checks at module level, one fill per held place, the refusal's storage as a `Pick`, suites that say their phase, and the docs that close step 43

> Source initiative: `rebuild-edges`, issue 563 (step 43).
> Shipped by issues 564 to 578: the build slices 564 to 577, RED and GREEN
> each (`f524a5af` to `951de4a0`), and the documents (578, `1a1a355b`).
> Design log: `docs/design-logs/60-rebuild-edges.md`.
> PRD: `docs/PRDs/60-rebuild-edges.md` (563). Plan:
> `docs/PRDs/60-rebuild-edges-plan.md`.
> This is the initiative's closing round. It ticks **Rebuild edges** and
> closes 563. Filed as issue 579.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`rebuild-edges` shipped every phase of its plan. A path cell is read only when
it is contained in its row's **Title folder** and names its kind; the **Sheet
reader** reads a sheet's **Sheet dialect** (UTF-8 or cp1252, `,` or `;`) and a
decimal comma in any sheet; the **Library sheet writer** keeps the dialect it
found and never replaces a sheet that doesn't read; every **Unread cell** and
duplicate row is one Warning line through `onSkip` and `skipLine`, in both
runs; a held film fills its empty art and a held title takes the tracks of
languages it lacks (`fillHeldFiles`), after the run's new episodes, its
`✓ Updated` line naming what it took; a track named in its own language or
with a region reads right; `POST /series` refuses a held video by
`heldVideoRefusal`; every sheet row is as wide as its header.

At `1a1a355b` the full suite has **11786 tests across 761 files, all
passing** (one skipped), against 11582 across 739 when rebuild-whole closed.
`tsc -b --force` is clean. `eslint src server electron` reports **3 errors and
138 warnings**, against 1 and 137 at rebuild-whole's close: the two new errors
and the one new warning are this initiative's (below, family 5).

The design held. What is left is what fourteen slices written one finding at
a time leave behind: one concept given two homes, a callback grown into a
function of five closures, a branch written out twice where one helper says
it, a type invented beside the convention every other caller follows, and
suites whose headers name the wrong phase. Every finding below was checked
against the code at `1a1a355b`. They fall into seven families.

### 1. The Sheet dialect has two homes

- **The separator is typed twice.** `sheetDialect` declares
  `SheetDialect['separator']` (`',' | ';'`); `writeSheet` declares its own
  `SheetSeparator = ',' | ';'`, and `writeSheet.padding.test` imports that
  second name. Log 60's _Types_ gives `writeSheet` the dialect's own
  (`separator?: SheetDialect['separator']`).
- **The UTF-8 BOM is spelled twice.** `sheetDialect` has a private
  `BOM = [0xef, 0xbb, 0xbf]` to recognise it; `writeSheet` has
  `UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf])` to write it. The encoding is
  the dialect's concept.

### 2. The reader's row callback holds five closures

`readSheet`'s `eachRow` callback grew from one `rows.push` to about 130 lines:
the row's label, the duplicate key, and five closures (`contained`,
`containedOne`, `unread`, `parsed`, `flag`), followed by four hand-written
`if (text !== '' && value === null) unread(...)` checks that are `parsed`
spelled again. Every other cell rule in the unit (`cellNumber`, `cellWhole`,
`cellRating`, `cellDate`, `cellType`, `isContained`) is module-level and pure.

- **`cellType` is called twice** on the same text: once to read the type, once
  to decide whether to report it.
- **The column a skip names is a `string`.** `SheetSkip`'s
  `unread-cell.column`, `CHECKED_PATHS`' `header` and the `unread`, `parsed`
  and `flag` headers are free text, though each is one of `SHEET_COLUMNS` and
  log 60's _Types_ types it `SheetColumn`. A misspelled header would compile.

### 3. One fill per held place, written out six times

- **`fillHeldFiles` fills an empty place six times by hand.** A film's poster
  and backdrop, a series' poster and backdrop, a Season poster and a Still
  are each the same five lines: empty, copy, copied, write, `taken.add`. A
  film's tracks and an episode's are the same four lines again. The rule is
  one (log 60 Q13: _filled as a held series' are, one rule for both_).
- **What a title took is a free string.** `TAKEN_ORDER` lists the five names
  the `✓ Updated` line gives, but `taken.add('season posters')` accepts any
  string, and the function answers `string[]`.
- **The scanned episode is looked up twice.** `scannedStill` and the new
  `scannedTracks` each `find` the same episode of a `ShowScan` by season and
  number and read one field off it.

### 4. A type beside the convention

- **`heldVideoRefusal` declares `HoldingStorage`**, an interface restating
  three of `LibraryStorage`'s signatures. Every other narrow reader of storage
  takes a `Pick<LibraryStorage, …>` (`titleVideos`), and log 60's _Types_
  gives this one `Pick<LibraryStorage, 'titleHolding' | 'getMovie' |
'getSeries'>`.
- **`detectSubtitleLanguage`'s new tail** reads `if (byTag) return byTag;`,
  the unit's one brace-less `if` and its one truthiness check on a lookup,
  where the rest of `media/` writes braces and `!== undefined`.

### 5. Suites and lint

- **Two pairs of suites name the wrong phase.** `readSheet.unreadCells` and
  `createImporter.unreadCells` say _Phase 4 (issue #570)_; issue 570 is the
  plan's Phase 7. `readSheet.duplicates` and `createImporter.duplicates` say
  _Phase 4 (issue #571)_; 571 is Phase 8.
- **`addMovieSubtitles` and `addEpisodeSubtitles` have no tests of their
  own** (the journal's first follow-up). Two new `LibraryStorage` writes,
  reached only through the importer's held-tracks suite.
- **Two lint errors**: `writeSheet.separator.test` strips the BOM with a
  regex holding a literal U+FEFF (`no-irregular-whitespace`), twice.
- **One lint warning**: `createImporter.skipLines.test` imports
  `readFileSync` and never calls it.

### 6. Comments

- **Docblocks past 80 columns**: `pathCellFills`' `showWithCells` (one line
  past 100, edited mid-line and never rewrapped); `readSheet`'s
  `CHECKED_PATHS`, its `seen` set and its row closures; `createImporter`'s
  `SheetRead` and `TAKEN_ORDER`; `skipLine`'s `text` field.
- **Two SQL strings past 80 columns**: the _next position_ `SELECT`s of
  `addMovieSubtitles` and `addEpisodeSubtitles`.
- **`importShow`'s docblock is behind its body.** It says a held show's
  "empty art is filled from the scan", but a held series now also takes its
  episodes' lacking tracks, does so after the run's new episodes are in, and
  logs what it took on its `✓ Updated` line.
- **A held film's Layout fill runs only after Sheet fills** (the journal's
  third follow-up), with no comment saying why. It is right: every file
  `fillHeldFiles` takes was read out of the film's own Title folder, so the
  **Layout fill** has nothing of it to write back. The guard should say so.

### 7. The documents

- The feature checklist's row reads _Rebuild edges: hand-kept sheets,
  growing folders_, 🔲 Planned, and step 43 is 🔜.
- README's server tree names neither `sheetDialect` under `import-export/`
  nor `heldVideoRefusal` under `routes/`.
- The release checklist has no smoke for the step's promises: a sheet resaved
  `;` and cp1252 by a European Excel reads whole and is rewritten `;`.

## Solution

One round in eight groups, each commit leaving the suite green and the
typecheck clean:

1. **One home for the Sheet dialect**: its separator type and its BOM.
2. **The reader's row checks at module level**: typed columns, one read of
   the type, pure helpers in the voice of the unit's other cell rules.
3. **One fill per held place**: one scanned-episode lookup, typed taken
   names, one helper for an empty place and one for lacking tracks.
4. **The convention's types**: the refusal's `Pick`, the language unit's
   tail.
5. **Suites**: the two library writes tested, the headers' phases, the lint
   the round wrote.
6. **Comments** rewrapped and made true.
7. **The docs that close step 43.**
8. **The journal.**

No behaviour changes. No wire, schema, Settings, copy or prototype change.
The household sees nothing new.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [rebuild-edges] issue #579 …`, except where a commit is named
`test:` or `docs:`.

### Group 1: one home for the Sheet dialect

1. **`writeSheet` takes the dialect's separator.** Its third parameter is
   typed `SheetDialect['separator']`, imported from `sheetDialect`;
   `SheetSeparator` goes, and `writeSheet.padding.test` reads the dialect's
   type. Types only; guarded by `tsc -b --force`, `writeSheet.separator`,
   `writeSheet.padding`, `createLibrarySheet.dialect`.
2. **One UTF-8 BOM, the dialect's.** `sheetDialect` exports
   `UTF8_BOM` (the `Buffer`, its docblock: the bytes Excel and the **Sheet
   writer** put ahead of a UTF-8 csv) and recognises it by
   `bytes.subarray(0, 3).equals(UTF8_BOM)`; its private array and `hasBom`
   go. `writeSheet` imports it in place of its own. Guarded by
   `sheetDialect.test` (BOM and BOM-less cases), `writeSheet`'s suites and
   `createLibrarySheet.dialect` (the bytes on disk), unchanged.

### Group 2: the reader's row checks at module level

3. **The column a skip names is a `SheetColumn`.** `SheetSkip`'s
   `unread-cell.column` is typed `SheetColumn`; `CHECKED_PATHS`' `header`
   and the headers `unread`, `parsed` and `flag` take are typed so too.
   Types only; guarded by `tsc -b --force` and `readSheet.skipLine`.
4. **The row's label and key, module-level.** Two pure helpers beside
   `isTitleRow`: `skipLabel(type, folder, season, episode)` (a Season row by
   its season, an Episode row by its tag, any other by its **Folder key**:
   the docblock the callback's comment holds now) and `rowKey(...)` (the
   duplicate key, its docblock carrying the _case folded, as `sameFolderKey`
   compares_ reason). The callback reads both. Guarded by
   `readSheet.duplicates`, `readSheet.unreadCells` (every label shape) and
   `createImporter.duplicates`, unchanged.
5. **The cell checks, module-level.** The five closures leave the callback
   as three pure helpers in the voice of `cellNumber` and its siblings, each
   taking the cell's text and a `report(column, text)` the callback builds
   once from `onSkip` and the label:
   - `parsedCell(text, column, parse, report)`: the parse, a filled cell that
     answers nothing reported;
   - `flagCell(text, column, yes, no, report)`: the two lists, a value on
     neither reported, read as no;
   - `containedPaths(paths, folder, column, report)`: the paths
     `isContained` keeps, each other reported (a single path cell is a list
     of one, so `containedOne` goes).

   The four hand-written `Type`, `Year`, `Season` and `Episode` checks read
   `parsedCell` (the Year through `yearSpan`'s `year`, the Type through
   `cellType`, read once and defaulted to Movie after). Guarded by
   `readSheet.unreadCells`, `.pathCells`, `.dialect`, `.duplicates`,
   `.oneSheet`, `createImporter.unreadCells`, `.skipLines`, `.roundTrip`,
   unchanged.

### Group 3: one fill per held place

6. **One scanned-episode lookup.** A module-level `scannedEpisode(show,
season, episode)` beside `scannedSeasonPoster`, answering the scan's
   episode or `null`; `scannedStill` and `scannedTracks` read it (each one
   line). Both names stay: they are the importer's questions, named by
   rebuild-whole's refactor. Guarded by `createImporter.heldSeriesArt`,
   `.heldTracks`, `.heldOneScan`, `.seriesArt`.
7. **What a title took is typed.** `TakenFile = (typeof TAKEN_ORDER)[number]`
   beside `TAKEN_ORDER`; `fillHeldFiles` collects a `Set<TakenFile>` and
   answers `TakenFile[]`. Types only; guarded by `tsc -b --force` and the
   held suites' `✓ Updated` lines.
8. **One fill per empty place, one per lacking tracks.** Two closures beside
   `copyTracks`, each answering whether it took anything:
   - `fillEmpty(has, into, file, copy, write)`: when the place is empty,
     copy the file and, when it copied, write its path;
   - `takeTracks(held, found, into, copy, write)`: copy the tracks
     `lackingTracks` leaves and, when any copied, write them.

   `fillHeldFiles`' six art blocks and two track blocks each become one call
   and a `taken.add` on `true`. Its two kinds, its docblock and its answer
   are unchanged. Guarded by `createImporter.heldFilmArt`, `.heldTracks`,
   `.heldOneScan`, `.heldSeriesArt`, `.seriesArt`, `.pathCells`, unchanged.

### Group 4: the convention's types

9. **`heldVideoRefusal` takes a `Pick`.** Its storage is
   `Pick<LibraryStorage, 'titleHolding' | 'getMovie' | 'getSeries'>`, as log
   60 designed and as `titleVideos` reads storage; `HoldingStorage` goes.
   Types only; guarded by `heldVideoRefusal.test` (its fake satisfies the
   `Pick` unchanged), `routes.addSeriesHeld`, `routes.addMovieHeld`.
10. **`detectSubtitleLanguage`'s tail in the unit's style.** Braces, and
    `!== undefined` for the tag lookup. Guarded by `detectSubtitleLanguage`'s
    suites and `readTitleFolder.test`'s tracks, unchanged.

### Group 5: suites

11. **`test: [rebuild-edges] issue #579 the two track writes tested`.**
    `library/write/write.test` and `library/series/write/write.test` each
    gain a `describe` over a real `:memory:` database, in their existing
    voice: tracks appended after the held ones in order, the held tracks
    keeping their ids and positions, the positions continuing from the last
    (`0` for a title with none), and an empty list writing nothing. Green
    from the start: characterization of shipped code.
12. **`test: [rebuild-edges] issue #579 each suite names its phase`.**
    The two `unreadCells` headers read _Phase 7 (issue #570)_; the two
    `duplicates` headers read _Phase 8 (issue #571)_. Comments only.
13. **`test: [rebuild-edges] issue #579 the lint the round wrote`.**
    `writeSheet.separator.test` strips the BOM by `UTF8_BOM`'s length (after
    commit 2), no literal U+FEFF left; `createImporter.skipLines.test` drops
    its unused `readFileSync`. Lint ends this group at 1 error and 137
    warnings, rebuild-whole's close. No assertion changes.

### Group 6: comments

14. **The docblocks rewrapped and made true.**
    - Rewrapped to 80 columns: `pathCellFills`' `showWithCells`,
      `readSheet`'s `CHECKED_PATHS` and `skipLine`'s `text` field (the
      callback's own comments left with commits 4 and 5),
      `createImporter`'s `SheetRead` and `TAKEN_ORDER`.
    - `importShow`'s docblock says what a held show does now: its empty art
      filled and each held episode's lacking tracks taken, after the run's
      new episodes are in, so a season this run adds takes its Season
      poster; never replacing; what it took named on its `✓ Updated` line,
      _Already in library_ only when it took nothing and copies nothing.
    - Beside a held film's `if (filled.length > 0)`, one comment: the
      **Layout fill** runs after Sheet fills only, since every file
      `fillHeldFiles` took was read out of this Title folder already.
    - The two _next position_ `SELECT`s rewrapped inside template strings,
      as rebuild-whole rewrapped its `INSERT`s.

    Comments and SQL whitespace only.

### Group 7: the docs

15. **`docs: [rebuild-edges] issue #579 the docs know the edges`.**
    - **Feature checklist**: the row reads _Rebuild edges: hand-kept sheets,
      growing folders_, ✅; step 43 goes ✅ with what shipped, in step 42's
      shape, its lines rewrapped.
    - **README**: the server tree's `import-export/` names `sheetDialect`
      (the Sheet dialect); `routes/` names `heldVideoRefusal/` (the Held
      video refusal both adds read) beside `foundPathRefusal/`.
    - **Release checklist**: one smoke after _Rebuild whole_, over the
      sandbox Library folder in the shell: `Meta\familyflix-library.csv`
      resaved by a Dutch or German Excel as plain _CSV_ (`;`, cp1252), one
      rating changed to `8,5` and one title holding a diacritic; _Scan new
      folders_, _Done_: the rating reads 9, the title spells its diacritic,
      and the sheet is rewritten `;` with decimal commas.
    - **Glossary**: **Sheet dialect** names `UTF8_BOM` as the dialect's own
      mark; **Sheet reader** says an **Unread cell**'s column is one of the
      **Sheet columns**. The dialogue is a snapshot and stays.

### Group 8: the journal

16. **`docs: [rebuild-edges] issue #579 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last refactor entry's shape: what
    shipped before the round, what each group changed, where the round left
    the plan, the test count and lint against `1a1a355b`, the follow-ups
    (below). The commit closes 563 in words, not with a keyword, and this
    issue with one.

## Decision Document

- **A concept has one home, the unit that owns it.** The dialect's separator
  type and its BOM are `sheetDialect`'s, since the dialect is how a csv is
  spelled; the writer writes in a dialect and imports both. A row's label,
  key and cell checks are the reader's, module-level beside its other cell
  rules.
- **The reader's helpers stay private to `readSheet`.** `skipLabel`,
  `rowKey`, `parsedCell`, `flagCell` and `containedPaths` are not exported:
  no other unit needs them, and the reader's public face (`readSheet`,
  `skipLine`, `SheetSkip`, `isTitleRow`, `resolvePathCell`) is unchanged. They
  are tested through it, as `isContained` is.
- **A skip's column is a `SheetColumn`**, the writer's header, as log 60's
  _Types_ gave it. `skipLine`'s text is unchanged, since every header it
  prints already is one.
- **`fillHeldFiles` keeps one name and two kinds.** Log 60 Q13 settled one
  rule for a film and a series, and the glossary, checklist and
  `pathCellFills`' docblock name it. Unlike `planSheetFields`' retired third
  kind, its two branches share the rule (an empty place filled, a lacking
  language taken), which the two new helpers now say once. Splitting it into
  a film's and a series' fill would name the rule twice.
- **`scannedStill` keeps its name.** Rebuild-whole's refactor named the
  importer's questions of a `ShowScan`; `scannedEpisode` is the one lookup
  under them, not a replacement.
- **The refusal reads storage by `Pick`.** A narrow reader of
  `LibraryStorage` names the members it reads; a second interface restating
  their signatures can drift from them.
- **A held film's Layout fill stays after Sheet fills only.** The journal
  asked; the answer is that a file taken from the Title folder is already in
  it, so the guard is right and gains its reason as a comment.
- **Nothing on the schema, the wire, Settings, the prototype or any copy
  changes.** Every `✓ Updated` line, Warning line and `409` sentence stays
  byte for byte.

## Testing Decisions

- **A good test asserts what a caller or the household sees**: the rows a
  sheet reads, the skips reported and their lines, the sheet's bytes, the
  library a scan leaves, the files on disk, the HTTP status and body. It
  never asserts which helper ran or where a rule lives.
- **The initiative's behavioural suites carry every refactor commit**:
  `sheetDialect.test`; `readSheet.pathCells`, `.dialect`, `.unreadCells`,
  `.duplicates`, `.skipLine`, `.oneSheet`; `writeSheet.separator`,
  `.padding`; `writeExport.dialect`; `createLibrarySheet.dialect`,
  `.unreadable`, `.padded`; `createImporter.skipLines`, `.sheetDialect`,
  `.unreadCells`, `.unreadSheet`, `.duplicates`, `.heldFilmArt`,
  `.heldTracks`, `.heldOneScan`, `.roundTrip`, and rebuild-whole's
  `.heldSeriesArt`, `.seriesArt`, `.pathCells`; `detectSubtitleLanguage`;
  `readTitleFolder.test`; `heldVideoRefusal.test`; `routes.addSeriesHeld`,
  `routes.addMovieHeld`.
- **New tests**: the two library track writes (commit 11), over a real
  in-memory SQLite. Prior art: `library/write/write.test`'s `addMovie` and
  `updateMovie` subtitle cases, and `series/write/write.test`'s
  `addEpisode`.
- **Assertions that change: none.** Commits 12 and 13 touch a header, an
  import and a BOM strip; commit 1 a type import. A suite that has to change
  anywhere else is reading an implementation detail, and is fixed in the
  same commit with the reason in the body.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at 1 error and 137
  warnings, or fewer, and 11786 tests plus commit 11's.

## Out of Scope

- **A held Found again film that also takes files logs two `✓ Updated`
  lines** (the journal's second follow-up): its files' line during the scan
  and its `video` line at import. The handoff's _Copy_ table means one line;
  merging them changes the log, so it is a `fix:` issue of its own, not this
  round.
- **A held series' failed file copy is a Problem; a held film's is a Warning
  line.** `fillHeldFiles` takes the series' copy from `importShow`'s
  `copyArt`, which files art failures on the show's `failed` Problem; the
  film's `heldArtCopy` logs a Warning line (log 60 Q13: _no review row_).
  Aligning them changes what review shows, so it is a `fix:` issue of its
  own.
- **One sandbox for the held suites** (the journal's last follow-up):
  `heldOneScan` needs a real Library folder resolver, `heldTracks` and
  `heldSeriesArt` stub it. That is the shared importer harness rebuild-whole
  put out of scope: a round across every importer suite.
- **`sheetDialect` decodes a csv's bytes, and `readSheet` decodes them
  again.** A Library sheet is kilobytes; one decode passed between them is a
  wider interface for no felt cost.
- **`importShow`'s shape**, now also handing its `copyArt` to
  `fillHeldFiles`. Carried from rebuild-whole.
- **Carried from folder-layout**: an options object for `createApiRouter`,
  a discriminated library scope, `importPlaced`'s parameters as an object,
  the Sync's done summary still wording the retired Write targets.
- **Everything log 60 put out of scope**: a symlink inside a Title folder, an
  episode synopsis, `ja` and `nee`, tab-separated sheets, a series add
  naming one video twice, a relative `↓` path, the ticket's _Not covered_
  list.
- **The frozen `handoff-rebuild-edges/`.**

## Further Notes

- Groups 2 and 3 are the round's reason to exist: the reader's callback and
  the held fill each grew one slice at a time, and each now says its rule
  once.
- Order: commit 1 before 2 (both touch `writeSheet`'s imports); 2 before 13
  (the suite strips the BOM by `UTF8_BOM`); 3 before 5 (the helpers take a
  `SheetColumn`); 4 before 5; 6 and 7 before 8; 14 after every code commit,
  so it rewraps what stays; 15 after 14. Groups are otherwise independent.
- Follow-ups for the journal, not this round: the two `fix:` issues above
  (one `✓ Updated` line for a Found again film that takes files; a held
  series' failed file copy as a Warning line), the shared importer harness,
  `importShow`'s shape, and those carried from folder-layout.
