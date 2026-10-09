# Refactor plan: Export options — the download path retired, one reading of each rule, the summary out of the route, and the docs that close it

> Source initiative: [`export-options`, issue #275](https://github.com/carlos-rezai/FamilyFlix/issues/275)
> Shipped by issues 276–281. Design log: `docs/design-logs/31-export-options.md`.
> Plan: `docs/PRDs/31-export-options-plan.md`.
> Filed as issue 283.
> This plan absorbs issue 282, the plan's Phase 7 (_the close_), so the
> initiative has one refactor issue: the retirement is Group 2 here and its
> docs are Group 5.
> The maintainer approved every recommendation in advance, with one standing
> instruction: _keep the codebase consistent with our naming and code
> conventions, patterns and architecture._

## Problem Statement

`export-options` shipped in six slices. #276 added `exportName`, `exportRows`
over films, the new `writeSheet(tables, format, name)`, `writeExport`,
`exportBody`, `POST /api/export`, the grown summary, `startExport`, the new
`useExport` and the dialog's _Save to_, name row and done copy, with the
prototype amendment riding its `feat:` commit; it also moved the old download
onto a new `writeDownload` unit so the Sheet writer could change shape. #277
added series rows and the Episodes table. #278 added the file plan, the art,
the `xlsx` hyperlinks and the _Images_ toggle. #279 added subtitles and their
toggle, and a `fix:` commit (`3f010ce`) that makes three importer suites
await their runs. #280 added `pickOneFolder`, the channel, the preload member,
`fakeFolderBridge.pickOne` and _Browse…_. #281 added the edges: the three
refusals, the numbered name, the rollback, the skipped unreadable file and
the sheet written last.

Every log-31 ruling was read against the code for this filing. Q1–Q30 hold,
except where the items below say otherwise. Two rulings were met differently
from their letter, and both stay:

- **Q19's title folders are not `movieFolder`'s names.** `movieFolder` slugs
  (`heat-1995`); the log's own example is `Heat (1995)`, the collection's
  shape. `exportRows` names them its own way, which is the ruling's intent.
- **Q25's _Include_ rows are not the Settings `Row` furniture.** The revised
  prototype draws them at 14.5px and 12.5px, the Settings rows at 15px and
  13px. The prototype is the spec, so they keep their own styles.

The pattern earlier rounds found holds again: a reading spelled twice by two
slices, a rule that landed in the route layer, a shape one slice needed and
the next outgrew, and the paperwork. This round also carries the retirement
the log deferred to it.

### 1. The download path, still live

Log 31 Q4 retires `GET /api/export/:format`, `fetchExportFile`, **Save to
computer** and `EXPORT_FILENAME`. All four still ship, and so does what only
they use:

- server: the route, its format reader and content-type table in
  `routes/index.ts`, and `writeDownload/` — a 97-line copy of log 14's cell
  rules, with no suite, that #276 created to keep the route alive;
- client: `fetchExportFile` and its leaves, `fakeResponse`'s `fileResponse`
  (its one caller is that suite), `saveToComputer/` and `stubDownload/`
  (whose one caller is `saveToComputer`'s suite), and `fakeUpdateBridge`'s
  docblock, which names `stubDownload` as its model;
- `routes.export.test.ts`, which is mostly the GET's leaves. Some of them have
  no twin on the `POST` path yet: the awkward title (a diacritic, a comma and
  a double quote) read back identically, the BOM through the reader, the row
  an edit didn't touch left as written, a library of none, and the summary
  answering the count as it stands now.

### 2. Lines past the measure, and docblocks that describe the old dialog

The build wrote comment lines past 80 columns: `writeSheet`'s docblock (100),
the `POST /api/export` comment in `routes/index.ts` (118), and `useExport`'s
docblock (105). `ExportModal`'s docblock breaks a sentence across a line
(_"off; \_Columns included\_"_). Several docblocks still describe log 14:
`FileRow` (_"the sheet glyph"_), `Filename` (_"The **Export file**'s
name"_), `fetchExportSummary` (_"the count … beside the filename"_), and
`SectionLabel`'s examples.

### 3. An import out of place

`exportBody`'s import sits after `movieFormBody` in `routes/index.ts`, out of
its group's alphabetical order.

### 4. The dialog's name row is named for a file

Q25 calls it _the name row_, and it holds the **Export name** of a folder.
Its styled components are `FileRow`, `FileName` and `Filename` (two names
one letter's case apart), and the done line's mono span, which holds a
folder name and a destination, is `DoneFilename`.

### 5. A Year range spelled privately

`yearSpan/` is _"the one reading of a **Year range**"_. `exportRows` spells
one with a private `yearRange`. `media/episodeTag` keeps its reader and its
writer, `spellEpisodeTag`, side by side, so the server has one spelling to
read back.

### 6. Two names stripped twice

`exportRows` has `safeName` (for a subtitle's language) and `titleFolderName`
(for a title's folder). Each spells the unsafe-character strip and the
fallback on its own.

### 7. "Can I write into this folder?" read twice

`readableFolder` is the one reading of reach. #276 gave `writeExport` an
`access(W_OK)` check, and `writeBack.check` already had its own
`access(W_OK)` plus `stat`. That is two readings of one question about the
disk, in two domains. The last round's decision was _one reading per question
about the disk, in `media/`_.

### 8. The export's refusals are worded in the domain

`writeExport` answers `refused` and `failed` with finished sentences. The
last round settled _routes map, domains decide_: `admitFolder` answers a
refusal kind, and the route words it through `FOLDER_REFUSALS`, as
`DECISION_REFUSALS` does.

### 9. The summary's rule lives in the route, and reads series the long way

`GET /api/export` finds the first reachable Library folder, falls back to
`homedir()`'s Downloads, and counts episodes, all in the handler. It counts
them by calling `listEpisodes` once per series. Both export handlers read
"every series" through `seriesInScope('all')`, which is the **Sync**'s scope
read. `getSeriesHome()` already answers every series and the episode total
(the Series tab's _N series · M episodes_) in one read.

### 10. The Metadata sheet's name spelled twice

`writeBack` now has `SHEET_NAME = 'familyflix-metadata.csv'` and a private
`SHEET_STEM = 'familyflix-metadata'`. If one changes, the other won't.

### 11. The Sheet writer's path columns are untyped strings

`PATH_COLUMNS` is a `Set<string>` of `'Poster'`, `'Backdrop'` and `'Still'`.
A renamed column would compile and stop linking.

### 12. Two folder dialogs, one fallback written twice

`main.ts`' `pick` and `pickOne` handlers each spell `window ?
dialog.showOpenDialog(window, options) : dialog.showOpenDialog(options)`.

### 13. Two path fields, one row and one refusal line copied

`ExportModal.styles`' `DestinationRow` and `Refusal` are `LibraryFolders.styles`'
`AddRow` and `Refusal`, declaration for declaration, in the same feature.

### 14. `useExport` reads the bridge every render, and says _typed_ about a default

`LibraryFolders` reads `folderBridge` once, with `useState(folderBridge)`.
`useExport` calls `folderBridge()` on every render, then guards the pick with
`bridge?.` and an `undefined` check. Its raw setter is `setTyped`, though it
also fills the default. Its ref is `typed`, where `useTmdbKey`, whose rule it
follows, says `edited`.

### 15. One refusal body read twice

`startExport` and `addLibraryFolder` each spell the same parse of a refusal
body (`{ error }` → the sentence) in the feature's `api.ts`.

### 16. The docs the initiative owes (issue 282, merged)

The plan's Phase 7, filed as 282, is moved here in full, because the standing
rule makes the close the refactor's last commit anyway:

- **CLAUDE.md.** The folder tree doesn't name `exportName`, `exportRows`,
  `writeExport`, `exportBody`, `startExport`, `pickOneFolder` or the
  preload's second folder member, and still names `saveToComputer`,
  `stubDownload`, `fileResponse` and `EXPORT_FILENAME`. The Bulk Import /
  Export section describes log 14's eight columns and Downloads. The
  _only the Write targets write into a Library folder_ rule needs amending.
  Step 15 and its Maintainer tools entry are 🔜, and 🧭 **Back up the
  library** isn't on the Roadmap.
- **README.** The same ✅ and the build order.
- **The glossary.** **Save to computer** says _retiring_. **Export** and
  **Export file** say the old path _retires_. **Export folder** says each
  title folder takes _a **Movie folder**'s name_, but it takes `Heat (1995)`.
- **The dev journal.** No entry for the build and none for this round.
- **`COMPONENT-SPEC.md`.** ExportModal's _Composes_ column still reads
  _Modal, Chip/segmented, Button_.

## Solution

Six groups. The tree is working and green after every commit:

0. **The record.** The build's journal entry comes first, so it describes
   what shipped before this round changes anything.
1. **The comments and the import.** Rewrap, correct the docblocks, and order
   the import. No behaviour changes.
2. **The retirement.** Port the GET's leaves that have no `POST` twin, then
   remove the download path, server first, client second, the shared constant
   last, and give the route suite the route's name.
3. **The server's tidies.** One spelling of a Year range, one name strip, one
   reading of _writable_, refusals worded in the route, the summary in a
   domain unit on one series read, one spelling of the sheet's name, typed
   path columns, and one dialog call in the shell.
4. **The client's tidies.** One path-field furniture, the name row's names,
   `useExport`'s bridge and names, and one refusal reader.
5. **The docs.** Last, because they describe the tree the earlier groups
   leave. They close 275, 282 and this issue.

That's twenty-five commits. No wire, schema, prototype or pixel changes, and
the only route that changes is the one Q4 retires.

## Commits

### Group 0: the record of what was built

1. **The journal's export-options build entry.** A new top entry, _Export
   options (issues #276–#281)_, using the earlier build entries' sections:
   - What shipped, slice by slice, as the Problem Statement lists it.
   - The prototype amendment (`feat.ExportModal.dc.html` and the
     `COMPONENT-SPEC.md` entries) riding #276's `feat:` commit, as the plan
     said.
   - The plan's two departures from the log: no prototype-only slice, and
     the Metadata sheet moved into Phase 1.
   - The judgement calls the subagents made alone that the log didn't name:
     - title folders named `Heat (1995)` by `exportRows` rather than by
       `movieFolder`, which slugs (kept);
     - the _Include_ rows on their own styles, the prototype's sizes (kept);
     - `exportRows`' suites split by phase into `.series`, `.images` and
       `.subtitles`, and `writeExport`'s into `.images`, `.subtitles`,
       `.readOnly` and `.edges` (kept);
     - `3f010ce`, three importer suites made to await their runs (kept);
     - `writeDownload`, the old route kept alive on a copy of log 14's rules
       (item 1);
     - `yearRange` (item 5) and the two name strips (item 6);
     - the second write check (item 7) and sentences in the domain (item 8);
     - the summary in the route and its per-series episode read (item 9);
     - `SHEET_STEM` (item 10), untyped `PATH_COLUMNS` (item 11), the second
       dialog fallback (item 12);
     - the copied row and refusal line (item 13), the per-render bridge read
       (item 14), the second refusal parse (item 15).
   - What was deliberately not built: everything log 31 rules out.
   - The test and file counts at the end of the build, measured at
     `2f6cbe3`.
   - The follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1: the comments and the import, nothing else

2. **The build's over-measure lines rewrapped, its stale docblocks
   corrected.** The comment lines of item 2, found with `git blame` against
   `215d9a5..2f6cbe3`, are rewrapped. `ExportModal`'s broken sentence is
   joined. The docblocks that describe log 14 say what is drawn now: the
   folder glyph and the **Export name** on the name row, and the summary's
   counts, default destination and name. Lines past the measure that predate
   the initiative are left. Comments only, no test.

3. **`exportBody`'s import in place.** It moves to its alphabetical place
   among the route-layer units in `routes/index.ts`. `tsc -b` and the
   unchanged run are the proof.

### Group 2: the retirement (issue 282's first half)

4. **The GET's last leaves ported to the `POST`.** `routes.exportFolder.test`
   gains each leaf of item 1 that has no `POST` twin: the awkward title read
   back identically in both formats, the BOM ahead of the awkward titles and
   stripped by the reader, the untouched row left as written after an edit,
   an export of an empty library, and the summary's count as it stands now.
   Test only, green on the code as it stands.

5. **The server's download path retires.** `GET /api/export/:format`, its
   format reader and content-type table, and `writeDownload/` go.
   `routes.export.test.ts` goes with them: every one of its leaves is either
   the retired route's or was ported by commit 4. The summary handler's
   comment stops calling the routes plural.

6. **The client's download path retires.**
   - `fetchExportFile` and its describe go from the feature's `api/`.
   - `fileResponse` and its leaves go from `fakeResponse`.
   - `saveToComputer/` and `stubDownload/` go, folder and suite.
   - `fakeUpdateBridge`'s docblock names `stubScrollTo` alone as its model.

7. **`EXPORT_FILENAME` retires.** It goes from `types/export.ts` and the
   barrel. Nothing reads it after commits 5–6. `tsc -b` is the proof.

8. **The route suite takes the route's name.** `routes.exportFolder.test.ts`
   becomes `routes.export.test.ts` with `git mv`. Its leaves are unchanged.

### Group 3: the server's tidies

9. **A Year range spelled beside its reading.** `library/series/yearSpan/`
   gains `spellYearSpan(year, endYear)`: `2022`, `2019–2023`, `2021–`, and
   `null` for no year, on `spellEpisodeTag`'s precedent. `exportRows` reads
   it and its `yearRange` goes. `yearSpan.test` gains a leaf per shape and a
   round trip: every spelling reads back through `yearSpan` as the span it
   came from. `exportRows.series` passes unchanged.

10. **One name strip in the file plan.** `titleFolderName` is built on
    `safeName`, so the unsafe characters and the fallback are spelled once.
    The trailing dot and space still come off a folder name only. Every
    `exportRows` suite passes unchanged.

11. **One reading of whether a folder can be written.** A new
    `media/writableFolder/` holds `writableFolder(path): Promise<boolean>`: a
    directory this process can write into, never throwing.
    - `writeExport` asks `readableFolder` for _relative_ and _missing_, then
      `writableFolder` for _read-only_.
    - `writeBack.check` asks `writableFolder` and loses its `access` and
      `stat`.
    - `writableFolder.test.ts` covers a writable directory, a file, a missing
      path and a read-only directory, on `writeExport.readOnly`'s method for
      making one.
    - `writeExport` and `writeBack` pass unchanged.

12. **The export's refusals are worded in the route.**
    - `writeExport` answers `{ kind: 'refused'; refusal: ExportRefusal }`,
      where `ExportRefusal` is `'relative' | 'missing' | 'read-only'`, and
      `{ kind: 'failed'; reason: string }`.
    - The route maps each refusal through an `EXPORT_REFUSALS` table beside
      `FOLDER_REFUSALS`, and words a failure as _The export stopped partway:
      `<reason>`. Nothing was left behind._
    - `writeExport`'s suites assert the kinds and the reason in place of the
      sentences. The route suites pass unchanged, sentences included, which
      is what proves nothing moved on the wire.

13. **The summary leaves the route.** A new `import-export/exportSummary/`
    holds `exportSummary(storage, home, now): Promise<ExportSummary>`:
    - the counts off `countMovies()` and `getSeriesHome()`'s series and
      episode total, with no per-series read;
    - `defaultDestination` as the first listed folder `readableFolder` calls
      readable, else `join(home, 'Downloads')`;
    - `folderName` as `exportName(now)`.

    The route passes `homedir()` and `new Date()` and answers the value. The
    `POST` handler reads its series ids off `getSeriesHome()` too, so neither
    export route borrows the Sync's `seriesInScope`. `exportSummary.test.ts`
    covers the counts, each destination case and the name, over a sandbox
    and a fresh storage. The route's summary leaves pass unchanged.

    It sits in `import-export/` on `admitFolder`'s precedent: a unit that
    takes storage and answers a value for its route.

14. **The Metadata sheet's name spelled once.** `writeBack` exports
    `SHEET_STEM` and builds `SHEET_NAME` from it as `` `${SHEET_STEM}.csv` ``.
    `writeBack`'s suites pass unchanged.

15. **The Sheet writer's path columns typed.** `PATH_COLUMNS` is a set of
    `ExportColumn | ExportEpisodeColumn`, so a renamed column fails the
    typecheck. `writeSheet.images` passes unchanged.

16. **One folder dialog in the shell.** `main.ts` gains a local
    `showFolderDialog(options)` holding the `window`-or-not fallback, and
    both handlers call it. `main.ts` stays wiring only. `pickFolders`' suite
    and `tsc -p tsconfig.electron.json` are the proof.

### Group 4: the client's tidies

17. **One path-field furniture for the feature.** A flat
    `features/import-export/pathField.styles.ts`, on `filesCard.styles.ts`'
    precedent, holds `PathRow` (the field taking the width, its buttons
    beside it) and `Refusal` (the 13px `danger` line, 8px under). The
    Library folders page's add row and the Export dialog's _Save to_ both
    draw with them, and `AddRow`, `DestinationRow` and both `Refusal`s go.
    The declarations are the same, so no pixel moves. `LibraryFolders` and
    `ExportModal` pass unchanged.

18. **The name row named for what it holds.** In `ExportModal.styles`,
    `FileRow` becomes `NameRow`, `FileName` becomes `NameLead`, `Filename`
    becomes `ExportName`, and `DoneFilename` becomes `DonePath`. Each
    docblock follows. `ExportModal`'s suites pass unchanged.

19. **`useExport` reads the bridge once.** The bridge is read with
    `useState(folderBridge)`, `LibraryFolders`' way. `browse` is `null`
    without it, and the pick needs no `undefined` guard. The ref `typed`
    becomes `edited`, after `useTmdbKey`, and the raw setter `setTyped`
    becomes `setField`. `useExport`, `useExport.browse` and
    `ExportModal.browse` pass unchanged.

20. **One reader of a refusal body.** `api.ts` gains a private
    `refusalSentence(response): Promise<string | null>`. `startExport` and
    `addLibraryFolder` both read their `400` (and `409`) through it. The
    `api` suite passes unchanged.

### Group 5: the docs that close the initiative (issue 282's scope)

21. **The glossary.**
    - **Save to computer** is marked _retired_, naming this refactor.
    - **Export** and **Export file** say the download path _was retired_.
    - **Export folder** names its title folders as the collection names them
      (`Heat (1995)`), not a **Movie folder**'s name.
    - **Sheet writer** and **Export destination** are read against the final
      code.
    - Dated notes and dialogue examples are left as history.

    Docs only.

22. **CLAUDE.md and the README.** Docs only.
    - CLAUDE.md's folder tree:
      - `import-export/` names `exportName/`, `exportRows/` (the cell rules
        and the file plan), `exportSummary/` and `writeExport/`, and
        `writeSheet/`'s line describes the two tables and the named files.
      - `routes/` names `exportBody/`.
      - `media/` names `writableFolder/`, and `yearSpan/`'s line names
        `spellYearSpan`.
      - `enrichment/writeBack`'s line is amended: the Write targets and an
        Export, each only ever adding what is not there.
      - `electron/` names `pickOneFolder` beside `pickFolders`, and the
        preload's `folders` member has `pick` and `pickOne`.
      - `features/import-export/` drops `saveToComputer/`, names
        `pathField.styles.ts`, describes `ExportModal` and `useExport` as
        built, and lists `startExport` in `api/` in place of
        `fetchExportFile`.
      - `test-support/` drops `stubDownload/` and `fileResponse`, and
        `fakeFolderBridge/` names `pickOne`.
      - The types line names `EXPORT_EPISODE_COLUMNS`,
        `EXPORT_NAME_PREFIX`, `StartExport` and `ExportResult` in place of
        `EXPORT_FILENAME`, and `FOLDER_CHANNELS.pickOne`.
    - The Bulk Import / Export section's exporter paragraph describes the
      Export folder at an Export destination, the sixteen columns, the
      Episodes sheet, the Include toggles, `POST /api/export` and the grown
      summary. The round-trip promise stays.
    - The Architectural Boundaries rule on writing into a Library folder is
      amended the same way.
    - The build order: step 15 is ✅, no step carries _(next)_, and the
      lead-in says the chain is done.
    - The Maintainer tools entry for Export options is ✅ and describes what
      shipped. The Export entry stops saying Downloads.
    - 🧭 **Back up the library** joins the Roadmap: videos travelling, a run
      with progress and cancel (log 31 Q2, Q23).
    - README: the same ✅ in the feature table and the build order, and the
      Roadmap line.

    Prettier runs over the changed docs.

23. **`COMPONENT-SPEC.md` read against the final tree.** ExportModal's
    _Composes_ column names what it draws now: Modal, FormatCard, TextField,
    Toggle, Button. The row's props and the folder bridge's paragraph are
    checked against the shipped names and corrected if they drifted.

24. **The prototype read against the final tree.** `feat.ExportModal.dc.html`
    is read against what ships. It is the spec, so a drift found here is
    recorded in commit 25 as a follow-up, not fixed in the code. If nothing
    drifted there is no commit.

25. **The journal's refactor entry.** A new top entry, _Export options
    refactor (issue 283)_, using the earlier rounds' sections:
    - what each group changed;
    - leaves added, removed and moved, by name;
    - the test and file counts before (measured at `2f6cbe3`) and after;
    - that `tsc -b --force` and `eslint src server electron .husky` are
      clean;
    - that no pixel changed;
    - that 282 was merged into this plan, and why;
    - that the glossary, `COMPONENT-SPEC` and the prototype were read against
      the final tree;
    - anything the round surfaced, by bare number.

    Docs only. This commit closes 275, 282 and this issue together.

## Decision Document

- **The download path is gone, whole.** No shipping code references
  `GET /api/export/:format`, `fetchExportFile`, `saveToComputer`,
  `writeDownload` or `EXPORT_FILENAME`. Its test doubles (`stubDownload`,
  `fileResponse`) go with it, because nothing else uses them. Every behaviour
  its suite pinned that still matters (the awkward title, the BOM, the round
  trip, the empty library) is pinned on the `POST` first.
- **One reading per question about the disk.** Whether a folder can be read
  is `readableFolder`'s answer. Whether it can be written is
  `writableFolder`'s, in `media/`, for the Sync and the Export alike.
- **One spelling per format.** A Year range is read by `yearSpan` and
  spelled by `spellYearSpan`, side by side, as the Episode tag is. The
  Metadata sheet's name is spelled once. A name is stripped for the disk in
  one place in the file plan.
- **Routes map, domains decide.** `writeExport` answers refusal kinds and a
  failure's reason. The route words them through `EXPORT_REFUSALS`, beside
  `FOLDER_REFUSALS` and `DECISION_REFUSALS`. The summary's rule lives in
  `import-export/exportSummary/`, which takes storage, the home folder and
  the clock, and answers an `ExportSummary`.
- **Every series is read through the browse read.** Both export routes read
  series off `getSeriesHome()`. The Sync's `seriesInScope` stays the Sync's.
- **The shell stays wiring only.** One local dialog call in `main.ts`; the
  pure answer stays in `pickFolders/`.
- **A feature's shared furniture is a flat styles file.** `pathField.styles.ts`
  sits beside the units in `import-export/`, as `filesCard.styles.ts` does in
  `movie-form/`.
- **One idea, one name.** The name row is `NameRow`, after Q25. The ref that
  stops a default overwriting an edit is `edited`, as in `useTmdbKey`. The
  bridge is read once per mount, as in `LibraryFolders`.
- **The close is merged.** 282's acceptance criteria are commits 5–7 and
  21–23, and its journal entry is commits 1 and 25. One refactor issue closes
  the initiative.
- **No wire, schema, behaviour, prototype or pixel change** beyond the
  retired route. `POST /api/export` and `GET /api/export` answer exactly what
  they answer now, sentences included. The IPC channels, the files on disk
  and every surface stay as built.

## Testing Decisions

- **A good test here asserts what the maintainer can see or what the wire
  and the disk carry**: a route's status and sentence, the files an export
  leaves on disk, what a sheet reads back as, what the dialog draws, and
  where a press lands. A domain unit's suite asserts the value it answers.
- **Characterization before change.**
  - Commits 2–3 are comments and order, guarded by `tsc -b` and `eslint`.
  - Commit 4 ports leaves before commit 5 deletes their originals, so the
    round trip, the BOM and the awkward title are never unpinned. It is
    test only, green on the code as it stands.
  - Commits 5–8 remove code and its own leaves. The typecheck proves nothing
    else read it.
  - Commits 10, 14–20 move or share code with no visible change. Each is
    guarded by the suites named in it passing with every leaf unchanged.
  - Commit 9 adds leaves for the new spelling, and `exportRows.series`
    proves the cells didn't move.
  - Commit 11's new suite is written against the behaviour the
    `writeExport.readOnly` and `writeBack` suites already pin.
  - Commit 12 changes a domain value's shape, so `writeExport`'s suites
    change their assertions; the route suites, unchanged, prove the wire
    didn't.
  - Commit 13's new suite is written against the behaviour the route's
    summary leaves already pin, so it is green when the unit lands.
- **Modules tested:**
  - `writableFolder`: new suite.
  - `exportSummary`: new suite.
  - `yearSpan`: new leaves for `spellYearSpan` and the round trip.
  - `writeExport` (all five suites): assertions restated as kinds.
  - `routes.export` (renamed from `routes.exportFolder`): ported leaves.
  - Removed with their units: `routes.export`'s GET leaves, `api`'s
    `fetchExportFile` describe, `fakeResponse`'s `fileResponse` leaves,
    `saveToComputer`, `stubDownload`.
  - Every other suite the build touched (`exportName`, `exportRows` and its
    three siblings, `writeSheet` and its two siblings, `exportBody`,
    `routes.exportSeries`, `routes.exportEdges`, `writeBack`,
    `createImporter.exportFolder`, `pickFolders`, `useExport` and
    `useExport.browse`, `ExportModal` and `ExportModal.browse`,
    `LibraryFolders` and its two siblings, `api`): unchanged.
- **Prior art:**
  - `readableFolder.test.ts` and `writeExport.readOnly.test.ts` for
    `writableFolder`'s suite.
  - `admitFolder.test.ts` for `exportSummary`'s suite over a sandbox and a
    fresh storage.
  - `episodeTag.test.ts`' `spellEpisodeTag` leaves for `spellYearSpan`'s.
  - `FOLDER_REFUSALS` and `DECISION_REFUSALS` for the route's table.
  - The Library folders round's `walkLibraryRoot` rename for the suite
    rename by `git mv`.
- **Coverage is otherwise sufficient.** Every log-31 ruling has a behaviour
  leaf: the name (`exportName`), every cell rule, the merge, the ordering
  and the file plan (`exportRows` ×4), both formats, both tables and the
  hyperlinks (`writeSheet` ×3), each refusal, the numbering, the rollback,
  the skipped file and the four toggle combinations (`writeExport` ×5), the
  body (`exportBody`), every route answer, the round trip with a series,
  the Folder scan passing over an Export folder
  (`createImporter.exportFolder`), the Metadata sheet's header (`writeBack`),
  the picker (`pickFolders`, `useExport.browse`, `ExportModal.browse`), and
  the dialog. An Excel export opened with a link clicked, and a folder
  picked with _Browse…_ in an Unpackaged run, are the maintainer's own
  checks, as the plan accepted.

## Out of Scope

- **The shell's `will-download` handler and `downloadPath/`.** Nothing in the
  renderer downloads once Save to computer is gone, but they are the
  window's rule for any download (log 24 Q25), not the export's. They stay.
- **The _Include_ rows on the Settings `Row` furniture.** The prototype draws
  them at different sizes. Sharing is a prototype amendment first.
- **`movieFolder` for an export's title folders.** It slugs for the managed
  store. The export keeps the collection's `Title (Year)` shape.
- **A shared `errorCode` for `writeBack` and `writeExport`.** Two domains,
  and the server has no shared helper folder by design (no `lib/`
  catch-all).
- **Moving `BodyRead` out of `enrichmentBody`.** Two route readers share a
  type by path, which the codebase already does.
- **Teaching the Sheet reader the new columns**, video files, remembering the
  destination, a _Show in folder_ button, `originalTitle`/`tmdbScore`/`tmdbId`
  columns, and a run with cancel: everything log 31 rules out. **Back up the
  library** joins the Roadmap in commit 22.
- **Prettier-governed long lines in tests and imports**, and **lines past the
  measure that predate this initiative**, including most of
  `routes/index.ts`'. Each round rewraps its own.
- **The Roadmap's Move the media folder.**

## Further Notes

- Commit descriptions stay under the one-line rule. For example, commit 5 is
  _the server's download path retires_, commit 11 is _one reading of a
  writable folder_, commit 13 is _the summary leaves the route_, and commit
  17 is _one path-field furniture_.
- Commits 9, 11, 12, 13, 16, 17 and 20 name new units or values:
  `spellYearSpan`, `writableFolder`, `ExportRefusal`, `EXPORT_REFUSALS`,
  `exportSummary`, `showFolderDialog`, `pathField.styles.ts`, `PathRow` and
  `refusalSentence`. If the subagent finds a name the codebase already uses
  for the same idea, it takes that one instead and records it in commit 25.
- Commit 24 may be empty. If it is, commit 25 says so.
- Commit 25's body closes 275 and 282 with this issue. No other commit body
  carries a closing keyword, and the journal lists follow-ups by bare
  number.
