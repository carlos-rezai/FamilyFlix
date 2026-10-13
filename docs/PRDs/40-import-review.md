> **Initiative:** `import-review`
> **Design log:** `docs/design-logs/40-import-review.md`
> **Issue:** #329 (the PRD) · #328 (the step)
> **Build order:** step 23, the first after Season posters. #327 (_Finish_ lets the **Current run** go) shipped before it. It ships as five thin slices (log 40, _Implementation Plan_)

## Problem Statement

I keep the family library up to date, and the spreadsheet I used to keep it in is still how I think about it. I edit a row in an export, fix a director, add a missing synopsis, re-rate a film, and feed it back to _Import from spreadsheet_. Nothing happens: every row whose title the library already holds is skipped with `· Already in library`, so a sheet can seed a library but never edit one. The export round trip only holds on an empty library.

_Import from spreadsheet_ also asks me for a _Movies root folder_, when I have already told the app where my movies are on the Library folders page. Two places to name a folder, and they can disagree.

And when the run ends, its review is a list of rows that each send me to a form. An ambiguous row, where the run found two folders and could not choose, needs only a press on the right one. A folder no row named needs only "import it under its own name". The TMDB Sync's review settles its rows on the row. The import's should too.

## Solution

_Import from spreadsheet_ reads **every listed Library folder** and a **Sheet** (CSV or Excel). The root field is gone. Setup shows the listed folders, each with its title count, and _Manage folders_. With none listed it says so and points to the folders page. A sheet run and a **Folder scan** walk the folders the same way.

New titles still import during the run, as today. A **Sheet row** for a title the library **already holds** is no longer skipped:

- Its **empty** fields are filled during the run: a **Sheet fill**, logged as `✓ Updated`.
- A field filled on **both** sides that differs waits in the review as a **Sheet difference**, on a new soft Problem kind, `differs`. Nothing I filled in is overwritten without a press.

The review settles three kinds on the row:

- **`differs`**: a _Yours | Spreadsheet_ diff per field, the sheet chosen by default, _Apply choices_ or _Keep all mine_. This is the Sync's conflict row, with the sheet in TMDB's place.
- **`ambiguous`**: a **Folder picker**, one card per **Candidate folder**. Pressing one imports the row from it.
- **`no-row`**: _Import as “Ironwood (2018)”_, the folder imported under its own name.

Every other kind keeps _Resolve_ and _Skip_, as today.

## User Stories

### Setup

1. As the maintainer, I want _Import from spreadsheet_ to read every Library folder I have listed, so that I name where my movies are once, on the folders page.
2. As the maintainer, I want the _Movies root folder_ field gone, so that there is only one place to name a folder.
3. As the maintainer, I want setup to show each listed folder's path in mono with its title count, so that I can see what the import will read.
4. As the maintainer, I want an unreachable folder shown as _Can't be reached right now_ in danger ink, so that I know a drive is unplugged before I start.
5. As the maintainer, I want _Manage folders_ beside the list, so that I can add or remove a folder without hunting for the page.
6. As the maintainer, I want no ✕ on setup's folder rows, so that setup is never where I remove a folder by accident.
7. As the maintainer, I want setup with no folders listed to say _No library folders yet._ with _Add library folders_, so that I know what to do first.
8. As the maintainer, I want _Start import_ disabled while no folder is listed, so that I can't start a run with nothing to read.
9. As the maintainer, I want the route to refuse a start with no folders in one sentence, _Add a library folder first._, drawn under the folders group, so that a stale screen still tells me why.
10. As the maintainer, I want an unreachable folder skipped with the scan's warning line rather than refusing the run, so that one unplugged drive doesn't block the others.
11. As the maintainer, I want the sheet field, its refusals and the _Also fetch from TMDB_ box unchanged, so that the rest of setup is as I know it.
12. As the maintainer, I want the folders list to draw nothing until it has loaded, so that setup never flashes an empty state.

### The run: new titles

13. As the maintainer, I want a sheet run over two listed folders to import the films and shows in both, so that the sheet reaches my whole library.
14. As the maintainer, I want confident new matches to import during the run, as today, so that a thousand-row sheet doesn't become a thousand-row review.
15. As the maintainer, I want the Activity log's `Scanning   E:\Movies` line per folder in a sheet run too, so that both imports read alike.
16. As the maintainer, I want _Scan folders_ on the folders page unchanged, so that a sheetless import is still one press.
17. As the maintainer, I want a sheet run to recognise a held title by its Source folder first, then by title and year, so that it applies the same **Already in library** rule a Folder scan does.

### The run: held titles

18. As the maintainer, I want a sheet row for a title I already hold to fill that title's empty fields, so that a sheet can complete my library.
19. As the maintainer, I want a held title reached even when it has no folder (added through the form, or its folder not found), so that every held title can take the sheet's fills.
20. As the maintainer, I want each title that took fills logged as `✓ Updated    Heat (1995) — genres, director`, so that I can see what changed.
21. As the maintainer, I want a held title with nothing to fill or compare to still log `· Already in library`, so that the log reads as it does today.
22. As the maintainer, I want a field I filled in that the sheet spells differently held for review, never overwritten during the run, so that a month-old export never undoes edits I made in the app.
23. As the maintainer, I want synopsis, director and cast compared trimmed and case-blind, cast and genres as sets, so that a capital letter or an order is never a difference.
24. As the maintainer, I want genres read onto the Genre pool before they are compared, unknown ones dropped and logged once as today, so that a genre the app doesn't have is never a difference.
25. As the maintainer, I want a rating in the sheet to fill an unrated title and to differ from a rated one, so that the household's own rating travels with the sheet.
26. As the maintainer, I want a series' year range compared as spelled (`2019–2023`), so that a show that has ended can take its end year.
27. As the maintainer, I want a film's year never a difference, because a match already requires the years to agree.
28. As the maintainer, I want a row reading _Watched_ to mark an unwatched film watched, so that a sheet can carry what we've seen.
29. As the maintainer, I want a sheet never to unmark a watched film or touch one in progress, so that a sheet with no Status column doesn't undo our watch history.
30. As the maintainer, I want a title's own spelling never changed by the sheet, so that the row that found it can't rename it.
31. As the maintainer, I want _Created by_ on a series filled and compared as director is on a film, so that a show's credit works the same way.
32. As the maintainer, I want a held show still to gain any new episodes found on disk, as today, so that a sheet run doesn't stop a show growing.
33. As the maintainer, I want no adjustments for episodes, so that episode numbers stay the Episode link's.

### The review: differences

34. As the maintainer, I want a held title whose sheet row differs to appear in the review as one `differs` row, so that I settle each title once.
35. As the maintainer, I want its reason to read _The spreadsheet has different values for fields you already filled in._, so that I know what the row is.
36. As the maintainer, I want its dot in accent, like the Sync's conflict, so that the two reviews read alike.
37. As the maintainer, I want one _Yours | Spreadsheet_ line per differing field, both sides spelled for reading (lists joined with commas, a rating as stars, a year range spelled), so that I can compare at a glance.
38. As the maintainer, I want the sheet's side chosen by default, so that bringing in a sheet I just edited is one press.
39. As the maintainer, I want to choose per field, so that I can take the sheet's director and keep my own synopsis.
40. As the maintainer, I want _Apply choices_ to write the sheet's side of every field I chose and take the row off, so that the review shrinks as I go.
41. As the maintainer, I want _Keep all mine_ to take the row off and write nothing, so that I can dismiss a stale sheet's proposals.
42. As the maintainer, I want _Apply choices_ on a series to write its rating too, so that a show's rating travels as a film's does.
43. As the maintainer, I want no _Resolve_ on a `differs` row, so that a comparison isn't confused with an edit.
44. As the maintainer, I want the next run over the same sheet to ask again for a difference I kept, so that the sheet is the truth until I change it or export over it.
45. As the maintainer, I want _need your attention_ to count `differs` rows, and _matched confidently and imported_ to count only new imports, so that the tiles mean what they say.

### The review: the other two faces

46. As the maintainer, I want an `ambiguous` row to show one card per folder it weighed, each with the folder's name, its path in mono and its video count, so that I can pick the right one.
47. As the maintainer, I want pressing a card to import the row from that folder and take the row off, so that an ambiguous match is one press.
48. As the maintainer, I want a picked folder with no video or several to turn the row into that folder's `no-video` Problem, redrawn in place, so that I can still finish it with _Resolve_ and the Found-file choice.
49. As the maintainer, I want _Resolve_ kept beside the Folder picker, so that I can edit a pick first.
50. As the maintainer, I want only one of the row's own candidates accepted by the route, so that a pick can't import an arbitrary folder.
51. As the maintainer, I want a `no-row` row to offer _Import as “Ironwood (2018)”_, the name a Folder scan would give it, so that importing a folder the sheet forgot is one press.
52. As the maintainer, I want _Resolve_ kept beside _Import as_, so that I can name it myself.
53. As the maintainer, I want `no-folder`, `no-video`, `unplaced`, `failed` and `missing-meta` rows unchanged, so that the faces I know still work.
54. As the maintainer, I want every row's _Skip_ unchanged, so that dismissing anything is still one press.
55. As the maintainer, I want a press on a row that is already gone answered as not found and the row taken off, so that a double press never errors on screen.

### The Sync's review

56. As the maintainer, I want the Sync's _Yours | TMDB_ conflict face to look and behave exactly as today, so that moving it into a shared molecule changes nothing I see.

## Implementation Decisions

### Prototype first

The first slice amends the prototype, per _The prototype is the spec_. In `feat.ImportFlow`: setup's folders group in place of the root field (listed, unreachable, none), and the review's three faces (a `differs` row with three fields, an `ambiguous` row's Folder picker, a `no-row` row's _Import as_). `FamilyFlix.dc.html`'s seeded problems gain a `differs` row. `mol.FieldDiff.dc.html` is new and carries the graduated molecule's props; `feat.EnrichmentFlow` draws it unchanged. `COMPONENT-SPEC.md` gains the molecule and the two feature units. Nothing is built until it lands.

### Types (shared by both build targets)

- `IMPORT_FIELDS` becomes `['sheet', 'folders']`.
- `ProblemKind` gains `differs`, the second soft kind, which carries `movieId` or `seriesId` as `missing-meta` and `unplaced` do.
- `SHEET_FIELDS` is an `as const` list on `ENRICH_FIELDS`' precedent: synopsis, year, genres, director, cast, rating. `SheetField` is derived from it.
- `SheetDifference` is `{ field, label, mine, sheet }`, `FieldConflict`'s shape with `sheet` in `tmdb`'s place. Both sides are spelled for display. The label for `director` reads _Created by_ on a series.
- `SheetChoices` is a partial record of `SheetField` to `'mine' | 'sheet'`.
- `CandidateFolder` is `{ path, name, videos }`.
- `ImportProblem` gains three optional fields, each documented by the kind it is set on: `differences?` (`differs`), `candidates?` (`ambiguous`) and `guess?` (`no-row`, the title and year a Folder scan would give it). It stays one interface, not a union. `ImportProblemDetail.candidates` stays as it is, for the form.

### The importer (`import-export/`)

- `start(sheetPath, enrich)` drops the root. `scan(enrich)` reads the list itself. Both claim the run through `claimRun` and end in `importPlaced`, as today.
- **`walkListed`** is one closure, extracted from `executeScan`, serving both starts. It skips an unreachable folder with the warning line, logs `Scanning` per folder, and tags each scan with its Library folder. The two starts differ only in what names a folder: a Sheet row through `matchRows`, or the folder itself through `guessedRow`.
- **Already in library** applies both rules in both starts: the Source folder on record (`titleAt`) first, then the title key and year.
- Retired: the root's refusals, its `contains` overlap check, `sheetFolderOf`, and log 30 Q19's rule that the root joins the list.
- A sheet run starting with no folders listed is refused as an `ImportStartError` on `folders`.
- A held row is planned before `matchRows`: the held title at the row's matched Source folder, else the held title with its key and year. A row matching none goes on to `matchRows` unchanged.
- The plan's fill is written during the run, with `✓ Updated` (`success`) naming the fields. Its differences become one `differs` Problem. The run never fills a field it raised as a difference.
- `apply(id, choices)` writes the sheet's side of each field chosen `sheet` and takes the Problem off. It answers `false` for an id not there.
- `pick(id, folder)` imports an `ambiguous` row from one of its own candidates. It answers `null` when imported, the redrawn `no-video` Problem when the folder holds no single video, or `false` when not found. A folder that isn't a candidate is refused.
- `importGuessed(id)` imports a `no-row` folder under `guessedRow`, exactly as a Folder scan would.

### `planSheetFields` (new, pure)

`planSheetFields(current, row, kind) → { fill, differences }`, `planFields`' sibling on the import's side. `current` is the held title's values in the sheet's shape, and the row's genres arrive already read onto the Genre pool. It holds the rules in user stories 23–31:

- Comparison: trimmed and case-blind text; cast and genres as sets; the rating as a number; a series' year as its spelled Year range.
- A film's year is never a difference. Title is never in play.
- Watched is a fill-only mark for films.

It spells its own comparison rather than importing `enrichment/`'s, because the dependency runs from `enrichment/` to `import-export/` and never back. Whether to extract the two comparisons into one is the refactor's call.

### Storage (`library/`)

- A film is written through the existing `updateMovie(id, patch)` (rating and genres included), and its watched fill through `markWatched`.
- A series is written through `enrichSeries` for synopsis, year range, genres, creator and cast.
- **`setSeriesRating(id, units)`** is new, in the series' `curation` slice beside the heart. It answers whether the series exists, on `setSeriesFavorite`'s shape, and the slice's comment that a series "carries no household rating" is corrected. This is the one write the step adds: `updateSeries` is a whole-record edit with episodes, and `enrichSeries` never touches a rating by design.

### Routes

| Route                                                     | Answer                                                                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `POST /api/import { sheetPath, enrich }`                  | `201 ImportRun` · `400 { error, field: 'sheet' \| 'folders' }` · `409`       |
| `POST /api/import/current/problems/:id/apply { choices }` | `204` · `400` · `404`                                                        |
| `POST /api/import/current/problems/:id/pick { folder }`   | `204` imported · `200 ImportProblem` redrawn · `400` not a candidate · `404` |
| `POST /api/import/current/problems/:id/import`            | `204` · `404`                                                                |

- The bodies are read by a new `importBody` unit (`enrichmentBody`'s precedent), each `400` a sentence.
- `POST /api/library-folders/scan` keeps its contract.
- The rest of `/api/import` is unchanged.

### Client

- **`FieldDiff` graduates to `components/`** on its second caller (the `CreditsRow` and `CornerMenu` precedent). It becomes generic and presentational: rows of `{ key, label, mine, theirs }`, a `theirsLabel` (_TMDB_ or _Spreadsheet_), the theirs side chosen by default, `onApply(choices)` keyed by `'mine' | 'theirs'`, and `onKeepAll`. Each feature maps its own wire type onto it: `DecisionRow` maps `'theirs'` back to `'tmdb'`, and `ProblemRow` maps it to `'sheet'`.
- **`FolderPicker`** is new in `features/import-export/`. It takes `CandidatePicker`'s shape but has its own pixels (no poster, no % match). It isn't a shared molecule: a folder is not a TMDB candidate (log 23 Q40's argument).
- **`ProblemRow`** gains the face slot under its head (`DecisionRow`'s layout) and chooses the face by kind: `FieldDiff` for `differs`, `FolderPicker` for `ambiguous`, _Import as_ (`secondary`, `sm`) for `no-row`.
- **`ImportSetup`** draws the folders group in place of the root field. It reads `fetchLibraryFolders`, which is `null` until it lands. It doesn't use `FolderRow`, because of its ✕.
- **`ImportFlow`** loses the root's state and refusal, and draws the `folders` refusal under the group.
- **`useImportRun`** gains `apply`, `pick` and `importAsGuessed` beside `skip`. Each takes the row off on `204`, or redraws it from a `200`, once the route answers. The run is not polled in review.
- The feature's `api/` gains `applySheetChoices`, `pickCandidateFolder` and `importGuessed`, one caller each.

### Slices (log 40, _Implementation Plan_)

1. **Prototype.**
2. **The sheet over the folders:** `walkListed`, the new start, `IMPORT_FIELDS`, setup's folders group, and the root retired.
3. **Fills and differences:** `planSheetFields`, `setSeriesRating`, the held row planned, `differs`, `FieldDiff` graduated, the face slot, and `apply`.
4. **The other two faces:** `candidates`, `FolderPicker` and `pick`; `guess`, _Import as_ and `import`.
5. **Docs:** README, CLAUDE.md and the glossary, ticked ✅ only after the refactor.

## Testing Decisions

A good test drives a unit through its public surface and asserts what a caller sees: a run's snapshot and the library's records afterwards, a route's status and body, what a screen draws and what a press posts. It never asserts how the importer's closures are arranged.

- **`planSheetFields`** gets a pure, table-driven suite, `planFields`' prior art. It covers empty versus filled per field, case and whitespace, sets in any order, the Genre pool already applied, a rating fill and a rating difference, a series' end year, a film's year never differing, watched marking only, and title never.
- **`createImporter`** suites run over the existing fixtures in a sandbox (`libraryFixture`, `seriesFixture`), `createImporter.folderScan.test.ts`'s prior art:
  - a sheet run over two listed folders;
  - an unreachable folder skipped;
  - a held title filled with and without a folder, and `✓ Updated` logged;
  - a difference raised and never filled;
  - `apply` writing only the chosen fields;
  - `pick` from a candidate, the `no-video` redraw, and a refused non-candidate;
  - `importGuessed`;
  - the existing `sheetRoot` suite retired with what it tests.
- **`setSeriesRating`** joins the curation suite.
- **Routes**: the start's new body and the `folders` refusal, and the three Problem writes with every status in the table. `routes.import.test.ts` and `routes.enrichmentConflicts.test.ts` are the prior art, and `routes.importRoot.test.ts` is retired. The export round trip (`routes.export.test.ts`) gains its missing half: an edited row imported onto the library it came from lands as a difference, and _Apply choices_ writes it.
- **Client**, with Testing Library and `fakeResponse`:
  - `FieldDiff` moves with its suite and gains `theirsLabel`. `DecisionRow`'s suite proves the Sync's face is unchanged.
  - `FolderPicker`, `ProblemRow`'s three faces by kind, and `ImportSetup`'s three states (listed, unreachable, none) each get a suite.
  - `useImportRun`'s new writes follow `skip`'s prior art.
  - `ImportFlow`'s refusal under the folders group.

## Out of Scope

- A _Browse…_ for the sheet: a file dialog is a new preload channel, and log 30 Q3's ruling stands.
- Reviewing confident new matches before they import (log 13 Q16).
- Adjustments for episodes; the Episodes sheet stays the Export's.
- TMDB in the import: the _Also fetch_ box still hands _Finish_ to a Sync (log 13 Q18).
- A Folder scan reading a sheet found inside a Library folder.
- A search on `no-folder`, because the walk already read every listed folder.
- Unmarking watched films from a sheet, or renaming a title from one.
- Making _Keep all mine_ stick across runs.

## Further Notes

- The review's rows stay **Problems** and the Sync's stay **Decisions**: two reviews, two nouns. "Adjustment" is the brief's word for the whole review, and is kept for prose about Import review alone. `conflict` is deliberately not reused as a Problem kind.
- A stale sheet can propose undoing in-app edits. Each of those is a difference I must press, never a silent write.
- The new and amended terms (**Sheet fill**, **Sheet difference**, **Candidate folder**, **Folder picker**, `differs`, **Already in library**, **Problem**, **Review step**, **Field conflict**) are in `docs/ubiquitous-language.md` already, from log 40.
