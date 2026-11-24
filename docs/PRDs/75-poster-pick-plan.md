# Plan: Poster pick, a synced title's art always lands

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/707

A title added linked with no art has no **Media folder**, so a Sync stored
none of its images and a **Season choice** answered `404`, which the page
swallowed. The **Late reserve** gives such a title its Media folder the
first time an image has arrived for it. The **Poster refusal** tells the
household when a pressed season poster was refused. The spec is design
log 75 and `docs/handoff/handoff-poster-pick/README.md` until phase 3
amends the prototype.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order. There is no HITL
phase.** The agent walks phase 5 itself in the shell. It stands in for the
PRD's cut network with a refusing disk: once the review is open, an
`icacls` deny-write on the series' Media folder makes the store fail, and
removing the deny brings it back. Both refusals draw the same line (stories
21 and 28), so this walks the same path. Log 75 settled every decision, so
none is left open.

- The phases follow log 75's _Implementation Plan_ slices. Slice 3 is split
  as in log 74's plan: the prototype amendment is phase 3, the line in the
  app is phase 4, and the walk and documents are phase 5.
- **Phases 1, 2 and 4 each start from their own RED test** (`tdd`). Phase 3
  is the prototype and the spec, proved by reading them against the handoff.
  Phase 5's documents are proved by the walk and a green suite.
- **Every existing test stays green after every phase.** The one exception
  is `createEnrichment.seasonChoices.test.ts`, where phase 1 drops the
  `not-found` case for a folder-less series on purpose.
- The glossary's terms were written in the grill-me. The checklist's step
  57 row stays 🔜 until the refactor. CLAUDE.md and the README are not
  touched.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none new and none changed. A Season choice's `404` keeps its
  copy and now means only that no single-series run holds that season.
- **Schema**: no migration. `media_folder` on `movies` and `series` (from
  migration 11) is the column the Late reserve records.
- **Dependencies**: none new.
- **On disk**:
  - A Late reserve's folder is a Media folder like any other: reserved by
    the title's name and year through `Media.reserveFolder`, in the
    **Managed media directory**. It is never inside a Library folder.
  - A title's videos stay where they lie.
  - A folder is made only once an image has arrived. With Poster off, or
    with every TMDB image failing, nothing is made.
- **Key models**:
  - `LibraryStorage.recordMediaFolder(kind, id, folder)` sits beside
    `mediaFolderOf`, for `'movie' | 'series'`. It records over a gone
    folder.
  - `lateReserve({ storage, media }, kind, { id, title, year })` returns
    `() => string`. It is lazy and memoised. It answers the recorded folder
    when `media.openFolder` opens it; otherwise it reserves, records and
    answers the new name. It reserves at most once and throws whatever
    `reserveFolder` throws. It lives in enrichment, which composes storage
    and media.
  - `storeImage` takes `folder: () => string` and calls it inside its
    `try`, after the image has arrived and while the run is not aborted.
    One getter is made per title pass and shared by everything that pass
    stores.
  - `useEnrichmentRun` answers `seasonRefused(season): boolean` beside
    `seasonPhase`. It is set when that season's `saveSeasonPoster` rejects,
    cleared when that season is sent again, and drawn only once the
    season's **Busy phase** is `idle`.
- **The rules**:
  - A reserve whose store then fails leaves the folder recorded and empty.
    The next Sync reuses it.
  - No change to the adds, to what a Sync fetches or offers, or to the
    wire's error shapes.
  - No snackbar and no confirm. One sentence covers every kind of refusal.

---

## Phase 1: A linked show's art lands

**User stories**: 1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
19, 20, 30, 31, 32

### What to build

The Late reserve, end to end for a series. The library domain learns to
record a Media folder. Enrichment gains the lazy getter and threads one
getter per show through its series poster, backdrop, Season posters and
episode Stills. The guard that skipped Stills and the Frame still for a
folder-less show goes. A Season choice makes its own getter, so a press on
such a show lands, and `not-found` means only that no run holds the season.
Demo: a show added by the **Show folder pick** with no art, synced alone,
lands its poster, backdrop, Season posters and Stills in one new recorded
folder, and pressing a season's poster replaces the held tile.

### Acceptance criteria

- [ ] `recordMediaFolder` records for a film and for a series, and
      `mediaFolderOf` reads it back.
- [ ] `lateReserve` answers a recorded folder that opens without
      reserving. With none recorded, or one that is gone, it reserves by
      title and year and records the new folder. Asked three times, it
      reserves once. Never asked, it reserves nothing.
- [ ] A series with no Media folder, synced, has its poster, backdrop,
      Season posters and Stills (the Frame still included) in one new
      folder, which is recorded on the series.
- [ ] A series that already has a working Media folder keeps using it, and
      no new folder is made.
- [ ] With Poster off, a Sync of such a series makes no folder.
- [ ] A Season choice on a folder-less series answers `chosen`, and the
      held tile's url follows it. `not-found` stays only for no run.
- [ ] A refused reserve reads as an image not stored, and the Sync goes on.
- [ ] Nothing is written into a Library folder, and the videos' paths are
      unchanged.

---

## Phase 2: A linked film's art lands

**User stories**: 7, 8, 13 (a film)

### What to build

The same getter for a film's pass. The film's poster and backdrop share one
Late reserve, so a linked film added with no art, through the Movie form or
**Add and sync**, gets its art on its first Sync. Demo: a linked film added
through the Movie form with _Add and sync_ lands its poster and backdrop in
one new recorded folder.

### Acceptance criteria

- [ ] A film with no Media folder, synced, has its poster and backdrop in
      one new folder, which is recorded on the film.
- [ ] A film with a working Media folder keeps using it.
- [ ] With Poster off, a Sync of such a film makes no folder.
- [ ] The film's video path is unchanged.

---

## Phase 3: The spec amended

**User stories**: none directly; it is the spec phase 4 builds to

### What to build

The prototype and its spec brought up to the handoff README.
`feat.EnrichmentFlow.dc.html` draws a refused state on one season card in
the review's Seasons section: the line under the picker and no choice
pressed. `COMPONENT-SPEC.md`'s **Seasons** paragraph describes the Poster
refusal. After this phase the prototype rules, and the handoff README is
history. Demo: the prototype, opened in a browser, draws one season card
refused beside an untouched one.

### Acceptance criteria

- [ ] The line reads exactly _That poster wasn’t saved. Try again._
- [ ] It sits inside the card, under the picker, 10px above, in 13px sans,
      `--color-danger`, line-height 1.5, with `role="status"`.
- [ ] None of that card's choices reads pressed, and its held caption is
      unchanged.
- [ ] Everything else in the section is unchanged: the heading, the held
      tile, the rule, the choices, the _Series poster_ pill, the Busy
      overlay. There is no snackbar.
- [ ] `COMPONENT-SPEC.md`'s Seasons paragraph names the Poster refusal and
      when it goes.

---

## Phase 4: A refused pick says so

**User stories**: 21, 22, 23, 24, 25, 26, 27, 28, 29

### What to build

The Poster refusal in the app, a 1:1 translation of the amended prototype.
The run hook remembers which seasons' choices were refused and still
rejects to its caller. The review and the Flow pass `seasonRefused` down
the same way they pass `seasonPhase`. The Flow's catch stays, and its
comment says the card shows the refusal. `SeasonChoices` draws the line and
removes the pressed mark while it is shown. Demo: with a refused choice
stubbed, the card draws the line once _Saving poster…_ has gone, and the
next press clears it.

### Acceptance criteria

- [ ] A refused choice answers `seasonRefused(n) === true` once its phase
      is `idle`, and not while it is busy.
- [ ] The next press on that season clears it. Another season is untouched.
- [ ] `SeasonChoices` with `seasonRefused` draws the line under the picker
      with `role="status"`, and no choice reads pressed. Without it, there
      is no line.
- [ ] The held caption still tells what the tile holds.
- [ ] No snackbar, confirm or new control is added.

---

## Phase 5: Walk it live, then the documents

**User stories**: all, checked live

### What to build

The acceptance walk in the shell (`npm run electron:dev`), done by the
agent, followed by the documents. The walk:

1. A show added by the Show folder pick with no art, synced alone: its
   poster, backdrop, Season posters and Stills land in one new recorded
   folder in the managed directory. Pressing a season's poster replaces
   the held tile.
2. A linked film added through the Movie form with _Add and sync_: its
   poster and backdrop land.
3. With the review open, an `icacls` deny-write on the series' Media folder:
   a press draws the Poster refusal and no choice reads pressed. With the
   deny removed, a press lands and the line goes.

Then the documents: the docblocks of `storeImage`, `writeSeries`,
`writeShow`, `chooseSeasonPoster` (in the `Enrichment` interface too),
`SeasonChoices` and `useEnrichmentRun`, and the checklist's step 57 entry.

### Acceptance criteria

- [ ] Each of the walk's three checks passes in the shell, and the deny is
      removed afterwards.
- [ ] Every changed unit's docblock describes its new face. CLAUDE.md, the
      README and the older handoff READMEs are untouched.
- [ ] The checklist's step 57 entry describes the initiative and stays 🔜.
- [ ] The full suite and the typecheck (`--force`) are green.
