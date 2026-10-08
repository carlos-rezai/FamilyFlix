# Plan: Library folders — link several top folders, scan them for what is new, and Sync each in place

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/267

Today the app remembers one **Library root**, and only a spreadsheet import
can bring a folder's titles in. Log 30 replaces that with a list of
**Library folders** on a new Settings sub-page. One press of _Scan folders_
copies in whatever is new in any of them, with no spreadsheet. The TMDB Sync
then writes each title's poster and each folder's Metadata sheet back where
that title came from.

The slicing goes from the list outwards:

**a remembered list** (Phase 1) → **the Folder scan** (Phase 2) → **the
spreadsheet import joins the list** (Phase 3) → **the Sync over folders**
(Phase 4) → **the native picker** (Phase 5) → **the close** (Phase 6).

The log's plan had four phases. Two changes were made here:

- **The spreadsheet root is its own slice** (Phase 3). The log folded it into
  the Folder scan.
- **The carry-over moves out of migration 6.** The PRD has migration 6 delete
  `library-root` in Phase 1. But the importer writes that key and the Sync
  reads it until Phases 3 and 4, so the Sync would write no posters or sheets
  for two phases. Migration 6 now holds only the table and the two columns.
  **Migration 7**, in Phase 4, is the carry-over, and lands with the code that
  stops reading the key.

## Running the phases

Phases 1–5 run AFK under `issue-loop`, as the Add a series plan did.

- **No prototype-only slice.** The prototype amendment goes into Phase 1's
  **build** step. The GREEN subagent amends `docs/handoff/` first and then
  builds to the amended files. Both land in the slice's `feat:` commit, so
  every later phase builds against a prototype that is already amended. The
  amendment covers the whole initiative:
  - `page.LibraryFoldersPage.dc.html` is new. It draws the empty card, two
    folders with one unreachable, a refusal line, and the page with and
    without _Browse…_.
  - `mol.FolderRow.dc.html` is new, with its `data-props`.
  - `page.SettingsPage` gains the Library group's _Library folders_ row.
  - `feat.ImportFlow` gains the scan heading and lede.
  - `feat.EnrichmentFlow` gains the lines for several folders.
  - `COMPONENT-SPEC.md` gets the route, the molecule and the bridge.
- **No HITL marks in Phases 1–5.** Every acceptance criterion is a Vitest
  assertion, a typecheck or a file diff. Two checks are the maintainer's own:
  three folders picked in one native dialog in an Unpackaged run, and a
  ticked scan ending in a Sync that writes a sheet into each folder. Nothing
  waits on either.

Phase 6 is docs-only, so the loop stops there by design. Per the standing
rule, a feature is Done only after its refactor. The close is therefore the
refactor's last commit, made after `request-refactor-plan` and `refactor`.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Copy in, never play in place.** A Library folder is a remembered source.
  A scan copies each new title into the **Managed media directory**, as Bulk
  import does. **Stored paths**, the image route, Delete and the Sync's
  Stored-path writes are all unchanged.
- **Client routes.**
  - **`/settings/folders`** (new) is the **Library folders** page:
    `MaintainerLayout` at 780 around the `LibraryFolders` organism. Its
    **Landing** is `/settings`, as the Codecs page's is.
  - **`/import`** shows either kind of run. Its heading and lede follow
    `run.source`, and _Finish_ is unchanged.
  - **`/enrich?scope=all`** is where _Finish_ goes when _Also fetch metadata
    and posters from TMDB_ is ticked.
- **HTTP routes.**

  | Route                                       | Answer                                                                                                                          |
  | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
  | `GET /api/library-folders`                  | `200 LibraryFolder[]`, in the order added, with `reachable` read afresh                                                         |
  | `POST /api/library-folders { path }`        | `201 LibraryFolder` · `400` for an empty path, a relative path or a path that isn't a readable directory · `409` for an overlap |
  | `DELETE /api/library-folders/:id`           | `204` · `404`                                                                                                                   |
  | `POST /api/library-folders/scan { enrich }` | `201 ImportRun` · `400` with no folders · `409` while a Current run exists                                                      |
  | `POST /api/import` (changed)                | gains `400 { field: 'root' }` for a root that contains a listed folder                                                          |
  - Every refusal is one sentence:
    - _That folder is already in your library folders._
    - _That folder is inside `<path>`, which is already a library folder._
    - _That folder holds `<path>`, which is already a library folder._
    - _No folder at that path._
    - The import root's refusal: _That folder holds `<path>`, which is
      already a library folder. Import from `<path>`, or remove it from your
      library folders first._
  - An add takes one path per request. Several dialog picks are posted one
    after another.

- **Schema.**
  - **Migration 6** (Phase 1) adds the table `library_folders (id TEXT
PRIMARY KEY, path TEXT NOT NULL UNIQUE, added_at TEXT NOT NULL)`, and
    `library_folder_id TEXT REFERENCES library_folders(id) ON DELETE SET
NULL` on both `movies` and `series`. It inserts no rows.
  - **Migration 7** (Phase 4) is the carry-over. When `settings.library-root`
    is set, it inserts that path as a Library folder unless it is already
    listed. It then sets `library_folder_id` on every movie and series that
    has a `source_folder` but no folder yet, and deletes the key.
  - `source_folder` is relative to the title's own Library folder.
  - `library_folders.path` is the only absolute path in the database. It is
    the maintainer's own choice of folder, as `FAMILYFLIX_MEDIA_PATH` is.
- **Path rules.**
  - **`folderOverlap`** (pure) answers `'same' | 'inside' | 'contains' |
null`, with the folder it clashes with. It compares resolved paths,
    ignores case on Windows, and uses a separator-aware prefix test, so
    `E:\Movies2` is not inside `E:\Movies`.
  - **`readableFolder`** (`media/`) answers whether an absolute path is an
    existing, readable directory, as a value and never a throw. Three callers
    use it: the folder add, the spreadsheet root check and the `reachable`
    read.
- **The importer has two starts.** `start(sheet, root, enrich?)` and
  `scan(folders, enrich?)` share one state machine, one Current run, one
  Review step and one refusal while a run exists.
  - **Already in library**, two rules in order:
    1. The title's folder and Source folder equal the ones being scanned.
       Whatever its title says now, it is held.
    2. Otherwise a match by title key and year. The held title is then linked
       to this folder and Source folder.
  - A held show still gains new episodes.
- **The Sync over folders.**
  - A title's on-disk folder is a join of `library_folders.path` and
    `source_folder`.
  - The write check runs once per reachable folder, at start.
  - Each folder gets one **Metadata sheet**, holding only that folder's
    films.
  - A folder that can't be written loses only its own targets.
- **The shell seam.** One new IPC channel, `familyflix:folders:pick`. The
  preload exposes `{ updates, folders }`. The window's `sandbox` and
  `contextIsolation` settings are unchanged.
- **Key models** (`src/types/`, both build targets):
  - `LibraryFolder { id; path; titleCount; reachable }`.
  - `FOLDER_CHANNELS = { pick: 'familyflix:folders:pick' }`.
  - `FolderBridge { pick(): Promise<string[]> }`.
  - `ImportRun.source: 'sheet' | 'folders'`.
  - `EnrichmentSummary.libraryRoot: string | null` becomes `libraryFolders:
string[]`, the paths of the reachable folders.
- **Feature home.** Library folders are the importer's sources, so the
  renderer side lives in `features/import-export/`. Its four wire calls stay
  in the feature's `api/`, with one caller each.

---

## Phase 1: A remembered list, end to end

**User stories**: 1–5, 11–30

### What to build

The maintainer can keep a list of folders. Nothing is scanned yet.

- **Prototype.** The whole initiative's amendment, as listed under _Running
  the phases_, lands first.
- **Server.**
  - **Migration 6**, as specified above.
  - **The `library/folders/` storage slice.**
    - It lists folders in the order added, each with its title count of
      movies plus series.
    - It adds a folder and removes a folder.
    - A remove nulls `library_folder_id` and `source_folder` on that folder's
      titles and deletes the row, all in one transaction.
    - The slice is composed into the storage the way `settings`, `enrich` and
      `series` are.
  - **`folderOverlap`**, under `library/folders/`.
  - **`readableFolder`**, extracted from the importer's private `checkRoot`.
    The importer calls it from now on.
  - **The three list routes**, with `reachable` read afresh on every `GET`.
- **Client.**
  - **The types**: `LibraryFolder`.
  - **`useLibraryFolders`** returns `{ folders, add, remove, adding,
refusal }`. - `folders` is `null` until the read lands. - An add posts one path, appends the echo and clears the refusal. - A refused add holds the route's sentence and keeps the list. - A remove deletes the folder and drops its row.
  - **`FolderRow`** is a presentational molecule in `CodecRow`'s shape:
    - the 40px accent tile with the folder glyph
    - the path in mono
    - the line: _N titles_, or _Can't be reached right now_ in `danger`
    - the `RemoveButton`, labelled _Remove `<path>`_
  - **The `LibraryFolders` organism**, on the Settings furniture
    (`section.styles.ts`) under the maintainer header:
    - Back, **Library folders**, and the lede.
    - Group **Folders**: the Folder rows, a divider, and the add row. The add
      row is a mono `TextField` with the folder glyph and _Add_. A refusal
      shows as a 13px `danger` line under the field, and the typed path is
      kept. With no folders, _No folders yet._ sits above the add row.
    - Nothing is drawn until the list has loaded.
  - **The page and route**: `LibraryFoldersPage` on `/settings/folders`.
  - **The Settings row**: `LibrarySection` gains the Action row 📁 _Library
    folders_, second after _Add a title_, with the line _The folders your
    movies and series are kept in._

When this phase is done, a maintainer opens Settings → _Library folders_ and
types `E:\Movies`. A row appears that reads _0 titles_. Typing `E:\Movies\Kids`
is refused with a sentence naming `E:\Movies`. Pressing ✕ removes the row.

### Acceptance criteria

- [ ] The prototype amendments and the `COMPONENT-SPEC.md` entries land in the
      slice's `feat:` commit.
- [ ] `folderOverlap` passes over a table of cases: same, inside,
      containing, unrelated siblings, a shared name prefix (`E:\Movies` vs
      `E:\Movies2`), a trailing separator, and case on Windows.
- [ ] `readableFolder` answers correctly over a sandbox for a directory, a
      file, a missing path and a relative path. The importer's existing
      root-check cases still pass.
- [ ] Migration 6 creates the table and both columns on a version-5
      database. It inserts no folder, and existing title rows are unchanged.
- [ ] `library/folders/`:
  - [ ] Folders list in the order added, with title counts across movies and
        series.
  - [ ] A remove nulls both columns on that folder's titles only, and keeps
        the titles.
  - [ ] A duplicate path is refused.
- [ ] Routes (suite over a sandbox):
  - [ ] Each `/api/library-folders` answer works, and each refusal returns
        its sentence.
  - [ ] `reachable` turns false when the directory is removed.
  - [ ] `DELETE` on an unknown id answers `404`.
- [ ] `useLibraryFolders`:
  - [ ] `folders` is `null` until the read lands.
  - [ ] An add appends the echo and clears the refusal.
  - [ ] A refused add holds the sentence and keeps the list.
  - [ ] A remove drops the row.
- [ ] `FolderRow` draws the path, _N titles_, the unreachable line in
      `danger` and the ✕'s label, and a press calls back.
- [ ] `LibraryFolders`:
  - [ ] The empty state shows _No folders yet._
  - [ ] A typed add draws a row.
  - [ ] A refusal shows its line under the field and keeps the typed path.
  - [ ] Remove drops the row.
  - [ ] Back with no history lands on `/settings`.
- [ ] `LibrarySection`: the new row is second, carries its line, and pushes
      `/settings/folders`.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 2: The Folder scan

**User stories**: 31–47, 51, 64

### What to build

The thinnest complete path from the listed folders to new titles on the
Movies and Series tabs, with no spreadsheet.

- **Server.**
  - **`Importer.scan(folders, enrich?)`** runs on the existing state
    machine, and `ImportRun` gains `source`.
    - Reachable folders are walked in the order added. An unreachable folder
      is skipped with `⚠ Can't reach <path> — skipped`, and the run still
      reaches review when no folder could be reached.
    - The log opens with one `Scanning   <path>` line per folder, in place of
      the sheet's _Reading_ line.
    - Each Source folder is tagged with the Library folder its walk began at.
    - Each film is named `titleGuess(name)` / `yearInName(name)` off its
      folder. Each show is named off its folder, as log 22 Q19 names an
      unnamed show. Films and shows can share one Library folder.
    - No `no-row` and no `missing-meta` Problem is raised. `failed` and
      `unplaced` still are.
    - The two Already-in-library rules apply in order. A held title is
      skipped with the existing info line, and a held show gains its new
      episodes.
    - Each new title records its `library_folder_id` and its
      `source_folder`, which is relative to that folder.
    - `resolve`'s Found-file check becomes "under one of the run's folders".
  - **`setSourceFolder(id, folderId, sourceFolder)`** writes both columns in
    one call.
  - **`POST /api/library-folders/scan { enrich }`**: `201 ImportRun`, `400`
    with no folders, and `409` while a Current run exists. The `enrich` flag
    is carried on the run as a sheet import's is.
- **Client.**
  - **`FolderShapes`** is extracted from `ImportSetup` on its second caller
    and stays feature-local. `ImportSetup` composes it, unchanged on screen.
  - **Group Scan** on the folders page: `FolderShapes`, then **Scan folders**
    (`primary`, `lg`), which is disabled with no folders.
    - A press posts the scan and pushes `/import`.
    - A `409` pushes too, so the run already in flight is shown.
    - The `enrich` flag is sent as `false` until Phase 4 draws the box.
  - **`ImportFlow`** reads `run.source` for its heading and lede only:
    - _Scan library folders_ / _Finding new movies and series in your
      library folders._ for a scan
    - the existing copy for a sheet
  - **Back** from a scan in progress steps to the folders page. The run can
    still be re-attached from `/import`.

When this phase is done, a maintainer lists two folders and presses _Scan
folders_. `/import` shows _Scan library folders_ with one _Scanning_ line per
folder. The films and a show with its episodes land on the library, named
after their folders. Scanning again adds nothing. A new episode dropped into
the show's folder arrives on the next scan.

### Acceptance criteria

- [ ] `createImporter.scan`, over the film and series fixtures copied into two
      sandboxed folders:
  - [ ] A first scan imports films named off their folders, and shows with
        their episodes. Each title records its folder and `source_folder`.
  - [ ] The log opens with one _Scanning_ line per folder.
  - [ ] No `no-row` or `missing-meta` is raised.
  - [ ] A second scan adds nothing, even after a title's name and year are
        edited in the database.
  - [ ] An episode added to a held show's folder arrives on the rescan.
  - [ ] A title already held by title key and year is linked to its folder
        and Source folder, and not added twice.
  - [ ] An unreachable folder is skipped with its warning, and the other
        folder is still scanned.
  - [ ] A scan with no reachable folder still reaches review.
  - [ ] `source` is `'folders'`, and a sheet run's is `'sheet'`.
- [ ] `setSourceFolder` writes both columns.
- [ ] The scan route answers `201`, `400` with no folders, and `409` while a
      run exists.
- [ ] `FolderShapes` has its own suite, and `ImportSetup`'s existing suite
      passes unchanged.
- [ ] `LibraryFolders`:
  - [ ] _Scan folders_ is disabled with no folders.
  - [ ] A press posts and pushes `/import`, on `201` and on `409` alike.
- [ ] `ImportFlow` draws the scan heading and lede for a `'folders'` run, and
      the existing copy for a `'sheet'` run.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 3: The spreadsheet import joins the list

**User stories**: 52–55

### What to build

A spreadsheet import's typed root is looked up against the list before the
run starts, so a migrated collection stays current with a later scan.

- **The four root cases:**
  - **The same as a listed folder**: the run uses that folder.
  - **Inside a listed folder**: the run uses the containing folder. Each
    title's `source_folder` is relative to that folder.
  - **Neither**: the root is added to the list, and the run uses it.
  - **Containing a listed folder**: refused before anything starts, as
    `400 { field: 'root' }` with the sentence from the contract. Import
    setup shows it on the root field, as its other root refusals are shown.
- Every title a sheet import adds records its `library_folder_id`.
- The importer still calls `setLibraryRoot` beside the list until Phase 4
  removes it, so the Sync's write targets keep working between the phases.

When this phase is done, a maintainer imports `library.xlsx` over `E:\Movies`.
`E:\Movies` appears on the Library folders page with its title count, and a
later _Scan folders_ adds nothing from it.

### Acceptance criteria

- [ ] `createImporter.start`:
  - [ ] A root equal to a listed folder adds no folder, and links the titles
        to that folder.
  - [ ] A root inside a listed folder links the titles to the containing
        folder, with `source_folder` relative to it.
  - [ ] An unlisted root is added to the list, and its titles are linked to
        it.
  - [ ] A root containing a listed folder is refused, and nothing starts.
- [ ] `POST /api/import` answers `400 { field: 'root' }` with the containing
      sentence.
- [ ] A scan after a sheet import over the same folder adds nothing.
- [ ] The importer's existing suites pass.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 4: The Sync over folders

**User stories**: 48–50, 56–63, 65

### What to build

The Sync writes back per folder, the single remembered root is gone, and a
scan can hand straight to a Sync.

- **Server.**
  - **Migration 7**: the carry-over, as specified above. It is idempotent
    against a folder that Phase 3 already listed.
  - **The settings slice** loses `libraryRoot`, `setLibraryRoot` and the
    `library-root` key. The importer's remaining call goes with them.
  - **`sourcePath(id)`** joins `library_folders.path` and `source_folder` in
    one query. It answers `null` for a title with no folder.
  - **`createEnrichment`:** - A title's on-disk folder is `sourcePath(id)`. With no folder, or with
    its folder unreachable, the title gets the existing _no source folder
    on record, poster skipped_ line. - At start, the write check runs once per reachable folder, and one
    dry-run line is logged for each: `Will write familyflix-metadata.csv to
<path>`, or `Can't write to <path> — the sheet and posters will be
skipped`. - Each title's `poster.jpg` lands in its own Source folder. - Each writable folder gets one Metadata sheet, holding only that
    folder's films, and only when the file is absent. Series stay out of
    it. - The summary carries `libraryFolders`, the paths of the reachable
    folders.
- **Client.**
  - **`EnrichmentSetup`** draws the Write target lines from
    `libraryFolders`: - one folder: today's two path lines - several: _familyflix-metadata.csv in each library folder_ and _`<movie
folder>`\poster.jpg in each library folder_ - none: no rows, and `EnrichmentFlow` sends both flags `false`
  - **`EnrichCheckCard`** is extracted from `ImportSetup` on its second
    caller and stays feature-local. `ImportSetup` composes it, unchanged on
    screen.
  - **Group Scan** gains `EnrichCheckCard` between `FolderShapes` and _Scan
    folders_. It carries the same stored-key hint Import setup gives, and
    _Scan folders_ sends the box's value.
  - **_Finish_** with the box ticked replaces the page with
    `/enrich?scope=all`. Without the box it lands on the library. Both
    already happen for a sheet run, so a scan run only needs to carry the
    flag.

When this phase is done, a maintainer ticks the box on the folders page,
presses _Scan folders_, then _Finish_. The Sync writes each poster into its
title's own folder and one `familyflix-metadata.csv` into each Library
folder. A read-only folder logs its _Can't write_ line, and the others are
still written.

### Acceptance criteria

- [ ] Migration 7:
  - [ ] A version-6 database with `library-root` set, and titles with and
        without `source_folder`, ends with one folder. Exactly the titles
        that had a `source_folder` are linked, and the key is gone.
  - [ ] A root that is already listed is not inserted twice.
  - [ ] With no key set, the migration lists nothing.
- [ ] `sourcePath` joins both columns, and answers `null` with no folder and
      after the folder is removed.
- [ ] `createEnrichment`, over two sandboxed folders:
  - [ ] Posters land in each title's own Source folder.
  - [ ] Each folder gets one Metadata sheet, holding only its own films.
  - [ ] A read-only folder logs its _Can't write_ line and loses only its own
        targets.
  - [ ] An unreachable folder's titles log the skip line.
  - [ ] The summary lists the reachable paths.
- [ ] No shipping code reads `libraryRoot` or the `library-root` key.
- [ ] `EnrichmentSetup` covers the zero-, one- and several-folder cases of
      the Write target lines.
- [ ] `EnrichCheckCard` has its own suite, and `ImportSetup`'s existing suite
      passes unchanged.
- [ ] `LibraryFolders`: _Scan folders_ sends the box's value.
- [ ] `ImportFlow`: a ticked scan run's _Finish_ replaces the page with
      `/enrich?scope=all`, and an unticked one lands on the library.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 5: The native picker

**User stories**: 6–10

### What to build

_Browse…_ opens the system folder dialog in the desktop app, and adds every
folder picked in it.

- **Types.** `FOLDER_CHANNELS` and `FolderBridge`.
  `src/types/familyflix.d.ts` declares `{ updates, folders }`.
- **Shell.**
  - **`pickFolders`** (pure, `electron/`) maps the dialog's answer to
    `string[]`. A cancelled dialog gives `[]`.
  - **`main.ts`** answers the channel with `dialog.showOpenDialog(window, {
title: 'Add library folders', properties: ['openDirectory',
'multiSelections'] })`. It only wires.
  - **`preload.ts`** exposes `folders` beside `updates`.
- **Client.**
  - **`folderBridge`** is `updateBridge`'s twin. It is the one reader of
    `window.familyflix?.folders`, and answers `null` in a browser.
  - **`fakeFolderBridge`** (`test-support/`) answers scripted picks.
  - **_Browse…_** sits beside _Add_ in the add row, and is drawn only when
    the bridge exists. Each picked folder is posted in order, as if it had
    been typed, and each is checked and refused on its own. A cancelled pick
    posts nothing and shows nothing.

When this phase is done, a maintainer in the desktop app presses _Browse…_,
picks three folders in one dialog, and finds three rows. In a plain browser,
there is no _Browse…_ button.

### Acceptance criteria

- [ ] `pickFolders`: a cancelled answer gives `[]`, and several picks come
      back in order.
- [ ] `folderBridge` answers `null` without `window.familyflix`, and the
      bridge when one is present.
- [ ] `LibraryFolders`:
  - [ ] _Browse…_ is drawn only with `fakeFolderBridge`.
  - [ ] A pick posts each path in order.
  - [ ] A refused pick shows its sentence, and the other picks still land.
  - [ ] A cancelled pick posts nothing.
- [ ] `tsconfig.electron.json` compiles `main.ts`, `preload.ts` and
      `pickFolders`.
- [ ] `npm run typecheck`, `eslint` and the full Vitest run are green.

---

## Phase 6: The close

**User stories**: none new. This phase is the initiative's paperwork.

### What to build

The docs that make the feature Done. Per the standing rule, this is the
refactor's last commit and not a build slice.

- **The mechanical rename** lands in the refactor, before this commit:
  `walkLibraryRoot` becomes `walkLibraryFolder`. The glossary retires
  **Library root** for **Library folder**. Import setup keeps its drawn
  caption, _Movies root folder_.
- **CLAUDE.md:**
  - The folder tree names `library/folders/`, `folderOverlap`,
    `readableFolder`, `pickFolders`, `folderBridge`, `useLibraryFolders`,
    `FolderRow`, `LibraryFolders`, `FolderShapes`, `EnrichCheckCard`,
    `LibraryFoldersPage` and `fakeFolderBridge`.
  - The `db/` line lists migrations 6 and 7.
  - The settings slice no longer lists `library-root`.
  - The Settings Hub section gains the Library folders routes.
  - The Foundation line no longer says _no preload, no native picker_.
  - Step 14 and the Maintainer tools entry are ticked ✅.
- **The README** is ticked to match.
- **The dev journal** gets the initiative's entry.

### Acceptance criteria

- [ ] CLAUDE.md, the README and the dev journal reflect the shipped feature,
      and step 14 reads ✅.
- [ ] The glossary has **Library folder**, and **Library root** is retired.
