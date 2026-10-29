# Refactor plan: Scan new folders, one window rule counted not assembled, a named walk, one folder builder, and the docs that close step 37

> Source initiative: `scan-new-folders`, issue 491 (step 37).
> Shipped by issues 492 to 497. The prototype lift is 492 `80ae847e`; the
> build slices, RED and GREEN each, are 493 to 497 (`489149fd` to
> `d0e58b8a`).
> Design log: `docs/design-logs/54-scan-new-folders.md`.
> PRD: `docs/PRDs/54-scan-new-folders.md` (491). Plan:
> `docs/PRDs/54-scan-new-folders-plan.md`.
> This is the initiative's closing round. It ticks **Scan new folders** and
> closes 491. Filed as issue 498.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`scan-new-folders` shipped every phase of its plan. At `d0e58b8a` the full
suite has **11195 tests across 703 files, all passing**. `tsc -b --force` is
clean. `eslint src server electron` reports one error and 133 warnings, the
count Loading states closed on: this initiative added none.

The design held. A **New folder** is a listed **Library folder** with
`scanned_at` null (migration 16, backfilled for folders holding a title).
`walkListed` answers the folders it read, and either start marks them in the
step that sets the run to review. `foldersToScan` picks a **Scan scope**'s
folders, `folderScanBody` reads `{ enrich, mode, scope }`, and
`Importer.scan` is unchanged. The group Scan draws **Scan new folders** and
**Scan all folders**. The `added` **Enrichment scope** is bounded below by
the run's `startedAt`, _Finish_ lands on `/enrich?added=`, and setup draws
**Just what was added** chosen beside the library's two cards.

The seams are small. Every finding was checked against the code for this
plan. They fall into five families.

### 1. The added window, spelled twice and counted by assembling

- **The window rule is written in each slice.** The enrich slice's
  `moviesInScope` writes `WHERE m.created_at >= ?` with a positional
  parameter; the series enrich slice's `seriesInScope` writes `created_at
  > = @since OR EXISTS (SELECT 1 FROM episodes e …)` with a named one. The
  two other scope rules, **Full details** and the **Sync gap**, are SQL
  fragments beside the slice (`fullDetails`, `syncGap`), each taking an
  alias and a `movies`/`series` kind, and both slices and the counts read
  > them. The window is the only scope rule spelled inline, and spelled two
  > ways.
- **The summary counts the window by assembling it.** `summary(since)`
  answers `added` as `moviesInScope('added', since).length +
seriesInScope('added', since).length`: every film in the window read with
  its genres and subtitles, every series with its seasons and episodes, to
  answer one number. The three counts beside it come from one `COUNT` read,
  `enrichmentCounts()`, over the same fragments.
- **`LibraryStorage` spells the library scopes as a literal union**,
  `'missing' | 'all' | 'added'`, on `moviesInScope` and `seriesInScope`. The
  slices it delegates to say `Exclude<EnrichScope, 'single'>`. The union was
  `'missing' | 'all'` before; this initiative widened it by hand, which is
  how the two can drift.
- **`ENRICH_SCOPES` reads `['missing', 'all', 'single', 'added']`.** Log 54
  Q14, the PRD and the plan all write `['missing', 'all', 'added', 'single']`:
  the three library scopes in the order setup draws their cards, then the
  single-title one.

### 2. A walk with no name, a query read by hand

- **`walkListed` answers an inline object type**, `Promise<{ walked:
WalkedFolder[]; read: StoredLibraryFolder[] } | null>`, spelled in its
  signature. Its one element type, `WalkedFolder`, is a named interface at
  the top of the module, as every other shape `createImporter` passes
  between its steps is.
- **`GET /api/enrichment` reads `since` inline**: `typeof since === 'string'
&& since.length > 0 ? since : undefined`. The browse routes read their
  query through `queryString` in the same module, which also takes the
  first of a repeated key.

### 3. Small client seams

- **`api.ts` slots `type ScanScope` between `ImportMode` and
  `ImportProblem`** in an import list that is otherwise A to Z.
- **`scopeDescription` gained an unbraced two-line `if`** (`if (scope ===
'added')` and its `return` on the next line, as Prettier wrapped it). The
  module's other early returns fit one line; a wrapped one takes braces
  everywhere else in `src/`.

### 4. Comments and suites

- **Docblocks edited mid-line and never rewrapped**: `EnrichmentSetup`'s
  (one line to about 100 columns), `ImportFlow`'s (about 90),
  `useFolderScan`'s (about 105), `startFolderScan`'s in `api.ts` (a short
  line left by the rewrap, ending on the `ImportBusyError` link) and
  `parseEnrichQuery`'s (a short line, _`1`, and anything else ignored._).
- **Em dashes this initiative wrote in comments**: `EnrichmentSetup`'s
  docblock (a dash after _what a run brought in_), and the suites below.
  The household line in `libraryTitleView` keeps its dash: it is older copy,
  and the repo-wide em dash pass is its own follow-up.
- **Test comments still name _Scan folders_** as the press: the
  `LibraryFolders.scan` suite's header and its Import mode block,
  `useFolderScan.test`'s header and `ImportFlow.source.test`'s docblock. The
  assertions that _Scan folders_ is gone are right and stay.
- **One `LibraryFolder` literal, written twenty-four times.** Fourteen
  client suites spell `{ id, path, titleCount, reachable, scannedAt }` by
  hand, and this initiative had to touch every one of them to add one field.
  Every other wire shape a client suite builds has a `make*` builder in
  `src/test-support/` (`makeImportRun`, `makeLibraryTitle`, `makeMovie`,
  `makeEnrichmentRun`), so the next field lands in one place.
- **The suite headers name the initiative five ways**: `54` and a dash
  before the name (issue 496's), `54, Scan new folders, Phase 2: "…" (issue
#493).`, `54: Scan new folders (issue #495): …`, `54, Scan new folders,
issue #493: …` and `(log 54, issue #497)`. Loading states' round settled
  the form, `53, Loading states, Phase N (issue #n): …`. Issue 495's suites
  name no phase (it is Phase 4), and seven `describe` titles take an em
  dash between the unit and the case (the two window blocks of the enrich
  slices, `EnrichmentFlow`'s two arrivals among them).

### 5. The documents (log 54 Q18, and the plan's slice 5)

- **Feature checklist**: the row is still _Scan new folders_ and _sync only
  what a run added_ joined by a dash, 🔜, and there is no step 37 entry.
- **README**: the server tree's `import-export/` line doesn't name
  `foldersToScan`.
- **Release checklist**: section 5 says _Scan folders_ three times, and no
  smoke walks a _Scan new folders_ run or the hand-off to _Just what was
  added_.
- **Glossary**: **Folder scan** still reads `Importer.scan(folders,
enrich)`, a signature that took `mode` in Link or copy.

## Solution

One round, in six groups, each commit leaving the suite green and the
typecheck clean:

1. **One window rule, counted not assembled.** An `addedSince` fragment
   beside `syncGap`, read by both slices and by `enrichmentCounts(since?)`;
   the summary reads the count; `LibraryStorage` says `Exclude<EnrichScope,
'single'>`; `ENRICH_SCOPES` in log 54's order.
2. **A named walk and a read query.** `ListedWalk` beside `WalkedFolder`;
   the summary route reads `since` through `queryString`.
3. **Small client seams.** `api.ts`'s import list, `scopeDescription`'s
   braces.
4. **Comments rewrapped**, and the test comments that still name the old
   press.
5. **Suites: one folder builder and one header form.** `makeLibraryFolder`
   in `src/test-support/`, with its test; the fourteen suites use it; the
   headers and `describe` titles read one way.
6. **The docs that close step 37.**

No behaviour changes. No wire, schema, Settings or prototype change. The
household sees nothing new.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [scan-new-folders] issue #498 …`, except where a commit is named
`test:` or `docs:`.

### Group 1: one window rule, counted not assembled

1. **`addedSince`, the window as SQL beside `syncGap`.**
   - The enrich slice exports `addedSince(alias = '', kind = 'movies')`, in
     `syncGap`'s shape and with a docblock in its voice: a row created at or
     after `@since`, and for a `series` row also an **Episode** created at or
     after it (its own `added_e` alias, as `syncGap` names `gap_e`).
   - `moviesInScope` and `seriesInScope` build their `added` clause from it
     and pass `{ since }` as one named parameter, so both read the window
     the same way. The movies' `assembleMany` re-runs the same clause with
     the same parameters, as it does today.
   - Guarded by `enrich.test` and the series `enrich.test`'s _Just what was
     added_ blocks, and by `createEnrichment.added.test`, unchanged.
2. **`enrichmentCounts` answers the window's count; `summary` reads it.**
   - `enrichmentCounts(since?)` answers `added` beside `total`, `complete`
     and `gaps` when it is given a `since`, from a `COUNT` over
     `addedSince` for each table, and leaves the key off without one, as
     the summary does. `EnrichmentCounts.added?: number` says so in its
     docblock.
   - `createEnrichment`'s `summary(since?)` spreads what the counts answer
     and no longer calls `moviesInScope` or `seriesInScope`.
   - The enrich slice's test gains the count beside its window cases (a
     count matching the window for movies and series, the key absent
     without `since`), in the shape of its `enrichmentCounts` cases. Guarded
     otherwise by `createEnrichment.added.test`'s summary cases and
     `routes.enrichmentSummary`, unchanged.
3. **`LibraryStorage` names the library scopes by `EnrichScope`.**
   `moviesInScope` and `seriesInScope` take `Exclude<EnrichScope,
'single'>`, as the slices do. Types only; guarded by `tsc -b --force`.
4. **`ENRICH_SCOPES` in log 54's order**: `['missing', 'all', 'added',
'single']`, its docblock listing them in the same order. Nothing iterates
   it for order: `startEnrichmentBody` reads membership, and setup draws its
   cards from `LIBRARY_SCOPES` and `ADDED_SCOPE`. Guarded by
   `enrichmentBody.test` and `tsc -b --force`.

### Group 2: a named walk and a read query

5. **`ListedWalk`.** `createImporter` declares `interface ListedWalk {
walked: WalkedFolder[]; read: StoredLibraryFolder[] }` beside
   `WalkedFolder`, each field with a one-line docblock (the second carrying
   the _neither skipped as unreachable nor failed mid-read_ rule now in
   `walkListed`'s docblock), and `walkListed` answers `Promise<ListedWalk |
null>`. Types and docblocks only. Guarded by
   `createImporter.marksScanned.test` whole.
6. **The summary route reads `since` through `queryString`.** An empty
   `since` is still no `since`. Guarded by `routes.enrichmentSummary`,
   unchanged.

### Group 3: small client seams

7. **`api.ts`'s import list A to Z** (`type ScanScope` after
   `LibraryFolderView`), and **`scopeDescription`'s early return braced.**
   Guarded by `tsc -b --force`, `enrichmentView.test` and the import-export
   suites, unchanged.

### Group 4: comments rewrapped

8. **The docblocks this initiative edited mid-line are rewrapped** to 80
   columns: `EnrichmentSetup`, `ImportFlow`, `useFolderScan`,
   `startFolderScan` and `parseEnrichQuery`. `EnrichmentSetup`'s new clause
   takes a comma for its dash. Older em dashes on lines only rewrapped are
   kept, Library audit's rule. Comments only.
9. **`test: [scan-new-folders] issue #498 the suites name the presses`.**
   The comments in `LibraryFolders.scan.test`, `useFolderScan.test` and
   `ImportFlow.source.test` that name _Scan folders_ as the press name
   **Scan all folders** (or both presses, where the block is about the
   pair). The cases asserting that _Scan folders_ is gone keep their words.
   Comments only.

### Group 5: one folder builder and one header form

10. **`test: [scan-new-folders] issue #498 makeLibraryFolder`.**
    - `src/test-support/makeLibraryFolder/`: `makeLibraryFolder(overrides)`
      answers a complete `LibraryFolder`, in `makeImportRun`'s shape and
      docblock voice: a reachable, scanned folder holding no title, by
      default (`id: 'folder-1'`, `path: 'D:\\Movies'`, `titleCount: 0`,
      `reachable: true`, `scannedAt` an ISO stamp). A test about a **New
      folder** passes `scannedAt: null` at its call site.
    - Its test pins the default, an override winning, and the default
      being a scanned folder (so a suite that wants a New folder must say
      so). Prior art: `makeImportRun.test`.
11. **`test: [scan-new-folders] issue #498 the folder suites build with makeLibraryFolder`.**
    - The fourteen client suites that spell a `LibraryFolder` by hand use
      the builder, passing only what each case is about (the path, the
      count, `reachable: false`, `scannedAt: null`): `folderLine`,
      `FolderListEditor`, `FolderRow`, `FolderRow.leftOut`, `ImportFlow`,
      `ImportSetup`, `ImportSetup.enrich`, `LibraryFolders`,
      `LibraryFolders.bringBack`, `LibraryFolders.browse`,
      `LibraryFolders.busyAdd`, `LibraryFolders.scan`, `useLibraryFolders`
      and `useLibraryFolders.busy`.
    - A case whose words depend on a field the default sets differently
      (`folderLine`'s _N titles_ cases, the scan suite's disabled rules)
      names that field at its call site. Assertions unchanged; every suite
      passes with the same count.
12. **`test: [scan-new-folders] issue #498 the suites name their phases`.** - Every header this initiative wrote reads `54, Scan new folders,
Phase N (issue #n): …`: 493 is Phase 2, 494 Phase 3, 495 Phase 4, 496
    Phase 5, 497 Phase 6. The quoted slice names (_"a folder knows it's
    new"_) go; the sentence after the colon says what the suite pins. - `describe` titles take a colon (`library: moviesInScope: Just what was
added`, `EnrichmentFlow: arriving with ?added=`). - Headers of suites from earlier initiatives that this one only amended
    (`ImportFlow.enrich`, `EnrichmentFlow.fromImport`) keep their own
    first line; the sentence this initiative added to each loses its dash
    and its _(log 54, issue #497)_ for the same form. - No code changes; every suite passes with the same count.

### Group 6: the docs

13. **`docs: [scan-new-folders] issue #498 the docs know the two scans`.** - **Feature checklist**: the row becomes _Scan new folders: and sync
    only what a run added_, ✅. A step 37 entry under step 36's, in its
    shape: where it came from (adding three films walked every folder and
    buried the log; the Sync after it offered the whole library) and what
    shipped: a folder no scan has read says _Not scanned yet_; **Scan new
    folders** walks only those, **Scan all folders** every one; a run
    with the TMDB box ticked hands on to **Just what was added**. - **README**: the server tree's `import-export/` line names
    `foldersToScan` beside `listedFolderOf`. - **Release checklist**: section 5's three _Scan folders_ read **Scan
    all folders**; a **Scan new folders** smoke, in the shell over a
    sandbox library: a newly added folder reads _Not scanned yet_; **Scan
    new folders** logs one `Scanning` line and imports only its titles;
    after review the row reads _N titles_ and the press is disabled; with
    the TMDB box ticked, _Continue to TMDB sync_ opens on **Just what was
    added**, _N titles this run brought in_, chosen. - **Glossary**: **Folder scan** reads `Importer.scan(folders, enrich,
mode)`. The dialogue is a snapshot and stays.
14. **`docs: [scan-new-folders] issue #498 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape: what shipped,
    what each group changed, where the round left the plan, what was
    deliberately not changed, the follow-ups. The commit closes 491 in
    words, not with a keyword, and this issue with one.

## Decision Document

- **The added window is a scope rule like the others.** **Full details**
  and the **Sync gap** are SQL fragments the slices and the counts share;
  the window joins them as `addedSince`, so _which titles_ and _how many_
  can't disagree. Its parameter is named (`@since`), as the series slice
  already had it, because the series form reads it twice.
- **A count is a `COUNT`.** The summary is read on every visit to setup;
  answering one number by assembling every title in the window costs a full
  read of each, and the counts beside it already come from one `COUNT`
  read. `enrichmentCounts` takes the `since` the summary takes, and the
  `added` key keeps its rule: present only when a `since` was asked.
- **`moviesInScope` and `seriesInScope` keep `(scope, since?)`.** A
  discriminated scope (`{ scope: 'added'; since }`) would make a missing
  `since` unrepresentable, but `startEnrichmentBody` is already the gate
  (_An added Sync names its since_), and the change would reach every
  caller and suite of both slices. Named as a follow-up, not done here.
- **`LibraryStorage` follows the slices' types**, not a hand-kept union.
- **`ENRICH_SCOPES` follows the design log's order.** The order is the
  setup's reading order; nothing depends on it at runtime.
- **The shapes `createImporter` passes between its steps are named
  interfaces.** `ListedWalk` joins `WalkedFolder`; `walkListed`'s logic and
  `importPlaced`'s parameters are unchanged.
- **Route query strings are read through `queryString`.**
- **The page derives _new_ where it draws** (log 54 Q9): `folderLine` and
  `LibraryFolders` each test `scannedAt === null`, and `foldersToScan` on
  the server. No `isNewFolder` helper: the test is one comparison, and a
  shared helper across the wire would be the first.
- **`makeLibraryFolder` defaults to a scanned folder.** Most suites are
  about something else, and a scanned folder draws the plain _N titles_
  they already assert; a suite about a New folder says so at its call site,
  as `makeImportRun`'s callers name their phase.
- **No server-side folder builder.** The server's pure-unit suites each
  spell one `StoredLibraryFolder`, and `folders.scannedAt.test` reads its
  folders back from a real database; a builder there would save a line per
  suite.
- **Em dashes**: only those this initiative wrote, in comments and suites;
  no household copy changes.
- **Nothing on the schema, the wire, Settings, the shell's wiring or the
  prototype changes.**

## Testing Decisions

- **A good test asserts what a caller or the household sees**: the rows a
  slice answers, the count the summary carries, the body read or refused,
  the line and buttons drawn, the route pushed. It never asserts which
  helper ran, which SQL was issued or how the harness is built.
- **The initiative's behavioural suites carry every refactor commit**:
  `db.scannedAt`, `folders.scannedAt`, `createImporter.marksScanned`,
  `createImporter.reAddedFolder`, `foldersToScan`, `importBody`,
  `routes.folderScan`, `enrich` and the series `enrich`,
  `createEnrichment.added`, `enrichmentBody`, `routes.enrichmentSummary`,
  `folderLine`, `useFolderScan`, `LibraryFolders.scan`, `ImportFlow.enrich`,
  `EnrichmentFlow.fromImport` and `enrichPath`. Groups 1 to 4 change no
  assertion.
- **New tests**: the enrich slice's window count (commit 2), and
  `makeLibraryFolder`'s own test (commit 10). Prior art: the slice's
  `enrichmentCounts` cases; `makeImportRun.test` for a test-support
  builder's test.
- **Group 5 changes harnesses and headers, not assertions.** A suite that
  has to change an assertion to take the builder is reading a field it
  didn't set, and names it at its call site in the same commit.
- **Characterization before change.** A suite that has to change anywhere
  else than named here is reading an implementation detail, and is fixed in
  the same commit with the reason in the body.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at one error and 133
  warnings, or fewer.

## Out of Scope

- **A discriminated library scope** carrying `since` inside the `added`
  member, so `moviesInScope('added')` without a window can't be written.
  The body is the gate today; a follow-up for the journal.
- **A server-side `StoredLibraryFolder` builder** (see the Decision
  Document).
- **`importPlaced`'s positional parameters**, now eight long. It takes the
  folders read beside the films, shows and Found again it already took; an
  options object is a change to every start's call and its own round.
- **The household line's em dash** in `libraryTitleView` (the line for an
  original in its library folder, naming **Scan all folders**): older copy,
  for the repo-wide em dash pass.
- **A per-row Scan, watching folders, scanning on launch**, an upper bound
  on the added window, and everything else log 54 put out of scope.
- **The frozen `handoff-scan-new-folders/`.**

## Further Notes

- Group 1 is the round's reason to exist: the window is the one scope rule
  spelled inline, in two styles, and the summary assembles every title in
  it to answer a number.
- Order: commit 1 before 2 (2 counts with the fragment 1 adds). Commit 10
  before 11; 12 after 11, so it rewrites only the headers that stay.
  Groups are otherwise independent.
- Follow-ups this plan already sees, each for the journal, not this round:
  - a discriminated library scope;
  - `importPlaced`'s parameters as an object;
  - carried from Loading states: the Reset dialog's idle face before the
    reload, a danger-line primitive, CLAUDE.md's barrel list, `heldFetch`
    beyond the busy suites, and that entry's earlier list.
