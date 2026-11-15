> **Initiative:** `rescan-a-folder`
> **Issue:** #617 (the PRD, step 47)
> **Design log:** `docs/design-logs/64-rescan-a-folder.md`
> **Handoff:** `docs/handoff/handoff-folder-layout/` (amended by log 64)
> **Build order:** step 47, **Rescan a folder**. It ships as thin slices (log 64, _Implementation Plan_). No migration, no route, no screen: the Folder layout's names relaxed, and every reader and writer made to agree.

## Problem Statement

The maintainer links a **Library folder** (`E:\Movies`), and the household keeps dropping new films and shows into it. They name a folder the way they read the title: `Heat`, `Death Note`, and inside a show, `Season 1`. Then they press _Scan all folders_, and almost nothing new arrives.

The **Folder layout** (log 58) reads a folder in the root only when its name ends in a four-digit year in brackets, `Heat (1995)`, and reads a season only when it is spelled with two digits, `Season 01`. Everything else is left out, and the only trace is one **Layout warning** buried in the Activity log, `⚠ Death Note isn't named Title (Year), left out`. To a parent, the new film is simply not there, and nothing on screen says why.

The year is a rule the family has no reason to know. They only need it when two titles share a name, and their computer already stops them from making two folders called `Heat` side by side. And `Season 1` is the most natural name a show's first season could have.

Any relaxing has to keep the library's data clean: the **Library sheet** and an **Export file** (CSV or Excel) must still describe every title row for row, read back the same, and never leave FamilyFlix writing a second spelling of a folder beside the household's own.

## Solution

_Scan all folders_ finds what the household drops in under the names they would naturally give it.

- **The year is optional.** Any folder in a Library folder's root is a **Title folder**, and its name is the title as written. A trailing `(1995)` is read as the year; a range, `(2022–)` or `(2022-2025)`, as its first year. A year is only needed to tell two titles of one name apart (`Heat` and `Heat (1986)`). With no year, a Sync fills it from TMDB like any other empty field.
- **`Season 1` is a Season folder.** `Season N` with any number of digits is read: `Season 1`, `Season 01` and `Season 001` are all season 1, and `Season 0` / `Season 00` holds the specials. Two folders for one season are read as one **Doubled place**: the first by name is read and the other is named in one warning, never merged.
- **FamilyFlix writes into the household's folders.** When the **Layout fill** puts a Season poster, a Still or a subtitle track into a show, or an **Export** lays out a show's art, they go into the folder the episodes actually lie in (`Season 1/Images/poster.jpg`). FamilyFlix only spells `Season 01` itself where it has no folder to go by.
- **The sheet is unchanged.** `Folder` is the folder's own name (`Death Note`), and `Year` is the title's year (blank until a Sync fills it). No column, row type or dialect changes, so every sheet already written reads exactly as before. A hand-made row with `Heat` and `1995` also finds a folder named just `Heat` when no `Heat (1995)` exists.

There are no new screens, buttons or settings: the scan the maintainer already presses simply stops refusing names.

## User Stories

1. As the maintainer, I want a film folder named `Heat` to be imported by _Scan all folders_, so that the household does not have to learn a naming rule.
2. As the maintainer, I want a series folder named `Death Note` holding `Season 1/` to be imported by _Scan all folders_, so that a new show arrives the first time I scan.
3. As the maintainer, I want new folders dropped into an already scanned Library folder to be found on the next _Scan all folders_, so that a rescan brings in what was added.
4. As a parent, I want a film imported from a folder named `Heat` to show as _Heat_ in the grid, so that I see the name I gave it.
5. As the maintainer, I want a folder named `Heat (1995)` still to read title _Heat_ and year 1995, so that every folder already in the layout reads as it did.
6. As the maintainer, I want a folder named `Severance (2022–)` to read title _Severance_ and year 2022, so that a series named with its run is not imported under a title with a dash in it.
7. As the maintainer, I want `Severance (2022-2025)` and `Severance (2022–2025)` to read year 2022, so that either dash and a closed range both work.
8. As the maintainer, I want `Heat` and `Heat (1986)` in one Library folder to be two titles, so that a year is how two titles with one name are told apart.
9. As the maintainer, I want a folder with text after its brackets (`Heat (1995) [1080p]`) to be read as a title spelled exactly that way, so that the rule is one sentence: the name is the title, and a year at the end is the year.
10. As the maintainer, I want no title guessed out of a release name (`Die.Hard.1988.1080p` stays that name), so that what I see in the grid is always what the folder says, and I fix it by renaming the folder or editing the title.
11. As the maintainer, I want a title imported without a year to get its year from a Sync, so that the library still knows the year without the folder carrying it.
12. As the maintainer, I want a yearless title's folder never to be renamed after a Sync fills its year, so that FamilyFlix never touches my folder names.
13. As the maintainer, I want `Season 1`, `season 1` and `SEASON 1` to be read as season 1, so that case and a single digit both work.
14. As the maintainer, I want `Season 01` and `Season 001` still to read as season 1, so that every show already in the layout reads as it did.
15. As the maintainer, I want `Season 0` and `Season 00` to hold the specials, so that both spellings of the specials work.
16. As the maintainer, I want `Seizoen 1`, `S01` and `Specials` still not to be read as Season folders, so that the season rule stays one spelling with any number of digits.
17. As the maintainer, I want a show with both `Season 1` and `Season 01` to read the first by name and warn me about the other, so that I know to fix it by hand and no two videos are numbered as one episode.
18. As the maintainer, I want that warning to read `⚠ Death Note holds 2 Season 1 folders, Season 01 read`, so that it matches every other Doubled place line.
19. As the maintainer, I want a season poster the Layout fill writes for a `Season 1` show to land in `Season 1/Images/`, so that no `Season 01/` folder appears beside mine.
20. As the maintainer, I want a Still the Layout fill writes for a `Season 1` show to land in `Season 1/Images/Stills/`, so that the show keeps one folder per season.
21. As the maintainer, I want an episode track the Layout fill writes for a `Season 1` show to land in `Season 1/Subtitles/S01E01/`, so that tracks live beside their episodes.
22. As the maintainer, I want the next scan after a Layout fill to raise no doubled-season warning, so that FamilyFlix never causes a warning by its own writes.
23. As the maintainer, I want the Layout fill to spell `Season 01` only for a season with no episode recorded in a folder, so that FamilyFlix's own spelling is used only where the household has none.
24. As the maintainer, I want an Export of a `Season 1` show to put its season art in `Death Note/Season 1/`, the same folder its Video cells name, so that copying the Export back over my Library folder merges into my folders instead of doubling them.
25. As the maintainer, I want an Export of a title held from a folder named `Heat` to lay out a `Heat/` folder, so that the Export keeps my folder names.
26. As the maintainer, I want an Export of a title with no folder and no year to be named by its title alone, so that no `Heat ()` or other odd name is written.
27. As the maintainer, I want the Library sheet's `Folder` cell for a yearless folder to be the folder's own name, so that the sheet matches the disk exactly.
28. As the maintainer, I want the Library sheet's `Year` cell to hold the title's year (blank, or filled by a Sync), so that the year and the folder name are two separate facts.
29. As the maintainer, I want the Library sheet's path cells for a `Season 1` show to name `Death Note/Season 1/...`, so that every path cell names a file that is really there.
30. As the maintainer, I want a sheet written before this change to read exactly as before, so that no export or backup goes stale.
31. As the maintainer, I want a hand-made sheet row of `Heat` and `1995`, with no `Folder` cell, to match a folder named `Heat` when no `Heat (1995)` exists, so that a sheet I typed still finds my folders.
32. As the maintainer, I want that row to match `Heat (1995)` rather than `Heat` when both exist, so that the year still decides between two folders of one name.
33. As the maintainer, I want a row whose bare title matches two folders to be `ambiguous`, so that a guess never picks one of them for me.
34. As the maintainer, I want a row whose title matches no folder at all to be `no-folder`, as today, so that review still names what it couldn't find.
35. As the maintainer, I want a genre shelf (`Drama/` holding title folders) still to be left out with `⚠ Drama holds no video or Season folder, left out`, so that a folder that isn't a title is still named in the log.
36. As the maintainer, I want a folder holding both loose videos and Season folders still to be left out as `mixed`, so that a real fault is still named.
37. As the maintainer, I want the warning `isn't named Title (Year)` never to appear again, so that the log no longer blames a name the layout now reads.
38. As the maintainer, I want `Meta/`, an Export folder and system folders (`$RECYCLE.BIN`, `System Volume Information`, dot folders) still passed in silence, so that relaxing names never turns them into titles.
39. As the maintainer, I want a video I add by hand from `E:\Movies\Heat\heat.mkv` (the **Path bridge**) to record `Heat` as its **Source folder**, so that it gets a row in the Library sheet and a Layout fill like a scanned title.
40. As the maintainer, I want a **Show folder pick** of `Death Note/` holding `Season 1/` to number its episodes from the season folder, so that the movie form reads the same rule as the scan.
41. As the maintainer, I want a Show folder pick of `Season 1/` itself to stand for its series, so that picking the season folder still works.
42. As the maintainer, I want the movie form's numbering guess off a `Season 1` folder name to say season 1, so that the client reads seasons the same way the server does.
43. As the maintainer, I want a folder that no sheet row claimed to offer its own name as the title in review, so that the title is already typed as the folder spells it.
44. As the maintainer, I want an **Unreachable** Library folder still skipped with its Warning line, so that relaxing names changes nothing about reachability.
45. As the maintainer, I want _Scan new folders_ to read the same relaxed names, so that a newly added folder and a rescanned one follow one rule.
46. As the maintainer, I want no migration, setting or new screen for any of this, so that an update just makes the scan find more.

## Implementation Decisions

- **One initiative** (log 64 Q1), step 47, `rescan-a-folder`: the Folder layout's names relaxed, and every reader and writer of them brought into agreement. No per-row Rescan (log 30 Q16 and log 54 Q6 stand). The removal pass and left-out folders in review are draft step 48, **Missing videos**.
- **The spec** (Q2): no screen changes, since no app copy teaches the naming rule. The layout handoff README is already amended (trees, warnings, a yearless sheet example) and rules with log 64.
- **Folder key** (media domain, Q3 to Q6):
  - `FolderKey.year` becomes `number | null`.
  - `folderKeyOf(name)` always answers: a name ending in ` (YYYY)` reads that title and year; ` (YYYY–)`, ` (YYYY-)`, ` (YYYY–YYYY)` and ` (YYYY-YYYY)` read the first year; any other name is the title, verbatim, year `null`. No title guess.
  - `spellFolderKey(title, year: number | null)` spells the bare title for `null`, replacing the sheet reader's own `spelledKey` and the Export's `folderKeyName`.
  - `foldFolderKey` and `sameFolderKey` are unchanged.
- **Season folder** (media domain, Q7): `seasonNumberOf` reads `Season N`, any digits, case folded. `isSeasonFolder` follows it. `spellSeasonFolder` is unchanged (`Season 01`). The shared case table and the movie form's mirror `readSeasonFolder` move with it under the existing drift guard.
- **Title folder read** (media domain, Q6, Q8):
  - The `no-key` **Left-out reason** is retired (`LeftOutReason = 'empty' | 'mixed'`), and its warning goes with it.
  - `readSeasonFolders` reads the first Season folder of each number, by name order, and reports the others as a **Doubled place**: `DoubledWhere` gains `{ place: 'season'; season: number }`.
  - The walk words it as `⚠ <name> holds <n> Season <s> folders, <read> read`.
- **Title folder placing** (import-export domain, Q6): `placeTitleFolder` keeps its depth and listed-folder checks and drops the name check.
- **Importer** (Q3): `guessedRow` takes its title and year from the Folder key alone; its `titleGuess` / `yearInName` fallbacks are dead for a folder name and go. The review's offered title for a folder no row claimed is therefore the folder's own name (or the title before its year).
- **Season folder name** (import-export domain, Q9): one new pure unit, `seasonFolderOf(sourceFiles, season) => string`. It answers the first path segment of the held episodes' **Source files** (the first non-null, in episode order), and `spellSeasonFolder(season)` when none is recorded. It reads no disk.
- **Layout fill** (Q9): `HeldSeasonFiles` gains `folder: string`, built by the Layout fill's composition from the season's episodes through `seasonFolderOf`. `fillLayout` writes every season-scoped file under `season.folder` and spells nothing itself.
- **Export** (Q9, Q10): every season-scoped place (`season-poster`, `still`, an episode's tracks and video) carries `seasonFolder`, built by `exportRows` through `seasonFolderOf`. The File plan's season directory and `videoCell`'s fallback use it. A Title folder's name in an Export is unchanged: its Source folder, else `spellFolderKey`. Two titles with one key are still numbered with a Warning line.
- **Library sheet** (Q11): no change. Its path cells already come from the **Layout read** of disk.
- **Sheet matching** (Q12): `matchRows` tries the row's Folder key first, as today. When no folder holds it and the row has a year, it matches folders whose key folds equal to the row's title alone. `ambiguous` for two or more, `no-folder` for none, and `no-video` for one with no video or several, as for any key. Never by title when the spelled key exists.
- **No migration, no route, no wire type, no page, no setting** (Q13). No CLAUDE.md change: the dev fixture keeps its full spellings (Q16).
- **Documents** (Q16): the docblocks of every unit above; the glossary, checklist and handoff were done in the grill-me.
- **Slices** (log 64, _Implementation Plan_):
  1. The names read: `folderKeyOf` and `seasonNumberOf` relaxed; the case table and the client mirror moved; `no-key` retired through the title folder read, the walk, `placeTitleFolder` and `guessedRow`. Demo: drop `Heat/heat.mkv` and `Death Note/Season 1/` into the dev Library folder, and _Scan all folders_ imports both.
  2. The doubled season: the `season` Doubled place and its warning.
  3. The writers agree: `seasonFolderOf`, the Layout fill and the Export writing into `Season 1/`, and `spellFolderKey` taking a `null` year. Slice 1 must not ship to a release without this slice, or the Layout fill would make `Season 01/` beside `Season 1/`.
  4. The sheet matches: `matchRows`' bare-title fallback.
  5. A walk in the shell on the dev library, then the docblocks.

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the family would see: the key a name reads as, the titles and warnings a walk answers, the files the Layout fill writes and where, the table and files an Export plans, the matches and problems a sheet produces. It never asserts which helper ran.
- **`folderKeyOf`**: a bare name (title verbatim, year `null`), `Title (YYYY)`, both dashes in open and closed ranges, text after the bracket read verbatim, a name that is only `(1995)`; `spellFolderKey` with and without a year. Prior art: `folderKeyOf.test.ts`.
- **`seasonNumberOf` and `readSeasonFolder`**: the shared case table (`Season 1`, `Season 001`, `Season 0` numbered; `Seizoen 1`, `S01`, `Specials`, `Season 1 extra` still `null`) over both sides, the drift guard unchanged. Prior art: `seasonNumberOf.test.ts`, the case table and the client's table test.
- **`seasonFolderOf`**: the first episode's folder, a later one when the first has none, the spelled fallback with none, a Source file with no folder segment. New table test.
- **`readTitleFolder`**: a yearless film, a yearless `Season 1` series, a range-named series, `Season 1` and `Season 01` doubled (the first read, the other reported). Prior art: `readTitleFolder.seasonFolders.test.ts`, `readTitleFolder.doubled.test.ts`, in temp folders.
- **`walkLibraryFolder`**: no `isn't named` line for any name; the doubled-season line; a genre shelf still `empty`; `Meta/`, an Export folder and system folders still silent. Prior art: `walkLibraryFolder.test.ts`.
- **`placeTitleFolder`**: a yearless folder in the root placed; a deeper folder and an unlisted one still `null`. Prior art: `placeTitleFolder.test.ts`.
- **`fillLayout`**: a season whose `folder` is `Season 1` gets its poster, Still and tracks under `Season 1/`, and no `Season 01/` is made. Prior art: `fillLayout.test.ts`.
- **`exportRows` and `filePlan`**: a `Season 1` show's season art planned under `Season 1/` beside its Video cells; a yearless title with no Source folder named by its title. Prior art: `exportRows.test.ts`, `filePlan.test.ts`.
- **`matchRows`**: a spelled `Heat (1995)` row matching a `Heat` folder; preferring `Heat (1995)` when both exist; two bare-title folders `ambiguous`; no fallback for a row without a year. Prior art: `matchRows.folderKey.test.ts`.
- **Importer**: a Folder scan over a temp Library folder holding `Heat/` and `Death Note/Season 1/` imports both, with titles _Heat_ and _Death Note_ and null years; a rescan of the same folder imports nothing twice. Prior art: the importer's folder-scan tests and `createImporter/seriesFixture/`.
- Slice 5's live walk in the shell is the acceptance: a yearless film and a `Season 1` show dropped into a scanned Library folder arrive on _Scan all folders_; a Sync fills their years and writes the show's art into `Season 1/`; an Export lays out the same folder names; and a second scan raises no new warnings.

## Out of Scope

- A Rescan on each Folder row (Q1).
- Noticing a held title whose video is gone, and listing left-out folders in the run's review: draft step 48, **Missing videos** (Q1).
- Guessing a title out of a release-named folder (Q3).
- Log 51's other season spellings: `Seizoen`, `S01`, `Specials` (Q7).
- Renaming any folder to a canonical spelling, or warning that one lacks a year (Q5, Q9).
- Any change to the sheet's columns, row types or dialects (Q11).

## Further Notes

- The trade-off is accepted: a release-named folder now imports under its raw name instead of being left out, so the grid may show `Die.Hard.1988.1080p` until it is renamed or edited; a numbered Export duplicate (`Heat (1)`) reads back as that title; and FamilyFlix's own spelling and the household's can differ within one Library folder.
- The maintainer approved every recommendation of log 64 in advance; this PRD adds no decision the log doesn't hold, apart from spelling out its consequence for the review's offered title (user story 43).
