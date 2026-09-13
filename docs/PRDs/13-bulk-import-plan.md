# Plan: Bulk import — the sheet, the scan, the run and the review

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/123

This is the initiative that finally fills the library. Every feature so far —
the browse grid, the carousel, search, the detail page, the player, Add, Edit,
Delete — assumes a full shelf, and today the only thing that fills one is the
dev seed. It is also the first time the server is **pointed at a path**: every
file the app has ever written arrived as bytes in a multipart part, and the
one thing a browser's file picker can never supply is what makes a
thousand-folder migration possible at all. That is why folder-path autofill
was refused on the form and sent here, and it is why the resolve route is the
only path-accepting surface in the app.

The slicing follows what the PRD's own phasing sketches, opened out from six
slices to seven: **the spec** (Phase 1) → **the thinnest path from a typed
sheet to movies on the home** (Phase 2) → **what the run says** (Phase 3) →
**what the run could not settle** (Phase 4) → **fixing a flagged row through
the Add job** (Phase 5) → **and through the Edit job** (Phase 6) → **the edges**
(Phase 7).

Every phase from 2 onward is checked by looking: open Settings, press ⇪ Import
from spreadsheet, type the fixture's two paths, press Start import, and see
the movies on the browse home. From Phase 2 that sentence is true, and each
later phase makes more of the run visible, recoverable or resolvable.

## Four things moved earlier than the PRD's sketch

The PRD's sixth slice, "the entry and the edges", holds four things this plan
pulls into the tracer bullet. Each for a stated reason:

- **The entry rides with the tracer bullet.** A `/import` reachable only by
  typing the URL is not "checkable by looking". `LibrarySection`'s two rows are
  two links, and the one that lands on `/add` is a screen that already exists.

- **The route's refusals are final from Phase 2.** `POST /api/import` answers
  `400 { error, field }` and `409` from the first commit that writes it, and
  the setup step draws the one refusal line the prototype amendment adds. The
  rule is the delete plan's: a wire contract scheduled for demolition — a
  client call written to swallow a `400` in Phase 2 and rewritten to surface
  it in Phase 7 — is a test suite written twice.

- **The already-in-library skip is in the tracer bullet.** Phase 2 ships
  Cancel, and cancel-then-restart is only harmless because an imported row is
  skipped. Without it, every re-run of the fixture during Phases 3–6 would
  double the dev library — the very thing the seed's idempotence protected.

- **The backdrop is scanned from the start.** The scanner is built once, and
  `backdropPath` is a column that already exists. Adding the image later would
  touch the scanner, the copy sequence and the problem detail — three places —
  for a field the scanner already has to look past to find the poster.

## Three shapes settled early so their tests survive

- **The snapshot's shape is final from Phase 2.** `ImportRun` carries `log`
  and `problems` from its first commit; Phase 3 is the first to write a line
  and Phase 4 the first to file a problem. The client call, the hook and the
  page read one shape throughout, and the arrays are simply empty until their
  phases.

- **Problems are one phase, end to end.** The PRD's third slice records
  problems "during the run" and its fourth draws them. Here Phase 4 owns the
  whole concept — the matcher's verdicts, the run recording them, the review
  screen drawing them, Skip dismissing them — so that a kind is never data
  nothing renders. Between Phases 2 and 4 a row the matcher cannot settle is
  neither imported nor shown: an intermediate state of the Maintainer's
  surface, named rather than hidden.

- **Resolve is split along the form's two jobs.** The hard kinds add a movie
  through the resolve route (Phase 5); the soft kind amends one through the
  PATCH the Edit job already sends (Phase 6). Between Phases 4 and 5, Resolve
  lands on the plain Add form — which is story 94's fallback, arriving early.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** Six, under the existing `/api` router, injected as the fifth
  argument beside `playback` and `media` — the router never learns there is a
  spreadsheet:

  ```
  POST   /api/import                               { sheetPath, rootPath }
                                                   -> 201 ImportRun
                                                   -> 400 { error, field: 'sheet' | 'root' }
                                                   -> 409 { error }   (a run already exists)
  GET    /api/import/current                        -> 200 ImportRun · 404
  POST   /api/import/current/cancel                 -> 204
  GET    /api/import/current/problems/:id           -> 200 ImportProblemDetail · 404
  POST   /api/import/current/problems/:id/resolve   multipart, the form's own encoding
                                                   -> 201 Movie · 400 (a path outside the root)
  DELETE /api/import/current/problems/:id           -> 204 · 404
  ```

  `/current` rather than `/:runId` because there is exactly one run, in
  memory, at a time. The resolve route parses its body with the same reader
  the movie routes use; a **Found file** arrives as the path field the edit
  route already carries for a **Stored file**, and is copied only if it lies
  under the current run's root. `POST /api/movies` keeps accepting bytes only.

- **Schema.** No change. `backdrop_path`, `watched`, `rating` and `tmdb_id`
  already exist on the row; the importer writes through
  `LibraryStorage.addMovie` exactly as the form's route does.

- **Key models.** New shared types in `src/types/`, re-exported from its
  barrel, read by both build targets: `ImportPhase`
  (`scanning | importing | review`), `LogKind`
  (`info | scan | path | success | warning | error`), `LogLine`,
  `ProblemKind` (`no-folder | ambiguous | no-video | no-row | failed |
missing-meta`), `ImportProblem` (`id`, `kind`, `title`, `reason`, optional
  `movieId` for the soft kind), `ImportRun` (`id`, `phase`, `startedAt`,
  `found`, `total`, `done`, `matched`, `currentItem`, `log`, `problems`) and
  `ImportProblemDetail` (the problem plus `row`, `folder`, `candidates` and
  `files`). Elapsed, percent and the ETA are **not** on the snapshot; they are
  derived client-side by a pure view, as the prototype's container computes
  them. `MovieFormFile` gains a third kind, `found` — an absolute path under
  the run's root, shown by filename, travelling as the path.

- **The domain — `server/src/import-export/`, five units.** A pure sheet
  reader (`.xlsx` / `.csv` by extension, via `exceljs`, the synonym table); a
  pure title key; a pure matcher (rows × folder scans → matched, problems,
  unclaimed); the run's state machine (scanning → importing → review); and the
  injected importer exposing `start`, `current`, `cancel`, `problem`,
  `resolve`, `dismiss`. Scanning lives in `media/` — a root walker, a
  folder scanner and a subtitle-language detector — and `Media` gains
  `copyIn(folder, sourcePath)` on the OS copy path, answering the **Stored
  path**. The video-extension list lives in the scanner, not in
  `uploadKinds`: the form's slot must accept anything so `cannot-play` can be a
  state; a scanner deciding which folder is a film is a different rule.

- **The run.** One at a time, in memory; a second start is `409`. Scanning
  runs to completion before any copy starts. Per match: reserve a **Movie
  folder** → copy in the video, the poster, the backdrop and each subtitle →
  derive the runtime → add the movie; a throw removes the folder and files
  `failed`. The library's titles are loaded once at start for the
  already-in-library skip. Cancel aborts the in-flight copy, rolls that one
  folder back, keeps every added movie, discards the run. The app restarting
  loses the run and never a movie.

- **Copy, never move.** The originals under the **Library root** are never
  written to, moved or deleted. One storage model; a bad run costs time.

- **Transport is polling.** `GET /api/import/current` every 500 ms while the
  phase is scanning or importing; nothing while in review. One endpoint serves
  the live case, the leave-and-return case and the reload case. The log is
  capped at 80 lines so a snapshot stays small. The ETA appears after 20 done.

- **The synonym table.** Title (`title | name | movie | film`), year, genres
  (`genre | genres`, split on `,` `/` `;`), and optionally director, cast
  (`cast | actors`), synopsis (`description | synopsis`), rating (0–10 as the
  column stores), watched (`yes / true / 1 / ✓`). Case-insensitive on the
  header; first worksheet; first row is the header; only title is required.
  Genres the **Genre pool** does not know are dropped from the row. Adding a
  synonym is one line.

- **Problems are data.** Six kinds, each a reason string and a dot colour
  (`danger` for `no-folder` / `no-video` / `failed`, `accent` for
  `ambiguous`, `text-faint` for `no-row` / `missing-meta`). Hard kinds are
  rows not yet in the library; the soft kind is imported and carries a
  `movieId`. The simulation's `missing-file` is not a kind: a missing
  subtitle or poster is a **Warning line** in the log.

- **Where things live.** `components/LogConsole`; under
  `features/import-export/`: the organism, the three steps, the three
  molecules (stepper, stat tile, problem row), the run hook, the pure view and
  the feature's own `api/` (one caller each, so they stay); under
  `features/settings/`: the Library section and its action row;
  `pages/ImportPage` composing `MaintainerLayout` at the 760 measure.
  `TextField` gains `mono` and the `sheet` / `folder` glyphs the prototype's
  enum already lists. No new `test-support/` unit: `sandboxRoot`,
  `freshStorage`, `newMovie`, `fakeResponse`, `LocationProbe` and `makeMovie`
  cover what is needed; the importer's fixture sheet and folder tree live
  under its own test folder.

- **Navigation.** Back on `/import` → `/settings`. Finish → `/`. In the import
  context, Back, Skip this one and a finished save all land on `/import`.

- **The seed goes in Phase 2**, as CLAUDE.md has promised since library-core:
  the folder, its test, the `db:seed` script. The importer's fixtures fill a
  dev library from then on.

- **Copy, fixed by the prototype.** Headlines `Scanning your library…` /
  `Importing movies…`; stat lines `Found N movies so far` /
  `N of M imported`; `Elapsed m:ss` and `· About m:ss left`; tiles
  `matched confidently and imported` / `need your attention`;
  `Needs attention`; `✓ All done` / `Every flagged movie has been handled.`;
  `Finish — go to library`; `Cancel import`; `Start import`; placeholders
  `C:\Movies\library.xlsx` / `C:\Movies`; the banner
  `Resolving import · {title}`; `Save & continue` / `Skip this one`; the log
  lines and the six reason strings as the stories quote them.

- **Not built, anywhere in these phases.** TMDB or any network; a move; a
  native folder dialog; a chooser for ambiguous folders; SSE; a persisted run;
  a snackbar; reviewing confident matches before commit; un-importing from
  review; the Export row; the rest of the Settings shell; a rating-scale
  converter.

---

## Phase 1: Amend the prototype and the three documents

**User stories**: none directly — this phase produces the spec that Phases 2–7
translate. It is the precondition CLAUDE.md sets: "amend the prototype first,
then build to the amended prototype."

### What to build

One `docs:` commit against `docs/handoff/`, `README.md` and
`.claude/CLAUDE.md`, nothing in `src/`. Every change composed from vocabulary
the prototype already has:

- `feat.ImportFlow`: the setup refusal line — a 13px line in the `danger`
  colour under the offending field, the problem row's reason geometry
  recoloured — the only invented UI in the initiative; and Resolve / Skip on
  a problem row as `prim.Button` `secondary` `sm`, since COMPONENT-SPEC §1
  forbids one-off inline controls.
- The container's `seedProblems` carries the six kinds with their reason
  strings and drops `missing-file`.
- COMPONENT-SPEC gains the `ImportFlow` row's model (`ImportRun`, the problem
  kinds) and a `LibrarySection` row.
- README and CLAUDE.md amended on three points: confident matches commit
  during the run and review lists only what the run could not settle; TMDB is
  not part of bulk import; the seed is removed by this initiative.

### Acceptance criteria

- [ ] `feat.ImportFlow` draws a 13px `danger` line under a refused setup
      field, and nothing else about the setup step changes
- [ ] Each problem row's Resolve and Skip are `prim.Button` `secondary` `sm`
- [ ] `seedProblems` lists the six kinds with the reason strings the PRD fixes,
      and `missing-file` is gone
- [ ] COMPONENT-SPEC lists `LibrarySection` with its target and props, and the
      `ImportFlow` row names its model
- [ ] README and CLAUDE.md no longer say a review step precedes every commit,
      no longer say TMDB seeds ratings at bulk import, and say the seed goes
      with bulk import
- [ ] The commit touches only `docs/`, `README.md` and `.claude/CLAUDE.md`

---

## Phase 2: The tracer bullet — a sheet and a folder become movies on the home

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
18, 19, 20, 22, 24, 25, 26, 27, 28, 29, 30, 32, 34, 35, 36, 41, 42, 43, 44, 45,
50, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 75, 76, 91, 101, 105,
106, 107

### What to build

The thinnest complete path. Settings gains its **Library section** with two
action rows — `＋ Add a movie` to `/add`, `⇪ Import from spreadsheet` to
`/import` — and no third. `/import` is the Maintainer surface at the 760
measure with a Back pill to `/settings`, holding the import flow.

**Setup** is two mono, square-cornered, 50-high `TextField`s with the sheet and
folder glyphs and the prototype's placeholders, and `Start import`, disabled
until both are non-empty. Start posts the two paths; a sheet that does not
exist, cannot be read, is neither `.xlsx` nor `.csv` or has no recognisable
title column is refused under the Spreadsheet field, a root that does not
exist or is not a directory under the Movies root field, each as the 13px
danger line, cleared when that field is edited, with both values kept. A
start while a run already exists is `409`, and the screen shows the run that
is already there.

**The run**, on the server: read the sheet through the synonym table (title,
year, genres split on the three separators, and the optional columns; a blank
title skipped; a non-year as no year; unknown genres dropped; a rating on the
column's scale; a watched cell marking the movie watched); walk the root — a
folder holding a video is a **Source folder** and is not descended, one
holding none is descended — and scan each for its one video by extension, its
poster by name, its backdrop by name, and every subtitle with its language
read from the filename tag onto the form's seven names, `English` when nothing
says; match each row to exactly one key-equal folder whose year agrees when
both carry one; skip a row whose key and year are already in the library,
loaded once at start; then, scanning complete, import each match by the
form's own sequence — reserve the folder, copy in each file on the OS copy
path, derive the runtime, add the movie with `tmdbId` null — and reach review.
A row the matcher cannot settle is, in this phase, neither imported nor shown.

**Running** is the headline, the stat line with thousands separators, the bar
(indeterminate while scanning, `done / total` while importing) and `Cancel
import` in `danger`, refreshed by polling `current` every 500 ms and stopping
in review. The hook asks for `current` on mount, so leaving and returning,
reloading, or arriving with a run in progress all show the running step, and
a `404` shows setup. Cancel aborts the in-flight copy, rolls that folder back,
keeps every added movie, discards the run and returns to setup with the fields
as typed.

**Review**, in this phase, is the `✓ All done` card and `Finish — go to
library`, which lands on `/`, where the imported films are on the shelves.
Reached automatically when the last match is imported.

The dev seed, its test and its `db:seed` script are deleted in this phase; the
importer's fixture — a tiny sheet and folder tree under its tests — is what
fills a dev library now. No family screen gains an import control.

### Acceptance criteria

- [ ] Settings shows a Library section with exactly two rows; Add a movie
      lands on `/add` and Import from spreadsheet on `/import`
- [ ] `/import` draws on `MaintainerLayout` at 760 with Back landing on
      `/settings`
- [ ] The two fields are mono, square-cornered, 50 high, with the sheet and
      folder glyphs and the fixed placeholders; `TextField` accepts `mono` and
      the two glyphs, and a caller that asks for neither is unchanged
- [ ] Start import is disabled until both fields are non-empty
- [ ] `POST /api/import` answers `400 { error, field: 'sheet' }` for a missing,
      unreadable, wrong-extension or title-less sheet and
      `400 { error, field: 'root' }` for a missing or non-directory root,
      before any run exists; `409` while a run exists; `201` with the snapshot
      otherwise
- [ ] The refusal is drawn under the field it names, clears when that field is
      edited, and both values are kept
- [ ] A `409` on start leaves the screen showing the run already in progress
- [ ] The sheet reader reads an `.xlsx` and a `.csv` with the same rows
      identically; finds columns case-insensitively through every synonym;
      imports a Title/Year/Genre-only sheet fully; splits genres on each
      separator; skips a blank title; treats a non-year as no year; ignores
      unrecognised columns; reads rating and watched
- [ ] A genre the pool does not know is dropped from the row and the row
      still imports
- [ ] The title key normalises case, diacritics, dots, underscores, each
      trailing tail form, punctuation and spacing, so `Die.Hard.1988.1080p`
      matches "Die Hard"
- [ ] The walker finds a folder holding a video and does not descend it,
      descends one holding none, and recognises video by the fixed extension
      list; the scanner takes the named poster over the first image, finds the
      backdrop, and lists subtitles with languages, `English` when undetectable
- [ ] The matcher answers matched for exactly one key-equal folder and not for
      a year disagreement
- [ ] A row already in the library, by key and year, is skipped; a second run
      of the same sheet adds nothing; the titles are loaded once
- [ ] `copyIn` copies bytes into the movie folder, answers the stored path,
      leaves the source untouched, and refuses a source that does not exist
- [ ] Against a sandbox root and a fresh storage, a two-film sheet and tree
      become two movies with poster, backdrop, subtitles and a derived runtime,
      and nothing under the root is changed
- [ ] The scan runs to completion before the first copy starts
- [ ] `GET /api/import/current` answers `200` with the snapshot during and
      after a run, and `404` when there is none or after cancel;
      `POST …/cancel` answers `204`
- [ ] The client calls send the right method to the right route, resolve on
      their success status, reject on `500` and on a request that cannot be
      made; `startImport` surfaces the `400`'s field
- [ ] The hook polls at 500 ms while scanning or importing and stops in review;
      re-attaches to a current run on mount; shows setup on `404`
- [ ] The running step shows the headline, the stat line with thousands
      separators and the bar's state per snapshot phase
- [ ] Cancel aborts the in-flight copy and rolls that folder back, keeps every
      movie already added, and returns to setup with the fields kept
- [ ] Leaving `/import` mid-run and returning, or reloading, shows the running
      step
- [ ] Review is reached automatically and shows `✓ All done` and Finish, which
      lands on `/`
- [ ] `POST /api/movies` accepts no path field
- [ ] No import control on the browse home, a card, the detail page or the
      player
- [ ] `server/src/db/seed/`, its test and the `db:seed` script are gone; the
      fixture sheet and tree exist under the importer's tests

---

## Phase 3: The console

**User stories**: 21, 23, 33, 47, 48, 52, 56, 57, 58, 59, 60

### What to build

What the run says, and the chrome that says it. The run writes its **Activity
log**: `Connecting to {root} …` to open; `Scanning {folder}` per folder;
`✓ Found N movies across M folders. Starting import…` when the scan ends;
`✓ Imported {Title}` per match; `– Already in library {Title} ({Year})` for a
skipped row; a line for a blank-title row; one line per unknown genre name; a
warning for a folder the scanner cannot read, which is skipped; `⚠ {Title} —
no subtitle track found` and a warning for a missing poster, neither of which
blocks; and `✓ Import complete — N imported, P need attention.` at the end.
The log is capped at 80 lines on the server, so the snapshot stays small.

The running step gains the `Connect ✓ → Scan → Import` stepper with the active
step in accent and the finished step ticked, the current folder or title in
mono under the bar, `Elapsed m:ss`, and `· About m:ss left` once more than 20
items are done — the last three derived client-side by the pure view from
`startedAt`, `done` and `total`. `LogConsole` is the molecule: mono lines
coloured by kind, pinned to the bottom as lines arrive.

### Acceptance criteria

- [ ] The log opens with the connecting line, carries one scanning line per
      folder, the found line, one imported line per match, and the complete
      line with both counts
- [ ] A skipped already-in-library row, a blank-title row and each unknown
      genre name each produce their line, the genre once per name
- [ ] An unreadable folder produces a warning and the run continues
- [ ] A match with no subtitle, and one with no poster, imports and logs its
      warning
- [ ] The log never exceeds 80 lines and keeps the newest
- [ ] The stepper marks done, active and pending per phase
- [ ] The current item shows the folder while scanning and the title while
      importing
- [ ] The view answers headline and stat line per phase, percent, elapsed,
      thousands separators, and an ETA only after 20 done
- [ ] `LogConsole` colours each kind and is pinned to the bottom when a line
      arrives

---

## Phase 4: Problems and review

**User stories**: 31, 37, 38, 39, 40, 46, 49, 70, 71, 72, 73, 74, 75, 77, 78,
98, 102 (Skip)

### What to build

What the run could not settle, recorded and reviewed. The matcher's other
verdicts become **Problems** on the snapshot: two or more key-equal folders are
`ambiguous` with "Two folders look like plausible matches — pick one."; no
exact folder but one or more whose key starts with the row's is `ambiguous`
with "One folder looks like a match, but the name isn't exact."; no folder is
`no-folder`; a folder no row claimed is `no-row`; a folder holding no video or
more than one is `no-video` with its own two reasons. Every match-time problem
exists by the time the bar turns determinate. During import, a copy that
fails partway — a locked or vanishing file — rolls the reserved folder back,
files `failed` with "Couldn't copy the video file: {reason}.", and the run
continues with the next match. A match whose row has no genre imports and is
then listed as the soft `missing-meta`, carrying its `movieId`.

**Review** becomes the prototype's: two stat tiles over a **Needs attention**
list, each row a dot coloured by kind, the title, the reason, and Resolve and
Skip as small secondary Buttons. Skip sends `DELETE …/problems/:id`, removes
the row and updates the tiles; a problem already gone answers `404` and the
row disappears just the same. `✓ All done` appears once the list is empty;
Finish is available while problems remain; an empty root reaches review with
zeros in both tiles and the card. Resolve links to `/add?problem=<id>`, which
in this phase is the plain Add form.

### Acceptance criteria

- [ ] The matcher answers, in table tests: two exact → `ambiguous` with the
      first reason; prefix only → `ambiguous` with the second; none →
      `no-folder`; unclaimed → `no-row`; and the candidates in order
- [ ] A folder with zero videos, and one with two, files `no-video` with the
      matching reason
- [ ] A copy that throws leaves no folder behind, files `failed` with the
      reason, and the next match still imports
- [ ] A genre-less row imports and files `missing-meta` with its `movieId`
- [ ] The complete log line counts the problems
- [ ] `DELETE /api/import/current/problems/:id` answers `204`, then `404` for
      the same id; `dismiss` answers false for a missing problem
- [ ] The tiles show the matched count and the problem count, and update on
      Skip
- [ ] Each row shows the dot in the kind's colour, the title and the reason,
      and Resolve and Skip as `secondary` `sm` Buttons
- [ ] Skip removes the row without importing anything; a `404` removes it too
- [ ] `✓ All done — Every flagged movie has been handled.` shows only when the
      list is empty; Finish is enabled either way
- [ ] A run over an empty root reaches review with zeros and the card
- [ ] A title with quotes, diacritics or a very long name sits in a row without
      breaking the list

---

## Phase 5: Resolve — the hard kinds

**User stories**: 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 94, 95, 102
(Resolve)

### What to build

A flagged row fixed on the screen the maintainer already knows.
`GET …/problems/:id` answers the **problem detail**: the row's fields, the
matched folder, the candidates, and the folder's files — or `404`.

`MovieFormFile` gains the `found` kind — an absolute path under the run's
root — which the file field shows by filename exactly as it shows a stored
file, which the multipart encoding sends as the path (a picked file still as
bytes), and which Remove and replace treat as any other slot. The form hook
reads `?problem=` and enters the **Import context**: it fetches the detail and
prefills title, year, genres, director, cast, synopsis and rating from the row
and the slots from the folder as found files. Per kind: a matched folder fills
the slots; `ambiguous` fills from the first candidate and the banner names the
rest ("Harbor Lights — also matched: Harbor.Lights.2019"); `no-folder` opens
with the row's fields and every slot empty; `no-row` opens with the folder's
files and the title guessed from the folder name. The accent banner reads
`Resolving import · {title}`; the save reads `Save & continue`, the cancel
`Skip this one`; the gate is still title and video.

Save & continue posts to the resolve route — found paths as text, picked
files as bytes — which copies a found path only if it lies under the current
run's root and answers `400` otherwise, then imports by the form's sequence,
answers `201` with the movie, dismisses the problem, and the screen lands on
`/import` one row shorter. Skip this one dismisses and lands on `/import`;
Back lands on `/import`. A problem that no longer exists — dismissed, or the
run gone — falls back to the plain Add context.

### Acceptance criteria

- [ ] `GET …/problems/:id` answers the detail with row, folder, candidates and
      files, and `404` for an unknown or dismissed id
- [ ] The encoding sends a found file as its path in the field the edit route
      already reads, and a picked file as bytes
- [ ] The file field shows a found file by filename, and Remove empties it
- [ ] `/add?problem=<id>` shows the banner with the title, prefills every
      field the row carries and every slot the folder has as found files
- [ ] An `ambiguous` problem prefills the first candidate and the banner names
      the others; `no-folder` opens with empty slots; `no-row` opens with the
      folder's files and the guessed title
- [ ] The save reads Save & continue and the cancel Skip this one; the gate is
      unchanged
- [ ] The resolve route with a found path under the root answers `201` and the
      file is in the managed directory; with a path outside the root, `400`
      and nothing copied
- [ ] Save & continue lands on `/import` with the problem gone from the list
- [ ] Skip this one dismisses and lands on `/import`; Back lands on `/import`
- [ ] Resolve on a problem already gone answers `404` and the screen falls
      back to the plain Add context
- [ ] `/add?problem=<id>` with no run falls back to the plain Add context

---

## Phase 6: Resolve — the soft kind

**User stories**: 92, 93

### What to build

The one kind already in the library, amended rather than added twice. A
`missing-meta` row's Resolve opens `/add?movie=<id>&problem=<pid>`: the Edit
job — the record read back into the fields — under the import banner, with
Save & continue and Skip this one. Save sends the ordinary `PATCH`, then
dismisses the problem, then lands on `/import`; Skip this one dismisses and
lands on `/import`. Nothing about the Edit job's own save changes.

### Acceptance criteria

- [ ] `/add?movie=<id>&problem=<pid>` prefills from the movie, shows the
      banner, and the labels read Save & continue / Skip this one
- [ ] Save sends `PATCH /api/movies/:id`, then `DELETE …/problems/:pid`, then
      lands on `/import` with the row gone
- [ ] Skip this one dismisses and lands on `/import`
- [ ] A soft problem whose id is gone falls back to the plain Edit context
- [ ] `/add?movie=<id>` without `problem` is unchanged

---

## Phase 7: Failure and the edges

**User stories**: 96, 97, 99, 100, 103, 104

### What to build

What a twelve-terabyte, twelve-hour run meets that a two-film fixture does
not. A poll that fails — the server gone for a moment — keeps the last
snapshot on screen and keeps trying, so a blip never blanks the console. A
title with quotes, diacritics or a very long name matches, imports, and sits
in a problem row and in the banner without breaking anything. Two films with
the same title and year get the suffix the form's folder reservation already
gives, never an overwrite. A source folder whose name holds characters unsafe
in a **Movie folder** still imports, with the managed folder named by the
app's own rule. A subtitle whose language tag is unknown lands as English. The
importer restarting mid-run has no run and every movie already added.

### Acceptance criteria

- [ ] A failed poll leaves the last snapshot on screen and the next tick still
      fires
- [ ] A row and folder with quotes, diacritics and a 200-character title
      match and import; the same title sits in a problem row and in the banner
- [ ] Two matches with the same title and year land in two folders
- [ ] A source folder named with characters `safeFilename` would reject
      imports into a folder named by the app's rule
- [ ] An unknown language tag lands as English
- [ ] A fresh importer over a storage that already holds the movies of an
      interrupted run answers `404` for `current` and every movie is still
      there
- [ ] The feature ticks 🔜 → ✅ in README and CLAUDE.md only after its refactor
      pass, per the project rule
