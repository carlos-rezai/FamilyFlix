# Plan: Scan new folders, and sync only what a run added

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/491

Today _Scan folders_ walks every listed Library folder, so adding three films
costs a walk of the whole collection and an Activity log buried in
`· Already in library` lines; and with the TMDB box ticked, _Finish_ offers a
Sync over everything. This initiative gives a folder a mark (a **New folder**
is one no run has walked to review), splits the group Scan into **Scan new
folders** and **Scan all folders**, and hands a run's _Finish_ to a Sync over
**Just what was added**.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** No phase is
HITL.

- The handoff `docs/handoff/handoff-scan-new-folders/` is already committed
  as received and stays frozen. Phase 1 carries it into `docs/handoff/`, so it
  needs no Claude Design round. The PRD and log 54 fully specify every line,
  button and card, so a phase never stops to ask.
- **Each phase stays well under a 100k-token context.** The prototype files
  are large (`FamilyFlix.dc.html` about 142 KB, `COMPONENT-SPEC.md` about
  101 KB, the handoff's `support.js` about 60 KB). A phase greps for the
  section it needs (`FolderRow`, `Scan folders`, `EnrichCheckCard`,
  `scope=all`, `scanFolders`) and reads only that range. `routes/index.ts` is
  large too; a phase greps for the route it changes.
- No test runs Electron, FFmpeg or TMDB. Folder scans run over the importer's
  fixture library in a temporary Library folder the suite creates.
- The phases are log 54's _Implementation Plan_ slices 1 to 4, with slice 2
  split into the mark (phase 2) and the runs that set it (phase 3), and
  slice 4 split into the server's added Sync (phase 5) and the hand-off to it
  (phase 6), so no issue outgrows one context.
- Log 54's slice 5, the documents (story 44: the checklist's step 37 row, the
  docblocks of every unit touched, `FolderListEditor`'s **Scan folders**
  mention), is not a phase: it is ticked ✅ only after the refactor. The
  glossary already carries **New folder**, **Scan scope**, **Scan new
  folders**, **Scan all folders** and the updated terms.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: migration 16 adds `library_folders.scanned_at` (ISO string,
  nullable) and backfills `scanned_at = added_at` for every folder holding a
  movie or a series; a folder holding none stays null. An add inserts null;
  a remove deletes the row, so a re-added folder is new again. **Bring back**
  never touches it.
- **Routes**:
  - `POST /api/library-folders/scan` takes `{ enrich, mode, scope }`, `scope`
    required, one of `SCAN_SCOPES`. A missing or unknown scope is `400`
    _Scope must be new or all._; `scope: 'new'` with no New folder is `400`
    _No new folders to scan._ A bad mode is refused as today.
  - `POST /api/enrichment` takes `since?: string`: required for
    `scope: 'added'` (`400` _An added Sync names its since_), refused on any
    other scope (`400` _Only an added Sync names a since_).
  - `GET /api/enrichment?since=<ISO>` answers `EnrichmentSummary.added`, the
    count of titles in the added window; without `since` the field is
    absent.
  - The client route `/enrich?added=<ISO>` replaces `/enrich?scope=all`,
    which is retired.
- **Key models**:
  - `StoredLibraryFolder.scannedAt` and the wire's `LibraryFolder.scannedAt`:
    `string | null`. No `isNew` on the wire; the page derives it.
  - The folders slice's `markScanned(ids, at)` stamps exactly the ids named.
  - `walkListed` answers the folders it **read** beside the walked folders it
    already answers; an Unreachable folder or one whose read failed mid-walk
    is not among them. A run, by either start, marks them at the moment it
    sets its phase to review; a cancelled run marks none.
  - `SCAN_SCOPES = ['new', 'all'] as const` and `ScanScope` in
    `src/types/import.ts`.
  - `foldersToScan(listed, scope)`, pure, in the import-export domain: the
    New folders in listed order for `new`, every folder for `all`.
    `Importer.scan(folders, enrich, mode)` is unchanged.
  - `folderScanBody` beside `importStartBody`, reusing `importModeOf`.
  - `ENRICH_SCOPES = ['missing', 'all', 'added', 'single']`. For `added`:
    movies with `created_at >= since`; series with `created_at >= since` or
    any episode with `created_at >= since`. No upper bound. `planFields`
    treats `added` as it treats `all`.
  - `ImportRun` gains nothing; the `/import` run screen is unchanged.
- **Copy**: _Not scanned yet_, _N titles · not scanned yet_, _N titles_,
  _Can't be reached right now_ (danger, wins over any mark). **Scan new
  folders** (`primary`, `lg`) and **Scan all folders** (`secondary`, `lg`),
  side by side, `gap: 12px`, wrapping. _Just what was added_, _N titles this
  run brought in_. The Bring back and Manage library copy names _Scan all
  folders_. The box's hint _Runs straight after the scan, over everything it
  brings in._ is kept.

---

## Phase 1: Prototype, two scan buttons and the added card

**User stories**: 44 (the prototype and the spec)

### What to build

Carry `handoff-scan-new-folders/` into `docs/handoff/`: `mol.FolderRow`'s
New-folder line, `page.LibraryFoldersPage`'s two buttons, the third card in
`feat.EnrichmentFlow`, and the model in `FamilyFlix.dc.html` (`scannedAt` on
the mock folders, `scanFolders(scope)`, _Finish_ to the added scope). Add or
amend the `COMPONENT-SPEC.md` rows for `mol.FolderRow` (`scanned`), the group
Scan, and `feat.EnrichmentFlow`'s setup. The prototype's mono line under the
buttons is a stand-in for the push to `/import`, noted as not drawn. No
code.

### Acceptance criteria

- [ ] `mol.FolderRow` draws the four lines of the handoff's table.
- [ ] `page.LibraryFoldersPage` draws **Scan new folders** and **Scan all
      folders** with their variants and disabled rules; _Scan folders_ is
      gone.
- [ ] `feat.EnrichmentFlow` draws _Just what was added_ chosen beside the
      library's two cards when arriving from a run.
- [ ] `COMPONENT-SPEC.md` names the new prop, buttons and card.
- [ ] `handoff-scan-new-folders/` is unchanged.

---

## Phase 2: A folder knows it's new

**User stories**: 1 to 9, 28

### What to build

Migration 16 lands with its backfill. `scannedAt` travels on both folder
types, the folders slice gains `markScanned`, and `folderLine` draws a
reachable New folder as _Not scanned yet_ or _N titles · not scanned yet_,
on the Library folders page and in Import setup alike. Nothing sets the mark
yet except the backfill. Demo: add a folder and it reads _Not scanned yet_;
an existing folder holding titles still reads _N titles_.

### Acceptance criteria

- [ ] Over a database at 15, a folder holding a movie or a series has
      `scanned_at = added_at`; one holding none stays null.
- [ ] A folder read back after an add has `scannedAt` null; `markScanned`
      stamps exactly the ids it names.
- [ ] `GET /api/library-folders` answers `scannedAt` on every folder.
- [ ] `folderLine` answers the four lines; an Unreachable folder reads
      _Can't be reached right now_ whatever its mark.
- [ ] A removed and re-added folder is new; its titles are still Already in
      library on its next scan.
- [ ] Bring back leaves `scanned_at` alone.

---

## Phase 3: A run marks what it read

**User stories**: 21 to 27

### What to build

`walkListed` answers the folders it read. A Folder scan and a sheet run each
mark those folders scanned at the moment the run reaches review, so a run
left in review and let go by the next start has already marked them. An
Unreachable folder, a folder whose read fails mid-walk, and a cancelled run
mark nothing. Demo: press today's scan with one New folder listed; once the
run reaches review, the row reads _N titles_.

### Acceptance criteria

- [ ] A Folder scan reaching review marks every folder it read, and only
      those.
- [ ] A sheet run reaching review marks the listed folders it read.
- [ ] An Unreachable folder skipped by the run stays new.
- [ ] A folder that fails mid-walk stays new.
- [ ] A run cancelled before review marks no folder.
- [ ] A scan over every folder leaves no reachable folder new.

---

## Phase 4: Scan new folders

**User stories**: 10 to 20, 29, 42, 43

### What to build

The scan route takes a **Scan scope**: `folderScanBody` reads
`{ enrich, mode, scope }`, `foldersToScan` picks the folders, and
`Importer.scan` walks them unchanged. `useFolderScan` and its wire call send
the scope. The group Scan becomes **Scan new folders** (disabled with no New
folder) and **Scan all folders** (disabled with no folder), both sending the
Import mode and the box, both pushing `/import`, both held while either
starts. Bring back's hint and `libraryTitleView`'s line for an original in a
Library folder name _Scan all folders_. Demo: two scanned folders and one
new; _Scan new folders_ logs one `Scanning` line and imports only the new
folder's titles.

### Acceptance criteria

- [ ] `foldersToScan`: `new` answers only folders with `scannedAt` null, in
      listed order; `all` answers every folder; an empty list answers empty.
- [ ] `folderScanBody` reads all three fields; a missing or unknown scope is
      refused with _Scope must be new or all._; a bad mode is refused as
      `importStartBody` refuses it.
- [ ] `scope: 'new'` walks only New folders; with none it is `400` _No new
      folders to scan._ and no run starts.
- [ ] Both buttons are drawn with their variants; each disables by its rule;
      each press posts its scope and pushes `/import`; both are held while
      either scan starts.
- [ ] Bring back's copy and Manage library's line name _Scan all folders_;
      no shipping copy says _Scan folders_.

---

## Phase 5: The added Sync on the server

**User stories**: 33 to 36, 41 (and the count behind 31)

### What to build

The `added` Enrichment scope. `startEnrichmentBody` reads `since` for it and
refuses it elsewhere. The enrich slice's `moviesInScope` and `seriesInScope`
take `(scope, since?)` and answer the window: titles created at or after
`since`, and series that took a new episode. `planFields` plans `added` as
it plans `all`. `createEnrichment`'s `summary(since?)` answers `added`, and
`GET /api/enrichment?since=` passes it through. Demo: through the routes, a
summary with `since` counts three films a run brought in, and an `added`
Sync works only those.

### Acceptance criteria

- [ ] `added` with `since` is read; `added` without `since` is refused with
      _An added Sync names its since_; any other scope with `since` is
      refused with _Only an added Sync names a since_.
- [ ] `moviesInScope('added', since)` and `seriesInScope('added', since)`
      answer titles created at or after `since` and series with a new
      episode, and leave older titles out.
- [ ] A Found again film (held, its video replaced) is not in the window.
- [ ] An `added` Sync raises Field conflicts for a title named off its
      folder, as _Everything_ does.
- [ ] `summary(since)` carries `added`, matching the window; `summary()`
      doesn't.

---

## Phase 6: Finish opens Just what was added

**User stories**: 30 to 32, 37 to 40

### What to build

`enrichPath` and `parseEnrichQuery` take `added?: string` and drop
`scope?: 'all'`. _Finish_ on a run carrying `enrich`, from either start,
replaces `/import` with `/enrich?added=<startedAt>`. With `?added=`, setup
reads the summary with `since` and draws the library's two cards plus **Just
what was added**, chosen, reading _N titles this run brought in_; Start posts
`{ scope: 'added', since }`. Without `?added=` setup is exactly as today, and
Review's _Done_ still lands on the **Fresh home**. Demo: scan one new folder
of three films with the box ticked; _Finish_ offers _Just what was added_,
_3 titles this run brought in_, chosen.

### Acceptance criteria

- [ ] `added` round-trips through `enrichPath` and `parseEnrichQuery`;
      `scope` is no longer read.
- [ ] _Finish_ with `enrich` replaces to `/enrich?added=<startedAt>`; a run
      without the box ends on the Fresh home as today.
- [ ] With `?added=`, setup draws three cards, _Just what was added_ chosen
      with its count, and Start posts `scope: 'added'` and `since`.
- [ ] Without `?added=`, setup draws two cards; Settings' _Sync metadata &
      posters_ and the single-title Syncs open as today.
- [ ] Setup draws nothing until the summary lands.
- [ ] The box's hint is unchanged.
