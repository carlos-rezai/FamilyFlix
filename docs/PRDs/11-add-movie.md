## Problem Statement

I am the maintainer of this library, and there is no way to put a movie in it.

Nine features have shipped against a library that only the dev seed can fill.
`npm run db:seed` writes fixtures through `LibraryStorage` so the browse home,
the carousels, the detail page, search, sort, ratings, favorites, Continue
Watching and the player all have something to render — and every one of them is
a reader. `LibraryStorage.addMovie`, `updateMovie` and `deleteMovie` are built,
transactional and tested, and **no route exposes any of the three**. Every write
route the app has (`favorite`, `watched`, `rating`, `resume`) is a single-signal
`{ value }` POST against a movie that already exists.

`server/src/media/` — which CLAUDE.md's own folder map describes as "folder
scanning, file copy into managed storage, subtitle detection" — is an empty
`.gitkeep`. Nothing in the app can put a file anywhere. `src/features/movie-form/`
is an empty `.gitkeep` too, and `/add` is a stub page that echoes back the
`?movie=` it was handed. The movie detail page's **Edit details** menu item
already navigates there and its own docblock calls the parameter _provisional_,
explicitly leaving the contract to this initiative.

The practical consequence: the app cannot be used by the people it was built
for, because the only way to get a film into it is to run a dev script from a
terminal. And the second consequence is worse — a movie's metadata cannot be
corrected. A typo in a title is permanent, a missing subtitle track can never be
attached, and a poster is whatever the seed decided.

## Solution

One screen at `/add` that writes a movie whole.

The **Movie form** collects title, year, director, cast, description, genres and
a rating, and takes the video, the poster and any number of subtitle files
through real file pickers. Saving copies those bytes into the movie's own folder
under the **Managed media directory** and writes one row — one request, one
atomic action.

The same screen edits. `?movie=<id>` pre-fills every field from the stored
record, the heading and the button change from "Add a movie" / "Add to library"
to "Edit details" / "Save changes", and Save lands back on the movie detail page
rather than the browse home. There is no `/edit` route — the prototype's
`editMovie()` reuses this screen, and so do we. A file already stored travels as
its path and no bytes move, so correcting a title costs nothing.

It is reached from the **Settings** header's accent "＋ Add a movie" button,
which this initiative also builds — a back pill, a serif `Settings`, the ＋
button and the "Manage your library, playback, and storage." line, and nothing
below it. The grouped Library / Playback / Storage / About sections stay with
the settings-shell initiative. Without that header the form is unreachable and
cannot be checked by looking, which is the same argument that justified the dev
seed's existence.

An added movie appears on the browse home, opens on the detail page with its own
artwork, plays through the existing stream route, and loads its own cues — with
no change at all to the stream route, the playback route, the cue route or
`/api/images`, because every path this feature writes is relative under the
managed media root, which is the one rule those routes already enforce.

## User Stories

**Reaching the form**

1. As the maintainer, I want a Settings screen with a real header, so that the
   gear in the app header leads somewhere rather than to a two-line stub.
2. As the maintainer, I want a "＋ Add a movie" button in that header, so that
   there is a way into the form at all.
3. As the maintainer, I want the Settings header's back pill to return me where
   I came from, so that opening Settings is not a dead end.
4. As the maintainer, I want the browse home to lead to no maintainer surface,
   so that my parents never land on a form by accident — every maintainer
   screen is behind the gear.
5. As the maintainer, I want "Edit details" on the movie detail page to open
   this same form pre-filled, so that the menu item that already exists starts
   doing what it says.

**Adding a movie — the metadata**

6. As the maintainer, I want a Title field, so that the movie has the one thing
   it cannot exist without.
7. As the maintainer, I want a Year field beside it, so that the card and the
   detail page show when the film is from.
8. As the maintainer, I want the Year field to accept digits only and stop at
   four, so that it cannot hold something that is not a year.
9. As the maintainer, I want a Director field, so that the detail page's credits
   line has something to show.
10. As the maintainer, I want a Cast field where I separate names with commas,
    so that I can type a cast list the way I would write one.
11. As the maintainer, I want the comma-separated cast to arrive as a real list,
    so that the detail page renders names rather than one long string.
12. As the maintainer, I want a multi-line Description field, so that a synopsis
    longer than one line is not typed into a single-line box.
13. As the maintainer, I want the whole 12-genre pool offered as chips —
    including genres no movie is tagged with yet — so that I can file a film
    under Documentary before there is a Documentary row.
14. As the maintainer, I want to pick more than one genre, so that a film that is
    both a Thriller and Sci-Fi is tagged as both.
15. As the maintainer, I want a selected chip to look selected, so that I can see
    at a glance what I have picked.
16. As the maintainer, I want to click a selected chip to unpick it, so that a
    mis-click is one more click to undo.
17. As the maintainer, I want a five-star rating picker with half stars, so that
    I can score a film as I add it rather than going back to the detail page.
18. As the maintainer, I want to leave a movie Unrated, so that "I haven't
    decided" is a state the form can express.
19. As the maintainer, I want clicking the star segment that already holds the
    current value to clear the rating back to Unrated, so that a rating is
    removable the same way it is anywhere else in the app.

**Adding a movie — the files**

20. As the maintainer, I want to choose a video file from my own disk, so that
    the movie has something to play.
21. As the maintainer, I want the video picker to offer `.mkv` and `.avi` as well
    as the browser's video types, so that most of my folder is selectable at all.
22. As the maintainer, I want an unplayable container accepted rather than
    refused, so that adding an MKV this machine cannot decode still gets the
    movie into the library — the player already has a designed answer for that.
23. As the maintainer, I want to choose a poster image, so that the card is
    artwork rather than a coloured gradient.
24. As the maintainer, I want to add subtitle files, so that the family can read
    a film in a language they don't speak.
25. As the maintainer, I want to add more than one subtitle file, so that a film
    can carry English and Portuguese tracks.
26. As the maintainer, I want each subtitle row to carry a language I choose from
    a list, so that the player's track menu reads "Portuguese" rather than a
    filename.
27. As the maintainer, I want a picked subtitle to default to English, so that
    the common case needs no extra click.
28. As the maintainer, I want the subtitle picker to offer `.srt`, `.vtt`, `.ass`
    and `.sub`, so that whichever format that folder happens to hold is pickable.
29. As the maintainer, I want to see the filename of each file I have chosen, so
    that I can tell I picked the right one before saving.
30. As the maintainer, I want to remove a file I picked by mistake, so that the
    slot goes back to empty rather than being stuck with the wrong file.
31. As the maintainer, I want only one subtitle language menu open at a time, so
    that a column of rows doesn't become a column of open dropdowns.
32. As the maintainer, I want an empty slot to read "＋ Choose video file", so
    that it is obvious the slot is a button and obvious what it wants.

**Saving**

33. As the maintainer, I want Save disabled until there is a title and a video,
    so that I cannot create a row the database will reject.
34. As the maintainer, I want the button to say "Add to library" when adding, so
    that the action names what it does.
35. As the maintainer, I want the button to read "Adding…" and go disabled while
    the copy runs, so that I don't press it twice on a 12 GB file.
36. As the maintainer, I want one request per save, so that abandoning the form
    halfway leaves no half-added movie and no orphaned upload anywhere.
37. As the maintainer, I want a save that fails to leave nothing behind, so that
    a failed add doesn't silently consume disk.
38. As the maintainer, I want to land on the browse home after adding, so that I
    can see the movie I just added.
39. As the maintainer, I want the movie to appear in its genre rows immediately,
    so that I don't have to reload to know it worked.
40. As the maintainer, I want the added movie to play, so that adding a film and
    watching it are the same library.
41. As the maintainer, I want its poster to render on the card and its backdrop
    to fall back to the gradient, so that a movie with no backdrop still looks
    finished.
42. As the maintainer, I want its subtitle cues to load in the player, so that a
    track I attached is a track the family can turn on.
43. As the maintainer, I want the runtime derived from the file after the copy,
    so that an added movie shows a duration like every seeded one.
44. As the maintainer, I want the runtime to be absent rather than wrong when
    nothing on this machine can read it, so that a missing duration is a dash
    rather than a lie.
45. As the maintainer, I want Cancel and the back pill to do the same thing, so
    that there are not two ways out that behave differently.

**Editing**

46. As the maintainer, I want every field pre-filled from the stored record, so
    that editing one field doesn't mean retyping the rest.
47. As the maintainer, I want the heading to read "Edit details" and the button
    "Save changes", so that I can tell which of the two jobs the screen is doing.
48. As the maintainer, I want to land back on the movie's detail page after
    saving an edit, so that I can see the change I just made in context.
49. As the maintainer, I want an edit that touches only the title to carry no
    bytes at all, so that correcting a typo is instant on a 12 GB film.
50. As the maintainer, I want the existing video to satisfy the save gate, so
    that editing a movie doesn't demand I re-pick a file I already stored.
51. As the maintainer, I want the movie's stored files listed by filename, so
    that I can see what is already attached before I change it.
52. As the maintainer, I want to replace a stored file with a new one, so that a
    bad poster or a wrong subtitle is fixable.
53. As the maintainer, I want a replaced file's old bytes removed once the save
    commits, so that replacing a 12 GB video doesn't leave 12 GB stranded on disk.
54. As the maintainer, I want a failed cleanup not to fail my save, so that an
    undeletable old file doesn't lose the edit I just made.
55. As the maintainer, I want to remove a stored subtitle, so that a track I
    attached in error can be detached.
56. As the maintainer, I want renaming a movie to leave its folder alone, so that
    an edit never moves gigabytes around.
57. As the maintainer, I want editing an unknown id to answer cleanly, so that a
    stale link doesn't produce a mystery.
58. As the maintainer, I want to clear a rating during an edit, so that Unrated
    is reachable from the form and not only from the detail page.

**Edge cases and empty states**

59. As the maintainer, I want two movies with the same title and year to get
    separate folders, so that the second one cannot overwrite the first one's
    files.
60. As the maintainer, I want a filename with slashes or dots in it sanitised
    server-side, so that a crafted name cannot write outside the movie's folder.
61. As the maintainer, I want a title made entirely of punctuation to still
    produce a usable folder name, so that a film called "!!!" can be added.
62. As the maintainer, I want a title with accents to produce a readable folder,
    so that the managed directory stays browsable by hand.
63. As the maintainer, I want a movie with no poster to be addable, so that a
    film I have no artwork for still gets into the library.
64. As the maintainer, I want a movie with no subtitles to be addable, so that a
    film in my own language needs no ceremony.
65. As the maintainer, I want a movie with no genres to be addable, so that I can
    file it later.
66. As the maintainer, I want a broken genre-pool request to leave me with a form
    I can still save, so that one failed fetch doesn't block adding a movie.
67. As the maintainer, I want the form to work in the browser under `npm run dev`,
    so that this feature can be checked by looking, like the nine before it, with
    no Electron shell in existence.

## Implementation Decisions

### Scope

**In:** Add + Edit, one form, one URL (`/add`, `?movie=<id>` for edit); the
Settings page header that reaches it; `server/src/media/` built for the first
time; three new routes; four new frontend units at the primitive/molecule rungs.
This ticks 🔜 **Add a movie** and half of 🔜 **Edit / delete a movie**.

**Out, by argument rather than by deferral:**

- **Delete.** No confirmation surface is designed anywhere in `docs/handoff/`,
  and `EditMenu`'s own docblock already declined to ship a red row that does
  nothing. It arrives with the surface that confirms it.
- **The import context.** The prototype's `inImportContext` banner,
  `resolveLabel`, and the "Save & continue" / "Skip this one" labels belong to
  bulk import resolving a flagged row. Nothing in the app can navigate into that
  mode, so building it now is the same dead UI the Delete row would be. It
  arrives with `import-export`, the only feature that can reach it.
- **Folder-path autofill.** The prototype has no mode tabs and no path field, and
  README's own feature table already agrees — "Add a movie — manual file picker".
  The prototype is the spec, so manual pickers only. **CLAUDE.md's "Movie Import
  — Two Paths, One Form" section and README's "Adding a movie" are amended as
  part of this initiative.** Folder scanning survives where it is actually
  designed: `ImportFlow`'s root-path field, in bulk import.
- **TMDB.** Design log 01's case for TMDB was "hand-entry is infeasible", which
  is a claim about 12 TB of back catalogue, not about adding one film. The
  prototype types every metadata field by hand and picks the poster as a file. A
  hand-added movie has `tmdbId = null`, its rating is set by the maintainer or is
  **Unrated**, and its poster is a copied file rather than a download. TMDB's
  argument lives entirely in bulk import and stays there.
- **The Settings shell's grouped sections**, a backdrop field (`backdropPath`
  stays null and `MoviePage` falls back to the gradient — the prototype's own
  answer), a snackbar (the system is 🔜 and this flow raises none), and
  Electron's native file dialog.

### Managed copy, settled — and the reversal is itself reversed

`01-library-core.md` Q17 chose **Reference in place** over CLAUDE.md's managed
copy on a 12-TB-no-duplication argument. That is superseded, by code rather than
by opinion: `mediaFilePath` resolves a stored path against `FAMILYFLIX_MEDIA_PATH`
and answers `null` for anything absolute or outside the root — including a
symlink out, deliberately. `/api/images` is `express.static(mediaPath)`. The seed
writes `<slug>/<slug>.mp4` under the same root. **Every byte the app can
currently deliver already comes from managed storage**, and Q17 predates the
playback domain that made under-root a security boundary. The ubiquitous
language's **Reference in place** entry is retired.

### A browser cannot tell us where a file is

`<input type="file">` yields a `File` — a name and bytes, never a path. The
prototype's `pickVideo(){ this.setState({fVideo:'selected-video.mp4'}) }` is
exactly the simulation CLAUDE.md's "never port the simulation" rule warns about,
and there is no Electron shell (`electron/.gitkeep`) to replace it with a native
dialog.

So: **a real `<input type="file">`, and the bytes are uploaded.** This constraint
settles the storage question as much as the storage question settles it — a
reference-in-place design _requires_ Electron. Uploading works today under
`npm run dev`, which is how all nine previous features were checked by looking;
it matches `mediaFilePath`'s contract with zero change to any read route; and it
still works **inside** Electron unchanged. When the shell lands it can _add_ a
native dialog that hands the server a local path to copy with no HTTP body — an
optimisation behind the same `FileField`, not a redesign.

### Where the bytes land

`<mediaRoot>/<title-year-slug>/<safe original filename>` — matching the seed's
own `<slug>/<slug>.mp4` and the family's one-folder-per-movie convention.
Collisions take a `-2`, `-3` suffix. An **edit reuses the existing folder** (the
dirname of the current `videoPath`), so renaming a movie never moves files and
the managed directory's names are allowed to drift from the library's. Filenames
are sanitised server-side; a client-supplied name is never trusted into a path.

### One multipart request per save

`POST /api/movies` and `PATCH /api/movies/:id` are multipart, parsed with
**`busboy`** streaming each part straight to disk. One atomic action, no draft
ids, no staging area, no abandoned-upload sweeping — and an edit that touches
only the title carries no bytes at all, because unchanged files travel as their
existing relative path while changed ones travel as a file part. On any failure
the files that request wrote are removed. Upload-on-pick was considered and
declined: two round trips and a draft lifecycle, for a form filled in thirty
seconds.

`busboy` is a **new production dependency** (with `@types/busboy`) — the first
one this project has added since the initial scaffold. A 12 GB file never sits in
memory, which is the whole reason it is not `express.json()` with a base64 body
or `multer`'s buffer default.

### Backend — `server/src/media/`, the domain finally built

Three units, following the one-folder-per-unit rule:

- `movieFolder(title, year)` — **pure**: a title and a year to a slug.
- `safeFilename(name)` — **pure**: a client-supplied name to something that
  cannot contain a separator, cannot be dots-only, and cannot escape a folder.
- `createMedia(mediaPath)` — the injected seam, returning a `Media`:
  - `reserveFolder(title, year)` — reserve `<mediaRoot>/<slug>/`, suffixing on
    collision; returns the folder.
  - `storeUpload(folder, filename, source)` — stream one part to
    `<folder>/<safe name>`; returns the **relative** path.
  - `removeFolder(folder)` — remove a folder, or the files one request wrote:
    rollback and cleanup.
  - `removeFile(storedPath)` — remove one superseded file after a commit;
    swallows its own failure, because a file that will not delete must not lose
    an edit that already succeeded.

`movieFolder` and `safeFilename` are the two riskiest pieces in the feature and
both are pure functions, which makes the dangerous logic the cheap logic to test.

The domain is **injected into the router the way `playback` already is**:
`createApiRouter(storage, mediaPath, playback, media)`. The route layer never
learns there is a filesystem. `mediaPath` stays alongside it — the stream,
playback and cue routes still resolve stored paths through `mediaFilePath`.

### Orphaned bytes on replace

When an edit replaces a **Stored file** with a **Picked file**, the old file is
deleted **after the row commits**, never before: the new bytes are written, the
patch is applied, and only a successful commit authorises the unlink. A failed
unlink is swallowed — the save still succeeded, and losing an edit because a file
was locked would be the wrong trade. This is the only place in the app that
deletes media, and it deletes exactly one file at a time.

### The genre pool needs its own read

The form needs all **12** seeded genres including the empty ones.
`GET /api/genres` returns only _populated_ genres with counts, because it exists
to draw a filter dropdown — a different question with a different answer. So:
`storage.listGenrePool(): Genre[]` and `GET /api/genres/pool`. Not a hardcoded
frontend list: migration #1's `GENRE_POOL` is the source of truth and stays it.
The **Genre pool** and the **Genre list** are now two named terms that must not
be confused.

### Routes

- `GET /api/genres/pool` → `{ genres: Genre[] }` — the 12, in migration order.
- `POST /api/movies` — multipart; fields, then file parts; → `201` + `Movie`.
- `PATCH /api/movies/:id` — multipart; unchanged files travel as their existing
  relative path; → `200` + `Movie`, and a JSON `404` carrying
  `Unknown movie: <id>` for an unknown id, through the same `movieOr404` helper
  the five existing single-movie routes already share.

These are the **first non-single-signal writes in the app**. `writeSignal` does
not apply and is not stretched to fit: it exists for `{ value }` in, `{ value }`
out, and a multipart write of a whole record is a different shape.

### Server re-checks everything the client claimed

Accept types are a convenience on the picker, never a guarantee: video is
`video/*,.mkv,.avi` (Chromium gives MKV and AVI no MIME type at all), poster is
`image/*`, subtitles are `.srt,.vtt,.ass,.sub` — the same four `parseSubtitle/`
dispatches on. The server re-checks by extension and trusts no client-supplied
value into a path. An **unplayable container is not rejected**: `cannot-play` is
a designed `PlayerNotice` state, and refusing MKV at the door would refuse most
of the family folder.

### Runtime, derived

The form has no runtime field, so an added movie would render "—" where every
seeded one shows a duration. It is **derived best-effort after the copy**:
`playback/mediaDuration/` reads an MP4's own `moov`/`mvhd` with no component at
all, and `playback/probe/` covers the rest when FFmpeg is present. `null` when
neither can answer. No invented UI, one shipped domain reused, and a machine with
no FFmpeg still gets durations for the format most of the library is in.

### Progress

CLAUDE.md says a large-file add "needs a visible progress indicator, not a
spinner" — but **the prototype designs no progress surface on this form**;
`saveMovie()` just navigates. Inventing one is redesigning. The answer is the
Save button's `disabled` state, which `prim.Button` already declares, with the
label reading "Adding…" while the copy runs. Progress lives where the prototype
actually designed it: `ImportFlow`'s `ProgressBar` + `LogConsole`, in bulk
import — where the operation is minutes long and cancellable, which is what
earns a progress surface.

### Validation is a gate, not a message

The prototype validates nothing, but `title` and `videoPath` are `NOT NULL`. So
**Save is `disabled` until there is a title and a video** (on edit, the existing
video counts) — a gate built from a prop the prototype already has, so no error
UI is invented and the only "invalid" state the form can reach is one where Save
cannot be pressed. Year accepts digits only, capped at 4, so it cannot be
invalid. Cast splits on commas, trimming empties. Rating is held as the 0–100
percent `RatingPicker` speaks and converted at the boundary by the shipped
`toRatingUnits`.

### Frontend units

**Primitives.** `Textarea/` (new, from `prim.Textarea`); `VideoIcon`,
`ImageIcon`, `FileIcon` under `Icon/` per COMPONENT-SPEC §3a. `TextField` grows
the two props its own prototype declared and its styles file already explains the
absence of — `height` and `rounded`, whose "non-default values arrive with
MovieForm and ImportFlow". MovieForm is that caller. One deliberate deviation:
the field's non-pill radius becomes `radius.md` (12) rather than the prototype's
inline `10px`, because COMPONENT-SPEC §1 says every visual value is a token and
10 is not one.

**Molecules.** `FileField/` owns a visually-hidden `<input type="file">` behind
its `<label>` and reports `onPick(file: File)`; its `icon` is a `ReactNode`, not
a name to switch on — COMPONENT-SPEC §3a names FileField specifically ("pass the
component, don't switch on a string") and `TextField` set the precedent. Opening
a picker is UI; it never learns what a movie is. `SubtitleRow/` is **built on
`Menu`** rather than keeping the prototype's local `open` state, for exactly the
reason `FilterDropdown` gave: `Menu` already owns Escape, press-outside,
select-to-close and focus return, and taking it means only one dropdown can be
open at a time for free, with no coordinating state.

`✕` and `＋` stay literal glyphs rather than becoming icon atoms, following
`MenuItem`'s `glyph="✎"` precedent.

**Genre chips** are `prim.Chip` verbatim. Its `md` face is already `9px 16px` /
pill / accent-soft-when-selected — a pixel match — and its docblock says it was
built for this: "a real `<button>` carrying `aria-pressed`, which is what
MovieForm's genre picker needs." Built for this, unused until now.

**The feature** follows the player's shape — the organism owns the hooks,
siblings each draw one thing: `MovieForm/` (the organism), `MovieFormFiles/`
(the Files card), `GenrePicker/` (the chip row), `useMovieForm/` (values, dirty
files, save, navigation), `useGenrePool/` (loads the 12; precedent:
`search/useGenreList`), `formValues/` (pure: `Movie` → `MovieFormValues` →
`FormData`), `castNames/` (pure: `"Jane Doe, John Roe"` ↔ `string[]`), and
`api/` (`createMovie`, `updateMovie`, `fetchGenrePool`).

None of the three api calls has a second caller, so all three stay with the
feature — the same rule that kept `saveRating` and `saveResume` where they are.

### Types

A new `src/types/form.ts`, re-exported from `types/index.ts`, carrying the three
shapes the form reasons about: `MovieFormFile` (a discriminated union of
`stored` — a path and a filename — and `picked` — a `File` and a filename;
those two states plus empty are the whole of what a save has to reason about),
`MovieFormSubtitle` (a stable `key` for re-orders and removals, distinct from the
persisted subtitle id), and `MovieFormValues`.

### Docs amended as part of this work

CLAUDE.md's "Movie Import — Two Paths, One Form" section (folder-path autofill
moves to bulk import); README's "Adding a movie"; and the ubiquitous language,
whose **Reference in place** entry is retired and whose **Movie form** section is
already written.

## Testing Decisions

A good test asserts **external behaviour** — what a URL answers, what the screen
shows, what got written — and never how it was reached. The precedent is
`server/src/routes/routes.test.ts`, whose header states the rule outright: the
seam is the endpoint rather than the handler function, over a real listener on an
ephemeral port and a real fully-migrated `:memory:` database, because what a
slice promises a caller is a URL, a status and a body shape.

**All four groups get tests.**

**Server pure units + the Media seam.** `movieFolder` and `safeFilename` are
pure and carry the dangerous logic: a title of pure punctuation, an accented
title, a title and year that collide with an existing folder, a filename
containing `..` and separators, a dots-only filename, a filename that is only an
extension. `createMedia` is tested against a real sandbox directory using the
existing `sandboxRoot` test-support unit — `reserveFolder` suffixing on
collision, `storeUpload` returning a **relative** path and writing the bytes,
`removeFolder` rolling back what one request wrote, `removeFile` swallowing a
failure. The assertion that matters most: **every path `storeUpload` returns
resolves through `mediaFilePath` to the file that was written**, which is the
contract every read route depends on.

**The routes**, through `createApiRouter` the way `routes.test.ts` already does:
a real listener, real multipart bodies, real SQLite. `POST /api/movies` with
fields only → 201 and a `Movie`; with a video part → the bytes on disk under the
media root and a relative `videoPath`; with poster and two subtitle parts → the
subtitle order and languages persisted; a crafted filename → written inside the
folder and nowhere else; a failing write → nothing left behind.
`PATCH /api/movies/:id` → a title-only edit carrying no parts and moving no
bytes; a replaced poster → new file present, **old file gone**, row pointing at
the new one; an unknown id → JSON 404 with `Unknown movie: <id>`.
`GET /api/genres/pool` → all 12 including the empty ones, distinct from
`/api/genres`.

**Primitives and molecules**, rendered, in the existing co-located style:
`Textarea`; `TextField`'s new `height` and `rounded` at their defaults and their
non-defaults; `FileField` in both states — the dashed choose button when empty,
the filename row and its ✕ when filled — and that picking a file reports the
`File` and removing clears the slot; `SubtitleRow` selecting a language through
`Menu`, closing on select, and reporting the removal. The `Menu`-based dropdown
inherits its dismissal tests from `Menu` itself and does not re-test them.

**Feature units.** `castNames` and `formValues` are pure and get the same
treatment `src/utils/` helpers get — CLAUDE.md already requires a test per
helper. `formValues` carries the round trip that makes editing correct: a
`Movie` in, a `MovieFormValues` out, a `FormData` out of that, with stored files
travelling as paths and picked files as parts, and an unrated movie surviving as
`null` rather than becoming `0`. `useMovieForm` is tested for the **save gate**
(disabled until a title and a video; an existing video satisfying it on edit),
the in-flight disable, and the two navigation destinations. `useGenrePool`'s
failure arm resolves to an empty pool rather than throwing, following
`useGenreList`'s recorded precedent — a broken endpoint must still leave a
saveable form. `MovieForm` gets the composition test: fill it, save it, and
assert the request that went out.

No new `test-support/` unit is anticipated; `sandboxRoot`, `freshStorage` and
`newMovie` already cover what the server side needs.

## Out of Scope

- **Delete a movie**, and the media cleanup that belongs with it — no
  confirmation surface exists in the prototype.
- **The import context** — the banner, `resolveLabel`, and the
  "Save & continue" / "Skip this one" labels. Ships with `import-export`, the
  only feature that can navigate into it.
- **Folder-path autofill** and **TMDB lookup** — both belong to bulk import,
  where their arguments actually live.
- **The Settings shell's grouped sections** (Library / Playback / Storage /
  About) — only the header ships here.
- **A backdrop field** — `backdropPath` stays null and `MoviePage` falls back to
  the gradient.
- **A progress bar on this form** — the prototype designs none; progress ships
  with `ImportFlow`.
- **A snackbar** — the system is 🔜 and this flow raises none.
- **Electron's native file dialog** — an optimisation behind the same
  `FileField` once the shell exists, not a redesign.

## Further Notes

**Trade-off accepted.** Adding a movie now **copies** it, which for a 12 TB
library means real duplication and real minutes per film — the exact cost design
log 01 Q17 was trying to avoid. It is accepted because the alternative is a
feature that cannot exist until Electron does, and because every read route in
the app already assumes it. Abandoning a save mid-upload wastes the bytes already
written (they are removed, but the time is gone).

**Phasing.** Six slices, each of which can be checked by looking:

1. **The thinnest end-to-end slice: a movie with no files.**
   `POST /api/movies` (JSON only, no multipart yet) → `storage.addMovie`;
   `GET /api/genres/pool`; a bare `MovieForm` with title + year + genre chips +
   Save. A movie typed into the form appears on the browse home.
2. **The form, 1:1.** Director, cast, description, `Textarea`, `RatingPicker`,
   `TextField`'s `height`/`rounded`, the heading, the actions row, and the
   Settings header that reaches it. Every field except the Files card.
3. **The `media/` domain + the video.** `movieFolder`, `safeFilename`,
   `createMedia`, `busboy`; `FileField` and the video slot; the multipart POST.
   An uploaded MP4 plays through the existing stream route.
4. **Poster and subtitles.** The poster slot, `SubtitleRow` on `Menu`, the
   language pool, "＋ Add subtitle file". An added movie shows its own artwork
   and its cues load in the player.
5. **Edit.** `?movie=<id>`, `formValues` prefill, `PATCH /api/movies/:id`,
   unchanged-file passthrough, superseded-file cleanup, the label and
   destination flips.
6. **Runtime.** Derive `runtimeMinutes` from `mediaDuration` / `probe` after the
   copy, best-effort.

**What this unblocks.** The dev seed exists because the library had no other way
to be filled; CLAUDE.md says "the commit that ships bulk import is the commit
that deletes it". This feature is the first half of that — after it, the seed is
a convenience rather than the only door.

**What it hands to bulk import.** `createMedia`, `movieFolder` and
`safeFilename` are exactly what the importer needs to copy matched media into
managed storage, and `POST /api/movies` is the write it drives. The importer
adds the spreadsheet, the folder matching and the review step — not a second
copy path.
