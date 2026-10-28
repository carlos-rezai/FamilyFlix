> **Initiative:** `scan-new-folders`
> **Design log:** `docs/design-logs/54-scan-new-folders.md`
> **Issue:** #491 (the PRD, step 37)
> **Build order:** step 37, **Scan new folders**, the checklist's _Scan new folders, and sync only what a run added_. It ships as thin slices (log 54, _Implementation Plan_), the prototype first. One migration (16), one body field on the scan route, one new Enrichment scope.

## Problem Statement

The maintainer adds a Library folder of three new films and presses _Scan folders_. The scan walks **every** listed folder: on a collection of a few hundred titles over a USB or network drive it reads every directory, runs the four **Already in library** rules per Source folder, and fills the Activity log with one `· Already in library` line per held title, burying the few lines the press was for. Nothing records that a folder was ever walked, so the page can't tell a folder added a minute ago from one scanned a hundred times, and neither can the route.

With _Sync with TMDB after the scan_ ticked, the hint promises the Sync _runs straight after the scan, over everything it brings in_. It doesn't: _Finish_ lands on `/enrich?scope=all`, setup with _Everything_ chosen, so three new films offer a Sync over all 250 titles.

## Solution

A folder remembers when a run last walked it to review. A listed folder no run has walked is a **New folder**, and its row says so: _Not scanned yet_, or _214 titles · not scanned yet_.

The group Scan on the Library folders page draws two buttons side by side: **Scan new folders** (primary, walks only the New folders, disabled when there are none) and **Scan all folders** (secondary, today's _Scan folders_ renamed, still how a new season dropped into a held folder arrives). Both send the Import mode and the TMDB box, and both land on `/import` as today.

When a run carrying the box finishes, _Finish_ opens the Enrichment flow with a third card, **Just what was added**, chosen, reading _N titles this run brought in_: every title created since the run started, plus every held series that took a new episode. The library's own two cards stay beside it.

## User Stories

### Knowing which folders are new

1. As the maintainer, I want a folder I just added to read _Not scanned yet_, so that I can see at a glance which folders no scan has walked.
2. As the maintainer, I want a folder that already holds titles but was never walked by a run to read _214 titles · not scanned yet_, so that the count and the fact both show on one line.
3. As the maintainer, I want a scanned folder to keep reading _N titles_, so that nothing changes for folders that are settled.
4. As the maintainer, I want an Unreachable folder to keep reading _Can't be reached right now_ in danger, whatever its mark, so that the more urgent fact wins.
5. As the maintainer, I want Import setup's listed folders to read the same line as the Library folders page, so that one folder never says two things.
6. As the maintainer, I want every folder that holds a title to read as scanned after the upgrade, so that my existing library doesn't suddenly look unscanned.
7. As the maintainer, I want a listed folder holding no title to read as new after the upgrade, so that the next _Scan new folders_ tries it (walking an empty folder costs nothing).
8. As the maintainer, I want a folder I remove and add back to be new again, so that adding it is always followed by a scan of it.
9. As the maintainer, I want the titles of a folder I removed and added back still recognised as Already in library, so that its new scan makes no second copy.

### Scanning only the new folders

10. As the maintainer, I want a **Scan new folders** button, so that adding a folder and scanning it costs a walk of that folder alone.
11. As the maintainer, I want _Scan new folders_ to walk every New folder in one press, so that adding several folders needs one scan, not one each.
12. As the maintainer, I want _Scan new folders_ disabled when no folder is new, so that I can't start a scan that would walk nothing.
13. As the maintainer, I want the Activity log of a _Scan new folders_ run to show one `Scanning` line per New folder and only their titles, so that the lines I pressed Scan to see aren't buried.
14. As the maintainer, I want a **Scan all folders** button, so that a new season or film dropped into an already-scanned folder still has a way in.
15. As the maintainer, I want _Scan all folders_ disabled only when no folder is listed, so that it behaves as _Scan folders_ always did.
16. As the maintainer, I want both buttons to send the Import mode and the TMDB box, so that either press imports the way I chose.
17. As the maintainer, I want both buttons held while either scan is being started, so that a double press never starts two runs.
18. As the maintainer, I want the run's screen to read as it does today for either press, so that a Folder scan looks the same whatever its scope.
19. As the maintainer, I want a scan asking for New folders when none exist refused with _No new folders to scan._, so that the server never starts an empty run even if the page is stale.
20. As the maintainer, I want a scan body with a missing or unknown scope refused with _Scope must be new or all._, so that a bad request never guesses.

### When a folder counts as scanned

21. As the maintainer, I want a folder marked scanned only when the run reaches review, so that a run cancelled mid-import leaves it new and the next _Scan new folders_ tries it again.
22. As the maintainer, I want an Unreachable folder skipped by a run to stay new, so that the next _Scan new folders_ tries it once the drive is back.
23. As the maintainer, I want a folder that stopped being readable mid-walk to stay new, so that a half-read folder is never called scanned.
24. As the maintainer, I want a cancelled run to mark no folder, so that cancelling never hides a folder from the next scan.
25. As the maintainer, I want a sheet run, which walks the listed folders too, to mark the folders it read, so that either start leaves the same truth behind.
26. As the maintainer, I want a run left in review and let go by the next start to have marked its folders already, so that marking never depends on my pressing _Finish_.
27. As the maintainer, I want _Scan all folders_ to mark a New folder it read, so that after any full scan nothing reads _not scanned yet_ but the unreachable.

### Old folders still reachable

28. As the maintainer, I want **Bring back** to leave a folder's mark alone, so that its 214 titles don't falsely read _not scanned yet_.
29. As the maintainer, I want the Bring back hint and Manage library's line for an original in a Library folder to name _Scan all folders_, so that the copy points at the button that will bring it back.

### Syncing only what was added

30. As the maintainer, I want _Finish_ on a run carrying the TMDB box to open the Sync on **Just what was added**, chosen, so that three new films offer a Sync of three titles.
31. As the maintainer, I want that card to read _N titles this run brought in_, so that I know how big the Sync is before I start it.
32. As the maintainer, I want _Everything_ and the missing-details card still drawn beside it, so that I can still sync the whole library from there.
33. As the maintainer, I want the added Sync to cover titles the run imported, the ones its Review step's Resolves and _Import as_ added, and held series that took a new episode, so that everything the run brought in is synced.
34. As the maintainer, I want a **Found again** film (a held title whose video was replaced) left out of the added Sync, so that it means added, not touched.
35. As the maintainer, I want a title I add by hand between the run's start and the Sync included, so that something new I added is synced too.
36. As the maintainer, I want the added Sync to plan fields as _Everything_ does, so that a title named off its folder still raises its Field conflicts.
37. As the maintainer, I want the _Just what was added_ card drawn only when I arrive from a run's _Finish_, so that a control with no mechanism behind it isn't drawn.
38. As the maintainer, I want Settings' _Sync metadata & posters_ and the single-title Syncs to open exactly as today, so that only the post-import hand-off changes.
39. As the maintainer, I want Review's _Done_ to still land on the **Fresh home**, so that a run without the box ends as it does today.
40. As the maintainer, I want the scan's hint _Runs straight after the scan, over everything it brings in._ kept, so that it now tells the truth.
41. As the maintainer, I want an added Sync without a `since` refused (_An added Sync names its since_), and a `since` on any other scope refused (_Only an added Sync names a since_), so that the window is never guessed.

### The maintainer's code

42. As the maintainer, I want which folders a scope takes to be one pure unit, so that the route only parses, calls and responds.
43. As the maintainer, I want the importer's scan unchanged in signature, so that it keeps walking whatever folders it is handed.
44. As the maintainer, I want the glossary, the checklist, `COMPONENT-SPEC.md` and the prototype to name the new terms, so that the next change reads them.

## Implementation Decisions

- **One initiative** (log 54 Q1), step 37, both halves of the checklist row. Not built: watching folders, scanning on launch, a per-row Scan, telling a changed folder from an unchanged one without walking it.
- **Prototype first** (Q2): Phase 1 amends `docs/handoff/` from `handoff-scan-new-folders/`: `mol.FolderRow`'s line, the group Scan's two buttons, `feat.EnrichmentFlow`'s third card, the model (`scannedAt` on mock folders, `scanFolders(scope)`, Finish to the added scope), and `COMPONENT-SPEC.md`. No code.
- **The mark** (Q3, Q4): `library_folders.scanned_at`, an ISO stamp, null for a **New folder**. Set to the moment the run reaches review, on every folder the walk **read**, by **either start** (Folder scan or sheet run). `walkListed` answers the folders it read alongside the walked folders it already answers; Unreachable folders and folders whose read failed mid-walk are not among them. The run marks them when it sets its phase to review. A cancelled run marks none. Rejected: marking at the end of the walk, marking on _Finish_.
- **Migration 16** (Q5): adds `scanned_at` and backfills `scanned_at = added_at` for every folder holding a movie or series; folders holding none stay new.
- **Folders slice** (Q9): `scannedAt` on `StoredLibraryFolder` and on the wire's `LibraryFolder` (`string | null`); a new `markScanned(ids, at)`. No `isNew` on the wire: the page derives it.
- **Add and remove** (Q12): unchanged. An add inserts `scanned_at` null; a remove deletes the row.
- **Scan scopes** (Q7): `SCAN_SCOPES = ['new', 'all'] as const` and `ScanScope` in the shared import types, `IMPORT_MODES`' precedent.
- **`foldersToScan`** (Q7), a new pure unit in the import-export domain: `(listed, scope) => StoredLibraryFolder[]`, the New folders for `new`, every folder for `all`.
- **`folderScanBody`** (Q7), a new body parser beside `importStartBody`: `{ enrich, mode, scope }`, `scope` required, refused with _Scope must be new or all._ It reuses `importModeOf`.
- **The scan route** (Q7): `POST /api/library-folders/scan { enrich, mode, scope }` parses with `folderScanBody`, hands `foldersToScan(storage.libraryFolders(), scope)` to `Importer.scan(folders, enrich, mode)`, and answers `400` _No new folders to scan._ when `scope` is `new` and the list is empty. `Importer.scan` is unchanged. Rejected: `folderIds` on the body.
- **`ImportRun`** (Q10): gains nothing; the run's screen is unchanged.
- **`folderLine`** (Q8): a reachable New folder reads _Not scanned yet_ with no titles, _N titles · not scanned yet_ with some; a scanned folder keeps _N titles_; an Unreachable one keeps _Can't be reached right now_ in danger. Rejected: a badge or tint.
- **`useFolderScan` and its wire call** (Q6, Q7): `scan(enrich, mode, scope)` and `startFolderScan(enrich, mode, scope)`; `scanning` holds both buttons.
- **`LibraryFolders`** (Q6): **Scan new folders** (`primary`, `lg`, disabled with no New folder) and **Scan all folders** (`secondary`, `lg`, disabled with no folder) side by side. Rejected: one button that changes meaning, a Scan per row, scanning on add.
- **Bring back and Manage library** (Q11): Bring back leaves `scanned_at` alone; `libraryTitleView`'s line and any Bring back copy name _Scan all folders_.
- **The `added` Enrichment scope** (Q13, Q14): `ENRICH_SCOPES = ['missing', 'all', 'added', 'single']`. `StartEnrichment.since?: string`, required for `added` and refused on any other scope by `startEnrichmentBody` (_An added Sync names its since_, _Only an added Sync names a since_), the `movieId` rule's shape. The enrich slice's `moviesInScope` / `seriesInScope` take `(scope, since?)`: for `added`, movies with `created_at >= since`, series with `created_at >= since` or any episode with `created_at >= since`. `planFields` treats `added` as it treats `all` (its `scope !== 'missing'` rule). Rejected: ids on the run, an upper bound on the window.
- **The summary** (Q15): `GET /api/enrichment?since=<ISO>` answers `EnrichmentSummary.added`, the count of titles in the added window; absent without `since`. `createEnrichment`'s `summary` takes `since?` and `titlesFor` passes it on.
- **The route to the Sync** (Q15): `enrichPath` / `parseEnrichQuery` drop `scope?: 'all'` and take `added?: string`, travelling as `?added=<ISO>` through `URLSearchParams`. `?scope=all` is retired (Finish was its only setter).
- **`ImportFlow`** (Q15): _Finish_ on a run carrying `enrich`, from either start, replaces `/import` with `enrichPath({ added: run.startedAt })`.
- **`EnrichmentFlow` and its setup** (Q15): with `?added=`, setup reads the summary with `since`, draws the library's two cards plus **Just what was added** chosen (_N titles this run brought in_), and posts `{ scope: 'added', since }`. Without `?added=` the third card isn't drawn. Rejected: the added card alone.
- **The box's hint** (Q16): unchanged.
- **Names** (Q17): new **New folder**, **Scan new folders**, **Scan all folders**, **Scan scope**, the Enrichment scope **Added** (_Just what was added_); updated **Folder scan**, **Library folder**, **Library folders page**, **Bring back**, **Enrichment scope**, **Fresh home**. _Scan folders_ is retired as a label.
- **Slices** (log 54, _Implementation Plan_):
  1. the prototype;
  2. the mark: migration 16, `scannedAt` on both folder types, `markScanned`, both starts marking on review, `folderLine`'s new line;
  3. Scan new folders: `SCAN_SCOPES`, `folderScanBody`, `foldersToScan`, the route's `400`, `startFolderScan`'s scope, the two buttons;
  4. Sync what was added: the `added` scope, `since` through the body, the slice and the summary, `enrichPath`'s `added`, Finish's push, the third card;
  5. the documents (Q18).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the maintainer sees: rows answered, a body read or refused with its sentence, the words and buttons drawn, the route pushed. It never asserts which helper ran or which SQL was issued.
- **`foldersToScan`**, pure: `new` answers only folders with `scannedAt` null, in listed order; `all` answers every folder; an empty list answers empty. Prior art: the import-export domain's pure units' tests.
- **`folderScanBody`**: reads `enrich`, `mode`, `scope`; refuses a missing or unknown scope with its sentence; refuses a bad mode as `importStartBody` does. Prior art: `importBody.test.ts`.
- **`startEnrichmentBody`**: `added` with `since` is read; `added` without `since` and any other scope with `since` are refused with their sentences. Prior art: `enrichmentBody.test.ts`.
- **Migration 16**: over a database at 15, a folder holding a movie or a series has `scanned_at = added_at`; one holding none stays null. Prior art: the existing migration tests.
- **Folders slice**: `scannedAt` read back null on add; `markScanned` stamps exactly the ids named. Prior art: the slice's own test.
- **Enrich slice**: `moviesInScope('added', since)` and `seriesInScope('added', since)` answer titles created at or after `since` and series with a new episode, and leave out older titles; the `added` count matches. Prior art: the slice's own test.
- **`createImporter`**: a Folder scan and a sheet run mark the folders read on reaching review; an Unreachable folder, a folder failing mid-walk, and a cancelled run mark nothing. Prior art: `createImporter`'s tests with the fixture library.
- **The scan route**: `scope: 'new'` walks only New folders; `scope: 'new'` with none is `400` _No new folders to scan._; a bad body is `400`. Prior art: the routes' supertest suites.
- **`createEnrichment`**: an `added` Sync works the window's titles and plans fields as _Everything_; `summary(since)` carries `added`, `summary()` doesn't. Prior art: its own tests.
- **`folderLine`**: the four lines (new empty, new with titles, scanned, unreachable). Prior art: its own test.
- **`enrichPath`**: `added` round-trips through `parseEnrichQuery`; `scope` is no longer read. Prior art: its own test.
- **`LibraryFolders` / `useFolderScan`**: both buttons drawn; _Scan new folders_ disabled with no New folder; each press posts its scope and pushes `/import`; both held while scanning. Prior art: their existing tests.
- **`ImportFlow`**: _Finish_ with `enrich` replaces to `/enrich?added=<startedAt>`. Prior art: its existing test.
- **`EnrichmentFlow` setup**: with `?added=` three cards, _Just what was added_ chosen with its count, Start posts `scope: 'added'` and `since`; without it two cards. Prior art: its existing tests.
- **`libraryTitleView`**: the line names _Scan all folders_. Prior art: its own test.

## Out of Scope

- Watching folders, or scanning on launch (log 30 Q3 stands: a scan is the maintainer's press).
- A Scan on each Folder row (log 30 Q16 stands).
- Detecting new titles inside an already-scanned folder without walking it.
- Bring back clearing a folder's mark.
- Any change to the `/import` run screen or `ImportRun`.
- An upper bound on the added window.

## Further Notes

- The trade-off is accepted: two buttons where there was one, and a title dropped into a scanned folder needs _Scan all folders_.
- The added window is a timestamp, so a hand add made between the run's start and the Sync is included; that is wanted.
- `enrichPath` was not in log 54's unit table but carries the retired `?scope=all`; it takes `added` in slice 4.
- The maintainer approved every recommendation of log 54 in advance; this PRD adds no decision the log doesn't hold.
