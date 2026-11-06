# Plan: Tidy into folders, each loose video its own folder

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/523

Today a Library folder holding bare `Title (Year).mp4` files side by side
scans to 0 titles and says nothing: the walk reads a root's top level as a
shelf, never as a film (log 30 Q15). This initiative gives each **Loose
video** the folder the walk expects. A **Tidy** makes the folder and renames
the video and its **Companion files** into it, inside the same root, all or
nothing, only on the maintainer's press. There are two doors onto one move: a
`loose` **Problem** in the Review step, whose _Tidy into_ also imports the
film, and the **Folder row**'s **Tidy dialog**, which only moves.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** No phase is
HITL.

- The phases are log 57's _Implementation Plan_ slices with two of them
  thinned: slice 2 is split into the scan listing loose films (phase 2) and
  the move that tidies one (phase 3); slice 5 into the dialog reading the
  plan (phase 6) and the dialog moving (phase 7).
- **The handoff is not built 1:1** (log 57 Q2).
  `docs/handoff/handoff-tidy-loose-videos/` is committed as the reference for
  copy and intent; the build draws from `mol.ProblemRow`'s _Import as_ slot,
  `mol.FolderRow`'s left-out line and `Modal`, as phase 1 amends them in
  `COMPONENT-SPEC.md`. Never build the handoff's dedicated page, Settings
  row, badge, rename or show editors.
- **Each phase stays well under a 100k-token context.** `COMPONENT-SPEC.md`,
  `FamilyFlix.dc.html`, `createImporter.ts` and `routes/index.ts` are large;
  a phase greps for the section it needs (`ProblemRow`, `FolderRow`,
  `import-guessed`, `PROBLEM_KINDS`, `splitCollections`) and reads only that
  range.
- No test runs Electron, FFmpeg or TMDB. Moves run over temporary
  directories the suite creates; scans run over the importer's fixture
  library copied into a temporary Library folder, with bare videos laid in
  its root.
- The glossary already holds log 57's terms. The feature checklist's step 40
  row stays 🔜 until the refactor.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: none. No migration. No stored path follows a move: a **Held
  video** and a **Left-out video** are never loose, so no `video_path`,
  `source_folder` or `left_out_videos` row names a moved file.
- **Routes**:
  - `GET /api/library-folders` carries `loose: number` on each folder, 0 for
    an Unreachable folder.
  - `GET /api/library-folders/:id/loose` answers `TidyPlan`.
  - `POST /api/library-folders/:id/tidy { ids }` answers `TidyResult`; `409`
    _A scan is running._ while a run is scanning or importing.
  - `POST /api/import/current/problems/:id/tidy` answers `ReviewOutcome`.
  - `POST /api/import/current/problems/tidy { ids }` answers the run
    snapshot, as `import-guessed` does.
- **Key models** (a new shared `tidy` types file):
  - `Tidy { id, kind: 'film' | 'show', folder, videos, companions }`; `id` is
    the first video's name, case folded, stable for one read.
  - `KeptLoose { files, reason }`, `TidyPlan { path, tidies, kept }`,
    `TidyResult { moved, failed: { id, folder, reason }[] }`.
  - `PROBLEM_KINDS` gains `loose` after `unplaced`, before the soft kinds;
    `ImportProblem` gains optional `tidy`, absent on a clash.
    `LibraryFolderView` gains `loose: number`.
- **Units**:
  - `readLooseVideos(root) => { loose: LooseFile[]; names: string[] }` in the
    media domain, `LooseFile { video, companions, tag }`: the root's top
    level only; videos by `isVideoFilename`; extras out by `isExtra`,
    exported from `splitCollections`; a companion is a non-video named by
    the stem plus `.` or `-`, case folded, the longest stem winning; `names`
    is every entry in the root.
  - `tidyPlan(path, read, kept) => TidyPlan`, pure, in the import-export
    domain. `kept` answers whether a video is held (`storage.titleHolding`)
    or left out. The **Tidy folder name** of a film is
    `titleWithYear(titleGuess(stem), yearInName(stem))` through
    `safeFilename`; a name already in `names`, case folded, is kept with the
    clash reason.
  - `tidyIntoFolder(root, tidy) => { ok: true } | { ok: false; reason }` in
    the media domain: exclusive `mkdir`, rename the videos, then each
    companion; on failure rename back in reverse and remove the folder it
    made. Renames only, never a copy.
  - The Importer owns every door: `tidy(problemId)`, `tidyMany(ids)`,
    `looseOf(folderId)`, `tidyFolder(folderId, ids)`. No route touches the
    filesystem.
- **Copy**:
  - Reason, film: _Lies loose at the top of <root>, with no folder of its
    own._ Show: _N episodes lie loose at the top of <root>, with no folder
    of their own._
  - Clash: _A folder called “<folder>” is already here._
  - Info line: `· N loose videos at the top of <root>, listed in review to
tidy`. Warning line: _⚠ N loose episodes at the top of <root> don't name
    their show, left where they are_.
  - Move log: `✓ Tidied <video> into <folder>\ (+N with it)`.
  - Failures: _It's open in another app._ (`EBUSY`/`EPERM`); _The folder
    can't be reached right now._ (root gone); the clash sentence (`EEXIST`);
    else _The disk refused the move._ A failed rollback appends _Some of its
    files are in “<folder>”._ A row redraws with _Couldn't move it: <why>.
    Nothing was moved._
  - Row: the destination in mono, _Moves with it:_ joined by `·`, **Tidy
    into “<folder>”** (`Button secondary sm`, Busy). Bulk: **Tidy all**.
    Kind pill: _Loose_.
  - Folder row: _N loose videos_ · **Tidy** (text button in _Bring back_'s
    look). Dialog: _Tidy into folders_, the path beneath, _Left where they
    are_, **Move N videos** / _Move 1 video_, _Cancel_, _Close_. Snackbar:
    _Moved N videos into folders of their own. Scan all folders to add
    them._

---

## Phase 1: The documents first

**User stories**: 65, 66 (the spec)

### What to build

Amend `COMPONENT-SPEC.md`'s `ProblemRow` row with the `loose` face in the
_Import as_ slot (destination, _Moves with it:_, _Tidy into_, absent on a
clash) and the _Tidy all_ bulk action on the _Loose_ filter. Amend the
`mol.FolderRow` row with the loose line and its **Tidy** text button, and
note the Tidy dialog as a `Modal`. Note in the handoff's README that log 57
supersedes it and it is not built 1:1. CLAUDE.md's writers rule gains _and a
**Tidy**, the one mover: only on the maintainer's press, only a Loose video
and its Companion files, into a folder it makes._ No code.

### Acceptance criteria

- [ ] `COMPONENT-SPEC.md` names the `loose` face, _Tidy all_, the Folder
      row's loose line and the Tidy dialog.
- [ ] The handoff folder carries a note naming log 57; its prototype files
      are unchanged.
- [ ] CLAUDE.md's boundary names the Tidy as the one mover and its limits.

---

## Phase 2: A scan lists loose films

**User stories**: 1 to 16, 21 to 24, 27, 28, 30, 31, 63

### What to build

The media domain reads a root's loose videos, and the import-export domain
plans each as a film tidy or keeps it with a reason. A Folder scan, of
either Scan scope, files one hard `loose` Problem per film tidy and per
clash after the folder's other Problems, and logs the per-folder info line.
A sheet run files none. The Review step draws the _Loose_ pill and each
`loose` row with its title, reason, destination and companions; no button
yet. Episodes are not planned yet: a tagged loose video is left out of the
plan in this phase. Demo: a Library folder of three bare
`Title (Year).mp4` files, one with an `.srt`, scans to three `loose` rows.

### Acceptance criteria

- [ ] `readLooseVideos` reads the top level only, leaves extras out, finds
      companions by stem plus `.`/`-` case folded, never takes a video as a
      companion, gives a shared companion to the longest stem, reads the
      Episode tag and lists every entry in `names`.
- [ ] `tidyPlan` names a film's folder from a release-noise stem through
      `safeFilename`, keeps a clash with a file or a folder (case folded)
      with its sentence, leaves held and left-out videos out, and offers two
      videos sharing one folder name both.
- [ ] A Folder scan files `loose` after the folder's other Problems, hard,
      with the film reason and `tidy` present (absent on a clash), and logs
      the info line; an Unreachable folder files none.
- [ ] A sheet run files no `loose` Problem; its rows stay `no-folder`.
- [ ] The Kind filter draws _Loose_; a `loose` row draws the destination in
      mono and _Moves with it:_ only when there are companions.

---

## Phase 3: Tidy into, one film

**User stories**: 25, 26, 32, 34 to 37, 40, 55 to 62, 64

### What to build

The media domain moves one tidy, all or nothing, with its failure reasons
and rollback. The Importer's `tidy(problemId)` moves the film, then imports
the new folder named off its folder under the run's Import mode, logs the
move line and the import's own, and answers `imported`; the Problem comes
off and the Sync after the run covers it. The single review route answers
the outcome. `ProblemRow` draws **Tidy into “<folder>”** as a Busy button,
no confirm, and no button on a clash. A failure answers `redrawn` with the
reason; its full redraw lands in phase 4. Demo: _Tidy into_ makes the
folder, moves the file and its `.srt`, and the film is in the library.

### Acceptance criteria

- [ ] `tidyIntoFolder` leaves the video and its companions in the new
      folder under their own names.
- [ ] An existing folder refuses with the clash sentence and moves nothing.
- [ ] A mid-move failure renames back what moved and leaves no folder; a
      failed rollback appends _Some of its files are in “<folder>”._
- [ ] Each error maps to its sentence (`EBUSY`/`EPERM`, root gone,
      `EEXIST`, other).
- [ ] `importer.tidy` imports under the run's Import mode (linked stays
      linked), logs the move line, answers `imported`, and the added Sync
      counts the film.
- [ ] `POST /api/import/current/problems/:id/tidy` answers the outcome.
- [ ] The row's _Tidy into_ is Busy while pressed and absent on a clash.

---

## Phase 4: Tidy all, failures and Resolve

**User stories**: 29, 38, 39, 41

### What to build

A failed move redraws the same row with _Couldn't move it: <why>. Nothing
was moved._ and keeps its Tidy button. **Tidy all** sits beside _Skip all_
on the _Loose_ filter, in _Import all as guessed_'s place, and posts every
`loose` row with a tidy to the bulk route; `tidyMany` goes in order and stops
at the first _can't be reached_. _Resolve_ on a loose film opens the Movie
form untidied: the Problem detail answers the root as the folder and the
video and its companions as Found files, so the add links it where it lies.
Demo: a file held open by a player redraws with _It's open in another
app._, and nothing moved.

### Acceptance criteria

- [ ] A failed tidy redraws the row with the failure sentence and the Tidy
      button kept.
- [ ] _Tidy all_ is drawn only on the _Loose_ filter, beside _Skip all_.
- [ ] `POST /api/import/current/problems/tidy { ids }` answers the run
      snapshot; the bulk stops at the first unreachable failure and leaves
      the rest listed.
- [ ] _Resolve_ on a loose film opens the Movie form with the root as its
      folder and the video and companions as its Found files.

---

## Phase 5: Loose shows

**User stories**: 17 to 20, 33, 42

### What to build

`tidyPlan` groups tagged loose videos by the **Title key** of the text before
the tag into one `show` tidy, named by `titleGuess` of that text through
`safeFilename`, episodes kept flat with no Season folder. Episodes with
nothing before the tag are kept, and the walk logs one Warning line per
folder. A loose show's row reads the show reason; _Tidy into_ imports it as
one series through `importShow`; _Resolve_ opens the Series Resolve over its
episodes, as `unplaced` does. Demo: `Breaking.Bad.S01E01.mkv` and `S01E02`
tidy into `Breaking Bad\` as one series of two episodes.

### Acceptance criteria

- [ ] A tagged video is never planned as a film.
- [ ] Tagged videos sharing a Title key make one show tidy; the folder is
      named from the text before the tag.
- [ ] Untitled episodes are kept, and the walk logs the Warning line once
      per folder.
- [ ] A loose show files one `loose` Problem with the show reason.
- [ ] Tidying it moves every episode and companion flat into the folder and
      imports one series.
- [ ] _Resolve_ on a loose show opens the Series Resolve over its episodes.

---

## Phase 6: The Folder row reads the plan

**User stories**: 6, 43 to 48

### What to build

The folder list carries `loose`, the count of the plan's tidied videos, 0
for an Unreachable folder. The Folder row draws _N loose videos_ and the
**Tidy** text button under the left-out line, only when `loose > 0`.
`looseOf` and `GET /api/library-folders/:id/loose` answer the plan. **Tidy**
opens the Tidy dialog: _Tidy into folders_, the path beneath, nothing drawn
until the plan lands, then one row per tidy and the _Left where they are_
list when any. Only _Close_ in the footer in this phase. Demo: _Tidy_ on a
folder of bare films lists each move and each clash.

### Acceptance criteria

- [ ] `GET /api/library-folders` answers `loose` on each folder, 0 when
      Unreachable.
- [ ] The Folder row draws _N loose videos_ · _Tidy_ with some, and no line
      with none.
- [ ] `GET /api/library-folders/:id/loose` answers the `TidyPlan`.
- [ ] The dialog draws nothing until the plan lands, then each tidy (file in
      mono, `→ <folder>\`, _Moves with it:_) and the kept list with reasons
      only when any.

---

## Phase 7: The Tidy dialog moves

**User stories**: 49 to 54

### What to build

`tidyFolder` and `POST /api/library-folders/:id/tidy { ids }` move only the
tidies named, against a fresh plan, and answer `TidyResult`; both refuse with
`409` _A scan is running._ while a run scans or imports. The dialog's footer
draws **Move N videos** / _Move 1 video_ (`primary`, Busy) and _Cancel_, or
only _Close_ with nothing to move. The press posts the ids drawn. All moved
closes on the snackbar; a partial failure stays, listing each failure under
the count moved; a `409` shows its sentence. The folder's scanned mark is
left alone, and the folder list refreshes its count. Demo: _Move 3 videos_
moves them, and _Scan all folders_ finds three films.

### Acceptance criteria

- [ ] The route moves only the ids posted; a video dropped in since the plan
      was read is not moved.
- [ ] A scan or import in progress answers `409` _A scan is running._ and
      moves nothing.
- [ ] The button reads _Move N videos_, _Move 1 video_ for one, and only
      _Close_ is drawn with nothing to move.
- [ ] All moved closes the dialog on the snackbar.
- [ ] A partial failure keeps the dialog open with the count moved and each
      failure's reason.
- [ ] `scanned_at` is unchanged after a tidy.

---

## Phase 8: The documents

**User stories**: 66

### What to build

The feature checklist's step 40 row is rewritten to what was built (two
doors onto one move, no Settings row or dedicated page); it stays 🔜 until
the refactor. Every unit touched carries a docblock naming its glossary
terms. The glossary is checked against the built names and amended where
the build moved off them.

### Acceptance criteria

- [ ] Step 40's row in `docs/feature-checklist.md` describes the review row
      and the Folder row's Tidy dialog, and is still 🔜.
- [ ] `readLooseVideos`, `tidyPlan`, `tidyIntoFolder`, `TidyDialog` and
      `useTidy` carry docblocks naming **Loose video**, **Companion file**,
      **Tidy**, **Tidy folder name** and **Tidy plan** as they use them.
- [ ] `docs/ubiquitous-language.md` matches the built names.
