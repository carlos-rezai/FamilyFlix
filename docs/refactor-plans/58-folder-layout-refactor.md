# Refactor plan: Folder layout, the layout spelled once, one Title folder rule, the writers made by the composition root, and the docs that close step 41

> Source initiative: `folder-layout`, issue 533 (step 41).
> Shipped by issues 534 to 544: the spec rows and writers rule (534), the
> build slices 535 to 543, RED and GREEN each (`f07273fe` to `6982d5cd`),
> and the documents (544, `54586f51`).
> Design log: `docs/design-logs/58-folder-layout.md`.
> PRD: `docs/PRDs/58-folder-layout.md` (533). Plan:
> `docs/PRDs/58-folder-layout-plan.md`.
> This is the initiative's closing round. It ticks **Folder layout** and
> closes 533. Filed as issue 545.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`folder-layout` shipped every phase of its plan. A Library folder is read
by one layout: **Title folders** in the root named by their **Folder key**,
a film by its loose video, a series by its `Season NN` folders, art by role
in `Images/`, tracks by folder in `Subtitles/`. The one sheet of 22 **Sheet
columns** is written by the Export and by the **Library sheet writer** into
`Meta/`, and read back by Import from spreadsheet and by a Folder scan. The
**Layout fill** writes what a Title folder lacks after an add, an edit and a
Sync. Collections, shelves, loose shows, `splitCollections`,
`scanMovieFolder`, `writeBack` and the Write target toggles are gone.

At `54586f51` the full suite has **11377 tests across 719 files, all
passing** (one skipped). `tsc -b --force` is clean. `eslint src server
electron` reports 4 errors and 138 warnings; three of the errors are this
initiative's (below).

The design held. What is left is the shape a round built in nine slices by
four units at once (the reader in `media/`, the Export, the Library sheet,
the Layout fill) leaves behind: the layout's own names spelled in each unit
that reads or writes it, two seams pointed at the tests that the router's
own docblock rejects, and the leftovers of the shapes this initiative
retired. Every finding below was checked against the code at `54586f51`.
They fall into seven families.

### 1. The layout is spelled in every unit that touches it

- **`Season NN` is read in one place and spelled in two.** `readTitleFolder`
  holds the reading (`seasonNumberOf`, `isSeasonFolder`); `exportRows` and
  `fillLayout` each hold a private `seasonFolder(season)` that pads the
  number to two digits. The **Episode tag** and the **Folder key** each keep
  their reading and their spelling side by side in one media unit
  (`episodeTag` with `spellEpisodeTag`, `folderKeyOf` with `spellFolderKey`);
  the Season folder is the one layout name that doesn't.
- **`groupShows` re-exports the reading under a second name**:
  `export const seasonOf = seasonNumberOf`. `showFolderOf` and the client's
  drift guard read `seasonOf`; `placeShowFolder`, `readShowFolder` and
  `readTitleFolder` read `seasonNumberOf`. One rule, two names.
- **`seasonNumberOf` has no test of its own.** It is pinned only through the
  drift guard, which reaches it by the alias.
- **The layout's folder names are string literals in three units**:
  `'Images'`, `'Subtitles'` and `'Stills'` in `readTitleFolder` (five
  times) and `fillLayout` (five times), and as path text in `exportRows`'
  rows. `'Meta'` is spelled by the walk (`META`), `writeExport`
  (`META_FOLDER`) and `createLibrarySheet` (inside `LIBRARY_SHEET` and
  `TEMPORARY_SHEET`); `familyflix-library` by the walk (`SHEETS`, twice),
  `writeExport` (`SHEET_STEM`) and `createLibrarySheet` (twice).
- **The image role rule is written twice.** `readTitleFolder`'s
  `imageByRole` and `fillLayout`'s `artWrites` each fold a stem and test
  `endsWith(role)`, each with its own stem helper (`stem`, `stemOf`), so
  the reader and the writer could come to disagree on what is already a
  poster.
- **The track name rule is written twice.** `exportRows`' planner and
  `fillLayout`'s `trackWrites` each number a second track of one language
  `<Language> (2)` with their own counter, and `fillLayout` strips the
  suffix again with a regex of its own.
- **The path cell separator is a constant in three units**: `PATH_SEPARATOR
= '|'` in `exportRows`, `writeExport` and `readSheet`. It is a rule of the
  sheet, like `SHEET_COLUMNS`, and the writer and the reader must agree on
  it.

### 2. Two spellings of "a Title folder in a Library folder"

- `placeFilmFolder` tests that the video's folder lies directly in its
  listed Library folder with `relative(listed.path, dirname(dir)) !== ''`;
  `placeShowFolder` tests the same of the series' folder with
  `sourceFolder.includes(sep)`. Both then check `folderKeyOf`. Log 58 Q22
  is one rule: a **Source folder** is a Folder key one level under its
  Library folder.

### 3. The Collection's leftovers in the importer

- **`wholeFolders` and `wholeOf`** remember "each film Source folder before a
  **Collection folder** was split". No scan is split any more:
  `wholeFolders.get(scan.dir)` answers the very scan it was set from, and
  `candidateFolders(scans, wholeOf)` and the review's `wholeOf(candidate)`
  pass every scan through unchanged.
- **`addFoldersUnder`'s docblock** still counts "every shelf between it and
  its Library folder: `Drama/` counts". There are no shelves.
- **The sheet row filters are written twice each.** The sheet run and the
  Folder scan each filter `row.type === 'Movie' || row.type === 'Series'`
  inline; `readSheet` already holds that set as `TITLED`. Each also picks a
  series' Episode rows inline (`episodeRowsOf` in one, an anonymous filter
  in the other), comparing Folder keys with `.toLowerCase()` while
  `matchRows` compares them through its own `folded`.
- **`createImporter`'s dependencies are an inline object type.** Every other
  `create*` this initiative touched names its deps (`EnrichmentDeps`,
  `LayoutFillDeps`, `LibrarySheetDeps`).

### 4. Writers made where they are used, and seams pointed at the tests

- **`createApiRouter` builds the Layout fill itself**:
  `const layoutFill = createLayoutFill({ storage, media })`. Its docblock
  says the six domains are injected so "the composition root is now the
  only answer to what this app is composed of", and records that a default
  for the tests' sake was removed for that reason.
- **`createEnrichment` defaults its Layout fill**:
  `layoutFill = createLayoutFill({ storage, media })`, "unless a test hands
  its own". So the app holds two Layout fills, and the enrichment domain
  imports the import-export domain's factory rather than its type.
- **`createImporter` takes `librarySheet` as optional** and calls it through
  `librarySheet?.`, so a composition that forgets it holds no sheet in
  review and nothing says so. `main.ts` always passes it.

### 5. The change listener's wiring lives in the storage's index

- `createSqliteStorage` defines four touch wrappers inline (`onTitle`,
  `beforeTitle`, `onEpisode`, `onCrossing`) and writes `addMovie`,
  `addSeries`, `setSourceFolder` and `markScanned` as inline bodies beside
  them. The `changes/` unit holds the listeners and the folder reads the
  wrappers use, but not the wrappers.
- **`library.onChange.test.ts` lies at the root of `library/`**, the only
  suite there. Every other storage suite sits in its unit's folder
  (`enrich/`, `write/`, `settings/`), and `changes/` has no suite.

### 6. Small seams

- **`readShowFolder`'s private `folderScan`** reads a folder's loose videos
  and tracks with its own sort and filters: the same reading
  `readTitleFolder`'s private `filesIn` and `subtitlesIn` do.
- **`createLibrarySheet`'s `contentOf`** answers an inline object type, and
  its `recorded` helper filters `sourceFolder !== null` and then tests it
  again in the loop that follows.
- **`EnrichmentSetup` draws _Where it is saved_ with seven styled pieces**
  (`SavedRow`, `SavedGlyph`, `SavedText`, `SavedTitle`, `SavedLine`,
  `SavedPath`, `SavedBadge`) written into the setup's own styles, twice
  over in its JSX. The row it replaced, `WriteTargetRow`, was a unit of its
  own with a test. And its **Your library folders** line (`layoutPath`) is
  worded inline in the component, while every other line of setup is worded
  by `enrichmentView`.
- **`groupShows`** sets `const season = folderSeason` and reads
  `tag?.episode` before the `tag === null` test that guards it.

### 7. Comments, suites and documents

- **Docblocks edited mid-line and never rewrapped**: `walkLibraryFolder`'s
  (_A folder left out of the layout_ breaks early), `readTitleFolder`'s
  (_passed in silence_), `createLibrarySheet`'s (_through a temporary file_),
  `exportRows`' (two lines near 100 columns), `groupShows`'
  (`ShowScan`'s _in season, then episode order_), and `ShowMatch`'s
  `sheetEpisodes` line in `createImporter` (96 columns).
- **Em dashes this initiative wrote** in comments and suites, among them
  `readShowFolder`'s docblock, `orderedShutdown`'s new clause and the
  `describe` titles below.
- **The suite headers name the initiative four ways**: `58, Folder layout,
Phase 2: "…" (issue #535).`, `Log 58, Phase 9: "…" (issue #542).`,
  `58 — Folder layout, Phase 6: … (issue #539).` and `Log 58, Folder
layout, Phase 8: "…" (issue #541).`. Their `describe` titles take a comma
  (`folderKeyOf, a Title folder`), a colon (`fillLayout: …`) or an em dash
  (`readSheet — …`, `writeExport — …`). Scan new folders' round settled
  `54, Scan new folders, Phase N (issue #n): …` and a colon.
- **Three lint errors the round wrote**: `readSheet.oneSheet`,
  `writeExport.layout` and `writeSheet.test` each strip or expect the CSV's
  byte order mark with the character itself typed into a regex or string
  (`no-irregular-whitespace`), where the rest of the suite writes `﻿`.
  `library.onChange.test` adds a non-null assertion warning.
- **The documents**: the feature checklist's row and step 41 are still 🔜;
  README's server tree still names `scanMovieFolder` and `writeBack` and
  none of the new units; the release checklist walks no Library sheet, no
  scan after a Factory reset and no Layout fill.

## Solution

One round in eight groups, each commit leaving the suite green and the
typecheck clean:

1. **The layout spelled once.** A `seasonNumberOf` media unit holding the
   Season folder's reading and spelling; a `folderLayout` media unit
   holding the layout's folder and sheet names, the image role rule and the
   track name rule; the sheet's path separator beside `SHEET_COLUMNS`.
2. **One Title folder rule**, `placeTitleFolder`, under both place units.
3. **The importer without the Collection**: `wholeOf` gone, the row filters
   named, `ImporterDeps`.
4. **The writers made by the composition root**: one Layout fill injected
   into the router and the Sync, the Library sheet required by the
   importer.
5. **The change listener's wiring in `changes/`**, its suite beside it.
6. **Small seams**: one loose-file reading, the Library sheet's content
   named, a `SavedRow` unit and a worded layout line, `groupShows` tidied.
7. **Comments and suites** in one form.
8. **The docs that close step 41.**

No behaviour changes. No wire, schema, Settings, copy or prototype change.
The household sees nothing new.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [folder-layout] issue #545 …`, except where a commit is named
`test:` or `docs:`.

### Group 1: the layout spelled once

1. **`seasonNumberOf`, the Season folder read and spelled in one unit.**
   - A media unit `seasonNumberOf/`, in `folderKeyOf`'s shape: the
     `SEASON_FOLDER` pattern, `seasonNumberOf(name)`, `isSeasonFolder(name)`
     and a new `spellSeasonFolder(season)` (`Season 01`, `Season 00`,
     `Season 100`), each with a docblock in `folderKeyOf`'s voice.
   - Its test reads `SEASON_FOLDER_CASES` from `test-support/` for the
     reading, as the client's table test does, and pins the spelling
     (two digits, three when needed) and that a spelled name reads back as
     its number. Prior art: `folderKeyOf.test`, `episodeTag.test`'s
     spelling cases.
   - `readTitleFolder` imports the reading instead of declaring it;
     `placeShowFolder` and `readShowFolder` import from the new unit.
2. **`groupShows` drops `seasonOf`.** `showFolderOf` reads
   `seasonNumberOf`; the client drift guard imports `seasonNumberOf` from
   its unit, and its docblock and `seasonFolderCases`' name the server's
   reading by that name. Guarded by the drift guard and `groupShows.test`,
   unchanged in their assertions.
3. **`exportRows` and `fillLayout` spell Season folders through
   `spellSeasonFolder`**; their private `seasonFolder` helpers go. Guarded
   by `exportRows.files`, `writeExport.layout`, `fillLayout.test` and
   `createLayoutFill.test`.
4. **`folderLayout`, the layout's names.** A media unit `folderLayout/`
   holding what log 58 Q6 to Q10 name, each constant with a one-line
   docblock naming its glossary term: `IMAGES_FOLDER`, `STILLS_FOLDER`,
   `SUBTITLES_FOLDER`, `META_FOLDER`, `LIBRARY_SHEET_STEM`. Its test pins
   nothing about the constants; it lands with commit 6's functions. No
   caller yet; guarded by `tsc -b --force`.
5. **The readers and writers name the layout's folders through it.**
   `readTitleFolder`, `fillLayout`, `exportRows` (its path text), the walk
   (`META`, `SHEETS`), `writeExport` (`META_FOLDER`, `SHEET_STEM`) and
   `createLibrarySheet` (`LIBRARY_SHEET` and `TEMPORARY_SHEET` built from
   `META_FOLDER` and `LIBRARY_SHEET_STEM`). `LIBRARY_SHEET` keeps its value
   and its export, so `createLibrarySheet.test`'s pin of it still reads
   `Meta/familyflix-library.csv`. Guarded by `walkLibraryFolder.test`,
   `readTitleFolder.test`, `createImporter.metaSheet`, `writeExport.layout`,
   `createLibrarySheet.test`, `fillLayout.test`.
6. **One image role rule and one track name rule.**
   - `folderLayout` exports `endsInRole(filename, role)`: the stem, case
     folded, ends in the role (`heat-1995-poster.jpg` is a poster), and
     `spellTrackName(language, count)`: `English`, then `English (2)`;
     plus the one reading back, `trackLanguageOf(filename)`, that strips a
     `(n)` and reads the language as `fillLayout` does today.
   - Its test pins each, in log 58 Q8's and Q17's words: `poster.png` and
     `moviea-2012-poster.jpg` are posters, `POSTER.JPG` too (case folded),
     `posterior.jpg` is not; `English (2).srt` reads as English.
   - `readTitleFolder`'s `imageByRole` and `fillLayout`'s `artWrites` read
     `endsInRole`; `exportRows`' planner and `fillLayout`'s `trackWrites`
     number through `spellTrackName`; `fillLayout` reads existing tracks
     through `trackLanguageOf`. The two private stem helpers go. Guarded by
     the suites of commit 5 and `exportRows.files`.
7. **`SHEET_PATH_SEPARATOR` beside `SHEET_COLUMNS`.** `src/types/export.ts`
   exports it with a docblock carrying log 58 Q13's reason (the one
   separator no Windows filename can hold); `exportRows`, `writeExport` and
   `readSheet` import it and drop their own. Guarded by
   `readSheet.oneSheet`, `exportRows.files`, `writeExport.layout`.

### Group 2: one Title folder rule

8. **`placeTitleFolder`.** An import-export unit beside the two place units:
   `placeTitleFolder(folders, dir)` answers `{ folderId, sourceFolder }`
   for a folder lying directly in a listed Library folder and named by a
   **Folder key**, else `null`. Its test pins a Title folder in the root, a
   Title folder one level deeper, a year-less name, a folder under no
   listed folder, and a listed folder itself. Prior art:
   `placeFilmFolder.test`'s cases, which it inherits.
9. **`placeFilmFolder` and `placeShowFolder` build on it.** Each keeps its
   signature and answer; the two spellings of the depth test go. Guarded by
   `placeFilmFolder.test`, `placeShowFolder.test`, `routes.addMovieLinked`,
   `routes.addSeriesLinked`, unchanged.

### Group 3: the importer without the Collection

10. **`wholeFolders` and `wholeOf` go.** `candidateFolders` takes the scans
    alone; the review reads its candidate directly. `addFoldersUnder`'s
    docblock says what it adds now: a film's Title folder, a series' Title
    folder and each Season folder. Guarded by
    `createImporter.folderPicker`, `createImporter.linkReview`,
    `createImporter.folderLayout` and `createImporter.foundAgain`, whole.
11. **The sheet row filters named.**
    - `readSheet` exports `isTitleRow(row)` over its `TITLED` set, and
      `folderKeyOf` exports `sameFolderKey(a, b)`, the case-folded
      comparison `matchRows` already makes; `matchRows` reads it in place
      of `folded`.
    - `createImporter` declares one module-level `episodeRowsOf(rows, key)`
      and reads `isTitleRow` in both runs; the inline filters go.
    - Tests: `isTitleRow` gains a case in `readSheet.oneSheet`;
      `sameFolderKey` cases in `folderKeyOf.test`. Guarded otherwise by
      `createImporter.sheetRows`, `createImporter.metaSheet`,
      `matchRows.folderKey`.
12. **`ImporterDeps`.** `createImporter` names its dependencies as an
    exported interface, each with a one-line docblock (the Library sheet's
    moving off the parameter list). Types and docblocks only.

### Group 4: the writers made by the composition root

13. **`test: [folder-layout] issue #545 an idle Library sheet`.**
    `test-support/idleLibrarySheet/`: a `LibrarySheet` whose four methods
    do nothing and whose `flush` settles at once, for suites about
    something else, in `offlineTmdb`'s shape and docblock voice. Its test
    pins that it answers every method and holds nothing. Prior art:
    `offlineTmdb`, `fixedSlot`.
14. **`createImporter` requires its Library sheet.** `librarySheet` is no
    longer optional and is called without `?.`. Every suite that builds an
    importer passes `idleLibrarySheet()`, or its own double where it
    asserts holds and releases (the `metaSheet` suite). Assertions
    unchanged; every suite passes with the same count.
15. **`createEnrichment` takes the Layout fill it is given.** The default
    goes; `EnrichmentDeps.layoutFill` is required and its docblock names
    the composition root; the domain imports only the `LayoutFill` type.
    `main.ts` makes one Layout fill, after the media domain, and hands it
    over. Every suite that builds the domain passes
    `createLayoutFill({ storage, media })` over its own storage and media,
    which is what the default made. Assertions unchanged.
16. **`createApiRouter` takes the Layout fill.** A seventh argument, after
    `enrichment`; the router no longer builds one, and its docblock's
    paragraph on injection names the Layout fill and says the count is
    seven. `main.ts` passes the one it made in commit 15. Every suite that
    builds the router passes one, as commit 15's do. Guarded by
    `routes.layoutFill` and every route suite, assertions unchanged.

### Group 5: the change listener's wiring in `changes/`

17. **The touch wrappers move into `changes/`.** `Changes` answers
    `onTitle`, `beforeTitle`, `onEpisode` and `onCrossing` beside `touch`,
    plus `onCreated(write)` for a write answering the title it made
    (`addMovie`, `addSeries`); `createSqliteStorage` reads them and keeps
    only `setSourceFolder` and `markScanned` as bodies, each of which
    touches what no wrapper names (a title's folder before and after; a
    list of folder ids). The folder reads the wrappers need stay private
    to `changes/` where nothing else reads them. Guarded by
    `library.onChange.test`, unchanged.
18. **`test: [folder-layout] issue #545 the change suite in changes/`.**
    `library.onChange.test.ts` moves to `library/changes/changes.test.ts`,
    unchanged but for its import paths. No other change; the suite passes
    with the same count.

### Group 6: small seams

19. **One reading of a folder's loose files.** `readTitleFolder` exports
    `readLooseFiles(dir)`, the `FolderScan` of a folder's loose videos and
    tracks in name order (today's `filesIn` and `subtitlesIn`, joined), and
    reads its own film and Season folders through it; `readShowFolder`'s
    `folderScan` goes. Guarded by `readTitleFolder.test`, the
    `readShowFolder` suites and `routes.showFolder*`, unchanged.
20. **The Library sheet's content named.** `createLibrarySheet` declares
    `interface FolderContent` for what `contentOf` answers, and `recorded`
    narrows its titles once, so the loop after it reads `sourceFolder`
    without testing it again. Guarded by `createLibrarySheet.test`.
21. **`groupShows` tidied.** The `season` alias goes; the tag's `null` test
    comes before its number is read. Guarded by `groupShows.test`.
22. **`SavedRow`, the row of _Where it is saved_.** - `features/enrichment/SavedRow/`: `SavedRow({ glyph, title, line,
path?, badge })`, its styles moved from `EnrichmentSetup.styles` with
    their docblocks, and a test drawing the glyph, the two lines, the
    mono path when `path` is set and the badge. Prior art: the retired
    `WriteTargetRow` and its test, whose shape it takes less the toggle. - `EnrichmentSetup` draws its two rows through it. Guarded by
    `EnrichmentSetup.layout.test`, unchanged.
23. **_Your library folders_' line worded by `enrichmentView`.**
    `layoutLine(folders)` beside `scopeDescription`, with the three cases
    the setup's inline comment names (none, one, several) in
    `enrichmentView.test`; `EnrichmentSetup` reads it and its comment goes.
    Guarded by `EnrichmentSetup.layout.test`.

### Group 7: comments and suites

24. **The docblocks rewrapped** to 80 columns: `walkLibraryFolder`,
    `readTitleFolder`, `createLibrarySheet`, `exportRows`, `groupShows`'
    `ShowScan`, `createImporter`'s `ShowMatch.sheetEpisodes`. Older em
    dashes on lines only rewrapped are kept; the ones this initiative wrote
    (`readShowFolder`'s docblock, `orderedShutdown`'s flush clause) take a
    comma or a colon. Comments only.
25. **`test: [folder-layout] issue #545 the suites name their phases`.** - Every header this initiative wrote reads `58, Folder layout, Phase N
(issue #n): …`: 535 is Phase 2, 536 Phase 3, 537 Phase 4, 538 Phase
    5, 539 Phase 6, 540 Phase 7, 541 Phase 8, 542 Phase 9, 543 Phase 10.
    The quoted slice names go; the sentence after the colon says what the
    suite pins. - `describe` titles take a colon (`folderKeyOf: a Title folder`,
    `readSheet: the Folder cell`, `writeExport: the sheet in Meta`). - Em dashes this initiative wrote in suites take a colon or a comma. - Suites from earlier initiatives this one only amended keep their own
    first line. No code changes; every suite passes with the same count.
26. **`test: [folder-layout] issue #545 the suites lint clean`.** The three
    typed byte order marks are written `﻿`; the onChange suite (moved
    by commit 18) narrows with an `expect` and a guard in place of its
    non-null assertion. Assertions unchanged. Lint ends at 1 error.

### Group 8: the docs

27. **`docs: [folder-layout] issue #545 the docs know the layout`.**
    - **Feature checklist**: the row reads _Folder layout: one shape to
      scan, sync and export_, ✅, and step 41 goes ✅ with what shipped, in
      step 40's shape.
    - **README**: the server tree's `media/` lists `readTitleFolder` (one
      Title folder by the layout), `folderKeyOf`, `seasonNumberOf` and
      `folderLayout` in place of `scanMovieFolder`, and `walkLibraryFolder`
      reads _a Library folder → its Title folders, Layout warnings and
      `Meta/` sheet_; `import-export/` names `placeTitleFolder`,
      `createLibrarySheet`, `createLayoutFill` and `fillLayout`;
      `enrichment/` drops `writeBack`; `library/` names `changes`.
    - **Release checklist**: three smokes over a sandbox Library folder in
      the shell: rating a film rewrites `Meta\familyflix-library.csv`
      seconds later with its new Rating cell; a Factory reset then **Scan
      all folders** gives back every title with its ratings, hearts and
      Status; a Sync of a film with an empty `Images\` writes `poster` and
      `backdrop` there and leaves a `heat-poster.png` already present.
    - **Glossary**: **Season folder** names `seasonNumberOf` and
      `spellSeasonFolder`; **Folder layout** names the `folderLayout` unit;
      **Images folder**, **Subtitles folder** and **Meta folder** name their
      constants. The dialogue is a snapshot and stays.
28. **`docs: [folder-layout] issue #545 the journal`.** A newest-first entry
    in `docs/dev-journal.md`, in the last entry's shape: what shipped, what
    each group changed, where the round left the plan, what was
    deliberately not changed, the follow-ups (below). The commit closes 533
    in words, not with a keyword, and this issue with one.

## Decision Document

- **A layout name has one home, in `media/`.** Log 58 Q25 put the layout's
  reading in `media/`, the code that reads a Library folder's disk. Its
  names, and the two rules a reader and a writer must share (what is
  already a poster, what a second track is called), live there too, so the
  Export, the Layout fill and the Library sheet spell the layout the way
  the scan reads it. The import-export units already import `media/`
  (`episodeTag`, `folderKeyOf`); the reverse never happens.
- **`seasonNumberOf` is a unit of its own, named for its reading**, as
  `folderKeyOf` is: reading and spelling side by side. It leaves
  `readTitleFolder`, which reads it, because `placeShowFolder`,
  `groupShows` and the drift guard read it without reading a folder.
- **`groupShows`' `seasonOf` alias goes.** One rule, one name. The client's
  `readSeasonFolder` keeps its name: it is the mirror, as `readEpisodeTag`
  mirrors `episodeTag`, and renaming it is a client change for no gain.
- **The server's `readSeasonFolder(dir)` keeps its name.** It reads a
  folder off disk beside `readTitleFolder(dir)`; the client's
  `readSeasonFolder(name)` lives in another build target and a feature
  folder.
- **The sheet's separator joins `SHEET_COLUMNS` in `src/types/export.ts`**,
  as a rule of the sheet both targets may need, not a server constant.
  It is named `SHEET_PATH_SEPARATOR` there, since `types/` is shared.
- **`placeTitleFolder` is a unit, not a helper inside one place unit**: it
  is log 58 Q22's rule, both place units read it, and it has its own cases.
- **The Collection's leftovers go only where they are provably identity.**
  `wholeOf` answers the scan it was given in every run since
  `splitCollections` went. `guessedRow`'s fallback to the **Title guess**
  stays: the review's detail reads it for a folder name that may not be a
  Folder key.
- **The composition root makes every writer.** The router's docblock
  settled this for the six domains; the Layout fill and the Library sheet
  are writers the domains use, and a default made for tests is the seam it
  rejected. One Layout fill serves the router and the Sync, as one Library
  sheet serves the storage listener, the importer and the shutdown.
- **Suites pass the real Layout fill, not a double.** Over a test's storage
  it does what the default did (nothing, for a title with no **Source
  folder**), so no assertion can move. The Library sheet gets an idle
  double instead, because the real one starts a timer that a suite about
  something else should not own.
- **`createApiRouter` stays positional.** Seven arguments is one more than
  six; an options object would touch every router suite a second time, and
  is its own round.
- **The touch wrappers belong to `changes/`.** They are the rule of which
  write touches which folder; the storage index is wiring.
- **`SavedRow` is a feature unit, not a molecule.** It is the Sync's own
  row, as `WriteTargetRow` was; no other screen draws it. If one does, it
  graduates.
- **`errorCode` stays duplicated** in `fillLayout` and `writeExport`. Each
  is two lines inside a unit, there is no domain it fits (CLAUDE.md: no
  catch-all), and their answers differ in type.
- **Em dashes**: only those this initiative wrote, in comments and suites;
  no household copy changes.
- **Nothing on the schema, the wire, Settings, the prototype or any copy
  changes.**

## Testing Decisions

- **A good test asserts what a caller or the household sees**: the scan a
  folder reads as, the cells a row carries, the files an Export or a Layout
  fill writes, the sheet a change rewrites, the rows drawn. It never asserts
  which helper ran or how a harness is built.
- **The initiative's behavioural suites carry every refactor commit**:
  `folderKeyOf`, `readTitleFolder`, `walkLibraryFolder`, `groupShows`,
  `placeFilmFolder`, `placeShowFolder`, the `readShowFolder` suites,
  `readSheet.oneSheet`, `matchRows.folderKey`, `exportRows.files`,
  `writeSheet`, `writeExport.layout`, `createLibrarySheet`, `fillLayout`,
  `createLayoutFill`, `library.onChange`, `createImporter.folderLayout`,
  `.metaSheet`, `.sheetRows`, `.seasonFolders`, `.series`,
  `createEnrichment.layoutFill`, `routes.layoutFill`,
  `routes.addMovieLinked`, `routes.addSeriesLinked`,
  `enrichmentBody.noWriteTargets`, `orderedShutdown`,
  `EnrichmentSetup.layout`, `ExportModal`, the drift guard and
  `readSeasonFolder`. Groups 1 to 3 and 5 to 7 change no assertion.
- **New tests**: `seasonNumberOf` (commit 1), `folderLayout`'s two rules
  (commit 6), `placeTitleFolder` (commit 8), `isTitleRow` and
  `sameFolderKey` cases (commit 11), `idleLibrarySheet` (commit 13),
  `SavedRow` (commit 22), `layoutLine` (commit 23). Prior art:
  `folderKeyOf.test` and `episodeTag.test` for a reading and its spelling;
  `placeFilmFolder.test` for a place rule; `offlineTmdb`'s test for a
  test-support double; the retired `WriteTargetRow.test` for a row unit;
  `enrichmentView.test` for a worded line.
- **Group 4 changes harnesses, not assertions.** A suite that must change an
  assertion to take an injected writer was relying on the default, and is
  named in the commit body with the reason.
- **Characterization before change.** A suite that has to change anywhere
  else than named here is reading an implementation detail, and is fixed in
  the same commit with the reason in the body.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at 1 error and 137
  warnings, or fewer.

## Out of Scope

Three gaps against log 58 surfaced while planning. Each changes behaviour,
so none belongs in a refactor; each is a `fix:` issue of its own, named in
the journal:

- **The importer never runs the Layout fill.** Log 58 Q17 and the plan's
  Phase 9 say it runs after an import and a scan's import; only the add,
  the edit and the Sync call it.
- **The Library sheet's path cells can name files that are not there.** It
  plans its cells as an Export does, so a title holding a poster names
  `Images/poster.<ext>` even when the layout holds `heat-poster.png`, or
  before the Layout fill has written anything. Log 58 Q13: _a cell names
  only a file that is there in the layout._
- **The Sync's done summary still words the retired Write targets.**
  `writtenSummary` names _the sheet in your collection root_ and _a
  poster.jpg in each movie folder_ from `EnrichmentRun.written`, which the
  server now always sends as two `false`s; the spec reads _Saved to your
  library, each title folder, the sheet in Meta._ Retiring `written` from
  the wire belongs with that fix, not here.

Also out:

- **An options object for `createApiRouter`** (see the Decision Document).
- **`exportRows`' fourth positional argument** (`sourceFolderOf`): the
  Library sheet fix above reshapes how the sheet calls it.
- **A server-wide `errorCode`** (see the Decision Document).
- **Renaming the client's `readSeasonFolder`.**
- **Converting old-shape libraries, watching folders, merging two
  installs' sheets**, and everything else log 58 put out of scope.
- **The frozen `handoff-folder-layout/`.**

## Further Notes

- Group 1 is the round's reason to exist: the layout is the initiative's
  one idea, and today four units each hold a copy of it. Group 4 is its
  second: the router's own docblock forbids what two of its writers do.
- Order: commit 1 before 2 and 3; 4 before 5 and 6; 8 before 9; 13 before
  14; 15 before 16 (16 passes the Layout fill 15 made); 17 before 18; 24
  to 26 after every code commit, so they rewrap, rename and lint what
  stays (26 after 18, whose suite it fixes).
  Groups are otherwise independent.
- Group 4 is the round's largest diff by files (every suite that builds the
  importer, the Sync or the router), and its smallest by thought: one
  argument each. Each of its three commits is one domain, so a red suite
  points at one.
- Follow-ups for the journal, not this round: the three fixes above; an
  options object for `createApiRouter`; carried from Scan new folders, a
  discriminated library scope and `importPlaced`'s parameters as an object.
