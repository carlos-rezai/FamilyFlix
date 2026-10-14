# Refactor plan: Link or copy — the Resolve that forgot its folder, one place a video is placed, outcomes as values on both sides of the wire, and the docs that close the initiative

> Source initiative: `link-or-copy`, issue 339 (step 24).
> Shipped by issue 340 (`81ec1f0`, the prototype amendment) and issues
> 341–347, one RED and one GREEN each: 341 `5df1429`/`d7c25c4`, 342
> `b22f6ad`/`3129432`, 343 `7e7885a`/`b8b06a1`, 344 `1ad42b2`/`1cd8eda`,
> 345 `ddf3979`/`ce117b0`, 346 `8f38741`/`0f5e709`, 347 `0414315`/`663d5ee`.
> Design log: `docs/design-logs/41-link-or-copy.md`. Plan:
> `docs/PRDs/41-link-or-copy-plan.md`.
> This is the initiative's closing round: it ticks **Link or copy** and
> closes 339. Filed as issue ISSUE*NUMBER.
> Planned alone, on the maintainer's standing instruction: \_keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture.*

## Problem Statement

`link-or-copy` shipped all six slices of log 41's implementation plan. The
full suite is green at `663d5ee`: 8921 tests across 535 files, with
`tsc -b --force` clean.

The slices were built one at a time by agents that each saw one slice, and
the seams show. Log 41 Q6 made `media_folder` _the one reading for every
title_, and two of the four ways a title is added still lean on a second
reading in the library's write — which is where the one bug below comes
from. The decision _link this video or copy it_ is spelled four times in the
importer. Two new answers — a folder in use, a folder out of reach — travel
as an inline sentence on the server and as an exception on the client, where
the codebase answers with an outcome value. And most of the documents still
describe a library that only ever copies. Every finding below was checked
against the code for this plan. The bug was reproduced with a throwaway run.

### 1. A bug: a Resolve in a Link run records no Media folder

A film **Resolve** in a Link run reserves a **Movie folder**, copies the
poster and subtitles into it, and adds the film with a **Linked video** — but
never passes `mediaFolder`. The library's write then falls back to reading
the folder off the video's path, and for a linked video it deliberately reads
nothing. Reproduced over the Die Hard fixture: the film's poster is
`die-hard-1988/poster.jpg` and `storage.mediaFolderOf('movie', id)` is
`null`. From there, everything Q6 moved onto the recorded folder fails
quietly:

- a **Sync** stores no poster, backdrop or Still (`storeImage` answers `null`
  with no folder);
- a **Delete** removes the row and leaves `die-hard-1988/` behind, a
  **Stranded folder** nobody can reach;
- an edit that picks a new poster reserves a second folder beside the first.

A **Series Resolve** that adds a new show in a Link run has the same gap: the
fallback reads the first episode's path (linked, so nothing) and then the
poster's directory, so a show with no poster records no folder. The run's own
imports (`importMatch`, `importShow`) pass `mediaFolder` and are unaffected,
which is why no suite saw it: `linkReview`'s Resolve cases assert the video,
the poster and the subtitles, never the recorded folder.

### 2. The Media folder still has two readings

- **Shipping adds lean on the fallback.** The form's `POST /api/movies` and
  `POST /api/series`, and the series seed, pass no `mediaFolder`; the write
  derives one from the video's or the first episode's path. That is the second
  reading Q6 rejected (_"two readings of one fact, which is where they
  drift"_), and group 1 is what drift looks like.
- **`parentOf`** — the derivation — is exported from `library/write/write.ts`
  and imported by `library/series/write/write.ts`: a pure helper with no
  folder and no suite of its own, borrowed across two modules.
- **The two Resolves find their folder off a stored path**:
  `media.openFolder(posix.dirname(stored.stored))`. It is the one place left
  that reads a title's folder through a file, which Q6 retired everywhere
  else; it is right only because a Resolve's picked file was stored into the
  folder that is about to become the title's.

### 3. _Link or copy_ is decided in four places

`importMatch`, `importShow`, and the two Resolves each spell the decision:

- three spell a Linked video's path by hand,
  `relative(libraryFolder.path, file).split(sep).join('/')`;
- each then spreads `...(videoFolderId === null ? {} : { videoFolderId })`
  into its `NewMovie` or `NewEpisode`, because the input types take
  `videoFolderId?: string` and a **StoredVideo** carries `string | null`.

Reading a Linked video's path has one unit, `linkedVideoPath`; writing one has
none. The codebase pairs a reader with its writer in one folder:
`episodeTag` / `spellEpisodeTag`, `yearSpan` / `spellYearSpan`.

### 4. `StoredVideo` is not where the log put it

Log 41's shapes put `StoredVideo` in `src/types` beside `Movie` and
`Episode`, _"a Playable is addressed by both"_. It was built inside
`playback/createPlayback/` instead, and `Movie` and `Episode` each spell the
two fields again with the same docblock, word for word. The routes import the
type from the playback domain to describe a library row.

### 5. Two new answers, spelled the way the codebase does not answer

- **A folder in use.** `DELETE /api/library-folders/:id` counts with
  `linkedTitleCount`, then removes with `removeLibraryFolder`'s boolean — two
  calls, outside one transaction — and spells the singular and the plural
  `409` sentence inline in the handler. The folder add answers an outcome
  through `FOLDER_REFUSALS`; the remove should too.
- **A folder out of reach, on the server.** `videoFileOr404` now answers a
  `503` as well, under a name that says `404` and a docblock that still says
  _"`null` from `videoFile` is both …"_. Its `404` sentence has its own
  function, `noVideoFile`, so it cannot drift; the `503` sentence is inline.
- **A folder out of reach, on the client.** `fetchPlayback` answers a
  `PlaybackRead`, `null` for a `404`, and throws `FolderUnreachableError` for
  a `503`: a value, a sentinel and an exception for three answers of one read.
  `useOpeningReads` catches the exception back into a value, and hands the
  Player two booleans, `fileMissing` and `folderUnreachable`, that can never
  both be true; `noticeFor` takes six booleans.
- **The sheet start reads its mode through `folderScanBody`**, the Folder
  scan's reader, while reading its own `enrich` inline beside it. Both starts
  read the same two fields.

### 6. The mode's default disagrees with the household's

Log 41 Q10 makes **Link** the default. `startImport(sheetPath, enrich =
false, mode = 'copy')` and `useImportRun.start(…, mode = 'copy')` default to
Copy, while `startFolderScan(enrich, mode)` takes both required. The screen
always passes a mode, so the default is dead — and wrong if anyone ever
relies on it.

### 7. Small things the build left

- **Import setup holds the mode, Import flow holds the box.** `ImportFlow`
  holds the sheet and `enrich` and hands them to a controlled `ImportSetup`
  (its docblock: _"it is the organism that holds the value"_). The mode alone
  is local state in `ImportSetup`, threaded back through `onStart(mode)`. The
  Library folders page holds both in its organism.
- **`ImportModeChoice` draws its own caption**, `Caption`: 13px 600 dim, 8px
  under — `FieldLabel` in `maintainer.styles.ts` less its `0.2px` tracking.
  `feat.ImportFlow.dc.html` draws the caption with `imp.labelStyle`, which is
  `FieldLabel`; `page.LibraryFoldersPage.dc.html` spells the same style inline
  and drops the tracking.
- **`ChoiceCard`'s words half-moved.** Its prop is `line`; its styled
  component is still `Description`, and the Export dialog's `FORMAT_COPY`
  still keys the text `description`, where `MODE_COPY` keys it `line`.
- **The enrichment series pass:**
  - `writeEpisodes`' docblock sits on `seasonFolderOf`, which was inserted
    between them (import review's `ProblemRow` docblock, again);
  - `storage.mediaFolderOf('series', series.id)` is read four times in one
    pass over one series;
  - `seasonFolderOf` spells a recorded path itself, splitting an absolute
    path on `sep` — how a stored path is spelled is `media/`'s business
    (`RenamedFolder`'s docblock says so).
- **`readableFolderSync`** is `readableFolder` written a second time, with a
  comment promising _"Same answers, same rules."_ — the drift a comment cannot
  stop.
- **Stale words:** `createMedia`'s `containedFolder` docblock still names
  `removeMovieFolder`.
- **An untested catch.** #342 wrapped **Factory reset**'s
  `playback.removeComponent()` in a `try` that swallows a throw, from a slot
  whose outcomes are values and never throws. No suite asserts it, and nothing
  in log 41 asks for it.

### 8. Documentation the ship left

- `CLAUDE.md`:
  - **The folder tree:** `createMedia`'s line still lists `openSeriesFolder`,
    `removeSeriesFolder`, `storeInSeriesFolder` and _"`storeNamed` (beside a
    Stored path)"_; `db/` stops at migration 10; `playback/` has no
    `linkedVideoPath/` and `createPlayback` no folder reader; `FormatCard/` is
    still listed and `ImportModeChoice/` is not; `readableFolder/` and
    `library/folders/` don't know what they answer now.
  - **_Code Rules_:** _"All file paths are stored as relative paths under the
    managed media directory"_ — Q9's amended sentence never landed.
  - **_Desktop Build_'s _Media storage_** and **_Bulk Import_'s copy bullet**
    still say every import copies.
  - **The Settings hub** still posts `scan { enrich }`, and the folder removal
    has no `409`.
  - **Step 24 and its feature line** are 🔜.
- **The README:** the media line names `storeInSeriesFolder`; the status
  table, the step-24 entry and the feature line.
- **The glossary:** the _Link or copy_ section is shipped, and does not say so.
- **The dev journal** has no entry for the initiative.

## Solution

One reading, one placing, one answer:

- **Every add names its Media folder.** Both Resolves and every shipping add
  pass `mediaFolder`, the bug is fixed under its own test first, and
  `parentOf` graduates into its own unit for the rows still written without
  one.
- **A Linked video's path has a reader and a writer.** `spellLinkedVideo`
  joins `linkedVideoPath` in its folder, and one importer closure,
  `placeVideo`, decides link or copy and answers a `StoredVideo`.
- **`StoredVideo` lives in `src/types`**, and `Movie` and `Episode` extend it,
  so its two fields are documented once. `NewMovie` and `NewEpisode` take
  `videoFolderId?: string | null`, so a `StoredVideo` spreads in whole.
- **Outcomes are values on both sides of the wire.** The folder removal
  answers an outcome in one transaction and the route maps it; the `503` gets
  its own sentence function; `fetchPlayback` answers a `PlaybackAnswer`, and
  the Player is handed one `unavailable` reason rather than two booleans.
- **The client says what log 41 says:** the mode is required, held by the
  organism that holds the box, captioned by `FieldLabel`, and drawn by a
  `ChoiceCard` whose words agree with its prop.
- **The docs and the ticks close the initiative.**

What changes on the wire, all of it inside this unreleased initiative:
nothing. Every route answers the same statuses and bodies. One half-pixel
moves: the _Files_ caption on the Library folders page gains `labelStyle`'s
`0.2px` tracking, which Import setup's already has — the prototype is amended
first. The schema does not change.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each one is
`refactor: [link-or-copy] issue #348 …` except where a commit is
named `fix:` or `docs:`.

### Group 1 — the Resolve that forgot its folder

1. **`fix: … a Resolve in a Link run records its Media folder`.**
   - **The new tests first,** in `createImporter.linkReview`: a film Resolve
     in a Link run records the folder its poster was copied into as its
     Media folder, and a Series Resolve in a Link run adding a new show with
     no poster records the Series folder its subtitles went into. Both fail
     today with `null`.
   - **Then the fix:** `resolve` and `resolveSeries` pass `mediaFolder:
basename(folder)` to `addMovie` and `addSeries`, as `importMatch` and
     `importShow` already do. A Series Resolve joining a held show already
     has one and writes nothing.
2. **The form and the seed name their Media folder.** `POST /api/movies`
   passes the folder it reserved and renamed, `POST /api/series` the Series
   folder it reserved, and the series seed the folder it writes under
   `__seed__/series/`. No shipping add leans on the write's fallback any more.
   The form's two adds are covered by `routes.mediaFolder`, which already
   asserts the recorded folder through `mediaFolderOf`; the seed's suite gains
   that case, a seeded show recording its folder under the seed prefix.
3. **`parentFolder/` is born.** `parentOf` moves out of
   `library/write/write.ts` into `library/parentFolder/` as
   `parentFolder(path, levels)`, with its own suite (one level, two levels,
   too few segments, `undefined`). Both writes import it; nothing else
   changes. Migration 11 keeps its own copy: a migration is a snapshot and
   imports nothing that can change under it.
4. **A Resolve's folder is found without a file.** Both Resolves name the
   folder the route's bytes went into through a `Media` reading of the folder
   a stored path sits in, rather than `posix.dirname` in the importer — the
   last place outside `media/` that spells it. The film and series Resolve
   suites with a picked file carry it.

### Group 2 — one place a video is placed

5. **`spellLinkedVideo` is born beside its reader.**
   `spellLinkedVideo(folderPath, file) → string`: the file's path relative to
   the Library folder, forward slashes on every platform — `linkedVideoPath`'s
   inverse, in the same folder and file, as `spellEpisodeTag` sits with
   `episodeTag`. Its suite: a file one and two folders deep, and a round trip
   through `linkedVideoPath` over a sandbox. Nothing calls it yet.
6. **`StoredVideo` moves to `src/types`.** It is declared beside `Playable`,
   exported through the barrel, and `Movie` and `Episode` extend it, so the
   two fields' docblock is written once. `createPlayback`, `derivedRuntime`
   and the routes import it from `@/types`. `VideoFile` stays in `playback/`:
   no client reads it. Covered by `tsc`.
7. **A `StoredVideo` spreads in whole.** `NewMovie.videoFolderId` and
   `NewEpisode.videoFolderId` become `string | null`, optional as before; both
   writes read `?? null` and test the media-folder fallback against `null`
   rather than `undefined`. The four conditional spreads in the importer
   become `...video`. Covered by the link-mode, link-shows and link-review
   suites.
8. **`placeVideo` decides once.** One importer closure, `placeVideo(current,
libraryFolder, file, into, signal) → Promise<StoredVideo>`: under the
   **Import mode** `link`, `spellLinkedVideo` and the folder's id; under
   `copy`, `copyIn` and `null`. `importMatch` and `importShow` call it. The
   Resolves' `linkedVideo` keeps its own job — a Found file under _a listed_
   folder, `null` for a picked one — but spells the path through
   `spellLinkedVideo`. Covered by the same three suites.

### Group 3 — the library's answer for a folder in use

9. **`removeLibraryFolder` answers an outcome.** It becomes `{ kind:
'removed' } | { kind: 'not-found' } | { kind: 'in-use'; titles: number }`,
   the count read inside the same transaction as the delete, so nothing can
   link a video between the two. `linkedTitleCount` retires from
   `FoldersRepository` and `LibraryStorage`. The route maps the outcome: `404`
   in today's sentence, `409` in a module-level `inUseSentence(titles)` — _1
   title plays …_ / _12 titles play …_, today's words. The folders suite's
   remove cases assert the outcome where they asserted the boolean;
   `routes.folderInUse` and `routes.libraryFolders` are unchanged.

### Group 4 — the playback seam

10. **One reading of reach.** `readableFolder` and `readableFolderSync` share
    one module-level reading — the absolute check, then a stat's answer, then
    `missing` — so the two can only differ in whether they wait. The
    `readableFolder` suite gains the sync twin's cases over the same table.
11. **The route's two refusals each have a sentence function.**
    `videoFileOr404` becomes `videoFileOrRefusal`, its docblock rewritten for
    three answers; the `503`'s sentence moves into `unreachableVideo(res,
kind, id)` beside `noVideoFile`, today's words. `routes.unreachableFolder`
    and `routes.linkedVideo` are unchanged.
12. **Both starts read one body.** `folderScanBody` is renamed
    `importStartBody` and reads `{ enrich, mode }` for the sheet start too,
    whose inline `body.enrich === true` retires. The sheet path stays read
    where it is, with its `field: 'sheet'` refusal. `importBody`'s suite
    renames; `routes.import` and `routes.folderScan` are unchanged.
13. **The reset route takes the slot at its word.** #342 wrapped
    **Factory reset**'s `playback.removeComponent()` in a `try` that swallows
    a throw. The slot's outcomes are values and it never throws
    (`componentSlot`: _"Outcomes are values, never throws"_), no suite
    asserts the catch, and log 37 orders the removal without one. The `try`
    goes. `routes.reset` is unchanged.

### Group 5 — media and the Sync

14. **A Still's season folder is `media/`'s spelling.** `storeNamed(folder,
name, source, season?)`: given a season, it writes into that season's
    `season-NN/` under the recorded folder, made if it is not there — the
    name `seasonFolder` already spells. `createEnrichment`'s `seasonFolderOf`,
    which split an absolute path on `sep`, retires. The `createMedia` suite
    gains the season case; the Sync's stills suites are unchanged.
15. **The series pass reads its folder once.** `syncSeries` (the pass over
    one show) reads `storage.mediaFolderOf('series', id)` once and hands it to
    `writeSeries` for the show's images, to the Season posters and to
    `writeEpisodes`. `writeEpisodes`'
    docblock goes back on `writeEpisodes`. `containedFolder`'s docblock names
    `removeTitleFolder`. Covered by `createEnrichment.mediaFolder` and the
    season-poster suites.

### Group 6 — the client

16. **The playback read answers a value.** `fetchPlayback` answers
    `PlaybackAnswer`: `{ kind: 'read'; read } | { kind: 'missing' } | { kind:
'unreachable' }`, the server's `VideoFile` read back; any other status
    still rejects. `FolderUnreachableError` retires. `useOpeningReads` hands
    back `unavailable: 'missing-file' | 'unreachable' | null` in place of
    `fileMissing` and `folderUnreachable`, and the Player's `noticeFor` takes
    it. The player's api, `useOpeningReads` and `Player.unreachable` suites
    move with the shape; `PlayerNotice` and the other Player suites are
    unchanged.
17. **The mode is required on the sheet start.** `startImport(sheetPath,
enrich, mode)` and `useImportRun.start(sheetPath, enrich, mode)`, no
    defaults — `startFolderScan`'s shape. The suites that started with
    `start(sheet)` pass `false, 'link'`.
18. **`ImportFlow` holds the mode beside the box.** `ImportSetup` takes
    `mode` and `onMode` as it takes `enrich` and `onToggleEnrich`, and
    `onStart` is `() => void` again; `ImportFlow` holds `mode`, `'link'` on
    every mount. `ImportFlow.mode` and the setup suites carry it unchanged in
    what they assert.
19. **`docs: … the Library folders page's caption is labelStyle`.** Amend
    `page.LibraryFoldersPage.dc.html`'s inline _Files_ caption to
    `feat.ImportFlow.dc.html`'s `labelStyle` (the `0.2px` tracking), and
    `COMPONENT-SPEC.md`'s `ImportModeChoice` entry to say so. The prototype
    first, per _The prototype is the spec_.
20. **`ImportModeChoice` is captioned by `FieldLabel`.** `Caption` and its
    styles file's first export retire; the molecule draws `FieldLabel` from
    `maintainer.styles.ts` with the id it labels the group by. The
    `ImportModeChoice` suite is unchanged.
21. **`ChoiceCard`'s words agree.** Its styled `Description` is `Line`, and
    the Export dialog's `FORMAT_COPY` keys its text `line`, as `MODE_COPY`
    does. No pixel moves. Covered by the `ChoiceCard` and `ExportModal`
    suites.

### Group 7 — the ticks that close the initiative

22. **`docs: [link-or-copy] issue #348 the docs know link or copy
shipped`.** - **`CLAUDE.md`:** - The tree: `createMedia`'s members off the Media folder
    (`openFolder`, `storeNamed` with a season, `removeTitleFolder`; the
    three retired names gone); `db/`'s migrations 11 and 12;
    `playback/linkedVideoPath/` with `spellLinkedVideo`, and
    `createPlayback(mediaPath, slot, libraryFolderPath)`;
    `readableFolder/`'s sync reading; `library/folders/`' outcome and
    `library/parentFolder/`; `ChoiceCard/` for `FormatCard/`, and
    `ImportModeChoice/`; `StoredVideo` in `types/`. - _Code Rules_: the paths sentence as Q9 amended it. - _Desktop Build_'s _Media storage_ and _Bulk Import_'s copy bullet: an
    import links a video by default and copies on request; art and
    subtitles are always copied. - The Settings hub: `/api/import { sheetPath, enrich, mode }`,
    `scan { enrich, mode }`, and the removal's `409`. - Step 24 and _Link or copy_ under _Maintainer tools_ turn ✅. - **The README:** the media line, the status table, the step-24 entry and
    the feature line. - **The glossary:** the _Link or copy_ section reads shipped; **StoredVideo**
    names `src/types`.
23. **`docs: [link-or-copy] issue #348 the journal`.** A dev-journal
    entry in the others' shape: what shipped, what this round changed, what
    was deliberately not changed (below), and the follow-ups named under Out
    of Scope. Then close 339.

## Decision Document

- **The Media folder is named by whoever reserves it.** Every add in shipping
  code passes `mediaFolder`. The write's fallback stays for rows written
  without one — hundreds of fixtures add a film by `videoPath` alone, and
  migration 11's backfill reads the same way — but it is no longer how
  shipping code records a folder. Its derivation is `parentFolder`, a unit.
- **`spellLinkedVideo(folderPath, file)`** is the writer of a Linked video's
  `video_path`, `linkedVideoPath(folderPath, videoPath)` its reader; one
  folder, one file, the `episodeTag` pairing.
- **`placeVideo` is the importer's one decision between link and copy.** It
  answers a `StoredVideo`. The Resolves' `linkedVideo` stays separate because
  its question differs: a Resolve may mix a Found video with picked files, and
  only a Found one under a listed folder can be linked.
- **`StoredVideo` is a shared type** in `src/types`, extended by `Movie` and
  `Episode`. `NewMovie.videoFolderId` and `NewEpisode.videoFolderId` are
  `string | null`, optional; `MoviePatch.videoFolderId` already is.
- **`removeLibraryFolder(id)` answers `{ kind: 'removed' } | { kind:
'not-found' } | { kind: 'in-use'; titles }`**, the count and the delete in
  one transaction. `linkedTitleCount` retires. The `409` sentence is
  `inUseSentence(titles)` in the routes, beside `noVideoFile` and
  `unreachableVideo`.
- **`fetchPlayback` answers `PlaybackAnswer`** — `read`, `missing`,
  `unreachable` — and rejects only for a failure. `useOpeningReads` exposes
  `unavailable: 'missing-file' | 'unreachable' | null`. The client's names for
  the two reasons are `PlayerNotice`'s own kinds.
- **`importStartBody`** reads `{ enrich, mode }` for both starts; `mode` is
  required, a missing or unknown one refused in today's sentence.
- **`storeNamed(folder, name, source, season?)`.** The season folder's name is
  `seasonFolder`'s; a Still is the one caller that passes a season.
- **The mode is held by the organism that holds the start's other fields**:
  `ImportFlow` and `LibraryFolders`, `'link'` on every mount.
- **No change** to:
  - the schema, migrations 11 and 12, or any route's status or body;
  - `linkedVideoPath`'s rule, `mediaFilePath`, or `Playback.videoFile`'s
    answer;
  - the Folder row: the prototype draws the removal's refusal under it, in
    the page, not inside `mol.FolderRow`;
  - `PlayerNotice`'s copy, `ImportModeChoice`'s copy, `ChoiceCard`'s pixels.

## Testing Decisions

- **What a good test asserts here** is what the maintainer or the screen could
  observe: the record and its recorded folder after a run or a press, read
  through `getMovie`, `getSeriesDetail` and `mediaFolderOf`; the files on disk
  in the sandbox; the route's status and body; the notice on screen. It never
  asserts which closure placed a video — which is why group 2 can fold four
  decisions into one without losing a guarantee: the link-mode, link-shows and
  link-review suites assert the records and the files.
- **New suites:**
  - **`parentFolder`:** one level, two, too few segments, `undefined`.
  - **`spellLinkedVideo`**, in `linkedVideoPath`'s suite: one and two folders
    deep, forward slashes, and the round trip.
- **New cases in existing suites:**
  - **`createImporter.linkReview`:** the film and Series Resolve record their
    Media folder in a Link run. This is the bug's test, written first in its
    commit.
  - **`createMedia`:** `storeNamed` into a season's folder, made when absent.
  - **`readableFolder`:** the sync reading over the async one's table.
- **Suites whose assertions move with a shape:**
  - the folders repository's remove cases: the outcome for the boolean;
  - the player's api, `useOpeningReads` and `Player.unreachable`: the answer
    and `unavailable`;
  - `importBody`: the rename;
  - `useImportRun`, `ImportFlow`, `ImportSetup` and the api suite: the
    required mode.
- **Unchanged suites that carry the refactor:** `routes.folderInUse`,
  `routes.libraryFolders`, `routes.unreachableFolder`, `routes.linkedVideo`,
  `routes.linkedEdit`, `routes.mediaFolder`, `routes.import`,
  `routes.folderScan`; `createImporter.linkMode`, `.linkShows`,
  `.mediaFolder`; `createEnrichment.mediaFolder` and the season-poster suites;
  `ImportModeChoice`, `ChoiceCard`, `ExportModal`, `PlayerNotice`,
  `LibraryFolders`.
- **Prior art:**
  - `episodeTag`'s suite, for a reader and writer tested as a pair;
  - `admitFolder` and `FOLDER_REFUSALS`, for a folder outcome mapped by the
    route;
  - `removeLibraryFolder` in `api.ts` (`RemoveFolderOutcome`), for an answer
    the client reads as a value;
  - import review's `heldValues`, for a helper graduated into its own unit.
- **Every commit runs the full `vitest run` and `tsc -b --force`.** The
  incremental build can miss a spec file's type error.

## Out of Scope

- **`mode` stays optional on the domain.** `Importer.start(sheetPath, enrich?,
mode?)` and `scan(folders, enrich?, mode?)` default to Copy, which is what
  the 180-odd importer suites written before log 41 assume. Making `mode`
  required would make `enrich` required too and rewrite every one of them for
  no behaviour; the route, which is the domain's only shipping caller, always
  reads a mode. The journal records it.
- **The write's media-folder fallback stays** (Decision Document), for rows
  written without one.
- **`() => null` in the Playback suites.** Sixty-odd suites compose a Playback
  with no Library folders by passing `() => null`. A named test double for a
  one-token function is ceremony, `fixedSlot`'s precedent notwithstanding.
- **A shared `'movie' | 'series'` kind.** `mediaFolderOf(kind, id)` is a
  fourth local spelling. Import review left it at three; one more is still not
  worth a shared type in a closing round. Filed as a follow-up for the next
  initiative that touches both kinds.
- **Everything log 41 left out:** _Convert to linked_, a **Relocate**, Link in
  the Movie form, linking art or subtitles, any change to the **Write
  targets** or the **Export**.

## Further Notes

- **Deliberately not changed:**
  - The Library folders page wraps each `FolderRow` and its refusal in a
    plain `div`, as the prototype does; the refusal is the page's, not the
    molecule's.
  - `useLibraryFolders` keeps `refusal` for the add and `removeRefusal` for
    the remove; renaming the add's would move every add suite for a word.
  - `Playback.videoFile` reads reach synchronously on every call, so a folder
    that comes back plays with nothing cached (log 41 Q8).
- **The bug was reproduced** with a throwaway suite over the Die Hard fixture
  — a film Resolve in a Link run, then `mediaFolderOf` — that answered `null`
  beside `die-hard-1988/poster.jpg`, and was deleted.
