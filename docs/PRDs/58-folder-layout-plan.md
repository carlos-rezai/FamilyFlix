# Plan: Folder layout, one shape to scan, sync and export

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/533

Every title in a Library folder gets **one** layout, which the scan reads,
FamilyFlix fills and an Export writes; nothing else is read. A **Title
folder** `Title (Year)` lies directly in the root: a film holds one loose
video, `Images/` and `Subtitles/`; a series holds its own `Images/` and one
`Season NN` folder per season. One sheet of 22 **Sheet columns** replaces the
Titles and Episodes tables, and each root's `Meta/familyflix-library.csv`,
the **Library sheet**, is rewritten after every change so a Factory reset
followed by one scan gives the whole library back offline. The **Layout
fill** writes what FamilyFlix holds into the layout after every save and
Sync, never replacing a file. Anything else in the root is one **Layout
warning** line.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** No phase is
HITL.

- The phases are log 58's _Implementation Plan_ slices, three of them
  thinned: slice 3 is split into the scan reading a series (phase 3) and the
  hand add reading the layout (phase 4); slice 4 into the sheet written
  (phase 5) and read (phase 6); slice 7 into the Layout fill after a save
  (phase 9) and the Sync's (phase 10). The review hold moves from slice 5 to
  phase 8, where a run first reads a Library sheet.
- **The handoff is the spec.** `docs/handoff/handoff-folder-layout/`'s README
  trees are the layout; `feat.EnrichmentFlow`'s _Where it is saved_ and
  `feat.ExportModal`'s _Include_ descriptions are amended in place there and
  in `COMPONENT-SPEC.md` by phase 1.
- **Each phase stays well under a 100k-token context.**
  `createImporter.ts` (~2.5k lines), `routes/index.ts` (~3.5k lines),
  `createEnrichment.ts`, `COMPONENT-SPEC.md` and `FamilyFlix.dc.html` are
  large; a phase greps for the section it needs (`walkLibraryFolder`,
  `placeFilmFolder`, `groupShows`, `writeBack`, `readSheet`, `matchRows`,
  `EnrichmentSetup`) and reads only that range.
- No test runs Electron, FFmpeg or TMDB. Disk units run over temporary
  directories the suite creates; scans run over the importer's fixture
  library copied into a temporary Library folder.
- No migration: a title already held from an old-shape folder keeps playing
  from its stored path. Nothing converts a library.
- The glossary already holds log 58's terms. The feature checklist's step 41
  row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: none. No migration. `source_folder` is the Folder key, one
  level, relative to its Library folder; a film's `source_file` is never set;
  an episode's is its path inside the Title folder (`Season 01/<video>`).
- **Routes**: no new route.
  - `POST /api/enrichment` no longer takes `writeSheet` or `writePosters`;
    the Sync summary no longer carries a folder's Write target check.
  - `POST /api/export` writes the layout less videos with
    `Meta/familyflix-library.<csv|xlsx>`, whatever the Export name.
  - The import routes are unchanged in shape: _Import from spreadsheet_
    reads every row type; a Folder scan reads `Meta/`.
- **The layout** (the handoff README's trees):
  - Title folder: `^(.+) \((\d{4})\)$`, a series by its first year. One loose
    video and no Season folder is a film; Season folders and no loose video
    a series; both, neither, or no year is left out with a Layout warning.
  - Season folder: `Season NN`, two digits or more, case folded;
    `Season 00` the specials. `Season 1`, `Seizoen 1`, `S01`, `Specials` not
    read.
  - Images by role: a stem, case folded, ending in `poster` or `backdrop`,
    first by name order. Stills in `Season NN/Images/Stills/` by Episode tag.
    Tracks in `Subtitles/`, an episode's in `Season NN/Subtitles/S01E01/`,
    language by `detectSubtitleLanguage`. `Extras/` and anything else the
    layout doesn't name is passed in silence.
  - Silent root entries: `Meta/`, an Export folder (a folder holding
    `Meta/`), a name starting with `.` or `$`, `System Volume Information`.
- **Key models**:
  - `src/types/export.ts`: `ROW_TYPES` (`Movie`, `Series`, `Season`,
    `Episode`), `RowType`, `SHEET_COLUMNS` (the 22 Sheet columns in order,
    log 58 Q13), `SheetColumn`; `EXPORT_COLUMNS` and
    `EXPORT_EPISODE_COLUMNS` retired.
  - Media domain: `FolderKey { name, title, year }`,
    `folderKeyOf(name) => FolderKey | null` and its `Title (Year)` speller;
    `TitleFolderScan` (`film` | `series`), `SeasonFolderScan`;
    `LayoutWalk { titles, warnings, sheet }`.
  - `SheetRow` gains `type`, `folder`, `season`, `episode`, `airDate`,
    `runtime`, `tmdbScore`, `tmdbId`, `favorite`, `video`, `subtitles`,
    `poster`, `backdrop`, `still`.
  - `LibraryStorage.onChange(listener: (folderIds: string[]) => void) =>
unsubscribe`.
  - `LIBRARY_SHEET = 'Meta/familyflix-library.csv'`;
    `LibrarySheet { touch, hold, release, flush }`.
  - `LayoutFillOutcome { written, lines }`.
- **The sheet**: one table, rows A to Z by Folder key, then season, then
  number; path cells relative to the root holding the Title folder, forward
  slashes, several tracks joined by `|`; a cell blank where the type has no
  such field or it derives from the rows under it. CSV one file behind its
  BOM, xlsx one worksheet named `Library`. No resume position, Details
  state, Still source or Import mode.
- **The boundary**: the only writers into a Library folder are the Layout
  fill, which only ever adds, and the Library sheet writer, the one
  replacer, which only ever rewrites `Meta/familyflix-library.csv`. An
  Export only ever adds its own new folder. A Factory reset never writes a
  sheet.
- **Copy** (Layout warnings, one line each, never a Problem):
  - `⚠ Drama isn't named Title (Year), left out`
  - `⚠ Heat (1995) holds no video or Season folder, left out`
  - `⚠ Severance (2022) holds loose videos and Season folders, left out`
  - `⚠ 98 videos lie loose at the top of E:\Movies, left out`, one per
    Library folder.
  - Layout fill: `↓ poster.jpg  →  <path>`; one Warning line for a folder
    it can't write.

---

## Phase 1: The documents first

**User stories**: the spec of 70, 71 and 78

### What to build

Amend `COMPONENT-SPEC.md`'s `feat.EnrichmentFlow` row (_Where it is saved_:
_Your library_ _Required_, _Your library folders_ _Always_, no toggles, the
note always drawn) and its `feat.ExportModal` row (the _Include_
descriptions saying where each kind of file lands), as the handoff draws
them. CLAUDE.md's writers rule becomes the Layout fill and the Library sheet
writer, with the Export's own rule kept; its _Dev library_ line names the
fixtures in the layout. No code.

### Acceptance criteria

- [ ] `COMPONENT-SPEC.md`'s two rows match the handoff's amended
      prototype.
- [ ] CLAUDE.md names the Layout fill (only adds) and the Library sheet
      writer (only rewrites `Meta/familyflix-library.csv`) as the only
      writers into a Library folder, and an Export as only adding its own
      folder.
- [ ] CLAUDE.md's _Dev library_ line names the layout fixtures.

---

## Phase 2: One film in the layout

**User stories**: 1 to 16, 27 to 31, 85, 88 to 96, the film half of 97, 104
(films)

### What to build

`folderKeyOf` reads and spells `Title (Year)`. `readTitleFolder` reads a film:
one loose video under any name, art by role from `Images/`, tracks from
`Subtitles/` with their languages; a second loose video is the `no-video`
Problem (_more than one video_); `Extras/` is not read; `folder`, `cover`,
`fanart` and the first-image fallback are retired. It replaces
`scanMovieFolder`. The walk reads only the root's entries and answers
`LayoutWalk` with the Layout warnings, passing `Meta/`, Export folders and
system folders in silence; `sheet` is found but not yet read. The importer
logs the warnings. `placeFilmFolder` takes a Title folder or nothing, its
title straight off the Folder key with no Title guess, and never sets a
Source file; the Collection branch and `splitCollections` are retired. The
film fixtures move to the layout (`Die Hard (1988)/` with `Images/` and
`Subtitles/`, `Amelie (2001)/` off its shelf). Demo: `Die Hard (1988)/`
scans to a film with its poster, backdrop and two tracks, and `Drama/` is
one Warning line.

### Acceptance criteria

- [ ] `folderKeyOf` reads `Heat (1995)`; a year-less name, a range
      (`Severance (2022–)`), a release name and a trailing suffix answer
      `null`; spelling round-trips.
- [ ] `readTitleFolder` reads a film by one loose video; a second is _more
      than one video_; `Extras/` is not read.
- [ ] Images are read by a stem ending in `poster`/`backdrop`, case folded,
      first by name order; `folder`/`cover`/`fanart` and stray images are
      not read.
- [ ] Tracks are read from `Subtitles/` under any name, each with its
      language.
- [ ] The walk reads root entries only and logs each Layout warning's
      text, one loose-videos line per Library folder.
- [ ] `Meta/`, a folder holding `Meta/` and system folders pass in silence;
      nothing inside a Title folder the layout doesn't name warns.
- [ ] A scanned film's Source folder is its Folder key and its Source file
      is unset; a title held from an old shape still plays.

---

## Phase 3: One series in the layout

**User stories**: 17 to 26, the episode half of 97, 104 (shows)

### What to build

`readTitleFolder` reads a series: its own art in `Images/`, `Season NN`
folders (`Season 00` the specials), each with its loose videos in name
order, a Season poster from `Season NN/Images/`, Stills by Episode tag from
`Images/Stills/` and tracks by `S01E01` folder from `Subtitles/`. A folder
holding both loose videos and Season folders, or neither, answers its
left-out reason. `groupShows` numbers a series' Season folders; `seasonOf`
reads `Season NN` only; the loose-show branch is retired. Episodes number by
their Episode tag, the folder's season winning; a video no rule numbers, or
a second claiming one number, is Unplaced as today. `placeShowFolder`
records each episode's Source file as its path inside the Title folder. The
series fixtures move (`Tidewater (2018)/Season 01/`, each show with a
`Subtitles/S01E01/` track). Demo: `Tidewater (2018)/Season 01/` scans to a
series with its Season poster, a Still and an episode's track.

### Acceptance criteria

- [ ] A Title folder of Season folders and no loose video reads as a
      series; mixed and empty folders answer their left-out reasons.
- [ ] `Season 01` and `Season 00` are read, case folded; `Season 1`,
      `Seizoen 1`, `S01` and `Specials` are not.
- [ ] The Season poster, each Still by tag (`S01E01.jpg`,
      `severance-s01e01.png`) and each episode's tracks land on the right
      season and episode.
- [ ] Episode numbering takes the tag with the folder's season winning;
      untagged and duplicate videos are Unplaced.
- [ ] Loose tagged videos at a show's root are not read as a show.
- [ ] An episode's Source file is `Season NN/<video>`.

---

## Phase 4: The hand add reads the layout

**User stories**: 98 to 103

### What to build

A hand add of a video under a Library folder (the Path bridge) records a
Source folder only when the video lies in a Title folder of the layout;
otherwise it links with none and is in no sheet. The Show folder pick reads
the layout like the scan: its Season folders, each episode by its tag, its
Unplaced videos listed; a picked Season folder stands for its series; a
picked folder of loose tagged videos answers them as Unplaced. The client's
`readSeasonFolder` mirrors `Season NN`, its drift guard updated. Demo:
picking `Tidewater (2018)/` in the Movie form fills the same seasons and
episodes the scan finds.

### Acceptance criteria

- [ ] A video picked inside a Title folder records its Folder key as the
      Source folder; one picked elsewhere under a Library folder links
      with none.
- [ ] `readShowFolder` answers a picked Title folder's Season folders and
      episodes, and its Unplaced videos.
- [ ] A picked Season folder answers its series; a picked folder of loose
      tagged videos answers them as Unplaced.
- [ ] `readSeasonFolder` reads `Season NN` only, and the drift test passes
      against the server's rule.

---

## Phase 5: The Export writes the one sheet

**User stories**: 32 to 42, 72 to 79

### What to build

`SHEET_COLUMNS` and `ROW_TYPES` replace the two column lists. `exportRows`
answers one table of every row type in column and sort order, each row's
`Type` and `Folder` set, a Season row's `Season`, an Episode row's `Season`
and `Episode`, blanks where the type has no field, path cells relative with
forward slashes and `|`; it also answers the layout's file plan.
`writeSheet` writes one table: CSV behind its BOM, xlsx one worksheet named
`Library`. `writeExport` writes `Meta/familyflix-library.<csv|xlsx>` and a
Title folder per title carrying something, each file in its layout place
under the Layout fill's names, Frame stills included; `Video` names where
the video goes; a cell is blank when its file didn't travel; two titles
sharing a Folder key are numbered (`Heat (1995) (1)`) with a Warning line;
still made exclusively. `ExportDialog`'s _Include_ descriptions follow the
handoff. Demo: an export of the fixture library is one
`familyflix-library.xlsx` with Movie, Series, Season and Episode rows, and
its folders mirror the layout less the videos.

### Acceptance criteria

- [ ] `exportRows` answers Movie, Series, Season and Episode rows in
      `SHEET_COLUMNS` order, A to Z by Folder key then season then number.
- [ ] Count columns are gone; `Air date`, `Runtime`, `TMDB rating`,
      `TMDB id` and `Favorite` are filled; resume positions, Details state,
      Still source and Import mode are absent.
- [ ] Path cells are relative with forward slashes and several tracks join
      with `|`; a path cell names only a file that is there.
- [ ] CSV is one file behind its BOM; xlsx is one worksheet `Library`.
- [ ] The Export folder mirrors the layout less videos, with
      `Meta/familyflix-library.<ext>` whatever the Export name.
- [ ] A Folder-key clash is numbered with a Warning line; nothing outside
      the new Export folder is written.
- [ ] _Include_'s descriptions match the handoff.

---

## Phase 6: Import from spreadsheet reads the one sheet

**User stories**: 43 to 46, 83, 84, 105

### What to build

`readSheet` reads the one table, every row type, into `SheetRow`s with
their new fields; a sheet with no `Type` column reads every row as `Movie`;
no `Folder` column, or a blank cell, spells `Title (Year)` from Title and
Year. `matchRows` matches by Folder key first, exactly and case folded, never
by a fuzzy title; keeps `no-folder` and `ambiguous`; resolves a row's path
cells against the Library folder its key matched in. _Import from
spreadsheet_ brings a series' Season and Episode rows back. The fixtures'
`library.csv` and `library.xlsx` become the one sheet with Folder keys.
Demo: uploading the fixture `library.xlsx` brings back the series with its
episodes' fields.

### Acceptance criteria

- [ ] A round trip library → sheet → `SheetRow`s keeps every field, in CSV
      and xlsx.
- [ ] No `Type` column reads all Movies; no `Folder` column or a blank cell
      matches by spelled `Title (Year)`.
- [ ] Matching is by Folder key, case folded; a key no folder holds is
      `no-folder`, one two Library folders hold is `ambiguous`.
- [ ] Path cells resolve against the matched Library folder; an Export's
      sheet uploaded alone still brings its text fields.
- [ ] _Import from spreadsheet_ imports Season and Episode rows.
- [ ] The fixture sheets read through the new reader.

---

## Phase 7: The Library sheet

**User stories**: 47 to 55, 58 to 60

### What to build

`LibraryStorage.onChange` calls its listener with the Library folders
touched by every write that changes a sheet cell: an add, an edit, a
delete, Clear details, a Sync, an import, a scan, a rating, a heart, a
Status crossing; a watch tick that crosses no Status calls nothing.
`createLibrarySheet` debounces touches by a few seconds, then rewrites each
folder's `Meta/familyflix-library.csv` from the library through a temp file
in `Meta/` and a rename, behind its BOM, making `Meta/` when absent. It
holds the rows of every title recorded against that folder with a Source
folder; a Delete takes its rows out and leaves every file; a copied title is
in no sheet. An Unreachable folder is skipped and written when a change or
scan next finds it reachable. It is wired to `onChange` at server startup and
flushed by the Ordered shutdown; a Factory reset drops its pending work and
never writes a sheet. Demo: rating a film rewrites
`E:\Movies\Meta\familyflix-library.csv` seconds later with the new Rating.

### Acceptance criteria

- [ ] Each sheet-changing write calls `onChange` with its folders; a watch
      tick with no Status crossing does not.
- [ ] Many touches within the debounce make one write (fake timers).
- [ ] The rewrite lands by rename from a temp file in `Meta/`, behind its
      BOM; `Meta/` is made when absent.
- [ ] The sheet holds only that folder's titles with a Source folder; a
      deleted title's rows go and its files stay.
- [ ] An Unreachable folder is skipped, then written once reachable.
- [ ] `flush` writes every pending sheet, and the Ordered shutdown calls
      it.
- [ ] A Factory reset leaves a Library sheet byte-for-byte untouched.

---

## Phase 8: The scan reads `Meta/`

**User stories**: 56, 57, 80 to 82, 86, 87

### What to build

A Folder scan reads its Library folder's `Meta/` sheet (the `.csv` when
there, else the `.xlsx`) as that folder's sheet. A new title imports with
every field and art the sheet and its folder hold, ratings, hearts and
Status included, with no Sync; an `In progress` title starts at its start. A
held title's empty fields are filled; its differing values are held in
review as _Yours | Spreadsheet_. The importer calls `hold` on each Library
folder whose sheet the Current run read, and `release` when the run closes,
so the sheet is rewritten from the library then and a skipped difference
becomes the family's value. Demo: a Factory reset, then _Scan new folders_
on the same Library folder, gives back every title with its details,
ratings, hearts, Status and art.

### Acceptance criteria

- [ ] The scan reads `Meta/familyflix-library.csv`, else the `.xlsx`; a
      folder with neither scans as phase 3 left it.
- [ ] A Factory reset then a scan rebuilds every title with its Rating,
      Favorite, Status and art, offline.
- [ ] An `In progress` title comes back with no resume position.
- [ ] A held title's empty fields are filled; differing values are listed
      in review as _Yours | Spreadsheet_.
- [ ] A held folder's sheet is not rewritten during the run, and is
      rewritten from the library when the run closes.

---

## Phase 9: The Layout fill after a save

**User stories**: 61 to 67, 69

### What to build

`fillLayout` writes into a Title folder every file FamilyFlix holds whose
slot is empty, creating exclusively: `Images/poster.<ext>` and
`Images/backdrop.<ext>` only when no image there already ends in that role;
`Season NN/Images/poster.<ext>`; a Still as
`Season NN/Images/Stills/S01E01.<ext>` only when its Still source is `tmdb`
or `picked`, never a Frame still; a track as `Subtitles/<Language>.<ext>`
(an episode's under `Season NN/Subtitles/S01E01/`) only when no track of
that language is there, a second as `<Language> (2).<ext>`. A file already in
its slot is never replaced. A folder it can't write costs one Warning line
and never fails the save. It runs after an add, an edit, an import and a
scan's import, for a title with a Source folder in a reachable Library
folder; a title with no Source folder gets none. Demo: adding a poster to a
scanned film with an empty `Images/` writes `Images/poster.jpg`.

### Acceptance criteria

- [ ] An empty slot is written; an image already ending in the role is
      kept and nothing shadows it.
- [ ] A Frame still is never written; `tmdb` and `picked` Stills are.
- [ ] A second track of one language lands as `<Language> (2).<ext>`.
- [ ] An existing file is never replaced.
- [ ] An unwritable folder answers one Warning line and the save
      succeeds.
- [ ] A title with no Source folder, or in an Unreachable folder, gets no
      Layout fill.

---

## Phase 10: The Sync fills the layout

**User stories**: 68, 70, 71

### What to build

`createEnrichment` drops its Write targets: `enrichment/writeBack/`, its
check, `SHEET_NAME`'s `familyflix-metadata.csv` and the start body's
`writeSheet`/`writePosters` are retired. After each title's Sync it runs the
Layout fill and logs each file written as `↓ poster.jpg  →  <path>`. The
Sync's _Where it is saved_ draws _Your library_ (_Required_) and _Your
library folders_ (_Always_), no toggles, the note under the card always
drawn; `WriteTargetRow` goes. Demo: a Sync of a film with an empty `Images/`
writes `poster.jpg` and `backdrop.jpg` there and leaves a `heat-poster.png`
already present.

### Acceptance criteria

- [ ] `POST /api/enrichment` takes no Write target options and no
      `familyflix-metadata.csv` is written.
- [ ] A title's Sync logs a `↓` line per file the Layout fill wrote.
- [ ] An existing role image is left and no line is logged for it.
- [ ] _Where it is saved_ draws the two _Always_ rows with no toggle and the
      note always drawn.

---

## Phase 11: The documents

**User stories**: Q28

### What to build

The feature checklist's step 41 row is rewritten to what was built; it
stays 🔜 until the refactor. Every unit touched carries a docblock naming
its glossary terms. The glossary is checked against the built names and
amended where the build moved off them; the retired terms (**Collection
folder**, **Metadata sheet**, **Write target**, **Titles sheet**,
**Episodes sheet**) are gone or marked retired.

### Acceptance criteria

- [ ] Step 41's row in `docs/feature-checklist.md` describes the layout,
      the one sheet, the Library sheet and the Layout fill, and is still 🔜.
- [ ] `folderKeyOf`, `readTitleFolder`, `walkLibraryFolder`,
      `createLibrarySheet`, `fillLayout` and `exportRows` carry docblocks
      naming **Title folder**, **Folder key**, **Layout warning**,
      **Library sheet**, **Layout fill** and **Sheet columns** as they use
      them.
- [ ] `docs/ubiquitous-language.md` matches the built names.
