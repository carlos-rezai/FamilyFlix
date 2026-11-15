# Plan: Rescan a folder, the Folder layout's names relaxed

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/617

_Scan all folders_ finds what the household drops into a **Library folder**
under the names they would naturally give it: a **Title folder** needs no
year (`Heat`, `Death Note`), and a **Season folder** is `Season N` with any
number of digits (`Season 1`). Every writer then agrees with the household's
spelling: the **Layout fill** and an **Export** write into the folder the
episodes actually lie in, and spell `Season 01` only where there is no folder
to go by. The **Library sheet** is unchanged. The spec is design log 64 and
the amended `docs/handoff/handoff-folder-layout/README.md`; no screen changes.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** Phase 7's walk in the shell is done by the agent itself on a real
disk, unattended, and is backed by an end-to-end importer test so the
acceptance never waits on a hand. No decision is left open: the maintainer
approved every recommendation of log 64 in advance, and this plan adds none.

- The phases are log 64's _Implementation Plan_ slices, thinned: slice 1
  into the yearless Title folder (phase 1) and the `Season N` read (phase
  2); slice 2 is phase 3; slice 3 into the Layout fill (phase 4) and the
  Export (phase 5); slice 4 is phase 6; slice 5 is phase 7.
- **Each phase starts from its own RED test**, except phase 7's documents
  (proved by its checklist and a green suite).
- **Phases 1 and 2 must not reach a release without phase 4**, or the Layout
  fill would make `Season 01/` beside a household's `Season 1/`. All seven
  land before the next `npm version`.
- **Every existing import, layout, export and sheet test stays green after
  every phase**, apart from the assertions the PRD retires (the `no-key`
  Left-out reason and its `isn't named Title (Year)` line), which are
  rewritten to the new rule in the phase that retires them.
- The dev fixture keeps its full spellings; CLAUDE.md is untouched. The
  glossary, checklist and handoff were done in the grill-me; the feature
  checklist's step 47 row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: no migration. No stored field changes shape; a title's `year`
  is already nullable.
- **Routes**: none new, none changed. No wire type, page or setting.
  _Scan all folders_ and _Scan new folders_ run the one relaxed walk.
- **Sheet**: no column, row type or dialect changes. `Folder` is the folder's
  own name; `Year` is the title's year, blank until a Sync fills it. Every
  sheet already written reads exactly as before.
- **Key models**:
  - `FolderKey { name; title; year: number | null }`. `folderKeyOf(name)`
    always answers: ` (YYYY)` at the end reads that year; ` (YYYY–)`,
    ` (YYYY-)`, ` (YYYY–YYYY)` and ` (YYYY-YYYY)` read the first year; any
    other name is the title verbatim with year `null`. No title guess.
  - `spellFolderKey(title, year: number | null)` spells the bare title for
    `null`; it is the one speller (the sheet reader's `spelledKey` and the
    Export's `folderKeyName` go).
  - `seasonNumberOf` reads `Season N`, any digits, case folded; `Season 0`
    holds the specials. `spellSeasonFolder` still spells `Season 01`. The
    server's case table (`test-support/seasonFolderCases`) drives both it
    and the client mirror `readSeasonFolder`, under the existing drift
    guard.
  - `LeftOutReason = 'empty' | 'mixed'`; `no-key` is retired.
  - `DoubledWhere` gains `{ place: 'season'; season: number }`.
  - `seasonFolderOf(sourceFiles, season) => string`: a pure unit in the
    import-export domain answering the first path segment of the held
    episodes' **Source files**, else `spellSeasonFolder(season)`. It reads
    no disk.
  - `HeldSeasonFiles` gains `folder: string`; every season-scoped Export
    place carries `seasonFolder`.
- **The rules**:
  - The name is the title, and a year at the end is the year. Text after the
    bracket keeps the whole name as the title.
  - A Title folder is named in an Export by its Source folder, else
    `spellFolderKey`; two titles with one key are still numbered with a
    Warning line.
  - FamilyFlix never renames a folder, never warns that one lacks a year,
    and never writes a second spelling beside the household's own.
  - `Meta/`, an Export folder and system folders pass in silence.

---

## Phase 1: A yearless Title folder imported

**User stories**: 1, 3 to 12, 35 to 39, 43 to 46

### What to build

`folderKeyOf` relaxed to always answer, with a nullable year and the range
spellings. The `no-key` Left-out reason and its warning retired through the
Title folder read and the walk; `placeTitleFolder` drops its name check and
keeps its depth and listed-folder checks; the importer's guessed row takes
its title and year from the Folder key alone, so the review offers a folder
no row claimed its own name. Every caller of `folderKeyOf` that read a
`null` for a yearless name is brought along. Demo: drop `Heat/heat.mkv` into
a temp Library folder and a Folder scan imports _Heat_ with no year; a
rescan imports nothing twice.

### Acceptance criteria

- [ ] `folderKeyOf`: `Heat` reads title `Heat`, year `null`;
      `Heat (1995)` reads `Heat`, 1995; `Severance (2022–)`,
      `Severance (2022-)`, `Severance (2022-2025)` and
      `Severance (2022–2025)` read `Severance`, 2022;
      `Heat (1995) [1080p]` reads that whole name, year `null`; `(1995)`
      alone reads a defined key; `Die.Hard.1988.1080p` reads verbatim.
- [ ] `readTitleFolder` reads a yearless film folder as a film; no folder is
      left out as `no-key`; a genre shelf is still `empty` and a loose
      videos plus Season folders mix still `mixed`.
- [ ] `walkLibraryFolder` never words `isn't named Title (Year)`; the
      `holds no video or Season folder, left out` line is unchanged;
      `Meta/`, an Export folder, `$RECYCLE.BIN`,
      `System Volume Information` and dot folders stay silent; an
      Unreachable folder is still skipped with its Warning line.
- [ ] `placeTitleFolder` places a yearless folder in the root; a deeper
      folder and an unlisted one are still `null`, so a Path bridge add from
      `E:\Movies\Heat\heat.mkv` records `Heat` as its Source folder.
- [ ] The importer: a Folder scan over a temp Library folder holding `Heat/`
      imports _Heat_ with a null year, and `Heat` beside `Heat (1986)` is
      two titles; a second scan imports nothing twice; _Scan new folders_
      follows the same rule.
- [ ] A folder no sheet row claimed offers its own name (or the title before
      its year) as the title in review.

---

## Phase 2: `Season 1` read, on both sides

**User stories**: 2, 13 to 16, 40 to 42

### What to build

`seasonNumberOf` reads `Season N` with any digits, case folded, and
`isSeasonFolder` follows it. The shared case table gains the new rows and
drives the client's `readSeasonFolder` under the unchanged drift guard. The
Show folder pick and the movie form's numbering guess read the same rule.
Demo: a Folder scan over `Death Note/Season 1/` imports _Death Note_ with its
episodes numbered season 1.

### Acceptance criteria

- [ ] The case table: `Season 1`, `season 1`, `SEASON 1`, `Season 01` and
      `Season 001` are season 1; `Season 0` and `Season 00` are 0;
      `Seizoen 1`, `S01`, `Specials` and `Season 1 extra` are `null`.
- [ ] `seasonNumberOf` and the client's `readSeasonFolder` both pass the
      table; the drift guard is unchanged and green.
- [ ] `readTitleFolder` reads a yearless `Death Note/` holding `Season 1/` as
      a series with its season 1 episodes.
- [ ] The importer: a Folder scan of `Death Note/Season 1/` imports
      _Death Note_, null year, episodes in season 1.
- [ ] A Show folder pick of `Death Note/` numbers its episodes from
      `Season 1/`, and a pick of `Season 1/` itself stands for its series.
- [ ] The movie form's numbering guess off a `Season 1` folder says
      season 1.

---

## Phase 3: The doubled season

**User stories**: 17, 18

### What to build

The Title folder read takes the first Season folder of each number, by name
order, and reports the others as a `season` **Doubled place**, never
merging them. The walk words it as every other Doubled place line. Demo: a
show holding `Season 1/` and `Season 01/` imports one season 1 and the
Activity log names the other.

### Acceptance criteria

- [ ] `readTitleFolder`: `Season 01` and `Season 1` side by side read the
      first by name only, and report `{ place: 'season', season: 1 }` with
      its read folder and count 2.
- [ ] No two videos are numbered as one episode.
- [ ] `walkLibraryFolder` words
      `⚠ Death Note holds 2 Season 1 folders, Season 01 read`.
- [ ] One season folder per number raises no such line.

---

## Phase 4: The Layout fill writes into the household's season folder

**User stories**: 19 to 23

### What to build

`seasonFolderOf` answers a season's folder from its held episodes' Source
files. The Layout fill's composition builds `HeldSeasonFiles.folder` through
it, and `fillLayout` writes every season-scoped file (Season poster, Still,
episode track) under that folder and spells nothing itself. Demo: a Sync of
a `Season 1` show lands its poster in `Death Note/Season 1/Images/`, and the
next scan raises no warning.

### Acceptance criteria

- [ ] `seasonFolderOf`: the first episode's folder; a later episode's when
      the first has none; `Season 01` when none is recorded; a Source file
      with no folder segment skipped.
- [ ] `fillLayout` with a season whose `folder` is `Season 1` writes
      `Season 1/Images/poster.jpg`, `Season 1/Images/Stills/...` and
      `Season 1/Subtitles/S01E01/...`, and makes no `Season 01/`.
- [ ] A season with no episode in a folder is still spelled `Season 01`.
- [ ] The importer: a scan, a Layout fill, then a second scan of a
      `Season 1` show raise no doubled-season warning.

---

## Phase 5: The Export agrees

**User stories**: 24 to 30

### What to build

`exportRows` gives every season-scoped place (`season-poster`, `still`, an
episode's tracks and video) its `seasonFolder` through `seasonFolderOf`; the
File plan's season directory and `videoCell`'s fallback use it.
`spellFolderKey` takes a `null` year and replaces `spelledKey` and
`folderKeyName`. The Library sheet's cells are proved unchanged in shape.
Demo: an Export of a `Season 1` show lays its season art in
`Death Note/Season 1/`, beside its Video cells.

### Acceptance criteria

- [ ] `spellFolderKey('Heat', 1995)` is `Heat (1995)`;
      `spellFolderKey('Heat', null)` is `Heat`.
- [ ] `exportRows` and `filePlan`: a `Season 1` show's season poster, Stills
      and tracks are planned under `Death Note/Season 1/`, the folder its
      Video cells name.
- [ ] A title held from a folder named `Heat` lays out `Heat/`; a yearless
      title with no Source folder is named by its title alone, never
      `Heat ()`; two titles with one key are still numbered with a Warning
      line.
- [ ] The Library sheet's `Folder` cell for a yearless folder is its own
      name, `Year` is blank until a Sync fills it, and its path cells for a
      `Season 1` show name `Death Note/Season 1/...`.
- [ ] A sheet written before this change reads back exactly as before.

---

## Phase 6: The sheet matches a bare title

**User stories**: 31 to 34

### What to build

`matchRows` tries the row's Folder key first, as today. When no folder holds
it and the row has a year, it matches folders whose key folds equal to the
row's title alone, with the same `ambiguous`, `no-folder` and `no-video`
outcomes as any key. Demo: a hand-made `Heat`, `1995` row with no `Folder`
cell finds a folder named `Heat`.

### Acceptance criteria

- [ ] A `Heat`, `1995` row matches a `Heat` folder when no `Heat (1995)`
      exists.
- [ ] It matches `Heat (1995)` rather than `Heat` when both exist; the title
      is never tried when the spelled key exists.
- [ ] A row whose bare title matches two folders is `ambiguous`; one that
      matches none is `no-folder`; one folder with no video or several is
      `no-video`.
- [ ] A row without a year gets no fallback.

---

## Phase 7: The walk and the documents

**User stories**: 1 to 3, 11, 12, 19, 22, 24, 46 (proved end to end)

### What to build

Log 64's walk, done by the agent without a hand. First an end-to-end
importer test over a temp copy of the dev Library folder with `Heat/` and
`Death Note/Season 1/` added: _Scan all folders_ imports both; a Sync
through `fakeTmdb` fills their years, renames no folder, and writes the
show's art into `Season 1/`; an Export lays out the same folder names; a
second scan raises no new warning. Then the agent runs the shell on the dev
library itself (the `run` skill), drops the two folders in, presses
_Scan all folders_ and reads the Activity log, with no Sync needing a real
TMDB key. Any gap the walk finds is fixed in its phase's unit and its test
first. Then the docblocks of every unit above say what they now do, the
feature checklist's step 47 row is written to the build and stays 🔜, and
the dev journal gains this step's entry.

### Acceptance criteria

- [ ] The end-to-end test: both titles imported with null years, the Sync
      fills both years and renames nothing, the show's poster lies in
      `Death Note/Season 1/Images/`, no `Season 01/` exists, the Export's
      folders are `Heat/` and `Death Note/Season 1/`, and the second scan's
      log holds no new warning.
- [ ] In the shell, on the dev library, _Scan all folders_ imports _Heat_ and
      _Death Note_, and the Activity log holds no `isn't named` line.
- [ ] The docblocks of `folderKeyOf`, `seasonNumberOf`, `readSeasonFolder`,
      `readTitleFolder`, `walkLibraryFolder`, `placeTitleFolder`, the
      importer's guessed row, `seasonFolderOf`, `fillLayout`, `exportRows`,
      `filePlan` and `matchRows` describe their current behaviour.
- [ ] Step 47's row in `docs/feature-checklist.md` describes the build and
      stays 🔜; `docs/dev-journal.md` has a step 47 entry;
      `docs/ubiquitous-language.md` matches the build.
- [ ] CLAUDE.md is unchanged; no em dash in any prose.
- [ ] The full suite is green.
