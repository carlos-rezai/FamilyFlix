# Refactor plan: Import review — one writer for the sheet's values, the Sync's twins on the import's side, one answer for a press on the row, and the ticks that close the initiative

> Source initiative: `import-review`, issue 329 (step 328).
> Shipped by issue 330 (`62ac823`, the prototype amendment) and issues
> 331–335, one RED and one GREEN each: 331 `5b3c362`/`078b48d`, 332
> `31e9760`/`5a8ddd6`, 333 `6444cde`/`b529f75`, 334 `27d0417`/`fb69403`,
> 335 `86b0a31`/`8d5bc8f`.
> Design log: `docs/design-logs/40-import-review.md`. Plan:
> `docs/PRDs/40-import-review-plan.md`.
> This is the initiative's closing round: it ticks **Import review** and
> closes 329 and 328. Filed as issue 336.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`import-review` shipped all five slices of log 40's implementation plan. The
full suite is green at `8d5bc8f`: 8673 tests across 514 files, with
`tsc -b --force` clean. Every acceptance criterion holds.

The slices were built one at a time by agents that each saw one slice. The
behaviour is right, but the code reads like five authors. `createImporter.ts`
grew from 1677 to 2183 lines. Most of the growth is a second copy of something
that already existed, either in the importer or in its twin, `createEnrichment`.
Log 40 built the import review _as the Sync's review, with the sheet in TMDB's
place_. The Sync keeps its pure rules in units beside the domain
(`currentFields`, `planFields`, `plannedEnrichment`). The import keeps one of
the three as a unit and inlines the other two, twice each. Every finding below
was checked against the code for this plan. The one bug was reproduced with a
throwaway run.

### 1. A bug: a held show is _Already in library_ twice

In a sheet run, a held show with nothing to fill and no new episode logs
`· Already in library Harbor & Vine (2021)` **twice**. `fillSeries` logs it
through `logHeld` when the row fills nothing. Then `importShow` logs it again,
because its guard, `held !== null && !match.updated`, only knows whether the
show took fills, not whether the line was already written. A re-run of the
two-show fixture logs four lines for two shows. No suite covers a held show
re-run with nothing to do, which is how it shipped.

### 2. The sheet's values are written by two hand-built writers

- **The fill** (`fillFilm`, `fillSeries`) turns `planSheetFields`' `fill` into
  an `updateMovie` patch, or an `enrichSeries` call plus `setSeriesRating`,
  key by key.
- **_Apply choices_** (`writeSheetSide`) builds the same two writes a second
  time, from the raw **Sheet row** this time rather than from the plan.

The two don't agree. The fill writes cast and genres as `planSheetFields`
normalised them, trimmed with blanks dropped. _Apply choices_ writes
`row.cast` as the sheet spelled it, and trims synopsis and director by hand.
The same sheet value can land differently depending on which press wrote it.
The Sync solved this once: `plannedEnrichment` turns a plan, or _Apply
choices_, into the columns to write, and one closure writes them.

### 3. The held title's twins of the Sync's units are missing

- **`HeldValues` is built by hand twice**, once in `fillFilm` and once in
  `fillSeries`. A film's is given `endYear: movie.year`, which is meaningless
  and harmless only because a film's year is never compared. The Sync's twin
  is a unit: `currentFields(movie)` and `currentSeriesFields(series)`.
- **The write mapping** has no unit (group 2). The Sync's is
  `plannedEnrichment`: `movieEnrichment`, `seriesEnrichment` and
  `chosenEnrichment`.
- `fillFilm` and `fillSeries` are the same function twice, one per kind.

### 4. A press on the row answers three different ways

- **`pick`** answers `ImportProblem | null | false` and throws
  `CandidateRefusedError`. That is a value, a sentinel, a boolean and an
  exception for one press. Everywhere else, the codebase answers a press with
  an outcome value and a refusal table: enrichment's `pick` and `apply`
  through `DECISION_REFUSALS`, the folder add through `FOLDER_REFUSALS`, the
  Component slot's _"Outcomes are values, never throws"_.
- **`importGuessed`** answers a boolean. It shares `pick`'s job, importing
  one folder from the review under one row, but not `pick`'s handling of how
  that can go:
  - A `no-row` folder that doesn't hold exactly one video answers `false`. The
    route says `404`, and the screen drops a row the server still holds.
    `pick` redraws that case as the folder's `no-video` Problem.
  - A copy that fails files a `failed` Problem at the end of the list, which
    the screen only sees on its next read. `pick` redraws it in the row's
    place.
  - A successful import files `missing-meta` (the run's source is `sheet`) and
    then splices it straight back off. The rule _"a row no sheet named has no
    genre to be missing"_ is spelled as an undo.
- **The two presses each look up the folder's Library folder** with the same
  `storage.libraryFolders().find(isUnder…)`, and each import through
  `importMatch` with the same `genreReader()`/`before`/splice dance.
- **The route's `404` is spelled inline** as `` `No such problem: ${id}` ``
  six times.

### 5. Wire shapes that drifted from the PRD

- **`ImportProblem.guess`** is `{ title, year? }` under a new type,
  `TitleGuess`. The PRD and log 40 Q16 say `guess?: string`, _"the title and
  year a Folder scan would give it"_. The object shape costs three things:
  - A name clash: **Title guess** in the glossary is the **Movie form**'s
    prefill off a picked video, so `TitleGuess` names a different thing.
  - A client copy, `guessSpelled`, of the server's `titleWithYear`.
  - A type nobody else reads.
- **`candidates` means two things on the wire.** It is `CandidateFolder[]` on
  the snapshot and `string[]` on the **Problem detail**, held apart by
  `ImportProblemDetail extends Omit<ImportProblem, 'candidates'>`. The form's
  one reader, `otherCandidates`, wants the folders' names, which a
  `CandidateFolder` already carries.
- **A rating difference is spelled `★★½`.** The amended prototype spells it
  `3½ ★` (`FamilyFlix.dc.html`'s seeded `differs` row), and log 40 Q13 says
  _"a rating as stars' number"_. The prototype is the spec.

### 6. Small things the build left

- **One rule, many hands, inside the importer:**
  - The `· Already in library` line is spelled in three places: `logHeld`,
    `importShow` and `skipHeld`.
  - **`GenreReader`** was introduced to carry the pool and the warned set
    together. `importMatch`, `importShow` and `knownGenres` still take them
    as two loose arguments, and `importPlaced` destructures it to pass them on.
  - **`problemOf`** takes a `movieId` but no `seriesId`. `fileDiffers` and
    `fileUnplaced` build their Problem by hand to add one.
  - **The held lookups aren't twins:**
    - The two lookups are `heldFilm` and `heldShowOf`.
    - The maps are `inLibrary()` and `seriesInLibrary(held)`.
    - `heldShowOf` rebuilds the series map **on every call**, where `heldFilm`
      is handed the films' map once.
  - **The Candidate folders** are built inline in `execute`, as a `Map`
    expression nested four deep inside a ternary inside a `file` call.
- **Comments that still say root:**
  - In the importer: the `Importer` docblock's member list (_"`start`,
    `current`, `cancel`, `problem`, `resolve` and `dismiss`"_), and
    `createImporter`'s docblock (_"a row already there … is neither a
    **Match** nor a **Problem**"_). `execute` repeats the second.
  - In the routes: the six import route comments that say _"under the root"_.
  - In the types: `ImportRun.source`'s and `ImportProblemDetail.files`'.
  - In the setup: `FolderShapes.styles`' _"between the root"_.
- **One sentence still says root:** `ImportPathError` answers _"That file is
  not under the import folder."_. No such folder exists any more.
- **Ragged comments** where a phrase was spliced into an existing line:
  - `IMPORT_FIELDS`, `ImportPhase` (one line past the measure).
  - `ImportStartError`, `ImportPathError`, and `start`, `problem`, `resolve`
    and `resolveSeries` on `Importer`.
  - `startImport`, `ImportReview` and `ProblemRow`.
- **`ProblemRow`'s docblock documents the wrong thing.** `guessSpelled` was
  inserted between the component's docblock and the component, so the
  docblock now sits on the helper.
- **`FolderPicker`'s `label` is optional.** It is the group's accessible name,
  and its one caller always passes it.
- **The folder line is spelled twice.** _N titles_ or _Can’t be reached right
  now_ appears in `FolderRow` and again in `ImportSetup`. `ImportSetup.styles`
  also names a styled component `FolderRow`, the molecule's own name.
- **The client's three new calls** each build
  `` `${CURRENT_ENDPOINT}/problems/${encodeURIComponent(id)}` `` themselves.
  `useImportRun.pick` redraws a row inline, where `takeOff` sits right beside
  it.

### 7. Documentation the ship left

- `CLAUDE.md`:
  - **The folder tree** doesn't know the initiative shipped. It's missing
    `planSheetFields/`, `routes/importBody/`, `components/FieldDiff/`,
    `import-export/FolderPicker/`, `ProblemRow`'s face slot, the three new
    feature `api/` calls, `setSeriesRating` in `curation`, and
    `createImporter`'s three new members. `enrichment/` still lists
    `FieldDiff/`.
  - **The _Bulk Import_ section** says _"Matches each row to a folder"_ under a
    typed root, and a held title is still _"skipped"_.
  - **_Maintainer tools_** still reads _"a Sheet and a Library root"_.
  - **Step 23 and its feature line** are 🔜.
- **The README:** the status table, the step-23 entry and the _Bulk import_
  feature line.
- **The glossary:** **Bulk import** still walks _"the spreadsheet's root"_,
  and the _Import review_ section says _"Planned (🔜) until it ships"_.
- **The dev journal** has no entry for the initiative.

## Solution

One writer, the Sync's twins, one answer, the PRD's shapes:

- **Two new pure units beside `planSheetFields`, mirroring the Sync's:**
  - `heldValues/`: `heldValues(movie)` and `heldSeriesValues(series)` → the
    held title in the sheet's shape. This is `currentFields`' twin.
  - `plannedSheetFill/`: `movieSheetPatch(fill)` and `seriesSheetPatch(fill)`
    → the columns a fill writes, and `chosenSheetFill(proposed, choices)` →
    the fill _Apply choices_ writes. This is `plannedEnrichment`'s twin.
- **`planSheetFields` also answers `proposed`:** the sheet's side of each
  difference, normalised as the fill is.
- **One closure, `writeSheetFill(held, fill)`, writes every sheet value.**
  The run's fill and _Apply choices_ both go through it. `fillFilm` and
  `fillSeries` become one `fillHeld`. `writeSheetSide` retires.
- **`pick` and `importGuessed` answer one outcome value, `ReviewOutcome`**,
  through one closure, `importFromReview`:
  - a folder without exactly one video is redrawn as its `no-video` Problem;
  - a failed copy is redrawn as its `failed` Problem;
  - an import takes the row off.

  The route maps the outcome through a `PROBLEM_REFUSALS` table, and
  `CandidateRefusedError` retires. `missing-meta` is filed only for a match a
  **Sheet row** named, so nothing is filed and then undone.

- **`guess` is a string and `candidates` has one meaning**, as the PRD has
  them. A rating difference is spelled as the prototype spells it.
- **The double line is fixed under a new test.** The importer's small
  repetitions each get one spelling, the comments stop saying root, and the
  docs and the ticks close the initiative.

What changes on the wire, all of it inside this unreleased initiative:

- `POST …/problems/:id/import` gains the `200` with the redrawn row that
  `…/pick` already has.
- `ImportProblem.guess` becomes a string.
- `ImportProblemDetail.candidates` becomes the snapshot's
  `CandidateFolder[]`.
- A rating difference reads `3½ ★`.
- `ImportPathError`'s sentence names a library folder.
- A held show's re-run logs its line once.

Nothing else moves. No pixel moves, no other route changes, and no schema
changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each one is
`refactor: [import-review] issue #336 …` except where a commit is named
`fix:` or `docs:`.

### Group 1 — the words catch up

1. **The comments say Library folders.** Fix, without changing any code:
   - **Importer:** the `Importer` docblock lists all eleven members. The
     `createImporter` docblock's _Already in library_ paragraph says what the
     run does now: the Source folder on record first, then key and year; a
     held title takes its **Sheet fills** and files its **Sheet differences**;
     it is never a **Match**. `execute`'s _"a row already in the library is
     neither a match nor a problem"_ goes.
   - **Routes:** the six import route comments that say _"under the root"_.
   - **Types:** `ImportRun.source`'s and `ImportProblemDetail.files`' comments.
   - **Setup:** `FolderShapes.styles`' docblock.
   - **Reflows:** every comment group 6 lists as ragged is reflowed, with the
     wording unchanged.
2. **`fix: … ImportPathError names a library folder`.** The sentence becomes
   _"That file is not under a library folder."_. The resolve suites that
   assert the sentence move with it.

### Group 2 — one spelling each, inside the importer

3. **`GenreReader` travels whole.** `knownGenres(names, genres, current)`,
   `importMatch(…, genres, …)` and `importShow(…, genres, …)` each take the
   reader, and `importPlaced` passes it on undestructured. `pick` and
   `importGuessed` pass `genreReader()`. Covered by the existing genre-warning
   suites (one line per unknown name across a run).
4. **`problemOf` takes the title's owner.** Its last parameter becomes
   `owner?: { movieId: string } | { seriesId: string }`, spread onto the
   Problem. `fileDiffers`, `fileUnplaced` and the `missing-meta` filing all
   call it, so none builds a Problem by hand. Covered by the existing snapshot
   assertions on `movieId` and `seriesId`.
5. **One _Already in library_ line.** `logAlreadyHeld(current, row)` is the
   line's one spelling. `logHeld`, `importShow` and `skipHeld` call it. No
   change in what is logged yet.
6. **`fix: … a held show is Already in library once`.**
   - **The new test first,** in the sheet-folders suite: a sheet re-run over
     both fixtures, nothing to fill and nothing new, logs exactly one
     `· Already in library` line per title. It fails today with two per show.
   - **Then the fix:** a held show's line is `importShow`'s alone. `fillSeries`
     writes only `✓ Updated`, and its `false` leaves the line to `importShow`.
     The one caller that never reaches `importShow` writes the line itself
     when nothing was filled: a held series reached by key and year with no
     folder found.
7. **The held lookups are twins.**
   - `inLibrary` becomes `heldFilmsByKey`.
   - `seriesInLibrary` becomes `heldSeriesByKey`, built once per run in both
     `execute` and `executeScan`.
   - `heldShowOf` becomes `heldShow`, handed that map as `heldFilm` is handed
     the films' map, rather than rebuilding it per show.

   Covered by the sheet-folders and Folder scan suites' _Already in library_
   cases.

8. **The Candidate folders are built in one place.** A module-level
   `candidateFolders(scans, wholeOf)` → `CandidateFolder[]`: each scan's
   whole folder, de-duplicated by path, in the order weighed. `execute` files
   `{ ...problem, candidates: candidateFolders(…) }`. Covered by the
   folder-picker suite's candidates cases (two folders, near-name, several
   videos, a split Collection folder).
9. **`listedFolderOf(dir)`** is the one lookup of the Library folder a review
   press imports under, read live as today. `pick` and `importGuessed` call
   it.

### Group 3 — the Sync's twins on the import's side

10. **`heldValues/` is born.** `heldValues(movie)` and
    `heldSeriesValues(series)` → `HeldValues`. The type moves here from
    `planSheetFields`, which imports it back. A film's `endYear` is `null`. A
    series' status reads `unwatched` and its creator stands as `director`, as
    today. `fillFilm` and `fillSeries` call them in place of the two inline
    literals. The new suite follows `currentFields`': a film, a series, and the
    empty fields of each.
11. **`planSheetFields` also answers `proposed`.** `SheetPlan` gains
    `proposed: SheetFill`: the sheet's side of each **Sheet difference** in
    fill's shape, normalised exactly as a fill is (trimmed text, members
    trimmed with blanks dropped, a series' `year` with its `endYear`). Nothing
    reads it yet. The suite's difference cases each assert `proposed` beside
    `differences`.
12. **`plannedSheetFill/` is born.** It is pure:
    - `movieSheetPatch(fill)` → the `updateMovie` patch;
    - `seriesSheetPatch(fill)` → the `enrichSeries` columns, `director` as
      `creator`;
    - `chosenSheetFill(proposed, choices)` → the `SheetFill` of every field
      chosen `sheet`, and nothing for `mine` or for a field the choices don't
      name.

    Rating and Watched stay on the fill for the writer to route. The suite
    follows `plannedEnrichment`'s. Nothing calls the unit yet.

13. **One writer.** `writeSheetFill(held, fill)` writes any `SheetFill` onto a
    held film or series:
    - a film through `movieSheetPatch` and `updateMovie`, and `markWatched` for
      `watched`;
    - a series through `seriesSheetPatch` and `enrichSeries`, and
      `setSeriesRating` for `rating`;
    - an empty patch is never written.

    The fill calls it. `Differing` becomes `{ kind, id, proposed }`, so it no
    longer carries the row. `apply` writes `chosenSheetFill(proposed, choices)`
    through the same writer, and `writeSheetSide` retires. This aligns _Apply
    choices_ with the fill: cast and genres land as the plan normalised them.
    The sheet-differences suite gains that case, a cast differing only by a
    blank member applying as the trimmed list.

14. **`fillFilm` and `fillSeries` are one `fillHeld(current, held, row,
genres)`**, where `held` is `{ kind, id }`. It reads the record, plans,
    files the differences, writes the fill and answers whether it took any.
    Its callers are unchanged in what they do. Covered by the sheet-fills and
    sheet-differences suites.

### Group 4 — one answer for a press on the row

15. **`ReviewOutcome` is born, and `pick` answers it.** The new type is
    `{ kind: 'imported' } | { kind: 'redrawn'; problem: ImportProblem } |
{ kind: 'not-found' } | { kind: 'refused'; error: string }`, beside
    `Importer`. A folder that is not a candidate is `refused` with today's
    sentence, and `CandidateRefusedError` retires. The pick route answers the
    outcome through a `PROBLEM_REFUSALS` table beside `DECISION_REFUSALS`:
    `not-found` → `404`, `refused` → `400`. The wire is unchanged. The
    folder-picker suite asserts outcomes where it asserted `null`, `false` and
    the rejection. The route suite is unchanged.
16. **One spelling of the problem `404`.** It is
    `` `No such problem: ${id}` ``, today's words, now spelled once and used by
    the skip, apply, pick, import, detail and both resolve routes. The route
    suites are unchanged.
17. **`importFromReview` imports one folder under one row, for both
    presses.** Given the Problem, the row, the scan and its Library folder, it
    answers a `ReviewOutcome`:
    - a scan without exactly one video is `redrawn` as its `no-video` Problem,
      in place;
    - a copy that fails is `redrawn` as its `failed` Problem, in place;
    - otherwise `imported`, with the row taken off.

    `pick` calls it. `importGuessed` calls it too, with `guessedRow`, so it
    now answers `ReviewOutcome` rather than a boolean. The import route
    answers `200` with a redrawn row, as the pick route does. New cases go in
    the `importGuessed` importer and route suites: a `no-row` folder of two
    videos is redrawn as `no-video` (`200`), and a failed copy as `failed`
    (`200`).

18. **`missing-meta` belongs to a Sheet row.** `importMatch` files it when a
    row the sheet named leaves the film in no genre. That is a `named`
    argument, true for a sheet's match and false for a Folder scan's and
    _Import as_'s. It no longer reads `current.source`.
    `importFromReview`'s post-import splice retires. Covered by the Folder
    scan suite (no `missing-meta`) and the `importGuessed` suite (the
    snapshot otherwise unchanged).
19. **The client takes the `200` from either press.**
    - `importGuessed` in the feature's `api/` answers `ImportProblem | null`,
      as `pickCandidateFolder` does.
    - Both build their endpoint through one local `problemEndpoint(id)`, which
      `applySheetChoices` uses too.
    - `useImportRun` gains `settle(id, redrawn)`, `takeOff`'s twin that
      replaces the row in place, and `pick` and `importAsGuessed` both call it.

    The `useImportRun.importAs` and `api` suites gain the `200` case, the row
    redrawn in place.

### Group 5 — the PRD's shapes

20. **`guess` is a string.** `ImportProblem.guess?: string` is the title and
    year a Folder scan would give the folder, spelled by the server's
    `titleWithYear` (`Ironwood (2018)`, or the title alone). `TitleGuess`
    retires from the types and the barrel, and `ProblemRow`'s `guessSpelled`
    goes. The label is unchanged: _Import as “Ironwood (2018)”_. The suites
    that built `{ title, year }` assert the string.
21. **`candidates` has one meaning on the wire.**
    - `ImportProblemDetail` extends `ImportProblem` whole. `problem()` keeps
      the snapshot's `CandidateFolder[]` rather than overriding it with paths,
      and its non-`ambiguous` Problems carry none.
    - `otherCandidates` reads each candidate's `name` past the first, where it
      read each path's last segment. That is the same banner, _also matched:
      Harbor.Lights.2019_, with the name the Folder picker draws.
    - The detail suites and `formValues`' `otherCandidates` cases move to the
      folder shape.
22. **A rating difference reads as the prototype spells it.** `planSheetFields`'
    `stars` becomes `` `${whole}${half ? '½' : ''} ★` ``: `7` → `3½ ★`, `8` →
    `4 ★`, `1` → `½ ★`, `0` → `No stars`. The suite's rating cases move with
    it.

### Group 6 — the client's small things

23. **`ProblemRow`'s docblock sits on the component**, reflowed, now that
    `guessSpelled` is gone. `FolderPicker`'s `label` is required.
24. **The folder line is spelled once.** A pure `folderLine(folder)` in the
    feature, in its own folder with its suite, answers _N titles_ or _Can’t be
    reached right now_. `FolderRow` and `ImportSetup` both draw it. The
    styled row in `ImportSetup.styles` is renamed `ListedFolder`, so no styled
    component borrows the molecule's name.

### Group 7 — the ticks that close the initiative

25. **`docs: [import-review] issue #336 the docs know import review
shipped`.** - **`CLAUDE.md`:** - The tree gains `planSheetFields/`, `heldValues/`, `plannedSheetFill/`,
    `routes/importBody/`, `components/FieldDiff/` (and `enrichment/` loses
    it), `import-export/FolderPicker/`, `ProblemRow`'s face slot, the
    feature `api/`'s three calls, `setSeriesRating` in `curation`, and
    `createImporter`'s members. - The _Bulk Import_ section reads the Library folders, the held title's
    fills and differences, and the review settled on the row. - The Settings hub's `/api/import` mention reads `{ sheetPath, enrich }`. - Step 23 and _Import review_ under _Maintainer tools_ turn ✅, and the
    _Bulk import_ line stops saying _"Library root"_. - **The README:** the status table, the step-23 entry and the _Bulk import_
    feature line. - **The glossary:** **Bulk import** walks the listed Library folders, and
    the _Import review_ section's _"Planned (🔜) until it ships"_ becomes
    shipped.
26. **`docs: [import-review] issue #336 the journal`.** Add a dev-journal
    entry in the others' shape: what shipped, what this round changed, what
    was deliberately not changed (below), and the follow-up. File the
    follow-up named under Out of Scope. Then close 329 and 328.

## Decision Document

- **The import's pure rules mirror the Sync's, unit for unit:**
  `heldValues` ↔ `currentFields`, `planSheetFields` ↔ `planFields`, and
  `plannedSheetFill` ↔ `plannedEnrichment`.
  - They stay in `import-export/`. Log 40 fixed the dependency direction,
    _"from `enrichment/` to `import-export/` and never back"_, so nothing is
    shared across the two domains. Whether the two comparisons become one is
    still the next refactor's call, and not this one's.
  - `HeldValues` moves into `heldValues/` with its builders.
- **`planSheetFields(current, row, kind) → { fill, differences, proposed }`.**
  `proposed` is the sheet's side of each difference in `SheetFill`'s shape,
  normalised as a fill is. It is what _Apply choices_ writes, so a field
  lands the same whichever press wrote it.
- **`plannedSheetFill`:**
  - `movieSheetPatch(fill)` → the patch `updateMovie` takes;
  - `seriesSheetPatch(fill)` → the columns `enrichSeries` takes, `director`
    as `creator`;
  - `chosenSheetFill(proposed, choices) → SheetFill`.

  Rating and Watched are routed by the writer (`setSeriesRating`,
  `markWatched`), because neither goes through `enrichSeries` or the movie
  patch's own path on every kind.

- **One writer closure, `writeSheetFill(held, fill)`.** `Differing` is
  `{ kind, id, proposed }`: what _Apply choices_ needs, and no more.
- **`ReviewOutcome`** is the answer to a press on the row that imports:
  `imported`, `redrawn` (with the Problem), `not-found` or `refused` (with the
  sentence). It follows the codebase's outcome-value convention, as
  enrichment's `pick` does.
  - **`apply` stays a boolean.** It is `dismiss`'s twin, a synchronous write
    with no refusal of its own beyond _not there_.
  - **The rest of the importer keeps its exceptions.** `start`, `scan`,
    `resolve` and `resolveSeries` are unchanged: they refuse before a run or a
    copy exists, which is what their errors say.
- **`PROBLEM_REFUSALS`** is the routes' table for a review press:
  `not-found` → `404` _No such problem: <id>_, and `refused` → `400` in the
  importer's sentence. `CandidateRefusedError` retires.
- **`importFromReview` is the one way the review imports a folder**:
  `no-video` redrawn, `failed` redrawn, or taken off.
  - `POST …/problems/:id/import` answers `204`, `200 ImportProblem` or `404`,
    the pick route's three answers.
  - This amends the PRD's route table, where the import route had no `200`.
  - It closes two gaps the build reported: the screen dropping a row the
    server kept, and a `failed` Problem the screen never saw.
- **`missing-meta` is filed only for a match a Sheet row named.** That is an
  argument to `importMatch`, not the run's `source`.
- **`ImportProblem.guess?: string`, as the PRD and log 40 Q16 have it.**
  `TitleGuess` retires: it clashed with the glossary's **Title guess**, and it
  made the client spell what the server already spells.
- **`ImportProblemDetail` extends `ImportProblem` whole.** `candidates` is
  `CandidateFolder[]` everywhere, and the form reads names from it.
- **A rating difference is spelled `3½ ★`**, the amended prototype's
  spelling, `0` as _No stars_.
- **`ImportPathError`** reads _"That file is not under a library folder."_.
- **The folder line** _N titles_ / _Can’t be reached right now_ is
  `folderLine(folder)`, drawn by `FolderRow` and by setup's listed rows.
- **No change** to:
  - the schema, `setSeriesRating`, `importBody`'s readers or the `apply`
    route;
  - `FieldDiff` and its two per-feature choice mappers (log 40 Q18: each
    feature maps its own wire type);
  - `FolderPicker`'s pixels, `ImportSetup`'s pixels, the tiles' counts or the
    log lines (except the duplicate);
  - `scan(folders, enrich)`, `walkListed` or `claimRun`.

## Testing Decisions

- **What a good test asserts here** is what the maintainer or the screen could
  observe:
  - the record after a run or a press, read through `getMovie` and
    `getSeriesDetail`;
  - the snapshot's Problems and log lines;
  - the route's status and body;
  - the row on screen.

  It never asserts which closure wrote a field. That is why group 3 can
  replace two writers with one without losing a guarantee: the sheet-fills
  and sheet-differences suites assert the records.

- **New suites:**
  - **`heldValues`:** a film, a series, the empty fields of each, and a film's
    `endYear` as `null`.
  - **`plannedSheetFill`:** each patch from a full and an empty fill, and
    `chosenSheetFill` over `sheet`, `mine` and an unnamed field.
  - **`folderLine`:** reachable and unreachable.
- **New cases in existing suites:**
  - **Sheet folders:** a held show is _Already in library_ once. This is the
    bug's test, written first in its commit.
  - **Sheet differences:** _Apply choices_ writes cast as the fill would.
  - **`planSheetFields`:** `proposed` beside each difference, and the rating
    spelled `3½ ★`.
  - **`importGuessed`, importer and route:** the `no-video` and `failed`
    redraws, and the `200`.
  - **`useImportRun.importAs` and `api`:** the `200` redraw.
- **Suites whose assertions move with a shape:**
  - folder picker: outcomes;
  - `guess` as a string, in the importer, route, `ProblemRow` and
    `ImportFlow` suites;
  - the detail's `candidates` and `formValues`' `otherCandidates`;
  - `ImportPathError`'s sentence.
- **Unchanged suites that carry the refactor:**
  - sheet fills, sheet folders, Folder scan, series, Collection folder and
    source folders;
  - the routes' import suites;
  - `FieldDiff`, `DecisionRow`, `ImportReview` and `ImportSetup`.
- **Prior art:**
  - `currentFields`' and `plannedEnrichment`'s suites, for the two new pure
    units;
  - `routes.enrichment*` and `DECISION_REFUSALS`, for the outcome table;
  - the folder-picker suite's redraw cases, for `importGuessed`'s.
- **Every commit runs the full `vitest run` and `tsc -b --force`.** The
  incremental build can miss a spec file's type error.

## Out of Scope

- **Clearing a held end year.** Applying `2021–` over a held `2019–2023`
  writes the start year only, because `enrichSeries` can't null `end_year`.
  That is a storage write of its own. It is filed as a follow-up and not
  changed here.
- **Everything log 40 left out:** episode adjustments, title in play, Watched
  ever unmarking, a search on `no-folder`, and a tile for fills.
- **`scan(folders, enrich)` keeps its argument.** The PRD sketched
  `scan(enrich)`. #331 kept the folders, so the Folder scan's suites and
  `POST /api/library-folders/scan`'s contract stood. The journal records it.
- **Where a held title is looked up:** after `matchRows`, as #332 built it.
  The PRD said before. Looking up after is what lets a held title's folder be
  claimed instead of coming back as `no-row`.
- **A review press reads the Library folders live**, while `resolve` checks
  found paths against the run's own list. The first records where a title
  came from now. The second is a security boundary over what the run read.
  They stay apart.
- **Splitting `createImporter` further.** Log 13's rule stands: the run's
  state machine stays closures inside the domain. Only pure rules leave it.
- **A shared `'movie' | 'series'` type.** `FormKind` and enrichment's run kind
  already spell it locally. A third local spelling is not worth a new shared
  type in this round.

## Further Notes

- **Deliberately not changed:**
  - `ImportSetup` keeps its own listed rows rather than `FolderRow`, which
    carries a ✕ (log 40 Q3).
  - `ImportFlow`'s three press callbacks stay three. Each swallows its own
    failure with its own comment, `onSkip`'s precedent.
  - `sheetChoices` in `ProblemRow` and `tmdbChoices` in `DecisionRow` stay
    apart, the way `FieldDiff` was graduated to work (log 40 Q18).
- **The token count of the initiative's steps** ran 131k–255k against a 100k
  budget, the thickest being #331, which moved every import suite off
  `start(sheet, root)`. The journal records it for `prd-to-issues`.
