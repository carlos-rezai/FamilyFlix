# Plan: Keep originals, no Delete ever touches an original

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/473

In v0.10.0 deleting a linked series sent over a thousand episodes to the
Recycle Bin, and Windows purged what overflowed it. v0.11.0 made keeping the
default, but the **Recycle choice** is still one click away. This initiative
makes the rule absolute and true by construction: a Delete removes only the
link or FamilyFlix's own copy, the **Shell trash** goes whole, and a **Library
folder** that overlaps the **Managed media directory** is refused (the **Media
directory refusal**). One route test pins the guarantee.

## Running the phases

**Every phase is AFK and runs under `issue-loop`, in order.** No phase is
HITL.

- The prototype already lives in `docs/handoff/`, so amending it needs no
  Claude Design round. Its revision is phases 1 and 2, and lands before any
  build phase (log 52 Q3). The PRD and log 52 fully specify the amendment
  (the cards and callout go, every other word stays; the refusal's sentence),
  so a phase never stops to ask.
- **Each phase stays well under a 100k-token context.** The prototype files
  are large (`FamilyFlix.dc.html` is about 142 KB, `COMPONENT-SPEC.md` about
  97 KB, `page.ManageLibraryPage.dc.html` about 54 KB). A phase greps for the
  section it amends (`What goes`, `ChoiceCard`, `Recycle Bin`) and reads only
  that range. `routes/index.ts` is large too; a phase greps for the route it
  changes. New route cases go in their own focused suite,
  `routes.keepsOriginals.test.ts`, as `routes.linkedDelete.test.ts` did.
- No test runs Electron, FFmpeg or TMDB. Originals live in a temporary
  Library folder the suite creates.
- The live walk of log 52's slice 5 (story 34) is not a phase: it is the
  release checklist's **Keep originals** smoke, walked by the maintainer
  before the release. The documents (story 33: the checklist's step 35 entry
  and row, README's Library paragraph, CLAUDE.md _Product Rules_ **Media**,
  the release checklist's smoke, the docblocks of every unit touched) are not
  a phase either: they are ticked ✅ only after the refactor. The glossary
  already carries **Original** and **Media directory refusal**, and the
  retired and updated terms.

The phases are log 52's _Implementation Plan_ slices 1 to 4, the prototype
and the Delete split so no issue outgrows one context, and the guarantee's
remaining cases given their own phase.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**:
  - `DELETE /api/movies/:id` and `DELETE /api/series/:id` take no query. Each
    always records the title's **Left-out videos**, then removes the rows,
    then the **Media folder** (row first, then bytes, best-effort). They
    answer `204`, `404` for an unknown id, and never `409`. A stray
    `?files=trash` is ignored, not refused.
  - `POST /api/library-folders` answers `409` with _That folder overlaps
    where FamilyFlix keeps its own copies. Choose another one._ for a path
    that is, lies inside or holds the Managed media directory. The existing
    refusals keep their order, status and words; the new one comes after the
    overlap with listed folders.
  - No new route, no migration.
- **Shell handshake**: `ServerMessage` is `{ type: 'ready'; port } |
{ type: 'fatal'; message }`; `ShellCommand` is `{ type: 'shutdown' }`.
- **Key models**:
  - `LinkedFiles` (`src/types/libraryTitles.ts`) stays `'folder' | 'videos' |
'shared' | 'unreachable'`, `null` for a copied title, redefined as what a
    Delete leaves where it lies. `DeleteFiles` is removed.
    `LinkedFilesAnswer.paths` goes; `linkedFiles` answers `LinkedFiles |
null`.
  - `deleteTitleAt(route: string): Promise<void>`, Factory reset's shape: any
    `2xx` or a `404` resolves, anything else rejects. `deleteMovie`,
    `deleteSeries`, `useDeleteMovie`, `useDeleteSeries`,
    `useLibraryTitles.deleteTitle` and the dialogs' `onConfirm` take no
    `files`. `DeleteOutcome` and every `refusal` of the delete hooks go;
    `refusalSentence` stays (the folder and form wires use it).
  - `deleteView(title)` takes one parameter; `DeleteView.callout`,
    `LINKED_CALLOUT`, `offersRecycleChoice` and `filesGoing`'s trash branch go.
  - `createMedia(mediaPath: string): Media`; `trashLinked`, `Trash`,
    `TrashOutcome` and `NO_TRASH` go.
  - `FolderRefusal` is `'empty' | 'relative' | 'missing' | 'media'`;
    `admitFolder(storage, path, mediaPath)`, its fourth rule
    `folderOverlap(path, [mediaPath])`.
- **Copy**: the Delete dialog draws today's _Keep the files_ state, cards and
  callout gone, every word unchanged: heading, subtitle, _What goes / What
  stays_ as `deleteView` words them for keeping, then _Delete movie_ /
  _Delete series_ and _Cancel_. One dialog in the shell and in a browser.
- **Unchanged throughout**: a copied title's Delete (its Media folder goes,
  its original stays as a Left-out video); a poster a **Write target** wrote
  beside a linked video stays; Enrichment as the only network client; Step
  30's frozen handoff (`handoff-manage-library/`).

---

## Phase 1: Prototype, the Delete dialog

**User stories**: 3 to 5, 7, 8, 14, 15 (as spec)

### What to build

Amend the Delete dialog in `docs/handoff/page.ManageLibraryPage.dc.html`,
`page.MoviePage.dc.html`, `page.SeriesPage.dc.html` and `FamilyFlix.dc.html`:
it draws what today's _Keep the files_ state draws, with the two
`ChoiceCard`s (**Keep the files**, **Move them to the Recycle Bin**) and the
Recycle Bin callout gone. The heading, subtitle, _What goes / What stays_
(including the `shared` and `unreachable` wordings), the confirm and _Cancel_
are unchanged. The dialog no longer depends on shell or browser, and its
simulated state no longer holds a choice.

Amend `COMPONENT-SPEC.md`'s rows for the three Delete dialogs (grep for
`DeleteTitleDialog`, `DeleteMovieDialog`, `DeleteSeriesDialog`): `ChoiceCard
×2` and the callout drop, and the row says the dialog is the same everywhere.
Leave `handoff-manage-library/` as it is.

Read only the Delete dialog's range of each file (grep for `What goes`,
`ChoiceCard`, `Recycle Bin`) and the matching spec rows.

### Acceptance criteria

- [ ] No prototype draws a choice card or the Recycle Bin callout in a
      Delete dialog, for a linked or a copied title, in shell or browser.
- [ ] _What stays_ for a linked title names its original staying in its
      library folder and _Scan folders would bring it back_, as the keep
      state worded it.
- [ ] The `shared` and `unreachable` wordings are unchanged.
- [ ] _Delete movie_ / _Delete series_ and _Cancel_ are the only buttons.
- [ ] No word _Recycle Bin_ is left in the four files' Delete dialogs.
- [ ] The three spec rows drop `ChoiceCard ×2` and the callout.

---

## Phase 2: Prototype, the Media directory refusal

**User stories**: 19 to 23 (as spec)

### What to build

Amend `docs/handoff/page.LibraryFoldersPage.dc.html`: adding a folder that
is, lies inside or holds the sample's Managed media directory draws the
add's refusal line _That folder overlaps where FamilyFlix keeps its own
copies. Choose another one._, as the existing overlap refusal draws its own.
The simulation checks it after the existing refusals, which keep their order
and words.

Amend the matching `COMPONENT-SPEC.md` row (grep for `LibraryFoldersPage` and
the add's refusals): the new refusal and its place in the order.

### Acceptance criteria

- [ ] The prototype refuses the media directory, a folder inside it and a
      folder holding it, with the refusal's exact words.
- [ ] The existing refusals are drawn first, unchanged.
- [ ] The spec row names the Media directory refusal.

---

## Phase 3: A Delete keeps originals, the routes

**User stories**: 1, 2, 6, 9 to 13, 16, 32

### What to build

`DELETE /api/movies/:id` and `DELETE /api/series/:id` read no query. Each
always records the title's Left-out videos, removes its rows, then removes its
Media folder; no request reaches the Shell trash, and the routes no longer
answer `409`. `recycleChoiceFirst` and `trashedFirst` go. A `?files=trash`
from an old client is ignored: the Delete keeps every original.

The trash cases leave `routes.deleteKeepsFiles` and `routes.linkedDelete`;
what stays asserts Left-out videos are always recorded and that a
`?files=trash` changes nothing. Create `routes.keepsOriginals.test.ts` over a
temporary Library folder with its first cases: deleting a linked movie, a
linked series (with a poster written beside a video) and a copied movie. After
each, every original is on disk and byte-identical, the copied title's
Managed copy is gone, and a scan does not bring the title back.

The Shell trash itself stays wired until phase 5; this phase only stops the
routes from calling it.

### Acceptance criteria

- [ ] Deleting a linked movie or series answers `204`, leaves every video
      (and a poster beside it) byte-identical, and records its Left-out
      videos.
- [ ] Deleting a copied movie removes its Media folder and leaves its
      original byte-identical, remembered as left out.
- [ ] `DELETE ...?files=trash` behaves exactly as a plain Delete.
- [ ] No delete route answers `409`; an unknown id answers `404`.
- [ ] A scan after each Delete does not bring the title back.

---

## Phase 4: A Delete keeps originals, the dialog and the wire

**User stories**: 3 to 5, 7, 8, 14 to 18

### What to build

The client half of the Delete, translating phase 1's prototype 1:1.
`DeleteTitleBody` draws no cards, no callout and no refusal line, and stops
reading the **Folder bridge**: one dialog in the shell and in a browser.
`deleteView(title)` takes one parameter and words _What goes / What stays_ as
it did for keeping.

`deleteTitleAt(route)` returns to Factory reset's shape, `Promise<void>`: any
`2xx` or a `404` resolves, anything else rejects. `DeleteFiles`,
`DeleteOutcome` and every `files` parameter and `refusal` go from
`deleteMovie`, `deleteSeries`, `useDeleteMovie`, `useDeleteSeries`,
`useLibraryTitles` (`deleteTitle`, `refusalFor`) and the three dialogs'
`onConfirm`. A rejection (the server down) still surfaces as the dialog's
error. The four `*.recycle.test.tsx` suites go.

### Acceptance criteria

- [ ] The Manage Library, Movie and Series Delete dialogs draw no card, no
      callout and no refusal line, in a shell and in a browser alike.
- [ ] Their words match phase 1's prototype.
- [ ] Confirming sends a plain `DELETE` with no query.
- [ ] A `404` counts as deleted; a `500` or a network failure shows the
      dialog's error and the title stays.
- [ ] No `files`, `DeleteFiles` or `DeleteOutcome` is left in `src/`.

---

## Phase 5: The Shell trash goes

**User stories**: 29 to 31

### What to build

Remove the Shell trash whole. The **Shell handshake** is back to
`ready | fatal` and `shutdown`: the `trash` message and the `trashed` command
go from `src/types/shell.ts`. `createShellTrash` (`server/src/shell/`),
`electron/trashItems/`, main's trash handler, `serverHandle`'s `trash`
dependency and `answerTrash` go, with their tests (`routes.shellTrash`,
`shellTrash`, `trashItems`). `createMedia(mediaPath)` loses its second
parameter; `Trash`, `TrashOutcome`, `NO_TRASH` and `trashLinked` go, with the
trash cases of `createMedia`'s test.

`linkedFiles` answers only the kind, `LinkedFiles | null`: `LinkedFilesAnswer`
and its `paths` go, as does `libraryTitleList`'s `linkedFilesOf`. Their tests
assert the kind for each case (`folder`, `videos`, `shared`, `unreachable`,
copied) and no paths.

### Acceptance criteria

- [ ] `ServerMessage` and `ShellCommand` have only `ready`, `fatal` and
      `shutdown`; the shell's existing handshake tests pass.
- [ ] No `trash` identifier is left in `electron/`, `server/src/` or `src/`
      outside test names that assert its absence.
- [ ] `createMedia` takes one argument everywhere it is called.
- [ ] `linkedFiles` and the library title list answer the kind only.
- [ ] Phase 3's `routes.keepsOriginals` cases still pass.

---

## Phase 6: The media directory is no Library folder

**User stories**: 19 to 23

### What to build

`admitFolder(storage, path, mediaPath)` gains a fourth rule after the overlap
with listed folders: `folderOverlap(path, [mediaPath])` non-null is refused as
`'media'`. `POST /api/library-folders` passes the server's media path and
answers that refusal `409` with _That folder overlaps where FamilyFlix keeps
its own copies. Choose another one._ (in `FOLDER_REFUSALS`). The Library
folders page already draws a refusal's sentence, so it shows the new one with
no client change beyond what phase 2's prototype asks.

### Acceptance criteria

- [ ] Adding the Managed media directory, a folder inside it, or a folder
      holding it answers `409` with the exact sentence, and nothing is listed.
- [ ] Nothing typed, a relative path, a missing folder and an overlap with a
      listed folder keep their order, status and words.
- [ ] A folder beside the media directory (sharing a name prefix, not a
      path) is added.
- [ ] The Library folders page shows the refusal under the add.

---

## Phase 7: Every other removal keeps originals

**User stories**: 24 to 28

### What to build

Complete `routes.keepsOriginals.test.ts`, so one suite exercises every removal
FamilyFlix makes: replacing a linked film's video on an edit, removing a
linked episode in the Series edit job, Clear details on a linked title with a
poster beside its video, and Factory reset. After each, every original in the
temporary Library folder is on disk and byte-identical, and only
FamilyFlix's own copies are gone. These cases pin behaviour log 52 found
already correct; any case that fails is fixed here in the route or domain
that removes the file.

### Acceptance criteria

- [ ] An edit that replaces a linked video leaves the old original in place.
- [ ] Removing a linked episode leaves its file in place.
- [ ] Clear details removes only FamilyFlix's art; the poster beside the
      video stays.
- [ ] Factory reset empties only the Managed media directory; every Library
      folder's files survive it byte for byte.
- [ ] The suite's cases together cover both Deletes, the edit, the episode,
      Clear details and Factory reset.
