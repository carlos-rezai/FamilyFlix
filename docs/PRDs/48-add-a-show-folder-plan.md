# Plan: Add a show folder — a whole show in one pick, linked by default

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/416

The series add takes its episodes one browser pick at a time and copies every
byte. The movie add always copies too, and neither add records where its files
came from, so a later **Scan folders** can import the same title twice. This
initiative adds the **Show folder pick** (_＋ Add show folder_), read by the
**Folder scan**'s own rules, and the **Import mode** choice on both adds, Link
by default in the desktop app. Every found video under a listed **Library
folder** records its **Source folder**, so the scan and the form agree.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** None needs a
person in the loop:

- There is no separate prototype phase. `feat.MovieForm.dc.html` already lives
  in `docs/handoff/`, so amending it needs no Claude Design round. Instead,
  **each phase first amends the prototype for the surface it draws** (log 48
  Q19), then builds to the amended prototype. `COMPONENT-SPEC.md` is amended
  in phase 2, where `ImportModeChoice` and `ChoiceCard` graduate.
- No test runs Electron. The **Folder bridge** is faked at `folderBridge()`,
  the wire at `fetch` with `fakeResponse`, and folder trees are temp folders.
- The **Package smoke**'s lines for `pathOf` and a linked add from the real
  folder dialog are added to `docs/release-checklist.md` in phase 3 and checked
  by hand at the next release, not as a phase's acceptance.
- The docs (CLAUDE.md's _Movie form_ bullet, README's step 31, the glossary,
  per log 48 Q20) are not a phase: they are ticked ✅ only after the refactor.

The phases are log 48's _Implementation Plan_ slices 2–5, reordered so a show
folder is **copied before it is linked**. Phase 1 is then complete without an
Import mode choice whose Copy card would not yet work, and `mode` arrives
with the choice that sets it.

## Architectural decisions

Durable decisions that apply across all phases:

- **Server routes**:
  - `GET /api/show-folder?path=` → `200 ShowFolderRead`, or `400` with one
    sentence: _That folder can’t be read._ / _There are no videos in that
    folder._ A held folder is a `200` with `heldSeriesId` set, and the form
    draws the refusal.
  - `GET /api/library-folders/containing?path=` → `200 { libraryFolderId:
string | null }`.
  - `POST /api/series` and `POST /api/movies` keep their paths. They gain a
    required `mode` (`'link' | 'copy'`), travelling first, refused in one
    sentence when missing or unknown (`importBody`'s precedent). A browser
    sends `copy`.
  - A found path must be absolute and of the video (or subtitle) kinds of the
    file-kind list, else `400`. A Link path under no listed folder is `400`
    _Link needs a file inside one of your library folders._ The form never
    sends one.
- **Schema**: no migration. `library_folder_id`, `source_folder` and the
  Source file already exist.
- **Key models** (shared types, both build targets):
  - `ShowFolderRead`: `path` (absolute), `titleGuess`, `libraryFolderId |
null`, `heldSeriesId | null`, `episodes` (`season`, `number`, `title |
null`, `video`, `subtitles: { path, language }[]`), `unplaced` (absolute
    paths in scan order) and `straySubtitles` (a count).
  - `FolderBridge` gains `pathOf(file: File): string`, the **Path bridge**,
    over `webUtils.getPathForFile`, `''` for a file with none.
  - A folder row is a `found` **Found file**, tagged as the folder's, so a
    second pick and the ✕ touch only the folder's rows. The form's file slot
    kinds are unchanged.
- **What travels on Save**:

  | Kind / file                 | Link                                    | Copy                                           |
  | --------------------------- | --------------------------------------- | ---------------------------------------------- |
  | Movie video, picked         | its path, as `videoPath`                | its bytes, as today                            |
  | Episode video, folder row   | its path, as the episode's `videoPath`  | its path; the server copies it into the season |
  | Episode video, picked row   | its bytes (a picked row is always Copy) | its bytes                                      |
  | Found subtitle (folder row) | its path; the server copies it          | the same                                       |
  | Poster, still, season art   | bytes, as today                         | the same                                       |

- **One reader, one placement rule**:
  - `readShowFolder` walks the folder with `walkLibraryFolder` and groups it
    with `groupShows`. The importer exposes it as a member, so no route
    learns there is a walk. There is no second numbering rule.
  - `placeFoundVideo(folders, path, mode)` answers a Linked video relative to
    its listed Library folder (the deepest one) in Link, else `null`, and the
    caller copies on `null`. The importer, the Resolve and both add routes
    call it: one rule for a **Placed video**.
  - The Source folder rule is the importer's existing `setSourceFolder`.
- **A failed or refused add** removes FamilyFlix's reserved managed folder and
  never touches a linked file (log 41 Q15).
- **Unchanged throughout**: art and subtitles are always copied; the edit
  jobs and a Resolve draw no choice and keep their rules (log 41 Q12); Link is
  chosen on every visit, never remembered; no progress bar (_Adding…_ only).

---

## Phase 1: A show folder, copied

**User stories**: 1–8, 10–14, 20–22, 25–27, 30–32, 44, 46, 47, 49 (the copy
side), 50

### What to build

First, the prototype: amend `feat.MovieForm.dc.html`'s series add for
_＋ Add show folder_ before _＋ Add episode files_, the Show folder row
(_Show folder_, the path in mono, a ✕) and the unreadable and empty refusals.

On the server, `readShowFolder` over one absolute folder: Season folders read
season by season (a Season folder's number winning over the filename's),
loose tagged episodes, stem-matched subtitles in their detected languages, the
Title guess by the importer's rule, and the `unreadable` and `empty` refusal
kinds. `createImporter` gains it as a member, and `GET /api/show-folder` is
thin over it. `POST /api/series` accepts a found `videoPath` and found
subtitle paths per episode, validated as above, and copies each into its
season with `Media.copyIn`.

On the client:

- _＋ Add show folder_, drawn only when `folderBridge()` is not `null`, opens
  `pickOne()`. A cancel changes nothing.
- The read fills the Show folder row and one Episode file row per episode, in
  season then episode order, with its Subtitle rows. An empty title takes the
  Title guess, and a typed one is kept.
- A refusal is drawn under the form's buttons as a Refusal, and adds no rows.
- The ✕ takes the folder's rows off the form. Rows from _＋ Add episode
  files_ stay through it, and that button still works beside the folder.
- Save shows _Adding…_ while the server copies.

Demo: pick a show with Season folders in the shell, save, and every episode
plays from FamilyFlix's own Series folder.

### Acceptance criteria

- [ ] The prototype is amended for the button, the Show folder row and the
      two refusals.
- [ ] `readShowFolder` answers Season folders numbered by folder, loose tagged
      episodes, stem-matched subtitles with their languages, the Title guess,
      and `unreadable` / `empty`.
- [ ] `GET /api/show-folder` answers `200` with the read and `400` with each
      sentence.
- [ ] `POST /api/series` copies found rows into their seasons and their
      subtitles beside them, and still takes picked rows' bytes, mixed in one
      save.
- [ ] A relative or wrong-kind found path is `400`.
- [ ] A failed save removes the reserved Series folder and leaves the picked
      folder's files untouched.
- [ ] _＋ Add show folder_ is drawn only with the bridge, before _＋ Add
      episode files_, and a cancelled dialog changes nothing.
- [ ] A pick fills the row, the episodes in order and their subtitles. The
      title fills only when empty.
- [ ] An unreadable or empty folder draws its Refusal and adds no rows.
- [ ] The ✕ removes only the folder's rows.

---

## Phase 2: A show folder, linked

**User stories**: 33–40 (the series add), 43, 45, 48, 49 (the linked side),
51, 54, 55

### What to build

First, the prototype: amend `feat.MovieForm.dc.html`'s series add for the
Import mode choice under the Files card, before the TMDB check, and the
disabled Link card with _Only for files inside one of your library folders._
Amend `COMPONENT-SPEC.md` to list `ImportModeChoice` and `ChoiceCard` as
molecules, with `ChoiceCard`'s `disabled`.

On the server, `placeFoundVideo` is extracted from the importer's private
`linkedVideo` + `listedFolderOf`, and the importer calls it with its behaviour
unchanged. `POST /api/series` reads the required `mode`. Each found video is
placed through `placeFoundVideo`, and a `null` is copied as in phase 1. Found
subtitles are always copied. A show from a folder under a listed Library
folder records it as its Show folder, in both modes.

On the client:

- `ImportModeChoice` and `ChoiceCard` move to `src/components/`. Import setup,
  the Library folders page and the Export dialog import them from there.
  `ChoiceCard` gains `disabled`, and `ImportModeChoice` can disable Link with
  its line.
- The series add draws the choice in the shell only, never on a series edit
  or a Resolve. Link is chosen on every visit.
- The read's `libraryFolderId` decides availability. With `null`, Link is
  disabled with its line and Copy is chosen. A later pick under a Library
  folder re-enables it.
- The wire sends `mode` first. A browser sends `copy`. Picked rows stay bytes
  in either mode.

Demo: pick a show under a Library folder, save in Link, and it plays with
nothing copied. A Scan folders afterwards reads it as **Already in library**.

### Acceptance criteria

- [ ] The prototype and `COMPONENT-SPEC.md` are amended.
- [ ] `placeFoundVideo`: Link under a listed folder answers a Linked video
      relative to it; Link outside every folder and Copy answer `null`; the
      deepest of nested listed folders is chosen.
- [ ] The importer's linked-video suites pass unchanged.
- [ ] `POST /api/series` in Link copies no found video, and its episodes play
      from where they lie. In Copy it copies them as in phase 1.
- [ ] A missing or unknown `mode`, and a Link path under no listed folder, are
      `400`.
- [ ] The Show folder is recorded in Link and in Copy, and nothing is recorded
      for a folder under no Library folder.
- [ ] A Folder scan after a linked series add reads the show as Already in
      library.
- [ ] A failed linked save removes the reserved folder and never a linked
      file.
- [ ] `ChoiceCard`'s `disabled` is not selectable and draws its line. The
      moved suites pass from their new home, and the three earlier callers
      are unchanged.
- [ ] The choice is drawn only on a shell series add. Link is the default,
      forced to Copy when unavailable, and re-enabled by a later pick.
- [ ] The wire carries `mode` first, folder rows' paths in both modes and
      picked rows' bytes always.

---

## Phase 3: A movie, linked

**User stories**: 33–41 (the movie add), 42, 52–55

### What to build

First, the prototype: amend `feat.MovieForm.dc.html`'s movie add for the
Import mode choice and its disabled Link card.

In the shell, the preload's Folder bridge gains `pathOf(file)` over
`webUtils.getPathForFile`, and `FolderBridge` gains the member. The video
picker stays the `FilePicker` it is.

On the server, `GET /api/library-folders/containing` answers the listed
Library folder a path lies under, or `null`. `POST /api/movies` reads the
required `mode` and a found `videoPath`, places it through `placeFoundVideo`,
and records the Source folder in both modes: the film's folder, plus its
Source file in a shared (Collection) folder.

On the client, a picked video's path is read with `pathOf` and checked with
the containing read the moment it is picked. The answer decides Link's
availability, as on the series add. The choice is drawn on a shell movie add
only, never on an edit. In Link, the video travels as its path; in Copy, as
its bytes.

The Package smoke gains its lines for `pathOf` and a linked add from the real
folder dialog.

Demo: add a film from inside a Library folder in Link. It plays from where it
lies, and a later scan does not import it again.

### Acceptance criteria

- [ ] The prototype is amended for the movie add's choice.
- [ ] `pathOf` is on the preload's bridge and on `FolderBridge`, and
      `tsconfig.electron.json` typechecks.
- [ ] `GET /api/library-folders/containing` answers the folder's id inside a
      listed folder and `null` outside.
- [ ] `POST /api/movies` in Link with a found `videoPath` copies no video, and
      the film plays from its original file.
- [ ] The Source folder is recorded in Link and in Copy, and a Collection
      folder film also records its Source file, so the other films in that
      folder are still imported.
- [ ] A video from outside every Library folder records nothing.
- [ ] A missing or unknown `mode`, a relative or wrong-kind path, and Link
      outside every folder are `400`.
- [ ] A Folder scan after a linked movie add reads it as Already in library.
- [ ] The choice is drawn only on a shell movie add. Link is the default, is
      disabled with its line when the containing read is `null`, and is
      re-enabled by a later pick.
- [ ] The wire carries the path in Link and the bytes in Copy.
- [ ] `docs/release-checklist.md` carries the Package smoke lines.

---

## Phase 4: The edges

**User stories**: 9, 15–19, 23, 24, 28, 29

### What to build

First, the prototype: amend `feat.MovieForm.dc.html` for the stray line, the
held refusal and Unplaced rows numbered by guess.

On the server, `readShowFolder` answers a folder `groupShows` reads as a film
with every video as Unplaced, and sets `heldSeriesId` when the folder is
already a held series's Show folder.

On the client:

- `seriesResolveRows`' Numbering guess is extracted as `numberFoundRows`, and
  the Series Resolve calls it. The pick numbers Unplaced videos by it,
  continuing after the numbered rows, so every row is numbered and editable.
  Two rows claiming one number are caught by the form's existing gate.
- _2 subtitle files matched no episode._ is drawn under the episodes, and
  nothing at zero.
- A held folder draws _Harbor and Vine is already in your library._ as a
  Refusal and adds no rows.
- A second pick replaces the first folder's rows and keeps the hand-added
  ones.

Demo: pick a folder of loosely named videos and every row arrives numbered;
pick a held show and nothing lands.

### Acceptance criteria

- [ ] The prototype is amended for the stray line, the held refusal and
      guessed numbers.
- [ ] `readShowFolder` answers a film-shaped folder as all Unplaced, the stray
      count, and `heldSeriesId` for a held Show folder.
- [ ] `GET /api/show-folder` answers a held folder as `200` with
      `heldSeriesId`.
- [ ] `numberFoundRows` passes the Series Resolve's existing numbering cases
      and continues after numbered rows. The Series Resolve is unchanged.
- [ ] Unplaced rows arrive numbered and editable, and a clash is refused by
      the existing gate.
- [ ] The stray line reads its count and is absent at zero.
- [ ] A held folder draws its Refusal with the series's title and adds no
      rows.
- [ ] A second pick replaces only the folder's rows. Hand-added rows stay.
