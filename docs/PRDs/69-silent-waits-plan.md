# Plan: Silent waits, every press that waits says so

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/652

Every press that waits on the server outside step 36's forms and dialogs
locks at once and, past 300ms, says it is working, in a face the
loading-states handoff already draws: a **Busy row** for a press on a row or
a card, a **Busy button** for a bulk or start press, a **Form skeleton**
while the movie form reads a record, and _Reading folder…_ for the **Show
folder pick**. The spec is design log 69; no prototype is amended.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** Phase 9's walk is done by the agent itself in the dev app with each
write held open, as the audit of 2026-11-19 was made. No decision is left
open: log 69 settled them all.

- The phases are log 69's _Implementation Plan_ slices, thinned: slice 2
  into the Sync review's row presses (phase 2) and its bulk and start
  buttons (phase 3); slice 3 likewise (phases 4 and 5); slice 5 into the
  Form skeleton (phase 7) and the Show folder pick (phase 8).
- **Each phase starts from its own RED test** (`tdd`), except phase 9's
  documents (proved by the walk and a green suite).
- **Phase 1 lays the shared pieces** every later phase uses; phases 2 to 8
  each stand alone after it, and any may land without the next. All nine
  land before the next `npm version`.
- **Every existing test stays green after every phase**, `useDelayedBusy`'s
  suite above all, unchanged.
- The glossary's **Silent waits** section and the checklist's step 51 row
  were written in the grill-me; the row stays 🔜 until the refactor.
  CLAUDE.md is untouched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Schema**: no migration.
- **Routes**: none new, no wire change. Every press calls the route it calls
  today.
- **Prototype**: none amended; no new `prim.*` or `mol.*`. The Busy row is
  the loading-states handoff's _Inside a row_ (table row 5).
- **The Loader timing, stated once**: `useDelayedBusy`'s `run` body moves to
  an exported `onLoaderTiming(work, setPhase)` beside it. `SHOW_AFTER_MS`
  (300) and `MIN_SHOWN_MS` (500) stay where they are. `BusyPhase` is
  `idle` → `waiting` → `shown` → `idle`, as log 53 named it.
- **Key models**:
  - `useDelayedBusyByKey`, a shared hook in `src/hooks/`: `phaseOf(key)`,
    `idle` for any key not running, and `run(key, work)`, which times `work`
    per key and passes its result or its error through after the hold.
  - Each owning hook answers `rowPhase(id): BusyPhase`: `useEnrichmentRun`,
    `useImportRun`, `useLibraryFolders`. `useEnrichmentRun` also answers
    `seasonPhase(season)`. Row methods keep their signatures and still
    reject on a refusal.
  - Bulk and start presses each sit on their own `useDelayedBusy` in the
    run hook: `skippingAll` (both run hooks), `importingAll`
    (`useImportRun`), `starting` (both run hooks). `useFolderScan.scanning`
    becomes a `BusyPhase` beside `scope`.
  - `useMovieForm.loading: boolean`, true while the job names a record and
    its read has not answered; `useShowFolderPick.reading: BusyPhase`,
    passed on by `useMovieForm` as `readingShowFolder`.
- **The rules**:
  - The timing wraps the request inside the hook that owns it; the row is
    settled (dropped, redrawn, counted) after the promise, so every outcome
    follows the hold. A row never wraps its own press.
  - From `waiting` a busy row's root is `inert` and `aria-busy`; every
    control keeps its own face (log 53 Q9). Once `shown`, a shared css
    helper dims the row to .75 with a progress cursor, and an 18px `inline`
    `LogoLoader` with the press's label replaces its status slot. Which
    press it was is the row's own state; the phase is the hook's.
  - While a bulk phase is past `idle`, the review hands every row it covers
    `waiting`: locked, no loader. One loader for one wait.
  - A refused press settles to `idle`, its row or button as it was; every
    existing refusal sentence stays.
  - The Form skeleton is a read, not an action: drawn at once, no Loader
    timing.

---

## Phase 1: One row, end to end

**User stories**: 1 to 5, 12, 42, 44, 45

### What to build

The shared pieces and the first row through them. `onLoaderTiming` takes
`useDelayedBusy`'s rule whole; `useDelayedBusyByKey` times many keys at once
on it. The busy-row css helper gives a shown row its .75 dim and progress
cursor. `useEnrichmentRun` runs a Decision row's poster pick through the
keyed hook and answers `rowPhase(id)`; the Sync review passes each row its
phase; the Decision row goes `inert` and `aria-busy` from `waiting` and,
once `shown`, draws the inline mark with _Saving match…_ in place of its
kind dot. Demo: on the Sync review, with the pick route held open, a second
press sends nothing, the row reads _Saving match…_ past 300ms, and it leaves
with _Match saved._ only after the hold.

### Acceptance criteria

- [ ] `useDelayedBusy`'s existing suite is green, unchanged, after the
      extraction.
- [ ] `useDelayedBusyByKey`: two keys run independently; an unknown key is
      `idle`; a key done under 300ms never shows; a shown key holds 500ms;
      an error passes through after the hold.
- [ ] `useEnrichmentRun`: a pick's `rowPhase` is `waiting` at once and
      `shown` at 300ms; the row stays on the run until the hold ends; a
      refusal returns it to `idle` with the run unchanged.
- [ ] Decision row: `inert` and `aria-busy` from `waiting`, every control
      in its own face; once `shown`, the 18px inline mark and _Saving
      match…_ stand in the kind dot's slot.
- [ ] Flow: a second press on a waiting row sends no second request; the
      other rows stay pressable.
- [ ] The new loader fades rather than moves under reduced motion.

---

## Phase 2: The Sync review's other row presses

**User stories**: 6 to 12

### What to build

The Decision row's remaining presses through `rowPhase`: _Apply choices_
(_Updating details…_), _Skip_ and _Keep all mine_ (_Skipping…_), and
_Search_ (_Searching TMDB…_), the snackbar as today and the row redrawn
with its new candidates after the hold. A Season choice's poster runs
through `seasonPhase(season)` and draws _Saving poster…_ in its held-poster
caption. Demo: each press, held open, locks its own row or season and says
its words; the others stay pressable.

### Acceptance criteria

- [ ] `useEnrichmentRun`: _Apply choices_, _Skip_, _Keep all mine_ and
      _Search_ each answer `waiting`, then `shown`, on their row, and settle
      after the hold; a refusal returns `idle`.
- [ ] _Search_'s snackbar appears as today; the new candidates are drawn
      only after the hold.
- [ ] `seasonPhase` locks one season; the other seasons and rows stay
      pressable.
- [ ] Decision row and Season choices draw each press's own label once
      `shown`.

---

## Phase 3: The Sync review's bulk and start buttons

**User stories**: 13 to 18

### What to build

`useEnrichmentRun` answers `skippingAll` and `starting`. _Skip all_ is a
Busy button reading _Skipping…_, and while it runs every row it covers is
handed `waiting`. _Start sync_ reads _Starting…_ and _Fetch details_ reads
_Fetching…_ until the first snapshot lands; a start on arrival from a
title's Edit menu shows the same button. A refused start puts the button
back, with the busy notice where it applies today. Demo: _Skip all_ held
open draws one loader over twenty locked rows.

### Acceptance criteria

- [ ] `skippingAll` and `starting` go `waiting`, `shown`, `idle` across a
      held request; a refusal returns `idle`.
- [ ] Every row _Skip all_ covers is `inert` and draws no loader of its
      own.
- [ ] _Start sync_ and _Fetch details_ lock at once and read their words
      past 300ms; the arrival start does the same.
- [ ] A refused start leaves the button pressable, its notice as today.

---

## Phase 4: The Import review's row presses

**User stories**: 19 to 22

### What to build

`useImportRun` runs each Problem row press through the keyed hook and
answers `rowPhase(id)`: _Import as “…”_ and a picked candidate folder
(_Importing…_), _Take out of library_ (_Taking out…_), _Apply choices_
(_Updating details…_), and _Skip_ and _Keep all mine_ (_Skipping…_). The
Problem row draws the Busy row in its kind dot's slot. _Resolve_ stays a
plain link. Demo: an _Import as_ held open locks its row and imports once.

### Acceptance criteria

- [ ] `useImportRun`: each press answers `waiting`, then `shown`, on its
      row; the row settles after the hold; a refusal returns `idle` with
      the run unchanged.
- [ ] Problem row: `inert` and `aria-busy` from `waiting`; each press's
      label once `shown`.
- [ ] A second press on a waiting row sends nothing.
- [ ] _Resolve_ opens the form as today.

---

## Phase 5: The Import review's bulk and start buttons

**User stories**: 23 to 26

### What to build

`useImportRun` answers `importingAll`, `skippingAll` and `starting`.
_Import all as guessed_ (_Importing…_) and _Skip all_ (_Skipping…_) are
Busy buttons, each handing every row it covers `waiting`. _Start import_
locks at once, reads _Starting…_ past 300ms, and stays disabled while its
form is unfilled; the leaving to `/import` follows the hold, and a refusal
shows under its field as today. Demo: _Import all as guessed_ held open
imports each title once.

### Acceptance criteria

- [ ] `importingAll`, `skippingAll` and `starting` go `waiting`, `shown`,
      `idle` across a held request.
- [ ] Every covered row is locked and draws no loader of its own.
- [ ] _Start import_ is disabled while unfilled, reads _Starting…_ when
      slow, and a refusal puts it back with its sentence.
- [ ] The leaving to `/import` waits out the hold.

---

## Phase 6: Library folders

**User stories**: 27 to 32

### What to build

`useLibraryFolders` runs a folder's ✕ and _Bring back_ through the keyed
hook and answers `rowPhase(id)`; the Folder row draws _Removing…_ or
_Bringing back…_ in place of its _N titles_ line. `useFolderScan.scanning`
becomes a `BusyPhase` on `useDelayedBusy` beside `scope`: the pressed scan
button reads _Scanning…_ and the other is disabled; the move to the
progress screen on a `201`, or to the running run on a `409`, follows the
hold. Demo: _Scan all folders_ held open reads _Scanning…_, then opens the
progress screen.

### Acceptance criteria

- [ ] ✕ and _Bring back_ lock their row at once and draw their words past
      300ms; a refused remove puts the row back with its sentence.
- [ ] Only the pressed scan button reads _Scanning…_; the other is
      disabled.
- [ ] The navigation on a `201` and on a `409` waits out the hold.
- [ ] Other folder rows stay pressable while one works.

---

## Phase 7: The Form skeleton

**User stories**: 33 to 38, 43

### What to build

`useMovieForm` answers `loading` while the job names a record and its read
has not answered. A new `LoadingForm` unit in the movie form, on the
`LoadingDetail` / `LoadingSeries` pattern, draws the form's own frame in
Skeleton blocks (heading, fields, files card) with no save button, as one
`role="status"` named _Loading movie_ or _Loading series_ by the job's
kind, its insides hidden. The form appears whole when the record lands.
Demo: an edit with its read held open shows the skeleton, never _Add a
movie_.

### Acceptance criteria

- [ ] An edit, a series edit and a Resolve draw `LoadingForm` at once and
      no save button until the record lands.
- [ ] Nothing can be typed into before the record lands.
- [ ] A plain add never draws it; a gone record falls back to the add.
- [ ] `LoadingForm` is announced once, by its kind.

---

## Phase 8: The Show folder pick's read

**User stories**: 39 to 41

### What to build

`useShowFolderPick` answers `reading`, wrapping the folder read and the
held series' title read on `useDelayedBusy`, never the dialog.
`useMovieForm` passes it on as `readingShowFolder`; the dashed _＋ Add show
folder_ row locks while it runs and, once `shown`, draws the 18px inline
mark with _Reading folder…_. A refused read puts the control back with its
sentence. Tested with a faked Path bridge. Demo: in the shell, a large show
picked reads _Reading folder…_ until its episode rows appear.

### Acceptance criteria

- [ ] `reading` is `idle` while the dialog is open, then `waiting` and
      `shown` across a held read.
- [ ] _＋ Add show folder_ is locked while reading and draws _Reading
      folder…_ once shown.
- [ ] A refused read returns it to idle with its refusal sentence.

---

## Phase 9: The walk and the documents

**User stories**: all, proved end to end

### What to build

Each spot of the audit walked by the agent in the dev app with its write
held open, as the audit was made: the Sync review's rows, seasons and
buttons; the Import review's rows and buttons; Library folders; an edit, a
series edit and a Resolve; the Show folder pick in the shell. Any gap the
walk finds is fixed in its phase's unit and its test first. Then the
docblocks of every changed unit say what they now do, the feature
checklist's step 51 row is written to the build and stays 🔜, and the dev
journal gains this step's entry.

### Acceptance criteria

- [ ] Every press the PRD lists locks at once, says its words past 300ms,
      and settles after the hold; none sends twice.
- [ ] The docblocks of `onLoaderTiming`, `useDelayedBusy`,
      `useDelayedBusyByKey`, `useEnrichmentRun`, `useImportRun`,
      `useLibraryFolders`, `useFolderScan`, `useShowFolderPick`,
      `useMovieForm` and `LoadingForm` describe their current behaviour.
- [ ] Step 51's row in `docs/feature-checklist.md` describes the build and
      stays 🔜; `docs/dev-journal.md` has a step 51 entry;
      `docs/ubiquitous-language.md` matches the build.
- [ ] CLAUDE.md is unchanged; no em dash in any prose.
- [ ] The full suite is green.
