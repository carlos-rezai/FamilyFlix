> **Initiative:** `library-folders`
> **Design log:** `docs/design-logs/30-library-folders.md`
> **Build order:** step 14

## Problem Statement

I am the maintainer, and the family's films and shows live in a few top
folders, spread over more than one drive. Today the only way to bring a
folder's worth of titles into FamilyFlix is Bulk import. It wants a
spreadsheet and **one** typed root. Without a spreadsheet, every film folder
becomes a `no-row` Problem, and I have to Resolve each one by hand. Once the
library is in, there is nothing that remembers where it came from beyond a
single setting. When a new season or a new film lands in one of those folders,
I have to run the whole import again from a typed path.

The app also remembers only one **Library root**. If I import a second folder,
it overwrites the first. Every title imported from the first folder then
points at the wrong place, so a **Sync** writes its posters and its Metadata
sheet against a folder those titles never lived in.

What I want: link a few folders once, press one button to bring in whatever
is new in any of them, and let the TMDB Sync fill in everything the folder
names can't.

## Solution

A new Settings sub-page, **Library folders** (`/settings/folders`), reached
from a new row in the Settings hub's Library group.

- **The list.** Each **Library folder** is a row showing its path in mono,
  how many titles came from it, and a ✕. If its drive is unplugged, the row
  says _Can't be reached right now_. I add a folder by typing its path. In the
  desktop app I can also press _Browse…_ and pick several folders in one
  native dialog, which adds them all at once. A folder that is the same as,
  inside, or containing one already listed is refused, with a sentence that
  names the clash. Removing a folder keeps every title that came from it.
- **The scan.** One press of _Scan folders_ walks every listed folder, in the
  same shapes Bulk import already reads: films in their own folders, and shows
  laid out by season folder or as loose tagged episodes. It copies every new
  title into the library, named after its folder. No spreadsheet is needed,
  and no `no-row` Problems appear. The run shows on `/import` under the
  heading _Scan library folders_, with the same progress console and Review
  step. Scanning again adds only what is new, including a new season dropped
  into a show's folder. An unplugged folder is skipped with a warning line,
  and the other folders are still scanned.
- **Into a Sync.** With _Also fetch metadata and posters from TMDB_ ticked,
  _Finish_ hands straight to a full-library Sync. That makes the whole loop
  three presses: _Browse…_, _Scan folders_, _Finish_.
- **The Sync, per folder.** Each title's `poster.jpg` goes back into its own
  Source folder, inside its own Library folder. Each Library folder gets its
  own `familyflix-metadata.csv` holding that folder's films. A folder that
  can't be written loses only its own targets.
- **The spreadsheet import joins in.** Its typed root becomes a Library
  folder, or is recognised as one already listed or as a folder inside one. The
  single remembered root is gone, carried into the list by a migration.

## User Stories

1. As the maintainer, I want a Library folders page under Settings, so that the folders my movies and series live in are kept in one place I can come back to.
2. As the maintainer, I want a _Library folders_ row in the Settings hub's Library group, second after _Add a title_, so that I can find the page.
3. As the maintainer, I want the page's Back to land on the Settings hub when there is no history, so that it behaves like the Codecs page.
4. As the maintainer, I want a lede that tells me scanning copies new titles in and never changes my folders, so that I'm not afraid to link the family's own drives.
5. As the maintainer, I want to type a folder's absolute path and press _Add_, so that I can add a folder even when no native dialog is available.
6. As the maintainer, I want _Browse…_ to open the system folder dialog, so that I don't have to type long paths.
7. As the maintainer, I want to pick several folders in that one dialog, so that I can add a whole set of drives at once.
8. As the maintainer, I want each folder picked in the dialog added as if I had typed it, so that each one is checked and refused on its own.
9. As the maintainer, I want _Browse…_ hidden when the app runs in a plain browser, so that I'm never shown a button that can't work.
10. As the maintainer, I want cancelling the dialog to add nothing and show nothing, so that changing my mind costs nothing.
11. As the maintainer, I want an empty path refused with a sentence, so that I know why nothing was added.
12. As the maintainer, I want a relative path refused with a sentence, so that a folder is never remembered against the app's working directory.
13. As the maintainer, I want a path that isn't a readable folder refused with _No folder at that path._, so that a typo doesn't become a dead row.
14. As the maintainer, I want a folder already on the list refused with _That folder is already in your library folders._, so that it isn't listed twice.
15. As the maintainer, I want a folder inside a listed folder refused with a sentence naming the folder that contains it, so that no title is ever found twice.
16. As the maintainer, I want a folder that contains a listed folder refused with a sentence naming the one it holds, so that the same rule holds the other way round.
17. As the maintainer, I want those path comparisons to ignore case on Windows, so that `e:\movies` and `E:\Movies` are recognised as the same folder.
18. As the maintainer, I want the refusal shown as one red line under the field, keeping what I typed, so that I can correct it.
19. As the maintainer, I want the refusal cleared when I add successfully, so that an old error doesn't linger.
20. As the maintainer, I want each folder drawn as a Folder row with its path in mono, so that I can read exactly which folder it is.
21. As the maintainer, I want each row to say how many titles came from it, so that I can see a scan worked.
22. As the maintainer, I want a folder whose drive is unplugged kept on the list and drawn _Can't be reached right now_, so that one missing drive doesn't erase my setup.
23. As the maintainer, I want that reachability read each time I open the page, so that plugging the drive back in fixes the row without any other action.
24. As the maintainer, I want the rows listed in the order I added them, so that the list doesn't jump around.
25. As the maintainer, I want _No folders yet._ when the list is empty, so that the empty page explains itself.
26. As the maintainer, I want the ✕ on a row labelled with its path, so that a screen reader says which folder it removes.
27. As the maintainer, I want removing a folder to keep every title that came from it, so that unlinking a drive never empties the library.
28. As the maintainer, I want no confirm dialog on remove, so that undoing it is just adding the folder back and scanning.
29. As the maintainer, I want a removed folder's titles re-linked when I add it back and scan, so that its Sync write targets come back.
30. As the maintainer, I want the page to show nothing until the list has loaded, so that it follows the Settings hub's read rule.
31. As the maintainer, I want the accepted folder shapes shown on the Scan card, the same block Import setup shows, so that I know how my folders have to be laid out.
32. As the maintainer, I want _Scan folders_ disabled when no folder is listed, so that I can't start an empty run.
33. As the maintainer, I want one press to scan every listed folder, so that keeping the library current is one action.
34. As the maintainer, I want the scan shown on `/import` with the same progress console, stepper and Activity log, so that a scan reads like the import I already know.
35. As the maintainer, I want the heading to read _Scan library folders_ and the lede _Finding new movies and series in your library folders._ during a scan, so that I can tell it from a spreadsheet import.
36. As the maintainer, I want the log to open with one _Scanning_ line per folder, so that I can see which folders the run covers.
37. As the maintainer, I want each new film named after its folder, with the year read from the folder name, so that a scan needs no spreadsheet.
38. As the maintainer, I want each new show named after its folder and imported with its seasons and episodes, as Bulk import does for an unnamed show, so that films and shows can share one folder.
39. As the maintainer, I want a scan to raise no `no-row` and no `missing-meta` Problems, so that the Review step lists only what actually needs me.
40. As the maintainer, I want a copy that breaks to still be a `failed` Problem, so that I know a title didn't make it.
41. As the maintainer, I want an episode no rule can number to still be an `unplaced` Problem, so that it isn't silently dropped.
42. As the maintainer, I want a title the library already holds from the same folder skipped with the _Already in library_ line, even if a Sync has since changed its title or year, so that a rescan never adds anything twice.
43. As the maintainer, I want a title the library already holds by title and year, imported earlier from a sheet or added by hand, linked to the folder it was found in, so that the Sync can write its poster back.
44. As the maintainer, I want a show I already hold to gain the new episodes a rescan finds, so that a new season arrives with the next scan.
45. As the maintainer, I want an unreachable folder skipped with `⚠ Can't reach E:\Movies — skipped` while the rest are scanned, so that one unplugged drive doesn't stop the run.
46. As the maintainer, I want the run to reach review even when no folder could be reached, so that the run always ends the same way.
47. As the maintainer, I want _Scan folders_ while another run is in flight to take me to that run, so that two runs never copy into the library at once.
48. As the maintainer, I want _Also fetch metadata and posters from TMDB_ on the Scan card, with the same hint Import setup gives about a stored key, so that I can chain the scan into a Sync.
49. As the maintainer, I want _Finish_ with the box ticked to replace the page with `/enrich?scope=all`, so that the Sync fills in everything the folder names couldn't.
50. As the maintainer, I want _Finish_ without the box to land on the library, so that it behaves like a spreadsheet import's Finish.
51. As the maintainer, I want Back from a scan in progress to step to the folders page, so that the run is still re-attachable from `/import`.
52. As the maintainer, I want a spreadsheet import's root added to my Library folders, so that a collection I migrated from Excel stays current with a later scan.
53. As the maintainer, I want a spreadsheet import whose root is already listed to use that folder, so that nothing is listed twice.
54. As the maintainer, I want a spreadsheet import whose root lies inside a listed folder to record its titles against the containing folder, so that a later scan of that folder recognises them.
55. As the maintainer, I want a spreadsheet import whose root contains a listed folder refused on the root field with a sentence telling me what to do, so that the folders never overlap.
56. As the maintainer, I want the folder I imported from before this release carried into the list automatically, with its titles still linked, so that the update loses nothing.
57. As the maintainer, I want each title's poster written into its own Source folder inside its own Library folder, so that the Sync stops depending on whichever root was imported last.
58. As the maintainer, I want one `familyflix-metadata.csv` per Library folder, holding that folder's films, so that importing a folder with its own sheet round-trips.
59. As the maintainer, I want the Sync to check each reachable folder for write access at the start and log what it will or won't write there, so that I know in advance where my folders will be touched.
60. As the maintainer, I want a folder that can't be written to lose only its own sheet and posters, so that one read-only drive doesn't stop the others.
61. As the maintainer, I want a title whose folder is gone or unreachable to log _no source folder on record, poster skipped_, so that the Sync carries on.
62. As the maintainer, I want the Sync setup's Write target rows to name the folder when there is one, and to say _in each library folder_ when there are several, so that the setup tells the truth about where it writes.
63. As the maintainer, I want the two Write target rows hidden when no Library folder is reachable, so that the setup offers only what a Sync can do.
64. As a family member, I want titles from a scan to appear on the Movies and Series tabs like any other, so that I don't need to know where they came from.
65. As a family member, I want the library to keep working when a Library folder's drive is unplugged, so that the copies the app owns keep playing.

## Implementation Decisions

**Copy in, never play in place.** A Library folder is a remembered source. A
scan copies each new title's files into the **Managed media directory**, as
Bulk import does. Every **Stored path**, the image route, Delete and the Sync's
Stored-path writes are unchanged.

**Migration 6.**

- A new table `library_folders (id TEXT PRIMARY KEY, path TEXT NOT NULL UNIQUE,
added_at TEXT NOT NULL)`. `id` is a UUID. `path` is absolute and resolved.
  `added_at` is ISO.
- `movies` and `series` each gain `library_folder_id TEXT REFERENCES
library_folders(id) ON DELETE SET NULL`.
- `source_folder` stays, but is now relative to the title's own Library
  folder.
- **The carry-over:** when `settings.library-root` is set, the migration
  inserts it as the first Library folder, sets `library_folder_id` on every
  movie and series whose `source_folder` is not null, and then deletes the
  key.
- `library_folders.path` is the only absolute path in the database. It is the
  maintainer's own choice of folder, as `FAMILYFLIX_MEDIA_PATH` is. Title rows
  stay relative.

**`library/folders/` (new storage slice).**

- `libraryFolders()` returns the folders in the order added, each with its
  title count (movies plus series).
- `addLibraryFolder(path)` and `removeLibraryFolder(id)`.
- Remove nulls `library_folder_id` and `source_folder` on the folder's titles
  and deletes the row, in one transaction.
- The slice is composed into the storage the way `settings`, `enrich` and
  `series` are.

**`folderOverlap` (new, pure, under `library/folders/`).**

- It takes a candidate path and the listed paths, and returns
  `'same' | 'inside' | 'contains' | null`, along with the folder it clashes
  with.
- Paths are compared resolved, case-insensitively on Windows, with a
  separator-aware prefix test, so `E:\Movies2` is not inside `E:\Movies`.

**`readableFolder` (new, `media/`).**

- The importer's private `checkRoot` is extracted here.
- It reports whether an absolute path is an existing, readable directory, as a
  value, not a throw.
- The folder add, the spreadsheet import's root check and the per-folder
  `reachable` read all use it.

**Settings slice.** `libraryRoot` and `setLibraryRoot` are removed, and so is
the `library-root` key. One place remembers folders.

**`library/enrich/`.**

- `setSourceFolder(id, folderId, sourceFolder)` writes both columns in one
  call.
- `sourcePath(id)` joins `library_folders.path` with `source_folder` in one
  query. It answers `null` for a title with no folder.

**`createImporter`: the second start.**

- `scan(folders, enrich?)` sits beside `start(sheet, root, enrich?)`. It uses
  the same state machine, polling, Review step and Current run, and the same
  refusal while a run exists.
- `ImportRun` gains `source: 'sheet' | 'folders'`.
- **A Folder scan:**
  - walks each reachable folder in the order added. An unreachable one is
    skipped with the warning line `⚠ Can't reach <path> — skipped`.
  - opens the log with one `Scanning   <path>` line per folder, in place of the
    sheet's _Reading_ line.
  - tags each `MovieFolderScan` with the Library folder its walk began at.
  - names every film folder `titleGuess(name)` / `yearInName(name)`, as log 22
    Q19 names an unnamed show. No `no-row` and no `missing-meta` are raised;
    `failed` and `unplaced` still are.
- **Already in library, two rules in order:**
  1. The title's `library_folder_id` and `source_folder` equal this folder's
     and this Source folder's. It is held, whatever its title says now.
  2. Otherwise, a match by title key and year. The held title then gets its
     folder and `source_folder` set.

  Both are skipped with the existing info line. A held show still gains new
  episodes.

- **`resolve`'s Found-file path check** becomes "under one of the run's
  folders".
- **The spreadsheet start** looks its typed root up against the list:
  - the same as a listed folder → that folder
  - inside a listed folder → the containing folder, with `source_folder`
    relative to it
  - neither → the root is added to the list
  - containing a listed folder → refused, as `400 { field: 'root' }`, with
    _That folder holds `<path>`, which is already a library folder. Import
    from `<path>`, or remove it from your library folders first._

  This replaces `setLibraryRoot`.

- `walkLibraryRoot`'s rule is unchanged: a folder holding a video is a Source
  folder, and the folder itself is always descended. So a loose top-level video
  is not a film, and `groupShows` is untouched.

**API contract.**

| Route                                       | Answer                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/library-folders`                  | `200 LibraryFolder[]`, in the order added, with `reachable` read afresh                                                         |
| `POST /api/library-folders { path }`        | `201 LibraryFolder` · `400` for an empty path, a relative path or a path that isn't a readable directory · `409` for an overlap |
| `DELETE /api/library-folders/:id`           | `204` · `404`                                                                                                                   |
| `POST /api/library-folders/scan { enrich }` | `201 ImportRun` · `400` with no folders · `409` while a Current run exists                                                      |

- Every refusal is one sentence: _That folder is already in your library
  folders._, _That folder is inside `<path>`, which is already a library
  folder._, _That folder holds `<path>`, which is already a library folder._,
  _No folder at that path._
- An add takes one path per request. Several dialog picks are posted one after
  another.
- `POST /api/import` gains the `root` overlap refusal above.

**`createEnrichment`, over several folders.**

- A title's on-disk folder is `sourcePath(id)`. With no folder, or with its
  folder unreachable, it gets the existing _no source folder on record, poster
  skipped_ line.
- At start, the Sync runs a write check once per reachable folder and logs one
  dry-run line for each: `Will write familyflix-metadata.csv to <path>` or
  `Can't write to <path> — the sheet and posters will be skipped`. A folder
  that fails the check loses only its own targets.
- Each folder gets one **Metadata sheet**, holding that folder's films, and
  only when the file is absent. Series stay out of it.
- `EnrichmentSummary.libraryRoot: string | null` becomes `libraryFolders:
string[]`, the paths of the reachable folders.

**Types.**

- `src/types/libraryFolders.ts` is new and in both build targets. It holds
  `LibraryFolder { id; path; titleCount; reachable }`, `FOLDER_CHANNELS = {
pick: 'familyflix:folders:pick' }` and `FolderBridge { pick():
Promise<string[]> }`.
- `src/types/familyflix.d.ts` declares `{ updates, folders }`.
- `ImportRun.source` and `EnrichmentSummary.libraryFolders` change as above.

**The native picker.**

- `electron/pickFolders/` (new, pure) maps the dialog's answer to `string[]`.
  A cancelled dialog gives `[]`.
- `main.ts` answers the channel with `dialog.showOpenDialog(window, { title:
'Add library folders', properties: ['openDirectory', 'multiSelections'] })`
  and only wires.
- `preload.ts` exposes `{ updates, folders }`. The window's `sandbox` and
  `contextIsolation` settings are unchanged.

**The renderer, in `features/import-export/`.** Library folders are the
importer's sources, so no feature line is crossed.

- **`folderBridge/`** is `updateBridge`'s twin: the one reader of
  `window.familyflix?.folders`, answering `null` in a browser.
- **`useLibraryFolders/`** returns `{ folders, add, remove, adding, refusal }`.
  `folders` is `null` until the read lands.
  - `add(path)` posts one path, appends the echo and clears the refusal.
    Refused, it holds the route's sentence.
  - `remove(id)` deletes and drops the row.
- **`FolderRow/`** is a presentational molecule in `CodecRow`'s shape: the 40px
  accent tile with the folder glyph, the path in mono, then the line. The line
  reads _N titles_, or _Can't be reached right now_ in `danger`. Last comes the
  `RemoveButton`, labelled _Remove `<path>`_.
- **`LibraryFolders/`** is the organism, on the Settings furniture
  (`section.styles.ts`) under the maintainer header. From top to bottom:
  - the header: Back, **Library folders**, and the lede.
  - Group **Folders**: the Folder rows, a divider, then the add row. The add
    row is a mono `TextField` with the folder glyph, _Add_, and _Browse…_ when
    the bridge exists. The refusal sits as a 13px `danger` line under it. With
    no folders, _No folders yet._ sits above the add row.
  - Group **Scan**: `FolderShapes`, `EnrichCheckCard`, and **Scan folders**
    (`primary`, `lg`), disabled with no folders.
- **Scan folders** posts the scan, then pushes `/import`. A `409` pushes too,
  which shows the run that already exists.
- **`EnrichCheckCard/` and `FolderShapes/`** are extracted from `ImportSetup`
  on their second caller and stay feature-local. `ImportSetup` composes both,
  unchanged on screen.
- **`ImportFlow`** reads `run.source` for its heading and lede only. _Scan
  library folders_ / _Finding new movies and series in your library folders._
  for a scan; the existing copy for a sheet. _Finish_ is unchanged.
- **Feature `api/`** gains `fetchLibraryFolders`, `addLibraryFolder`,
  `removeLibraryFolder` and `startFolderScan`, with one caller each.

**Elsewhere in the renderer.**

- `pages/LibraryFoldersPage` is `MaintainerLayout` at 780 around
  `LibraryFolders`, on the route `/settings/folders`, with its Landing on
  `/settings`.
- `LibrarySection` gains the Action row 📁 _Library folders_, second, with the
  line _The folders your movies and series are kept in._
- `EnrichmentSetup` draws the Write target lines from `libraryFolders`:
  - one folder: today's two path lines
  - several: _familyflix-metadata.csv in each library folder_ and _`<movie
folder>`\poster.jpg in each library folder_
  - none: no rows, and `EnrichmentFlow` sends both flags `false`

**Prototype first.** Before phase 1 is built:

- a new `page.LibraryFoldersPage.dc.html`: the empty card, two folders with
  one unreachable, a refusal line, and the page with and without _Browse…_
- a new `mol.FolderRow.dc.html` with its `data-props`
- `page.SettingsPage` gains the Library group's row
- `feat.ImportFlow` gains the scan heading and lede
- `feat.EnrichmentFlow` gains the several-folders lines
- `COMPONENT-SPEC.md` gets the route, the molecule and the bridge

**Phases** (from the log's plan):

1. **A remembered list, end to end.** The prototype amendment, migration 6
   with the carry-over, `library/folders/`, `folderOverlap`, `readableFolder`,
   the three list routes, the types, `useLibraryFolders`, `FolderRow`,
   `LibraryFolders` with the typed add and remove, the page, the route and the
   Settings row.
2. **The Folder scan.** `Importer.scan`, `ImportRun.source`, titles named off
   their folders, the Source-folder rule, `setSourceFolder` with the folder id,
   unreachable folders skipped, the scan route, _Scan folders_ with
   `FolderShapes`, the `/import` heading by source, and the spreadsheet root
   joining the list.
3. **The Sync over folders.** `sourcePath` joined, the per-folder check,
   posters and Metadata sheets, `libraryFolders` on the summary, the setup's
   lines, and `EnrichCheckCard` on the folders page with _Finish_ into
   `/enrich?scope=all`.
4. **The native picker.** `FOLDER_CHANNELS`, `pickFolders`, the wiring in
   `main.ts` and `preload.ts`, `folderBridge`, `fakeFolderBridge`, and
   _Browse…_ posting each picked folder.

## Testing Decisions

Good tests here assert what a user or a client can observe: what the page
draws and enables, what a press sends and where it lands, what the wire
answers, what the database and managed storage hold after a run, what the run's
log says, and what a pure function returns. They don't assert how a hook
stores its state or which helper was called. Every suite below is written RED
first.

**`folderOverlap`** (pure). Tested over a table:

- same path
- inside
- containing
- unrelated siblings
- a shared name prefix (`E:\Movies` vs `E:\Movies2`)
- a trailing separator
- case on Windows

Prior art: `mediaFilePath`'s under-root cases.

**`pickFolders`** (pure). A cancelled answer gives `[]`, and several picks
come back in order. Prior art: `downloadPath`'s and `windowPolicy`'s suites.

**`readableFolder`.** Over a sandbox: a directory, a file, a missing path and
a relative path. The importer's existing root-check cases must still pass.
Prior art: the importer's `checkRoot` cases and `spaceUsed`'s sandbox suite.

**Migration 6.**

- A database at version 5 with `library-root` set and titles with and without
  `source_folder` migrates to one folder. Exactly the titles that had a
  `source_folder` are linked, and the key is gone.
- With no key set, the migration lists no folders.

Prior art: the migration suites in `db/`.

**`library/folders/`.**

- Add, then list in order with title counts across movies and series.
- Remove nulls both columns on that folder's titles only, and keeps the
  titles.
- A unique-path violation is refused.

Prior art: the `settings` and `enrich` slice suites.

**`library/enrich/`.** `setSourceFolder` writes both columns. `sourcePath`
joins them, and answers `null` with no folder and after the folder is removed.
Prior art: `enrich.test.ts`.

**Routes.** A route suite over a sandbox covers:

- each `/api/library-folders` answer and each refusal sentence
- `reachable` turning false when the directory is removed
- `404` on an unknown id
- the scan route's `400` and `409`
- `POST /api/import`'s new `root` refusal

Prior art: the settings and enrichment route suites.

**`createImporter.scan`.** Over the existing film and series fixtures, copied
into two sandboxed folders.

- A first scan imports films named off their folders, and shows with their
  episodes, recording each title's folder and `source_folder`.
- The log opens with one _Scanning_ line per folder.
- No `no-row` or `missing-meta` is raised.
- A second scan adds nothing, even after a title and year are edited in the
  database.
- An episode added to a held show's folder arrives on rescan.
- A title already held by title key and year gets linked.
- An unreachable folder is skipped with its warning, and the other folder is
  still scanned.
- `source` is `'folders'`.
- A spreadsheet start covers its four root cases: same, inside, neither, and
  containing (refused).

Prior art: `createImporter`'s suites, `libraryFixture`, `seriesFixture` and
`heldCopy`.

**`createEnrichment`.** Over two sandboxed folders:

- posters land in each title's own Source folder
- one Metadata sheet per folder holds only that folder's films
- a read-only folder logs its _Can't write_ line and loses only its own
  targets
- an unreachable folder's titles log the skip line
- the summary lists the reachable paths

Prior art: the enrichment suites, `writeBack`'s suite and `fakeTmdb`.

**`folderBridge`.** It answers `null` without `window.familyflix`, and the
bridge when present. Prior art: `updateBridge`'s suite.

**`useLibraryFolders`.** It returns `null` until the read lands. An add
appends the echo and clears the refusal. A refused add holds the sentence and
keeps the list. A remove drops the row. Prior art: `useCapabilities`'s and
`useStorageReport`'s suites, and `fakeResponse`.

**`FolderRow`.** It draws the path, _N titles_, the unreachable line in
`danger`, and the ✕'s label, and a press calls back. Prior art: `CodecRow`'s
suite.

**`LibraryFolders`** (the organism, through presses).

- The empty state shows _No folders yet._ and a disabled _Scan folders_.
- A typed add draws a row.
- A refusal shows its line under the field.
- Remove drops the row.
- _Browse…_ is drawn only with `fakeFolderBridge`, and posts each picked path
  in order. A cancelled pick posts nothing.
- _Scan folders_ posts with the box's value and pushes `/import`, on `201` and
  on `409` alike.

Prior art: `CodecManager`'s suite, `LocationProbe` and `fakeResponse`.

**`EnrichCheckCard` and `FolderShapes`.** `ImportSetup`'s existing suite still
passes unchanged. Each extracted unit gets its own small suite.

**`ImportFlow`.** A run with `source: 'folders'` draws the scan heading and
lede, and a sheet run draws the existing copy. Prior art: `ImportFlow`'s
suite and `makeImportRun`.

**`EnrichmentSetup`.** The Write target lines cover the zero, one and several
folder cases. Prior art: its existing suite and `makeEnrichmentRun`.

**`LibrarySection`.** The new row is second, with its line, and it pushes
`/settings/folders`. Prior art: its existing suite.

**Manual.** In an Unpackaged run, three folders picked in one dialog are
added. A scan with the box ticked ends in a Sync that writes a sheet into each
folder.

## Out of Scope

- Playing media where it lies, or referencing it in place. That is a storage
  model of its own, on the Roadmap beside **Move the media folder**.
- Watching folders for changes, or scanning on launch. A scan is always the
  maintainer's press.
- A per-folder Scan button.
- Loose video files at a Library folder's top level.
- Reading a spreadsheet found inside a Library folder.
- A _Browse…_ button on Import setup's own fields.
- Per-folder TMDB settings.
- Removing a folder's titles together with the folder. That is a Delete, one
  title at a time.
- Step 15 of the build order (Export options).

## Further Notes

- **The rename is mechanical and lands in the refactor**: `walkLibraryRoot`
  becomes `walkLibraryFolder`, and the glossary's **Library root** is retired
  for **Library folder**. Import setup's field keeps its drawn caption,
  _Movies root folder_.
- **Accepted:** the collection sits on disk twice: in the family's folders,
  and in the Managed media directory on the system drive. A large scan can
  fill that drive. A copy that fails is a `failed` Problem, not a crash.
- **Accepted:** a title named off its folder is only as good as the folder's
  name until a Sync runs. A folder name TMDB can't place becomes a `missing`
  Decision in the Sync's review.
- **Accepted:** the importer has two starts and one more identity rule, and a
  title's on-disk origin is now a join.
- Per the standing rule, step 14's ✅ in CLAUDE.md and the README waits for the
  refactor to close, not for the build issues.
