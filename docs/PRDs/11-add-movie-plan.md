# Plan: Movie form — add and edit a movie by hand

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/97

This is the first initiative that writes a **record** rather than a signal.
Every write route the app has is a `{ value }` POST against a movie that already
exists — `favorite`, `watched`, `rating`, `resume`, all four through
`writeSignal`. `addMovie`, `updateMovie` and `deleteMovie` have been built,
transactional and tested since issue #3, and no URL has ever reached any of
them. It is also the first initiative in which the app **receives** bytes: the
player made bytes move outward, and `server/src/media/` — which CLAUDE.md's
folder map has described since day one — is still an empty `.gitkeep`.

The slicing follows what a movie is made of, in the order the database demands
it: **a row** (Phase 1) → **the whole of the form around it** (Phase 2) → **the
bytes it points at** (Phase 3) → **the bytes beside those** (Phase 4) → **the
same screen doing the other job** (Phase 5) → **the one field nothing on the
form asks for** (Phase 6) → **the docs say why** (Phase 7).

Every phase is checked by looking: open Settings, press ＋ Add a movie, fill it
in, save, and see the film on the browse home. From Phase 1 onward that sentence
is true, and each later phase makes more of the film real.

## Three ordering calls, named up front

- **The Settings header rides in Phase 1, not Phase 2.** The PRD groups it with
  the rest of the form's chrome, but it is four static elements — a back pill, a
  serif `Settings`, the accent ＋ button, and the "Manage your library,
  playback, and storage." line — and without it Phase 1 is reached by typing
  `/add` into the URL bar. The point of a tracer bullet is that it is the _real_
  path through every layer, and the real path starts at the gear. Stories 1–4
  move with it.

- **`POST /api/movies` is multipart from Phase 1**, parsed with `busboy`, with
  no file parts until Phase 3. The PRD's Phase 1 is JSON and its Phase 3
  replaces the body shape — which would mean writing Phase 1's route tests
  against a wire contract already scheduled for demolition. Parsing a
  fields-only multipart body is the same handler shape as parsing one with
  parts, so the contract is settled once and the tests written against it
  survive. The cost is one production dependency arriving two phases earlier
  than strictly needed; `server/src/media/` still lands in Phase 3, and the
  route learns nothing about the filesystem until it does.

- **Runtime stays its own phase.** Phase 3 is already the thickest slice in the
  initiative — a new server domain, a new dependency, a new molecule, the
  multipart write and its rollback. Deriving `runtimeMinutes` is one best-effort
  call against a domain that already ships, and it is a distinct thing to look
  at: a duration where a dash was.

## Two intermediate states worth naming

- **Through Phases 1 and 2 a movie is added with no video at all.**
  `video_path` is `NOT NULL`, so the row carries `''` — and that is not a
  fiction the plan has to hide. `mediaFilePath` resolves `''` to the media root
  itself, fails its own `file === root` containment test, and answers `null`, so
  `/playback` and `/stream` both give the JSON 404 they already give a missing
  file, and the player draws the **missing-file** `PlayerNotice` it already
  draws. A movie added in Phase 1 is a real library row that browses, sorts,
  searches, favourites and rates correctly, and says it has no film behind it.
  Phase 3 is where it gets one.

- **The save gate arrives in halves.** Story 33 is "a title _and_ a video", but
  a video cannot gate a form with no video slot. The title half ships in Phase 1
  — Save is disabled until a title exists — and Phase 3 adds the video half to
  the same gate, once the slot that can satisfy it exists. `useMovieForm` owns
  the gate from Phase 1 so there is one place for the second half to land.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** One read and two writes, all under the existing `/api` router:

  ```
  GET   /api/genres/pool   -> { genres: Genre[] }   the 12, in migration order
  POST  /api/movies        -> 201 + Movie           multipart
  PATCH /api/movies/:id    -> 200 + Movie           multipart
  ```

  The two writes are the **first non-single-signal writes in the app**.
  `writeSignal` is not stretched to cover them: it exists for `{ value }` in and
  `{ value }` out. `movieOr404` _is_ reused — `PATCH` answers an unknown id with
  the same JSON `404` carrying `Unknown movie: <id>` that the five existing
  single-movie routes share.

- **One request per save.** No draft ids, no staging area, no upload-on-pick.
  Fields first, then file parts, streamed straight to disk by `busboy` so a
  12 GB file never sits in memory. On any failure, the files that request wrote
  are removed. An edit that changes only the title carries no parts at all —
  unchanged files travel as their existing relative path.

- **Where bytes land.** `<mediaRoot>/<title-year-slug>/<safe original filename>`,
  matching the seed's `<slug>/<slug>.mp4` and the family's one-folder-per-movie
  convention. Collisions take `-2`, `-3`. An **edit reuses the existing folder**
  (the dirname of the current `videoPath`), so renaming a movie never moves
  gigabytes and the managed directory's names are allowed to drift from the
  library's. Filenames are sanitised server-side; a client-supplied name is
  never trusted into a path.

- **Every stored path is relative, under the managed media root.** This is why
  no read route changes anywhere in this initiative: `/stream`, `/playback`, the
  cue route and `/api/images` all already enforce exactly that rule, through
  `mediaFilePath` and `express.static(mediaPath)`.

- **The `media/` domain is injected, the way `playback` is.**
  `createApiRouter(storage, mediaPath, playback, media)`. The route layer never
  learns there is a filesystem. Four units under `server/src/media/`, one folder
  each: `movieFolder` (pure), `safeFilename` (pure), `createMedia` (the seam),
  and the `Media` it returns — `reserveFolder`, `storeUpload`, `removeFolder`,
  `removeFile`.

- **Schema: unchanged.** Not one migration. Every column this feature writes has
  existed since V1, including the `subtitles` table with its `language` and
  `position`. `listGenrePool` is a new read against the `genres` table
  migration #1 already populates with all 12 names.

- **Key models.** `Genre` and `Movie` are the shipped ones. New on the frontend:
  `src/types/form.ts` — `MovieFormFile` (a discriminated union of `stored`, a
  path and a filename, and `picked`, a `File` and a filename), `MovieFormSubtitle`
  (a stable `key` for re-orders and removals, distinct from the persisted
  subtitle id) and `MovieFormValues` — re-exported through `types/index.ts`.

- **The Genre pool is not the Genre list.** `GET /api/genres` returns populated
  genres with counts, because it exists to draw a filter dropdown. The form
  needs all 12 including the empty ones, so `GET /api/genres/pool` is a second
  read of a different question. Migration #1's `GENRE_POOL` stays the single
  source of truth; nothing is hardcoded in the frontend.

- **One URL for two jobs.** `/add`, with `?movie=<id>` for edit. There is no
  `/edit` route — COMPONENT-SPEC §6's `editMovie()` reuses this screen, and the
  detail page's **Edit details** already links here. The heading, the button
  label and the post-save destination are the only things that differ.

- **Feature shape follows the player's.** The organism owns the hooks; siblings
  each draw one thing. `MovieForm/`, `MovieFormFiles/`, `GenrePicker/`,
  `useMovieForm/`, `useGenrePool/`, `formValues/`, `castNames/`, `api/`. None of
  the three api calls gets a second caller in this initiative, so all three stay
  with the feature — the same rule that kept `saveRating` and `saveResume` where
  they are.

- **Tests assert external behaviour.** Server-side the seam is the endpoint, per
  `routes.test.ts`'s own header: a real listener on an ephemeral port, a real
  fully-migrated `:memory:` database, real multipart bodies. `createMedia` is
  tested against a real sandbox directory through the existing `sandboxRoot`. No
  new `test-support/` unit is anticipated on either side.

---

## Phase 1: A movie typed into a form appears on the home screen

**User stories**: 1, 2, 3, 4, 6, 7, 8, 13, 14, 15, 16, 34, 35, 38, 39, 65, 66, 67

### What to build

The thinnest complete path from a keystroke to a poster card: a Settings screen
with a real header, an accent ＋ button on it, a form behind that button holding
a title, a year and the genre chips, and a Save that writes a row the browse
home renders.

`storage.listGenrePool()` joins the repository interface and
`GET /api/genres/pool` exposes it — all 12 genres in migration order, including
the ones no movie is tagged with, which is what makes filing a film under
Documentary before a Documentary row exists possible at all.

`POST /api/movies` is the first write of a whole record. It is **multipart from
this phase**, parsed with `busboy` (a new production dependency, with
`@types/busboy`), reading fields only — no part handling yet. It assembles a
`NewMovie` and calls the `addMovie` that has been waiting since issue #3.
`videoPath` is `''`, which the database accepts and the player reads as a
missing file.

The Settings page gains its header and nothing below it — back pill, serif
`Settings`, the accent ＋ Add a movie button, the "Manage your library,
playback, and storage." line. The grouped Library / Playback / Storage / About
sections stay with the settings-shell initiative. `AddMoviePage`'s stub body is
replaced with the feature; its docblock's "provisional" note about `?movie=`
survives one more phase and is settled in Phase 5.

The form itself is `MovieForm/` with `useMovieForm/` behind it, `GenrePicker/`
drawing `prim.Chip` verbatim — its `md` face is already `9px 16px`, pill,
accent-soft-when-selected, a pixel match, and its docblock says it was built for
this — and `useGenrePool/` loading the 12. `useGenrePool`'s failure arm resolves
to an empty pool rather than throwing, following `useGenreList`'s recorded
precedent: a broken endpoint must still leave a form that saves.

Save reads "Add to library", is disabled until there is a title, reads "Adding…"
and is disabled while the request is in flight, and lands on the browse home.

### Acceptance criteria

- [ ] `GET /api/genres/pool` returns all 12 genres in migration order, including
      genres no movie is tagged with, and is observably a different answer from
      `GET /api/genres`
- [ ] `POST /api/movies` accepts a fields-only multipart body and answers `201`
      with a full `Movie`
- [ ] A movie posted with a title, a year and two genres reads back through
      `GET /api/movies/:id` with both genres in the order they were sent
- [ ] A movie posted with no genres at all is created successfully
- [ ] The Settings screen renders the back pill, the serif `Settings` heading,
      the accent ＋ Add a movie button and the subtitle line, and nothing below
      them
- [ ] The back pill returns to where Settings was opened from
- [ ] The browse home offers no route to `/add` or `/settings` except the header
      gear
- [ ] ＋ Add a movie navigates to `/add` and the form renders there
- [ ] The genre chips offer all 12; clicking one selects it, clicking it again
      deselects it, and a selected chip is visually distinct
- [ ] Several genres can be selected at once
- [ ] The Year field accepts digits only and stops at four characters
- [ ] Save is disabled with an empty title and enabled once a title is typed
- [ ] Save reads "Add to library", and reads "Adding…" and is disabled while the
      request is in flight
- [ ] A successful save lands on the browse home, where the new movie appears in
      each of its genre rows with no reload
- [ ] A failing `GET /api/genres/pool` leaves a form with no chips that still
      saves
- [ ] The whole path works in the browser under `npm run dev`

---

## Phase 2: The form, 1:1

**User stories**: 9, 10, 11, 12, 17, 18, 19, 45

### What to build

Every remaining metadata field, matched to `feat.MovieForm.dc.html` pixel for
pixel: Director, a Cast field where names are separated by commas, a multi-line
Description, and the five-star half-step rating picker — plus the actions row
that Phase 1's lone Save button stands in for.

`prim.Textarea` arrives as a primitive, from the prototype's `prim.Textarea`.
`TextField` grows the two props its own prototype declared and whose absence its
styles file already explains — `height` and `rounded`, whose "non-default values
arrive with MovieForm and ImportFlow". MovieForm is that caller. One deliberate
deviation, recorded here and in the component: the non-pill radius becomes
`radius.md` (12) rather than the prototype's inline `10px`, because
COMPONENT-SPEC §1 says every visual value is a token and 10 is not one.

`castNames/` is the pure unit either side of the comma: a typed string to a
`string[]` with empties trimmed away, and back again for the edit prefill Phase 5
will need.

The rating is held as the 0–100 percent the shipped `RatingPicker` speaks and
converted at the boundary by the shipped `toRatingUnits`. **Unrated** is a state
the form can hold and send — `null`, never `0` — and clicking the star segment
that already holds the current value clears it back, the same gesture the detail
page already answers to.

Cancel and the back pill do the same thing, because there should not be two ways
out that behave differently.

### Acceptance criteria

- [ ] The form renders Director, Cast, Description, the rating picker and the
      actions row, matching the prototype's layout, spacing, copy and states
- [ ] `Textarea` exists as a primitive and Description is multi-line
- [ ] `TextField` accepts `height` and `rounded`, renders unchanged at their
      defaults, and honours both at their non-defaults
- [ ] `castNames` turns `"Jane Doe, John Roe"` into two names, trims whitespace,
      and drops empty entries from trailing or doubled commas
- [ ] A saved movie's cast reads back as a list of names, not one string
- [ ] The rating picker sets half stars and whole stars
- [ ] A movie saved with no rating touched persists as unrated, not as zero
- [ ] Clicking the segment holding the current rating clears it back to unrated
- [ ] Cancel and the back pill both leave the form the same way

---

## Phase 3: The `media/` domain, and a video that plays

**User stories**: 20, 21, 22, 29, 30, 32, 33, 36, 37, 40, 59, 60, 61, 62

### What to build

The phase that makes bytes arrive. `server/src/media/` is built for the first
time, and the movie added in Phase 1 stops being a row with nothing behind it.

Four units. `movieFolder(title, year)` and `safeFilename(name)` are **pure**,
and they carry the whole of the dangerous logic in this feature — a title of
pure punctuation, an accented title, a filename containing separators or `..`, a
filename that is only dots or only an extension. That the riskiest code is also
the cheapest to test is the reason they are shaped this way.
`createMedia(mediaPath)` is the injected seam returning a `Media`:
`reserveFolder` (suffixing on collision), `storeUpload` (one part streamed to
`<folder>/<safe name>`, returning a **relative** path), `removeFolder`
(rollback) and `removeFile` (Phase 5's cleanup, built here with the rest).

`POST /api/movies` starts handling file parts, streaming each straight to disk.
On any failure the files that request wrote are removed, so a failed add leaves
no row and no bytes. `createApiRouter` grows its fourth argument.

On the frontend, `FileField/` is the molecule that owns a visually-hidden
`<input type="file">` behind its `<label>` and reports `onPick(file: File)`. Its
`icon` is a `ReactNode`, not a name to switch on — COMPONENT-SPEC §3a names
FileField specifically, and `TextField` set the precedent. `VideoIcon` joins
`Icon/`. Opening a picker is UI; it never learns what a movie is.
`MovieFormFiles/` draws the Files card with the video slot in it, empty as
"＋ Choose video file" and filled as a filename row with a ✕.

The picker offers `video/*,.mkv,.avi`, because Chromium gives MKV and AVI no
MIME type at all. The server re-checks by extension and trusts no
client-supplied value into a path. **An unplayable container is accepted, not
refused** — `cannot-play` is a designed `PlayerNotice` state, and refusing MKV
at the door would refuse most of the family folder.

The save gate gets its second half here: a video is now required alongside the
title.

### Acceptance criteria

- [ ] `movieFolder` produces a usable slug for a title of pure punctuation, and
      a readable one for a title with accents
- [ ] `safeFilename` strips path separators, cannot produce a dots-only name,
      and cannot produce a name that escapes its folder
- [ ] `reserveFolder` suffixes `-2` when the folder for a title and year already
      exists, so two movies with the same title and year never share a folder
- [ ] `storeUpload` writes the bytes and returns a **relative** path
- [ ] Every path `storeUpload` returns resolves through `mediaFilePath` to the
      file that was written
- [ ] `removeFolder` removes what one request wrote
- [ ] `POST /api/movies` with a video part writes the file under the media root
      and stores a relative `videoPath`
- [ ] A crafted filename containing separators and `..` is written inside the
      movie's folder and nowhere else
- [ ] A save that fails partway leaves no row and no files behind
- [ ] The empty slot reads "＋ Choose video file"; a picked file shows its
      filename; the ✕ returns the slot to empty
- [ ] The video picker accepts `.mkv` and `.avi` as well as the browser's video
      types, and an `.mkv` is accepted by the server rather than rejected
- [ ] Save is disabled until there is both a title and a video
- [ ] A movie added with an MP4 plays in the player through the existing stream
      route, with no change to that route

---

## Phase 4: Poster and subtitles

**User stories**: 23, 24, 25, 26, 27, 28, 31, 41, 42, 63, 64

### What to build

The other two kinds of file, and the movie stops being a gradient.

The poster slot is a second `FileField` accepting `image/*`, with `ImageIcon`
beside it. A copied poster renders on the card and on the detail page through
`/api/images` with no change to that route, because the path stored is relative
under the media root — the one rule it already enforces. `backdropPath` stays
null and `MoviePage` falls back to the gradient, which is the prototype's own
answer.

Subtitles are a repeatable row. `SubtitleRow/` is **built on `Menu`** rather
than keeping the prototype's local `open` state, for exactly the reason
`FilterDropdown` gave: `Menu` already owns Escape, press-outside,
select-to-close and focus return — and taking it means only one language menu
can be open at a time for free, with no coordinating state. `FileIcon` joins
`Icon/`. "＋ Add subtitle file" appends a row; each row carries the filename, a
language chosen from a list, and a ✕. A picked subtitle defaults to **English**,
so the common case needs no extra click. The picker offers `.srt`, `.vtt`,
`.ass` and `.sub` — the same four `parseSubtitle/` dispatches on — and the
server re-checks by extension.

`✕` and `＋` stay literal glyphs rather than becoming icon atoms, following
`MenuItem`'s `glyph="✎"` precedent.

Subtitle order and language persist to the `subtitles` table's `position` and
`language` columns, and the cues load in the player through the cue route
unchanged.

### Acceptance criteria

- [ ] A poster picked in the form is copied under the media root and renders on
      the poster card and the detail page
- [ ] A movie added with no poster is created successfully and its card renders
      the gradient
- [ ] The detail page falls back to the gradient backdrop for an added movie
- [ ] "＋ Add subtitle file" adds a row; several subtitle files can be attached
- [ ] Each row's language is chosen from a list and defaults to English
- [ ] Opening one row's language menu closes any other, with no coordinating
      state in `SubtitleRow`
- [ ] `SubtitleRow` inherits Escape, press-outside and select-to-close from
      `Menu` and does not re-test them
- [ ] The subtitle picker accepts `.srt`, `.vtt`, `.ass` and `.sub`
- [ ] Two subtitles posted together persist with their languages and in the
      order they were sent
- [ ] A movie added with no subtitles is created successfully
- [ ] An attached subtitle's cues load and display in the player

---

## Phase 5: Edit

**User stories**: 5, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58

### What to build

The same screen doing the other job. `/add?movie=<id>` pre-fills every field
from the stored record, the heading reads "Edit details", the button reads "Save
changes", and a successful save lands back on the movie's detail page rather
than the browse home. The detail page's **Edit details** menu item starts doing
what it says, and `AddMoviePage`'s docblock stops calling the parameter
provisional.

`formValues/` is the pure unit carrying the round trip that makes editing
correct: a `Movie` in, a `MovieFormValues` out, a `FormData` out of that — with
**stored files travelling as their existing relative path** and picked files as
parts, and an unrated movie surviving as `null` rather than becoming `0`. That
passthrough is what makes an edit touching only the title carry no bytes at all,
which on a 12 GB film is the difference between instant and minutes. The
existing video satisfies the save gate, so editing does not demand re-picking a
file already stored.

`PATCH /api/movies/:id` is multipart on the same terms as the POST, and answers
an unknown id with the JSON `404` carrying `Unknown movie: <id>` through the
same `movieOr404` the five existing single-movie routes share. An edit **reuses
the existing folder** — the dirname of the current `videoPath` — so renaming a
movie never moves gigabytes.

Replacing a stored file writes the new bytes, applies the patch, and only a
**successful commit** authorises unlinking the old one. `removeFile` swallows
its own failure: losing an edit because a file was locked would be the wrong
trade. This is the only place in the app that deletes media, and it deletes
exactly one file at a time.

A stored subtitle can be removed, and a rating can be cleared to unrated from
the form.

### Acceptance criteria

- [ ] `/add?movie=<id>` pre-fills title, year, director, cast, description,
      genres and rating from the stored record
- [ ] The heading reads "Edit details" and the button reads "Save changes"
- [ ] The movie's stored files are listed by filename
- [ ] The existing video satisfies the save gate with no file re-picked
- [ ] A title-only edit sends no file parts and moves no bytes on disk
- [ ] A successful edit lands on the movie's detail page
- [ ] `formValues` round-trips a `Movie` through `MovieFormValues` to
      `FormData`, with stored files as paths and picked files as parts
- [ ] An unrated movie survives the round trip as unrated, not as zero
- [ ] A rating can be cleared to unrated from the form
- [ ] Replacing a poster leaves the new file present, the old file gone, and the
      row pointing at the new one
- [ ] A failed unlink of a superseded file does not fail the save
- [ ] A stored subtitle can be removed and is gone from the record
- [ ] Renaming a movie leaves its media folder untouched
- [ ] `PATCH /api/movies/:id` with an unknown id answers a JSON `404` carrying
      `Unknown movie: <id>`

---

## Phase 6: Runtime, derived

**User stories**: 43, 44

### What to build

The form has no runtime field and the prototype designs none, so an added movie
would render "—" where every seeded one shows a duration. It is derived
**best-effort after the copy**, from domains that already ship: `mediaDuration/`
reads an MP4's own `moov`/`mvhd` with no Playback component installed at all,
and `probe/` covers everything else when FFmpeg is present. `null` when neither
can answer — a dash rather than a lie.

No new UI, no new domain, and a machine with no FFmpeg still gets durations for
the format most of the library is in.

### Acceptance criteria

- [ ] A movie added with an MP4 shows a runtime on the card and the detail page
      with no Playback component installed
- [ ] A movie added with a container only FFmpeg can read shows a runtime when
      FFmpeg is present
- [ ] A movie whose duration nothing on the machine can read stores `null` and
      renders a dash, and the save still succeeds
- [ ] A failure to derive a duration never fails the add

---

## Phase 7: Docs and the filing

**User stories**: none directly — the documentation obligations the PRD records,
and the refactor issue every initiative since #79 has ended with.

### What to build

The three amendments the PRD commits to, made rather than promised:

- **CLAUDE.md's "Movie Import — Two Paths, One Form"** section. Folder-path
  autofill moves to bulk import, where the prototype actually designs it
  (`ImportFlow`'s root-path field). The form this initiative shipped has manual
  pickers only, no mode tabs and no path field — README's own feature table
  already said so.
- **README's "Adding a movie"**, to match.
- **The ubiquitous language.** **Reference in place** is retired:
  `01-library-core` Q17 chose it over managed copy on a 12-TB-no-duplication
  argument, and it has been superseded by code rather than by opinion —
  `mediaFilePath`, `/api/images` and the seed's own layout mean every byte the
  app can deliver already comes from managed storage. **Genre pool** and **Genre
  list** are entered as two terms that must not be confused.
- **The feature table**, per the recorded rule that a feature is ✅ only after
  its refactor: **Add a movie** and the added half of **Edit / delete a movie**
  are ticked when the refactor issue closes, not when Phase 6 does.
- **The dev journal**, and the design log entry cross-linked to this plan.

Then `request-refactor-plan` over everything Phases 1–6 shipped, filed as its
own issue. Follow-ups are listed by bare number, never with a closing keyword —
commit `0c51aaf` closed #39 by writing "fixed: #39" inside a sentence saying the
opposite.

### Acceptance criteria

- [ ] CLAUDE.md's "Movie Import — Two Paths, One Form" describes the shipped
      form, with folder-path autofill attributed to bulk import
- [ ] README's "Adding a movie" matches
- [ ] `docs/ubiquitous-language.md` retires **Reference in place** and carries
      **Genre pool** and **Genre list** as distinct terms
- [ ] The design log entry links to this plan and the issue
- [ ] A refactor issue is filed covering Phases 1–6
- [ ] No commit in the initiative carries a closing keyword for an issue it does
      not close
