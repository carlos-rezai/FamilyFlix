> **Initiative:** `tidy-into-folders`
> **Design log:** `docs/design-logs/57-tidy-into-folders.md`
> **Issue:** #523 (the PRD, step 40)
> **Build order:** step 40, **Tidy into folders**, the checklist's _Tidy into folders: each loose video its own folder_. It ships as thin slices (log 57, _Implementation Plan_), the documents first. No migration. Two doors onto one move: a `loose` Problem in the Review step, and the Folder row's **Tidy dialog**.

## Problem Statement

The maintainer points FamilyFlix at an external drive, `E:\Movies\Movies (2026)`, holding about a hundred `Title (Year).mp4` files lying side by side, and presses _Scan all folders_. The scan finds 0 titles and says nothing about why. The walk reads a Library folder's top level as a shelf, never as a film (log 30 Q15), so a video lying loose there is never read. The only way in today is the Movie form, one film at a time, a hundred times.

The handoff for this feature draws a dedicated page with its own log, checkboxes, a rename editor and a Settings badge; it predates the Review step's groups and duplicates what the Review step already does.

## Solution

FamilyFlix offers to give each loose video the folder the walk expects, moving nothing until the maintainer presses.

- **Inside a scan.** A Folder scan files a `loose` Problem in the Review step for each loose video it walks past (and one per loose show). The row shows where the file will go, `→ Apex (2026)\Apex.2026.1080p.BluRay.mkv`, what moves with it, and **Tidy into “Apex (2026)”**. The press makes the folder, moves the video and its companions in, and imports it under the run's Import mode, exactly as _Import as_ does. A **Tidy all** press does every row on the _Loose_ filter.
- **On its own.** The Folder row on the Library folders page gains a line, _9 loose videos_ · **Tidy**, opening the **Tidy dialog**: every planned move, the videos left where they are and why, and **Move 9 videos**. After it, the snackbar says _Scan all folders to add them._

A tidy is renames only, inside the same root, all or nothing: on any failure it puts back what it moved and removes the folder it made. The files keep their names; only the folder is new, named as the scan would name the film. A video the library already holds, a Left-out video, an extra, and a video whose folder name is already taken are never moved.

## User Stories

### What counts as loose

1. As the maintainer, I want a video lying directly in a Library folder's root to count as a **Loose video**, so that a drive of bare files has a way into the library.
2. As the maintainer, I want a sample, trailer, featurette or other extra in the root left out, so that a film's extras are never tidied as films of their own.
3. As the maintainer, I want a **Held video** in the root (one I added by hand through the Path bridge) left out, so that a video already playing where it lies is never moved out from under its stored path.
4. As the maintainer, I want a **Left-out video** in the root left out, so that a film the household deleted and kept the file of doesn't come back through a tidy.
5. As the maintainer, I want only the root's top level tidied, so that Collection folders and Source folders one level down, which already import, are left alone.
6. As the maintainer, I want an Unreachable folder to count 0 loose videos, so that a drive that isn't plugged in reads nothing.

### What moves with a video

7. As the maintainer, I want a video's subtitles (`Apex (2026).en.srt`) to move with it, so that the film keeps its subtitles after the tidy.
8. As the maintainer, I want its `-poster` image and `.nfo` to move with it, so that every file named after the video stays beside it.
9. As the maintainer, I want a **Companion file** matched by the video's stem followed by `.` or `-`, case folded, so that the rule is the one the scan already reads subtitles and posters by.
10. As the maintainer, I want another video never moved as a companion, so that a tidy moves exactly one film.
11. As the maintainer, I want a file two stems claim (`Apex.Redux.en.srt` beside `Apex.mkv` and `Apex.Redux.mkv`) to go with the longest stem that matches, so that each subtitle lands beside its own film.

### The new folder

12. As the maintainer, I want the new folder named as the scan would name the film (`Apex.2026.1080p.BluRay.mkv` into `Apex (2026)\`), so that the family sees a clean folder when they open the drive by hand.
13. As the maintainer, I want the files to keep their own names, so that every other player on the family's machines still sees the same files.
14. As the maintainer, I want the folder name made safe for the filesystem, so that a title with a colon or slash never fails the move.
15. As the maintainer, I want a video whose folder name is already taken in the root (file or folder, case folded) left loose with _A folder called “Apex (2026)” is already here._, so that a tidy never moves a film into a shelf folder and hides every film under it from the walk.
16. As the maintainer, I want two loose videos sharing one folder name both offered, the second refused with the same reason once the first has made the folder, so that the clash is caught at the moment of the move.

### Loose episodes

17. As the maintainer, I want a loose video carrying an **Episode tag** never tidied as a film, so that `Breaking.Bad.S01E01.mkv` doesn't become a film called Breaking Bad.
18. As the maintainer, I want all of a show's loose episodes, grouped by the name before the tag (by **Title key**), tidied together into one **Show folder** of that name, so that a show arrives as one series.
19. As the maintainer, I want the episodes kept flat in the Show folder, with no Season folder made, so that the move is the smallest one the scan reads as a show.
20. As the maintainer, I want episodes whose name gives nothing before the tag left loose, with one Warning line per folder (_⚠ 3 loose episodes at the top of E:\Series don't name their show, left where they are_), so that I know to make that folder by hand.

### In the Review step

21. As the maintainer, I want a Folder scan, of either Scan scope, to file a `loose` Problem for each loose video and each loose show, so that the run lists what it walked past instead of saying nothing.
22. As the maintainer, I want a `loose` Problem to be hard and filed after the folder's other Problems, so that it sits with the other titles not yet in the library.
23. As the maintainer, I want its title to be the folder name and its reason _Lies loose at the top of E:\Movies, with no folder of its own._ (a show: _12 episodes lie loose at the top of E:\Series, with no folder of their own._), so that the row says what and why.
24. As the maintainer, I want the row to draw the destination in mono and _Moves with it:_ with the companions joined by `·`, so that the press is an informed confirm.
25. As the maintainer, I want **Tidy into “Apex (2026)”** in the _Import as_ slot, so that the row's action sits where the Review step's other row actions sit.
26. As the maintainer, I want a clash row to draw no Tidy button, only _Resolve_ and _Skip_, so that I'm never offered a move that would be refused.
27. As the maintainer, I want the walk to log one info line per folder with any (`· 9 loose videos at the top of E:\Movies, listed in review to tidy`), so that the Activity log says where the loose videos went.
28. As the maintainer, I want a _Loose_ pill on the Kind filter, so that I can see the loose rows alone.
29. As the maintainer, I want **Tidy all** beside _Skip all_ on the _Loose_ filter, so that a hundred loose films take one press.
30. As the maintainer, I want a sheet run to file no `loose` Problems, so that a row whose film lies loose stays `no-folder` as today.
31. As the maintainer, I want no snackbar after the scan, so that unsettled videos are listed where the Bulk import rule says they belong.

### Pressing Tidy in review

32. As the maintainer, I want _Tidy into_ to move the files and then import the new folder named off its folder under the run's Import mode, so that one press puts the film in the library.
33. As the maintainer, I want a loose show's press to import it as a series, so that its episodes arrive under one show.
34. As the maintainer, I want the Problem to come off as imported, so that the review shrinks as I go.
35. As the maintainer, I want the press to log `✓ Tidied Apex.2026.1080p.BluRay.mkv into Apex (2026)\ (+2 with it)` and then the import's own lines, so that the Activity log records the move.
36. As the maintainer, I want the press to be a Busy button, so that a double press never moves twice.
37. As the maintainer, I want no confirm dialog, so that the row, which already drew every file and its destination, is the confirm.
38. As the maintainer, I want a failed move to redraw the same row with _Couldn't move it: <why>. Nothing was moved._ and the Tidy button kept, so that I can close the other app and press again.
39. As the maintainer, I want _Tidy all_ to go in order and stop at the first failure saying the folder can't be reached, so that an unplugged drive doesn't produce a hundred failures.
40. As the maintainer, I want the Sync after the run to cover what a tidy imported, so that tidied films are synced with the rest.
41. As the maintainer, I want _Resolve_ on a loose film to open the Movie form untidied, its folder the root and its Found files the video and its companions, so that I can add it linked where it lies if I'd rather not move it.
42. As the maintainer, I want _Resolve_ on a loose show to open the Series Resolve over its episodes, so that a show can be settled by hand too.

### On its own, from the Folder row

43. As the maintainer, I want the Folder row to draw _9 loose videos_ and a **Tidy** text button under the left-out line, so that a folder's loose videos are one of its facts.
44. As the maintainer, I want the line absent when a folder has none, so that a tidy folder's row is unchanged.
45. As the maintainer, I want **Tidy** to open the **Tidy dialog**, titled _Tidy into folders_ with the folder's path beneath, so that I see the whole plan before anything moves.
46. As the maintainer, I want the dialog to draw nothing until the plan lands, so that it never shows a half-read plan.
47. As the maintainer, I want each tidy drawn as one row (the file in mono, `→ Apex (2026)\`, _Moves with it:_), so that I can check every move.
48. As the maintainer, I want a _Left where they are_ list, only when there are any, each with its reason, so that I know why a video won't move.
49. As the maintainer, I want **Move 9 videos** (_Move 1 video_ for one) and _Cancel_, and only _Close_ with nothing to move, so that the button says what it will do.
50. As the maintainer, I want the press to move only the tidies the dialog drew, so that a file dropped in since I opened it is never moved unseen.
51. As the maintainer, I want the dialog to close on _Moved 9 videos into folders of their own. Scan all folders to add them._ when all moved, so that I know the next step.
52. As the maintainer, I want the dialog to stay open after a partial failure, listing each failure with its reason under the count moved, so that I can see what to fix.
53. As the maintainer, I want a tidy refused with _A scan is running._ while a run is scanning or importing, so that the walk and a move never race.
54. As the maintainer, I want the folder to keep its scanned mark after a tidy, so that its row never falsely reads _not scanned yet_.

### The move itself

55. As the maintainer, I want a tidy to be renames only, never a copy, so that a hundred films move instantly and no progress bar is needed.
56. As the maintainer, I want the folder made exclusively, failing if one appeared since the plan, so that a clash is caught at the moment of the move.
57. As the maintainer, I want any failure to rename back what was moved, in reverse, and remove the folder it made, so that a failed tidy leaves the root as it was.
58. As the maintainer, I want a file open in a player to fail with _It's open in another app._, so that I know what to close.
59. As the maintainer, I want a vanished root to fail with _The folder can't be reached right now._, so that an unplugged drive reads as such.
60. As the maintainer, I want any other refusal to read _The disk refused the move._, so that every failure has a sentence.
61. As the maintainer, I want a rollback that itself fails to add _Some of its files are in “Apex (2026)”._, so that I know where to look.
62. As the maintainer, I want no stored path to need updating after a tidy, so that nothing on record ever points at a moved file.

### The maintainer's code

63. As the maintainer, I want the root's read, the plan and the move to be three units (two filesystem halves in `media/`, one pure plan in `import-export/`), so that each is tested on its own.
64. As the maintainer, I want the routes to reach them through the Importer, so that no route knows the filesystem.
65. As the maintainer, I want CLAUDE.md's boundary to name the Tidy as the one mover, so that the next change knows the rule and its limits.
66. As the maintainer, I want the glossary, the checklist, `COMPONENT-SPEC.md` and the units' docblocks to name the new terms, so that the next change reads them.

## Implementation Decisions

- **One initiative** (log 57 Q1), step 40. Not built: renaming a video or its companions, tidying below the top level, a show named by hand, watching folders or tidying on launch.
- **The handoff is not built 1:1** (Q2). `docs/handoff/handoff-tidy-loose-videos/` is committed as the reference for copy and intent, with a note naming log 57; the build draws from `mol.ProblemRow`'s _Import as_ slot, `mol.FolderRow`'s left-out line and `Modal`. Slice 1 amends `COMPONENT-SPEC.md`'s `ProblemRow` and `mol.FolderRow` rows. Rejected: the dedicated page, the Settings → Library row with a badge, the rename and show editors, the sibling-year hint.
- **Shared types** (log 57, _Types_): a new `tidy` types file with `Tidy { id, kind: 'film' | 'show', folder, videos, companions }` (id: the first video's name, case folded, stable for one read), `KeptLoose { files, reason }`, `TidyPlan { path, tidies, kept }` and `TidyResult { moved, failed: { id, folder, reason }[] }`. `PROBLEM_KINDS` gains `loose` (before the soft kinds); `ImportProblem` gains optional `tidy`, absent on a clash. `LibraryFolderView` gains `loose: number`.
- **`readLooseVideos`** (Q3, Q5), new, in the media domain: `(root) => { loose: LooseFile[]; names: string[] }`, where `LooseFile { video, companions, tag }`. Reads the root's top level only; videos by `isVideoFilename`, extras out, companions by stem plus `.` or `-` case folded with the longest stem winning, the Episode tag read. `names` is every entry in the root, for the clash rule.
- **`isExtra`** (Q3): the extras rule exported from `splitCollections` for `readLooseVideos`' caller.
- **`tidyPlan`** (Q3, Q6, Q7, Q8), new and pure, in the import-export domain: `(path, read, kept) => TidyPlan`. `kept` says whether a video is held or left out (from `storage.titleHolding` and the folder's left-out set). Films get the **Tidy folder name**, `titleWithYear(titleGuess(stem), yearInName(stem))` through `safeFilename`; tagged videos group by the Title key of the text before the tag into one `show` tidy named by `titleGuess` of that text through `safeFilename`; a name already in `names`, case folded, goes to `kept` with the clash reason; untitled episodes go to `kept`.
- **`tidyIntoFolder`** (Q14, Q15), new, in the media domain: `(root, tidy) => { ok: true } | { ok: false; reason }`. Exclusive `mkdir`, rename the videos in, then each companion; on failure rename back in reverse and remove the folder it made. Reasons by error: `EBUSY`/`EPERM` _It's open in another app._; root gone _The folder can't be reached right now._; `EEXIST` the clash sentence; else _The disk refused the move._; a failed rollback appends _Some of its files are in “<folder>”._
- **`createImporter`** (Q9, Q10, Q12, Q18): the Folder scan's walk reads each reachable root with `readLooseVideos`, plans with `tidyPlan`, files one hard `loose` Problem per tidy and per clash in walk order after the folder's other Problems, logs the per-folder info line, and the untitled-episodes Warning line. A sheet run files none. New methods: `looseOf(folderId) => TidyPlan` and `tidyFolder(folderId, ids) => TidyResult` (calls that are no run, `readShowFolder`'s precedent, refused while a run is scanning or importing) and `tidy(problemId) => ReviewOutcome` (move, then `importFromReview` named off its folder under the run's Import mode, a show through `importShow`; `imported` on success, `redrawn` with the failure reason and the Tidy kept on failure). A bulk `tidyMany(ids)` goes in order and stops at the first _can't be reached_.
- **Routes** (Q10, Q12): the library-folder list carries `loose` (0 for an Unreachable folder); `GET /api/library-folders/:id/loose` answers `TidyPlan`; `POST /api/library-folders/:id/tidy { ids }` answers `TidyResult`, `409` _A scan is running._ while a run scans or imports. `POST /api/import/current/problems/:id/tidy` answers `ReviewOutcome`; `POST /api/import/current/problems/tidy { ids }` answers the run snapshot, the `import-guessed` precedent.
- **Resolve on a `loose` row** (Q11): a film's Problem detail answers the root as the folder and its Found files the video and its companions (the film-of-one-video shape from `splitCollections`), so the add links it where it lies. A show's Resolve is the Series Resolve over its episodes, as `unplaced`'s is.
- **`ProblemRow`** (Q9): the `loose` face in the _Import as_ slot: the destination in mono, _Moves with it:_ and the companions joined by `·` when any, **Tidy into “<folder>”** (`Button secondary sm`, its Busy button), absent on a clash.
- **`ImportReview`** (Q9): **Tidy all** in _Import all as guessed_'s place on the _Loose_ filter, beside _Skip all_.
- **`importView`** (Q9): `loose: 'Loose'` and its dot tone.
- **`useImportRun` and the feature's wire calls** (Q10): `tidy(id)` and `tidyMany(ids)`.
- **`FolderRow`** (Q12): a line under the left-out one, _N loose videos_ and the **Tidy** text button in _Bring back_'s look, drawn only when `loose > 0`.
- **`TidyDialog` and `useTidy`** (Q12), new, in the import-export feature: `Modal` titled _Tidy into folders_, subtitle the folder's path; reads the plan on open and draws nothing until it lands; tidy rows, the _Left where they are_ list when any; footer **Move N videos** / _Move 1 video_ (`primary`, Busy) and _Cancel_, or only _Close_ with nothing to move. Posts the ids drawn. All moved: closes on the snackbar _Moved N videos into folders of their own. Scan all folders to add them._ Some failed: stays, listing failures under the count moved. A `409` shows its sentence.
- **After a tidy on its own** (Q13): nothing changes on the folder's mark. Rejected: clearing `scanned_at`, a per-folder scan.
- **No stored path follows a move** (Q16): the kept rule guarantees no `video_path`, `source_folder` or `left_out_videos` row names a moved file. No migration.
- **The boundary** (Q17): CLAUDE.md's writers rule gains _and a **Tidy**, the one mover: only on the maintainer's press, only a Loose video and its Companion files, into a folder it makes._ _FamilyFlix deletes nothing outside the Managed media directory_ holds: a rollback removes only the empty folder the same tidy made.
- **Names** (Q19): new **Loose video**, **Companion file**, **Tidy**, **Tidy folder name**, **Tidy plan**, **Tidy dialog**, the Problem kind **`loose`**; updated **Library folder**, **Folder row**, **Problem**, **Source folder**.
- **Slices** (log 57, _Implementation Plan_):
  1. the documents first: `COMPONENT-SPEC.md`'s two rows, CLAUDE.md's boundary;
  2. one loose film tidied in review: `readLooseVideos`, `tidyPlan` (films, clashes), `tidyIntoFolder`, the `loose` kind, the walk filing it and its info line, `importer.tidy`, the single route, `ProblemRow`'s face;
  3. Tidy all and failures: the bulk route, _Tidy all_, the redraw on a failed move, the stop on an unreachable folder;
  4. loose shows: grouping by the name before the tag, the untitled-episodes Warning line, the show's import and Series Resolve;
  5. on its own: `loose` on the folder list, the Folder row's line, `GET :id/loose`, `POST :id/tidy`, the Tidy dialog and its snackbar;
  6. the documents (Q20).

## Testing Decisions

- A good test drives a unit through its public face and asserts what a caller or the maintainer sees: the plan answered, the files on disk after a move, the rows and buttons drawn, the route's status and body. It never asserts which helper ran or the order of internal calls.
- **`tidyPlan`**, pure, the deepest unit: a film's folder name from a release-noise stem; `safeFilename` applied; a clash against a file and against a folder, case folded, goes to `kept` with its sentence; a held or left-out video is out; tagged episodes grouped by Title key into one show tidy; untitled episodes kept; two videos with one folder name both offered. Prior art: `splitCollections` and `groupShows` tests.
- **`readLooseVideos`**, over a temp directory: top level only; extras out; companions by stem plus `.`/`-`, case folded; a second video never a companion; the longest stem wins a shared companion; the Episode tag read; `names` lists every entry. Prior art: `walkLibraryFolder`'s temp-directory tests.
- **`tidyIntoFolder`**, over a temp directory: a film and its companions end up in the new folder with their names; an existing folder refuses with the clash sentence and moves nothing; a mid-move failure (a companion removed or locked between plan and move) rolls back and leaves no folder; reasons mapped per error. Prior art: the media domain's filesystem tests.
- **`createImporter`**: a Folder scan over a root of bare videos files `loose` Problems after the folder's others with the info line; a sheet run files none; `tidy` moves and imports under the run's Import mode and answers `imported`; a failed move answers `redrawn` with the reason; the bulk stops at the first unreachable failure; a loose show imports as one series; `looseOf` and `tidyFolder` answer the plan and the result, refused while a run scans. Prior art: `createImporter`'s tests with the fixture library.
- **The routes**: the folder list carries `loose`; `GET :id/loose` and `POST :id/tidy` answer their shapes, `409` while scanning; the review's single and bulk tidy routes. Prior art: the routes' supertest suites, the `import-guessed` route's tests.
- **`ProblemRow`**: the `loose` face draws the destination, the companions and _Tidy into_; a clash row draws no Tidy; the press is Busy. Prior art: its existing tests for the `no-row` face.
- **`ImportReview`**: the _Loose_ pill and _Tidy all_ on its filter. Prior art: its existing tests for _Import all as guessed_.
- **`FolderRow`**: _N loose videos_ · _Tidy_ drawn with some, absent with none. Prior art: its left-out line test.
- **`TidyDialog` / `useTidy`**: nothing drawn until the plan lands; rows and the kept list; the button's count and singular; the post carries the drawn ids; all moved closes on the snackbar; a partial failure stays and lists failures; `409` shows its sentence. Prior art: `ExportModal` and the Delete dialog's tests.
- **`importView`**: the `loose` label. Prior art: its own test.

## Out of Scope

- Renaming a video or its companions.
- Moving a video into a folder already there.
- Naming a show by hand, or a show editor.
- Tidying below a Library folder's top level (Collection folders already import).
- Tidying from a sheet run.
- Updating stored paths to follow a move.
- Watching folders, tidying on launch, or retrying a failed tidy automatically.
- A Settings → Library row, a badge, a dedicated page, a snackbar after the scan.

## Further Notes

- The trade-off is accepted: FamilyFlix now moves files in a folder it does not own, held to one press per tidy (or per bulk), rename only, all or nothing, with nothing on record pointing at what moves.
- A clash or an unnamed episode is left to the maintainer's hands; _Resolve_ covers the clash.
- The maintainer approved every recommendation of log 57 in advance; this PRD adds no decision the log doesn't hold.
