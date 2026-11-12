# Plan: Export round trip, a backup that gives the library back whole

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/581

An **Export** gives the library back whole, uploaded after a Factory reset or
copied over a Library folder of videos, without ever erasing the newer
record a Library folder already holds. An Export row's Folder key is the
Library sheet's; an upload into a never-scanned Library folder first places
it by its own sheet; every **Doubled place** is named; Folder keys fold NFC
then lower case; and _Play_ on a show doesn't jump to a special. No second
reader, no second writer, no new screen. It settles all five findings of QA
ticket 580.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. No phase is
HITL:** no screen change, no client change, no prototype amendment, no
migration, no decision left open (the maintainer approved every
recommendation of log 61 in advance; this plan adds none). Every rule,
every log line and every name a phase needs is spelled below or in the
handoff's _Copy_ table, so no phase stops to ask.

- The phases are log 61's _Implementation Plan_ slices, two of them
  thinned: slice 3 into doubled art (phase 3) and one track per language
  (phase 4); slice 4 into the fold (phase 5) and the path cell under the
  matched name (phase 6).
- **Each finding starts from its own RED test** reproducing it (the
  ticket's baseline on `53241fbb`: 761 files green, no existing test
  catches any of them). Phase 8 (the documents) has no RED test; it is
  verified by its checklist and a green suite.
- **Each phase stays well under a 100k-token context.**
  `createImporter.ts` (~3.3k lines) and `routes/index.ts` (~3.5k lines) are
  large; a phase greps for the section it needs (`executeScan`,
  `readMetaSheet`, `const execute =`, `scannedAt`, `walkListed`, `Layout
warning`, `writeExport`, `exportBody`) and reads only that range.
- No test runs Electron, FFmpeg or TMDB. Disk units run over temporary
  directories the suite creates; scans and uploads run over the importer's
  fixture library copied into a temporary Library folder. An NFD folder
  name is written by the test with `'Amélie (2001)'`.
- **The Round trip** acceptance test stays green after every phase.
- The glossary already holds log 61's terms. The feature checklist's step
  44 row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: none. No migration. Paths stay relative.
- **Routes**: none added, none removed, no body change. The Export route
  builds `sourceFolders` with the rest of its content. No client changes.
- **Domains**: none added. `sourceFoldersOf` lives in import-export;
  `foldFolderKey` in media's `folderKeyOf`; `nextEpisodeOf` stays in
  library.
- **Key models**:
  - `sourceFoldersOf(titles: StoredLibraryTitles, folderId?: string) =>
Map<string, string>`, pure: each title recorded against a Library
    folder with a **Source folder**, by title id; only `folderId`'s titles
    when given, every folder's otherwise. A title in no Library folder is
    absent.
  - `createLibrarySheet` takes its folder's map from
    `sourceFoldersOf(titles, folderId)`; its interface (`touch`, `hold`,
    `release`, `flush`) is unchanged.
  - `ExportContent` gains `sourceFolders: ReadonlyMap<string, string>`,
    handed to `exportRows` as its `sourceFolderOf`. The Export's File plan
    names each Title folder by the row's key.
  - `foldFolderKey(key) = key.normalize('NFC').toLowerCase()`;
    `sameFolderKey(a, b)` compares two folds. Every Folder key comparison
    goes through it: folder to row (`matchRows`), a sheet's duplicate rows
    (`readSheet`'s `rowKey`) and the Export's numbering (`claimFolder`).
  - `resolvePathCell` takes the matched folder's name on disk and replaces
    the cell's first segment with it. Log 60's containment rule is
    unchanged.
  - `DoubledPlace = { place: 'poster' | 'backdrop' | 'season-poster' |
'still' | 'track'; season?: number; episode?: number; language?:
string; read: string; count: number }`. `FilmFolderScan`,
    `SeasonFolderScan` and `SeriesFolderScan` each gain `doubled:
DoubledPlace[]`. The reader holds no wording; the walk words it.
  - The Folder scan's per-folder placing (Meta rows read, matched by
    `matchRows`, placed, held titles filled) is one step, called by the
    Folder scan for every folder and by a sheet run for each walked folder
    whose `scannedAt` is `null` and which holds a Library sheet.
  - `nextEpisodeOf(episodes)` keeps its signature.
- **The rules**:
  - An Export row's `Folder` is the title's Source folder when it has one,
    else `Title (Year)` spelled. Its `Title` cell stays the title's own. Two
    keys equal by `foldFolderKey` are numbered `(1)`, `(2)`, … with today's
    `⚠ Two titles share the folder …` line. An Export reads no Library
    folder from disk.
  - A sheet run over an unscanned folder with a sheet: the folder's own
    sheet places its titles first, then the uploaded rows meet them as
    held titles. A cell a placed title lacks is a **Sheet fill**; a cell
    the two sheets disagree on is a **Sheet difference** in the **Review
    step**, _Yours_ being the folder's own record. A scanned folder, or one
    with no sheet, is as today. One run, one `✓ … complete` line, one trip
    to review. No new refusal on the import screen.
  - The Library sheet writer rewrites a folder's sheet only from a library
    that has read it, so the rewrite on _Finish_ keeps what review chose.
  - A role filled twice reads the first by name order, as today. A
    Subtitles folder (film or episode) reads one track per language, the
    first by name order. The Library sheet's path cells name the file read.
  - The Library sheet writes the disk's own bytes; Folder keys are never
    rewritten NFC.
  - `nextEpisodeOf`: the first part-watched episode of any season; else
    the first unwatched outside Season 0; else the first outside Season 0.
    A list holding only Season 0 episodes keeps today's rule over them; an
    empty list is `null`. The Series page and each Season page share it.
    Seasons are still drawn in number order; the Up next card's order is
    unchanged.
- **Copy** (the handoff's _Copy_ table, Layout warnings, never a Problem):
  - Poster or Backdrop: `⚠ Heat (1995) holds 2 posters,
heat-1995-POSTER.png read` (`backdrops` alike).
  - Season poster: `⚠ Tidewater (2018) Season 1 holds 2 posters,
poster.png read`.
  - Still: `⚠ Tidewater (2018) S01E02 holds 2 Stills, S01E02.png read`.
  - Track: `⚠ Heat (1995) holds 2 Dutch tracks, Dutch.srt read` (an
    episode's named by its tag, as the Still line).
  - Upload against the folder's own sheet: today's Sheet difference,
    _Yours | Spreadsheet_.
  - Unchanged: the Export's `⚠ Two titles share the folder …` line.

---

## Phase 1: The Export names Title folders by their Source folder

**User stories**: 1 to 11, 52

### What to build

`sourceFoldersOf` derives every title's Source folder from the library's
stored titles. The Library sheet takes its folder's map from it, its tests
green as they are. The Export route builds `sourceFolders` over every
folder and hands it through `ExportContent` to `exportRows`, so each row's
`Folder` and each Title folder in the Export folder name the title's Source
folder, while its `Title` cell keeps the library's title. A title in no
Library folder keeps its spelled key; two Library folders' titles on one key
are numbered with today's line. The new **Export round trip** acceptance
test sits beside the Round trip: a title renamed in the app is exported,
the library Factory reset, and the Export both uploaded and copied over a
Library folder of bare videos, each giving the library back equal with no
Problem. Demo: the ticket's Amélie repro (renamed, rated 7, TMDB id 194,
genres) comes back whole both ways.

### Acceptance criteria

- [ ] `sourceFoldersOf`: titles with and without a Source folder, limited
      to one folder and across all; a title in no Library folder absent.
- [ ] `createLibrarySheet`'s tests stay green over `sourceFoldersOf`.
- [ ] `writeExport`: a renamed title's row and Title folder are named by
      its Source folder, its `Title` cell the new name; a title with none
      is spelled `Title (Year)`.
- [ ] Two titles from two Library folders sharing one Source folder key
      are numbered `(1)`, `(2)` with the `⚠ Two titles share the folder …`
      line.
- [ ] The Export route's output carries Source folder keys, with no
      Library folder read from disk.
- [ ] The Export round trip test: the Amélie repro, uploaded after a
      Factory reset, has no Problem and every field back.
- [ ] The same Export copied over the bare videos and scanned comes back
      whole: no stray folder, no Orphaned row.
- [ ] The Round trip test stays green.

---

## Phase 2: An upload reads an unscanned folder's own sheet first

**User stories**: 12 to 25

### What to build

The Folder scan's per-folder placing is drawn out of `executeScan` into one
step. A sheet run calls that step for each walked folder never scanned
(`scannedAt` `null`) that holds a Library sheet, before it matches the
uploaded rows; the rows then meet those titles as held ones, giving Sheet
fills for cells a title lacks and Sheet differences, _Yours |
Spreadsheet_, for cells the two sheets disagree on. A scanned folder, or
an unscanned one with no sheet, is unchanged. Still one run, one complete
line, one review. The Library sheet is rewritten on _Finish_ only from a
library that has read it. Demo: the ticket's Heat repro (rated 5 and
exported, then rated 9 and hearted, Factory reset, the Export uploaded)
keeps 9 and its heart, review offers _Yours 9 | Spreadsheet 5_, and the
Meta sheet is not rewritten to 5.

### Acceptance criteria

- [ ] The Heat repro keeps 9 and its heart after _Finish_ with _Yours_.
- [ ] Review holds a Sheet difference _Yours 9 | Spreadsheet 5_.
- [ ] `Meta/familyflix-library.csv` still says 9 and the heart after
      _Finish_.
- [ ] An uploaded cell the folder's own sheet left blank fills as a Sheet
      fill.
- [ ] An upload into a scanned folder is unchanged.
- [ ] An upload into an unscanned folder with no Library sheet is
      unchanged.
- [ ] The run logs one `✓ … complete` line and reaches review once.
- [ ] The Folder scan's tests stay green over the shared step.

---

## Phase 3: A doubled poster, backdrop, Season poster or Still is named

**User stories**: 26 to 29, 33 to 36

### What to build

`readTitleFolder` keeps reading a role's first file by name order and now
reports each role filled more than once as a `DoubledPlace` with its count:
a title's poster and backdrop, a Season poster, a Still for one Episode
tag. The walk words each as a Layout warning beside the folder's other
Layout warnings, per the _Copy_ table. One file per role reports nothing,
so deleting the extra quiets the next scan. The Library sheet's path cells
keep naming the file read. Demo: a Title folder holding
`heat-1995-POSTER.png` and `poster.png` logs `⚠ Heat (1995) holds 2
posters, heat-1995-POSTER.png read`.

### Acceptance criteria

- [ ] Two posters, two backdrops, two Season posters and two Stills for one
      tag are each read first by name order and reported with their count.
- [ ] One of each reports nothing.
- [ ] A scan logs each Doubled place's line as the _Copy_ table spells it.
- [ ] A scan after the extra file is deleted logs no such line.
- [ ] The Library sheet's path cell names the file read.

---

## Phase 4: One track per language

**User stories**: 30 to 32, 37

### What to build

A Subtitles folder, a film's or an episode's, reads one track per
language, the first by name order; every further track of that language
is a `track` Doubled place, logged `⚠ Heat (1995) holds 2 Dutch tracks,
Dutch.srt read`. Demo: the ticket's merged Heat repro (`Dutch.srt` beside
`Nederlands.srt`, two posters, two backdrops, a doubled Season poster and
Still) holds `Dutch, English` and logs each doubled place.

### Acceptance criteria

- [ ] A film's two Dutch tracks give one Dutch track, the first by name
      order, and one line.
- [ ] An episode's Subtitles folder follows the same rule, its line naming
      the episode.
- [ ] Tracks of different languages are all read.
- [ ] The merged Heat repro holds `Dutch, English` and logs each doubled
      poster, backdrop, Season poster, Still and track.

---

## Phase 5: Folder keys fold NFC, then lower case

**User stories**: 38 to 40

### What to build

`foldFolderKey` is spelled once in `folderKeyOf` and `sameFolderKey`
compares two folds. `readSheet`'s duplicate key and the Export's
`claimFolder` fold by it too, so a folder copied from a Mac matches a row
Excel saved, two rows differing only in normalisation are one title, and
an Export claims NFC and NFD of one key as one. The Library sheet still
writes the disk's own bytes. Demo: an NFD `Amélie (2001)` folder matches an
NFC row.

### Acceptance criteria

- [ ] `folderKeyOf`: NFD and NFC of one name fold equal; case is folded;
      different names differ.
- [ ] `readSheet`: two rows differing only in normalisation give one
      `duplicate` skip.
- [ ] `exportRows`: two keys differing only in NFC/NFD are numbered as one
      key.
- [ ] A scanned NFD folder's Library sheet row keeps the disk's bytes.
- [ ] The Round trip test stays green.

---

## Phase 6: A path cell reaches the NFD folder

**User stories**: 41, 42

### What to build

`resolvePathCell` takes the matched folder's name on disk and resolves the
cell's first segment as that name, so an NFC cell in `matchRows` and
`pathCellFills` opens an NFD folder's files. The containment rule is
unchanged. Demo: the ticket's NFD Amélie repro (an NFD folder, an NFC Meta
row rated 7 with a Poster path cell) scans with rating 7, its poster, and
no Orphaned row.

### Acceptance criteria

- [ ] `resolvePathCell` under a matched folder's name replaces an NFC first
      segment with the disk's.
- [ ] The NFD Amélie repro scans with rating 7 and no Orphaned row line.
- [ ] Its path cells' files are reached.
- [ ] A cell naming another folder is still refused as an Unread cell.

---

## Phase 7: Play skips specials

**User stories**: 43 to 49

### What to build

`nextEpisodeOf` offers the first part-watched episode of any season, else
the first unwatched outside Season 0, else the first outside Season 0; a
list of only Season 0 episodes keeps today's rule. The Series page and each
Season page keep calling the one rule; nothing on screen moves. Demo: the
ticket's show (S01E01 and S01E02 watched, one special) offers _Play
S01E03_.

### Acceptance criteria

- [ ] The ticket's show offers S01E03.
- [ ] A part-watched special is offered.
- [ ] Every regular episode watched offers the first regular episode.
- [ ] A specials-only list (the Season 0 page, a show of specials alone)
      keeps today's rule.
- [ ] An empty list gives `null`.
- [ ] The series read's `next` and each season's `next` agree.

---

## Phase 8: The documents

**User stories**: 50, 51, 53 to 56

### What to build

The docblocks of `exportRows`, `writeExport`, `createLibrarySheet`,
`createImporter`, `readTitleFolder`, `folderKeyOf` and `nextEpisodeOf` say
what they now do, naming **Export round trip**, **Doubled place**,
**Folder key**'s fold and **Next episode**'s rule. The feature checklist's
step 44 row is written to what was built and stays 🔜 until the refactor.
The dev journal gains this step's entry. The glossary is checked against
what was built. CLAUDE.md is untouched. No em dash in any prose.

### Acceptance criteria

- [ ] Every listed docblock describes its unit's current behaviour.
- [ ] Step 44's row in `docs/feature-checklist.md` describes the build and
      stays 🔜.
- [ ] `docs/dev-journal.md` has a step 44 entry.
- [ ] `docs/ubiquitous-language.md` holds **Export round trip** and
      **Doubled place**, and its **Export**, **Folder key**, **Bulk
      import**, **Layout read**, **Layout warning** and **Next episode**
      match the build.
- [ ] CLAUDE.md is unchanged.
- [ ] The full suite is green, the Round trip and Export round trip tests
      among it.
