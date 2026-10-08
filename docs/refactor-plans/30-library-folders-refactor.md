# Refactor plan: Library folders — one reading of reach, one record of a title's folder, one import phase, the add out of the route, and the docs that close it

> Source initiative: [`library-folders`, issue #267](https://github.com/carlos-rezai/FamilyFlix/issues/267)
> Shipped by issues 268–272. Design log: `docs/design-logs/30-library-folders.md`.
> Plan: `docs/PRDs/30-library-folders-plan.md`.
> Filed as issue 274. This plan absorbs issue 273, the plan's Phase 6 (_the close_), so the
> initiative has one refactor issue: its docs are Group 4 here.
> The maintainer approved every recommendation in advance, with one standing
> instruction: _keep the codebase consistent with our naming and code
> conventions, patterns and architecture._

## Problem Statement

`library-folders` shipped in five slices. #268 added migration 6, the
`library/folders/` slice, `folderOverlap`, `readableFolder` (extracted from the
importer's `checkRoot`), the three list routes, `useLibraryFolders`,
`FolderRow`, the `LibraryFolders` organism, `LibraryFoldersPage` and the
Settings row, with the prototype amendments riding its `feat:` commit. #269
added `Importer.scan`, `ImportRun.source`, `titleAt`, the three-argument
`setSourceFolder`, the scan route, `FolderShapes` and the `/import` heading by
source. #270 made the spreadsheet root join the list. #271 added migration 7,
`sourcePath`, the per-folder write check, posters and Metadata sheets,
`EnrichmentSummary.libraryFolders`, `EnrichCheckCard`, and removed
`libraryRoot` from the settings slice. #272 added `pickFolders`, the channel in
`main.ts` and `preload.ts`, `folderBridge`, `fakeFolderBridge` and _Browse…_.

Every log-30 ruling was read against the code for this filing. Q1–Q3 (scope),
Q4 and Q6–Q11 (the list), Q12–Q20 (the scan), Q21–Q23 (the picker), Q24–Q29
(the screen), Q30–Q33 (the Sync), Q35 and Q36 all hold, except where the items
below say otherwise. Q5's carry-over moved to migration 7, as the plan
decided. Q34's rename is the refactor's, as the log said.

The pattern earlier rounds found holds again. The debt an `issue-loop` build
leaves comes from what a subagent reading one issue can't see: a reading
spelled a second time by a later slice, a shape one slice needed and the next
outgrew, two runs written side by side instead of through one tail, rules
that landed in the route layer, and the paperwork.

### 1. The retired term in shipping comments

Log 30 Q34 retired **Library root** for **Library folder**, and the glossary
already says so. Shipping docblocks still use it:

- server: `createEnrichment`'s deps docblock, `writeBack`'s `SHEET_NAME` and
  interface docblocks, `createMedia.copyIn`, the importer's `start` docblock
  and its `roots` comment (_"The run's **Library root** or folders"_), and
  `importShow`'s _"relative to the root"_; `libraryFixture`'s header;
- client: `fetchEnrichmentSummary`, `EnrichmentFlow`'s _"With no Library
  root"_ comment, `ImportSetup`'s `root` prop, `formValues`' Found-file
  docblock, and `EnrichmentRow.sourcePath`'s docblock in `types/enrichment.ts`.

The spreadsheet's typed root is still one path on the wire (`rootPath`) and
on screen (_Movies root folder_). Those stay. Only the glossary term goes.

### 2. The mechanical rename the log deferred

`walkLibraryRoot` is still `walkLibraryRoot` (Q34: _"The rename is mechanical
and lands in the refactor"_). Issue 273 lists it as the commit before the
close.

### 3. Lines the build wrote past the measure

Thirteen comment lines the build wrote are past 80 columns, which Prettier
doesn't wrap. The worst is `preload.ts`' docblock (106). The others are in
`createEnrichment` (two), `createImporter`, `FolderRow`, `FolderRow.styles`,
`ImportFlow`, `ImportSetup`, `useLibraryFolders` (two), `LibrarySection`,
`types/enrichment.ts` and `types/libraryFolders.ts`. Every earlier round has
rewrapped its own initiative's lines.

### 4. Imports out of place

The build put `pickFolders`' import between `downloadPath` and
`loadRenderer` in `main.ts`, `folderOverlap` among the `media/` imports in
`createImporter`, and `readableFolder` and `folderOverlap` among the
`media/` and `playback/` imports in `routes/index.ts`. The files around them
are grouped and ordered.

### 5. `ImportFlow` calls the source's words `COPY`

`ImportFlow` keys the heading and lede by `run.source` in a constant named
`COPY`. `MovieForm` keys the same idea, the words that follow what is on
screen, in `WORDING` (issue 266). One idea, one name.

### 6. The Sync reads reach with its own `stat`

`readableFolder` was extracted so that _"three callers"_ share one reading:
the folder add, the importer's root check and the `reachable` read. #271 gave
`createEnrichment` a private `reachableFolders` that calls `stat` itself. That
is a fourth reading of the same question, and the only place outside `media/`
where the enrichment domain reads the disk for a fact `media/` already
answers.

### 7. The Sync finds a title's folder by comparing joined paths

`library_folder_id` is on every title, but the storage read the Sync uses,
`sourceFolder(id)`, answers only the `source_folder` half. So
`createEnrichment.runFolderOf(id, folder)` calls `sourcePath(id)` and looks
for the run folder whose `join(path, folder)` equals it. `writeMetadataSheet`
does that once per movie per folder. The id is on the row. A read that
answers both columns lets the Sync match on the id.

`setSourceFolder` also still takes `folderId: string | null`. No shipping
caller passes `null`. Since migration 7, a title with a `source_folder`
always has a folder. Only two suites pass `null`, to build a state the
schema no longer produces. The implementation names its third parameter
`folder` where the interface says `sourceFolder`.

### 8. The importer's `Origin` is the folder under another name

`Origin { folderId, base }` is built in two places, and both build it as
`{ folderId: folder.id, base: folder.path }`. It is a `StoredLibraryFolder`
with its fields renamed, and the importer already imports that type.

### 9. Two runs, one import phase written twice

`executeScan` restates `execute`'s tail line for line: the genre pool, the
`warnedGenres` set, the film loop with its `✓ Imported` line,
`warnOfMissingFiles` and `done`, the show loop, and the completion line. They
differ only in the completion verb (_Import complete_ / _Scan complete_) and
in where each match's folder comes from. Beside that:

- `fileUnplaced` became a one-line wrapper over the extracted
  `fileUnplacedOn`;
- `seriesInLibrary` grew a default parameter (`held = heldSeriesList()`) so
  one caller could pass the list it had already read.

### 10. Two starts, one claim written twice

`start` and `scan` each spell the busy check, the `await running` wait, the
second busy check, `run =`, `roots =`, `sources.clear()` and the new abort
controller. Only what runs differs.

### 11. The sheet root's clash read twice

`start` reads `storage.libraryFolders()` and calls `folderOverlap` to refuse
a containing root. Then `sheetOriginOf` reads the list and calls
`folderOverlap` again to find the folder to use. Both happen in one call, and
the second reading can only agree with the first.

### 12. The clash sentences spelled in two layers

The route's `overlapSentence` words each clash. The importer's refusal starts
with the route's `contains` sentence, typed out again, then adds _Import from
…, or remove it from your library folders first._ If one sentence changes,
the other won't.

### 13. The add's rules live in the route

CLAUDE.md: `routes/` is _"HTTP layer only: parse request, call a domain
module, return response"_. `POST /api/library-folders` reads the disk through
`readableFolder`, checks the list through `folderOverlap`, writes, and
catches the unique-constraint race, all in the handler. Every other route
with rules hands them to a domain and maps the answer it gets back:
`importer.start`'s `ImportStartError` and the Decision writes'
`DECISION_REFUSALS`. The handler also declares `let added;` untyped, the only
such declaration in the file.

### 14. The stored-key read written twice

`LibraryFolders` copied `ImportFlow`'s effect that reads `fetchTmdbKey()` into
`keySet` for the `EnrichCheckCard` hint, verbatim, cleanup flag and comment
included. Two callers in one feature is the rule for extracting a hook.

### 15. The organism holds the scan's press

`ImportFlow` owns `useImportRun`, `EnrichmentFlow` owns `useEnrichmentRun`,
and `ExportModal` owns `useExport`. Each organism renders and its hook holds
the wire. `LibraryFolders` holds the scan inline: the `scanning` flag, the
`startFolderScan` call, the push to `/import`, and the `ImportBusyError`
branch that pushes too.

### 16. `LibraryFoldersPage` has no suite

`CodecsPage`, the page it copies, has `CodecsPage.test.tsx`. The new page
has no test file. That breaks the three-file folder rule for a page with no
styles.

### 17. The docs the initiative owes (issue 273, merged)

The plan's Phase 6, filed as 273, is moved here in full, because the standing
rule makes the close the refactor's last commit anyway:

- **CLAUDE.md.**
  - The folder tree doesn't name `library/folders/`, `folderOverlap`,
    `readableFolder`, `pickFolders`, `folderBridge`, `useLibraryFolders`,
    `FolderRow`, `LibraryFolders`, `FolderShapes`, `EnrichCheckCard`,
    `LibraryFoldersPage` or `fakeFolderBridge`, nor the units this round adds.
  - The `db/` line stops at migration 5.
  - The settings slice still lists `library-root`.
  - `walkLibraryRoot/` is still named.
  - The Settings Hub section has no Library folders routes.
  - The Foundation line says _no preload, no native picker_.
  - Step 14 and the Maintainer tools entry are still 🔜, and _(next)_ is on 14.
- **README.** The same ✅ and _(next)_, and its tree still names
  `walkLibraryRoot/` and _"Library root"_ under `library/`.
- **The glossary** was written with the log. Its **Library root** entry says
  migration 6 carried the key over, but migration 7 did. Seven current
  entries still use the retired term: **Picked file**, **Delete**, **Bulk
  import**, **Import phase**, **Found file** and **Copy-in**, and three
  relationship lines (a Library root never written, one Library root per
  Bulk import, a Found file under the run's root).
- **The dev journal.** No entry for the build and none for this round.
- **`COMPONENT-SPEC.md`** names `walkLibraryRoot`.

## Solution

Five groups. The tree is working and green after every commit:

0. **The record.** The build's journal entry comes first, so it describes
   what shipped before this round changes anything.
1. **The comments and names.** Remove the retired term, do the rename, rewrap
   long lines, order the imports, and rename `COPY` to `WORDING`. No
   behaviour changes.
2. **The server's tidies.** One reading of reach, one read of a title's
   recorded folder, the folder for `Origin`, one import phase, one claim, one
   clash read, one spelling of each clash sentence, and the add's rules in a
   domain unit.
3. **The client's tidies.** One stored-key hook, the scan's press in a hook,
   and the page's suite.
4. **The docs.** Last, because they describe the tree the earlier groups
   leave. They close 267, 273 and this issue.

That's twenty commits. No route, wire, schema, prototype or pixel changes.

## Commits

### Group 0: the record of what was built

1. **The journal's library-folders build entry.** A new top entry, _Library
   folders (issues #268–#272)_, using the earlier build entries' sections:
   - What shipped, slice by slice, as the Problem Statement lists it.
   - The prototype amendments (`page.LibraryFoldersPage`, `mol.FolderRow`,
     `page.SettingsPage`, `feat.ImportFlow`, `feat.EnrichmentFlow`,
     `FamilyFlix.dc.html` and the COMPONENT-SPEC entries) riding #268's
     `feat:` commit, as the plan said.
   - The plan's two departures from the log: the spreadsheet root as its own
     slice, and the carry-over moved from migration 6 to migration 7 so the
     Sync kept its write targets between phases.
   - The judgement calls the subagents made alone that the log didn't name:
     - `titleAt`, a storage read the log didn't list, for the first
       Already-in-library rule (kept);
     - `readableFolder` answering a four-way `FolderReading` rather than a
       boolean, so the add can word _relative_ apart from _missing_ (kept);
     - the add's extra `400` sentence for a relative path, _Type the folder's
       full path, starting with its drive._ (kept);
     - `ImportSource` exported as a named type (kept);
     - `fakeUpdateBridge` spreading `window.familyflix` so the two fakes can
       stand together (kept);
     - `createEnrichment`'s own `stat` (item 6);
     - matching a title's run folder by joined paths (item 7);
     - `Origin` (item 8);
     - `executeScan` written beside `execute` (item 9) and `scan` beside
       `start` (item 10);
     - the second clash read (item 11);
     - `overlapSentence` in the route and the importer's restated sentence
       (item 12);
     - the add's rules in the handler (item 13);
     - the stored-key effect copied (item 14) and the scan inline in the
       organism (item 15);
     - no page suite (item 16).
   - What was deliberately not built: everything log 30 _Not built_ lists.
   - The test and file counts at the end of the build, measured at `0ca65f6`.
   - The follow-ups, which are this plan, by bare number.

   Docs only.

### Group 1: the comments and names, nothing else

2. **The retired term out of shipping comments.** Every docblock and comment
   item 1 lists says **Library folder**, or _the spreadsheet's root_ where
   the comment is about the one typed path a sheet import takes. Test titles
   that say _Library root_ are left; they predate the initiative or describe
   the sheet's root. Comments only, no test.

3. **`walkLibraryRoot` becomes `walkLibraryFolder`.** The folder, both files
   and the export are renamed with `git mv`. Both importer call sites and its
   import follow. `groupShows.test`'s mention, `COMPONENT-SPEC.md`'s entry
   and the docblock (_"Walk a **Library folder** for its **Source
   folders**"_) follow too. The walk's suite passes with every leaf
   unchanged except its `describe` name.

4. **The build's over-measure lines rewrapped.** The thirteen comment lines
   of item 3, found with `git blame` against `c56122a..0ca65f6`, are
   rewrapped with no change of words, except where commit 2 already rewrote
   them. Lines past the measure that predate the initiative are left.
   Comments only, no test.

5. **The build's imports in place.** `main.ts`, `createImporter` and
   `routes/index.ts` put the build's imports in their groups, in their
   neighbours' order. `ImportFlow`'s `COPY` becomes `WORDING`, keyed by
   source as `MovieForm`'s is by kind. `tsc -b` and the unchanged run are the
   proof.

### Group 2: the server's tidies

6.  **The Sync reads reach through `readableFolder`.** `createEnrichment`'s
    `reachableFolders` keeps its name and shape and asks `readableFolder(path)
=== 'readable'`. Its `stat` import goes. `readableFolder`'s docblock names
    its fourth caller, the Sync's write check and summary.
    `createEnrichment.folders`, `.summary` and `.writeBack` pass unchanged.

7.  **A title's recorded folder in one read.** - `sourceFolder(id): string | null` becomes `titleSource(id): { folderId:
string; sourceFolder: string } | null`, one query over both columns, on
    `Enrich` and on `LibraryStorage`. - `createEnrichment` matches a title's run folder by `folderId`. Both
    `runFolderOf`'s path comparison and `writeMetadataSheet`'s per-movie
    `sourcePath` call go. - `setSourceFolder(id, folderId: string, sourceFolder: string)`: the
    `null` arm goes, and the implementation's parameter takes the
    interface's name. - `enrich.sourceFolder.test` reads `titleSource`. The two suites that
    passed a `null` folder (`enrich.sourcePath`,
    `createEnrichment.sourcePath`) build their _no folder_ title the way the
    app now does: a title with no source recorded, or one whose folder was
    removed. Each leaf keeps its assertion.

            `sourcePath(id)` stays, for the review rows' mono line.

8.  **The importer's `Origin` is the folder.** `importMatch`, `importShow` and
    `execute` take the run's `StoredLibraryFolder` and read `id` and `path`.
    The `Origin` interface goes. `sheetOriginOf` becomes `sheetFolderOf`. Its
    suites (`folderScan`, `sheetRoot`, `sourceFolders`) pass unchanged.

9.  **One import phase for both runs.** - A private `importPlaced(current, films, shows, verb, signal)` holds the
    tail both runs share: each placed film or show carries the
    `StoredLibraryFolder` it came from, and the completion line reads `✓
${verb} complete — …`. `execute` and `executeScan` both end in it. - The genre pool and `warnedGenres` are built inside it. - `fileUnplacedOn(current, match)` takes the name `fileUnplaced`, and the
    wrapper lambda goes. - `seriesInLibrary(held)` takes the list it is given, with no default, and
    `execute` passes `heldSeriesList()`.

            Every `createImporter` suite passes unchanged. The log's line text is part
            of what they assert.

10. **One claim for both starts.** A private `claimRun(source, enrich, roots)`
    holds the busy check, the wait for a cancelled run's rollback, the second
    busy check, `freshRun`, `roots`, `sources.clear()` and the new
    controller, and answers the run. `start` and `scan` each call it and then
    set `running`. The busy and rollback leaves pass unchanged.

11. **The sheet root's clash read once.** `start` reads the list and the
    clash once and hands both to `sheetFolderOf`, which no longer reads
    either. `sheetRoot`'s suite passes unchanged.

12. **One spelling of each clash sentence.** `clashSentence(clash)` moves out
    of the route as `overlapSentence` and sits beside `folderOverlap`, in its
    folder. `folderOverlap.test` gains one leaf per clash, each asserting its
    sentence. The route reads it. The importer's refusal is
    `${clashSentence(clash)} Import from ${clash.folder}, or remove it from
your library folders first.` `routes.libraryFolders` and
    `routes.importRoot` pass unchanged, sentences included.

13. **The add's rules leave the route.** - A new `server/src/import-export/admitFolder/` holds `admitFolder(storage,
path): Promise<FolderAdmission>`, answering one of three kinds, never
    throwing: - `{ kind: 'added'; folder: LibraryFolder }`; - `{ kind: 'refused'; refusal: 'empty' | 'relative' | 'missing' }`; - `{ kind: 'clash'; clash: FolderClash }`, the unique-constraint race
    answered as `same`. - The route maps each kind to its status and sentence through a
    `FOLDER_REFUSALS` table, on `DECISION_REFUSALS`' precedent. The `let
added;` goes with the handler body. - `admitFolder.test.ts` covers, over a sandbox: an added folder, each
    refusal, each clash, and the race. - `routes.libraryFolders` passes unchanged.

                It sits in `import-export/` because Library folders are the importer's
                sources (log 30 Q27), and both of its readers, `media/` and
                `library/folders/`, are already that domain's imports.

### Group 3: the client's tidies

14. **One read of whether a key is stored.** A new
    `features/import-export/useKeyStored/` holds `useKeyStored(): boolean`:
    `false` until the read lands, `false` for a failed read, and no update
    after unmount. `ImportFlow` and `LibraryFolders` call it. Its suite covers
    the three answers and the unmount. The `EnrichCheckCard` hint leaves in
    `ImportSetup`, `ImportFlow.enrich` and `LibraryFolders.scan` pass
    unchanged.

15. **The scan's press in a hook.** A new
    `features/import-export/useFolderScan/` holds `useFolderScan(): {
scanning; scan(enrich) }`. A `201` pushes `/import`, a `409` pushes too,
    and any other failure clears `scanning`. `LibraryFolders` holds only the
    box's state and renders. Its suite covers the three outcomes.
    `LibraryFolders.scan` passes unchanged.

16. **`LibraryFoldersPage`'s suite.** `LibraryFoldersPage.test.tsx` on
    `CodecsPage.test.tsx`' shape: the organism inside `MaintainerLayout`, the
    page's heading, and the 780 column. Test only, green on the code as it
    stands.

### Group 4: the docs that close the initiative (issue 273's scope)

17. **The glossary.**
    - **Library root (retired)** names migration 7 as the carry-over and
      `walkLibraryFolder` as done.
    - **Picked file**, **Delete**, **Bulk import**, **Import phase**,
      **Found file** and **Copy-in** say **Library folder**, or _the
      spreadsheet's root_ where they mean the one typed path.
    - The three relationship lines follow.
    - Dated notes, retractions and dialogue examples that used the term at
      the time are left as history.

    Docs only.

18. **CLAUDE.md and the README.** Docs only.
    - CLAUDE.md's folder tree:
      - `library/` names `folders/` (the list, its title counts, the remove
        that keeps the titles) and `folderOverlap/` (with `clashSentence`).
      - `enrich/` names `titleSource` and `sourcePath`.
      - The settings slice drops `library-root`.
      - `media/` names `readableFolder/` and `walkLibraryFolder/` in place of
        `walkLibraryRoot/`.
      - `import-export/` names `admitFolder/` and the importer's second
        start.
      - `db/` lists migrations 6 and 7.
      - `routes/` names nothing new: the routes live in `index.ts`.
      - `electron/` names `pickFolders/` and `preload.ts`' second member.
      - `features/import-export/` names `LibraryFolders/`, `FolderRow/`,
        `FolderShapes/`, `EnrichCheckCard/`, `useLibraryFolders/`,
        `useKeyStored/`, `useFolderScan/`, `folderBridge/`, and the four
        calls in `api/`.
      - `pages/` names `LibraryFoldersPage`.
      - `test-support/` names `fakeFolderBridge/`.
      - The types line names `libraryFolders.ts`, `ImportSource` and
        `EnrichmentSummary.libraryFolders`.
    - The Settings Hub section gains the four Library folders routes and
      `/settings/folders`.
    - The Foundation line no longer says _no preload, no native picker_.
    - Bulk Import's bullets mention the Folder scan beside the sheet.
    - Build order step 14 is ✅, _(next)_ moves to step 15, _Neither 14 nor 15
      has a prototype yet_ reads _Step 15 has no prototype yet_, and the
      Maintainer tools entry is ✅.
    - README: the same ✅ in the feature table and the build order, _(next)_
      on 15, the tree's `walkLibraryFolder/`, and `library/`'s line without
      _Library root_.

    Prettier runs over the changed docs.

19. **`COMPONENT-SPEC.md` read against the final tree.** Commit 3 already
    renamed `walkLibraryRoot` there. This commit checks the Library folders
    entries (the route, `FolderRow`'s `data-props`, the bridge) against the
    shipped names and corrects any that drifted. If nothing drifted there is
    no commit, and commit 20 says so.

20. **The journal's refactor entry.** A new top entry, _Library folders
    refactor (issue 274)_, using the earlier rounds' sections:
    - what each group changed;
    - leaves added, removed and moved, by name;
    - the test and file counts before (measured at `0ca65f6`) and after;
    - that `tsc -b` and `eslint src server electron .husky` are clean;
    - that no pixel changed;
    - that 273 was merged into this plan, and why;
    - that the glossary and `COMPONENT-SPEC` were read against the final tree;
    - anything the round surfaced, by bare number.

    Docs only. This commit closes 267, 273 and this issue together.

## Decision Document

- **One reading per question about the disk.** Whether a folder is readable
  is `readableFolder`'s answer, in the add, the importer, the list route and
  the Sync alike. No domain but `media/` calls `stat` to ask it.
- **A title's recorded folder is read as both columns at once.**
  `titleSource(id)` answers `{ folderId, sourceFolder }`. The Sync matches a
  title to a run folder by id, never by comparing joined paths.
  `sourcePath(id)` stays as the joined path a review row draws.
- **No title holds a Source folder without a Library folder.**
  `setSourceFolder` takes a `string` folder id. Migration 7 made that true
  for old rows, and every write since has kept it.
- **The importer passes the folder, not a copy of it.** A run's titles are
  placed against a `StoredLibraryFolder`. There is no `Origin`.
- **One import phase, one claim.** Both runs end in `importPlaced` and
  begin in `claimRun`. They differ only in how they find what to place, and
  in the completion verb.
- **Each clash sentence is spelled once, beside `folderOverlap`.** The route
  and the importer both read `clashSentence`. The importer appends its own
  advice.
- **Routes map, domains decide.** The folder add's rules live in
  `import-export/admitFolder/`, which answers a value. The route maps it
  through a refusal table, as `DECISION_REFUSALS` does. The list `GET` stays
  in the route: it is a storage read and a disk read with no rule between
  them.
- **Two callers in one feature earn a hook.** `useKeyStored` and
  `useFolderScan` are feature-local, on `useImportRun`'s and `useExport`'s
  precedent. The organism renders.
- **Every page has a suite.**
- **One idea, one name.** The words that follow what's on screen are
  `WORDING`, in `ImportFlow` as in `MovieForm`. The walk is
  `walkLibraryFolder`. Comments say **Library folder**.
- **The close is merged.** 273's acceptance criteria are commits 17–18, and
  its journal entry is commits 1 and 20. One refactor issue closes the
  initiative.
- **No route, wire, schema, behaviour, prototype or pixel change.** The four
  routes' answers and sentences, `POST /api/import`'s root refusal, both
  migrations, the IPC channel, the Sync's lines and every surface stay as
  built.

## Testing Decisions

- **A good test here asserts what the maintainer can see or what the wire
  and the disk carry**: a route's status and sentence, the rows a list
  answers, the log lines a run writes, which titles land and with which
  folder recorded, where a poster and a Metadata sheet are written, what a
  screen draws, and where a press lands. A domain unit's suite asserts the
  value it answers.
- **Characterization before change.**
  - Commits 2 and 4 are comments, so `tsc -b` and `eslint` guard them.
  - Commits 3 and 5 are names and order, guarded by the typecheck and the
    unchanged run.
  - Commits 6, 8–11 and 14–15 move or share code with no visible change. Each
    is guarded by the suites named in it passing with every leaf unchanged.
    The importer's suites assert the log's text, so they guard the shared
    tail line for line.
  - Commit 7 changes a storage read's shape. Its suites keep every
    assertion, and only the setup of a _no folder_ title changes.
  - Commit 12 adds leaves for the sentence's new home, and the route suites
    prove nothing moved on the wire.
  - Commit 13's new suite is written against the behaviour the route suite
    already pins, so it is green when the unit lands.
  - Commit 16 is test only, green on the code as it stands.
- **Modules tested:**
  - `admitFolder`: new suite.
  - `useKeyStored`: new suite.
  - `useFolderScan`: new suite.
  - `LibraryFoldersPage`: new suite.
  - `folderOverlap`: one leaf per clash sentence.
  - `enrich.sourceFolder`, `enrich.sourcePath` and
    `createEnrichment.sourcePath`: setup restated, leaves unchanged.
  - `walkLibraryFolder`: renamed, leaves unchanged.
  - Every other suite the build touched (`folders`, `readableFolder`,
    `db`, `createImporter.folderScan`, `.sheetRoot`, `.sourceFolders`,
    `createEnrichment.folders`, `.summary`, `.writeBack`,
    `routes.libraryFolders`, `.folderScan`, `.importRoot`, `pickFolders`,
    `folderBridge`, `useLibraryFolders`, `FolderRow`, `FolderShapes`,
    `EnrichCheckCard`, `LibraryFolders` and its two siblings, `ImportFlow`'s
    two, `ImportSetup`, `EnrichmentSetup`, `LibrarySection`, `SettingsPage`,
    `App`): unchanged.
- **Prior art:**
  - `readableFolder.test.ts` and `routes.libraryFolders.test.ts`' sandbox for
    `admitFolder`'s suite.
  - `DECISION_REFUSALS` for the route's refusal table.
  - `useImportRun`, `useExport` and `useCapabilities` for the two hooks and
    their suites.
  - `CodecsPage.test.tsx` for the page's suite.
  - Issue 266's `seriesFormBody` round for a reader pinned in its own suite
    while the router keeps its leaves.
- **Coverage is otherwise sufficient.** Every log-30 ruling has a behaviour
  leaf: the overlap table (`folderOverlap`), the readings (`readableFolder`),
  both migrations (`db`), the list, the counts and the remove that keeps
  titles (`folders`), every route answer, both Already-in-library rules, the
  unreachable skip and the rescan (`createImporter.folderScan`), the four
  root cases (`sheetRoot`, `routes.importRoot`), the per-folder check,
  posters and sheets (`createEnrichment.folders`), the zero, one and several
  folder lines (`EnrichmentSetup`), the picker (`pickFolders`,
  `folderBridge`, `LibraryFolders.browse`), and the screen. Picking three
  folders in one native dialog, and a ticked scan ending in a Sync that
  writes a sheet into each folder, are the maintainer's own checks, as the
  plan accepted.

## Out of Scope

- **_1 titles_.** `FolderRow` draws `${titleCount} titles` because
  `mol.FolderRow.dc.html` does. A singular is a prototype amendment first,
  per _The prototype is the spec_.
- **One refusal line for Import setup and the folders page.** `ErrorLine`
  sits 6px under its field and `Refusal` 8px, each as its own prototype
  draws it.
- **Renaming the spreadsheet's `rootPath`** on the wire, in `startImport`, in
  `useImportRun` or in Import setup's caption. The field is still one path
  (log 30 Q34).
- **Moving the list `GET`'s reachable read out of the route.** It is two reads
  with no rule between them.
- **Splitting `createImporter`** beyond the two extractions. It holds one
  state machine as closures by design (CLAUDE.md, _Bulk Import_), and
  commits 9–10 remove the duplication the second start brought.
- **A test for `fakeFolderBridge`.** `fakeUpdateBridge`, its twin, has none.
  Both are exercised by every suite that installs them.
- **Changing migration 6 or 7.** Both have shipped to a database. The
  carry-over's exact-path check (no case folding) matches how the importer
  wrote `library-root`.
- **Everything log 30 _Not built_ lists**: playing in place, watching,
  scanning on launch, a per-folder scan, loose top-level videos, Browse on
  Import setup, a sheet read from a Library folder.
- **Prettier-governed long lines in tests and imports**, and **lines past the
  measure that predate this initiative**. Each round rewraps its own.
- **Step 15 of the build order, and the Roadmap's Move the media folder.**

## Further Notes

- Commit descriptions stay under the one-line rule. For example, commit 3
  is _walkLibraryRoot becomes walkLibraryFolder_, commit 7 is _a title's
  recorded folder in one read_, commit 9 is _one import phase for both
  runs_, and commit 13 is _the add's rules leave the route_.
- Commits 7, 9, 10, 13, 14 and 15 name new units: `titleSource`,
  `importPlaced`, `claimRun`, `admitFolder`, `useKeyStored` and
  `useFolderScan`. If the subagent finds a name the codebase already uses for
  the same idea, it takes that one instead and records it in commit 20.
- Commit 13's `FolderAdmission` answers `LibraryFolder`, with `reachable:
true`, because a folder that just passed `readableFolder` is reachable. The
  route stops spreading it in.
- Commit 20's body closes 267 and 273 with this issue. No other commit body
  carries a closing keyword, and the journal lists follow-ups by bare
  number.
