# Refactor plan: Add a show folder — the read that knows its folder, one spelling of each placement rule, the add routes back to HTTP, and the docs that close the initiative

> Source initiative: `add-a-show-folder`, issue 416 (step 31).
> Shipped by issues 417–420, RED and GREEN each: 417 `a079b37`/`2c58f42`,
> 418 `71d4559`/`aaa2d71`, 419 `0a3f4aa`/`0e64735`, 420 `f00dcd3`/`d32145a`.
> The prototype and `COMPONENT-SPEC.md` were amended inside each phase's
> GREEN commit.
> Design log: `docs/design-logs/48-add-a-show-folder.md`. PRD:
> `docs/PRDs/48-add-a-show-folder.md` (416). Plan:
> `docs/PRDs/48-add-a-show-folder-plan.md`.
> This is the initiative's closing round. It ticks **Add a show folder** and
> closes 416. Filed as issue 421.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`add-a-show-folder` shipped every slice of log 48's implementation plan. At
`d32145a` the full suite has **10485 tests across 628 files, all passing**.
`tsc -b --force` is clean. `eslint src server electron` reports one error and
150 warnings, against one error and 148 warnings when Manage library closed.
The two new warnings are both in this initiative's files:

- `no-loop-func` in `MovieForm.showFolder.test.tsx`;
- `react-hooks/exhaustive-deps` on `sentMovie` in `useMovieForm`.

The four build slices were built one at a time by agents that each saw one
slice. The design held:

- one reader for a show, `readShowFolder` over `walkLibraryFolder` and
  `groupShows`, with no second numbering rule;
- `numberFoundRows` shared by the Series Resolve and the pick;
- `placeFoundVideo` extracted and called by the importer;
- the **Path bridge** in the preload, faked at `folderBridge()`;
- `ImportModeChoice` and `ChoiceCard` graduated to `components/`.

The seams show elsewhere, and one of them is a bug a household would see.
Every finding below was checked against the code for this plan. They fall
into seven families:

- the Show folder read never says which Library folder it lies under;
- "under a listed folder" is spelled twice, and so are a show's folder and a
  film's Source;
- the two add routes hold domain logic and spell their refusals twice;
- the client wire spells its refusal reader and its mode argument its own way;
- `useMovieForm` holds two new bargains inline;
- props are optional where the only caller always passes them;
- tests, comments and documents lag what shipped.

### 1. The read never answers its Library folder

- **`readShowFolder` answers `libraryFolderId: null` on every read.** No code
  sets it: the importer's `readShowFolder` member passes only the held Show
  folders, and the unit has no list of Library folders to read it from.
- `useMovieForm` disables Link whenever the read's `libraryFolderId` is
  `null`. So in the installed app, **every Show folder pick disables Link and
  forces Copy**, even for a show inside a listed Library folder. Phase 2's
  demo, "pick a show under a Library folder, save in Link, and it plays with
  nothing copied", cannot be done from the form.
- The PRD's testing decisions asked for "`libraryFolderId` under a listed
  folder and `null` outside". Neither `readShowFolder.test.ts` nor the two
  route suites has that row. The form's suites fake the read with the id set,
  so nothing failed.
- **The held check spells its own rule.** The importer's member joins every
  held series's Library folder path and `sourceFolder` into an absolute path,
  and `readShowFolder` compares the pick against the list with `relative`.
  The importer already reads "the folder on record" one way: `heldShow` and
  `heldFilm` ask `storage.titleAt(folderId, sourceFolder)`. Once the read
  knows its Library folder, the held check is that same question.
- `ShowFolderContext.heldShowFolders` is optional, defaulting to `[]`, though
  its one caller always passes it.

### 2. Placement rules, spelled twice

- **"Strictly under a folder" is written twice, word for word.** `isUnder`
  sits in `placeFoundVideo.ts` and again in `createImporter.ts`.
- **"The listed folder a path lies under" is written twice too.**
  - `placeFoundVideo.ts` exports `listedFolderOf(folders, path)`, the deepest
    match. The route's containing read, `placeFilmFolder` and
    `placeShowFolder` import it from there.
  - The importer keeps a private `listedFolderOf(dir)`, the first match, for
    its two review presses.
  - The Manage library round settled that "within a folder" is
    `folderOverlap`'s rule (resolved, case-folded on Windows, by whole
    segments). `linkedFiles` and `admitFolder` read it. Neither copy here does.
- **The Placed video rule is still spelled twice.** The PRD promised one
  rule for the importer, the Resolve and the add routes. The Resolve and the
  add routes call `placeFoundVideo`. A run's own `placeVideo` still spells
  the Linked video itself with `spellLinkedVideo`. The private `linkedVideo`
  is now a one-line wrapper around the shared rule.
- **`placeShowFolder` lives inside `placeFoundVideo.ts`.** That is a second
  unit in one folder, and it has no suite of its own. It also re-spells
  `groupShows`' rule for a show's folder ("a Season folder's parent, else the
  folder itself") through `seasonOf`. So the add and a scan could disagree
  about where a show lies.
- **`placeFilmFolder` re-spells the importer's film Source.** Its
  `relative(...).split(sep).join('/')` is the importer's private
  `sourceFileOf`. Its collection test is `collectionFileOf`. The PRD said the
  Source rule is "the importer's existing `setSourceFolder` rule, reused".
  `placeFilmFolder` has no suite either: it is pinned only through
  `routes.addMovieLinked.test.ts`.

### 3. The add routes hold domain logic

- **About 150 lines of placement and copying were added inline** to
  `POST /api/series` and `POST /api/movies`:
  - each found video placed;
  - the all-or-none Link refusal;
  - the Show folder's Source;
  - a reserved folder when only found rows arrive;
  - the series' copy loop, with its `copy` closure over the season folder;
  - the found subtitles' copy.

  CLAUDE.md's rule for `routes/` is "HTTP only: parse, call a domain,
  respond". The Manage library round moved a read out on that rule
  (`libraryTitleList`, after `exportSummary` and `admitFolder`).

- **The Link refusal is spelled twice**, once in each route:
  _Link needs a file inside one of your library folders._
- **The found-path check is spelled twice, in two wordings.**
  `seriesFormBody`'s private `foundPathRefusal` answers
  `Not an absolute path: "…"` / `Not a video file: "…"`. The movie route
  checks the same two things inline and answers
  _The video path must be absolute._ / _The video path must name a video
  file._
- **The route file's comments now say what is no longer true.**
  - The Resolve route's block still calls itself "the only route in the app
    that accepts a path", and says "`POST /api/movies` keeps accepting bytes
    only, whatever a path field says". Log 48 reversed that for the add,
    deliberately. The Loopback guard is what keeps such a route off the
    network.
  - The two new `GET`s were inserted between the Library folders list's
    comment and its route. The list's comment now heads `GET /show-folder`.

### 4. The client wire

- **`readShowFolder` reads a refusal its own way.** It casts the `400` body
  to `{ error: string }`. `src/api/refusalSentence/` was born in the last
  round as the one reader of a route's refusal, for three features. The
  movie form would be the fourth.
- **The two creates take the mode two ways.**
  - `createMovie(values, mode = 'copy')`: last, and optional.
  - `createSeries(mode, values, episodes, seasonPosters)`: first, and
    required.
  - The two body builders take it last and optional, because an edit and a
    Resolve send none.
- **The wire rule for a linked movie sits in the hook.** `sentMovie` turns a
  picked video into a found one in Link, and it is rebuilt on every render
  (the exhaustive-deps warning). The series' equivalent (folder rows travel
  as their paths) lives in `formValues`, the pure wire builder, with rows in
  its suite.
- **`showFolderRows` and `isShowFolderRow` have no rows of their own.**
  `numberFoundRows` was born with a suite. The function that builds the
  pick's rows, keys and tracks is pinned only through the four `MovieForm`
  suites. `useEpisodeList`'s new `holdShowFolder` and `removeShowFolder` have
  no cases in `useEpisodeList.test.ts` either.

### 5. The hook

- **`useMovieForm` grew by about 165 lines to 968.** Two bargains were added
  inline:
  - **the Import mode**: the chosen mode, two availability flags, the movie
    video's path, the containing read with its stale-answer counter, and the
    forced Copy;
  - **the Show folder pick**: the dialog, the read, the held series' title
    fetch, the refusal, the stray count, the row and the ✕.

  The feature's precedent for a bargain with its own state is a hook of its
  own that `useMovieForm` composes: `useEpisodeList` and `useSeasonPosters`.

- **The two availability states are misnamed as a pair.** The series flag is
  `showLinkDisabled` / `setLinkDisabled`, and the movie's is
  `videoLinkDisabled` / `setVideoLinkDisabled`.

### 6. Optional props with one caller

- `SeriesFormFiles`' four new props (`onAddShowFolder`, `showFolder`,
  `onRemoveShowFolder`, `straySubtitles`) are optional with defaults. Their
  one caller, `MovieForm`, always passes them. The Manage library round made
  such props required.
- `MovieForm.styles.ts`' `ModeSlot` docblock says "on a shell series add".
  It is drawn on both kinds.

### 7. Documents

- CLAUDE.md's _Movie form_ bullet still says the form "copies what it's
  given" and that "step 31 reopens this".
- The README carries step 31 and its row as 🔜. Its folder tree has no
  `readShowFolder`, `placeFoundVideo`, `placeFilmFolder` or Path bridge. Its
  `import-export/` feature line still lists `ImportModeChoice` and
  `ChoiceCard`, which now live in `components/`.
- The glossary's **Found file** still says the server copies one "only from
  under the Current run's Library folders". That is the Resolve's rule. The
  add copies a found path from anywhere absolute.
- `COMPONENT-SPEC.md`'s `MovieForm` props list has none of the new members.

## Solution

**The read answers the Library folder it lies under** (a `fix:`). It is
given the listed folders and asks the one `listedFolderOf`. Its held check
becomes the importer's "folder on record" question. A show inside a Library
folder can now be linked from the form.

**One spelling of each rule:**

- "under a listed folder" is `listedFolderOf`, in its own folder, reading
  `folderOverlap`;
- the Placed video is `placeFoundVideo`, read by a run as well;
- a show's folder is `groupShows`' own `showFolderOf`, read by
  `placeShowFolder` in its own folder;
- a film's Source is `filmSourceOf` in `placeFilmFolder/`, read by the
  importer too.

**The add routes keep HTTP.**

- The Link refusal is `placeFoundVideos`, the rule over a list, with the
  sentence spelled once.
- The series' copy loop is `copyFoundEpisodes` in `import-export/`.
- The found-path check is one `foundPathRefusal` in `routes/`, read by both
  adds.
- The stale comments go.

**On the client:**

- `readShowFolder` reads through `refusalSentence`.
- Both creates take `mode` last and required.
- A linked movie's wire shape is a pure `formValues` unit.
- `useImportMode` and `useShowFolderPick` hold their bargains, and
  `useMovieForm` composes them.
- `SeriesFormFiles`' props are required.

The pick's units get their own rows. The documents learn the feature shipped.

Nothing else on the wire, in the schema or in any pixel changes. The one
behaviour change is commit 4.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [add-a-show-folder] issue #421 …`, except where a commit is named
`fix:`, `test:` or `docs:`.

### Group 1 — one "under a listed folder"

1. **`listedFolderOf` has its own folder.**
   - A new unit, `server/src/import-export/listedFolderOf/`, exports
     `listedFolderOf(folders, path)`: the listed Library folder `path` lies
     strictly inside, the deepest of nested ones, or `null`.
   - "Inside" is `folderOverlap(path, [folder.path])` answering `inside`, as
     `linkedFiles` reads it. The folder itself is `same`, so it is not
     inside.
   - `placeFoundVideo.ts`' private `isUnder` and its `listedFolderOf` go.
     The containing route, `placeFilmFolder` and `placeShowFolder` re-point
     their imports.
   - No behaviour change: on Windows, `path.relative` already compared
     case-insensitively, and `folderOverlap` folds case.
   - `listedFolderOf.test.ts` is born with its rows: inside, the folder
     itself, outside, a sibling whose name only begins with the folder's, a
     path climbing out through `..`, another drive, and the deepest of two
     nested folders. `placeFoundVideo.test.ts` is unchanged.
2. **The importer's review presses ask the one `listedFolderOf`.**
   - The importer's private `listedFolderOf(dir)` goes. `pick` and
     `importGuessed` call the unit with `storage.libraryFolders()`, read
     live as before.
   - First match and deepest match agree here, because `admitFolder` never
     lets listed folders nest.
   - The importer's own `isUnder` stays: `foldersUnder` counts shelves with
     it, which is a different question.
   - Covered by `routes.importPick.test.ts`, `routes.importGuessed.test.ts`
     and `routes.importManyGuessed.test.ts`, unchanged.
3. **A run places its video by the one rule.**
   - `placeVideo` answers `placeFoundVideo([libraryFolder], file, mode)`,
     and copies in on `null`. Its own `spellLinkedVideo` branch goes.
   - The private `linkedVideo` wrapper is inlined at its one call.
   - Covered by the importer's linked-video suites and
     `routes.linkedVideo.test.ts`, unchanged.

### Group 2 — the read that knows its folder

4. **`fix: [add-a-show-folder] issue #421 a show folder read answers its library folder`.**
   - `readShowFolder`'s context becomes required: `{ folders, heldSeriesAt }`.
     `folders` is the listed Library folders. `heldSeriesAt(folderId,
sourceFolder)` answers the held series on record there, or `null`.
   - The read answers `libraryFolderId` as `listedFolderOf(folders, dir)`'s
     id.
   - The held check asks `heldSeriesAt` with the pick's folder relative to
     that Library folder. A pick under no Library folder has no folder on
     record, so it is never held.
   - The importer's member passes `storage.libraryFolders()` and a
     `heldSeriesAt` over `storage.titleAt`, kept only when the id is a held
     series. That is `heldShow`'s question. Its inline join over every
     series, `HeldShowFolder` and `heldShowFolders` go.
   - `readShowFolder.test.ts` gains three rows: under a listed folder → its
     id; outside → `null`; the Library folder itself → `null`. Its held rows
     pass the new context. That is a harness change, and no assertion
     changes.
   - `routes.showFolder.test.ts` gains the case that fails before this
     commit: a show inside a listed folder answers that folder's id.
   - The body names the failure: in the installed app every pick disabled
     Link.

### Group 3 — a show's folder and a film's Source, one spelling each

5. **`placeShowFolder` has its own folder, and reads `groupShows`' rule.**
   - `groupShows` exports `showFolderOf(dir)`: a Season folder's parent,
     else the folder itself. Its own `dir` line reads it.
   - `server/src/import-export/placeShowFolder/` holds `placeShowFolder`,
     moved out of `placeFoundVideo.ts`. It reads `showFolderOf` instead of
     `seasonOf`.
   - `placeShowFolder.test.ts` is born with three rows: a video in a Season
     folder, a loose tagged video, and a show under no listed folder → `null`.
     `groupShows.test.ts` is unchanged.
6. **A film's Source, one spelling.**
   - `placeFilmFolder/` exports `filmSourceOf(folder, scan)` → `FilmSource`.
     This is the importer's `relative(folder.path, scan.dir)` plus
     `collectionFileOf(scan)`, lifted out. `sourceFileOf` moves with it and
     is exported, because the importer's episodes still read it.
   - `placeFilmFolder(folders, video)` becomes the folder's scan plus
     `filmSourceOf`.
   - The importer's film `setSourceFolder` calls and `heldFilm`'s `titleAt`
     read `filmSourceOf`. Its private `collectionFileOf` and `sourceFileOf`
     go.
   - `placeFilmFolder.test.ts` is born with three rows: a film alone in its
     folder (no Source file), a Collection folder film (its Source file with
     forward slashes), and a video under no listed folder → `null`. Its
     fixtures are temp folders, `readShowFolder.test.ts`' harness.

### Group 4 — the add routes keep HTTP

7. **`foundPathRefusal` has its own folder.**
   - `server/src/routes/foundPathRefusal/` exports
     `foundPathRefusal(path, kind)` with `kind` either `'video'` or
     `'subtitle'`. It is the route layer's body-reading helper, like
     `onlyField` and `optionalText`.
   - `seriesFormBody`'s private copy goes. The movie add's two inline checks
     read it.
   - The movie's two sentences become the series': `Not an absolute path:
"…"` and `Not a video file: "…"`. The form never sends either. The two
     assertions in `routes.addMovieLinked.test.ts` follow, and the body says
     why.
   - `foundPathRefusal.test.ts` is born with four rows: relative, absolute
     of the right kind, a video slot given a subtitle, and a subtitle slot
     given a video.
8. **The Link refusal, spelled once.**
   - `placeFoundVideo/` gains `placeFoundVideos(folders, paths, mode)`, the
     rule over a list. `heldValues/`' two exports are the precedent for one
     rule at two arities.
   - An `undefined` path (a picked row's bytes) places as `null`. In Link,
     any found path under no listed folder refuses the whole list with
     `LINK_REFUSAL`. Otherwise it answers each Placed video or `null`.
   - Both add routes read it, and the sentence is spelled once.
   - `placeFoundVideo.test.ts` gains rows for the list: all placed, a picked
     row among found ones, one outside in Link refusing all, and Copy
     answering every `null`. The route suites are unchanged.
9. **`copyFoundEpisodes` leaves the route.**
   - `server/src/import-export/copyFoundEpisodes/` takes `media`, the Series
     folder, the read episodes and their placements. It answers each
     episode's `{ video, tracks }`:
     - a placed video kept where it lies;
     - a found video `copyIn`'d into its season folder;
     - a picked one's stored path;
     - its found subtitles copied beside it.

     It rejects on the first copy that breaks.

   - The route keeps the reservation, the rollback and the `500`. Its loop
     and its `copy` closure go.
   - `copyFoundEpisodes.test.ts` is born over a temp Series folder: a found
     video copied into `Season 02/`, a linked one untouched, tracks copied
     beside their video, and a missing file rejecting. The route suites
     (`addSeriesFound`, `addSeriesLinked`) are unchanged.

10. **The route's comments say what is true.**
    - The Resolve route's block loses "the only route in the app that
      accepts a path" and "`POST /api/movies` keeps accepting bytes only".
      In their place: the add takes a found path since log 48, the Loopback
      guard keeps it off the network, and what is the Resolve's own is that
      it copies only from under the Current run's folders.
    - The Library folders list's comment returns above its route.
    - No code changes.

### Group 5 — the client wire

11. **`readShowFolder` reads its refusal through `refusalSentence`.**
    - A `400` whose sentence reads is `{ kind: 'refused', sentence }`.
      Anything else not ok, a `400` with no sentence included, throws, as the
      other feature `api/` calls do.
    - `api.test.ts`'s refusal rows are unchanged. One row is added for a
      `400` with no JSON body.
12. **Both creates take `mode` last, and required.**
    - `createMovie(values, mode)` and
      `createSeries(values, episodes, seasonPosters, mode)`, in the body
      builders' order. `createMovie`'s `'copy'` default goes.
    - The builders keep `mode` optional: an edit and a Resolve send none.
    - `api.test.ts`' calls pass a mode. That is a harness change only.
13. **A linked movie's wire shape is `formValues`'.**
    - `movieAddValues(values, mode, videoPath)` → the values a movie add
      sends. In Link, a picked video with a path travels as a found file of
      that path. Otherwise the values are unchanged.
    - `useMovieForm`'s `sentMovie` goes. The save calls the unit inside its
      callback, so the exhaustive-deps warning goes.
    - `formValues.test.ts` gains four rows: Link with a path, Link with `''`,
      Copy, and a held video on no add.

### Group 6 — the hook

14. **`useImportMode`.** - A feature hook beside `useEpisodeList`:
    `useImportMode({ kind, plainAdd })` →
    `{ showImportMode, importMode, setImportMode, linkDisabled, videoPath,
readVideo(file), forgetVideo(), setShowLink(libraryFolderId) }`. - It owns everything the mode needs: - Link on every visit; - one availability per kind, so the movie's and the show's answers stay
    apart; - the forced Copy; - the Path bridge read; - the containing read with its stale-answer counter; - Copy in a browser. - `useMovieForm` composes it. The `showLinkDisabled` / `setLinkDisabled`
    pair goes. `UseMovieFormResult` keeps its members. - `useImportMode.test.ts` is born with rows for each of these: - Link by default; - Copy when unavailable; - re-enabled by a later answer; - a stale containing answer ignored; - `''` from the Path bridge; - no choice in a browser or on an edit.

          The `MovieForm` import-mode suites are unchanged.

15. **`useShowFolderPick`.** - A feature hook taking the episode list's `holdShowFolder` /
    `removeShowFolder`, the title prefill and `setShowLink`. It answers
    `{ addShowFolder, showFolder, removeShowFolder, refusal,
straySubtitles }`. - It owns everything the pick needs: - the dialog; - the read; - the held sentence, with the series' title fetch; - the stray count; - the row; - the ✕. - `useMovieForm` composes it and passes its members through. The
    `heldShowFolderRefusal` helper moves with it. - `useShowFolderPick.test.ts` is born with rows for each of these: - a cancel; - a read filling rows; - an unreadable or empty refusal adding nothing; - a held folder's sentence; - a second pick replacing only the folder's rows; - the ✕.

          The `MovieForm` show-folder suites are unchanged.

16. **Required where the caller always passes.**
    - `SeriesFormFiles`' `onAddShowFolder`, `showFolder`,
      `onRemoveShowFolder` and `straySubtitles` become required, and their
      defaults go. The suite's harness gains their defaults, and no case
      changes.
    - `ImportModeChoice.linkDisabled` and `ChoiceCard.disabled` stay
      optional: two of their three callers never pass them.
    - `ModeSlot`'s docblock says "a shell add of either kind".

### Group 7 — the tests

17. **`test: [add-a-show-folder] issue #421 the pick's units have their own rows`.**
    - `formValues.test.ts` gains rows for `showFolderRows`:
      - season-then-episode order kept;
      - every key tagged as the folder's;
      - tracks found in their languages;
      - Unplaced numbered after the numbered rows;
      - a read of only Unplaced videos.

      It gains rows for `isShowFolderRow` too.

    - `useEpisodeList.test.ts` gains two cases:
      - `holdShowFolder` replaces an earlier pick's rows and keeps hand-added
        ones;
      - `removeShowFolder` takes off only the folder's rows.
    - `MovieForm.showFolder.test.tsx`' loop no longer declares a function
      over `answerRead`, so the `no-loop-func` warning goes.
    - No assertion changes.

### Group 8 — the docs that close the initiative

18. **`docs: [add-a-show-folder] issue #421 the spec knows the form's members`.**
    - `COMPONENT-SPEC.md`'s `MovieForm` props gain `showImportMode`,
      `importMode`, `onImportMode`, `linkDisabled`, `addShowFolder`,
      `showFolder`, `onRemoveShowFolder`, `showFolderRefusal` and
      `straySubtitles`.
    - Its `SeriesFormFiles` row gains its four props.
    - The prototype is already 1:1 with what shipped, and stays as it is.
19. **The docblocks catch up.**
    - Any docblock naming `placeFoundVideo.ts`' `listedFolderOf` or
      `placeShowFolder`, the importer's private helpers, `sentMovie`, or the
      state `useMovieForm` no longer holds is reworded for where the thing
      now is.
    - No code changes.
20. **`docs: [add-a-show-folder] issue #421 the docs know add a show folder shipped`.**
    - **CLAUDE.md**: the _Movie form_ bullet says the add links by default
      in the shell, through the Path bridge and the Show folder pick. A
      browser add copies. File fields are still manual pickers. The "step 31
      reopens this" clause goes.
    - **README**:
      - Step 31 and its status row go ✅, the text rewritten to what shipped:
        - _＋ Add show folder_, read by the scan's rules;
        - Link by default on both adds;
        - Copy for a file outside every Library folder;
        - the Source folder recorded, so a scan never adds the title twice.
      - The build order's sentence names step 31 as done.
      - The folder tree:
        - server `import-export/` gains `readShowFolder`, `listedFolderOf`,
          `placeFoundVideo`, `placeShowFolder`, `placeFilmFolder` and
          `copyFoundEpisodes`;
        - `routes/` gains `foundPathRefusal`;
        - `movie-form/` gains `useImportMode`, `useShowFolderPick`, and
          `readShowFolder` and `containingFolder` in its `api/`;
        - the `components/` line gains `ChoiceCard` and `ImportModeChoice`,
          and the `import-export/` feature line loses them;
        - `electron/`'s preload line gains the Path bridge.
    - **Glossary**:
      - **Found file**: the Resolve copies only from under the Current run's
        folders; an add copies a found path from anywhere absolute, and
        links it only under a listed folder.
      - **Placed video** names `placeFoundVideos` and a run's `placeVideo`.
      - **Show folder read** says its Library folder is read by
        `listedFolderOf`.

      The dialogue sections are snapshots and stay as they are.

21. **`docs: [add-a-show-folder] issue #421 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - where the round left the plan;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 416 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **The fix comes after the rule it reads.** Commit 4 needs the one
  `listedFolderOf`, so Group 1 lands first. It is the round's only behaviour
  change a household could see: a Show folder pick inside a Library folder
  offers Link.
- **A held show is the folder on record.** `readShowFolder` asks
  `heldSeriesAt(folderId, sourceFolder)`, `heldShow`'s question, rather than
  comparing absolute paths. So a pick outside every Library folder is never
  held. That was already true, since a held Show folder is recorded only
  under one.
- **The Library folder itself is not a Show folder.** `listedFolderOf` reads
  "strictly inside", and a scan treats a Library folder's root as a shelf. A
  pick of the Library folder itself answers `libraryFolderId: null`, as its
  `placeShowFolder` already would.
- **One spelling of "inside a listed folder".** `listedFolderOf` reads
  `folderOverlap`, and every caller reads `listedFolderOf`. The importer's
  `isUnder` remains for counting shelves.
- **One Placed video rule.** A run, a Resolve and both adds place through
  `placeFoundVideo`. `placeFoundVideos` is the same rule over a list, and it
  owns the Link refusal's sentence.
- **One show-folder rule and one film-Source rule.** `showFolderOf` lives in
  `groupShows`, which owns how a scan sees a show. `filmSourceOf` and
  `sourceFileOf` live in `placeFilmFolder/`, and the importer reads them.
- **One unit per folder.** `listedFolderOf/`, `placeShowFolder/` and
  `copyFoundEpisodes/` are born as folders. `placeFoundVideo.ts` exports
  only the rule, at its two arities.
- **The add routes keep HTTP.** They parse, read the mode, check found
  paths through `foundPathRefusal`, ask `placeFoundVideos`, reserve a folder,
  call `copyFoundEpisodes` or `copyIn`, write, record the Source and roll
  back. The rules are the domain's.
- **One wording of a bad found path.** The series' sentences win, because
  they name the file. Only a hand-made request sees them.
- **`refusalSentence` gains a fourth feature.** It still lives in
  `src/api/`.
- **The mode travels last in both creates**, the builders' order, and is
  required there. It travels first on the wire, because the builder appends
  it first.
- **`useImportMode` and `useShowFolderPick` are feature hooks** in
  `features/movie-form/`, each in its folder with a suite. Only this feature
  uses them, so neither moves to `hooks/`. `UseMovieFormResult` keeps every
  member.
- **Props are required where their one caller always passes them.**
- **Nothing else changes on the wire, in the schema or in any pixel.**
  - `ShowFolderRead`, the two `POST` bodies and the two `GET`s keep their
    shapes.
  - The movie add's two found-path sentences change (commit 7). Only a
    hand-made request sees them.
  - `ShowFolderContext` changes shape inside the server.

## Testing Decisions

A good test drives a unit through its public interface and asserts what a
caller sees: a returned value, a status and a body, a file on disk or not, a
row drawn, a request posted. It never asserts which helper ran. The
initiative's suites are thorough and behavioural:

- on the server, `readShowFolder`, `placeFoundVideo`, and the seven route
  suites (`showFolder`, `showFolderHeld`, `addSeriesFound`,
  `addSeriesLinked`, `addMovieLinked`, and the touched `addSeries` /
  `editSeries`);
- on the client, `ChoiceCard`, `ImportModeChoice`, `numberFoundRows`, the
  feature `api/`, and the four `MovieForm` suites (`showFolder`,
  `showFolderEdges`, `importMode`, `movieImportMode`).

This round moves rules, not behaviour, so most commits are carried by cases
that already exist.

- **New suites are born for units that are born** (commits 1, 5, 6, 7, 9, 14
  and 15):
  - `listedFolderOf`;
  - `placeShowFolder`;
  - `placeFilmFolder`;
  - `foundPathRefusal`;
  - `copyFoundEpisodes`;
  - `useImportMode`;
  - `useShowFolderPick`.

  Prior art: `libraryTitleList.test.ts` and `refusalSentence.test.ts` from
  the last round, `readShowFolder.test.ts`' temp-folder harness, and
  `useEpisodeList.test.ts` and `useSeasonPosters.test.ts` for a feature
  hook.

- **The fix is proven by one new route case** (commit 4), written to fail
  before the commit, and by three `readShowFolder` rows.
- **Pure units gain rows** (commits 8, 13 and 17): `placeFoundVideos`,
  `movieAddValues`, `showFolderRows` and `isShowFolderRow`. Prior art:
  `formValues.numberFoundRows.test.ts`.
- **The journeys are already pinned.**
  - A copied and a linked show save in the route suites.
  - A linked movie and its Source in `routes.addMovieLinked.test.ts`.
  - The held refusal in `routes.showFolderHeld.test.ts`.
  - Every drawn state in the four `MovieForm` suites.

  None of these cases changes, except in three places:
  - the harnesses of commits 4, 12 and 16, which gain an argument or a
    default;
  - the two movie sentence assertions of commit 7;
  - the `no-loop-func` rewrite of commit 17.

  A suite that has to change anywhere else is reading an implementation
  detail, and is fixed in the same commit with the reason in the body.

- Every commit runs the suites it touches, `tsc -b --force`, and `eslint`
  over the folders it touched. The full suite runs at least after each group.

## Out of Scope

- **The read naming the held series's title.** The form fetches the series
  detail to word _Harbor and Vine is already in your library._, a second
  round trip. Carrying the title on `ShowFolderRead` would remove it, but log
  48 Q5 set the read's shape, so changing it is a grill, not a refactor.
- **Overloading `storedSubtitles`.** On the series edit, `storedSubtitles`
  names held tracks (relative). On the add, it names found tracks
  (absolute). `videoPath` has carried both meanings since the Resolve, so
  this is the wire's existing idiom. A rename would be a wire change.
- **A dashed-button primitive.** _＋ Add show folder_ copies `FilePicker`'s
  dashed box as a `<button>`, and the prototype draws it inline. One more
  dashed box (`CandidatePicker`) differs in radius and ink. A primitive would
  be a graduation across features, so it is its own change.
- **The `Refusal` line**, now spelled a sixth time in `MovieForm.styles.ts`,
  and the danger tint. These are the Manage library journal's standing
  follow-up: a `Refusal` molecule and a `dangerSoft` token.
- **A silent failed read.** A network failure of `GET /api/show-folder` adds
  nothing and says nothing. The form's other reads behave the same way, and
  a sentence for it would be a copy decision.
- **The client's `ShowFolderAnswer` and the server's** share a name across
  two build targets with different shapes. Each is local to its side, as
  `ImportOutcome`-style answers are elsewhere.
- **Non-null assertions in the new suites**, the suites' prevailing style.
- Anything log 48 put out of scope:
  - a film's folder picked whole;
  - folder art;
  - Link on the edit jobs or a Resolve;
  - linking art or subtitles;
  - a progress bar;
  - listing a folder on the fly;
  - a client-side folder read;
  - a remembered Import mode.

## Further Notes

- Commit 4 is the round's reason to exist. Phase 2's demo could not be done
  from the installed form, and the PRD's own test row for it was never
  written. It should land early, after the one commit it depends on, and
  the release checklist's linked-add line should be walked once it has.
- Groups 1, 3 and 4 are the round's real moves on the server. Group 4 is
  covered before it changes by the three add route suites from 417–419.
  Group 6 is covered by the four `MovieForm` suites from 417–420.
- Follow-ups this plan already sees, each for the journal, not this round:
  - the held title on the read (a grill);
  - a dashed-button primitive;
  - the standing `Refusal` molecule and `dangerSoft` token;
  - from earlier entries: the sandbox teardown flake, and the lint error in
    `EnrichmentReview.test.tsx`.
