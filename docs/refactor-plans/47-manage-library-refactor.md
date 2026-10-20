# Refactor plan: Manage library — the list read out of the route, one spelling of each rule, the refusal held against its title, and the docs that close the initiative

> Source initiative: `manage-library`, issue 406 (step 30).
> Shipped by issues 407–413: the prototype was promoted and amended inside
> each phase's GREEN commit, then RED and GREEN each — 407
> `c04c29e`/`7aac754`, 408 `f11797e`/`d2172a6`, 409 `1e6940d`/`730eb5e`, 410
> `04dfcea`/`d2777aa`, 411 `de7b9bc`/`5886855`, 412 `9bec8c6`/`cebb367`, 413
> `284c56d`/`6a6e0a0`.
> Design log: `docs/design-logs/47-manage-library.md`. PRD:
> `docs/PRDs/47-manage-library.md` (406). Plan:
> `docs/PRDs/47-manage-library-plan.md`.
> This is the initiative's closing round. It ticks **Manage library**, files
> step 31, **Add a show folder**, as 🔜, and closes 406. Filed as issue 414.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`manage-library` shipped every slice of log 47's implementation plan. At
`6a6e0a0` the full suite has **10332 tests across 612 files, all passing**.
`tsc -b --force` is clean. `eslint src server electron` reports one error and
139 warnings, against one error and 99 warnings when the Audio tracks round
closed. Of the 40 new warnings, 38 are non-null assertions in the new suites,
the suites' prevailing style. The other two are `no-useless-escape` in
`deleteMovie.test.ts` (section 6).

The seven build slices were built one at a time by agents that each saw one
slice. The design held:

- one `GET /api/library-titles` for both tabs;
- the **Details state** spelled once in SQL;
- **Linked files** decided by one pure unit, read by the list and the delete;
- trash first, rows after, through an injected `Trash`, so no route learns
  there is a shell;
- one Delete for every surface.

The seams show in smaller places, and in one larger one: the route file.
Nothing below is a bug a household would see, except one refusal drawn in the
wrong title's dialog (section 4). Every finding was checked against the code
for this plan. They fall into six families:

- the list read lives in the route layer;
- the Shell trash has two spellings of "no shell" and a folder named against
  the log;
- the client wire spells its types, its refusal reader and its shared
  `DELETE` in more places than one;
- the page holds half its bargain itself, writes its own query, and lets a
  refusal outlive its title;
- the two dialogs share furniture by reaching into each other's styles;
- the prototype, the docblocks and the documents still describe the code
  before step 30.

### 1. The list read lives in the route layer

- **About 130 lines of domain logic sit in `routes/index.ts`.**
  `libraryTitleList`, `linkedFilesOf` and `readLibraryTitles` read every
  Library folder's reach, join every Stored path into an absolute one, choose
  each row's `path` (a linked Source folder, a Collection folder film's
  video, a loose episode's folder, else the Media folder), and ask
  `linkedFiles` for each title. CLAUDE.md's rule for `routes/` is "HTTP layer
  only: parse request, call a domain module, return response". The
  precedents for moving a read out of the route are `exportSummary` ("the
  Export summary out of the route") and `admitFolder` ("the folder add's
  rules out of the route"). The rule has no suite of its own: it is pinned
  only through `routes.libraryTitles.test.ts`.
- **The row's `path` is a three-deep nested ternary** inside a closure named
  `placed`. It is the one rule the dialogs print, and it has no name.
- **`others` is filtered with `includes` inside a loop over every title**,
  quadratic in the episodes the library holds.
- **`linkedFiles` re-spells `folderOverlap`.** Its private `fold` and
  `within` resolve a path, fold its case on Windows and compare by whole
  segments. That is `folderOverlap`'s rule, word for word in its docblock:
  "resolved, case-insensitively on Windows, by whole segments". `admitFolder`
  already reads it from `import-export/`.
- **`clearSeriesDetails` filters empty paths twice.** `artOf` drops `''` from
  the poster and backdrop; the series clear then filters the whole list for
  `''` again, to catch the Season posters and Stills.

### 2. The Shell trash

- **"No shell" is spelled twice.** `createMedia` defaults its `trash` to a
  private `NO_TRASH`, which answers `unavailable`. `createShellTrash` with no
  parent port builds a second Trash that answers `unavailable`.
- **The folder is named against the log and its siblings.** Log 47 Q19 and
  the glossary place it at `shell/shellTrash/`. Its siblings in `shell/` are
  named for what they are (`shellHandshake/`, `listen/`,
  `orderedShutdown/`), and `componentSlot/` is the precedent for a folder
  named for the thing whose factory it exports (`createComponentSlot`). The
  build named it `shell/createShellTrash/`.

### 3. The client wire and its types

- **`Extract<LibraryTitle, { kind: 'movie' }>` is spelled three times**, and
  its series twin three times: in `types/libraryTitles.ts`' `LibraryTitles`,
  as private aliases in the feature's `api/`, and again in
  `makeLibraryTitle`.
- **`deleteTitleAt` lives in `deleteMovie/` and `deleteSeries/` reaches into
  it.** `src/api/` is one folder per call. A helper two calls share is its
  own folder, `postValue/`'s precedent.
- **The refusal reader is spelled three times.** `deleteTitleAt`'s
  `namesAReason` is a copy of the settings `api/`'s `namesAReason`, which
  reads `factoryReset`'s and the Component routes' sentences. The
  import-export `api/` reads the same `{ error }` body a third time. Three
  features now read a route's refusal sentence the same way: the rule that
  moves a wire concern to `src/api/`.

### 4. The page

- **The bargain is split between the hook and the organism.**
  `useLibraryTitles` holds `deleteRefusal`, but `ManageLibrary` holds
  `clearing` and `deleting` itself, around each call. Every other hook
  behind a confirm owns its in-flight state and its refusal together:
  `useDeleteMovie` (`{ deleting, refusal, deleteMovie }`), `useDeleteSeries`,
  `useFactoryReset` (`{ resetting, refusal, reset }`).
- **A refusal outlives its title.** `deleteRefusal` is cleared only by the
  next delete's answer. Refuse _Delete…_ on one linked title, press Cancel,
  open _Delete…_ on another: the second title's dialog draws the first
  title's sentence above its buttons. On the detail pages the dialog has one
  title, so "held until the next press is answered" is safe there. Here it
  is not. `useSubtitles` is the precedent: its Cue list is "held against the
  row it came from".
- **`clearDetails` spells its write twice**, once per kind, where
  `deleteTitle` beside it keys one write by `list`.
- **The organism writes its own query.** `choose` copies the search params,
  deletes `tab` at `movies` and sets it otherwise, as a replace. That is
  `useQueryParamWriter`'s whole job, and `LibraryTabs` writes the same `tab`
  through it. The writer still lives in `features/search/`, imported by three
  other features. Moving it to `hooks/` was left open by the Add and sync
  journal entry, and the page would be its fourth feature.
- **Words and paths are spelled in components.**
  - The Clear dialog spells its own **What goes** / **What stays** and its
    noun. The Delete dialog's words are `deleteView`'s, in the pure unit.
  - `ManageLibrary` spells the empty card's two sentences and turns its
    `Tab` into a kind for `tabSummary`.
  - `TitleRow` chooses between `moviePath` and `seriesPath`, between
    `{ movie }` and `{ series }` for the form, and between them again for
    `enrichPath`, inline. The Add and sync precedent is `addLeaving`, a pure
    unit answering where a press goes, with rows in its suite.
- **`titleRowView` is named for one of its three callers.** It answers the
  row's words, the toolbar summary and the Delete dialog's words. Its
  siblings across the app are named for what they read: `importView`,
  `enrichmentView`, `codecView`.

### 5. The dialogs

- **`DeleteTitleDialog.styles.ts` re-exports `ClearDialog.styles.ts`.** One
  unit's styles are imported by its sibling, and both dialogs repeat the same
  two-column **What goes** / **What stays** JSX. The feature-flat precedents
  for furniture two units share are `filesCard.styles.ts` (movie-form),
  `pathField.styles.ts` (import-export) and `section.styles.ts` (settings).
- **Optional props where the only caller always passes them.**
  - `DeleteTitleDialog.refusal` is optional, defaulting to `null`.
  - `EditMenu.linked` and `SeriesEditMenu.linked` are optional, defaulting
    to `false`.

  Each has one caller, and it always passes the prop. The Audio tracks round
  made such props required.

- **`(movie.videoFolderId ?? null) !== null`.** `detailView` and `seriesView`
  guard a field `StoredVideo` already types as `string | null`.

### 6. Tests, prototype, docblocks and documents

- **Two new lint warnings.** `deleteMovie.test.ts` escapes `\M` and `\C` in a
  path string, `no-useless-escape`.
- **The prototype was not amended for phases 5 and 7.**
  - `page.ManageLibraryPage.dc.html` still draws the handoff's linked delete:
    _deletes its folder from disk_, _Delete folder_, and a callout saying the
    files _won’t be in the Recycle Bin_. That is the opposite of what
    shipped. Its own comment says "a linked one's words wait for the linked
    delete". It draws no refusal line.
  - `page.MoviePage.dc.html` and `page.SeriesPage.dc.html` draw neither the
    linked sentence nor the refusal line.
  - `COMPONENT-SPEC.md` has no row for any `manage-library` unit, no `hint`,
    `disabled` or `MenuDivider` on `Menu`, and `DeleteSeriesDialog`'s props
    without `linked`.
- **The documents.**
  - CLAUDE.md and the README still carry step 30 as 🔜, its two halves and
    its "to settle in the grill" text. There is no step 31.
  - CLAUDE.md's _Desktop Build_ still says a linked video is "never deleted
    by the app", and so does the Maintainer tools' _Link or copy_ row. The
    Shell bullet names `ready` / `fatal` / `shutdown` only.
  - The Settings Hub lists no `/api/library-titles`, no `clear-details`
    route, and no `409`s on the two `DELETE`s.
  - The folder tree has no `manage-library/`, `ManageLibraryPage`,
    `titles/`, `linkedFiles/`, `shellTrash/`, `trashItems/`, `BinIcon`,
    `libraryTitles.ts` or `makeLibraryTitle/`. Its `src/api/` line names ten
    calls, and the movie-detail and series `api/` lines still list
    `deleteMovie` and `deleteSeries` as one caller's each. `useDeleteMovie`'s
    line has no `refusal`.
  - The `api/` prose does not say `deleteMovie` and `deleteSeries` earned
    their place.

## Solution

The list read leaves the route for `media/libraryTitleList/`, `exportSummary`'s
shape: storage and the media root in, the **Library titles** and each title's
Linked files out. Its row-path rule gets a name and rows. `linkedFiles`
compares paths through `folderOverlap`. The route keeps HTTP.

The Shell trash has one "no shell", `media`'s, and lives at `shell/shellTrash/`.

On the client, the two narrowed title types get names, `deleteTitleAt` gets
its own folder, and the refusal reader becomes `src/api/refusalSentence/`,
read by all three features. `useLibraryTitles` owns the whole bargain,
`useDeleteMovie`'s shape, and holds a refusal against the title it answered.
That is the round's one visible change, a `fix:`. The page writes `tab`
through `useQueryParamWriter`, now in `hooks/`. The pure unit, renamed
`libraryTitleView`, answers every word and every path the page draws. The two
dialogs share one flat styles file and one **What goes** / **What stays**
molecule.

The prototype catches up with what shipped, and the documents learn the
feature shipped.

Nothing on the wire, in the schema, in the delete's order or in the clear's
behaviour changes.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [manage-library] issue #414 …`, except where a commit is named
`fix:`, `test:` or `docs:`.

### Group 1 — the list read, out of the route

1. **`linkedFiles` compares paths through `folderOverlap`.**
   - "Within a folder" is `folderOverlap(path, [folder])` answering `same` or
     `inside`. "Is the Library folder itself" is it answering `same`.
   - The private `fold` and `within` go, and so do their `node:path` imports.
   - `media/` reads a pure unit of `library/folders/`, as `admitFolder` in
     `import-export/` does.
   - Covered by `linkedFiles.test.ts` as it is, including its "a name that
     only begins with the Source folder's" row. Case folding is
     `folderOverlap`'s suite's.
2. **`libraryTitleList` moves out of the route, verbatim.**
   - A new unit, `server/src/media/libraryTitleList/`, exports
     `libraryTitleList(storage, mediaPath)` →
     `{ titles: LibraryTitles; linkedFilesOf(kind, id) }`. The second member
     is the Linked files answer the delete trashes, `null` for a copied
     title.
   - The body is the route's `readLibraryTitles`, moved as it is.
   - The route's three readers read it: the list, the delete's
     `trashedFirst`, and the clear's echo. The route's three private
     functions go.
   - Covered by `routes.libraryTitles.test.ts`, `routes.clearDetails.test.ts`,
     `routes.linkedDelete.test.ts` and `routes.shellTrash.test.ts`, none of
     which changes.
3. **The row's path, named.**
   - The nested ternary becomes a private `titlePath`, written as a sequence
     of early answers in the rule's order: a copied title's Media folder; a
     linked Collection folder film's video; a linked Source folder; a linked
     title with no Source folder, its first video's folder.
   - `others` reads through a `Set` of every linked video, less the title's
     own.
   - `libraryTitleList.test.ts` is born with one row per answer of
     `titlePath`, and one per Linked files kind read through it. Its
     fixtures are `libraryFixture`'s and `seriesFixture`'s, the route suites'
     own.
4. **`clearSeriesDetails` filters once.**
   - One private `heldPaths(paths)` drops `null` and `''`. Both clears answer
     through it: the film's art, and the series' art, Season posters and
     Stills together.
   - Covered by `titles.clear.test.ts`.

### Group 2 — the Shell trash, one spelling

5. **One "no shell".**
   - `createMedia` exports its `NO_TRASH`, "the Trash with no shell behind
     it".
   - `createShellTrash` with no parent port answers it, rather than building
     its own.
   - Covered by `createShellTrash.test.ts`'s inert case and
     `createMedia.test.ts`.
6. **`shell/createShellTrash/` is `shell/shellTrash/`.**
   - Log 47 Q19's name, the glossary's, and its siblings' shape. The factory
     keeps its name, `createShellTrash`: `componentSlot/`'s
     `createComponentSlot` is the precedent.
   - A move. `server/src/main.ts` re-points its import.

### Group 3 — the client wire

7. **`LibraryMovieTitle` and `LibrarySeriesTitle`.**
   - `types/libraryTitles.ts` names the two narrowed kinds, and
     `LibraryTitles` is written over them. The category barrel exports both.
   - The feature `api/`'s private aliases and `makeLibraryTitle`'s go.
8. **`deleteTitleAt` has its own folder.**
   - `src/api/deleteTitleAt/` holds `deleteTitleAt` and `DeleteOutcome`,
     `postValue/`'s precedent for a helper two calls share.
   - `deleteMovie` and `deleteSeries` each import it from there, and each
     keeps its one line.
   - The outcome rows (`204`, `404`, `409` with and without a sentence,
     anything else) move from `deleteMovie.test.ts` into
     `deleteTitleAt.test.ts`. `deleteMovie.test.ts` and
     `deleteSeries.test.ts` keep the rows for their own route.
9. **`refusalSentence`, read once.**
   - `src/api/refusalSentence/`: a refused response → the route's own
     sentence, read off a JSON `{ error: string }`, else `null`. It never
     rejects.
   - Its callers: `deleteTitleAt`; the settings `api/`'s `factoryReset` and
     Component refusals; and the import-export `api/`'s refusal reader.
     That is three features, the rule that earns a place in `src/api/`.
   - Both copies of `namesAReason` go.
   - `refusalSentence.test.ts` is born with its rows: a sentence, no body, a
     body that is not JSON, an `error` that is not a string. Every caller's
     suite is unchanged.

### Group 4 — the page

10. **`useQueryParamWriter` moves to `hooks/`.**
    - `src/hooks/useQueryParamWriter/`, a global hook used by three features.
      That closes the Add and sync journal's follow-up.
    - A move. `useGenreQuery`, `useLibraryQuery`, `LibraryTabs` and
      `useMovieForm` re-point their imports.
11. **The page writes `tab` through it.**
    - `choose` becomes `setParam('tab', next, 'movies')`, `LibraryTabs`'
      shape, and the hand-built `URLSearchParams` goes.
    - Covered by `ManageLibrary.test.tsx`'s tab cases: a replace, omitted at
      movies.
12. **`titleRowView/` is `libraryTitleView/`.**
    - Named for what it reads, a **Library title**, as `importView` and
      `enrichmentView` are. `titleRowView`, `tabSummary` and `deleteView`
      keep their names.
    - A move.
13. **Every word the page draws is the view's.**
    - `clearView(title)` → the Clear dialog's sentence, **What goes** and
      **What stays**, `deleteView`'s twin. The dialog's own constants go.
    - `emptyLine(kind)` → _No movies in your library._ /
      _No series in your library._
    - `tabSummary` is called with the tab's own kind. The page's `Tab`
      becomes `LibraryTitle['kind']` in the URL's words: `movies` ↔ `movie`
      is read once, where the param is read.
    - `libraryTitleView.test.ts` gains the rows for `clearView` and
      `emptyLine`. Both dialogs' and the page's suites are unchanged.
14. **Every path the row pushes is the view's.**
    - `titlePaths(title)` → `{ edit, page, sync }`: the Movie form's edit,
      the title's page, and its Sync **Started on arrival**. That is
      `addLeaving`'s precedent.
    - `TitleRow`'s `sync` pushes `page`, then `sync`. _Edit details_ pushes
      `edit`. The three inline kind branches go.
    - `libraryTitleView.test.ts` gains a row per kind. `TitleRow.test.tsx`'s
      `LocationProbe` cases are unchanged.
15. **`useLibraryTitles` owns the bargain.**
    - It answers
      `{ titles, clearing, clearDetails, deleting, deleteTitle, refusal }`,
      `useDeleteMovie`'s and `useFactoryReset`'s shape.
    - `clearDetails` writes through one `replaced(list, echo)`, keyed by
      kind as `deleteTitle` already is.
    - `ManageLibrary`'s two in-flight states and the `set…` around each
      call go. It keeps only which dialog is open and for which title.
    - `deleteRefusal` is renamed `refusal`. Its behaviour is unchanged in
      this commit.
    - Covered by `useLibraryTitles.test.ts`, whose cases gain the in-flight
      reads, and `ManageLibrary.test.tsx`.
16. **`fix: [manage-library] issue #414 a refusal stays with its title`.**
    - The hook holds a refusal against the title it answered: `refusal` is
      the sentence only while the Delete dialog is open on that title.
      Another title's dialog draws none.
    - The same title's dialog reopened still draws it until the next press
      is answered, the detail pages' rule.
    - `ManageLibrary.test.tsx` gains the case: a refused delete on one title,
      Cancel, _Delete…_ on another, no refusal drawn. It fails before this
      commit.
    - The body names the failure and `useSubtitles`' "held against the row it
      came from".

### Group 5 — the dialogs

17. **One furniture for both dialogs.**
    - `features/manage-library/titleDialog.styles.ts`, flat as
      `filesCard.styles.ts` is: the path well, the two columns, their heading
      and list, and the buttons.
    - A feature molecule, `GoesAndStays/` (`.tsx`, `.test.tsx`,
      `.styles.ts`): **What goes** beside **What stays**, `{ goes, stays }`.
      Both dialogs draw it.
    - `ClearDialog.styles.ts` goes. `DeleteTitleDialog.styles.ts` keeps only
      its own `Callout`, `CalloutMark` and `Refusal`, and re-exports nothing.
    - No pixel changes. `GoesAndStays.test.tsx` pins both headings, both
      lists and their order. Both dialogs' suites are unchanged.
18. **Required where the caller always passes.**
    - `DeleteTitleDialog.refusal`, `EditMenu.linked` and
      `SeriesEditMenu.linked` become required. Their defaults go.
    - The suites' harnesses gain the prop's default. No case changes.
    - `detailView` and `seriesView` read `videoFolderId !== null`, as
      `StoredVideo` types it. If a fixture omits the field, the fixture is
      completed in the same commit.

### Group 6 — the tests

19. **`test: [manage-library] issue #414 the delete suite lints clean`.**
    - `deleteMovie.test.ts`'s path is written with `String.raw`, or its
      backslashes doubled, so that `no-useless-escape`'s two warnings go.
      (After commit 8 the path may sit in `deleteTitleAt.test.ts`; the fix
      follows it.)
    - No assertion changes.

### Group 7 — the docs that close the initiative

20. **`docs: [manage-library] issue #414 the prototype draws what shipped`.**
    - `page.ManageLibraryPage.dc.html`:
      - the linked Delete dialog in log 47 Q12's words for `folder`,
        `videos` and `unreachable`;
      - _Delete movie_ / _Delete series_ for every title, never _Delete
        folder_;
      - the Recycle Bin callout, and the refusal line above the buttons.

      The stale comment goes.

    - `page.MoviePage.dc.html` and `page.SeriesPage.dc.html` draw the linked
      sentence and the refusal line (log 47 Q16).
    - `COMPONENT-SPEC.md`:
      - rows for `ManageLibrary`, `TitleRow`, `ClearDialog`,
        `DeleteTitleDialog` and `GoesAndStays`;
      - `Menu`'s `hint`, `disabled` and `MenuDivider`;
      - `DeleteSeriesDialog`'s `linked`.

    - `handoff-manage-library/` stays as received.

21. **The docblocks catch up.**
    - Any docblock naming `titleRowView`, `createShellTrash/`,
      `namesAReason` or the organism's in-flight state is reworded for where
      the thing now is.
    - The route file's comment over the three Manage library routes names
      `libraryTitleList`.
    - No code changes.
22. **`docs: [manage-library] issue #414 the docs know manage library shipped`.**
    - **CLAUDE.md**:
      - Step 30 goes ✅, its text rewritten to what shipped:
        - the page, the Title row, the Details state;
        - Edit, Sync **Started on arrival**, Clear details;
        - the one Delete, with Linked files to the Recycle Bin through the
          Shell trash, and its two `409`s;
        - no migration.
      - A new step 31, 🔜 **Add a show folder**, carrying step 30's first
        half and log 47 Q1's reason. The build order's sentence names step
        30 as done and step 31 as next.
      - The Maintainer tools' _Manage library_ row goes ✅. A 🔜 _Add a show
        folder_ row is added.
      - _Desktop Build_'s Media storage bullet and the _Link or copy_ row: a
        linked video is played read-only and removed only by a Delete, only
        to the Recycle Bin. The Shell bullet: the handshake's `trash` /
        `trashed` exchange.
      - _Settings Hub_: the Manage library page bullet, with
        `GET /api/library-titles`, the two `clear-details` routes and the
        two `DELETE`s' `409` sentences.
      - The `api/` prose: `deleteMovie` and `deleteSeries` (the detail
        pages and the Manage library page) and `refusalSentence` (three
        features' refusals).
      - The folder tree:
        - `electron/`: `trashItems/`, and the `main.ts` and `serverHandle/`
          lines.
        - server: `library/titles/`, `media/linkedFiles/`,
          `media/libraryTitleList/`, `createMedia`'s `trashLinked`,
          `shell/shellTrash/`.
        - `src/`: `features/manage-library/`, whole; `ManageLibraryPage` in
          `pages/`; `Menu`'s `hint`, `disabled` and `MenuDivider`;
          `BinIcon` on the Icon line; `deleteMovie/`, `deleteSeries/`,
          `deleteTitleAt/` and `refusalSentence/` in `src/api/`;
          `useQueryParamWriter` in `hooks/`.
        - The movie-detail and series `api/` lines lose their delete calls,
          and `useDeleteMovie`'s line gains `refusal`.
        - `types/`: `libraryTitles.ts`, and `shell.ts`' trash exchange.
        - `test-support/`: `makeLibraryTitle/`.
    - **README**: step 30 and its row go ✅. Step 31 and its row are added,
      🔜.
    - **Glossary**: **Shell trash** names `shell/shellTrash/`; the **Library
      title** row names `libraryTitleList`. The dialogue sections are
      snapshots and stay as they are.
23. **`docs: [manage-library] issue #414 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 406 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **The route keeps HTTP.** `media/libraryTitleList/` answers the list and
  each title's Linked files. It takes `LibraryStorage` and the media root,
  `exportSummary`'s shape, and never throws. It lives in `media/` for log 47
  Q19's reason: which of a Library folder's files are a title's is folder
  knowledge. The delete still reads the whole library to learn one title's
  Linked files, because `others` is every held title.
- **One spelling of "within a folder".** `folderOverlap` owns resolving, case
  folding and whole-segment comparison. `linkedFiles` asks it.
- **One "no shell".** `media`'s `NO_TRASH` is the Trash with no shell behind
  it. `createShellTrash` answers it with no parent port.
- **`shell/shellTrash/`**, exporting `createShellTrash`, as `componentSlot/`
  exports `createComponentSlot`.
- **Named narrowed types.** `LibraryMovieTitle` and `LibrarySeriesTitle` are
  the one spelling of each kind of Library title.
- **`src/api/` gains two helpers, each in its folder.** `deleteTitleAt` (two
  calls) and `refusalSentence` (three features). Neither is a call a feature
  makes by name. Both follow `postValue/`'s precedent.
- **`useQueryParamWriter` is a global hook**, used by four features.
- **The pure unit is `libraryTitleView`.** It answers every word and every
  path the page draws: the row, the summary, the empty card, both dialogs,
  and `titlePaths`.
- **`useLibraryTitles` owns the bargain**: `{ titles, clearing, clearDetails,
deleting, deleteTitle, refusal }`. Neither write rejects.
- **A refusal is held against its title.** It is drawn only in that title's
  Delete dialog, until the next press is answered. This is the one behaviour
  change, shipped as a `fix:`.
- **The dialogs share `titleDialog.styles.ts` and `GoesAndStays`.** Callout
  and Refusal stay the Delete dialog's own.
- **Props are required where their one caller always passes them.**
- **Nothing on the wire, in the schema, in the delete's order, in the
  clear's behaviour or in any pixel changes.** `LibraryTitle`,
  `LibraryTitles`, `LinkedFiles`, `DetailsState`, `ServerMessage`,
  `ShellCommand`, `Trash` and `TrashOutcome` keep their shapes.
  `LibraryTitlesState` gains `clearing`, `deleting` and `refusal`, and loses
  `deleteRefusal`.

## Testing Decisions

A good test drives a unit through its public interface and asserts what a
caller sees: a status and a body, a path in a list, a request posted, a row
drawn or gone, a sentence in a dialog, a URL. It never asserts which helper
ran. The initiative's suites are thorough and behavioural:

- on the server, `titles`, `titles.clear`, `linkedFiles`, `createMedia`,
  `createShellTrash`, and the five route suites (`libraryTitles`,
  `clearDetails`, `linkedDelete`, `shellTrash`, `linkedVideo`);
- in the shell, `trashItems` and `serverHandle`;
- on the client, `Menu`, `TitleRow`, `ClearDialog`, `DeleteTitleDialog`,
  `ManageLibrary`, `useLibraryTitles`, `titleRowView`, the feature `api/`,
  `deleteMovie`, `deleteSeries`, both detail dialogs and both delete hooks.

This round moves rules, not behaviour, so almost every commit is carried by
cases that already exist.

- **New suites are born for units that are born** (commits 3, 8, 9 and 17):
  - `libraryTitleList`, the path rule's answers;
  - `deleteTitleAt`, the outcome rows moved from `deleteMovie`;
  - `refusalSentence`, its four rows;
  - `GoesAndStays`.

  Prior art: `exportSummary.test.ts`, `postValue.test.ts`, and
  `formJob.test.ts`'s Landing rows for a rule moved into a pure home.

- **The pure view gains rows** (commits 13 and 14): `clearView`,
  `emptyLine` and `titlePaths`. Prior art: `addLeaving`'s rows.
- **The fix is proven by one new case** (commit 16), written to fail before
  the commit: a refusal on one title, not drawn on another's dialog.
- **The journeys are already pinned.**
  - The list, the paths, the badge and the unreachable line in
    `routes.libraryTitles.test.ts`.
  - The delete's order and its two `409`s in `routes.linkedDelete.test.ts`.
  - The clear's echo in `routes.clearDetails.test.ts`.
  - The push-push into the flow in `TitleRow.test.tsx`.
  - The tab's replace in `ManageLibrary.test.tsx`.

  None of these cases changes, except the harnesses of commit 18, which gain
  defaults. A suite that has to change anywhere else is reading an
  implementation detail, and is fixed in the same commit with the reason in
  the body.

- Every commit runs the full suite and `tsc -b --force`, and `eslint` over
  the folders it touched.

## Out of Scope

- **The detail dialogs' paragraph beside the linked sentence.** For a linked
  film, _The original files are not touched._ is followed by _Its video goes
  to the Recycle Bin._ That reads as a contradiction. But log 47 Q16 kept the
  paragraph word for word, so changing it is a copy decision for a grill, not
  a refactor.
- **"Already gone" checked on both sides of the Shell trash.**
  `trashLinked` skips a missing path, and so does `trashItems`. Both
  behaviours are specified (plan phases 5 and 6). The server's check lets a
  retry with everything already gone succeed without a shell. Main's check
  covers a path that vanishes between the two.
- **A delete reading the whole library.** Linked files needs every other
  title's videos, so the delete reads them all. Reading only the title's own
  folder's reach would be an optimisation, not a convention.
- **The `Refusal` line spelled in five styles files** (the Reset dialog, both
  detail dialogs, the Delete title dialog, `pathField.styles.ts`), and the
  danger tint spelled as `rgba(201, 122, 106, …)` in five places. Each is a
  graduation (a molecule, a `dangerSoft` token) across features that predate
  this initiative, so each is its own change.
- **`detailsStateSql`'s `filled` beside `fullDetails`' "IS NOT NULL AND
  <> ''".** Two SQL fragments over different column lists in two units of
  `library/`; one shared fragment would couple `titles/` to `enrich/` for one
  line.
- **Non-null assertions in the new suites.** These are the suites' prevailing
  style across the codebase, not a new kind of warning.
- Anything log 47 put out of scope: _Add a show folder_ (step 31), search,
  sort and bulk actions on the page, size on disk, an exclusion list, an
  episode delete, Clear details on the detail pages, a permanent delete.

## Further Notes

- Groups 1 and 4 are the round's real moves. Group 1 is covered before it
  changes by the four route suites from 407–412. Group 4 is covered by the
  page's and the hook's suites from 407–411.
- Commit 16 is the only change a household could see: a refusal no longer
  drawn on the wrong title.
- Commit 20 is overdue: phases 5 and 7 each said "first, the prototype", and
  the promoted page still contradicts what shipped.
- Follow-ups this plan already sees, each for the journal, not this round:
  - **The detail dialogs' words for a linked title**, for a grill (see Out of
    Scope).
  - **A `Refusal` molecule and a `dangerSoft` token**, each across the
    features that spell them.
  - The follow-ups the Audio tracks entry left open: the sandbox teardown
    flake, and the lint error in `EnrichmentReview.test.tsx`.
    `useQueryParamWriter` to `hooks/` is closed by commit 10.
