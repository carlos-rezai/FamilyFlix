> **Initiative:** `export-paths`
> **Issue:** #643 (the PRD, step 50)
> **Design log:** `docs/design-logs/67-export-paths.md`
> **Handoff:** none; no screen changes, and no prototype is amended
> **Build order:** step 50, **Export paths**. It ships as thin slices (log 67, _Implementation Plan_). No migration, no route, no page: the paths a sheet writes and reads, and one pick on the Resolve.

## Problem Statement

The household's films and shows lie in `D:\Movies`, under `Movies\` and `Series\`. Before v0.16.1 the whole of `D:\Movies` was linked as one Library folder; later `Movies\` and `Series\` were each linked as their own. An Export taken from the first library, then uploaded with _Import from spreadsheet_ after the library was emptied and the two inner folders linked, gave back one title. Every other row was a `no-folder` **Problem**, and no title came back with its poster.

What went wrong is in the paths:

- The Export wrote each title's `Folder` cell as its whole **Source folder**, `Movies\Guardians of the Galaxy`, with Windows' backslash. The importer matches a row by comparing a Title folder's own name with the whole cell, so a cell with a parent segment never matches.
- The Export's art cells name the Export's own copies (`Movies\Guardians of the Galaxy/Images/poster.jpg`). The importer looks for them only in the Title folder in the Library folder, where nothing lies, and blanks any cell holding a backslash anyway. Uploading the sheet brings back no art.
- The Export's folders are laid out a level deep, so copying them over a re-linked Library folder (the round trip's other road) puts every title one level too deep for a scan to read.
- Resolving a `no-folder` row by picking its video in the form uploads the file's bytes, so even in a Link run the film is copied into the **Managed media directory** instead of linked where it lies.

## Solution

An Export gives the library back whole, its art included, whatever shape the library had when it was taken, and a sheet's paths read the same on Windows and Linux.

- **A new Export is flat.** Each title's `Folder` cell is its Title folder's own name, and the Export lays its folders out in the **Folder layout**, one Title folder per title. Copied over a re-linked Library folder, every title lands where a scan reads it.
- **An old Export still matches.** A `Folder` cell is read as a path, backslash or slash alike. Its last segment is the **Folder key** the row is matched by, so `Movies\Guardians of the Galaxy` finds `Guardians of the Galaxy/` in whichever Library folder holds it.
- **The Export's art comes back from its sheet.** A path cell's file is looked for first in the matched Title folder, then under the **Sheet root**: the folder holding the sheet's `Meta/` folder. An Export's sheet uploaded from its `Meta/` folder finds every poster, backdrop, Still and subtitle the Export carries, and each fills the empty place it names.
- **A Resolve in a Link run links.** In the shell, a video picked on a Resolve that lies under a Library folder travels as its path, and the run's **Import mode** places it, so a Link run links it. A pick under no Library folder, or in a browser, is uploaded and copied, as today.
- **One spelling.** A Source folder is recorded with `/` on every platform, as a **Source file** already is.

## User Stories

1. As the household, I want an Export taken before I re-linked my folders to give every title back when I upload its sheet, so that the backup I already hold still works.
2. As the household, I want an uploaded Export's rows to find their Title folders even when the `Folder` cell names a parent folder that is no longer a Library folder, so that re-arranging my Library folders doesn't break my backup.
3. As the household, I want a `Folder` cell written on Windows with `\` to read the same on Linux, so that a sheet works on whichever computer I import it on.
4. As the household, I want a `Folder` cell written with `/` to read the same as one written with `\`, so that it doesn't matter which separator I or FamilyFlix typed.
5. As the household, I want an uploaded Export's posters to come back from the Export folder when my Title folder has none, so that an emptied library gets its art back.
6. As the household, I want an uploaded Export's backdrops, Stills, season posters and subtitles to come back the same way, so that every kind of art the Export carries is restored.
7. As the household, I want a file in my own Title folder to win over the Export's copy, so that my folders always come first.
8. As the household, I want a place my Title folder already fills to stay as it is, so that a sheet never overwrites what the folder holds.
9. As the household, I want a path cell naming nothing in either place to fill nothing and stop nothing, so that one missing file doesn't spoil the run.
10. As the household, I want a sheet lying outside any `Meta/` folder to read its art beside itself, so that a hand-made sheet next to my Title folders works.
11. As the household, I want my Library sheet, uploaded, to read its art from its own Library folder as before, so that the existing round trip is unchanged.
12. As the household, I want a new Export laid out with one folder per title directly in it, so that copying it over a Library folder puts each title where a scan reads it.
13. As the household, I want a new Export's `Folder` cells to be each title's own folder name, so that the sheet and the folders agree.
14. As the household, I want a new Export's art cells to start with that same folder name, so that its sheet finds its own copies.
15. As the household, I want two titles from different parent folders whose folder names are the same to be numbered `(1)` and `(2)` in the Export, with a warning line, so that neither overwrites the other.
16. As the household, I want my Library sheet's rows for titles in a nested folder to start their path cells with the title's own folder name, so that the sheet reads back the same way whatever the depth.
17. As the household, I want my Library sheet for a library already in the Folder layout to stay byte for byte as it is, so that nothing changes for a library that already worked.
18. As the household, I want two folders with the same name in two Library folders to stay an `ambiguous` Problem, so that FamilyFlix never guesses which one a row means.
19. As the household, I want a row's match to stay exact, so that a near spelling never matches the wrong title.
20. As the household, I want a path cell that tries to climb out of its folder (`..`, `..\`, a drive letter) still refused, so that reading `\` as a separator opens no way out.
21. As the household, I want a cell that doesn't lie under its row's folder still reported and ignored, as today, so that a mistyped cell is visible in the log.
22. As the household, I want a `no-folder` row I resolve by picking its video in a Link run to link the video where it lies, so that the film keeps its Library folder and takes no space in managed storage.
23. As the household, I want a Resolve's pick from outside any Library folder to be copied, so that a file on a stick I'll unplug still plays.
24. As the household, I want a Resolve in a Copy run to copy the picked video, so that the run's mode is the one choice I made.
25. As the household, I want no Import mode control drawn on the Resolve form, so that I'm not asked a question the run already answered.
26. As the household, I want a Resolve in a browser to upload the file as today, so that a browser session still works.
27. As the household, I want the dev library and a library already in the Folder layout to import exactly as before, so that the fix breaks nothing that worked.
28. As the maintainer, I want every new Source folder recorded with `/`, so that a database copied between platforms reads the same.
29. As the maintainer, I want Source folders already stored with `\` left as they are and read correctly, so that no migration has to guess which platform wrote a row.
30. As the maintainer, I want an Export written by v0.16.1, with backslash keys and nested folders, kept as a test fixture exactly as it was written, so that the sheets the household already holds stay readable.
31. As the maintainer, I want one route test of the real case (titles at `Movies/<title>` under one Library folder, exported, Factory reset, the inner folder linked, the Export's sheet uploaded) to give every title back with no Problem and every poster set, so that the bug cannot return unseen.
32. As the maintainer, I want a sheet's art read from the Sheet root only read, never written, and copied into managed storage like any art, so that an Export folder is never changed by an import.

## Implementation Decisions

- **One initiative**, `export-paths`, step 50, design log 67: two bugs (Folder key, unreached art), the Resolve side effect, and the separator (Q1). Loose art beside the video is out (Q14).
- **No spec change.** No prototype is amended, no screen changes, no copy changes, no snackbar.
- **One spelling for a Source folder** (Q3, Q4):
  - A new pure `sourceFolderOf(root, dir)` beside `placeTitleFolder`: the folder relative to its Library folder, with `/` on every platform.
  - Every site that records or looks up a Source folder calls it: the Title folder placer, the film placer's source, the importer's show import and its held-show lookup, and the Show folder read's held-series lookup.
  - Every new Source folder is one segment today, so no value written changes.
  - No migration. Stored `\` values stay; every reader splits on `/` and `\`.
- **The Folder key a sheet writes** (Q5, Q6):
  - A new pure `titleFolderName(path)` in the media domain beside `foldFolderKey`: the last non-empty segment, split on `/` and `\`.
  - The Export's row key is `titleFolderName(sourceFolder)`, in both sheets, so log 61 Q3's rule ("the Folder key is the Source folder") stands with one more step. Clashing keys are numbered and warned as any clash is (log 61 Q4).
  - The Library sheet reads each recorded Title folder where it lies and keys the read by its Folder key. Its path cells are relative to the folder holding the Title folder, not the Library folder. For a title in the root those are the same folder, so the **Round trip** stays byte for byte.
- **Reading a Folder cell** (Q7, Q8):
  - `SheetRow.folder` stays the **Folder key**, now the cell's last segment.
  - A new `SheetRow.folderPath` is the **Folder path**: the cell's segments, `\` read as `/`, joined by `/`. For every sheet FamilyFlix writes from now on it equals `folder`.
  - Duplicate rows are told apart by the Folder path's fold.
  - Matching is unchanged: a scanned Title folder's name against `row.folder`. Two such folders stay `ambiguous`. The bare-title fallback is not widened.
- **Containment of a path cell** (Q9): `\` is read as `/` first. A cell is contained when its leading segments fold equal to the Folder path's, no segment is empty, `.` or `..`, none holds a colon, and the last names its column's kind. The backslash refusal goes.
- **The Sheet root** (Q11): a new pure `sheetRootOf(sheetPath)` in the import-export domain. It answers the folder holding the sheet's `Meta/` folder when the sheet lies in one, else the sheet's own folder. A Folder scan's Meta sheet uses the same rule. No new field on the Setup step.
- **Resolving a path cell** (Q10, Q12):
  - `resolvePathCell(dir, folderPath, cell)`: the Folder path's segments replaced by the Title folder `dir` (log 61 Q12's rule, widened from one segment to the Folder path).
  - `pathCellFills` alone resolves cells. `filmWithCells` and `showWithCells` take the run's Sheet root and look for each cell's file first in the Title folder, then joined as written under the Sheet root. The first file that exists fills the empty place; the folder's own read still wins over both.
  - `matchRows` stops resolving: its `resolvedRow` goes, and a **Match** carries its row as read. The `isAbsolute` pass-through in `pathCellFills` goes.
  - The importer hands the run's Sheet root (from the sheet path the Import route already passes) to the fills.
  - The `Video` cell is never read, as today.
- **An Export copied over a Library folder** (Q13): a new Export is flat, so it lands where a scan reads it. A v0.16.1 Export's nested folders are not read as copied; its sheet is the road back.
- **The Resolve's pick** (Q15), movie-form feature only:
  - `useImportMode`, on a Resolve in the shell, reads the picked video's path through the **Path bridge** and asks the containing read, as a plain add does.
  - Under a Library folder the pick travels as a **Found file**, which the server already places by the run's Import mode. Under none, or in a browser, it uploads its bytes and is copied.
  - The Import mode control stays undrawn on a Resolve. No server change.
- **Documents** (Q16, Q17): the glossary and the checklist's step 50 were done in the grill-me. The docblocks of every changed unit change with the code. CLAUDE.md is untouched.
- **Slices** (log 67, _Implementation Plan_):
  1. The Export's art back from its sheet: `sheetRootOf`, `folderPath`, `\` as a separator, containment under the Folder path, `pathCellFills` reading the Sheet root, `resolvedRow` gone. Demo: the v0.16.1 fixture's sheet, uploaded over a re-linked inner folder, matches every title and fills every poster.
  2. The Export writes the layout: `titleFolderName`, `titleFolderOf`, the Library sheet's reads and `layoutCells`. Demo: a library of `Movies/<title>` Source folders exports flat, and its folders copied over the inner folder scan back whole.
  3. One spelling for a Source folder: `sourceFolderOf` at every site. Demo: no behaviour change; the unit's test pins `/`.
  4. The Resolve links: `useImportMode` on a Resolve. Demo: a `no-folder` row resolved by a pick in a Link run keeps its Library folder.
  5. The documents.

## Testing Decisions

- A good test drives a unit through its public face and checks what a caller or the household would see: the rows a sheet reads, the cells and folders an Export writes, the titles and art a run brings back, and what a save sends. It never checks which helper ran.
- **Pure units**, each with its own test:
  - `sourceFolderOf` pins `/` for a nested folder.
  - `titleFolderName`: `/`, `\`, mixed, trailing separators, one segment.
  - `sheetRootOf`: a sheet in `Meta/`, a sheet beside its folders.
  - Prior art: `folderKeyOf.test.ts`, `sourceFoldersOf.test.ts`.
- **`readSheet`**: a `\` Folder cell reads as its Folder path and last-segment key; a v0.16.1 path cell is contained under its Folder path; `..\` and a drive letter are still refused; duplicates are told apart by Folder path. Prior art: `readSheet.duplicates.test.ts`, `readSheet.oneSheet.test.ts`.
- **`pathCellFills`**: a file in the Title folder wins; a file only under the Sheet root fills; a cell naming nothing fills nothing; the folder's own read wins over both.
- **`matchRows`**: a row whose Folder path has a parent segment matches by its key, and its row is carried as read.
- **`exportRows` and `createLibrarySheet`/`layoutCells`**: a nested Source folder writes its last segment as the key, clashing last segments number with a warning, and path cells start with the key. A root-level library's Library sheet is byte for byte as before. Prior art: `exportRows.test.ts`, `createLibrarySheet` tests, `writeSheet.separator.test.ts`.
- **The importer**: the **Round trip** and **Export round trip** suites stay green (`createImporter.roundTrip.test.ts`, `createImporter.exportRoundTrip.test.ts`). A new suite reads a kept v0.16.1 Export fixture (backslash keys, nested folders, art under the Export folder) over a re-linked inner Library folder and gets every title with no Problem and every poster set.
- **Route**: one test of the maintainer's case: titles at `Movies/<title>` under one Library folder, exported, Factory reset, the inner folder linked, the Export's sheet uploaded from its `Meta/` folder; every title is back, no Problem, every poster set. Prior art: `routes.exportSourceFolders.test.ts`, `routes.import*.test.ts`.
- **Client**: `useImportMode` on a Resolve in the shell reads the pick through the Path bridge and asks the containing read; under a Library folder the save sends the path, under none or with no bridge it sends bytes; the Import mode stays undrawn. Prior art: `useImportMode.test.ts`.
- Every bug gets its RED test first (`tdd`), and the acceptance is the maintainer's real case in the shell.

## Out of Scope

- Loose art (`poster.jpg` beside the video) read by the **Layout read**: the Folder layout stays one shape (Q14).
- A fuzzier bare-title fallback for hand-typed keys (`Vol 2` for `Vol. 2/`, a yearless row for a `(2016)` folder) (Q8).
- Reading a v0.16.1 Export's nested folders copied over a Library folder; its sheet is the road back, and the household can move the inner folders up by hand (Q13).
- A migration of stored `\` Source folders (Q4).
- An Export folder field on the Setup step (Q11).
- Drawing the Import mode on a Resolve (Q15).

## Further Notes

- Trade-offs accepted in log 67: a sheet's art can now come from wherever the sheet lies, so an uploaded sheet's folder is read as well as the library's; it is only read, and its files are copied into managed storage like any art. Two nested titles sharing a last segment now number apart in an Export where their whole paths did not clash.
- The maintainer approved every recommendation of log 67 in advance, asking that the code stay consistent with its naming, conventions, patterns and architecture.
