# Plan: Delete a movie — the Danger row, the Delete dialog and the media cleanup

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/114

This is the first initiative that **removes** a record. Every write the app has
either creates one (`POST /api/movies`), amends one (`PATCH /api/movies/:id`) or
flips a signal on one (`favorite`, `watched`, `rating`, `resume`).
`LibraryStorage.deleteMovie` has been built, cascading and tested since
library-core, and the only caller it has ever had is the dev seed. It is also
the first time the app removes bytes it no longer has a row for — the form's
`removeFile` runs after a row has been _amended_; nothing has yet deleted a
folder for a row that is gone.

The slicing follows what the PRD's own phasing sketches, opened out from four
slices to five: **the spec** (Phase 1) → **the thinnest path from the ⋯ menu to
an empty shelf** (Phase 2) → **the bytes** (Phase 3) → **the dialog's ways out
and its focus** (Phase 4) → **the request's lifetime** (Phase 5).

Every phase from 2 onward is checked by looking: open a movie, press ⋯, press
🗑 Delete movie, confirm, and see the shelf without it. From Phase 2 that
sentence is true, and each later phase makes more of the delete right.

## Three ordering calls, named up front

- **The prototype is its own phase, before any code.** The PRD is explicit
  that the amendment lands as one `docs:` commit with nothing in `src/`, and
  that a dialog which exists only in prose is the improvisation CLAUDE.md
  forbids. A phase that ships no code is not a tracer bullet, but it is the
  thing every later bullet is aimed at, and it is checkable by looking: open
  `page.MoviePage`, press the row, and see the dialog.

- **`Modal`'s dismissal contract is split from the tracer bullet.** The PRD's
  Phase 2 builds `Modal` "with the dismissal contract" and its Phase 4 adds
  "Tab containment and focus return", which half-builds the one molecule the
  PRD says "must be right" and finishes it two phases later. Here Phase 2
  builds the shell with the two ways out the dialog itself draws — ✕ and
  Cancel — and Phase 4 lands the rest of the contract in one piece: Escape,
  scrim, focus in, focus back, Tab held inside. Between the two, Tab can
  wander behind the scrim; that is an intermediate state of the Maintainer's
  surface, not the family's, and it is named rather than hidden.

- **The bytes come before the Modal contract.** Phase 3 is the feature's
  point — the gigabytes come back — and it is server-side only, so nothing in
  it depends on the dialog being finished. The cost of the order is the
  intermediate state above; the cost of the reverse would be a delete that
  strands every folder for one phase longer.

## Two contracts settled early so their tests survive

- **`404` counts as done from Phase 2.** The client call resolves on `204` and
  on `404` alike from the first commit that writes it. The PRD lists "gone is
  gone" among the edges, but it is the client call's contract, and writing the
  call to reject on `404` in Phase 2 only to rewrite it — and its tests — in
  Phase 5 would be a wire contract scheduled for demolition, the same trap the
  movie-form plan named for `POST /api/movies`.

- **The route's shape is final from Phase 2.** `DELETE /api/movies/:id` answers
  `204 No Content` and the JSON `404` every per-movie route sends. Phase 3 adds
  a call to `Media` between the row and the response and changes nothing a
  client can observe.

---

## Architectural decisions

Durable decisions that apply across all phases.

- **Routes.** One write, under the existing `/api` router:

  ```
  DELETE /api/movies/:id -> 204 No Content
                         -> 404 { error: "Unknown movie: <id>" }
  ```

  Not `200 {}`: the single-signal routes echo because a client reconciles on
  the echo, and a delete reconciles on absence. The route is thin — find the
  movie or 404, delete the row, remove the folder, end — and learns nothing
  about the filesystem beyond the `Media` method it calls. A second delete of
  the same id is a `404`.

- **Schema.** No change. `movie_genres` and `subtitles` already cascade on the
  movie's deletion, and `LibraryStorage.deleteMovie` is untouched.

- **Order of operations: row first, then bytes, best-effort.** The library is
  the source of truth. A row that survives with its files gone is a ghost the
  family can open and fail on; files that survive with their row gone are
  stranded bytes nobody can reach — a cost, not a bug. The glossary's
  **Best-effort cleanup**, the same contract `removeFile` already keeps.

- **The `Media` seam grows one method: `removeMovieFolder(storedPath)`.** It
  removes the **Movie folder** the stored path names — its first segment — and
  everything in it, whether or not the named file is still there; it does
  nothing for a path that escapes the root or a folder already gone; and it
  swallows its own failure. Neither `openFolder` (answers nothing for a missing
  file) nor `removeFolder` (throws on a locked file, right for a rollback and
  wrong after a commit) fits. Three removals with three stated contracts.

- **The Library root is never read or written.** Only the folder under the
  **Managed media directory** is touched, and the dialog says so.

- **Key models.** No new types. `MenuItem` gains a `danger` boolean — the
  **Danger row**, the only destructive row in the prototype. `Modal` is a new
  molecule with exactly the props COMPONENT-SPEC lists: `open`, `title`,
  `subtitle`, `icon`, `onClose`, children. `DeleteMovieDialog` takes `movieId`,
  `title`, `open`, `onClose`. `useDeleteMovie` exposes
  `{ deleting, deleteMovie }`.

- **Where things live.** The client call sits with the movie-detail feature,
  beside `saveRating` — one caller, so CLAUDE.md's `api/` rule keeps it there.
  `EditMenu` owns the dialog's open state because it owns the row, and gains a
  `title` prop beside `movieId`. `Modal` lands in `components/` as the shell
  the 🔜 Export dialog draws on. No new `test-support/` unit.

- **Navigation.** A finished delete goes back through `useGoBack` — the app's
  one Back rule — never `navigate('/')`. The deleted movie's page stays in the
  forward stack and answers the detail page's existing `not-found` state.

- **Copy, fixed by the log.** Title `Delete “{title}”?`; subtitle `This can’t be
undone.`; body `The movie leaves your library, and the video, poster and
subtitles FamilyFlix copied are deleted. The original files are not touched.`;
  buttons `Delete movie` / `Cancel` in that order; in-flight `Deleting…`; ✕
  labelled `Close`; the row `🗑 Delete movie` with the glyph out of its
  accessible name. Typographic quotes and apostrophes as the prototype writes
  them.

- **Not built, anywhere in these phases.** Undo, snackbar, trash, a keyboard
  shortcut, Delete from a card or the player, scroll-locking behind the scrim,
  a red icon tile, a native `<dialog>`.

---

## Phase 1: Amend the prototype

**User stories**: none directly — this phase produces the spec that Phases 2–5
translate. It is the precondition CLAUDE.md sets: "amend the prototype first,
then build to the amended prototype."

### What to build

One `docs:` commit against `docs/handoff/`, nothing in `src/`. Four changes
composed entirely from vocabulary the prototype already has:

- A new `mol.Modal` file holding the shell lifted verbatim from
  `feat.ExportModal`'s idle state — scrim fixed over everything at z 90 with
  the scrim colour, 4px blur and the fade; a 520-wide card at `max-width 100%`
  on `surface-2` with the border, the large radius, the deep shadow and the
  pop; a header of a 44px `radius 12` tile on `accent-soft` / `accent-line`
  holding the icon, a serif 600 24px title, a 14px faint subtitle and a 34px ✕;
  a body slot padded `22px 28px 28px` — with `data-props` of `open`, `title`,
  `subtitle`, `icon`, `onClose`, children.
- A new `feat.DeleteMovieDialog` file composing that Modal with the fixed copy
  as one 15px dim paragraph and a `gap 12` action row of a `danger`/`md` and a
  `secondary`/`md` Button in [confirm][Cancel] order, 🗑 in the tile.
- `danger` added to `prim.Button`'s `variant` enum; its `renderVals` already
  implements it.
- `page.MoviePage`'s Delete row rewired to open the dialog, with the root
  prototype file holding the open state, dropping the movie on confirm and
  returning to browse.
- COMPONENT-SPEC gains the two rows.

### Acceptance criteria

- [ ] `mol.Modal` exists in the handoff and is pixel-identical to the shell
      `feat.ExportModal` draws in its idle state
- [ ] `feat.DeleteMovieDialog` exists, composes `mol.Modal`, and carries the
      exact copy fixed above
- [ ] `prim.Button`'s variant enum lists `danger`, and the variant renders as
      `renderVals` already draws it
- [ ] In `page.MoviePage`, selecting 🗑 Delete movie opens the dialog; Cancel and
      ✕ close it; the confirm removes the movie and returns to browse
- [ ] COMPONENT-SPEC lists `Modal` and `DeleteMovieDialog` with their targets
      and props
- [ ] The commit touches only `docs/`

---

## Phase 2: The tracer bullet — row → dialog → route → back

**User stories**: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 24,
25, 26, 35, 36, 37, 38, 39, 46

### What to build

The thinnest complete path. The ⋯ menu on the movie detail page gains its
second row, `🗑 Delete movie`, drawn as the **Danger row** below Edit details;
selecting it closes the menu like any row and opens the **Delete dialog** over
the whole viewport, naming the movie, with the fixed copy, 🗑 in the tile, a
`danger` confirm and a `secondary` Cancel. ✕ and Cancel close it and delete
nothing. Confirming sends `DELETE /api/movies/:id`; the server finds the movie
or answers the JSON `404`, deletes the row (the cascade takes genre tags and
subtitles) and answers `204`. The client resolves on `204` and on `404` alike
and rejects on anything else. On resolution the page goes back one step through
`useGoBack` — or to the browse home when there is nothing behind it — and the
screen it lands on is refetched without the movie. Stepping forward onto the
deleted page shows the detail page's existing `not-found` state.

`Modal` lands as the molecule with its full prop surface, rendered through a
portal to the document body so it holds still while the page scrolls, mounting
only when open so the pop runs fresh each time, with the icon tile omitted when
no icon is given and the ✕ a local button labelled Close. Its remaining ways
out — Escape, the scrim, the focus contract — are Phase 4.

Nothing on the browse home, a poster card or the player gains a Delete.

### Acceptance criteria

- [ ] `DELETE /api/movies/:id` answers `204` with an empty body; the movie is
      then absent from `GET /api/movies` and from its genre rows
- [ ] An unknown id, and a second delete of the same id, answer the JSON `404`
      with `Unknown movie: <id>`
- [ ] The client call sends `DELETE` to the movie's route with an encoded id,
      resolves on `204` and on `404`, rejects on `500` and on a request that
      cannot be made
- [ ] `MenuItem` accepts `danger`: the row is drawn in danger ink with a `.12`
      tint on hover, still closes the menu and reports like any row, and the
      glyph stays out of its accessible name; a row without `danger` is
      unchanged
- [ ] `EditMenu` draws `🗑 Delete movie` after Edit details; selecting it closes
      the menu and opens the dialog titled with this movie's name
- [ ] `Modal` renders nothing when closed, renders into the document body when
      open, shows the icon tile only when an icon is given, and its ✕ calls
      `onClose`
- [ ] `DeleteMovieDialog` shows the exact title, subtitle and body copy, a
      `danger` Delete movie and a `secondary` Cancel in that order; Cancel calls
      `onClose`
- [ ] Confirming from a page reached from a shelf lands back on that shelf, as
      it was left, without the movie's card
- [ ] Confirming from a deep-linked or reloaded page lands on the browse home
- [ ] Stepping forward onto the deleted movie's page shows the `not-found` copy
- [ ] `MovieDetail` passes the title into the menu — the opened dialog names
      the movie on the page
- [ ] The existing `EditMenu` test asserting "no Delete row" is replaced by its
      opposite

---

## Phase 3: The bytes

**User stories**: 27, 28, 29, 30, 31, 43, 44, 45

### What to build

`Media` gains `removeMovieFolder(storedPath)`, and the route calls it after the
row is deleted and before it answers. The method removes the folder the stored
path's first segment names and everything in it — video, poster, subtitles,
anything else — whether or not the named file is still there. It does nothing
for a path that escapes the managed media directory, nothing for a folder that
is already gone, and swallows its own failure, so a locked video leaves the
delete successful with the folder stranded rather than failing it. Another
movie's folder and the managed media directory itself are never touched, and
the Library root is never read.

### Acceptance criteria

- [ ] `removeMovieFolder` removes the folder a stored path names and everything
      in it, against a real sandbox directory
- [ ] It removes the folder when the named file is already gone but its
      siblings are not
- [ ] It leaves another movie's folder alone and the managed media directory
      standing
- [ ] It says nothing about a folder that is already gone
- [ ] It refuses a path that escapes the root — no files touched
- [ ] It swallows a removal failure rather than throwing
- [ ] After `DELETE /api/movies/:id` answers, the movie's folder is gone from
      the sandbox
- [ ] The row is gone even when the folder removal fails
- [ ] Deleting one movie leaves another movie's row and folder untouched
- [ ] The route imports nothing from the filesystem — only the `Media` method

---

## Phase 4: Modal's ways out and its focus contract

**User stories**: 17, 18, 19, 20, 21, 22, 23

### What to build

`Modal` completes the dismissal contract it owns, on the argument `Menu` made:
it is the half that is easy to half-implement. Escape calls `onClose`; a press
on the scrim calls `onClose`; a press inside the card does not. On open, focus
moves to the card itself (`tabIndex=-1`) and to no button, so a reflexive Enter
does nothing. Tab from the last focusable element wraps to the first and
Shift+Tab from the first wraps to the last, so focus never reaches the scrimmed
page. On close, focus returns to the element that had it — for the Delete
dialog, the ⋯ trigger the menu already returned it to. The card carries
`role="dialog"`, `aria-modal="true"` and is labelled by its title. Listeners
are removed once shut, so a stray Escape after close costs nothing.

### Acceptance criteria

- [ ] Escape calls `onClose`; after close, another Escape calls nothing
- [ ] A press on the scrim calls `onClose`; a press inside the card does not
- [ ] On open, focus is on the card and on no button
- [ ] Tab from the last focusable wraps to the first; Shift+Tab from the first
      wraps to the last
- [ ] On close, focus returns to the previously focused element
- [ ] The card has `role="dialog"`, `aria-modal="true"` and is labelled by its
      title
- [ ] In `EditMenu`, cancelling the Delete dialog leaves focus on the ⋯ trigger
- [ ] The Modal test carries the whole contract in `Menu.test.tsx`'s shape —
      "the ways out", "reopening"

---

## Phase 5: In flight and failure

**User stories**: 32, 33, 34, 40, 41, 42

### What to build

The request's lifetime becomes visible and survivable. `useDeleteMovie` holds
`deleting` for the life of the request; while it runs the confirm is disabled
and reads **Deleting…**, and Cancel, ✕ and Escape stay live. Dismissing the
dialog does not cancel the request: a success after a dismissal still goes
back, because the movie is gone and its page has nothing left to show. A
failure — a `500`, or no server — re-enables the confirm and changes nothing
else: the dialog stays open, the location stays put, no error surface is
invented. A title with quotes or a very long title sits in the heading without
breaking the card.

### Acceptance criteria

- [ ] While the request runs, the confirm is disabled and reads `Deleting…`
- [ ] While the request runs, Cancel stays enabled and ✕ and Escape still close
      the dialog
- [ ] `deleting` is true for the life of the request and false after
- [ ] A `204` or `404` arriving after the dialog was dismissed still navigates
      back
- [ ] A rejection re-enables the confirm, leaves the dialog open and the
      location unchanged
- [ ] A title containing quotation marks, and a very long title, render in the
      heading without overflowing the card
- [ ] The feature ticks 🔜 → ✅ in README and CLAUDE.md only after its refactor
      pass, per the project rule
