> **Initiative:** `folder-layout`
> **Issue:** #533 (the PRD, step 41)
> **Design log:** `docs/design-logs/58-folder-layout.md`
> **Handoff:** `docs/handoff/handoff-folder-layout/`
> **Build order:** step 41, **Folder layout**, the checklist's _Folder layout: one shape to scan, sync and export_. It ships as thin slices (log 58, _Implementation Plan_), the documents first. No migration: a title already held keeps playing from its stored path.

## Problem Statement

The family's folders carry their subtitles and art in subfolders the scan never opens: a `Subtitles/` folder beside the video, a folder per episode inside it, the art apart in an `Images/` folder. The walk stops at the first folder holding a video and reads only the files lying directly in it, so those subtitles and posters are never found. At the same time the scan reads half a dozen other shapes (genre shelves, release-named folders, Collection folders, loose shows, `Season 1`/`Seizoen 1`/`S01`), so there is no one rule to explain or test.

The sheet is two tables (Titles and Episodes), the Sheet reader reads only the first, so episodes never come back in, and no row carries an image, subtitle or episode. The Metadata sheet in a Library folder's root is written once and never again, so it goes stale the first time the family rates a film. An Export lays out folders in a shape a scan can't read back. A Library folder alone cannot rebuild the library: after a Factory reset or on a second machine, the maintainer must Sync everything again and the family's ratings, hearts and Status are gone.

## Solution

Every title in a Library folder has **one** layout, which the scan reads, FamilyFlix fills and an Export writes, and nothing else is read.

- A **Title folder** lies directly in the Library folder's root, named `Title (Year)` (a series by its first year). A film holds its one video loose, its art in `Images/` and its tracks in `Subtitles/`. A series holds its own art in `Images/` and one `Season NN` folder per season, each with its episode videos, an `Images/` for the Season poster and `Images/Stills/`, and `Subtitles/S01E01/` per episode.
- Images are read by role off the end of their names (`heat-1995-poster.jpg` is a poster); a subtitle's language off its name; an episode's track by the folder it lies in.
- **One sheet** of 22 **Sheet columns**, one row per Movie, Series, Season and Episode, each carrying its `Type` and its `Folder` (the **Folder key**), path cells relative into the layout. It replaces the Titles and Episodes sheets in CSV and xlsx alike, and Bulk import reads all of it.
- Each Library folder's root holds `Meta/familyflix-library.csv`, the **Library sheet**, rewritten a few seconds after any change to one of its cells, held while a review is open, never touched by a Factory reset. A Folder scan reads it, so a Factory reset followed by one scan gives back the whole library, ratings, hearts and Status included, offline.
- After any save or Sync, the **Layout fill** writes into a Title folder what FamilyFlix holds that the layout lacks (poster, backdrop, Season poster, Still, subtitle tracks), never replacing a file. The Sync's two Write target toggles go.
- An Export is the same layout less the videos, with its sheet in `Meta/`, so its folders copied over a Library folder of videos scan back whole.
- Anything in the root not in the layout is one **Layout warning** line in the Activity log, never a Problem.

## User Stories

### The Title folder

1. As the maintainer, I want a title read only from a folder lying directly in a Library folder's root, so that there is one place a title lives.
2. As the maintainer, I want a Title folder named `Title (Year)`, the title read straight off the name with no Title guess, so that what the family sees on disk is what they see in the app.
3. As the maintainer, I want a series named by its first year (`Severance (2022)`, never `Severance (2022–)`), so that every Title folder follows one pattern.
4. As the maintainer, I want two films sharing a title told apart by year, so that remakes each get their own folder.
5. As the maintainer, I want four films of a franchise to be four Title folders in the root, so that no Collection folder rule is needed.
6. As the maintainer, I want a year-less folder (`Heat`) not read, with a Warning line, so that I know to rename it.
7. As the maintainer, I want a Title folder holding one loose video read as a film, so that the folder's contents say what it is.
8. As the maintainer, I want a Title folder holding Season folders and no loose video read as a series, so that a show needs no marker file.
9. As the maintainer, I want a Title folder holding both a loose video and Season folders left out with a Warning line, so that an ambiguous folder is never guessed.
10. As the maintainer, I want a folder that reads the same with or without its sheet, so that the disk alone decides film or series.

### A film

11. As the maintainer, I want a film's one video lying loose under any name, so that release names keep working.
12. As the maintainer, I want a second loose video to be the `no-video` Problem (_more than one video_), so that a film folder is never split into a Collection.
13. As the maintainer, I want extras kept in an `Extras/` folder that is not read, so that a trailer never becomes a film.
14. As the maintainer, I want a film's poster and backdrop read from its `Images/` folder, so that art no longer has to lie beside the video.
15. As the maintainer, I want a film's tracks read from its `Subtitles/` folder, any file name, so that a subtitle no longer has to start with the video's name.
16. As the maintainer, I want a film never to have Stills, so that the layout holds nothing FamilyFlix doesn't read.

### A series

17. As the maintainer, I want a series' poster and backdrop read from its own `Images/`, so that the show's art sits at the show's root.
18. As the maintainer, I want a Season folder named `Season NN` (two digits or more, case folded), so that one spelling is read.
19. As the maintainer, I want `Season 00` to hold the specials, so that specials need no separate word.
20. As the maintainer, I want `Season 1`, `Seizoen 1`, `S01` and `Specials` no longer read, so that the rule is one sentence.
21. As the maintainer, I want an episode's video lying loose in its Season folder, numbered by its Episode tag (`S01E01`, `Episode 12`, `Aflevering 3`), the folder's season winning over the tag's, so that tagging stays as forgiving as today.
22. As the maintainer, I want a video no rule numbers, or a second claiming one number, to be Unplaced as today, so that I can number it by hand.
23. As the maintainer, I want a Season poster read from `Season NN/Images/`, so that each season can have its own art.
24. As the maintainer, I want an episode's Still read from `Season NN/Images/Stills/` by the Episode tag in its name (`S01E01.jpg`, `severance-s01e01.png`), so that Stills match episodes by tag, not by order.
25. As the maintainer, I want an episode's tracks read from `Season NN/Subtitles/S01E01/`, so that each episode's subtitles are in a folder of its own.
26. As the maintainer, I want loose tagged videos at a show's root no longer read as a show, so that every episode belongs in a Season folder.

### Images and subtitles

27. As the maintainer, I want an image whose stem, case folded, ends in `poster` to be the poster and one ending in `backdrop` the backdrop, so that names may carry the title and year.
28. As the maintainer, I want two images claiming one role settled by name order, so that the pick is predictable.
29. As the maintainer, I want `folder`, `cover`, `fanart` and the first-image fallback no longer read, so that there is one rule by role.
30. As the maintainer, I want anything else in `Images/` ignored, so that stray files never become art.
31. As the maintainer, I want each track's language read off its name (`English.srt`, `heat.pt.srt`), so that tracks show their language in the player.

### The one sheet

32. As the maintainer, I want one table with a row per Movie, Series, Season and Episode, so that one sheet describes the whole library 1:1.
33. As the maintainer, I want a `Type` cell on every row, so that a person and the importer both read what a row is.
34. As the maintainer, I want a `Folder` cell on every row holding the Folder key, a Season row adding `Season` and an Episode row `Season` and `Episode`, so that every row matches its folder exactly.
35. As the maintainer, I want a cell left blank where the type has no such field or its value is derived from the rows under it, so that the sheet never contradicts itself.
36. As the maintainer, I want the Seasons and Episodes count columns gone, so that the rows themselves are the count.
37. As the maintainer, I want `Air date`, `Runtime`, `TMDB rating`, `TMDB id` and `Favorite` in the sheet, so that a rebuild needs no second Sync and keeps the family's hearts.
38. As the maintainer, I want `Video`, `Subtitles`, `Poster`, `Backdrop` and `Still` as paths relative to the root holding the Title folder, with forward slashes, so that the sheet travels with the folder.
39. As the maintainer, I want several subtitle paths joined by `|`, so that the separator can never appear in a Windows filename.
40. As the maintainer, I want a path cell to name only a file that is there in the layout, so that the sheet never points at nothing.
41. As the maintainer, I want resume positions, the Details state, the Still source and Import mode left out of the sheet, so that it carries the library's facts, not FamilyFlix's bookkeeping.
42. As the maintainer, I want CSV and xlsx to share the one table (one `.csv`, one worksheet called `Library`), so that the format is only a container.
43. As the maintainer, I want a hand-made sheet with no `Folder` column, or a blank cell, matched by `Title (Year)` spelled from its Title and Year, so that a sheet I typed still imports.
44. As the maintainer, I want a sheet with no `Type` column read as all Movies, so that a sheet written before this step still imports.
45. As the maintainer, I want a key no folder holds to stay `no-folder`, and a key two Library folders hold to stay `ambiguous`, so that matching never guesses.
46. As the maintainer, I want rows matched by Folder key exactly, case folded, never by a fuzzy title match, so that the match is certain.

### The Library sheet

47. As the maintainer, I want each Library folder's root to hold `Meta/familyflix-library.csv`, so that the folder carries its own library.
48. As the maintainer, I want it to hold the rows of every title recorded against that Library folder with a Source folder, A to Z by Folder key, then season, then number, so that it diffs cleanly between rewrites.
49. As the maintainer, I want it rewritten a few seconds after any change that alters one of its cells (an add, an edit, a delete, Clear details, a Sync, an import, a scan, a rating, a heart, a Status crossing), so that the sheet never goes stale.
50. As the maintainer, I want a watch tick that changes no cell to write nothing, so that playback doesn't churn the disk.
51. As the maintainer, I want the rewrite to go through a temporary file renamed over the old one, so that a reader never meets half a sheet.
52. As the maintainer, I want the CSV written behind its BOM, so that Excel opens accents correctly.
53. As the maintainer, I want `Meta/` made when absent, so that the first change creates it.
54. As the maintainer, I want an Unreachable folder's sheet written the next time a change or a scan finds it reachable, so that an unplugged drive catches up.
55. As the maintainer, I want pending sheets flushed on shutdown, so that a change made just before closing is not lost.
56. As the maintainer, I want a Library folder's sheet held, not rewritten, while a Current run's review holds its values, so that the _Yours | Spreadsheet_ differences survive until I settle them.
57. As the maintainer, I want the sheet rewritten from the library when the run closes, so that a skipped difference becomes the family's value.
58. As the maintainer, I want a Factory reset never to rewrite a sheet, so that the one thing that can rebuild the library survives it.
59. As the maintainer, I want a Delete to take the title's rows out of the sheet and leave every file in its folder, so that FamilyFlix still deletes nothing outside the Managed media directory.
60. As the maintainer, I want a title added outside every Library folder (copied) to be in no sheet, so that the sheet describes only what lies in that folder.

### The Layout fill

61. As the maintainer, I want, after any save or Sync, every file FamilyFlix holds whose slot in the layout is empty written into the Title folder, so that the folder becomes the source of truth over time.
62. As the maintainer, I want the poster written as `Images/poster.<ext>` and the backdrop as `Images/backdrop.<ext>` only when no image there already ends in that role, so that my own art is never shadowed.
63. As the maintainer, I want a Season poster written as `Season NN/Images/poster.<ext>`, so that season art travels with the season.
64. As the maintainer, I want a Still written as `Season NN/Images/Stills/S01E01.<ext>` only when its Still source is `tmdb` or `picked`, so that a Frame still is never written into a Library folder.
65. As the maintainer, I want a track written as `Subtitles/<Language>.<ext>` (an episode's under `Season NN/Subtitles/S01E01/`) only when no track of that language is there, a second of one language as `<Language> (2).<ext>`, so that tracks never collide.
66. As the maintainer, I want a file already in its slot never replaced, whatever FamilyFlix holds, so that the Layout fill only ever adds.
67. As the maintainer, I want a folder that can't be written to cost one Warning line and nothing else, so that a read-only drive never fails a save.
68. As the maintainer, I want the Sync to log each file it writes as `↓ poster.jpg  →  <path>`, so that the Activity log says what landed where.
69. As the maintainer, I want a title linked with no Source folder (a hand add outside the layout) to get no Layout fill, so that FamilyFlix never writes beside a video it doesn't know the folder of.

### The Sync's _Where it is saved_

70. As the maintainer, I want the _Metadata sheet in the collection root_ and _Posters into each movie folder_ toggles gone, so that the sheet and the art are no longer choices.
71. As the maintainer, I want _Where it is saved_ to draw _Your library_ (_Required_) and _Your library folders_ (_Always_), with the note under the card always drawn, so that I see where a Sync writes.

### Export

72. As the maintainer, I want an Export folder to be the same layout less the videos, so that it merges back by copying folders.
73. As the maintainer, I want its sheet at `Meta/familyflix-library.<csv|xlsx>` in the Export format, whatever the Export name, so that an Export's folders merged into a Library folder are a Library folder.
74. As the maintainer, I want _Images_ on to carry every poster, backdrop, Season poster and Still, Frame stills included, each in its layout place, so that an Export is my full copy.
75. As the maintainer, I want _Subtitles_ on to carry every track in its layout place, so that tracks come back by folder.
76. As the maintainer, I want the Export sheet to carry every row of the library, its path cells naming the files that travelled, `Video` naming where the video goes, and a cell blank when its file didn't travel, so that the sheet is true of the Export folder.
77. As the maintainer, I want two titles sharing one Folder key numbered as today (`Heat (1995) (1)`) with a Warning line, so that the Export never overwrites one with the other.
78. As the maintainer, I want _Include_'s descriptions to say where each kind of file lands, so that I know the shape before I press.
79. As the maintainer, I want the Export still made exclusively and only ever adding its own new folder, so that an Export never touches anything else.

### The scan reads `Meta/`

80. As the maintainer, I want a Folder scan to read its Library folder's `Meta/` sheet as that folder's sheet, the `.csv` when there, else the `.xlsx`, so that the folder rebuilds its library offline.
81. As the maintainer, I want a new title to import with every field and art the sheet and its folder hold, with no Sync, so that a fresh install comes back whole.
82. As the maintainer, I want a held title's empty fields filled from the sheet and its differing values held in review as _Yours | Spreadsheet_, so that I decide every difference.
83. As the maintainer, I want _Import from spreadsheet_ to read every row type, episodes included, so that an uploaded sheet brings its series back.
84. As the maintainer, I want a row's path cells resolved against the Library folder its Folder key matched in, so that an Export's sheet uploaded on its own still brings its text fields.
85. As the maintainer, I want an Export folder lying in a Library folder's root passed by in silence, so that the Export destination's default never shows a warning.
86. As the maintainer, I want a Factory reset followed by _Scan new folders_ to give back every title with its details, ratings, hearts, Status and art, so that the Library folder is truly the library.
87. As the maintainer, I want each `In progress` title rebuilt at its start, so that the sheet never has to carry resume positions.

### What the scan does with everything else

88. As the maintainer, I want each root entry left out to be one Warning line, never a Problem, so that the review lists only titles to settle.
89. As the maintainer, I want `⚠ Drama isn't named Title (Year), left out` for a non-layout name, so that I know which folder to rename.
90. As the maintainer, I want `⚠ Heat (1995) holds no video or Season folder, left out`, so that an empty folder is explained.
91. As the maintainer, I want `⚠ Severance (2022) holds loose videos and Season folders, left out`, so that a mixed folder is explained.
92. As the maintainer, I want one line per Library folder for videos lying loose at its top (`⚠ 98 videos lie loose at the top of E:\Movies, left out`), so that a hundred loose files are one line.
93. As the maintainer, I want `Meta/`, a folder holding `Meta/` and system folders (a name starting with `.` or `$`, `System Volume Information`) passed in silence, so that the log carries only what I can fix.
94. As the maintainer, I want anything inside a Title folder the layout doesn't name (`Extras/`, `.nfo` files) passed in silence, so that a tidy folder never warns.
95. As the maintainer, I want a title already held from an old-shape folder to keep playing from its stored path, so that nothing breaks before I convert the library.

### What is recorded, and the hand add

96. As the maintainer, I want a title's Source folder to be its Folder key, one level, relative to its Library folder, so that a stored path always names a Title folder.
97. As the maintainer, I want a film's Source file never set, and an episode's to be its path inside the Title folder (`Season 01/<video>`), so that the records match the layout.
98. As the maintainer, I want a hand add of a video under a Library folder to record a Source folder only when the video lies in a Title folder of the layout, so that only layout titles get a sheet row and a Layout fill.
99. As the maintainer, I want a hand add outside the layout to link with no Source folder, so that it plays where it lies and is in no sheet.
100.  As the maintainer, I want the Show folder pick to read the layout like the scan (its Season folders, each episode by its tag, its Unplaced videos listed), so that a hand-added show and a scanned show agree.
101.  As the maintainer, I want a picked Season folder to stand for its series as today, so that I can pick either level.
102.  As the maintainer, I want a picked folder of loose tagged videos to answer them as Unplaced, so that I can number them by hand in the form.
103.  As the maintainer, I want the client's Season-folder reading to mirror the server's `Season NN`, guarded by the drift test, so that the form and the scan never disagree.

### Dev library and documents

104. As the maintainer, I want the dev fixtures moved to the layout (`Die Hard (1988)/` with `Images/` and `Subtitles/`, `Amelie (2001)/` with no shelf, `Tidewater (2018)/Season 01/`, each show a `Subtitles/S01E01/` track), so that the dev library exercises the one shape.
105. As the maintainer, I want the fixtures' `library.csv` and `library.xlsx` to be the one sheet with Folder keys, so that the dev sheet import exercises the new reader.
106. As the maintainer, I want `db:seed-series` left as it is, so that seeding, which writes no folder, isn't touched.

## Implementation Decisions

- **One initiative** (log 58 Q1), step 41. Not built: converting an existing library to the layout (a separate tool outside FamilyFlix), watching folders, two installs writing one Library folder at once (safe by the hold, but no locking or merging), any change to the Managed media directory's own layout.
- **One layout, no old shapes** (Q2). Before v1.0.0, so no migration; held titles keep their stored paths.
- **The prototype** (Q3): three amendments in place (`feat.EnrichmentFlow`'s _Where it is saved_, `feat.ExportModal`'s _Include_ descriptions, the model in `FamilyFlix.dc.html`) and the handoff README's trees, which are the layout's spec. Slice 1 amends `COMPONENT-SPEC.md`'s two rows.
- **Shared types** (log 58, _Types_): `ROW_TYPES` (`Movie`, `Series`, `Season`, `Episode`) and `RowType`; `SHEET_COLUMNS`, the 22 Sheet columns in order, and `SheetColumn`, replacing `EXPORT_COLUMNS` and `EXPORT_EPISODE_COLUMNS`. The column table in log 58 Q13 states which row types fill each column and what each cell holds.
- **`folderKeyOf`**, new and pure, in the media domain: `(name) => FolderKey | null`, `FolderKey { name, title, year }`, by `/^(.+) \((\d{4})\)$/`; and its spelling counterpart for `Title (Year)` from a title and year.
- **`readTitleFolder`**, new, in the media domain, replacing `scanMovieFolder`: `(dir) => TitleFolderScan | <left-out reason>`. A `film` scan carries `dir`, `key`, `videos`, `poster`, `backdrop`, `subtitles`; a `series` scan carries `dir`, `key`, `poster`, `backdrop`, `seasons: SeasonFolderScan[]` where each season has `number`, `videos` (absolute, name order), `poster`, `stills` (by Episode tag) and `subtitles` (by `S01E01` folder). Images by role off the end of the stem, case folded, first by name order; subtitles by folder, language by `detectSubtitleLanguage`.
- **`walkLibraryFolder`** (Q21): reads only the root's entries; answers `LayoutWalk { titles, warnings, sheet }`, the Layout warnings one per root entry left out (and one per Library folder for loose videos), `sheet` the `Meta/` sheet's absolute path or `null`. Passes `Meta/`, Export folders (a folder holding `Meta/`) and system folders in silence. Keeps `onFound` and `onUnreadable`.
- **`groupShows`** (Q7): numbers a series' Season folders; `seasonOf` reads `Season NN` only; the loose-show branch is retired. Episode numbering by `episodeTag` with the folder's season winning, Unplaced as today.
- **Retired** (Q25): `splitCollections`, the Collection branch of `placeFilmFolder`, the loose-show branch of `groupShows`, `enrichment/writeBack/` with its Write target check and toggles, `SHEET_NAME`'s `familyflix-metadata.csv`.
- **`placeFilmFolder`, `placeShowFolder`** (Q22): a Title folder or nothing; a film's Source file is never set; an episode's Source file is its path inside the Title folder.
- **`readShowFolder`** (Q23) reads the layout; the client's `readSeasonFolder` mirrors `Season NN`, its drift guard updated.
- **The hand add** (Q22): a Path bridge or Show folder pick under a Library folder records a Source folder only when the video lies in a Title folder of the layout; otherwise it links with none.
- **`exportRows`** (Q11, Q13, Q19): one table of every row type in `SHEET_COLUMNS` order, rows A to Z by Folder key then season then number, path cells relative with forward slashes, subtitle paths joined `|`; and the layout's file plan for an Export.
- **`writeSheet`** (Q11): one table; CSV one file behind its BOM, xlsx one worksheet named `Library`.
- **`readSheet`** (Q12, Q20): one table, every row type; `SheetRow` gains `type`, `folder` (the Folder cell, or `Title (Year)` spelled from Title and Year), `season`, `episode`, `airDate`, `runtime`, `tmdbScore`, `tmdbId`, `favorite`, `video`, `subtitles`, `poster`, `backdrop`, `still`. No `Type` column reads every row as `Movie`.
- **`matchRows`** (Q12): by Folder key first, exactly, case folded; keeps `no-folder` and `ambiguous`; path cells resolved against the matched Library folder.
- **`writeExport`** (Q19): `Meta/familyflix-library.<csv|xlsx>` and a Title folder per title carrying something, each file in its layout place and named as the Layout fill names it; Frame stills included; Folder-key clashes numbered with a Warning line. Still exclusive.
- **`LibraryStorage.onChange`** (Q15): `(listener: (folderIds: string[]) => void) => unsubscribe`, called by every write that changes a title's sheet row with the Library folders it touched. A watch tick that crosses no Status changes nothing.
- **`createLibrarySheet`**, new, in the import-export domain (Q14, Q16): `LibrarySheet { touch(folderIds), hold(folderId), release(folderId), flush() }`, `LIBRARY_SHEET = 'Meta/familyflix-library.csv'`. Debounced by a few seconds; rewrites through a temp file in `Meta/` and a rename; makes `Meta/`; skips an Unreachable folder and writes it when next reachable; a held folder waits until released, then rewrites from the library; `flush` writes every pending sheet. Wired to `onChange` in the server's startup beside the other domains, and flushed in the shell's shutdown.
- **`resetDatabase`** (Q16): never touches a Library sheet; the sheet writer's pending work is dropped, not flushed, on a Factory reset.
- **`fillLayout`**, new, in the import-export domain, replacing `writeBack` (Q17, Q25): `(root, title: HeldTitleFiles) => { written, lines }`. Creates exclusively; checks each slot by role (image), by language (track) and by Episode tag (Still); never a Frame still; one Warning line for a folder it can't write. Called after a save (add, edit, import, a scan's import) and after a title's Sync, for a title with a Source folder in a reachable Library folder.
- **`createImporter`** (Q20, Q21, Q16): the Folder scan reads `Meta/` as the folder's sheet (`.csv` else `.xlsx`), imports new titles with the sheet's fields and the folder's art, fills held titles' empty fields, holds differences in review, logs the Layout warnings, and calls `hold` on each Library folder whose sheet the Current run read, `release` when it closes. _Import from spreadsheet_ reads every row type.
- **`createEnrichment`** (Q17): no Write targets; calls the Layout fill after each title's Sync and logs its lines.
- **`EnrichmentFlow` setup** (Q17): _Where it is saved_ draws two rows, _Your library_ (_Required_) and _Your library folders_ (_Always_), no toggles, the note always drawn.
- **`ExportDialog`** (Q19): the _Include_ descriptions per the handoff.
- **The boundary** (Q18): CLAUDE.md's writers rule becomes _the **Layout fill**, which only ever adds what isn't there, and the **Library sheet writer**, the one replacer, which only ever rewrites `Meta/familyflix-library.csv`. An Export only ever adds its own new folder._ The _Dev library_ line names the moved fixtures.
- **Fixtures** (Q26): both moved to the layout, their `library.csv` and `library.xlsx` the one sheet with Folder keys. `db:seed-series` unchanged.
- **Names** (Q27): new **Folder layout**, **Title folder**, **Folder key**, **Images folder**, **Subtitles folder**, **Meta folder**, **Library sheet**, **Library sheet writer**, **Layout fill**, **Sheet columns**, **Row type**, **Layout warning**; updated **Source folder**, **Season folder**, **Show folder**, **Export folder**, **Export file**, **Sheet reader**, **Sheet writer**, **Library folder**; retired **Collection folder**, **Metadata sheet**, **Write target**, **Titles sheet**, **Episodes sheet**.
- **Slices** (log 58, _Implementation Plan_):
  1. the documents first: `COMPONENT-SPEC.md`'s two rows, CLAUDE.md's boundary and _Dev library_;
  2. one film in the layout: `folderKeyOf`, `readTitleFolder`'s film, the walk's root-only rule and Layout warnings, `placeFilmFolder`, the film fixture moved;
  3. one series in the layout: `readTitleFolder`'s series, `Season NN`, Stills, per-episode subtitle folders, `groupShows` and `readShowFolder` narrowed, the series fixture moved, `readSeasonFolder` mirrored;
  4. the one sheet: `SHEET_COLUMNS`, `exportRows`, `writeSheet`, `readSheet`, `matchRows` by Folder key; the Export writes the layout less videos with `Meta/`;
  5. the Library sheet: `LibraryStorage.onChange`, `createLibrarySheet`, the hold during review, the flush on shutdown, the Factory reset's exemption;
  6. the scan reads `Meta/`: the importer's sheet from `Meta/`, path cells resolved, differences held in review;
  7. the Layout fill: `fillLayout` replacing `writeBack`, called after a save and a Sync; _Where it is saved_ without toggles;
  8. the documents (Q28).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the maintainer sees: the scan answered, the files on disk, the sheet's rows and cells, the log lines, the rows and controls drawn. It never asserts which helper ran or the order of internal calls.
- **`folderKeyOf`**, pure: `Heat (1995)` reads; a year-less name, a range (`Severance (2022–)`), a release name and a trailing suffix answer `null`; spelling round-trips. Prior art: `episodeTag` and `titleKey` tests.
- **`readTitleFolder`**, over a temp directory, the deepest disk unit: a film by one loose video; a second loose video is `more than one video`; `Extras/` not read; images by role off the end of the stem, case folded, first by name order; `folder`/`cover`/`fanart` not read; tracks from `Subtitles/` with languages; a series by Season folders; `Season 1` not read; `Season 00` the specials; Season poster, Stills by tag, per-episode tracks; a mixed folder and an empty folder answer their left-out reasons. Prior art: `scanMovieFolder`'s and `walkLibraryFolder`'s temp-directory tests.
- **`walkLibraryFolder`**: root entries only; each Layout warning's text; the one loose-videos line per folder; `Meta/`, Export folders and system folders silent; `sheet` found or `null`. Prior art: its own tests.
- **`groupShows`, `readShowFolder`, `readSeasonFolder`**: `Season NN` only; tag numbering with the folder winning; Unplaced; loose tagged videos answered as Unplaced; the drift guard. Prior art: their existing tests.
- **`exportRows`, `writeSheet`, `readSheet`**: every row type in one table in column order and sort order; blanks where a type has no field; path cells relative with `|`; a round trip from library to sheet to `SheetRow`s, CSV and xlsx; a sheet with no `Type` or no `Folder` column reads as today. Prior art: their existing tests and the fixture `library.csv`/`library.xlsx`.
- **`matchRows`**: by Folder key, case folded; `Title (Year)` fallback; `no-folder` and `ambiguous` kept. Prior art: its tests.
- **`writeExport`**: the Export folder mirrors the layout less videos; `Meta/familyflix-library.<ext>`; a cell blank when its file didn't travel; Folder-key clash numbered with a Warning line. Prior art: its tests.
- **`createLibrarySheet`**, with fake timers and a temp directory: debounce collapses many touches into one write; atomic rename; `Meta/` made; held folder not written until released; Unreachable skipped then written; `flush` writes pending. Prior art: debounced units and the media domain's filesystem tests.
- **`LibraryStorage.onChange`**: each write that changes a sheet cell calls the listener with its folders; a watch tick with no Status crossing does not. Prior art: the library storage's tests.
- **`fillLayout`**, over a temp directory: an empty slot written; an existing image ending in the role kept; a Frame still never written; a second track of one language as `(2)`; an unwritable folder one Warning line. Prior art: `writeBack`'s tests.
- **`createImporter`**: a Factory reset then a scan over a folder with `Meta/` rebuilds titles with ratings, hearts, Status and art; held differences go to review; the sheet is held during the run and rewritten on close; Layout warnings logged. Prior art: `createImporter`'s tests with the fixture library.
- **`createEnrichment`**: no Write targets; Layout fill lines logged after a title's Sync. Prior art: its existing write-back tests.
- **`resetDatabase`**: leaves a Library sheet untouched. Prior art: its tests.
- **`EnrichmentFlow` setup and `ExportDialog`**: the two _Always_ rows with no toggles; the _Include_ copy. Prior art: their existing tests.

## Out of Scope

- Converting an existing library from the old shapes (a separate tool outside FamilyFlix, as step 40's tidy became).
- Reading year-less, shelved, Collection or loose-show folders, or `Season 1`/`Seizoen 1`/`S01`/`Specials`.
- Stills for a film.
- Resume positions, the Details state, the Still source or Import mode in the sheet.
- Locking or merging one Library folder's sheet between two installs.
- Watching folders for changes.
- Replacing a file the Layout fill finds already in its slot.
- Any change to the Managed media directory's own layout, or to `db:seed-series`.

## Further Notes

- The trade-off is accepted: every existing library must be converted before a scan reads it again (its held titles keep playing); FamilyFlix now replaces one file inside a Library folder (the Library sheet) and writes art into every Title folder after every save; art already in the layout wins over a newer pick in FamilyFlix, so after an edit the folder and the app can show different posters until the maintainer replaces the file by hand.
- The maintainer approved every recommendation of log 58 in advance; this PRD adds no decision the log doesn't hold.
