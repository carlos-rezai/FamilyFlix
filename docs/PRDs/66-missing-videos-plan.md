# Plan: Missing videos, a scan that says what it did not find

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/633

Every run that reads the household's **Library folders** ends with the
**Missing check**: a held film whose video is gone, or a show with gone
episode videos, is listed once in the review under a new _Missing_ kind, and
can be taken out from its row or skipped. A Title folder the walk could not
read (empty, or loose videos beside Season folders) is listed under a new
hard _Off layout_ kind, Skip only. Nothing leaves the library or the disk on
its own. The spec is design log 66 and the amended
`docs/handoff/mol.ProblemRow.dc.html`; no other screen changes.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** Phase 6's walk in the shell is done by the agent itself on the dev
library, unattended, and is backed by an end-to-end importer test so the
acceptance never waits on a hand. No decision is left open: the maintainer
approved every recommendation of log 66 in advance, and the PRD's three added
details (the press-time re-check, **Gone is gone** for a take-out, the
_is_/_are_ agreement) are settled.

- The phases are log 66's _Implementation Plan_ slices, thinned: slice 3
  into the episode check (phase 3) and the episode take-out (phase 4).
- **Each phase starts from its own RED test**, except phase 6's documents
  (proved by its checklist and a green suite).
- **Phases 1 and 3 may land without their take-out**: a listed title with
  only _Skip_ is safe, since Skip keeps everything. All six land before the
  next `npm version`.
- **Every existing import, review, walk and route test stays green after
  every phase.** The walk's warning lines are unchanged by phase 5.
- The glossary, checklist and prototype were done in the grill-me; the
  feature checklist's step 49 row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: no migration.
- **Routes**: one new,
  `POST /api/import/current/problems/:id/take-out`. `204` once taken out;
  `404` with the Skip's `noSuchProblem` sentence for a Problem not held or
  not `missing`; `500` with _Could not take that title out_ if the write
  throws. The route only calls the importer; it never learns what a
  take-out deletes. _Off layout_ needs no route beyond the existing Dismiss
  (`DELETE /api/import/current/problems/:id`).
- **Key models**:
  - `PROBLEM_KINDS` gains `off-layout` (hard, placed with the hard kinds)
    and `missing` (soft, last). Labels _Off layout_ and _Missing_; dots
    `textFaint` and `danger`.
  - `ImportProblem` gains an optional `takeOut: string`, the button's words
    (_Take out of library_, _Take out N episodes_, _Take out 1 episode_),
    so the client never counts episodes. A `missing` Problem carries
    `movieId` or `seriesId`.
  - The media domain's `LayoutWalk` gains `offLayout: OffLayoutFolder[]`,
    each `{ dir, name, reason: LeftOutReason }`, beside its `warnings`.
  - `Importer.takeOutMissing(id): boolean`, on `apply`'s precedent:
    `false` for an id not held or not `missing`.
  - A new library write, `removeEpisodes(seriesId, episodeIds)`, deletes
    the rows (tracks by cascade) and answers the paths no row points at any
    more; the importer unlinks each through `media.removeFile`.
- **The rules**:
  - The check runs at the run's completion step, after the imports and
    before the completion line, over the held titles whose recorded Library
    folder is one the run read. A cancelled run never reaches it.
  - Each video is asked of `playback.videoFile`. Only a `missing` answer
    marks it missing; `unreachable` and a found file never do. A copied
    title plays from managed storage and is never missing.
  - One `missing` Problem per title, one Warning line each spelled by
    `spellFolderKey`: `⚠ <key> is missing its video` or
    `⚠ <key> is missing N episode videos`.
  - A take-out never records a **Left-out video**, so a put-back file is
    imported by the next scan; it touches nothing outside the **Managed
    media directory**. A title already gone answers `true` and only settles
    the row (**Gone is gone**).
  - No _Resolve_ on `missing` or `off-layout`; no _Take out all_.

---

## Phase 1: A gone film is listed

**User stories**: 1, 4, 7, 8, 16, 17, 19, 20, 21, 24 to 28, 30, 31 (film), 45

### What to build

The Missing check over films at the importer's completion step, the `missing`
kind on the shared list with its label and dot, the film's reason (_Its
video, die-hard.mkv, is no longer on disk._) and warning line, both counted
in the _need your attention_ tile and the completion line. The review draws
the row with _Skip_ only and no _Resolve_; _Skip all_ on the kind keeps every
one. Demo: delete `Die Hard (1988)/`'s video from the dev Library folder;
_Scan all folders_ lists _Die Hard_ under _Missing_.

### Acceptance criteria

- [ ] A deleted linked film is listed once with its reason and warning line,
      and counted in `Scan complete: N imported, M need attention`.
- [ ] A film moved to another folder, or renamed in its own, is Found again
      and not listed.
- [ ] A film of an unreachable folder is not listed.
- [ ] _Scan new folders_ never lists a title of a folder it did not walk; a
      sheet run over the folders lists too.
- [ ] A copied film whose original left its folder is not listed.
- [ ] A cancelled run lists nothing missing.
- [ ] A skipped missing film stays held and is listed again by the next
      scan; a file put back before any press makes the next scan list nothing.
- [ ] `importView` labels _Missing_; `ProblemRow` draws no _Resolve_ on a
      `missing` row; the row groups with the title's other Problems.

---

## Phase 2: Take out a film

**User stories**: 9, 12 (film), 13 to 15, 18, 22, 23, 29, 41 to 43

### What to build

`takeOutMissing` for a film: its rows go, then its Media folder best-effort,
as the movie Delete does, without `leaveOut`. The `take-out` route, the
feature wire's `takeOutMissing` (resolves on `204`, `null` on `404`), the Run
hook's `takeOut(id)` (row off on success, as `apply`), `ImportReview`'s
`onTakeOut(id)` and the row's one `secondary` `sm` button drawn from
`problem.takeOut`. No confirm dialog, no snackbar. Demo: press _Take out of
library_; Die Hard leaves the grid; put the video back and the next scan
imports it.

### Acceptance criteria

- [ ] A taken-out film is gone from the library (grid, Continue row,
      Favorites, Manage library); its linked video's folder is untouched;
      its managed art and subtitles are removed best-effort.
- [ ] No Left-out video is recorded; a put-back file is imported by the
      next scan.
- [ ] `takeOutMissing` answers `false` for an unknown or non-`missing` id,
      and `true` with the row settled for a title already deleted elsewhere.
- [ ] The route answers `204` and the Problem is gone; `404` with
      `noSuchProblem` for an unknown or non-missing id; `500` with _Could not
      take that title out_ when the write throws.
- [ ] `ProblemRow` draws _Take out of library_ and reports `onTakeOut`;
      `ImportReview` passes `onTakeOut(id)`; `useImportRun.takeOut` takes
      the row off on success and does nothing on `404`.
- [ ] A browser session draws and settles the row the same way.

---

## Phase 3: Gone episodes are listed

**User stories**: 2, 3, 5, 6, 31 (show)

### What to build

The Missing check over each held show's episodes, folded into one `missing`
Problem per show. The reason names the first three gone episodes' tags in
season-and-episode order, then _and N more_, then _is_ or _are no longer on
disk._; a show with every episode gone reads _None of its N episodes' videos
are on disk._ The warning line reads `⚠ <key> is missing N episode videos`.
The row offers _Skip_ only until phase 4. Demo: delete one of
`Tidewater (2018)/Season 01/`'s videos; _Scan all folders_ lists Tidewater
once under _Missing_.

### Acceptance criteria

- [ ] A show with one gone episode reads _S01E02 is no longer on disk._
- [ ] A show with three gone reads _S01E02, S01E03 and S02E01 are no longer
      on disk._ (log 66 Q7); with five, _S01E02, S01E03, S02E01 and 2 more
      are no longer on disk._; tags in season-and-episode order.
- [ ] A show with every episode gone reads _None of its N episodes' videos
      are on disk._
- [ ] One row and one warning line per show, however many episodes are gone.
- [ ] An unreachable show and a copied episode are never listed; a renamed
      episode is listed (no Found again for episodes).

---

## Phase 4: Take out a show or its gone episodes

**User stories**: 10, 11, 12 (show), 44

### What to build

`takeOutMissing` for a show. With every episode gone it takes the show out as
the series Delete does, without `leaveOut`. Otherwise the episodes the check
found, recorded beside the Problem in the importer's source map, are
re-checked at press time and the still-gone ones go through
`removeEpisodes`, its freed paths unlinked through `media.removeFile`. The
Problem's `takeOut` reads _Take out of library_, _Take out N episodes_ or
_Take out 1 episode_. Demo: press _Take out 1 episode_ on Tidewater; the show
stays with the rest.

### Acceptance criteria

- [ ] `removeEpisodes` deletes the rows and their tracks and answers only
      paths no remaining row points at.
- [ ] A show with some episodes gone keeps the others, its art and its
      watch history; a fully gone show leaves the library.
- [ ] An episode whose file came back before the press is kept.
- [ ] No Left-out video is recorded; a put-back episode is imported by the
      next scan.
- [ ] `ProblemRow` draws all three wordings from `problem.takeOut`.

---

## Phase 5: Off-layout folders

**User stories**: 32 to 40

### What to build

The media domain's walk answers `offLayout` beside its unchanged warnings.
The importer files one hard `off-layout` Problem per entry, titled by the
folder's name, reason _Holds no video or Season folder._ (`empty`) or _Holds
loose videos and Season folders._ (`mixed`). `importView` labels it _Off
layout_ and groups it with the hard kinds, first in the review; the row
offers _Skip_ only. Demo: an empty `Heat/` is listed under _Off layout_.

### Acceptance criteria

- [ ] `walkLibraryFolder`: an empty and a mixed folder each answer one
      `offLayout` entry with its reason; the warning lines are unchanged.
- [ ] One `off-layout` Problem per entry, with its name and reason, counted
      in the tile and the completion line, listed again by every scan.
- [ ] A fixed folder (a video put in, loose videos sorted) is imported by
      the next scan like any new folder.
- [ ] Loose root videos and Doubled places stay log warnings only.
- [ ] `ProblemRow` draws no _Resolve_ on `off-layout`; `importView` groups
      it as hard.

---

## Phase 6: The walk and the documents

**User stories**: all, proved end to end

### What to build

Log 66's walk, done by the agent without a hand. First an end-to-end
importer test over a temp copy of the dev Library folder: Die Hard's video
deleted is listed, taken out, put back and imported; one Tidewater episode
deleted is listed and taken out alone; an empty `Heat/` is listed under _Off
layout_. Then the agent runs the shell on the dev library (the `run` skill)
and walks the same steps through the review. Any gap the walk finds is fixed
in its phase's unit and its test first. Then the docblocks of every unit
above say what they now do, the feature checklist's step 49 row is written
to the build and stays 🔜, and the dev journal gains this step's entry.

### Acceptance criteria

- [ ] The end-to-end test passes all three stories above.
- [ ] In the shell, on the dev library, the review lists _Die Hard_ and
      _Tidewater_ under _Missing_ and `Heat` under _Off layout_; each press
      settles its row.
- [ ] The docblocks of `walkLibraryFolder`, `PROBLEM_KINDS`,
      `ImportProblem`, `ProblemRow`, `ImportReview`, `removeEpisodes`,
      `takeOutMissing` and the importer's completion step describe their
      current behaviour.
- [ ] Step 49's row in `docs/feature-checklist.md` describes the build and
      stays 🔜; `docs/dev-journal.md` has a step 49 entry;
      `docs/ubiquitous-language.md` matches the build.
- [ ] CLAUDE.md is unchanged; no em dash in any prose.
- [ ] The full suite is green.
