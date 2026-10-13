# Plan: Import review — the sheet over the folders, and a review settled on the row

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/329

Today a sheet can seed a library but never edit one. Every row whose title
the library already holds is skipped with `· Already in library`, so the
export round trip only holds on an empty library. _Import from spreadsheet_
also asks for a root folder the Library folders page already names. Its
review sends every row to a form, even when one press would settle it.

This initiative fixes all three. The sheet reads every listed **Library
folder**. A held title takes the sheet's **Sheet fills** during the run and
holds its **Sheet differences** for review. The review settles `differs`,
`ambiguous` and `no-row` on the row, the way the Sync's review settles its
Decisions.

## Running the phases

**Phase 0 is HITL and docs-only.** It amends the prototype before any code
draws it (log 40 Q21). `issue-loop` stops there so the maintainer can review
the amendment.

**Phases 1–5 run AFK under `issue-loop`**, in order. They are log 40's
_Implementation Plan_ slices 2–4. Slice 3 is split into Phases 2 and 3, and
slice 4 into Phases 4 and 5. Each phase works end to end:

- Phase 1 runs a sheet over the listed folders.
- Phase 2 fills a held title's empty fields during the run.
- Phase 3 raises its differences and settles them with _Apply choices_.
- Phase 4 settles an `ambiguous` row with the **Folder picker**.
- Phase 5 settles a `no-row` row with _Import as_.

The docs (README, CLAUDE.md, the glossary) are log 40's slice 5. They are
not a phase here: they are ticked ✅ only after the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:

  | Route                                                     | Answer                                                                       |
  | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
  | `POST /api/import { sheetPath, enrich }`                  | `201 ImportRun` · `400 { error, field: 'sheet' \| 'folders' }` · `409`       |
  | `POST /api/import/current/problems/:id/apply { choices }` | `204` · `400` · `404`                                                        |
  | `POST /api/import/current/problems/:id/pick { folder }`   | `204` imported · `200 ImportProblem` redrawn · `400` not a candidate · `404` |
  | `POST /api/import/current/problems/:id/import`            | `204` · `404`                                                                |

  The bodies are read by a new `importBody` unit, `enrichmentBody`'s
  precedent, each `400` a sentence. `POST /api/library-folders/scan` keeps its
  contract, and the rest of `/api/import` is unchanged.

- **Schema**: none. No migration. The one new write is
  `setSeriesRating(id, units)` in the series' `curation` slice, over the
  existing `rating` column.

- **Key models** (shared by both build targets):
  - `IMPORT_FIELDS` becomes `['sheet', 'folders']`.
  - `ProblemKind` gains `differs`, the second soft kind. It carries `movieId`
    or `seriesId`, as `missing-meta` and `unplaced` do.
  - `SHEET_FIELDS`: synopsis, year, genres, director, cast, rating, as an
    `as const` list. `SheetField` is derived from it.
  - `SheetDifference` is `{ field, label, mine, sheet }`, `FieldConflict`'s
    shape with `sheet` in `tmdb`'s place. Both sides are spelled for display.
    `director`'s label reads _Created by_ on a series.
  - `SheetChoices` is a partial record of `SheetField` to `'mine' | 'sheet'`.
  - `CandidateFolder` is `{ path, name, videos }`.
  - `ImportProblem` gains `differences?` (on `differs`), `candidates?` (on
    `ambiguous`) and `guess?` (on `no-row`). It stays one interface, not a
    union. `ImportProblemDetail.candidates` is unchanged.

- **Boundaries**:
  - `planSheetFields` spells its own comparison. The dependency runs from
    `enrichment/` to `import-export/` and never back.
  - `FieldDiff` graduates to `components/` as a generic, presentational
    molecule. Each feature maps its own wire type onto `'mine' | 'theirs'`.
  - `FolderPicker` stays in `features/import-export/`. A folder is not a TMDB
    Candidate (log 23 Q40).

- **Unchanged throughout**:
  - The sheet field, its refusals, and the _Also fetch from TMDB_ box.
  - _Scan folders_ on the Library folders page.
  - Confident new matches importing during the run (log 13 Q16).
  - The Problem kinds `no-folder`, `no-video`, `unplaced`, `failed` and
    `missing-meta`, and every row's _Skip_.
  - Episodes. There are no episode adjustments, and episode numbers stay the
    **Episode link**'s.
  - The Sync's _Yours | TMDB_ face, pixel for pixel.

---

## Phase 0: Prototype amendment (HITL)

**User stories**: the surface of 1–12 and 34–56

### What to build

The amendments, in `docs/handoff/`:

- **`feat.ImportFlow`'s setup.** A folders group replaces the _Movies root
  folder_ field, in three states:
  - Listed: each folder's path in mono with its title count, and _Manage
    folders_ beside the list. There is no ✕.
  - Unreachable: _Can't be reached right now_ in danger ink.
  - None: _No library folders yet._, _Add library folders_, and _Start
    import_ disabled.
- **`feat.ImportFlow`'s review.** It gains three faces under a row's head:
  - A `differs` row: an accent dot and a _Yours | Spreadsheet_ diff over
    three fields, with _Apply choices_ and _Keep all mine_.
  - An `ambiguous` row: the Folder picker's cards (name, path in mono, video
    count) beside _Resolve_.
  - A `no-row` row: _Import as “Ironwood (2018)”_ beside _Resolve_.
- **The rest:**
  - `FamilyFlix.dc.html`'s seeded problems gain a `differs` row.
  - `mol.FieldDiff.dc.html` is new and carries the graduated molecule's
    props, `theirsLabel` among them. `feat.EnrichmentFlow` draws it
    unchanged.
  - `COMPONENT-SPEC.md` gains the molecule and the two feature units.

### Acceptance criteria

- [ ] Setup draws all three folder states, and none of them has a root field.
- [ ] The review draws all three new faces, each with _Skip_. `differs` has
      no _Resolve_.
- [ ] `mol.FieldDiff`'s `data-props` names its rows, `theirsLabel`,
      `onApply` and `onKeepAll`. The Sync's conflict row draws as it did.
- [ ] `COMPONENT-SPEC.md` lists `mol.FieldDiff`, `FolderPicker`, and
      `ProblemRow`'s face slot.
- [ ] The maintainer has reviewed the amendment before Phase 1 starts.

---

## Phase 1: The sheet over the folders

**User stories**: 1–17

### What to build

The changes:

- **One walk for both starts.** It is extracted from the Folder scan. It
  skips an unreachable folder with the scan's warning line, logs
  `Scanning   E:\Movies` per folder, and tags each Source folder with its
  Library folder.
- **The two starts differ only in what names a folder.** A sheet run names
  it through a Sheet row and `matchRows`. A Folder scan names it through the
  folder's own `guessedRow`.
- **Already in library** applies both rules in both starts: the Source
  folder on record first, then the title key and year. A held row is still
  skipped with `· Already in library` in this phase.
- **`start(sheetPath, enrich)` drops the root.** With no folders listed it
  is refused as `400 { error: 'Add a library folder first.', field:
'folders' }`.
- **The root is retired**, with all of these:
  - its refusals;
  - the `contains` overlap check;
  - `sheetFolderOf`;
  - log 30 Q19's rule that the root joins the list.
- **`ImportSetup`.** A folders group replaces the root field. It reads
  `fetchLibraryFolders`, draws nothing until that lands, and draws the three
  states from Phase 0. It doesn't use `FolderRow`, because of its ✕.
- **`ImportFlow`.** It loses the root's state and refusal, and draws the
  `folders` refusal under the group.

### Acceptance criteria

- [ ] A sheet run over two listed folders imports the films and shows in
      both, and logs a `Scanning` line per folder.
- [ ] An unreachable folder is skipped with the warning line, and the run
      goes on over the others.
- [ ] A start with none listed answers `400` on `folders` in one sentence,
      and the screen draws it under the group.
- [ ] A held title is recognised by its Source folder first, then by key and
      year, in a sheet run and a Folder scan alike.
- [ ] _Scan folders_ keeps its contract, and its suites stay green.
- [ ] Setup draws the listed, unreachable and none states, draws nothing
      while loading, and has no ✕. _Start import_ is disabled with none
      listed.
- [ ] _Manage folders_ and _Add library folders_ push `/settings/folders`.
- [ ] The root's suites (`sheetRoot`, `routes.importRoot`) are retired, and
      nothing in `src/` or `server/src/` still names the root.

---

## Phase 2: Sheet fills

**User stories**: 18–21, 23–33

### What to build

The changes:

- **`planSheetFields(current, row, kind) → { fill, differences }`** is new
  and pure, `planFields`' sibling on the import's side. `current` is the held
  title's values in the sheet's shape. The row's genres arrive already read
  onto the Genre pool, with unknown genres dropped and logged once as today.
  It holds these rules:
  - Text is compared trimmed and case-blind.
  - Cast and genres are compared as sets.
  - The rating is compared as a number.
  - A series' year is compared as its spelled Year range.
  - A film's year is never a difference.
  - Title is never in play.
  - Watched is a fill-only mark for films. It never unmarks a film or
    touches one in progress.
  - _Created by_ is filled and compared as director is.
- **The held row is planned before `matchRows`.** It is the held title at
  the row's matched Source folder, else the held title with the row's key and
  year, so a title with no folder is reached too. A row matching none goes on
  to `matchRows` unchanged.
- **The fill is written during the run:**
  - A film goes through `updateMovie`, and its watched mark through
    `markWatched`.
  - A series goes through `enrichSeries`, and its rating through the new
    `setSeriesRating`. The curation slice's comment that a series "carries no
    household rating" is corrected.
  - Each title that took fills logs `✓ Updated    Heat (1995) — genres,
director` as `success`.
  - A held title with nothing to fill still logs `· Already in library`.
  - A held show still gains any new episodes found on disk.
- **Differences are planned but not yet surfaced.** The run never fills a
  field it would raise as a difference.

### Acceptance criteria

- [ ] `planSheetFields`' table-driven suite covers:
  - empty versus filled, per field;
  - case and whitespace;
  - sets in any order;
  - the Genre pool already applied;
  - a rating fill and a rating difference;
  - a series' end year;
  - a film's year never differing;
  - watched marking only;
  - title never in play.
- [ ] `setSeriesRating` sets and clears a rating, and answers `false` for a
      series that doesn't exist. It joins the curation suite.
- [ ] A held film with a folder, and one without, both take the sheet's
      fills. `✓ Updated` names the fields.
- [ ] A field filled on both sides that differs is left as it was after the
      run.
- [ ] A _Watched_ row marks an unwatched film. It leaves a watched film and
      one in progress as they were.
- [ ] A held series takes synopsis, Year range, genres, _Created by_, cast
      and rating, and still gains a new episode found on disk.
- [ ] A held title's title is never changed.

---

## Phase 3: Sheet differences

**User stories**: 22, 34–45, 56

### What to build

The changes:

- **The `differs` Problem.** A held title with differences becomes one
  `differs` Problem. It carries `movieId` or `seriesId` and `differences`,
  and its reason reads _The spreadsheet has different values for fields you
  already filled in._ Both sides are spelled for reading: lists joined with
  commas, a rating as stars, a Year range spelled.
- **`apply(id, choices)`.** It writes the sheet's side of each field chosen
  `sheet`, through Phase 2's writes, and takes the Problem off. It answers
  `false` for an id not there. Behind it is
  `POST /api/import/current/problems/:id/apply { choices }`, answering `204`,
  `400` or `404`.
- **`FieldDiff` graduates to `components/`** with its suite. It becomes
  generic:
  - rows of `{ key, label, mine, theirs }`;
  - a `theirsLabel`;
  - the theirs side chosen by default;
  - `onApply(choices)` keyed by `'mine' | 'theirs'`;
  - `onKeepAll`.

  `DecisionRow` maps `'theirs'` back to `'tmdb'`.

- **`ProblemRow`** gains `DecisionRow`'s face slot under its head. It draws
  `FieldDiff` with _Spreadsheet_ for `differs`, an accent dot, and no
  _Resolve_.
- **`useImportRun`** gains `apply`. On `204` it takes the row off. On `404`
  it takes the row off too. The run is not polled in review.
- **The review's tiles.** _need your attention_ counts `differs`, and
  _matched confidently and imported_ counts only new imports.

### Acceptance criteria

- [ ] A held title whose sheet row differs ends the run as one `differs`
      Problem, its fields unchanged.
- [ ] `apply` writes only the fields chosen `sheet`, a series' rating among
      them, and takes the Problem off. _Keep all mine_ (Skip) writes nothing.
- [ ] A second run over the same sheet raises a kept difference again.
- [ ] The route answers `204`, `400` for a malformed body, and `404` for an
      id not there. `importBody` refuses each malformed body in a sentence.
- [ ] The export round trip's missing half: an export with one row edited,
      imported onto the library it came from, lands as a difference, and
      _Apply choices_ writes it.
- [ ] `FieldDiff`'s suite covers `theirsLabel` and the default choice.
      `DecisionRow`'s suite proves the Sync's face is unchanged.
- [ ] `ProblemRow` draws the diff for `differs` with no _Resolve_, and the
      other kinds as they were.
- [ ] The tiles count as above.

---

## Phase 4: The Folder picker

**User stories**: 46–50, 55

### What to build

The changes:

- **Candidates on the snapshot.** An `ambiguous` Problem carries
  `candidates: CandidateFolder[]`, one per folder the match weighed, each
  with its name, path and video count.
- **`pick(id, folder)`.** It imports the row from one of its own candidates
  and answers one of four ways:
  - `null` when it imported the row.
  - The redrawn `no-video` Problem when the folder holds no single video.
  - `false` when the id is not there.
  - A refusal for a folder that is not a candidate.

  Behind it is `POST /api/import/current/problems/:id/pick { folder }`,
  answering `204`, `200 ImportProblem`, `400` or `404`.

- **`FolderPicker`** is new in `features/import-export/`. It takes
  `CandidatePicker`'s shape with its own pixels: no poster and no % match.
  `ProblemRow` draws it for `ambiguous`, with _Resolve_ kept beside it.
- **`useImportRun`** gains `pick`. It takes the row off on `204` or `404`,
  and redraws the row in place from a `200`.

### Acceptance criteria

- [ ] An `ambiguous` Problem's candidates name every folder it weighed, each
      with its video count.
- [ ] Picking a one-video candidate imports the title from that folder and
      takes the Problem off.
- [ ] Picking a candidate with no video or several turns the row into that
      folder's `no-video` Problem. Its _Resolve_ opens the Found-file choice.
- [ ] A folder that is not a candidate is refused `400`, and nothing is
      imported.
- [ ] A press on a row already gone answers `404`, and the row comes off.
- [ ] `FolderPicker`'s suite covers the cards and the press, and
      `ProblemRow` draws it beside _Resolve_ for `ambiguous`.

---

## Phase 5: Import as

**User stories**: 51–55

### What to build

The changes:

- **The guess on the snapshot.** A `no-row` Problem carries `guess`: the
  title and year a Folder scan would give the folder.
- **`importGuessed(id)`.** It imports the folder under `guessedRow`, exactly
  as a Folder scan would, and takes the Problem off. Behind it is
  `POST /api/import/current/problems/:id/import`, answering `204` or `404`.
- **_Import as “Ironwood (2018)”_** (`secondary`, `sm`) is drawn by
  `ProblemRow` for `no-row`, with _Resolve_ kept beside it.
- **`useImportRun`** gains `importAsGuessed`. It takes the row off on `204`
  or `404`.

### Acceptance criteria

- [ ] A `no-row` Problem's `guess` matches what a Folder scan names the same
      folder.
- [ ] _Import as_ imports the folder under that title and year, and takes the
      Problem off.
- [ ] A press on a row already gone answers `404`, and the row comes off.
- [ ] `ProblemRow` draws _Import as_ with the guess spelled, beside
      _Resolve_.
- [ ] `no-folder`, `no-video`, `unplaced`, `failed` and `missing-meta` rows
      draw and act as before, and every row's _Skip_ is unchanged.
