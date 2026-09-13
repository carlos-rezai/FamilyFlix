# 13 — Bulk import

> **Initiative:** `bulk-import`
> **PRD:** [#123](https://github.com/carlos-rezai/FamilyFlix/issues/123) · `docs/PRDs/13-bulk-import.md`
> **Plan:** to follow the PRD

This log is the `grill-me` session that settled the feature before the PRD was
written, run against the prototype and the code as they stood on 2026-09-13. It
is an immutable snapshot of that moment. The session ran with one answer from
the maintainer — the scope — and every other recommendation accepted in
advance; where a fact is the maintainer's alone (the real spreadsheet's
headers), the design is built so the answer cannot break it and the assumption
is named.

## Background

The whole reason FamilyFlix exists is a real collection: ~12 TB of films, one
folder each, and an Excel sheet tracking titles, years and genres. Every
feature shipped so far assumes the library is already full — and today the only
thing that fills it is `server/src/db/seed/`, scaffolding whose stated expiry is
_"the commit that ships bulk import is the commit that deletes it."_

The prototype is `docs/handoff/feat.ImportFlow.dc.html`, mapped by
COMPONENT-SPEC §6 to `pages/ImportPage` — "the import setup → running → review
flow" — with `mol.LogConsole.dc.html` as its activity log and `prim.ProgressBar`
(already built) as its bar. The container's simulation
(`FamilyFlix.dc.html`, `startImport` … `seedProblems`) shows the three steps:

- **Setup:** two typed path fields (spreadsheet, movies root) and _Start
  import_.
- **Running:** a Connect ✓ → Scan → Import stepper; a serif headline
  ("Scanning your library…" / "Importing movies…"); a stat line ("Found N movies
  so far" / "N of M imported"); the bar (indeterminate while scanning); the
  current item in mono; elapsed and, once enough is done, an ETA; the _Activity
  log_; _Cancel import_ in `danger`.
- **Review:** two stat tiles (_matched confidently and imported_ /
  _need your attention_), a _Needs attention_ list of rows each with a coloured
  dot, a title, a reason, **Resolve** and **Skip**; a _✓ All done_ card once the
  list is empty; _Finish — go to library_.

**Resolve** opens `feat.MovieForm` in **import context**: the accent banner
"Resolving import · {title}", the fields prefilled, _Save & continue_ and
_Skip this one_. `11-add-movie.md` Q1 explicitly parked that surface for this
initiative — "nothing in the app can navigate into that mode" — and Q6 and Q5
sent folder-path autofill and TMDB here too, "where their arguments actually
live".

What exists to build on:

- `Media` (`server/src/media/createMedia/`): `reserveFolder`, `storeUpload`,
  `renameFolder`, `removeFolder`, `removeMovieFolder`; `movieFolder`,
  `safeFilename`. No scanning yet — CLAUDE.md gives "folder scanning … subtitle
  detection" to `media/` and "Excel/CSV parsing, row-to-folder matching" to
  `import-export/`, which is an empty folder.
- `POST /api/movies` (`server/src/routes/index.ts`): the reserve → copy →
  rename → `derivedRuntime` → `addMovie` → rollback shape, with `readMovieFields`
  validating genres against the **Genre pool**.
- `createApiRouter(storage, mediaPath, playback, media)` — domains are injected;
  the route layer never learns there is a filesystem or an FFmpeg.
- `useMovieForm` + `MovieFormValues` with `MovieFormFile` in two kinds,
  `stored` and `picked`; `movieFormData` encoding a save as one multipart body.
- `SettingsPage`: `SettingsHeader` only; the prototype's Library section (three
  action rows) is where _Import from spreadsheet_ lives.
- `TextField` with `icon: 'sheet' | 'folder'`, `mono`, `rounded`, `height` —
  the non-default values log 11 Q7 said "arrive with MovieForm and ImportFlow".

## Problem

Fill the library from the family's spreadsheet and folder tree in one pass,
with the prototype's three-step surface, on the storage model the app already
has — while resolving three places where the documents disagree with each
other or with the prototype:

1. **When does a row commit?** README and CLAUDE.md say "a review step before
   anything is committed"; the prototype's tile says "matched confidently
   **and imported**" and only flagged rows reach review.
2. **Is TMDB here?** Logs 01 and 11 and the ubiquitous language all say TMDB
   seeds ratings and downloads artwork "at bulk import" — and the prototype's
   ImportFlow has no key field, no match step and no network state.
3. **What is a problem?** The simulation flags "no subtitle file" and "missing
   a genre" beside "no folder" and "two folders match" — but subtitles and
   genres are both optional on the form this initiative shares its save with.

And one constraint decides the whole file-handling design: the maintainer types
a **path**, so this is the one place in the app the server can be pointed at a
folder — which is exactly why folder-path autofill was refused on the form.

## Questions and Answers

### Scope

1. **Is Export part of this?** ❌ **No.** README lists _Bulk import_, _Import
   progress console_ and _Export_ as three rows; the first two are one prototype
   file — the console _is_ the running step — and Export is another
   (`feat.ExportModal`, an overlay, no dependency on import). ✅ **This
   initiative is bulk import + its progress console**, named `bulk-import`
   (distinct from the `import-export/` folder, so a commit prefix reads
   unambiguously). Export gets its own grill.

2. **Where is the entry point?** `SettingsPage` is header-only. ✅ **Ship the
   prototype's Library section with the two rows whose destinations exist** —
   `＋ Add a movie` → `/add`, `⇪ Import from spreadsheet` → `/import` — as
   `features/settings/LibrarySection`. The `⬇ Export to CSV` row arrives with
   the export initiative. ❌ A third row that does nothing — the "red row that
   closes the menu and does nothing" `EditMenu` refused twice. The rest of the
   settings shell stays 🔜.

3. **Route and page?** ✅ `/import` → `pages/ImportPage` composing
   `MaintainerLayout` (760, the prototype's measure) and
   `features/import-export/ImportFlow`. Back → `/settings`, Finish → `/` —
   the container's `goSettings` and `goBrowse`.

4. **Does the seed go?** ✅ **Yes, in this initiative**, as CLAUDE.md promises:
   `server/src/db/seed/`, the `db:seed` script, and the paragraphs naming them.
   The importer's own fixtures — a tiny sheet and folder tree under its tests —
   are how a dev library gets filled from now on.

### Setup

5. **Typed paths or a native dialog?** ✅ **Typed, as the prototype draws
   them.** The Express server can read any path on this machine, so the flow
   works under `npm run dev` today — how every feature so far was checked by
   looking — and unchanged inside Electron. A native folder dialog is a later
   optimisation behind the same field, not a redesign. The fields are
   `TextField` with `icon="sheet"` / `icon="folder"`, `mono`, `rounded={false}`,
   `height={50}`.

6. **What gates _Start import_?** ✅ **`disabled` until both fields are
   non-empty** — log 11 Q18's pattern, a prop the prototype already has.

7. **A path that won't open?** `POST /api/import` answers
   `400 { error, field: 'sheet' | 'root' }` before any run exists. `TextField`
   has no error affordance and the prototype designs none, so ✅ **one 13px
   line in the `danger` colour under the offending field** — the reason line's
   geometry from the problem rows, recoloured. This is the only invented UI in
   the initiative and is recorded as a prototype amendment (Design §).

8. **Spreadsheet formats and the parser?** ✅ **`.xlsx` and `.csv`, by
   extension, read with `exceljs`.** ❌ SheetJS: its npm package has been
   frozen at 0.18.5 since 2022 with open advisories; the maintained build is
   not on npm. CSV so the future export round-trips ("bulk-edit externally and
   re-import", README). First worksheet; the first row is the header.

9. **Which columns?** The real sheet's headers were not in the room. ✅
   **Header-driven, case-insensitive, through a synonym table** in a pure
   `readSheet`: title (`title | name | movie | film`), year, genre(s) (split on
   `,` `/` `;`), and optionally director, cast, description/synopsis, rating,
   watched. **Only title is required** — no recognisable title column is a
   `400` on the sheet field. Rows with an empty title are skipped with a log
   line; unrecognised columns are ignored. _Assumption to confirm before the
   PRD: the actual headers. Adding a synonym is one line._

10. **Genres the pool doesn't know?** The route validates against the 12-name
    **Genre pool**. ✅ Sheet genres are matched to the pool case-insensitively;
    anything else is dropped from the row and logged once per unknown name. A
    row left with no genre still imports — title and video are the gate, as on
    the form — but is flagged softly (Q15), because a genre-less movie appears
    in no genre row on the home.

### Scanning and matching

11. **Which folders are movies?** ✅ **A folder holding a video file is a Movie
    folder and is not descended; a folder holding none is descended.** So
    `Movies/Action/Die Hard/` is found and `Die Hard/extras/` does not become a
    second movie. Video is by the route's own extension list (`uploadKinds`).

12. **How does a row find its folder?** ✅ A `titleKey` normaliser applied to
    both sides: lower-case, diacritics stripped (NFKD), dots and underscores to
    spaces, a trailing `(1988)` / `1988` / `[1080p]`-style tail dropped from a
    folder name, then letters, digits and single spaces only. A row matches a
    folder when the keys are equal and, if both carry a year, the years agree.
    Exactly one such folder → **matched**. Several → `ambiguous`. None, but one
    or more folders whose key _starts with_ the row's → `ambiguous` (a
    different reason string). Nothing → `no-folder`. A folder no row claimed →
    `no-row`.

13. **Inside a Movie folder?** ✅ Video as above — zero or more than one is
    `no-video`. Poster: an image (`.jpg .jpeg .png .webp`) named `poster.*` /
    `folder.*` / `cover.*` first, else the first image by name. **Backdrop**:
    an image named `fanart.*` / `backdrop.*` fills `backdropPath` — the detail
    page has had the slot since log 04 and this is the first thing that can
    fill it. Subtitles: `.srt .vtt .ass .sub`, language from a filename tag
    (`.en`, `.eng`, `English`) through a small table onto the form's seven
    language names, `English` when undetectable (the form's own default).

14. **Where does scanning live?** ✅ `server/src/media/walkLibraryRoot/` and
    `media/scanMovieFolder/` (with `detectSubtitleLanguage`) — CLAUDE.md's
    words for `media/` are "folder scanning … subtitle detection". The sheet,
    the matcher and the run are `server/src/import-export/`.

### Problems and commit timing

15. **What is a problem?** ✅ **A hard problem is a row that could not be
    imported as-is; a soft problem is one that was imported but wants a
    look.** The kinds, with their reason copy:

    | kind           | reason                                                                                                         | hard/soft | dot          |
    | -------------- | -------------------------------------------------------------------------------------------------------------- | --------- | ------------ |
    | `no-folder`    | No folder found matching this spreadsheet row.                                                                 | hard      | `danger`     |
    | `ambiguous`    | Two folders look like plausible matches — pick one. / One folder looks like a match, but the name isn't exact. | hard      | `accent`     |
    | `no-video`     | Folder matched, but no video file was found. / Folder matched, but it holds more than one video file.          | hard      | `danger`     |
    | `no-row`       | Folder isn't in the spreadsheet.                                                                               | hard      | `text-faint` |
    | `failed`       | Couldn't copy the video file: {reason}.                                                                        | hard      | `danger`     |
    | `missing-meta` | Imported, but the row has no genre — it won't appear in any genre row.                                         | soft      | `text-faint` |

    ❌ The simulation's `missing-file` kind ("no subtitle file was found"):
    subtitles are optional on the form, and a library with none would put every
    film into review. A missing subtitle or poster is a **⚠ warning log line**
    in the import phase — exactly what the prototype's running log already
    shows ("⚠ Title — no subtitle track found"). `no-video` takes its place:
    the file whose absence actually blocks (log 01 Q18 asked for the
    more-than-one case). `no-row` and `failed` are new; the list is data, so a
    new kind is a reason string and a dot colour, not a new surface.

16. **When does a row commit — the docs conflict?** ✅ **The prototype:
    confident matches import during the run; review is for flagged rows.**
    Reviewing thousands of confident matches is a list nobody reads, and Edit
    and Delete already exist for corrections. README's "review step before
    anything is committed" and CLAUDE.md's "Surfaces a review step before
    committing" are amended to say what the tile says.

17. **Copy or move?** The library is ~12 TB; a managed copy doubles it.
    ✅ **Copy, exactly as the form does**, through a new
    `Media.copyIn(folder, sourcePath)` built on `fs.copyFile` (the OS copy
    path, faster than piping a stream for terabytes). One storage model; the
    originals survive a bad run; cancel needs no undo. The disk cost is the
    maintainer's to plan — `FAMILYFLIX_MEDIA_PATH` on the drive with room, the
    originals deleted by hand once the library checks out. ❌ Move: a second
    storage model, and a bug in it wipes the family's folder. _Follow-up, not
    redesign: a "move when on the same volume" is one line in `Media` if the
    real library turns out to have nowhere to be copied to._

18. **TMDB?** ❌ **Not here, and not by deferral.** The prototype has no key
    field, no match-confirm step, no network state; the sheet already holds the
    part that "can't be hand-typed" and the folder holds the poster. What TMDB
    would add — synopsis, cast, director, a backdrop, a rating seed — is an
    _enrichment_ pass over an already-imported library: a future initiative
    with its own prototype amendment, if ever, and a network dependency an
    offline-first app should take deliberately. `tmdb_id` stays `null`; the
    ubiquitous-language entries that say "TMDB at bulk import" are amended.

19. **Re-running the same sheet?** ✅ A row whose `titleKey` and year match a
    movie already in the library is **skipped with a log line**
    ("– Already in library Title (Year)") — not matched, not a problem.
    Titles are loaded once at run start. Cancel-and-restart and a second run
    are therefore harmless.

### The run

20. **Server shape?** ✅ `server/src/import-export/createImporter/`, injected as
    the fifth router argument the way `playback` and `media` are:
    `createApiRouter(storage, mediaPath, playback, media, importer)`. The router
    never learns there is a spreadsheet. **One run at a time, in memory** —
    _the current run_; a second start while one runs is `409`. The app
    restarting mid-run loses the run; movies already added are real rows and
    stay.

21. **Progress transport?** ✅ **Poll `GET /api/import/current` every 500 ms**
    while the phase is scanning or importing. One endpoint serves the live case
    and the reload/re-attach case; the log is capped at the prototype's own 80
    lines so a snapshot stays small; jsdom has no `EventSource` to drive. ❌
    SSE: a connection lifecycle for nothing a snapshot doesn't give. Elapsed,
    percent and the ETA (after 20 done, as the container computes it) are
    derived client-side from `startedAt` / `done` / `total` in a pure
    `importView`.

22. **Cancel?** ✅ Aborts the in-flight copy (that folder rolled back), keeps
    every movie already added, discards the run, and returns to **setup** —
    the container's `cancelImport`. Safe because of Q19.

23. **Leaving the screen mid-run?** ✅ Allowed. The run is a server job;
    `/import` re-attaches through `current`. This is the roadmap's
    "backgroundable import" minus the snackbar.

### Resolve

24. **How does Resolve reach the form?** ✅ `/add?problem=<id>` puts
    `useMovieForm` in **import context**: it fetches the problem and prefills
    the fields from the row and the file slots from the folder. The banner reads
    "Resolving import · {title}"; for `ambiguous` the first candidate fills the
    slots and the label names the others ("Harbor Lights — also matched:
    Harbor.Lights.2019"). _Save & continue_ / _Skip this one_ are the labels
    the container already switches on `addContext === 'import'`.

25. **How does a folder's file travel?** A third `MovieFormFile` kind:
    `{ kind: 'found'; path: string; filename: string }` — an absolute path under
    the run's root. On save it travels as that path in the form's existing
    multipart encoding (a picked file still travels as bytes; `stored` never
    occurs here), to `POST /api/import/current/problems/:id/resolve`. The server
    copies a found path **only if it lies under the current run's root** — the
    `mediaFilePath` boundary rule, aimed at the library root instead of the
    managed one. ❌ Reusing `POST /api/movies` with a path field: it would make
    the general route accept arbitrary paths from anyone who can reach it.

26. **Skip, and the soft kind?** _Skip_ (either screen) →
    `DELETE /api/import/current/problems/:id` — "handled" — then `/import`. A
    soft `missing-meta` problem resolves through the **Edit** form,
    `/add?movie=<id>&problem=<pid>`, whose ordinary `PATCH` save is followed by
    the same `DELETE`. The `Resolve` button is the prototype's inline
    `<button>`; in code it is `Button` `secondary` `sm`, since COMPONENT-SPEC §1
    forbids one-off inline controls.

## Design

### Backend — `server/src/import-export/` (the domain finally built)

```
import-export/
├── readSheet/          ← .xlsx/.csv → SheetRow[] via exceljs; the synonym table; pure over a Buffer
├── titleKey/           ← pure: a title or folder name → its matching key
├── matchRows/          ← pure: SheetRow[] × MovieFolderScan[] → { matched, problems, unclaimed }
├── createImporter/     ← the injected domain: start, current, cancel, problem, resolve, dismiss
└── importRun/          ← the state machine one run walks: scanning → importing → review
```

```ts
// src/types/import.ts (new, re-exported from types/index.ts) — shared by both build targets
export type ImportPhase = 'scanning' | 'importing' | 'review';
export type LogKind =
  | 'info'
  | 'scan'
  | 'path'
  | 'success'
  | 'warning'
  | 'error';
export interface LogLine {
  text: string;
  kind: LogKind;
}
export type ProblemKind =
  | 'no-folder'
  | 'ambiguous'
  | 'no-video'
  | 'no-row'
  | 'failed'
  | 'missing-meta';
export interface ImportProblem {
  id: string;
  kind: ProblemKind;
  title: string;
  reason: string;
  /** Set for the soft kind: the movie already in the library. */
  movieId?: string;
}
export interface ImportRun {
  id: string;
  phase: ImportPhase;
  startedAt: string;
  found: number;
  total: number;
  done: number;
  matched: number;
  currentItem: string;
  log: LogLine[];
  problems: ImportProblem[];
}
/** What Resolve prefills the form from. */
export interface ImportProblemDetail extends ImportProblem {
  row: {
    title: string;
    year?: number;
    genres: string[];
    director?: string;
    cast?: string[];
    synopsis?: string;
    rating?: number;
  };
  folder?: string;
  candidates: string[];
  files: {
    video?: string;
    poster?: string;
    backdrop?: string;
    subtitles: { path: string; language: string }[];
  };
}
```

```ts
// server/src/import-export/createImporter/createImporter.ts
export interface Importer {
  start(input: { sheetPath: string; rootPath: string }): Promise<ImportRun>; // throws ImportStartError { field, message } | AlreadyRunning
  current(): ImportRun | null;
  cancel(): Promise<void>;
  problem(id: string): ImportProblemDetail | null;
  resolve(id: string, movie: ResolvedMovie): Promise<Movie>; // copies found paths under rootPath only
  dismiss(id: string): boolean;
}
export function createImporter(deps: {
  storage: LibraryStorage;
  media: Media;
  playback: Playback;
}): Importer;
```

`Media` gains `copyIn(folder: string, sourcePath: string): Promise<string>`
(`fs.copyFile`, answers the **Stored path**) and `media/` gains
`walkLibraryRoot(root) → MovieFolderScan[]`, `scanMovieFolder(dir) →
{ videos, poster, backdrop, subtitles }`, and
`detectSubtitleLanguage(filename) → string`.

The run, per matched row: `reserveFolder(title, year)` → `copyIn` video,
poster, backdrop, each subtitle → `derivedRuntime` → `addMovie` — the POST
route's own sequence; a throw calls `removeFolder` and files a `failed`
problem. Scanning runs to completion before importing, so every match-time
problem exists when the bar turns determinate.

### Routes — `server/src/routes/index.ts`

```
POST   /api/import                               { sheetPath, rootPath } → 201 ImportRun
                                                  400 { error, field } · 409 { error } (already running)
GET    /api/import/current                        → 200 ImportRun · 404
POST   /api/import/current/cancel                 → 204
GET    /api/import/current/problems/:id           → 200 ImportProblemDetail · 404
POST   /api/import/current/problems/:id/resolve   multipart, the form's encoding → 201 Movie
DELETE /api/import/current/problems/:id           → 204 · 404
```

The resolve route parses its body with the same `readBody` / `readMovieFields`
the movie routes use; a `found` file arrives as a text field holding the path
and is refused unless `importer` places it under the run's root.

### Frontend

```
src/components/LogConsole/            ← mol.LogConsole: mono lines by kind, pinned to the bottom
src/features/import-export/
├── ImportFlow/                       ← the organism: owns useImportRun, renders one of three steps
├── ImportSetup/                      ← two TextFields, the gate, the one error line
├── ImportProgress/                   ← PhaseStepper + headline + ProgressBar + current item + LogConsole + Cancel
├── ImportReview/                     ← two StatTiles + ProblemRows + All done + Finish
├── PhaseStepper/ StatTile/ ProblemRow/
├── useImportRun/                     ← start, poll at 500 ms while running, cancel, skip
├── importView/                       ← pure: ImportRun → headline, statLine, percent, elapsed, eta, dots
└── api/                              ← startImport, fetchCurrentRun, cancelImport, fetchProblem, resolveProblem, dismissProblem
src/features/settings/LibrarySection/ + ActionRow/
src/pages/ImportPage/
```

`MovieFormFile` gains `{ kind: 'found'; path; filename }`; `movieFormData`
sends it as the path; `useMovieForm` reads `?problem=` (and `?movie=` beside
it for the soft kind), fetches the detail, and switches its save and its
labels. `FileField` shows a found file as it shows a stored one.

### Prototype amendment (`docs/handoff/`, one `docs:` commit, first)

`feat.ImportFlow.dc.html`: the setup error line (Q7) and _Resolve_ as
`prim.Button` `secondary` `sm`. `FamilyFlix.dc.html`: `seedProblems` carries
the six kinds of Q15 and drops `missing-file`. `COMPONENT-SPEC.md`: the
`ImportFlow` row's model, `LibrarySection`. `README.md` / `.claude/CLAUDE.md`:
commit timing (Q16), no TMDB (Q18), the seed's removal (Q4).

### Docs amended by this log

`docs/ubiquitous-language.md`: **TMDB**, **Poster**, **Backdrop**, **Rating**
lose "at bulk import"; **Review step** is redefined per Q15/Q16; new terms in
the session's entry.

## Implementation Plan

1. **Amend the prototype and the three documents.** Nothing in `src/` yet.
2. **Thinnest end-to-end slice.** `readSheet` (title + year + genres) →
   `titleKey` → `walkLibraryRoot` / `scanMovieFolder` → `matchRows` →
   `createImporter.start` with `copyIn` → `POST /api/import` +
   `GET /api/import/current` → `useImportRun` polling → `ImportFlow` with setup
   and a running step that is headline, stat line, bar and Cancel. A sheet and
   a folder of two films become two movies on the browse home. The seed goes in
   this commit.
3. **The console.** `LogConsole`, `PhaseStepper`, the current item, elapsed
   and ETA, warning lines for missing subtitle/poster, the 80-line cap.
4. **Review.** Problems recorded during the run; `ImportReview` with
   `StatTile`, `ProblemRow`, Skip (`DELETE …/problems/:id`), All done, Finish.
5. **Resolve.** `ImportProblemDetail`, the `found` file kind, the import
   context in `useMovieForm` and `MovieForm`, the resolve route with the
   under-root check, the soft kind through Edit.
6. **The entry and the edges.** `LibrarySection` on Settings, the `409`, the
   setup error line, the backdrop, the already-in-library skip, `no-row`.

## Trade-offs

**Easier.** The save is the form's: one encoding, one field reader, one
folder sequence, so resolving a flagged row is the screen the maintainer
already knows. Copy-not-move means a wrong run costs time, never the family's
files. Polling one snapshot endpoint makes reload, re-attach and the tests
trivial. Every problem kind is a reason string and a dot, so the matcher can
grow kinds without the review screen changing. Scanning is a pure function
over the folder tree and matching a pure function over two lists — the
heuristics that will need tuning against the real folder names are the
easiest things in the initiative to test.

**Harder.** The run lives in memory: a crash mid-run loses the log and the
problem list (never a movie), and the maintainer re-runs — which Q19 makes
cheap but not free for a 12 TB copy. The synonym table is a guess at headers
nobody has read yet; the first run against the real sheet may need one line
added. `ambiguous` prefills the first candidate rather than offering a chooser,
so a wrong first guess costs a Remove and a hand-pick. The library root is
walked once at start, so a folder added during a run is not seen until the
next.

**Ruled out.** Export (its own grill); TMDB and any network (Q18); a move
(Q17); SSE (Q21); a chooser for ambiguous folders; a native folder dialog
(Electron's, later); a snackbar for a backgrounded run (roadmap); reviewing
confident matches before commit (Q16).
