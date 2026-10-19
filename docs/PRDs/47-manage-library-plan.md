# Plan: Manage library — every title in one list, cleared or deleted completely

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/406

Nothing lists what the library holds in one place, a wrong TMDB match cannot
be undone, and a Delete leaves a **Linked video** where it was, so the next
**Scan folders** brings the title back. This initiative adds the **Manage
library page** at `/settings/library`: every title on _Movies N_ / _Series N_
tabs, one **Title row** each saying where it lives and what it knows, with
_Edit details_, _Sync with TMDB_, **Clear details** and a _Delete…_ that
takes a title out completely. A linked title's files go to the **Recycle
Bin** through the **Shell trash**, and only there.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** There is no
separate prototype phase. The handoff was already received
(`docs/handoff/handoff-manage-library/`), so amending it needs no Claude
Design round. Instead, **each phase first promotes or amends the prototype
for the surface it draws** (log 47 Q20), then builds to the amended
prototype. `handoff-manage-library/` itself stays as received. The amended
`page.ManageLibraryPage.dc.html` is built on our components only and names
each one.

The phases are log 47's _Implementation Plan_ slices 2–6, with its
linked-delete slice split three ways (phases 5–7) so each one is thin.
Phase 5 is demoable without Electron: a standalone server answers the
no-shell refusal. Phase 6 makes the Recycle Bin real.

The docs (README, CLAUDE.md, the folder tree, the Settings Hub routes, and
the Linked video and Library folder rules, per log 47 Q21) are log 47's
slice 7. They are not a phase: they are ticked ✅ only after the refactor.
The Package smoke's lines for a real Recycle Bin and a locked file are added
to `docs/release-checklist.md` in phase 6 and checked by hand at the next
release, not as a phase's acceptance.

## Architectural decisions

Durable decisions that apply across all phases:

- **Client routes**:
  - `/settings/library` is the **Manage library page**, the hub's third
    nested route. `?tab=series` is written as a replace, and Movies is the
    tab with no query.
  - Its Back is `useGoBack('/settings')`.
- **Server routes**:
  - `GET /api/library-titles` → `{ movies: LibraryTitle[], series:
LibraryTitle[] }`. It is one read for both tabs, each list A–Z by title,
    with paths absolute and reachability read afresh on every call. There is
    no `?kind=`.
  - `POST /api/movies/:id/clear-details` and `POST
/api/series/:id/clear-details` → `200 LibraryTitle`, the echo the row
    redraws from, and `404` for an id not held.
  - `DELETE /api/movies/:id` and `DELETE /api/series/:id` keep their path and
    their `204`. They learn **Linked files** and two `409`s, each one
    sentence:
    - _Only the desktop app can move a linked title’s files to the Recycle
      Bin._
    - _Couldn’t move <path> to the Recycle Bin. Close anything playing it and
      try again._

    There is no second delete route.

- **Schema**: no migration.
- **Key models** (shared types, both build targets):
  - `DETAILS_STATES` (`synced` / `own` / `none`) and `DetailsState`.
  - `LinkedFiles`: `folder` | `videos` | `unreachable`.
  - `LibraryTitle` is a union on `kind`. Both kinds carry `id`, `title`,
    `year`, `path`, `linkedFiles` (`null` when copied), `originalPath` (a
    copied title's Source folder, else `null`) and `details`. A movie also
    carries `files`. A series also carries `endYear`, `seasons` and
    `episodes`.
  - `LibraryTitles` is `{ movies, series }`.
- **The Details state** is spelled once in SQL, `detailsStateSql`, on
  `fullDetails`' precedent:
  - `synced` when `tmdb_id` is set;
  - `none` when the title holds none of year, synopsis, director, cast,
    original title, poster, backdrop, genres and TMDB score;
  - `own` for anything else.
- **Linked files** is decided once, by a pure unit in `media/` that both the
  list and the delete read:
  - `folder`: the Source folder holds no other held title's video and is not
    a Library folder itself;
  - `videos`: the folder is shared, so only the title's own linked videos;
  - `unreachable`: the Library folder can't be read, so there are no paths;
  - `null`: there is no linked video.

  A show is linked when any of its episodes is.

- **The Shell trash**:
  - The **Shell handshake** gains one exchange. `ServerMessage` gains `{
type: 'trash'; id; paths }` and `ShellCommand` gains `{ type: 'trashed';
id; failed: string | null }`.
  - The server sees a `Trash` seam answering `trashed`, `failed` (with its
    path) or `unavailable`, reached only through `media.trashLinked`. No
    route learns there is a shell.
  - Main moves each path with `shell.trashItem`, in order. A missing path
    counts as gone, and the first failure stops the rest.
- **The delete's order**:
  1. Read the Linked files.
  2. Trash them. A refusal means a `409` and the rows untouched.
  3. Delete the rows.
  4. Remove the Media folder, best-effort.
  5. Answer `204`.

  **Trash first, rows after.** There is no guard while a run runs.

- **The clear's order**: one transaction clears the columns, then the Stored
  paths it let go are removed from managed storage. **Row first, then bytes,
  best-effort.**
- **Unchanged throughout**:
  - A Factory reset, removing a Library folder and Clear details never touch
    a Library folder.
  - A copied title's original in a Library folder is never touched.
  - No exclusion list, no search, sort or bulk actions on the page, no size
    on disk, no episode delete.

---

## Phase 1: The list, read-only

**User stories**: 1–33

### What to build

The thinnest end-to-end path. First, the prototype:

- promote `page.ManageLibraryPage.dc.html` into `docs/handoff/`, amended to
  log 47 for the list (counts in the labels, _Copied_, the Details state's
  words, no syncing row);
- add the Library group's row to `page.SettingsPage.dc.html`;
- add the screen to `FamilyFlix.dc.html`.

Then, on the server, `GET /api/library-titles` over one query of both kinds
with `detailsStateSql`, and the pure Linked files unit for the badge and the
unreachable line.

On the client:

- the Library group's fourth row, _☰ Manage library — Edit, clear or delete
  any title in your library._, after _📁 Library folders_;
- the page at `/settings/library` in `MaintainerLayout`, with the header and
  the pill tabs with their counts;
- the summary (_6 movies · 1 without details_);
- one Title row per title: tile, title and year (a show's Year range), the
  absolute path in mono, _Linked_ / _Copied_, the files, the dot and its
  words, and _Can’t be reached right now_ for an unreachable linked title.

No menus yet. Demo: the Settings row opens a list of every title.

### Acceptance criteria

- [ ] The prototype is promoted and amended for the list, the Settings row
      and the screen, and `handoff-manage-library/` is unchanged.
- [ ] `GET /api/library-titles` answers both kinds A–Z with absolute paths:
  - a linked film's Source folder;
  - a Collection folder film's video;
  - a copied title's Media folder;
  - `originalPath` for a copied title found in a Library folder.
- [ ] Each Details state holds at its boundary: a `tmdb_id` alone is
      `synced`, one Sync field alone is `own`, and a title alone is `none`.
- [ ] A show answers the series page's season and episode counts. A show
      with one linked episode is linked.
- [ ] Linked files answers `folder`, `videos` (Collection folder; loose
      episodes at a Library folder's root), never `folder` for a Library
      folder itself, `unreachable` with no paths, `null` when copied, and a
      mixed show's linked episodes only.
- [ ] An unreadable Library folder's titles answer `unreachable`, read
      afresh on every call.
- [ ] The Library group draws _Manage library_ after _Library folders_, and
      it opens `/settings/library`. Back steps back, else onto Settings.
- [ ] The tabs read _Movies N_ / _Series N_, and `tab` is written as a
      replace, omitted at movies.
- [ ] The summary leaves out _without details_ at zero.
- [ ] Nothing is drawn while the read is `null` or failed. An empty tab
      reads _No movies in your library._ / _No series in your library._
- [ ] The row draws the year (none when absent, a Year range for a show),
      the badge, _N files_ or _N seasons · N episodes_, the dot by state, and
      the danger line when unreachable.

---

## Phase 2: Edit and Sync

**User stories**: 34–40

### What to build

First, the prototype: amend the promoted page's Edit ▾ menu to the log.

`MenuItem` gains an optional `hint` line. Each row gains _Edit ▾_, a
secondary sm `Button` with a trailing chevron in the `FilterDropdown`
trigger's shape, over `Menu`, holding two items:

- _Edit details_ (_Change the title, year and poster by hand_) pushes the
  Movie form's edit for that film or series.
- _Sync with TMDB_ (_Fetch details and artwork again_) pushes the title's
  page, then `enrichPath({ movie | series: id, start: true })`. The flow is
  **Started on arrival**, under its own rules.

Demo: Back from the flow lands on the title, and Back again on the overview.

### Acceptance criteria

- [ ] The prototype's Edit menu is amended to the log.
- [ ] `MenuItem` draws `hint` under its label when given, and is unchanged
      when not.
- [ ] _Edit details_ pushes the form's edit for a film and for a series. A
      save or Back from the form returns to the overview.
- [ ] _Sync with TMDB_ pushes the title's page, then the flow with
      `start=1`, for both kinds (checked with `LocationProbe`).
- [ ] The flow's own rules (no key, offline, a busy Sync, a Waiting run)
      apply unchanged.
- [ ] The menu is keyboard-operable and closes on Escape and an outside
      click.

---

## Phase 3: Clear details

**User stories**: 41–55

### What to build

First, the prototype: amend the promoted page's ⋯ menu and the Clear dialog
to the log (lists, words, order, the `success` notice).

On the server, `clearMovieDetails` and `clearSeriesDetails`, each one
transaction, behind the two clear-details routes. Each answers the Stored
paths it let go, and the route removes them from managed storage after.

On the client:

- `MenuItem` gains `disabled`.
- Each row gains ⋯, a ghost `IconButton` named _More actions for “Coco”_,
  holding _Clear details_, disabled at `none`.
- The Clear dialog on `Modal`, in the Reset dialog's shape:
  - What goes: _Year, synopsis, credits and genres_; _Poster, backdrop and
    artwork_; _Its TMDB match and score_.
  - What stays: _Its title and files_; _Watch history, rating and heart_.
  - The path in the mono well.
  - _Clear details_ (_Clearing…_ in flight) before _Cancel_, with focus on
    the card.
- The row is redrawn from the echo, and the notice is _Details cleared for
  “Coco”._

### Acceptance criteria

- [ ] The prototype's ⋯ menu and Clear dialog are amended to the log.
- [ ] A clear empties `tmdb_id`, year (a show's end year too), synopsis,
      director, cast, original title, TMDB score, genres, poster and
      backdrop.
- [ ] For a show, a clear also empties its Season posters and each
      episode's title, air date, Still and Still source.
- [ ] A clear keeps the title, files, runtime, watch state, Rating and heart.
- [ ] A cleared title is Unmatched and is in an _Only what's missing_ Sync's
      scope.
- [ ] The route answers `200` with the redrawn `LibraryTitle` (its details
      `none`) and `404` for an unknown id, for both kinds. The let-go art
      files are gone from managed storage.
- [ ] `MenuItem`'s `disabled` is neither pressable nor wrongly skipped by the
      roving focus.
- [ ] _Clear details_ is disabled on a `none` row.
- [ ] The dialog draws its lists, its path, its order, its in-flight words
      and its focus on the card. The row redraws from the echo, and the
      success notice shows.

---

## Phase 4: Delete, copied titles

**User stories**: 56–60, 68–71, 78

### What to build

First, the prototype: amend the promoted page's Delete dialog for a copied
title to the log.

`deleteMovie` and `deleteSeries` move to `src/api/`, since two features now
call each. They answer `deleted` on `204` and `refused` with the route's
sentence on `409`, and reject otherwise, `factoryReset`'s shape. The detail
pages are rewired onto them with no visible change.

The ⋯ menu gains _Delete…_ as its danger row below a divider. It opens the
Delete dialog, titled _Delete “Coco”?_, saying the title leaves FamilyFlix
and can't be undone from here:

- What goes: its details and artwork; its watch history, rating and heart;
  _FamilyFlix’s copy of its video and subtitles_.
- What stays: for a copied title with an original in a Library folder, that
  the original stays and Scan folders would bring it back.
- _Delete movie_ / _Delete series_ in danger (_Deleting…_ in flight) before
  _Cancel_, with focus on the card.

On `204` the row leaves the list, the counts and the summary update at once,
and _“Coco” was deleted._ shows. A linked title's row is not offered _Delete…_
until phase 5.

### Acceptance criteria

- [ ] The prototype's copied-title Delete dialog is amended to the log.
- [ ] `deleteMovie` and `deleteSeries` live in `src/api/`, answer `deleted`
      and `refused`, and reject otherwise. Both detail pages still delete as
      before.
- [ ] A copied title's delete never asks for anything new, and its route is
      unchanged.
- [ ] The dialog's title, paragraph, What goes and What stays hold, with and
      without an original in a Library folder.
- [ ] Order, in-flight words and focus hold.
- [ ] The row leaves the list. The tab's count and the summary update
      without a re-read, and the success notice shows.

---

## Phase 5: Delete, linked titles — the server and the refusal

**User stories**: 61–64, 66–67, 73–77

### What to build

First, the prototype: amend the promoted page's Delete dialog for a linked
title (`folder`, `videos`, `unreachable`) and its refusal line to the log.

On the server, the delete learns Linked files in the decided order.
`createMedia` gains `trashLinked(paths)` over an injected `Trash`. An empty
list asks nothing, and a path already gone counts as trashed. The two `409`
sentences answer `unavailable` and `failed` with the rows untouched.
`unreachable` deletes the rows and trashes nothing. Until phase 6, the
composed server's `Trash` answers `unavailable`, which is the standalone and
browser truth.

On the client, the dialog draws a linked title's What goes / What stays and
its callout:

- the whole folder, or only its videos, go to the Recycle Bin;
- for an unreachable title, its files stay on that path because they can't be
  reached.

The `409` sentence is held in danger above the buttons until the next press
is answered. _Delete…_ is offered on every row.

Demo: in a browser, a linked delete is refused in one sentence, and an
unplugged drive's title is deleted.

### Acceptance criteria

- [ ] The prototype's linked Delete dialogs and refusal line are amended to
      the log.
- [ ] A linked title's delete asks the `Trash` before the rows:
  - its Source folder when `folder`;
  - only its videos when `videos`;
  - never a Library folder whole.
- [ ] `unavailable` → `409` with the no-shell sentence. `failed` → `409`
      naming the path. In both cases every row is kept.
- [ ] `unreachable` → `204` with nothing trashed.
- [ ] A retry after a partial failure counts the already-trashed paths as
      gone and finishes.
- [ ] `trashLinked` forwards to the injected `Trash` and asks nothing for an
      empty list.
- [ ] A copied title's delete never asks the `Trash`.
- [ ] The dialog's words and callout hold for `folder`, `videos` and
      `unreachable`.
- [ ] The refusal line shows above the buttons and is cleared by the next
      press. The row stays on a refusal.

---

## Phase 6: The Shell trash

**User stories**: 65, 72, 74 (end to end)

### What to build

The Recycle Bin made real:

- The handshake's `trash` / `trashed` exchange is typed in the shell types.
- On the server, `createShellTrash(parentPort)` matches answers to requests
  by id and is inert with no parent port, `shellHandshake`'s precedent. It
  composes in place of phase 5's `unavailable` Trash.
- In the shell, `electron/trashItems/` runs over an injected world, the
  `openMediaFolder` shape: each path through `shell.trashItem` in order, a
  missing path counted as gone, stopping at the first failure. It is wired by
  `main.ts` and `serverHandle`.

Under the shell, a linked delete moves its files to the Recycle Bin, and a
later Scan folders does not bring the title back. The Package smoke gains two
lines for a real Recycle Bin and a locked file.

### Acceptance criteria

- [ ] `createShellTrash` posts a request with an id and resolves on its
      matching answer. `failed` carries the path, and two requests in flight
      are answered in their own order.
- [ ] With no parent port, `createShellTrash` answers `unavailable`, so a
      standalone server still refuses with phase 5's sentence.
- [ ] `trashItems` trashes each path in order, counts a missing path as
      gone, and stops at the first failure, naming it.
- [ ] Main answers each `trash` message with a `trashed` command carrying
      its id.
- [ ] A shutdown with a request in flight still completes the Ordered
      shutdown.
- [ ] A deleted linked title is not found again by a Folder scan (route
      suite, with a faked trash that removes the files).
- [ ] `docs/release-checklist.md` carries the two Package smoke lines.
- [ ] Every shell suite passes and `tsconfig.electron.json` typechecks.

---

## Phase 7: The detail pages

**User stories**: 79–82

### What to build

First, the prototype: amend `page.MoviePage.dc.html` and
`page.SeriesPage.dc.html` to draw the linked sentence and the refusal line.

`DeleteMovieDialog` and `DeleteSeriesDialog` keep their paragraph. For a
linked title, read off the record each already holds, they add one
sentence:

- the movie dialog: _Its video goes to the Recycle Bin._
- the series dialog: _Its files go to the Recycle Bin._

Both draw the same refusal line as the overview, held until the next press.
Demo: a locked file's refusal reads the same on the movie page as on the
overview.

### Acceptance criteria

- [ ] Both prototypes are amended to draw the sentence and the refusal.
- [ ] The movie dialog adds _Its video goes to the Recycle Bin._ only for a
      linked film.
- [ ] The series dialog adds _Its files go to the Recycle Bin._ only for a
      show with a linked episode.
- [ ] A `409` on either page shows its sentence in danger above the buttons,
      cleared by the next press. The page stays on the title.
- [ ] A delete on either page still lands as it does today.
