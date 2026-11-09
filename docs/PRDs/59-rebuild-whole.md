> **Initiative:** `rebuild-whole`
> **Issue:** #547 (the PRD, step 42)
> **Design log:** `docs/design-logs/59-rebuild-whole.md`
> **Handoff:** `docs/handoff/handoff-rebuild-whole/` (keeps the QA ticket, 546, whole)
> **Build order:** step 42, **Rebuild whole**, the checklist's _Rebuild whole: every sheet field and series art_. It ships as thin slices (log 59, _Implementation Plan_). No migration: a series scanned under step 41 is repaired by a rescan. No screen changes and no prototype amendment; the two new log lines are in the handoff's _Copy_ table.

## Problem Statement

Step 41 promised that a Library folder is the library: its Title folders hold every file, its **Library sheet** every field, and after a Factory reset, a fresh install or on a second machine one scan gives it all back, offline. A QA pass over the real server found that promise lossy.

A scan reads a series' poster, backdrop, Season posters and Stills off the disk and then drops them, so every scanned series comes back with no art. The scan also ignores sheet columns it has already parsed: a film's TMDB id, TMDB rating and Runtime, a series' TMDB id, TMDB rating and heart, an episode's Status and Runtime. So Mum's hearted show and Dad's watched episodes come back unhearted and unwatched, and every title needs a second Sync. Worse, when the rebuild's run closes, the sheet is rewritten from the thinner library, so the skipped values are erased from `Meta/familyflix-library.csv` itself: lossy on the first rebuild, permanent on the second.

The sheet is also untrue: its path cells name where an Export would put each file (`Images/poster.jpg`, `Subtitles/English (2).srt`, a Still that was never written), not the files the Title folder holds, and an episode's Video cell re-spells its Season folder, which on the Linux AppImage names nothing. The Show folder pick reads a show by different rules than the scan. A show whose Season folders hold no video vanishes without a warning; so does a sheet row whose folder was renamed. The importer never runs the **Layout fill**. A sheet write lost to a hard kill stays stale until the next change, and a folder added back after a Factory reset has its sheet overwritten by the first hand add into it, erasing the sheet that was to rebuild it.

## Solution

A Library folder gives its whole library back, and the Library sheet is a true reading of its folder.

- A scan imports a series whole: its poster and backdrop, each Season poster and each episode's Still, copied in like a film's art. A rescan fills the empty art of a series already held, never replacing art it has.
- A new title takes every **Sheet column** its **Row type** has: a TMDB id and rating, a heart, an episode's Watched, a Runtime when the probe answers none. A title rebuilt with its TMDB id is already `synced`, so no second Sync is needed. A held title has these fields filled only where empty, never as a difference in review.
- The Library sheet's path cells come from a **Layout read** of each Title folder off the disk, so each cell names the file that is there (and a Frame still's cell is blank). An episode's Video cell is its Source file as it lies.
- A scan reads a path cell only for a place the folder left empty, and runs the Layout fill after each title, logging each file written with the Sync's own `↓` line.
- The Show folder pick reads a show with the scan's own reader, so the two can never disagree again. A Title folder whose Season folders all hold no video is the existing `empty` Layout warning.
- A sheet row no Title folder holds (an **Orphaned row**) is one Warning line in the scan's log.
- Every run that reaches review rewrites every folder its walk read, so a sheet a crash left behind catches up at the next scan; a rewrite that changes no bytes writes nothing; a **New folder**'s sheet is never written until a scan has read it.
- One acceptance test proves it: the **Round trip**. A library written to its sheet, Factory reset and rebuilt by _Scan new folders_ holds the same titles, fields and art, and the sheet written at the run's close is byte for byte the sheet the scan read.

## User Stories

### The round trip

1. As the maintainer, I want a library written to its Library sheet, Factory reset and rebuilt by _Scan new folders_ to hold the same titles, fields and art, so that the Library folder really is the library.
2. As the maintainer, I want the sheet written when the rebuild's run closes to be byte for byte the sheet the scan read, so that a rebuild never erodes the sheet that made it.
3. As the maintainer, I want a second and third rebuild to give the same library as the first, so that a loss can never compound.
4. As the maintainer, I want the round trip proved by one acceptance test over the dev fixtures, a film and a series with every column filled, so that a future change that drops a field fails a test.
5. As the maintainer, I want each of the QA ticket's findings to start from its own failing test, so that none can come back unnoticed.

### Series art on a scan

6. As the maintainer, I want a scan to import a series' poster from its Title folder's `Images/`, so that a scanned show has its cover.
7. As the maintainer, I want a scan to import a series' backdrop, so that its detail page is drawn as a hand-added show's is.
8. As the maintainer, I want each Season poster imported from `Season NN/Images/`, so that each season keeps its own art.
9. As the maintainer, I want each episode's Still imported from `Season NN/Images/Stills/` by its Episode tag, so that episodes show their own frame, not the next one's.
10. As the maintainer, I want a scanned Still recorded as a picked Still, so that no Sync replaces it.
11. As the maintainer, I want a series' art copied into the Managed media directory beside its episodes, as a film's is, so that art is always copied whatever the Import mode.
12. As the maintainer, I want a Season poster set only once its season has an episode, so that no art hangs off a season the library doesn't hold.
13. As the maintainer, I want a series art copy that fails to be the show's one `failed` Problem, as an episode's copy failure is today, so that one failure is reported once.
14. As the maintainer, I want the ticket's `Tidewater (2018)` repro (series poster, Season 01 poster, S01E01 Still) to scan to all three, so that the bug's own case is the demo.
15. As the maintainer, I want a series already held with no art to have its empty poster, backdrop, Season posters and Stills filled by a rescan, so that every family library scanned under step 41 is repaired by one scan.
16. As the maintainer, I want a rescan never to replace art a held series already has (from a Sync or a hand pick), so that a chosen poster is never overwritten by the folder's.
17. As the maintainer, I want a held series' art filled with no review row, so that a repair needs no settling.

### Every sheet field

18. As the maintainer, I want a new film to take its `TMDB id` from its row, so that it comes back matched.
19. As the maintainer, I want a new film to take its `TMDB rating`, so that its score shows without a Sync.
20. As the maintainer, I want a new film to take its `Runtime` from the sheet when the probe answers none, so that a film the probe can't read still shows its length.
21. As the maintainer, I want the probe's runtime to win over the sheet's, so that a re-encoded video never keeps a stale runtime.
22. As the maintainer, I want a new series to take its `TMDB id` and `TMDB rating`, so that a show comes back matched like a film.
23. As the maintainer, I want a new series to take its `Favorite`, so that Mum's hearted show is still hearted after a rebuild.
24. As the maintainer, I want a new episode marked watched when its row's `Status` is `Watched`, so that Dad's watched episodes stay watched.
25. As the maintainer, I want an episode row's `In progress` read as unwatched, at its start, so that a rebuilt library starts each in-progress title at its start, as a film's row is read today.
26. As the maintainer, I want a new episode to take its `Runtime` when the probe answers none, as a film does.
27. As the maintainer, I want a title rebuilt with its TMDB id to have the Details state `synced`, so that _Only what's missing_ passes it and a rebuild needs no second Sync.
28. As the maintainer, I want _Import from spreadsheet_ to take the same fields, since it goes through the same code, so that both imports bring back the same library.
29. As the maintainer, I want a held title with no TMDB id or rating to take the sheet's, so that a hand-written sheet can match titles already held.
30. As the maintainer, I want a held title with no runtime to take the sheet's, so that an empty field is filled.
31. As the maintainer, I want a row's `Favorite` `Yes` to heart a held title not hearted, and never to unheart one, so that a sheet can only add a heart.
32. As the maintainer, I want an Episode row's `Watched` to mark a held unwatched episode, as a film's row does today, so that series and films behave alike.
33. As the maintainer, I want none of these new fields drawn as a _Yours | Spreadsheet_ difference in review, so that a differing TMDB id stays a Sync's business and hearts and Status stay the family's.
34. As the maintainer, I want the ticket's repro (heart a series, mark S01E01 watched, Factory reset, _Scan new folders_) to keep the heart and the Watched, so that the bug's own case is the demo.
35. As the maintainer, I want a hand-written sheet with `TMDB id 562` and `TMDB rating 7.8` to keep both on its first scan, so that a sheet written by hand is read as fully as one FamilyFlix wrote.

### Path cells that name what is there

36. As the maintainer, I want each Library sheet path cell to name the file its Title folder holds in that place, read off the disk, so that a person following a cell finds the file.
37. As the maintainer, I want a poster or backdrop cell to name the image by its own name (`Images/die-hard-1988-poster.jpg`), so that my own file names are kept in the sheet.
38. As the maintainer, I want the user's own `Images/my-own-POSTER.jpg`, kept by the Layout fill, to be the cell's value, so that the sheet and the folder agree.
39. As the maintainer, I want a Season poster cell and a Still cell (by its tag) from the same read, so that series art cells are true too.
40. As the maintainer, I want a Frame still's cell blank, since the Layout fill never writes one, so that no cell names a file that isn't there.
41. As the maintainer, I want the Subtitles cell to list every track the `Subtitles/` place holds by its own name (`Subtitles/diehard.pt.srt`), so that tracks are named as they lie.
42. As the maintainer, I want a film's Video cell to be its one loose video, so that the cell names the real file.
43. As the maintainer, I want an episode's Video cell to be its Source file as it lies (`Severance (2022)/season 03/x.mkv`, case kept), so that the cell names the file on the Linux AppImage too.
44. As the maintainer, I want the spelled Season folder used only for an episode with no Source file (a copied add), so that every cell has a value where one can be given.
45. As the maintainer, I want a Title folder that can't be read to give blank path cells and the rest of its row, as a sheet with no files, so that one unreadable folder never stops a sheet write.
46. As the maintainer, I want the Export's path cells unchanged, still naming where the Export puts each file, so that an Export and its own sheet still agree.
47. As the maintainer, I want the sheet and the scan to agree by construction (one reader of a Title folder), so that the cells and the scan can't drift.
48. As the maintainer, I want an _Import from spreadsheet_ of a Library sheet to find its art through its cells, so that the sheet is useful on its own.

### Path cells into empty places, and the Layout fill

49. As the maintainer, I want the folder's own reading to win over a path cell, so that a stale sheet never beats the files.
50. As the maintainer, I want a path cell naming a file that is there to fill a poster, backdrop, Season poster or Still the folder's read did not find, so that a sheet can point at art lying outside the layout.
51. As the maintainer, I want a path cell to add a track the folder's read did not find, so that a subtitle named in the sheet is not lost.
52. As the maintainer, I want the Video cell never read by an import, so that the video is always the folder's.
53. As the maintainer, I want a scan to run the Layout fill after each title it imports or fills, film or series, as a save does, so that art brought in from outside the layout lands in it.
54. As the maintainer, I want each file the Layout fill writes during a scan logged as the Sync's own line (`↓ poster.jpg  →  Heat (1995)/Images/poster.jpg`), so that I see what was written into my folder.
55. As the maintainer, I want a folder the Layout fill can't write to be one Warning line in the run's log, so that a read-only folder is reported, not fatal.
56. As the maintainer, I want the Layout fill during a scan to write only what isn't in the layout (art from a path cell outside it, art a held title had that its folder lacks), so that a scan of a tidy folder writes nothing.
57. As the maintainer, I want a sheet naming `Heat (1995)/heat.jpg` beside the video to import it as the poster and write it into `Images/`, so that the demo case works end to end.

### One reader of a show

58. As the maintainer, I want the Show folder pick to read a show with the scan's own reader, so that a hand-added show and a scanned show agree.
59. As the maintainer, I want a picked Title folder to read its Season folders and nothing else, `Season 1/` and `Extras/` passing in silence as in the scan, so that the form never offers a video the scan would ignore.
60. As the maintainer, I want a picked Season folder to read itself, standing for its show, as today, so that I can pick either level.
61. As the maintainer, I want a picked folder of loose videos to answer them as Unplaced without descending into subfolders, so that I can number them by hand.
62. As the maintainer, I want the pick's answer numbered by the same rule as the scan's, so that episode numbers never differ between the two.

### Warnings for what is left out

63. As the maintainer, I want a Title folder whose Season folders all hold no video left out with the existing `⚠ Hollow Show (2020) holds no video or Season folder, left out` line, so that a hollow show is noticed.
64. As the maintainer, I want an empty Season folder beside full ones to pass in silence, the series read, so that one empty season doesn't drop a show.
65. As the maintainer, I want a sheet row no Title folder holds to be one Warning line in the Folder scan's log, `⚠ Heat (1995) (1) is in the sheet but has no folder, left out`, so that a renamed or moved folder doesn't lose its row in silence.
66. As the maintainer, I want one line per Folder key, its Season and Episode rows with it, so that a series is one line, not dozens.
67. As the maintainer, I want an Orphaned row taken out of the sheet by the rewrite on close, so that the sheet still mirrors the library.
68. As the maintainer, I want an Orphaned row never to be a Problem in review, so that review holds only titles to settle.

### The sheet catches up, and a New folder's sheet is safe

69. As the maintainer, I want every run that reaches review to touch every Library folder its walk read, so that a sheet a hard kill left behind catches up at the next scan.
70. As the maintainer, I want a rewrite whose bytes equal the file's not written, so that a catch-up that changes nothing touches no disk and wakes no drive.
71. As the maintainer, I want no rewrite of every folder at startup, so that a launch never wakes every external drive.
72. As the maintainer, I want a New folder (listed, never scanned) never to have its sheet written, so that adding a folder back after a Factory reset and hand-adding one title into it can't erase the sheet that will rebuild it.
73. As the maintainer, I want the run that marks a New folder scanned to write its sheet on close, so that its sheet follows from then on.
74. As the maintainer, I want an Unreachable folder still skipped and caught up when next reachable, as today, so that the existing lifecycle holds.

### Documents

75. As the maintainer, I want the glossary to hold **Round trip**, **Layout read**, **Path cells**, **Layout place**, **File plan** and **Orphaned row**, and the updated **Library sheet writer**, **Show folder read** and **Layout warning**, so that the code and the docs share one vocabulary.
76. As the maintainer, I want the docblocks of every changed unit to say what it now does, so that a reader of the code meets the rules where they live.
77. As the maintainer, I want CLAUDE.md untouched, since no boundary moves and the writers into a Library folder are still the two it names, so that the project rules stay stable.

## Implementation Decisions

- **One initiative** (log 59 Q1), step 42, settling all nine findings of the QA ticket. Not built: the ticket's suggested release guard (Q10; the round trip is the guard, and a guard would make the sheet hold what the library does not), a rewrite of every folder at startup (Q19), new review fields (Q9), recorded Library-folder paths per file (Q11).
- **`readTitleFolder`** (media domain, Q16, Q17): exports `readSeasonFolders(dir)`, a folder's Season folders read and in number order, called by both `readTitleFolder` and `readShowFolder`. A Title folder whose Season folders all hold no video answers the `empty` left-out reason; an empty Season folder beside full ones passes in silence.
- **`numberShow`**, new (import-export domain, Q3), replacing `groupShows`: `numberShow(series: SeriesFolderScan) => ShowScan` numbers one series' Season folders (episodes by tag, the folder's season winning, Unplaced and stray subtitles as today) and carries its art. `ShowScan` gains `poster`, `backdrop` and `seasons: { number, poster }[]`; `ShowEpisode` gains `still`, by its tag from the Season folder's Stills. `showFolderOf` moves with it. `groupShows` is retired.
- **`readShowFolder`** (Q16): reads by `readSeasonFolders` and numbers by `numberShow`; a picked Season folder reads itself standing for its show; a folder of loose videos answers them as Unplaced without descending. `scansUnder` is retired.
- **`createImporter`** (Q3 to Q6, Q14, Q15, Q18, Q19):
  - `scansOf` no longer flattens a series; a series reaches the importer whole.
  - `importShow` copies every piece of art in with `media.copyIn`: poster and backdrop on `addSeries`, each Season poster by `setSeasonPoster` once its season has an episode, each Still on its `addEpisode` as `stillPath` (Still source `picked`). A copy that fails is the show's one `failed` Problem.
  - A held series' empty poster, backdrop, Season posters and held episodes' Stills are filled from its Title folder, never replacing one, with no review row.
  - `importMatch` and `importShow` take every field the Sheet columns give their Row type (log 59 Q6's table); Runtime from the probe, the sheet's when the probe answers none; only `Watched` marks watched. A title imported with a TMDB id has the Details state `synced`.
  - A path cell is read only for a place the folder's read left empty (an image place, or a track not found); the Video cell is never read.
  - Gains a `layoutFill` dependency, wired in the server's startup as `createEnrichment` has it, run after each title imported or filled; each file written is the Sync's `↓` line, a folder it can't write one Warning line.
  - A Folder scan logs one Warning line per Orphaned row's Folder key.
  - A run that reaches review touches every Library folder its walk read.
- **`planSheetFields`** (Q9): the new fields as fills only: TMDB id and TMDB rating where the held title has none, Runtime where none, `Favorite` `Yes` hearts (never unhearts), an Episode row's `Watched` marks a held unwatched episode.
- **`PathCells`** (Q12): `exportRows(movies, series, cells: PathCells, sourceFolderOf?)` takes its path cells from a `PathCells { image(place, storedPath), tracks(place, subtitles), video(place, storedPath) }` keyed by `LayoutPlace` (poster or backdrop, season poster, still, tracks, video), not by spelled path. `exportRows` stays pure and the one place a cell rule is spelled.
- **`filePlan`**, new (Q12): `filePlan(include) => { cells: PathCells, files: ExportFile[] }`, today's `plannerFor` moved out and named the **File plan**; `writeExport` calls `exportRows` with it. The Export's sheet is unchanged.
- **`layoutCells`**, new and pure (Q11, Q12): `layoutCells(reads: Map<FolderKey, TitleFolderScan>, root) => PathCells`, the Library sheet's cells from the **Layout read**: images by role, Season posters, Stills by tag, every track by its own name; a Frame still blank; plans nothing.
- **The Video cell** (Q13): a film's one loose video, an episode's Source file as it lies; the spelled Season folder only for an episode with no Source file. In both sheets.
- **`createLibrarySheet`** (Q11, Q19, Q20): reads each recorded Title folder with `readTitleFolder` for its path cells (an unreadable folder gives blank path cells); skips a folder whose `scannedAt` is null, as it skips an Unreachable one; compares the new bytes with the file's and writes nothing when equal. Its interface (`touch`, `hold`, `release`, `flush`) is unchanged.
- **Write types and storage** (Q6): `NewMovie` gains `tmdbScore?`; `NewSeries` gains `isFavorite?` and `tmdbScore?`; `NewEpisode` gains `watched?`. `LibraryStorage`'s `addSeries` and `addEpisode` take them.
- **No route changes**, no client changes, no migration, no prototype amendment (Q21, Q23).
- **Names** (Q22): new **Round trip**, **Layout read**, **Path cells**, **Layout place**, **File plan**, **Orphaned row**; updated **Library sheet writer**, **Show folder read**, **Layout warning**; retired units `groupShows`, `scansUnder`. Already in the glossary as of the grill-me commit.
- **Slices** (log 59, _Implementation Plan_):
  1. series art on a scan (`readSeasonFolders`, `numberShow`, `importShow`'s art, a held series' empty art filled);
  2. every sheet field (write types, storage, `importMatch`/`importShow`, `planSheetFields`);
  3. path cells from the Layout read (`PathCells`, `filePlan`, `layoutCells`, `createLibrarySheet` reading its folders, the Video cell by Source file);
  4. the round trip acceptance test;
  5. path cells into empty places, and the Layout fill in the importer;
  6. one reader of a show, and empty Season folders;
  7. what the scan and the sheet say (Orphaned-row line, every read folder touched, unchanged bytes skipped, a New folder never written);
  8. the documents (Q23).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the maintainer sees: the library's titles and fields after a run, the files on disk, the sheet's bytes and cells, the log lines. It never asserts which helper ran or the order of internal calls.
- Every finding starts from its own RED test reproducing it (the ticket's baseline: no existing test catches any of them).
- **The round trip** (acceptance, over the dev fixtures and a temp Library folder): a film and a series with every Sheet column filled are written to their sheet, the database reset, and _Scan new folders_ run; the rebuilt library equals the original (titles, fields, hearts, Watched, TMDB ids and ratings, art), and the sheet written at close equals the sheet read, byte for byte. Prior art: `createImporter`'s Factory reset rebuild tests from step 41.
- **`readTitleFolder` / `readSeasonFolders`**, over a temp directory: Season folders in number order; a Title folder whose Season folders hold no video is `empty`; one empty Season folder beside full ones passes in silence. Prior art: its own temp-directory tests.
- **`numberShow`**, pure: episodes numbered by tag with the folder winning; Unplaced and strays; the series' poster and backdrop, each season's poster and each episode's Still carried by tag. Prior art: `groupShows`' tests, moved.
- **`readShowFolder`**: `Season 1/` and `Extras/` silent in a picked Title folder; a picked Season folder stands for its show; loose videos Unplaced without descending. Prior art: its existing tests.
- **`createImporter`**: a scanned series' poster, backdrop, Season poster and Still (the Tidewater repro); a held series' empty art filled and existing art kept; every field per Row type taken on a new title; Runtime probe first; `In progress` unwatched; Details state `synced`; a path cell fills an empty place and never beats the folder; the Video cell ignored; the Layout fill's `↓` lines and Warning line; the Orphaned-row line, one per Folder key; every read folder touched at review. Prior art: `createImporter`'s fixture-library tests.
- **`planSheetFields`**: each new field filled only where empty; a heart added, never removed; an Episode row's Watched marks; no new difference rows. Prior art: its existing tests.
- **`exportRows`**: given a fake `PathCells`, each cell is what it answers for its place; the Video cell by Source file, the spelled Season folder only with none. Prior art: its existing tests.
- **`filePlan`**: the Export's cells and planned files exactly as today's `plannerFor` gave them (the Export's existing tests stay green unchanged). Prior art: `writeExport`'s tests.
- **`layoutCells`**, pure: images by their own names, Season posters, Stills by tag, tracks by name, a Frame still blank, an unread folder blank. Prior art: `exportRows`' table tests.
- **`createLibrarySheet`**, with fake timers and a temp directory: path cells from the disk (`Images/die-hard-1988-poster.jpg`); an unreadable Title folder gives blank path cells and the rest of the row; a New folder never written; equal bytes not written (the file's mtime unchanged). Prior art: its existing tests.
- **`LibraryStorage`**: `addSeries` stores `isFavorite` and `tmdbScore`; `addEpisode` stores `watched`. Prior art: the library storage's tests.

## Out of Scope

- A Sync against real TMDB (the QA pass was offline).
- The Electron window's copy (the Sync's _Where it is saved_, the Export dialog).
- The Ordered shutdown's flush on Windows.
- A read-only Title folder's Warning line beyond the Layout fill's existing one.
- Linux case sensitivity beyond the Video cell.
- Merging two installs' sheets (log 58 Q24).
- A guard against a release rewriting cells the run read and did not take.
- Rewriting every folder's sheet at startup.
- Any new review field, screen or prototype amendment.

## Further Notes

- The trade-off is accepted: every sheet rewrite now reads each recorded Title folder from disk (a few hundred directory reads for a large library, after the debounce) where it read only the database; a sheet written from two sources can name a file the library does not hold, by design, since the folder is the source of truth; `exportRows` gains a parameter every caller passes.
- The maintainer approved every recommendation of log 59 in advance; this PRD adds no decision the log doesn't hold.
