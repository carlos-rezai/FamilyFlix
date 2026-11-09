# Plan: Rebuild whole, every sheet field and series art

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/547

A Library folder gives its whole library back, and the **Library sheet** is a
true reading of its folder. A scan imports a series whole, art included; a
new title takes every **Sheet column** its **Row type** has; the sheet's
path cells come from a **Layout read** of each Title folder off the disk; a
path cell fills only a place the folder left empty; the importer runs the
**Layout fill**; the Show folder pick reads a show with the scan's own
reader; an **Orphaned row** is one Warning line; and a sheet catches up at
the next scan without ever overwriting a **New folder**'s. One acceptance
test, the **Round trip**, proves it.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** No phase is
HITL: no screen changes, no prototype amendment, no decision left open (the
maintainer approved every recommendation of log 59 in advance).

- The phases are log 59's _Implementation Plan_ slices, four of them
  thinned: slice 1 is split into a new series' art (phase 1) and a held
  series' empty art (phase 2); slice 2 into a new title's fields (phase 3)
  and a held title's fills (phase 4); slice 3 into the Export's File plan
  (phase 5) and the Library sheet's Layout read (phase 6); slice 5 into path
  cells for empty places (phase 8) and the Layout fill (phase 9); slice 7
  into the Orphaned-row line (phase 11) and the sheet's catch-up (phase 12).
- **Each finding starts from its own RED test** reproducing it (the QA
  ticket, 546, baseline: no existing test catches any of them).
- **Each phase stays well under a 100k-token context.**
  `createImporter.ts` (~2.7k lines) and `routes/index.ts` (~3.5k lines) are
  large; a phase greps for the section it needs (`scansOf`, `importShow`,
  `importMatch`, `planSheetFields`, `plannerFor`, `hold`, `release`) and
  reads only that range.
- No test runs Electron, FFmpeg or TMDB. Disk units run over temporary
  directories the suite creates; scans run over the importer's fixture
  library copied into a temporary Library folder.
- No migration: a series scanned under step 41 is repaired by a rescan
  (phase 2).
- The glossary already holds log 59's terms. The feature checklist's step 42
  row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: none. No migration. Paths stay relative; a series' art is
  copied into the Managed media directory like a film's.
- **Routes**: none change. No client changes.
- **Key models**:
  - `ShowScan` (import-export domain) gains `poster`, `backdrop` and
    `seasons: { number, poster }[]`; `ShowEpisode` gains `still`, by its
    Episode tag. `numberShow(series: SeriesFolderScan) => ShowScan` replaces
    `groupShows`; `showFolderOf` moves with it.
  - `readSeasonFolders(dir) => Promise<SeasonFolderScan[]>` (media domain),
    in number order, the one reader `readTitleFolder` and `readShowFolder`
    share.
  - Write types: `NewMovie.tmdbScore?`; `NewSeries.isFavorite?`,
    `NewSeries.tmdbScore?`; `NewEpisode.watched?`.
  - `LayoutPlace`: `poster | backdrop`, `season-poster`, `still`, `tracks`,
    `video`, each with its Folder key (and season, episode or Source file
    where it has one).
  - `PathCells { image(place, storedPath), tracks(place, subtitles),
video(place, storedPath) }`; `exportRows(movies, series, cells,
sourceFolderOf?)` stays pure and the one place a cell rule is spelled.
  - `filePlan(include) => { cells, files }`, the Export's **File plan**;
    `layoutCells(reads, root) => PathCells`, the Library sheet's **Layout
    read**, pure, planning nothing.
  - `ImporterDeps` gains `layoutFill`, wired at server startup as
    `createEnrichment` has it.
  - `LibrarySheet { touch, hold, release, flush }` is unchanged in shape.
- **The rules**:
  - The folder's reading wins; a path cell fills only an empty place; the
    `Video` cell is never read by an import.
  - The probe's Runtime wins; the sheet's only when the probe answers none.
    Only `Watched` marks watched; `In progress` is unwatched, at its start.
  - A title imported with a TMDB id has the Details state `synced`.
  - A held title's new fields fill only what is empty, never a _Yours |
    Spreadsheet_ difference; a `Favorite` `Yes` hearts, never unhearts.
  - The Video cell: a film's one loose video, an episode's Source file as it
    lies; the spelled Season folder only for an episode with none.
  - The Library sheet writer skips a New folder (`scannedAt` null) and an
    Unreachable one, and writes nothing when the bytes are equal.
- **Copy** (the handoff's _Copy_ table, one line each, never a Problem):
  - Layout fill during a scan: `↓ poster.jpg  →  Heat (1995)/Images/poster.jpg`;
    a folder it can't write is one Warning line.
  - Orphaned row: `⚠ Heat (1995) (1) is in the sheet but has no folder, left out`.
  - Hollow show: the existing
    `⚠ Hollow Show (2020) holds no video or Season folder, left out`.

---

## Phase 1: A scanned series brings its art

**User stories**: 6 to 14

### What to build

A series reaches the importer whole: the scan no longer flattens it into
Season scans, and `numberShow` numbers its Season folders as they stand
(episodes by tag, the folder's season winning, Unplaced and stray subtitles
as today), carrying the series' poster and backdrop, each Season poster and
each episode's Still by its tag. `groupShows` is retired; its tests move.
The importer copies every piece in with `media.copyIn`, whatever the Import
mode: the poster and backdrop on the new series, each Season poster once its
season has an episode, each Still on its episode as a picked Still. A copy
that fails is the show's one `failed` Problem. Demo: the ticket's
`Tidewater (2018)` repro scans to a series poster, a Season 01 poster and an
S01E01 Still.

### Acceptance criteria

- [ ] `numberShow` numbers a series' episodes as `groupShows` did, and
      carries its poster, backdrop, each season's poster and each episode's
      Still by tag.
- [ ] A scanned series holds its poster, backdrop, Season posters and
      Stills, copied into the Managed media directory in either Import mode.
- [ ] A scanned Still's Still source is `picked`.
- [ ] A Season poster is set only for a season holding an episode.
- [ ] A failed art copy is the show's one `failed` Problem.
- [ ] `groupShows` is gone and nothing imports it.

---

## Phase 2: A rescan fills a held series' empty art

**User stories**: 15 to 17

### What to build

A series already held is scanned again: its empty poster, backdrop, Season
posters and its held episodes' Stills are taken from its Title folder,
copied in as in phase 1, never replacing art it has (a Sync's or a hand
pick), with no review row. Demo: a series scanned under step 41 with no art
gets all of it from one rescan; a series with a picked poster keeps it.

### Acceptance criteria

- [ ] A held series with no art has its poster, backdrop, Season posters
      and held episodes' Stills filled by a rescan.
- [ ] Art a held series already has is never replaced.
- [ ] The fill adds no review row.

---

## Phase 3: A new title takes every sheet field

**User stories**: 18 to 28, 34, 35

### What to build

The write types and `LibraryStorage`'s `addSeries` and `addEpisode` take the
new fields. A new title imported from a Folder scan or _Import from
spreadsheet_ takes every field its Row type gives: a film's TMDB id, TMDB
rating and Runtime; a series' TMDB id, TMDB rating and Favorite; an
episode's Status and Runtime. Runtime comes from the probe, the sheet's only
when the probe answers none; only `Watched` marks watched, `In progress`
starts at the start. A title imported with a TMDB id is `synced`. Demo: the
ticket's repro (heart a series, mark S01E01 watched, Factory reset, _Scan
new folders_) keeps the heart and the Watched; a hand-written sheet with
`TMDB id 562` and `TMDB rating 7.8` keeps both.

### Acceptance criteria

- [ ] `addSeries` stores `isFavorite` and `tmdbScore`; `addEpisode` stores
      `watched`.
- [ ] A new film takes its TMDB id, TMDB rating and, with no probed
      runtime, its Runtime; a probed runtime wins.
- [ ] A new series takes its TMDB id, TMDB rating and Favorite.
- [ ] A new episode is watched only for `Watched`; `In progress` is
      unwatched with no resume position; it takes the sheet's Runtime when
      the probe answers none.
- [ ] A title imported with a TMDB id has the Details state `synced`.
- [ ] _Import from spreadsheet_ takes the same fields.

---

## Phase 4: A held title's empty fields are filled

**User stories**: 29 to 33

### What to build

`planSheetFields` gains the new fields as fills only: a TMDB id and TMDB
rating where the held title has none, a Runtime where it has none, a
`Favorite` `Yes` hearting a title not hearted, and an Episode row's
`Watched` marking a held unwatched episode, as a film's row does today. None
is drawn as a _Yours | Spreadsheet_ difference. Demo: a held film with no
TMDB id takes the sheet's; a hearted series stays hearted under a row
saying `No`.

### Acceptance criteria

- [ ] TMDB id, TMDB rating and Runtime fill only where the held title has
      none.
- [ ] `Favorite` `Yes` hearts; `No` never unhearts.
- [ ] An Episode row's `Watched` marks a held unwatched episode.
- [ ] No new difference row appears in review.

---

## Phase 5: The Export's cells through a File plan

**User stories**: 42 to 44, 46

### What to build

`exportRows` takes its path cells from a `PathCells` it is given, keyed by
`LayoutPlace`, not by spelled path. Today's planner moves out as
`filePlan(include)`, the Export's **File plan**, and `writeExport` calls
`exportRows` with it; the Export's sheet and files are unchanged. The Video
cell, in both sheets, is a film's one loose video and an episode's Source
file as it lies (`Severance (2022)/season 03/x.mkv`, case kept), the spelled
Season folder only for an episode with no Source file. Demo: an Export of
the fixture library is as before, its existing tests green unchanged.

### Acceptance criteria

- [ ] `exportRows`, given a fake `PathCells`, fills each cell with what it
      answers for that place.
- [ ] `filePlan` gives the Export's cells and planned files exactly as
      before; `writeExport`'s tests pass unchanged.
- [ ] An episode's Video cell is its Source file, case kept; one with no
      Source file has the spelled Season folder.
- [ ] A film's Video cell is its one loose video.

---

## Phase 6: The Library sheet reads its folders

**User stories**: 36 to 41, 45, 47, 48

### What to build

`layoutCells(reads, root)` answers the Library sheet's `PathCells` from the
**Layout read**: a poster or backdrop by its own name, Season posters,
Stills by tag, every track the `Subtitles/` place holds by its own name, a
Frame still blank. `createLibrarySheet` reads each recorded Title folder
with `readTitleFolder` before a write and passes the reads to `exportRows`;
a folder it can't read gives blank path cells and the rest of the row.
Demo: `Images/die-hard-1988-poster.jpg` is the sheet's Poster cell; the
user's own `Images/my-own-POSTER.jpg` is kept as the cell; a Frame still's
cell is blank.

### Acceptance criteria

- [ ] `layoutCells` answers images by their own names, Season posters,
      Stills by tag and tracks by name; a Frame still and an unread folder
      are blank.
- [ ] The Library sheet's path cells name the files on disk.
- [ ] An unreadable Title folder gives blank path cells and every other
      cell of its row.
- [ ] _Import from spreadsheet_ of a Library sheet finds its art through
      its cells.

---

## Phase 7: The round trip

**User stories**: 1 to 5

### What to build

The acceptance test: over the dev fixtures in a temporary Library folder, a
film and a series with every Sheet column filled (TMDB ids and ratings, a
heart, a Watched episode, art at every place) are written to their Library
sheet, the database is reset, and _Scan new folders_ is run. The rebuilt
library equals the original, and the sheet written when the run closes
equals the sheet the scan read, byte for byte. A second and third rebuild
give the same.

### Acceptance criteria

- [ ] The rebuilt library holds the same titles, fields, hearts, Watched,
      TMDB ids and ratings, and art.
- [ ] The sheet written at close equals the sheet read, byte for byte.
- [ ] A second and third rebuild give the same library and sheet.

---

## Phase 8: Path cells fill empty places

**User stories**: 49 to 52

### What to build

The importer reads a path cell only for a place the folder's read left
empty: a cell naming a file that is there fills a poster, backdrop, Season
poster or Still the read did not find, and adds a track the read did not
find. The folder's reading always wins; the `Video` cell is never read.
Demo: a sheet naming `Heat (1995)/heat.jpg` beside the video imports it as
the poster.

### Acceptance criteria

- [ ] A cell fills an image place the folder left empty.
- [ ] A cell adds a track the folder's read did not find.
- [ ] A cell never beats a file the folder's read found.
- [ ] The `Video` cell is ignored by every import.
- [ ] A cell naming a file that isn't there fills nothing.

---

## Phase 9: The Layout fill during a scan

**User stories**: 53 to 57

### What to build

`createImporter` gains the `layoutFill` dependency, wired at server startup
as `createEnrichment` has it, and runs it after each title it imports or
fills, film or series. Each file it writes is the Sync's own `↓` line in the
run's log; a folder it can't write is one Warning line and the run goes on.
A tidy folder writes nothing. Demo: the phase 8 case logs
`↓ poster.jpg  →  Heat (1995)/Images/poster.jpg` and the file lands in
`Images/`.

### Acceptance criteria

- [ ] A scan runs the Layout fill after each imported or filled title.
- [ ] Each written file is one `↓` line in the run's log.
- [ ] An unwritable folder is one Warning line; the run completes.
- [ ] A scan of a folder already in the layout writes nothing.

---

## Phase 10: One reader of a show, and hollow shows

**User stories**: 58 to 64

### What to build

`readSeasonFolders` reads a folder's Season folders in number order, shared
by `readTitleFolder` and `readShowFolder`; `readShowFolder` numbers with
`numberShow`, and `scansUnder` is retired. A picked Title folder reads its
Season folders and nothing else (`Season 1/` and `Extras/` silent); a
picked Season folder stands for its show; a picked folder of loose videos
answers them as Unplaced without descending. A Title folder whose Season
folders all hold no video is left out as `empty` with the existing Layout
warning; an empty Season folder beside full ones passes in silence. Demo:
`Season 1/` is silent in the pick; `Hollow Show (2020)` is one Layout
warning.

### Acceptance criteria

- [ ] `readSeasonFolders` answers Season folders in number order.
- [ ] A picked Title folder ignores `Season 1/` and `Extras/`.
- [ ] A picked Season folder answers its show; loose videos are Unplaced,
      subfolders not read.
- [ ] The pick and the scan number the same show identically.
- [ ] Season folders holding no video give the `empty` warning; one empty
      Season folder beside full ones passes in silence.
- [ ] `scansUnder` is gone and nothing imports it.

---

## Phase 11: The Orphaned-row line

**User stories**: 65 to 68

### What to build

A Folder scan logs one Warning line per Folder key its Library sheet holds
that no Title folder does, its Season and Episode rows with it:
`⚠ Heat (1995) (1) is in the sheet but has no folder, left out`. The row is
never a Problem in review, and the rewrite on close takes it out of the
sheet. Demo: renaming a Title folder and scanning shows one line for the old
key.

### Acceptance criteria

- [ ] One Warning line per orphaned Folder key, a series one line.
- [ ] No Problem in review for an Orphaned row.
- [ ] The sheet written on close holds no Orphaned row.

---

## Phase 12: The sheet catches up, and a New folder's sheet is safe

**User stories**: 69 to 74

### What to build

Every run that reaches review touches every Library folder its walk read,
not only those whose sheet it held, so a sheet a hard kill left behind
catches up at the next scan. The Library sheet writer compares the new bytes
with the file's and writes nothing when equal, and skips a New folder
(`scannedAt` null) as it skips an Unreachable one; the run that marks it
scanned writes it on close. Nothing rewrites at startup. Demo: a Factory
reset, the folder added back, a hand add into it: the sheet is unchanged
until the scan, then written whole.

### Acceptance criteria

- [ ] A run reaching review touches every folder its walk read.
- [ ] A rewrite with equal bytes leaves the file's mtime unchanged.
- [ ] A New folder's sheet is never written by a touch; the run that marks
      it scanned writes it on close.
- [ ] An Unreachable folder is skipped and caught up when reachable.
- [ ] Startup writes no sheet.

---

## Phase 13: The documents

**User stories**: 75 to 77

### What to build

The feature checklist's step 42 row is written to what was built; it stays
🔜 until the refactor. The docblocks of `numberShow`, `readTitleFolder`,
`readShowFolder`, `exportRows`, `filePlan`, `layoutCells`,
`createLibrarySheet`, `createImporter` and `planSheetFields` say what each
now does and name their glossary terms. The glossary is checked against the
built names and amended where the build moved off them. CLAUDE.md is
untouched.

### Acceptance criteria

- [ ] Step 42's row in `docs/feature-checklist.md` describes the build and
      is still 🔜.
- [ ] Every changed unit's docblock names **Round trip**, **Layout read**,
      **Path cells**, **Layout place**, **File plan**, **Orphaned row**,
      **Library sheet writer**, **Show folder read** or **Layout warning**
      as it uses them.
- [ ] `docs/ubiquitous-language.md` matches the built names.
- [ ] CLAUDE.md is unchanged.
