> **Initiative:** `sheet-in-sight`
> **Issue:** #700 (the PRD, step 56)
> **Design log:** `docs/design-logs/74-sheet-in-sight.md`
> **Handoff:** `docs/handoff/handoff-sheet-in-sight/README.md`, until phase 3 amends `feat.ImportFlow.dc.html`, `page.LibraryFoldersPage.dc.html`, `page.SettingsPage.dc.html` and `COMPONENT-SPEC.md` to it.
> **Build order:** step 56, **Sheet in sight**. Renames log 58's **Meta folder** and adds one write to the **Library sheet writer**, the **Meta move**. No migration, no new dependency, no new route.

## Problem Statement

The maintainer added films through the Movie form and linked posters by hand. Then they ran a **Factory reset** and scanned the same Library folder again, and every poster came back on its own. The **Library sheet** did its job: it records each folder's titles, art, ratings, hearts and what's been watched. But nobody knew it was there, so a reset that says _Erase everything_ looked like it hadn't.

The sheet lives in `Meta/familyflix-library.csv`. In a Library folder of hundreds of `Title (Year)` folders, `Meta/` sorts among the M's and nobody sees it. Nothing in the app mentions it either: not where a folder comes in, and not in the Reset dialog. So the maintainer can't tell what a reset really erases, and has no obvious way to start truly clean.

## Solution

**The Library sheet is easy to find, and the maintainer is told it exists and what it brings back.**

- **`_meta/` heads the folder.** The **Meta folder** is now `_meta/`. A leading underscore sorts above every letter and digit in Windows Explorer, so it is the first thing in a Library folder. The sheet is `_meta/familyflix-library.csv`, and an Export writes its sheet to `_meta/` too.
- **Old folders keep working.** FamilyFlix still reads a library or an Export that holds `Meta/` (the **Old Meta folder**). The next time it writes a Library folder's sheet, it renames that folder's `Meta/` to `_meta/` in one move, with every file inside it (the **Meta move**). Nothing is deleted. If the rename is refused, for example because the sheet is open in Excel, the sheet is written where it lies this time and the move is tried again at the next write.
- **Said where a folder comes in.** _What the scanner accepts_ gains a **Sheet note**. It shows on Import setup and on the Library folders page's **Scan**. It says FamilyFlix keeps a sheet of each folder's titles in `_meta\familyflix-library.csv` and reads it first, so a scan after a reset or on another computer brings every title back as it was.
- **Said before a reset.** The Reset dialog's _What stays_ lists the sheet second: _Each library folder’s \_meta sheet: scanning the folder again brings its titles back as they were (delete \_meta first to start clean)_.
- **Starting clean is one visible folder to delete.** There is no new toggle and no new scan mode.

## User Stories

1. As the maintainer, I want the folder holding the Library sheet to sort first in a Library folder in Explorer, so that I can find it among hundreds of Title folders.
2. As the maintainer, I want that folder named `_meta`, lowercase, so that it reads as FamilyFlix's own and not as a title or one of the household's folders.
3. As the maintainer, I want the sheet in a fresh Library folder written to `_meta/familyflix-library.csv`, so that new libraries use the new name from the start.
4. As the maintainer with a library written before this step, I want its `Meta/` read as before, so that upgrading never loses a sheet.
5. As the maintainer with a library written before this step, I want `Meta/` renamed to `_meta/` the next time FamilyFlix writes its sheet, so that my library catches up without any work from me.
6. As the maintainer, I want the rename to carry every file in `Meta/`, an `.xlsx` included, so that nothing I put there is lost.
7. As the maintainer, I want the rename to happen even when no cell changed, so that a library that's only scanned still moves.
8. As the maintainer, I want FamilyFlix never to delete anything during the move, so that the rule "FamilyFlix deletes nothing outside its managed directory" still holds.
9. As the maintainer with the sheet open in Excel, I want a scan to still record the library, so that a locked folder never makes the sheet fall behind.
10. As the maintainer with the sheet open in Excel, I want the sheet written into `Meta/` this once and the move tried again at the next write, so that the move finishes after I close Excel.
11. As the maintainer, I want a refused move never to leave two sheets, so that a stale sheet can't come back later.
12. As the maintainer who has both `_meta/` and `Meta/` in a folder, I want `_meta/` to rule and `Meta/` left alone, so that FamilyFlix neither merges nor deletes my files.
13. As the maintainer who has both folders, I want no warning about it, so that I'm not shown a line I can't act on in the app.
14. As the maintainer, I want neither `_meta/` nor `Meta/` ever mistaken for a title, so that a scan never offers a film called "\_meta".
15. As the maintainer, I want a folder named `meta`, `_Meta` or `Meta (2019)` treated as a title as before, so that only the two exact names are set aside.
16. As the maintainer, I want an Export to write its sheet in `_meta/`, so that an Export looks like a library.
17. As the maintainer with an Export made before this step, I want it to import with its art, `Meta/` and all, so that old backups still work years later.
18. As the maintainer, I want a folder holding either `_meta/` or `Meta/` recognized as an Export folder inside a library, so that a scan doesn't import an Export's copies as new titles.
19. As the maintainer, I want a sheet uploaded from an Export's `_meta/` or `Meta/` to find its art in the folder above, so that a bulk import from either brings its posters.
20. As the maintainer, I want the Export folder itself never renamed, so that FamilyFlix writes nothing into an Export after it is made.
21. As the maintainer adding a Library folder on Import setup, I want to be told FamilyFlix keeps a sheet in `_meta\familyflix-library.csv`, so that I know it's there before my first scan.
22. As the maintainer scanning from the Library folders page, I want the same note, so that both ways in say the same thing.
23. As the maintainer, I want the note to say the sheet is read first and brings back ratings, hearts and what's been watched, so that I know what a scan after a reset restores.
24. As the maintainer, I want the path shown in the mono face with backslashes, like the folder shapes above it, so that I recognize it as a path I can find in Explorer.
25. As the maintainer about to reset, I want _What stays_ to list the sheet, so that I'm not surprised when a scan brings titles back.
26. As the maintainer about to reset, I want the sheet listed second, after the folders it lives in, so that the list reads in order.
27. As the maintainer who wants a truly clean start, I want the Reset dialog to tell me to delete `_meta` first, so that I know how to start clean without a new control.
28. As the maintainer who deleted `_meta/` and scanned, I want a fresh sheet written from the clean library at the end of the scan, so that the sheet matches what's in FamilyFlix again.
29. As the maintainer, I want the rest of the Reset dialog unchanged (title, subtitle, What goes, the refusal and the buttons), so that only the new item is new.
30. As the household, I want no snackbar or extra screen for any of this, so that browsing and scanning look as they always have.
31. As the maintainer, I want no toggle to turn the sheet off, so that a reset always stays recoverable.
32. As the maintainer on Linux, I want the note and the Reset dialog to say where the sheet is, so that I can find it even if my file manager sorts `_meta` among the M's.
33. As a developer, I want one rule in `folderLayout` that knows both names, so that every reader agrees on what a Meta folder is.
34. As a developer, I want CLAUDE.md's rule on who writes into a Library folder to name `_meta/familyflix-library.csv` and the Meta move, so that the boundary stays true.

## Implementation Decisions

- **`folderLayout`** (changed): `META_FOLDER` becomes `'_meta'`. A new `OLD_META_FOLDER = 'Meta'`, and `isMetaFolder(name)`, which is true for exactly those two names. Names are compared exactly, as today: `readdir` gives Windows' own spelling. `LIBRARY_SHEET_STEM` is unchanged.
- **`walkLibraryFolder`** (changed): a root folder passes in silence when `isMetaFolder(entry.name)`. `holdsMeta` recognizes an **Export folder** by either name. `sheetIn` reads `_meta/` first, then `Meta/`, and in each one the `.csv` before the `.xlsx`. It returns `null` when neither has a sheet. The walk's result shape is unchanged.
- **`sheetRootOf`** (changed): it returns the folder above the sheet when the sheet's folder is either name. Otherwise it returns the sheet's own folder.
- **`createLibrarySheet`** (changed), the **Meta move**: inside `writeOne`, after the three skips (unlisted, unscanned, unreachable) and before reading the sheet on disk, the writer settles which folder to write in:
  - If `Meta/` is a folder and `_meta` is absent, it makes one `rename` of `Meta/` to `_meta/`. If the rename lands, it writes in `_meta/`. If it is refused, it writes in `Meta/`.
  - Otherwise, if `_meta` is present or there is no `Meta/`, it writes in `_meta/`.
  - The move does not wait for a changed cell.
  - The rest of the write is today's: refuse a sheet the reader can't read, skip identical bytes, write a temporary file, then rename. It works on the settled folder joined with the sheet's name. The temporary file sits beside the sheet in that folder.
  - `LIBRARY_SHEET` follows `META_FOLDER`. The writer's public interface (`touch`, `flush`, `hold`, `release`) and its triggers are unchanged. The move needs no new trigger.
- **`writeExport`** (changed): it writes `_meta/familyflix-library.<csv|xlsx>` through `META_FOLDER`. An Export folder is never moved.
- **`createImporter`**: only the docblocks change. It reads through the walk and `sheetRootOf`.
- **`FolderShapes`** (changed), the **Sheet note**: a second paragraph after the folder-first rule, in that rule's style (`AcceptsRule`: 13px sans, faint ink, 8px above, line-height 1.5). The path `_meta\familyflix-library.csv` is in `Mono`. The copy is exactly the handoff's. It takes no props, so Import setup and the Library folders page's **Scan** draw the same note.
- **`ResetDialog`** (changed): `WHAT_STAYS` gains a plain string second: _Each library folder’s \_meta sheet: scanning the folder again brings its titles back as they were (delete \_meta first to start clean)_. No mono and no new markup.
- **Documents:** the prototype (`feat.ImportFlow.dc.html`, `page.LibraryFoldersPage.dc.html`, `page.SettingsPage.dc.html`) and `COMPONENT-SPEC.md` (its ImportFlow, LibraryFolders and ResetDialog rows) are amended to the handoff in phase 3. Also updated: CLAUDE.md's Architectural Boundaries line (the writer rewrites `_meta/familyflix-library.csv` and makes the one Meta move), the docblocks of every changed unit, and the checklist's step 56. The older handoff READMEs that say `Meta/` stay as history. The README is untouched.
- **Terms:** new: **Old Meta folder**, **Meta move**, **Sheet note**. Updated: **Meta folder**, **Library sheet**, **Library folder**, **Export folder**, **Export file**, **Sheet root**, **Title folder**, **Reset dialog**. All are already in the glossary (log 74).

## Testing Decisions

- A good test drives a unit through its public face and checks what a caller or the maintainer sees: the folders on disk after a write, the sheet the walk returns, the folder `sheetRootOf` answers, the words on screen. It never checks which helper ran.
- **`folderLayout`**: `isMetaFolder` accepts `_meta` and `Meta`, and refuses `meta`, `_Meta` and `Meta (2019)`. Prior art: `folderLayout.test.ts`.
- **`walkLibraryFolder`**: `_meta/` and `Meta/` both pass in silence. A folder holding either is an Export folder. The sheet comes from `_meta/` when there, else from `Meta/`, `.csv` before `.xlsx` in each. Prior art: `walkLibraryFolder.test.ts` and its temp-folder fixtures.
- **`sheetRootOf`**: both names answer the folder above. Prior art: `sheetRootOf.test.ts`.
- **`createLibrarySheet.metaMove.test.ts`**, a new suite named for its concern:
  - a held `Meta/` is moved whole, a second file in it is moved too, and the sheet is written into `_meta/`
  - the folder is moved even when the bytes match
  - with both folders present, `Meta/` is untouched and `_meta/` is written
  - a refused rename (a mocked `rename`) writes into `Meta/`, and the next write moves it
  - an unscanned or unreachable folder is not moved

  Prior art: `createLibrarySheet.test.ts`, `createLibrarySheet.unreadable.test.ts`.

- **`writeExport` and the export route tests**: the sheet lands under `_meta/`. Prior art: their current suites.
- **Importer suites**: they keep their `Meta/` fixtures where those stand for an old library or an old Export (`oldExport`, `exportFolder`, `sheetRoot`). The round-trip suites read `_meta/`.
- **`FolderShapes`**: the Sheet note is drawn, with its path in mono. Prior art: `FolderShapes.test.tsx`.
- **`ResetDialog`**: _What stays_ lists four items, with the sheet second. Prior art: `ResetDialog.test.tsx`.
- Every slice starts RED (`tdd`). The acceptance is the walk in the shell:
  - A fresh Library folder, scanned and rated, grows `_meta/familyflix-library.csv`, first in Explorer.
  - A copied library with `Meta/` is moved on scan.
  - With the sheet open in Excel, a scan still records into `Meta/`, and the next rating after Excel closes moves it.
  - An old Export with `Meta/` imports with its art.
  - Import setup and the Library folders page draw the note, and the Reset dialog lists four items.
  - A reset then a scan brings the library back.

## Out of Scope

- A _Start clean_ choice, or any scan mode that ignores the sheet (Q11): deleting `_meta/` by hand starts clean.
- An opt-out toggle for the sheet (Q12).
- A folder name chosen for Linux sorting (Q9).
- A sheet viewer or an _Open folder_ button.
- Any change to the sheet's columns or to when it is written.
- Moving `Meta/` at startup, or in an Export folder.
- A warning when both `_meta/` and `Meta/` are present.
- Rewriting older handoff READMEs that say `Meta/`.

## Further Notes

- Trade-offs accepted:
  - The writer now renames a folder once, a second kind of write inside a Library folder, and CLAUDE.md's rule must say so.
  - Every reader knows two names for good, since an Export written before this step may turn up years later.
  - A Title folder that starts with certain punctuation (`(500) Days of Summer`, `'71`) may sort above `_meta`, which is still at the top of the list.
- Implementation plan (log 74):
  1. The new name, both read: `folderLayout`, the walk, `sheetRootOf`, the writer and the Export.
  2. The Meta move: the writer's rename and its refused path.
  3. Said aloud: the prototype and `COMPONENT-SPEC.md` amended, the Sheet note, the Reset dialog's item, the documents, and the walk in the shell.
