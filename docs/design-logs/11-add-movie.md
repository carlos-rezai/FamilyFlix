# 11 — Add a movie (the Add/Edit form)

> **Initiative:** `movie-form` — [issue #97](https://github.com/carlos-rezai/FamilyFlix/issues/97)
> **PRD:** `docs/PRDs/11-add-movie.md`
> **Plan:** `docs/PRDs/11-add-movie-plan.md` — seven build phases, filed as issues 98–108
> **Shipped:** issues 98–107, 2026-09-05 → 2026-09-10. What the build actually
> did, and where it departed from this log, is in `docs/dev-journal.md`.

This log is the `grill-me` session that settled the feature **before** the PRD
was written. It is an immutable snapshot of that moment rather than a record of
what shipped — the questions below were answered against the prototype and the
then-current code, and three of the documents it resolves were amended by the
initiative it opened.

## Background

`src/pages/AddMoviePage/AddMoviePage.tsx` is a stub that echoes `?movie=<id>`.
`src/features/movie-form/` is an empty `.gitkeep`. `server/src/media/` — which
CLAUDE.md's folder map describes as "folder scanning, file copy into managed
storage, subtitle detection" — is also still an empty `.gitkeep`, so **nothing
in the app can put a file anywhere**.

The repository side is already built and tested: `LibraryStorage.addMovie`,
`updateMovie` and `deleteMovie` all exist (`server/src/library/write/write.ts`),
transactional, replacing genres and subtitles wholesale on a patch. **No route
exposes any of the three.** Every write route the app has (`favorite`,
`watched`, `rating`, `resume`) is a single-signal `{ value }` POST.

The prototype is `docs/handoff/feat.MovieForm.dc.html`, which COMPONENT-SPEC §6
maps to `pages/AddMoviePage` as "the Add/Edit form (also resolves an import
row)". `EditMenu` (`docs/design-logs/04-movie-detail.md`) already navigates to
`/add?movie=<id>` and calls the parameter **provisional**, explicitly leaving
the contract to this grill.

## Problem

Three documents disagree with the prototype and with the shipped code, and the
form cannot be built until each is settled:

1. **CLAUDE.md** describes "Movie Import — Two Paths, One Form": folder-path
   autofill plus manual mode. `feat.MovieForm.dc.html` has **neither** — no mode
   tabs, no path field. The container still carries dead `addMode` /
   `folderPath` / `scanFolder` state the extracted feature never renders.
2. **`01-library-core.md` Q17** reversed CLAUDE.md's managed-copy model to
   "Reference in place (12 TB ⇒ no duplication)". Everything shipped since
   assumes the opposite.
3. **`02-browse-grid.md` Q4** flagged TMDB as "an unowned feature-list gap" and
   handed it to Add-movie / bulk-import. The prototype's form has no lookup, no
   match-confirm, and no poster search — every metadata field is typed by hand.

And one constraint decides the shape of the whole feature: **a browser cannot
tell us where a file is.** `<input type="file">` yields a `File` — a name and
bytes, never a path. The prototype's
`pickVideo(){ this.setState({fVideo:'selected-video.mp4'}) }` is precisely the
simulation CLAUDE.md's "never port the simulation" rule warns about, and there
is no Electron shell yet (`electron/.gitkeep`) to replace it with a native
dialog.

## Questions and Answers

### Scope

1. **What does this initiative cover?** ✅ **Add + Edit, one form, behind
   `/add`**, with `?movie=<id>` pre-filling it — the prototype has no `/edit`
   route (`editMovie()` reuses this screen). Ticks 🔜 _Add a movie_ and half of
   🔜 _Edit / delete a movie_. ❌ **Delete**: no confirmation is designed
   anywhere in `docs/handoff/`, and `EditMenu`'s own docblock already declined
   to ship a red row that does nothing. ❌ **The import context**: the
   prototype's `inImportContext` banner, `resolveLabel`, and the
   "Save & continue" / "Skip this one" labels belong to bulk import resolving a
   flagged row. Nothing in the app can navigate into that mode, so building it
   now is the same dead UI the Delete row would have been. It arrives with
   `import-export`, the only feature that can reach it.

2. **Is there an entry point at all?** No — the prototype's "＋ Add a movie" is
   an accent button in **`page.SettingsPage`'s header**, and our `SettingsPage`
   is a two-line stub. ✅ **This initiative ships that header** (back pill,
   serif `Settings`, the ＋ button, the "Manage your library, playback, and
   storage." line) and nothing below it — the grouped Library / Playback /
   Storage / About sections stay with the settings-shell initiative. It is the
   prototype's own surface, and without it the feature is unreachable and
   cannot be checked by looking, which is the same argument that justifies the
   dev seed's existence.

### The three stale documents

3. **Managed copy, or reference in place?** ✅ **Managed copy** — and Q17's
   reversal is itself superseded, by code rather than by opinion.
   `server/src/playback/mediaFilePath/` (shipped, tested) resolves a stored path
   against `FAMILYFLIX_MEDIA_PATH` and answers `null` for anything absolute or
   outside the root, **including a symlink out, deliberately**. `/api/images` is
   `express.static(mediaPath)`. The seed writes `<slug>/<slug>.mp4` under the
   same root. Every byte the app can currently deliver already comes from
   managed storage; Q17 predates the playback domain that made under-root a
   security boundary. CLAUDE.md was right, and the ubiquitous language's
   **Reference in place** entry is retired.

4. **Then how does a browser pick a file?** ✅ **A real `<input type="file">`,
   and the bytes are uploaded.** This constraint settles Q3 as much as Q3
   settles it: a reference-in-place design needs Electron's
   `dialog.showOpenDialog`, and the Electron shell is a separate 🔜 feature.
   Uploading works **today** under `npm run dev` — which is how all nine
   previous features were checked by looking — matches `mediaFilePath`'s
   contract with zero change to the stream route, the playback route or
   `/api/images`, and still works **inside** Electron unchanged. When the shell
   lands it can _add_ a native dialog that hands the server a local path to copy
   without an HTTP body: an optimisation behind the same `FileField`, not a
   redesign.

5. **Does TMDB belong in this form?** ❌ **No — and not by deferral, by
   argument.** Log 01's case for TMDB was "hand-entry is infeasible", which is a
   claim about **12 TB of back catalogue**, not about adding one film. The
   prototype types title, year, director, cast and description by hand and picks
   the poster as a file. So TMDB's argument lives entirely in **bulk import**
   and stays there. A hand-added movie has `tmdb_id = null`, its **Rating** is
   set by the maintainer or is **Unrated**, and its **Poster** is a copied file
   rather than a download.

### The form surface

6. **Is there folder-path autofill?** ❌ **No.** The prototype has none, and
   README's own feature table already agrees with it — "Add a movie — manual
   file picker (video, poster, multiple subtitles with language)". The prototype
   is the spec, so **manual pickers only**; CLAUDE.md's "Movie Import — Two
   Paths, One Form" and README's "Adding a movie" are amended. Folder scanning
   survives where it is actually designed: `ImportFlow`'s root-path field, in
   the bulk-import initiative.

7. **Are the metadata inputs `prim.TextField`?** ✅ **Yes, and `TextField`
   grows the two props its own prototype declared.** COMPONENT-SPEC §5 lists
   MovieForm as composing TextField, while `feat.MovieForm.dc.html` uses bare
   `<input>`s at 48px / radius 10 against a 46px pill. Not a contradiction to
   litigate: `prim.TextField.dc.html` declares `rounded` (default true) and
   `height` (default 46), and our shipped `TextField.styles.ts` already says why
   they are absent — _"their non-default values arrive with MovieForm and
   ImportFlow"_. MovieForm is that caller. One deviation: radius becomes
   `radius.md` (12) rather than the prototype's inline `10px`, because
   COMPONENT-SPEC §1 says every visual value is a token and 10 is not one.

8. **Genre chips?** ✅ **`prim.Chip` verbatim.** Its `md` face is already
   `9px 16px` / pill / accent-soft-when-selected — a pixel match — and its
   docblock says it: _"a real `<button>` carrying `aria-pressed`, which is what
   MovieForm's genre picker needs."_ Built for this, unused until now.

9. **Where does the genre vocabulary come from?** The form needs all **12**
   seeded genres including the empty ones; `GET /api/genres` returns only
   populated ones with counts, because it exists to draw a filter dropdown. ✅
   **`storage.listGenrePool(): Genre[]` + `GET /api/genres/pool`.** ❌ a
   hardcoded frontend list — migration #1's `GENRE_POOL` is the source of truth
   and stays it.

10. **What new primitives and molecules?** `primitives/Textarea/` (new, from
    `prim.Textarea`); `VideoIcon` / `ImageIcon` / `FileIcon` under
    `primitives/Icon/` per §3a; `components/FileField/`;
    `components/SubtitleRow/`. `✕` and `＋` stay literal glyphs, following
    `MenuItem`'s `glyph="✎"` precedent, rather than becoming icon atoms.

11. **Does `FileField` switch on an icon name?** ❌ No — `icon` is a
    `ReactNode`. COMPONENT-SPEC §3a names FileField specifically: _"pass the
    component, don't switch on a string"_, and `TextField` set the precedent.
    The molecule owns a visually-hidden `<input type="file">` behind its
    `<label>` and reports `onPick(file: File)`. Opening a picker is UI; it never
    learns what a movie is.

12. **Does `SubtitleRow` keep the prototype's local `open` state?** ❌ No —
    ✅ **built on `Menu`**, for exactly the reason `FilterDropdown` gave:
    `Menu` already owns Escape, press-outside, select-to-close and focus return,
    and taking it means only one dropdown can be open at a time for free, with
    no coordinating state.

13. **How is the feature decomposed?** Following the player's shape — the
    organism owns the hooks, siblings each draw one thing. See Design below.

### The wire

14. **Save shape?** ✅ **One multipart request per save** — `POST /api/movies`,
    `PATCH /api/movies/:id` — parsed with **`busboy`** streaming each part
    straight to disk. One atomic action, no orphaned uploads, and an edit that
    touches only the title carries no bytes at all: unchanged files travel as
    their existing relative path, changed ones as a file part. On any failure
    the files that request wrote are removed. ❌ upload-on-pick to a staging
    area: two round trips, draft ids and abandoned-draft sweeping, for a form
    filled in thirty seconds.

15. **Where do the bytes land?** `<mediaRoot>/<title-year-slug>/<safe original
filename>` — matching the seed's own `<slug>/<slug>.mp4` and the family's
    one-folder-per-movie convention. Collisions take a `-2`, `-3` suffix. An
    **edit reuses the existing folder** (the dirname of the current
    `videoPath`), so renaming a movie never moves files. Filenames are sanitised
    server-side; a client-supplied name is never trusted into a path.

16. **How does `media/` reach the routes?** ✅ Injected, exactly as `playback`
    is: `createApiRouter(storage, mediaPath, playback, media)`. The route layer
    never learns there is a filesystem. `mediaPath` stays alongside it — the
    stream, playback and cue routes still resolve stored paths through
    `mediaFilePath`.

17. **Progress?** CLAUDE.md says a large-file add "needs a visible progress
    indicator, not a spinner" — but **the prototype designs no progress surface
    on this form**; `saveMovie()` just navigates. Inventing one is redesigning.
    ✅ **the Save button's `disabled` state**, which `prim.Button` already
    declares, with the label reading "Adding…" while the copy runs. Progress
    lives where the prototype actually designed it: `ImportFlow`'s `ProgressBar`
    - `LogConsole`, in bulk import.

18. **Validation?** The prototype validates nothing, but `title` and
    `video_path` are `NOT NULL`. ✅ **Save is `disabled` until there is a title
    and a video** (on edit, the existing video counts) — a gate built from a
    prop the prototype already has, so no error UI is invented. **Year** accepts
    digits only, capped at 4, so it cannot be invalid. **Cast** splits on
    commas, trimming empties. **Rating** is held as the 0–100 percent
    `RatingPicker` speaks and converted at the boundary by the shipped
    `toRatingUnits`.

19. **Accept types?** Video `video/*,.mkv,.avi` (Chromium gives MKV/AVI no MIME
    type); poster `image/*`; subtitles `.srt,.vtt,.ass,.sub` — the same four
    `parseSubtitle/` dispatches on. The server re-checks by extension and never
    trusts the client. An **unplayable container is not rejected**:
    `cannot-play` is a designed `PlayerNotice` state, and refusing MKV at the
    door would refuse most of the family folder.

20. **Runtime?** The form has no runtime field, so an added movie would render
    "—" where every seeded one shows a duration. ✅ **derive it, best-effort,
    after the copy**: `playback/mediaDuration/` reads an MP4's own `moov` with
    no component at all, and `playback/probe/` covers the rest when FFmpeg is
    present. `null` when neither can answer. No invented UI, one shipped domain
    reused.

21. **After save?** The prototype's `saveMovie()` calls `goBrowse()`. ✅ **add
    lands on the browse home; edit lands back on `/movie/:id`**, matching
    `backFromAdd`. Back and Cancel share one handler, as they do in the
    prototype. No snackbar — the system is 🔜 and the prototype's add flow
    raises none.

## Design

### Storage policy, settled

```mermaid
flowchart LR
  P[File picker in the browser] -- File bytes --> R[POST /api/movies]
  R -- busboy stream --> D["mediaRoot/slug/file"]
  R -- relative paths --> S[LibraryStorage.addMovie]
  D -. mediaFilePath .-> ST["GET /api/movies/:id/stream"]
  D -. express.static .-> IM["GET /api/images/posterPath"]
```

Every stored path stays **relative under the managed media root** — the one
rule `mediaFilePath` already enforces and every read route already depends on.

### Types — `src/types/form.ts` (new, re-exported from `types/index.ts`)

```ts
/** A file slot in the form: either one already stored, or one just picked. */
export type MovieFormFile =
  | { kind: 'stored'; path: string; filename: string }
  | { kind: 'picked'; file: File; filename: string };

export interface MovieFormSubtitle {
  /** Stable across re-orders and removals; not the persisted subtitle id. */
  key: string;
  file: MovieFormFile;
  language: string;
}

export interface MovieFormValues {
  title: string;
  year: string;
  director: string;
  cast: string;
  description: string;
  genres: string[];
  /** 0–100 percent, `null` for Unrated — what `RatingPicker` speaks. */
  rating: number | null;
  video: MovieFormFile | null;
  poster: MovieFormFile | null;
  subtitles: MovieFormSubtitle[];
}
```

### Backend — `server/src/media/` (the domain finally built)

| Unit            | Signature                                                                |
| --------------- | ------------------------------------------------------------------------ |
| `movieFolder/`  | `movieFolder(title: string, year: number \| null): string` — pure slug   |
| `safeFilename/` | `safeFilename(name: string): string` — pure; no separators, no dots-only |
| `createMedia/`  | `createMedia(mediaPath: string): Media` — the injected seam              |

```ts
export interface Media {
  /** Reserve `<mediaRoot>/<slug>/`, suffixing on collision; returns the folder. */
  reserveFolder(title: string, year: number | null): string;
  /** Stream one part to `<folder>/<safe name>`; returns the RELATIVE path. */
  storeUpload(
    folder: string,
    filename: string,
    source: Readable
  ): Promise<string>;
  /** Remove a folder, or the files one request wrote — rollback and cleanup. */
  removeFolder(folder: string): void;
}
```

### Routes — `server/src/routes/index.ts`

- `GET /api/genres/pool` → `{ genres: Genre[] }` — the 12, counts and all.
- `POST /api/movies` — multipart; fields then file parts; → `201` + `Movie`.
- `PATCH /api/movies/:id` — multipart; unchanged files travel as their existing
  relative path; → `200` + `Movie`, `404` for an unknown id.

`createApiRouter(storage, mediaPath, playback, media)`.

### Frontend

```
src/primitives/
├── Textarea/                 ← new
├── TextField/                ← + `height`, `rounded`
└── Icon/{VideoIcon,ImageIcon,FileIcon}.tsx

src/components/
├── FileField/                ← new; owns the hidden <input type="file">
└── SubtitleRow/              ← new; built on Menu

src/features/movie-form/
├── MovieForm/                ← organism: heading, field column, actions
├── MovieFormFiles/           ← the Files card
├── GenrePicker/              ← the chip row over the genre pool
├── useMovieForm/             ← values, dirty files, save, navigation
├── useGenrePool/             ← loads the 12 (precedent: search/useGenreList)
├── formValues/               ← pure: Movie → MovieFormValues → FormData
├── castNames/                ← pure: "Jane Doe, John Roe" ↔ string[]
└── api/                      ← createMovie, updateMovie, fetchGenrePool

src/pages/AddMoviePage/       ← composes MovieForm, reads ?movie=
src/pages/SettingsPage/       ← the prototype's header only
```

### Not built

Delete (and the media cleanup that belongs with it); the import context banner
and its labels; folder-path autofill; TMDB; the Settings page's grouped
sections; a backdrop field (`backdrop_path` stays null, and `MoviePage` falls
back to the gradient — the prototype's own answer); a snackbar.

## Implementation Plan

1. **Thinnest end-to-end slice: a movie with no files.**
   `POST /api/movies` (JSON only, no multipart yet) → `storage.addMovie`;
   `GET /api/genres/pool`; a bare `MovieForm` with title + year + the genre
   chips + Save. A movie typed into the form appears on the browse home.
2. **The form, 1:1.** Director, cast, description, `Textarea`, `RatingPicker`,
   `TextField`'s `height`/`rounded`, the heading, the actions row, and the
   Settings header that reaches it. Every field except the Files card.
3. **The `media/` domain + the video.** `movieFolder`, `safeFilename`,
   `createMedia`, `busboy`; `FileField` and the video slot; the multipart
   `POST`. An uploaded MP4 plays through the existing stream route.
4. **Poster and subtitles.** The poster slot, `SubtitleRow` on `Menu`, the
   language pool, `＋ Add subtitle file`. An added movie shows its own artwork
   and its cues load in the player.
5. **Edit.** `?movie=<id>`, `formValues` prefill, `PATCH /api/movies/:id`,
   unchanged-file passthrough, the label and destination flips.
6. **Runtime.** Derive `runtimeMinutes` from `mediaDuration` / `probe` after the
   copy, best-effort.

## Trade-offs

**Easier.** The form is reachable and checkable the day it lands, in the
browser, with no Electron. Every stored path keeps the single rule the playback
domain already enforces, so the stream route, the cue route and `/api/images`
need no change at all and the player works on an added movie for free. `busboy`
streams, so a 12 GB file never sits in memory. The two riskiest pieces — the
slug and the filename sanitiser — are pure functions, which makes the dangerous
logic the cheap logic to test.

**Harder.** Adding a movie now **copies** it, which for a 12 TB library means
real duplication and real minutes per film — the cost log 01 Q17 was trying to
avoid, accepted here because the alternative is a feature that cannot exist
until Electron does. Abandoning a save mid-upload wastes the bytes already
written (they are removed, but the time is gone). The folder is named from the
title at creation and never renamed, so the managed directory can drift from the
library's own names.

**Ruled out of scope.** Delete; the import context; folder-path autofill and
TMDB, both of which belong to bulk import where their arguments actually live;
the Settings shell's sections; Electron's native file dialog; a progress surface
this form's prototype does not have.
