# Refactor plan: Rescan a folder, season places that always carry their folder, one season read in the track read's shape, a matcher that says what it weighs, dead code out, and the docs that close step 47

> Source initiative: `rescan-a-folder`, issue 617 (step 47).
> Shipped by issues 618 to 624: six slices, RED and GREEN each (618 to
> 623), the gap fix under 620 (`9bb22cb8`), and the walk and documents
> (624, `0c8a9719`).
> Design log: `docs/design-logs/64-rescan-a-folder.md`.
> PRD: `docs/PRDs/64-rescan-a-folder.md` (617). Plan:
> `docs/PRDs/64-rescan-a-folder-plan.md`.
> Handoff: `docs/handoff/handoff-folder-layout/README.md` (amended).
> This is the initiative's closing round. It ticks **Rescan a folder** and
> closes 617. Filed as issue #625.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`rescan-a-folder` shipped every phase of its plan. Any folder in a Library
folder's root is a **Title folder** (`folderKeyOf` always answers, the year
`null` when the name carries none), `Season N` with any digits is a **Season
folder** on both sides of the drift guard, two Season folders of one number
are a `season` **Doubled place**, the **Layout fill** and the **Export**
write a season's files into the **Season folder name** its episodes lie in
(`seasonFolderOf`), and a hand-made sheet row `Heat`, `1995` finds `Heat/`.

At `0c8a9719` the full suite has **12253 tests across 816 files, all
passing** (one skipped). `tsc -b --force` is clean. `eslint src server
electron` reports **1 error and 140 warnings**: the 137 the row-view round
closed on, and 3 the build added, all in one test file.

The design held. What is left is what six slices built one after another
leave behind: a field every caller sets but every type calls optional, a
fallback kept in two places, a reader that round-trips a number through a
string, a variable whose name the build made untrue, a helper left with no
caller, a test fixture the shell ate, and the documents. Every finding
below was checked against the code at `0c8a9719`. They fall into six
families.

### 1. Season places that carry their folder as an option

- **`seasonFolder` is optional on every season-scoped place, and every
  place sets it.** `exportRows` builds each `season-poster` and `still`
  image place, each episode's tracks place and each episode's video place
  with its `seasonFolder`, read once per season by `seasonFolderOf`. No
  shipping code builds one without it; only `layoutCells.test`'s literal
  places do.
- **So the `Season 01` fallback lives twice.** `seasonFolderOf` answers
  `spellSeasonFolder(season)` when no **Source file** names a folder, and
  `exportRows`' exported `seasonFolderAt` answers it again for a place
  whose `seasonFolder` is missing, a case that never reaches it. Log 64 Q9
  made `seasonFolderOf` the one unit that answers a season's folder.
- **Two places are one shape with optional fields, the third a union.**
  `ImagePlace` is a union: a title's poster or backdrop, a season's poster,
  an episode's Still, each variant with exactly the fields it has.
  `TracksPlace` and `VideoPlace` are one interface each with `season?` and
  `episode?`, so `filePlan`'s `tracksDir`, `layoutCells`' tracks cell and
  `exportRows`' `videoPath` each test `season === undefined` and then
  rebuild a `{ folder, season, seasonFolder }` literal by hand to hand to
  `seasonFolderAt`. Two of those rebuilt lines run past 120 columns, inside
  template literals Prettier will not break. `walkLibraryFolder`'s
  `doubledWhere` already narrows the track Doubled place by `'season' in
place`.

### 2. A unit both callers feed the same way

- **`seasonFolderOf(sourceFiles, season)` is fed one way, twice.**
  `createLayoutFill` and `exportRows`' `seasonRows` each map the season's
  episodes to their Source files and pass the number beside them. Both
  hold the season itself, with its number and its episodes.
- **It splits on both separators where every other reader splits on one.**
  A Source file is stored with forward slashes (`sourceFileOf` joins on
  `/`, `placeShowFolder` spells `<season>/<video>`), and every other reader
  of a stored path (`createMedia`, `parentFolder`, `readSheet`) splits on
  `/` alone. `seasonFolderOf` splits on `/[/\\]/`.
- **Its test header and its docblock disagree on order**: the test says _in
  episode order_, the unit says _in the order given_. The library reads
  episodes by season and number, so both are true today; only one should
  be said.

### 3. A season read beside the track read, in another shape

- **`readSeasonPlaces` reads, groups and picks in one function.** It lists
  the Season folders by name, groups them by number through `groupedBy`,
  which keys by string, so it writes `String(seasonNumberOf(name))` and
  parses the key back with `Number`, sorts the groups by number, reads each
  folder and picks the first holding a video. Beside it,
  `oneTrackPerLanguage` does the same job for a Subtitles folder's tracks
  as a pure function over what was read: one per language, each extra a
  Doubled place. The season read is that rule over season scans, held a
  different way.
- **Its name says places; it answers seasons and their doubles.** The
  file's other readers are `readSeasonFolder`, `readSeasonFolders` and
  `readTitleFolder`, each named by what it reads.

### 4. A matcher variable the build made untrue

- **`matchRows`' `exact` is no longer exact.** Issue 623 renamed the key
  match `keyed` and kept `exact` for what follows: the keyed folders, or,
  for a row with a year that no folder's key names, the folders named by
  its bare title. Every verdict below it (`ambiguous`, `no-folder`,
  `no-video`) reads `exact`. The docblock says the rule; the loop does not.

### 5. Dead code and a fixture the shell ate

- **`yearInName` has no caller.** Issue 618 took `guessedRow`'s
  `titleGuess` and `yearInName` fallbacks out (the design log's journal
  entry asked for it); `titleGuess` still serves `readShowFolder`, but
  `yearInName` and its `YEAR_TAIL` pattern serve nothing, and no suite
  tests them. `createImporter.folderScan.test`'s header still says a film
  is named off its folder by `titleGuess` / `yearInName`.
- **`formValues.seasonGuess.test`'s Windows path lost its backslashes.**
  Written through a shell, `'E:\Series\Death Note'` is `E:SeriesDeath
Note`, and the video template `\${relativePath.replace('/', '\')}`
  escapes its own `${`, so every unplaced video is the same literal string.
  The cases pass because the reader numbers by `relativePath`, but the
  fixture is not the path it claims. These are the 3 lint warnings the
  build added (`no-useless-escape`). The memory rule _no backslashes via
  bash heredoc_ names the cause.

### 6. The documents

- **Docblocks call the name by the folder's term.** The glossary's new
  **Season folder name** is the name a held season's files are written
  under; `seasonFolderOf`, `HeldSeasonFiles.folder`, `fillLayout`,
  `exportRows`' season places and `filePlan` each call it the **Season
  folder**.
- **Two docblocks still state the old rules.** `placeShowFolder` says an
  episode's Source file is `Season NN/<video>` and its Title folder is
  _named by a **Folder key**_; `readSheet`'s `SheetRow.folder` says a blank
  Folder cell is spelled `Title (Year)`, where a `null` year spells the
  bare title.
- **One `filePlan` docblock line runs past 80 columns.**
- **The README misstates the season read** (line 54): it lists `Seizoen 1`,
  `Season 1 (2008)`, `S01` and `Specials` as read, which log 58 retired,
  and says nothing of the optional year. Its tree line for `folderKeyOf`
  says a name is _read as Title (Year)_.
- **The feature checklist's row reads _Rescan a folder_, 🔲 Planned**, and
  step 47 is 🔜. The release checklist has no smoke for a rescan.

## Solution

One round in seven groups, each commit leaving the suite green and the
typecheck clean:

1. **Season places that always carry their folder**: `TracksPlace` and
   `VideoPlace` become unions in `ImagePlace`'s shape, `seasonFolder` is
   required on every season-scoped variant, and `seasonFolderAt` goes.
2. **One name for an exported title's folder**: the planned key's two
   copies become one helper.
3. **`seasonFolderOf` takes the season**, splitting on `/` as every other
   stored-path reader does.
4. **One season read in the track read's shape**: `groupedBy` generic over
   its key, and a pure `oneSeasonPerNumber` beside `oneTrackPerLanguage`.
5. **A matcher that says what it weighs**: `foldersFor(row, folders)`.
6. **Dead code and a fixture**: `yearInName` out, the Windows path fixed.
7. **Comments and the docs that close step 47**, then the journal.

No behaviour changes. No wire, schema, route, setting, copy, prototype,
sheet column or drawn pixel changes; no Layout warning's words change; no
file is written anywhere it was not before.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [rescan-a-folder] issue #625 …`, except where a commit is named
`test:` or `docs:`.

### Group 1: season places that always carry their folder

1. **`TracksPlace` and `VideoPlace` become unions.** Each splits, in
   `ImagePlace`'s shape, into a film's variant (`kind` and `folder`) and an
   episode's (`folder`, `season`, `episode` for tracks; `folder`, `season`,
   `sourceFile` for a video), each still carrying its optional
   `seasonFolder` for now. `filePlan`'s `tracksDir`, `layoutCells`' tracks
   cell and `exportRows`' `videoPath` narrow by `'season' in place`, as
   `walkLibraryFolder`'s `doubledWhere` does, in place of the `undefined`
   checks. `exportRows`' film rows already build the film variants. Types
   and narrowing only. Guarded by `exportRows.test`, `filePlan.test`,
   `filePlan.seasonFolder.test`, `layoutCells.test`, the
   `createLibrarySheet` suites and `createImporter.rescanWalk.test`,
   unchanged.
2. **`seasonFolder` is required, and `seasonFolderAt` goes.** Every
   season-scoped variant (`season-poster`, `still`, an episode's tracks, an
   episode's video) carries `seasonFolder: string`. `filePlan`'s
   `seasonDir` takes the place and answers its folder and its
   `seasonFolder`; `videoPath` reads the place's `seasonFolder`; neither
   rebuilds a literal, and both long lines go. `exportRows` loses
   `seasonFolderAt` and its `spellSeasonFolder` import: the `Season 01`
   spelling is answered only by `seasonFolderOf`. `layoutCells.test`'s
   literal places gain `seasonFolder: 'Season 01'` (the folder its fixture
   holds); `layoutCells` itself reads none of it, as the sheet's cells come
   from the Layout read. Guarded by the same suites, assertions unchanged.

### Group 2: one name for an exported title's folder

3. **`titleFolderOf`, one planned key.** `exportRows` spells each title's
   folder twice, once for films and once for series, as
   `sourceFolders.get(id) ?? safeFolderName(spellFolderKey(title, year))`.
   A private `titleFolderOf(sourceFolders, id, title, year)` answers it,
   its docblock taking the sentence the export docblock holds today
   (_its Source folder, else its Folder key spelled, the bare title for a
   `null` year, made safe_). Guarded by `exportRows.test`,
   `filePlan.test`'s folder cases and the yearless export cases in
   `createLibrarySheet.yearless.test` and `rescanWalk`, unchanged.

### Group 3: `seasonFolderOf` takes the season

4. **`seasonFolderOf(season)`.** It takes `{ number, episodes }`, each
   episode carrying its `sourceFile`, which both `SeasonSummary` and the
   detail's seasons satisfy structurally, and reads the episodes in the
   order held, which the library reads by number; its docblock says so.
   It splits a Source file on `/` alone, as every stored path is read.
   `createLayoutFill` and `exportRows`' `seasonRows` pass the season they
   hold; their two maps go. `seasonFolderOf.test`'s cases are the same
   six, each passing a season built from the same Source files, and its
   header says _in the order held, by number_. Guarded too by
   `createLayoutFill.test`, `fillLayout.test`,
   `createImporter.seasonOneFill.test`, `filePlan.seasonFolder.test` and
   `rescanWalk`, unchanged.

### Group 4: one season read in the track read's shape

5. **`groupedBy` is generic over its key.** `groupedBy<T, K>(items,
keyOf: (item: T) => K): Map<K, T[]>`, first-seen order as before. The
   track and Still callers keep their string keys and need no change.
   Guarded by every `readTitleFolder` suite and `walkLibraryFolder`'s,
   unchanged.
6. **`oneSeasonPerNumber`, beside `oneTrackPerLanguage`.** A pure function
   over Season folder scans in name order: one per number, in number
   order, the first holding a video (the first when none does), and each
   number two or more scans hold as a `season` Doubled place, the read one
   first. It groups by `scan.number` with no string round trip. A private
   `readEverySeasonFolder(dir)` reads each Season folder in name order;
   `readSeasonFolders` answers `oneSeasonPerNumber`'s seasons over it, and
   `readTitleFolder` takes both its seasons and its doubles. `readSeasonPlaces`
   goes. Guarded by `readTitleFolder.doubledSeason.test` (the empty
   `Season 01/` beside `Season 1/` case from `9bb22cb8` among them),
   `readTitleFolder.seasonOne.test`, `readTitleFolder.seasonFolders.test`,
   `walkLibraryFolder.doubledSeason.test`, `readShowFolder.seasonOne.test`
   and `rescanWalk`, unchanged. `oneSeasonPerNumber` stays private, as
   `oneTrackPerLanguage` is, driven through the readers.

### Group 5: a matcher that says what it weighs

7. **`foldersFor(row, folders)`.** A private function in `matchRows`
   answering the folders a row weighs: those its **Folder key** names,
   folded; else, for a row with a year, those its bare title names; else
   none. Its docblock takes the fallback sentence from `matchRows`'
   docblock, which keeps one line pointing at it. The loop reads
   `const found = foldersFor(row, folders)`; `keyed` and `exact` go.
   Guarded by `matchRows.test`, `matchRows.bareTitle.test` and the sheet
   import suites, unchanged.

### Group 6: dead code and a fixture

8. **`yearInName` goes.** `titleKey` loses `yearInName` and `YEAR_TAIL`;
   `titleKey`, `titleGuess`, `stripTails` and `RELEASE_NOISE` stay. The
   header of `createImporter.folderScan.test` says a film is named by its
   **Folder key** (log 64), not by `titleGuess` / `yearInName`. Guarded by
   `titleKey.test` and the folder scan suites, unchanged.
9. **`test: [rescan-a-folder] issue #625 the Death Note path keeps its
backslashes`.** `formValues.seasonGuess.test`'s `DEATH_NOTE` is
   `'E:\\Series\\Death Note'` and each unplaced video is the show's path,
   a backslash, and its relative path with every `/` a backslash
   (`replaceAll`), the shape the file's earlier suites use. Written with
   the Edit tool, never through a shell. Its assertions are unchanged and
   still pass; `eslint` is back to 137 warnings.

### Group 7: comments and the docs

10. **Docblocks name what they hold.** **Season folder name** where a
    docblock means the name a season's files go under: `seasonFolderOf`,
    `HeldSeasonFiles.folder`, `fillLayout`, `exportRows`' season places and
    `seasonRows`, and `filePlan`'s, whose long line is rewrapped to 80
    columns. `placeShowFolder`'s docblocks say `Season N/<video>` and drop
    _named by a **Folder key**_. `readSheet`'s `SheetRow.folder` says a
    blank Folder cell is spelled by `spellFolderKey`, the bare title for no
    year. Comments only.
11. **`docs: [rescan-a-folder] issue #625 the docs know the rescan`.**
    - **Feature checklist**: the row reads _Rescan a folder: a year and
      `Season 1` optional_, ✅; step 47 goes ✅ in step 46's shape (_Built
      in issues 618 to 624; the closing round in issue #625_). Step 48
      stays ⬜.
    - **README**: line 54's season sentence says what is read: a Title
      folder named as the family wants to read it, its year optional, and
      `Season 1` as good as `Season 01`; `Seizoen`, `S01` and `Specials`
      come out. The tree line for `folderKeyOf` says _the Folder key: a
      Title folder's name, its year read off a trailing `(YYYY)`_.
    - **Release checklist**: one smoke after Keep originals', in the shell
      on a sandbox Library folder holding a copy of the importer fixture:
      drop in `Heat/heat.mkv` and `Death Note/Season 1/` with two episodes,
      press _Scan all folders_: both arrive with no year and no `isn't
named` line; Sync Death Note: its poster lands in `Death
Note/Season 1/Images/` and no `Season 01/` appears; a second scan
      adds nothing.
    - **Glossary**: checked against the round; **Season folder name**,
      **Folder key**, **Match** and **Export** already say what the code
      does. The dialogue is a snapshot and stays.
12. **`docs: [rescan-a-folder] issue #625 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last refactor entry's shape:
    what shipped before the round, what each group changed, where the
    round left the plan, the test count and lint against `0c8a9719`, and
    the follow-ups (below). The commit closes 617 in words, not with a
    keyword, and this issue with one.

## Decision Document

- **Every season-scoped place carries its Season folder name, required.**
  `exportRows` reads it once per season and hands it down; the places that
  carry no season (a film's tracks and video, a title's poster and
  backdrop) carry none. The `Season 01` spelling for a season with no
  Source file is `seasonFolderOf`'s alone.
- **`TracksPlace` and `VideoPlace` are unions** of a film's variant and an
  episode's, as `ImagePlace` already is, narrowed by `'season' in place`.
  `LayoutPlace` and `PathCells` keep their names and members.
- **`seasonFolderOf` takes a season**, typed structurally (`number`, and
  episodes with a `sourceFile`), so neither caller maps; it stays in
  `import-export/`, where log 64 Q9 put it and both its callers live. It
  splits on `/`, the separator every Source file is stored with.
- **The season read keeps its rule and changes its shape.** A pure
  `oneSeasonPerNumber` over Season folder scans, beside and in the shape of
  `oneTrackPerLanguage`; a private reader of every Season folder in name
  order; `readSeasonFolders` and `readTitleFolder` both over them.
  `groupedBy` is generic over its key type. The pick (the first by name
  holding a video, else the first) and the Doubled place's `read` and
  `count` are unchanged.
- **`matchRows`' fallback is named, not inlined.** `foldersFor(row,
folders)` is private; the verdicts read what it found.
- **`titleFolderOf` is private to `exportRows`.** `safeName` stays
  exported for `filePlan`; `safeFolderName` stays private.
- **`yearInName` is deleted, `titleGuess` kept**: the Show folder read
  still guesses a show's title off its folder.
- **`NewEpisode.sourceFile` stays `string | null`.** Issue 621 widened it
  in `videoFolderId`'s shape (_omitted or `null`, none_); both are read the
  same way by the series writer.
- **Nothing on the wire, the schema, the sheet, the Layout warnings, the
  prototype or any drawn pixel changes.**

## Testing Decisions

- **A good test asserts what lands on disk, in the sheet or in the run's
  log**: which titles a scan imports and with what title and year, which
  Layout warnings it words, which folder a poster or a Still is written
  into, what a Video cell names, which row matches which folder. It never
  asserts which helper ran or how a reader groups.
- **The initiative's suites carry every refactor commit**:
  `folderKeyOf.test`, `seasonNumberOf.test` and the `seasonFolderCases`
  drift guard; `readTitleFolder`'s `yearless`, `seasonOne`,
  `doubledSeason` and `seasonFolders` suites; `walkLibraryFolder.test`
  and its `doubledSeason` suite; `placeTitleFolder.test`,
  `placeFilmFolder.test`, `placeShowFolder.test`;
  `readShowFolder.seasonOne.test`; `createLayoutFill.test`,
  `fillLayout.test`; `exportRows.test`, `filePlan.test`,
  `filePlan.seasonFolder.test`, `layoutCells.test`;
  `createLibrarySheet.yearless.test`, `readSheet.legacy.test`,
  `matchRows.test`, `matchRows.bareTitle.test`; the importer's
  `yearless`, `seasonOne`, `seasonOneFill`, `importGuessed`,
  `folderLayout`, `doubledPlaces` and `rescanWalk` suites;
  `routes.addMovieLinked.test`; and the client's `readSeasonFolder.test`
  and `formValues.seasonGuess.test`.
- **No new suites.** `oneSeasonPerNumber`, `foldersFor` and
  `titleFolderOf` are private and driven through their units' public
  faces, as `oneTrackPerLanguage` and `resolvedRow` are.
- **Three suites change shape, not meaning**: `seasonFolderOf.test`
  passes seasons instead of arrays (commit 4), `layoutCells.test`'s
  literal places gain their `seasonFolder` (commit 2), and
  `formValues.seasonGuess.test`'s fixture holds the path it claims
  (commit 9). No assertion changes anywhere.
- **Prior art**: `oneTrackPerLanguage` for the season read's shape;
  `ImagePlace` and `doubledWhere` for the place unions and their
  narrowing; the row-view round for the commit-per-family rhythm.

## Out of Scope

- **_What the scanner accepts_** still reads `Movie Title (2019)` and
  `Season 01` (the build's journal follow-up). It matches the prototype,
  which log 64 left unchanged; teaching the optional year is copy, and
  copy is amended in a grill-me first.
- **The Show folder read's title guess.** `readShowFolder` still guesses
  a picked show's title by `titleGuess`, which strips a `(YYYY)` but not a
  range, so a picked `Severance (2022–)/` guesses _Severance (2022–)_
  where a scan reads _Severance_, 2022. Bringing the movie form onto
  `folderKeyOf` changes what a pick types into the form; it is a
  behaviour question for its own grill-me, filed as a follow-up.
- **Step 48, Missing videos**: the removal pass and left-out folders in
  review, as log 64 Q1 split them.
- **The client mirror of the Season folder rule** (`readSeasonFolder`):
  two readers under one drift guard is log 58's design.
- **Moving `seasonFolderOf` to `media/`**, or `spellSeasonFolder` out of
  it.
- **The glossary's dialogue and older per-log rows**, snapshots by the
  glossary's own convention.
- **The lint error and the 137 warnings** that predate the initiative.

## Further Notes

- **Commit 2 depends on commit 1**: the required field lands on the union
  variants commit 1 makes. Commit 4 can land before or after group 1;
  commit 6 needs commit 5.
- **Commit 9 is the only `test:` commit**, and it is green: the fixture
  was wrong, not the reader.
- **Follow-up to file with the journal entry**: the Show folder read's
  title guess against `folderKeyOf` (Out of Scope, second item).
