# Refactor plan: Library audit, one name per rule, routes that only route, one image fallback, the page dialogs that say what Manage library says, and the docs that close step 34

> Source initiative: `library-audit`, issue 443 (step 34).
> Shipped by issues 444–471. The prototype revisions are 444 `944ce8de`, 445
> `18038d4f` and 446 `331c65c3`; the first build slices, RED and GREEN each,
> are 447 to 461 (`24186104` to `154914bf`), walked by 462. The follow-up
> (log 51 Q18 to Q27, prototype `8bef9dfc`) is 467 to 470 (`d6b07e7a` to
> `7c0c0db9`), walked by 471, and 464 (`c2d6eacd` to `f9a0adf0`), found on
> that walk.
> Design log: `docs/design-logs/51-library-audit.md`, with its follow-up.
> PRD: `docs/PRDs/51-library-audit.md` (443). Plan:
> `docs/PRDs/51-library-audit-plan.md`.
> This is the initiative's closing round. It ticks **Library audit** and
> closes 443. Filed as issue 472.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`library-audit` shipped every slice of log 51's two implementation plans. At
`f9a0adf0` the full suite has **11033 tests across 678 files, all passing**.
`tsc -b --force` is clean. `eslint src server electron` reports one error and
162 warnings, against one and 148 when Subtitle picker closed. All 14 new
warnings are in suites this initiative wrote (section 7).

The design held: the **Held video** rule second in **Already in library**,
the **Missing video** rule third, the **Title key** passing over a missing
film; a plain Delete keeps the files and records **Left-out videos**, the
**Recycle choice** sends `?files=trash`, and a shared video is never trashed;
the wider **Season folder** rule and the Dutch **Episode word** on both
sides of the drift guard; the **Other row** and `/genre-less`; an edit owns
the folder it reserves; a poster or still that fails to load falls back.

The slices were written one at a time by agents that each saw one slice, over
two grill sessions and 28 issues, and the seams show. Two findings are
behaviour a household can meet (section 5); one is latent (section 2). Every
finding was checked against the code for this plan. They fall into seven
families.

### 1. One rule, several names and spellings, on the server

- **`HeldVideo` names the holder, not the video.** `library/holding` exports
  `HeldVideo { kind, id }`, documented as "the title a **Held video** belongs
  to". The glossary's **Held video** is the video. The importer already has
  the same shape under the right name, a private `HeldTitle { kind, id }`.
  Two names for one shape, and the exported one is the wrong word.
- **The Held video rule over a list of videos is spelled twice.** The
  importer's `holderOf(kind, folder, videos)` and `readShowFolder`'s
  `seriesHoldingAny(listed, videos, context)` both walk the videos, spell
  each with `spellLinkedVideo`, ask `titleHolding` and answer the first id of
  the wanted kind. Both are in `import-export/`.
- **The importer's rules are named three ways.** `heldFilm` chains
  `holderOf`, `missingHolderOf` and `heldByKey`: one rule per function, but
  three naming schemes. The one that reads like the glossary is `heldByKey`.
- **A path inside a folder, with forward slashes, is written again.**
  `readShowFolder` adds `insideShow(dir, video)`, which is
  `relative(dir, video).split(sep).join('/')`, the body of
  `placeFilmFolder`'s exported `sourceFileOf` letter for letter. An
  episode's path inside its **Show folder** is its **Source file**, so the
  existing name is the right one.
- **`titleVideos` spells a Source folder's Source file twice.** The film
  branch (`fromSource`) and `episodeVideos` each write
  `posix.join(forward(sourceFolder), forward(file))` inline. The same rule is
  the third arm of `holding`'s SQL (`replace(…, char(92), '/') || '/' || …`),
  and neither says the other exists.

### 2. The importer reads the disk where it promised to read once

- **`heldByKey` stats the disk on every call.** Log 51 Q23 reads the
  missing films "once per run, as `heldFilmsByKey` is", and `missingFilms`
  does. `heldByKey` ignores that map and calls `playback.videoFile(movie)`
  again for every folder it is asked about.
- **The two can disagree within one run (latent).** `foundAgainOf` takes a
  film off `missing` once a folder finds it again, so the run knows the film
  is no longer missing; its file is only placed in the **Import phase**. A
  second folder in the same run that keys to that film is asked of the disk,
  which still says `missing`, so the key passes over it and the folder is
  imported as a second copy of a film the run has just repaired. The rule's
  own map would hold it.
- **"A title's recorded Media folder, opened" is written again.**
  `placeFoundAgain` reads `storage.mediaFolderOf('movie', id)` then
  `media.openFolder`, beside the importer's own `heldFolder(seriesId)`, which
  does exactly that for a series.
- **The `✓ Updated` line is spelled twice.** `logUpdated(current, row, fill)`
  writes the Sheet fills' line; `placeFoundAgain` writes the same line by
  hand (`✓ Updated    <title> — video`), so the two can drift.

### 3. The routes file does domain work

CLAUDE.md: _routes/: HTTP only: parse, call a domain, respond._

- **`trashedFirst` lost its docblock.** `linkedFilesOf` was inserted between
  `trashedFirst`'s docblock and its function, so two docblocks now sit back to
  back above `linkedFilesOf`, and `trashedFirst` has none.
- **The two Delete routes each decide the Recycle choice.** `DELETE
/movies/:id` and `DELETE /series/:id` each carry the same
  `if (req.query.files === 'trash') { trashedFirst } else { leaveOut(titleVideos) }`
  block, and read the raw query rather than through `queryString`, which every
  other route uses for a query parameter.
- **`leftOutEntries` is a domain helper in the routes file.** It places each
  hand-added path under its Library folder by `placeFoundVideo` and answers
  the **Left-out video** entries a hand add clears. It is pure, two routes
  call it, and it has no suite of its own. The routes file's one precedent
  for a pure helper (`foundPathRefusal`) has its own folder and test.

### 4. The Other row's count and title are spelled twice

- **The genre-less total lists every genre-less film to count them.**
  `home.listOther` and `genre.getGenreLess` each call
  `browse.listMovies({ genreLessOnly: true })` with no limit, assembling every
  film (genres, subtitles, watch state) only to take `.length`. A genre row's
  count comes from `listGenres`, a SQL count; the library count from
  `countMovies`.
- **_Other movies_ is written twice in one feature.** `HomeRows`'
  `OTHER_ROW_TITLE` and `GenreMovies`' `OTHER_TITLE` are the same words for
  the same row, in `features/library/home/` and `features/library/genre/`.

### 5. The page Delete dialogs (behaviour)

- **The movie and series pages invent half the subject.** `DeleteMovieDialog`
  and `DeleteSeriesDialog` hand `DeleteTitleBody` a `DeleteSubject` with
  `path: ''` and `originalPath: null`, because the detail reads answer only
  `linkedFiles`. Both prototype pages say the body _is_ the Manage library
  dialog's, and `deleteView` reads both fields:
  - an **Unreachable** linked film deleted from its page says _Its files on
    — they can't be reached right now_, the path missing;
  - a copied film with its original in a Library folder says _What stays:
    Nothing_ on its page, and _Your original in its library folder, Scan
    folders would bring it back_ on Manage library.
- **`episodeCount` is threaded to nowhere.** `SeriesDetail` passes it to
  `SeriesEditMenu`, which passes it to `DeleteSeriesDialog`, which no longer
  reads it (log 51 Q6: the body counts nothing); its docblock says so.
  `SeriesPageModel.episodeCount` is read by nothing else.
- **`hasPoster` is read by nothing.** Since 464 both detail pages decide the
  Default poster's captions by the url still loadable; `MovieDetailModel` and
  `SeriesPageModel` still compute `hasPoster`.
- **The Recycle choice's default is spelled six times.** `deleteTitleAt`,
  `deleteMovie`, `deleteSeries`, `useDeleteMovie`, `useDeleteSeries` and
  `useLibraryTitles` each default `files = 'keep'`. The wire's default
  mirrors the route ("no query keeps the files"). The hooks' defaults hide
  the decision: every caller already passes the choice
  `DeleteTitleBody` made.

### 6. One fallback written eight times, and the form's seams

- **"The url that failed to load" is spelled eight times.** `PosterCard`,
  `ContinueCard`, `SeasonCard`, `EpisodeRow`, `UpNextCard`, `MovieDetail` and
  `SeriesDetail` each hold `const [failedUrl, setFailedUrl] = useState`,
  derive `url === failedUrl ? null : url`, and pass `onError`; each carries
  its own copy of the same comment. `SeasonChoices` holds a set of them for
  its many tiles.
- **A Show folder read answers its unplaced paths as a parallel array.**
  `ShowFolderEpisode` gained `relativePath`; `ShowFolderRead` gained
  `unplacedRelative: string[]` beside `unplaced: string[]`, read by index in
  two places in `formValues`.
- **The Numbering guess has two season rules.** `folderSeason(video,
showFolder)` and the new `relativeSeason(relative)` both read the nearest
  folder below the show by `readSeasonFolder`, else 1. `numberFoundRows`
  chooses between them by an optional fourth parameter, another parallel
  array.
- **The Series Resolve's rows build a Found file by hand**
  (`{ kind: 'found', path, filename: path }`), now that `foundFile` takes the
  name it shows.
- **`useShowFolderPick` calls `prefillTitle` in two branches** that differ
  only in passing `pickedTitle.current`; `prefillTitle`'s `picked?: string`
  is `string | undefined` where the ref holds `string | null`.
- **`useMovieForm`'s catch comment was edited mid-line and never rewrapped**
  (one line runs to ~100 columns), and `SaveRefusedError` was imported out of
  order in its import list.

### 7. Tests and prose

- **14 new lint warnings.** `no-non-null-assertion`, in the four new
  `*.recycle.test.tsx` suites (`DeleteTitleDialog` 4, `ManageLibrary` 4,
  `DeleteMovieDialog` 3, `DeleteSeriesDialog` 3).
- **Over a hundred em dashes were added**, after the rule against them: the
  suite headers (`51 — Library audit, Phase n`), the `describe` titles
  (`createImporter.scan — left-out videos`), and the docblocks of the new
  importer helpers, `heldFilm`, `foundAgainOf`, `placeFoundAgain` and
  `foldersUnder`. The previous two rounds rewrote their initiatives' own.
  The household's copy keeps its dashes: the `✓ Updated` line and the Delete
  dialog's sentences are the prototype's words.
- **The migration's comment says less than it does.** Migration 15's comment
  names only "a video a keep-files Delete took out"; an episode removed in
  the **Series edit job** is recorded too.
- **The documents.**
  - The feature checklist's _Library audit_ row is 🔜, and step 34's entry
    is still the "known so far" list.
  - The glossary's **Left-out video** says migration 17; the table is
    migration 15. Its _Library audit_ section is still `(new)`.
  - CLAUDE.md's **Media** rule still says a linked video is "removed only by
    a Delete, only to the Recycle Bin" (log 51 Q17 rewrites it).
  - The README's Library paragraph does not know the Recycle choice, the
    Left-out videos or the Other row.

## Solution

One round, in eight groups, each commit leaving the suite green and the
typecheck clean:

1. **One name per rule, on the server.** `HeldTitle` is the one holder type;
   `heldByVideo` is the one Held video rule over a list, and the importer's
   rules are named `heldBy…`; an episode's path inside its show is
   `sourceFileOf`; `titleVideos` spells a Source file once.
2. **The importer reads once.** `heldByKey` reads the run's missing map, a
   `fix:` for the double; `heldFolder` and `logUpdated` serve Found again.
3. **Routes that route.** `trashedFirst` gets its docblock back; one
   `recycleChoiceFirst` step serves both Deletes; `leftOutEntries` leaves for
   `import-export/` with its own suite.
4. **The Other row, once.** `countGenreLess` on the browse slice; _Other
   movies_ spelled once.
5. **The page Delete dialogs.** The detail reads answer the title's
   **Delete facts**, a `fix:`; the dead `episodeCount` and `hasPoster` go;
   the hooks take the choice they are handed.
6. **One image fallback.** `useImageFallback` in `src/hooks/`.
7. **The form.** One shape for a Show folder's videos, one season rule, one
   Found file builder, one `prefillTitle` call.
8. **Tests, prose, and the docs that close step 34.**

Two behaviour changes, each a `fix:` with its own case: a second folder
keying to a film found again earlier in the run is **Already in library**;
the page Delete dialogs say what Manage library says. Two wire shapes change
(the detail reads' `deleteFacts`, `ShowFolderRead.unplaced`), both inside
this repo's two build targets.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [library-audit] issue #472 …`, except where a commit is
named `fix:`, `test:` or `docs:`.

### Group 1: one name per rule, on the server

1. **`HeldTitle` is the one holder.**
   - `library/holding` exports `HeldTitle { kind: 'movie' | 'series'; id }`
     for what it called `HeldVideo`, docblocked as "the title a **Held
     video** belongs to"; `titleHolding` answers `HeldTitle | null`. The
     library barrel re-exports the new name.
   - The importer's private `HeldTitle` interface goes; it imports the
     library's. `readShowFolder`'s `ShowFolderContext.titleHolding` is typed
     with it.
   - Guarded by `holding.test.ts`, `createImporter.heldVideo.test.ts` and
     `readShowFolder.heldVideo.test.ts`, unchanged. A type rename only.
2. **`heldByVideo` is the one Held video rule over a list.**
   - A new unit, `import-export/heldByVideo/`, exports
     `heldByVideo(titleHolding, folder, videos, kind): string | null`: the
     first video, spelled by `spellLinkedVideo` under the listed folder,
     that a title of `kind` already plays; `null` for none. Its docblock
     names the glossary rule.
   - `heldByVideo.test.ts` is born with four cases over a stubbed
     `titleHolding`: a film's video found, a series' episode found, a held
     title of the other kind passed over, none held. Prior art:
     `listedFolderOf`'s and `foundPathRefusal`'s suites, a small pure unit
     over a stubbed read.
   - The importer's `holderOf` and `readShowFolder`'s `seriesHoldingAny` go;
     both call it.
   - Guarded by `createImporter.heldVideo.test.ts` and
     `readShowFolder.heldVideo.test.ts`, unchanged.
3. **The importer's rules are named for their rules.**
   - `missingHolderOf` becomes `heldByMissingVideo`, beside `heldByKey` and
     the new `heldByVideo`, so `heldFilm` reads as the glossary's four rules
     in order: folder on record, `heldByVideo`, `heldByMissingVideo`,
     `heldByKey`.
   - `heldFilm`'s and `heldShow`'s docblocks name the rules by those words.
   - Guarded by the importer's `heldVideo`, `missingVideo` and `foundAgain`
     suites, unchanged.
4. **An episode's path inside its show is its Source file.**
   - `readShowFolder`'s `insideShow` goes; `relativePath` and the unplaced
     paths read `sourceFileOf(showFolder, video)`, the importer's spelling of
     a **Source file**. The comment says why: the Show folder is the
     episode's Source folder.
   - Guarded by `readShowFolder.relativePath.test.ts` and
     `readShowFolder.seasonFolder.test.ts`, unchanged.
5. **`titleVideos` spells a Source file once.**
   - One local helper, a Source folder's Source file as a **Linked video**
     path (forward slashes, `posix.join`), serves the film branch and
     `episodeVideos`.
   - Its docblock and `holding`'s SQL comment each name the other: the same
     rule, once in TypeScript for writing an entry, once in SQL for the
     lookup.
   - Guarded by `routes.deleteKeepsFiles.test.ts`, `routes.leftOut.test.ts`
     and `leftOut.test.ts`, unchanged.

### Group 2: the importer reads once

6. **`fix: [library-audit] issue #472 a film found again holds by key for the rest of the run`.**
   - `heldByKey` takes the run's `missing` map and passes over a film only
     while it is in it; it no longer calls `playback.videoFile`. A film
     **Found again** earlier in the run has come off the map, so a later
     folder keying to it is **Already in library**.
   - `createImporter.foundAgain.test.ts` gains one case: a missing film, a
     folder that finds it again by the Missing video rule, and a second
     folder whose name keys to the same film and year with a differently
     named video; the scan logs one `✓ Updated … video` and one _Already in
     library_, and the library holds one film. Red before, green after, in
     the same commit.
   - Log 51 Q22's intent, a missing film keeps no found video out by guess,
     is kept: a film still missing is still passed over. Q23's "read once
     per run" now holds for the key rule too.
7. **Found again opens its folder as a held series does.**
   - The importer's `heldFolder(seriesId)` becomes `heldFolder(kind, id)`;
     `placeFoundAgain` calls it in place of its own
     `mediaFolderOf` / `openFolder` pair.
   - Guarded by `createImporter.foundAgain.test.ts`' Copy-mode cases,
     unchanged.
8. **One `✓ Updated` line.**
   - `logUpdated` takes the title and year and the names a write took
     (`logUpdated(current, { title, year }, names)`), still writing nothing
     for none and answering whether it wrote. `fillHeld` passes
     `filledNames(fill)`; `placeFoundAgain` passes `['video']`.
   - Guarded by `createImporter.sheetFills` and `foundAgain` suites, which
     read the line's text, unchanged.

### Group 3: routes that route

9. **`trashedFirst` has its docblock back.** The docblock written for it
   sits on it again; `linkedFilesOf` keeps only its own. Comments only.
10. **One step decides the Recycle choice.**
    - Inside `createApiRouter`, beside `trashedFirst`,
      `recycleChoiceFirst(kind, id, req, res)`: with `files=trash`, read
      through `queryString`, it is `trashedFirst`; otherwise it records the
      title's **Left-out videos** by `titleVideos` and answers `true`. Its
      docblock is log 51 Q5 and Q7 in two sentences.
    - Both Delete routes call it; their duplicated blocks and comments go.
    - Guarded by `routes.deleteKeepsFiles`, `routes.linkedDelete`,
      `routes.shellTrash` and `routes.leftOut` suites, unchanged.
11. **`leftOutEntries` is a unit of `import-export/`.**
    - It moves to `import-export/leftOutEntries/`, unchanged in signature,
      beside `placeFoundVideo`, which it reads.
    - `leftOutEntries.test.ts` is born with four cases: a path under a listed
      folder answers its Link spelling; a path under none answers nothing;
      a picked row's `undefined` answers nothing; two folders, each path
      under its own. Prior art: `placeFoundVideo`'s suite.
    - Guarded too by `routes.leftOutHandAdd.test.ts`, unchanged.

### Group 4: the Other row, once

12. **`countGenreLess` counts the genre-less films.**
    - The browse slice gains `countGenreLess(): number`, one SQL count with
      the `genreLessOnly` clause `listMovies` already has, beside
      `countMovies`.
    - `home.listOther`'s `count` and `genre.getGenreLess`' `total` read it.
      `genre.ts`' docblock still holds ("no new SQL here": the count is the
      browse slice's).
    - `browse`'s suite gains two cases: the count of a library with and
      without genre-less films, and a count that ignores a search. Prior art:
      `countMovies`' cases.
    - Guarded by `home.test.ts`' and `genre.test.ts`' Other-row cases,
      unchanged.
13. **_Other movies_ is spelled once.**
    - `GenreMovies` exports `OTHER_MOVIES_TITLE`, the `other` mode's
      heading; `HomeRows` imports it in place of its own `OTHER_ROW_TITLE`.
      One feature, so no wire or hook moves.
    - Guarded by `HomeRows.test.tsx`' Other-row block and the Genre page's
      `other`-mode suites, unchanged.

### Group 5: the page Delete dialogs

14. **`fix: [library-audit] issue #472 a page's Delete dialog says what Manage library says`.**
    - `src/types/libraryTitles` gains `DeleteFacts`, `Pick<LibraryTitle,
'path' | 'linkedFiles' | 'originalPath'>`, and `DeleteSubject` becomes
      `Pick<LibraryTitle, 'kind' | 'title'> & DeleteFacts`, moved beside it
      from `libraryTitleView`.
    - `Movie.linkedFiles?` and `SeriesDetail.linkedFiles?` become
      `deleteFacts?: DeleteFacts`. `GET /movies/:id` and `GET /series/:id`
      answer it for every title, copied too, read off the same
      `libraryTitleList` the Manage library page reads; `linkedFilesOf` in the
      routes becomes `deleteFactsOf`. The series route's own "any linked
      episode" check goes: the list knows.
    - `MovieDetailModel.linkedFiles` and `SeriesPageModel.linkedFiles` become
      `deleteFacts`; `EditMenu`, `SeriesEditMenu` and the two dialogs pass it;
      the dialogs spread it into the subject beside `kind` and `title`, so no
      field is invented.
    - New cases, red before and green after in this commit: in
      `DeleteMovieDialog.recycle.test.tsx`, an unreachable linked film names
      its path under What stays, and a copied film with an original says
      _Your original in its library folder_; in `routes.test.ts`, the movie
      read answers `deleteFacts` for a copied film. The series suite gains
      the unreachable case.
    - Existing suites that build a `linkedFiles` field on a detail fixture
      follow the rename; no assertion changes.
15. **The dead `episodeCount` goes.** `DeleteSeriesDialog` and
    `SeriesEditMenu` lose the prop; `SeriesDetail` stops passing it;
    `SeriesPageModel.episodeCount` and `seriesView`'s line that fills it go.
    The season cards' own `episodeCount` stays. Suites that pass the prop
    follow; `seriesView.test.ts` drops its assertion on the field, which
    nothing reads.
16. **The dead `hasPoster` goes.** From `MovieDetailModel`,
    `SeriesPageModel`, `detailView` and `seriesView`. The two view suites
    drop their `hasPoster` assertions; the pages' fallback cases from 464
    carry the behaviour.
17. **The hooks take the choice they are handed.** `useDeleteMovie`,
    `useDeleteSeries` and `useLibraryTitles` require `files: DeleteFiles`.
    The wire calls (`deleteTitleAt`, `deleteMovie`, `deleteSeries`) keep
    their `'keep'` default: it is the route's, "no query keeps the files".
    The one place the household's choice starts is `DeleteTitleBody`'s
    `useState('keep')`. Hook suites that called with no argument pass
    `'keep'`.

### Group 6: one image fallback

18. **`useImageFallback` is the one failed-url rule.**
    - A new hook, `src/hooks/useImageFallback/`, answers
      `{ url, onError }` for a url: the url to draw, or `null` once that url
      has failed to load, until a new url is handed it. Its docblock carries
      the reason each call site now spells in its own words: a new poster
      gets its own chance to load.
    - `useImageFallback.test.ts` is born with four cases: a url is answered
      as handed; after `onError` it is `null`; a new url is answered again;
      `null` stays `null`. Prior art: `useKeyStored`'s suite.
    - `PosterCard`, `ContinueCard`, `SeasonCard`, `EpisodeRow`, `UpNextCard`,
      `MovieDetail` and `SeriesDetail` call it; their state, derivation and
      eight comments go.
    - Guarded by each unit's 464 fallback cases, unchanged.

### Group 7: the form

19. **A Show folder's videos have one shape.**
    - `ShowFolderRead.unplaced` becomes `ShowFolderVideo[]`,
      `{ video: string; relativePath: string }`, the episode's own two field
      names; `unplacedRelative` goes. `ShowFolderEpisode` keeps its fields.
    - `readShowFolder` answers it; `formValues` reads each row's
      `relativePath` from its own entry, not by index.
    - Fixtures that build a `ShowFolderRead` follow the shape; no assertion
      changes.
20. **The Numbering guess has one season rule.**
    - `numberFoundRows` takes each video with its path inside its folder,
      `{ path, inside }`; `folderSeason` reads the season from `inside`'s
      nearest folder by `readSeasonFolder`, else 1, and `relativeSeason`
      goes. The Show folder pick hands `relativePath`; the Series Resolve
      hands each video's path below its Problem's folder.
    - Guarded by `formValues.seasonGuess.test.ts`, `formValues.test.ts` and
      the Resolve's suites, unchanged.
21. **The Series Resolve builds its Found files by `foundFile`**, naming each
    row by its path as it does today (`foundFile(path, path)`), with the
    reason kept as the comment.
22. **One `prefillTitle` call.** `UseShowFolderPickInput.prefillTitle` takes
    `picked: string | null`; the pick calls it once with
    `pickedTitle.current`. `useMovieForm`'s catch comment is rewrapped, and
    `SaveRefusedError` sits in its import list's order. Guarded by
    `MovieForm.showFolderTitle.test.tsx` and `useShowFolderPick.test.ts`,
    unchanged.

### Group 8: tests, prose and the docs

23. **`test: [library-audit] issue #472 the recycle suites lint clean`.**
    The 14 non-null assertions in the four `*.recycle.test.tsx` suites become
    guarded reads (`within(…)` on a found element, or an `expect(…).not
.toBeNull()` before use), as the suites' older neighbours do. No
    assertion changes; the warnings go.
24. **The initiative's em dashes go.**
    - The suite headers read `51, Library audit, Phase n`; the `describe`
      titles take a colon (`createImporter.scan: left-out videos`), the form
      the previous round settled on.
    - The docblocks this initiative wrote are rewritten with commas, colons
      and parentheses.
    - Migration 15's comment names the episode removed in the Series edit
      job too.
    - The household's copy keeps its dashes: the `✓ Updated` line, the
      Delete dialog's lines, anything the prototype spells.
    - No code changes; every suite passes with the same count.
25. **`docs: [library-audit] issue #472 the docs know the library audit shipped`.**
    - **Feature checklist**: the _Library audit_ row goes ✅. Step 34's entry
      becomes what shipped, in step 33's shape, under the line saying where it
      came from (using v0.10.0 for real): a rescan never doubles a title; a
      Delete keeps the files unless you ask for the Recycle Bin, and never
      takes another title's; a title taken out stays out until _Bring back_
      or an add; `Seizoen 1`, `Season 1 (2008)`, release `S01` folders and
      `Specials` read as seasons, and `Aflevering` as an episode; a show
      folder pick names each episode by its path; every film is on the home,
      in _Other movies_ until it has a genre; a film whose file is gone is
      found again; a missing poster draws the stand-in.
    - **README**: the Library paragraph says the same, in its own register;
      the folder tree gains `holding/` and `leftOut/` under `library/`,
      `heldByVideo/` and `leftOutEntries/` under `import-export/`, and
      `useImageFallback` under `hooks/`.
    - **Glossary**: **Left-out video** says migration 15; **Held video**
      names `HeldTitle` as what `titleHolding` answers; **Delete dialog**
      gains **Delete facts**; the _Library audit_ section loses `(new)`.
      The dialogue sections are snapshots and stay.
    - **CLAUDE.md**: the **Media** rule reads "kept by a Delete unless the
      household asks, then only to the Recycle Bin" (log 51 Q17).
26. **`docs: [library-audit] issue #472 the journal`.** A
    newest-first entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - where the round left the plan;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 443 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **`HeldTitle`, not `HeldVideo`.** The glossary's **Held video** is a
  video; what `titleHolding` answers is the title that plays it. The
  importer's private interface already had the right name and shape, so the
  library's export takes it and the importer's copy goes.
- **`heldByVideo` lives in `import-export/`.** Its two callers, the importer
  and `readShowFolder`, are both there; it spells a found video by
  `spellLinkedVideo`, which is what a scan does and the library does not. It
  takes `titleHolding` as a function, as `ShowFolderContext` already does, so
  it is pure and tested without a database.
- **The `heldBy…` family.** `heldByKey` was the one name that said its rule;
  the other two follow it. `heldFilm` and `heldShow` keep their names: they
  answer the chain, not a rule.
- **`sourceFileOf` for an episode's path inside its show.** The Show folder
  is a series' **Source folder**, so a video's path inside it is its
  **Source file**: the existing name is the glossary's. The wire field keeps
  its name, `relativePath`, which is what the form reads it for.
- **The key rule reads the run's map (`fix:`).** Q23's "read once per run"
  is the design; a film the run has found again is no longer missing to the
  run. A second folder for that film is therefore held by key, as any
  present film is. The cost the log accepted ("the key rule now depends on
  the disk") is paid once per run, not once per folder.
- **`recycleChoiceFirst` is a closure in `createApiRouter`**, beside
  `trashedFirst`, which it calls, and for the same reason: both need `res`
  and the injected `media`. `files` is read through `queryString`; anything
  but `trash` keeps the files, as the route's contract says.
- **`leftOutEntries` moves to `import-export/`**, not `library/`: it places
  found paths under listed folders by `placeFoundVideo`, an import-export
  rule. `titleVideos` stays under `library/leftOut/`: it reads stored rows.
- **`countGenreLess` on the browse slice.** The count is SQL the slice
  already has the clause for; `home` and `genre` stay compositions of browse
  queries, as `genre.ts`' docblock promises.
- **`OTHER_MOVIES_TITLE` lives with `GenreMovies`**, which owns the `other`
  mode, and `HomeRows` imports it within the one feature. The path
  `/genre-less` stays spelled where it is used (the route table and
  `HomeRows`): one screen names it, the `moviePath` bar is two.
- **`DeleteFacts` on the detail reads (`fix:`).** The movie and series pages
  draw the Manage library dialog's body (both prototype pages say so), so
  they need the same three facts. They are read off `libraryTitleList`, the
  one place that knows them, for every title, copied too. The trade-off: a
  copied title's detail read now reads each Library folder's reach, as a
  linked one's already did; the household has one Library folder.
  `DeleteSubject` moves to `src/types/` because the wire now carries part of
  it.
- **The wire keeps its default; the hooks lose theirs.** `deleteTitleAt`'s
  `'keep'` is the route's own default, so the wire calls mirror it. A hook is
  only ever called with the choice the body made; a default there is a
  second place the decision could be made.
- **`useImageFallback` in `src/hooks/`.** Seven call sites across molecules
  and three features. It holds UI state only (a url that failed) and knows no
  domain, so a molecule may call it as it calls `useState`; it is the first
  molecule to import from `src/hooks/`, and this plan says why. Keyed by url,
  as every call site already was.
- **`ShowFolderVideo { video, relativePath }`.** The episode carries its two
  fields; the unplaced video now carries the same two, and no index ties two
  arrays. The name is the shape both answers share.
- **One season rule.** The pick and the Resolve differ only in how they find
  a video's path below its folder; the rule over that path is one function.
- **Nothing on the schema, Settings or the prototype changes.** Two wire
  shapes change, both read only by this repo's client: `deleteFacts` for
  `linkedFiles` on the detail reads, and `ShowFolderRead.unplaced`.

## Testing Decisions

- **A good test asserts what a caller or a household sees**: the log lines,
  the rows held, the files trashed or kept, the sentences in the dialog, the
  cards drawn. It never asserts which helper ran or how a hook holds its
  state.
- **The initiative's suites are thorough and behavioural** and carry almost
  every commit unchanged: the importer's `heldVideo`, `missingVideo`,
  `foundAgain`, `leftOut`, `seasonFolders` and `tallies`; the routes'
  `deleteKeepsFiles`, `leftOut`, `leftOutHandAdd`, `bringBack`, `editFolder`,
  `addMovieHeld` and `showFolderRelative`; `readShowFolder`'s three; the four
  `*.recycle` suites; `HomeRows`' Other-row block; the 464 fallback cases on
  every card and page.
- **Characterization before change.** Groups 1, 3, 4, 6 and 7 change no
  assertion. Commits 14, 15, 16, 17 and 19 follow a renamed or removed field
  or parameter in fixtures and calls; commits 15 and 16 drop assertions on
  fields nothing reads. A suite that has to change anywhere else is reading
  an implementation detail, and is fixed in the same commit with the reason
  in the body.
- **New suites and cases:**
  - `heldByVideo`, `leftOutEntries`, `useImageFallback`: four cases each.
    Prior art: `listedFolderOf`, `placeFoundVideo` and `useKeyStored`.
  - `browse`'s two `countGenreLess` cases. Prior art: `countMovies`'.
  - The second-folder case in `createImporter.foundAgain.test.ts` (commit
    6). Prior art: that suite's "two missing films of one file name".
  - The page dialogs' unreachable and copied-original cases, and the movie
    read's `deleteFacts` for a copied film (commit 14). Prior art:
    `DeleteTitleDialog.recycle.test.tsx`' cases for the same lines on Manage
    library.
- **The gate:** the full suite at the end of each commit; `tsc -b --force`
  (an incremental build can miss a spec file) and `eslint src server
electron` at the end of each group. The round ends at one error and 148
  warnings, the 14 this initiative added gone.

## Out of Scope

- **The two edits' reserve-or-reuse closures**, in `PATCH /movies/:id` and
  `PATCH /series/:id`. Log 51 Q26 had the movie edit copy the series edit's
  `reserved` branch on purpose; folding them is the routes file's own round.
- **`useDeleteMovie` and `useDeleteSeries` as twins.** They predate the
  initiative and differ in where they land.
- **`reasonOf` spelled three times in the importer** and once in
  `writeExport`. Two of the importer's predate this initiative; a shared
  error-reason helper wants a home the server's "no `lib/`" rule has to
  agree to first.
- **Pluralising by hand** (`N video(s) left out`, `Left out N videos`): the
  whole codebase does it inline; a plural helper is its own round.
- **`SeasonChoices`' set of failed urls.** Many tiles in one component; the
  hook serves one url. A per-tile component would be a split the screen does
  not otherwise need.
- **The _Bring back_ text button** styled in `FolderRow.styles`, one of
  fifteen feature-styled buttons; a text-button primitive is its own round.
- **`holding`'s SQL spelling of a Source file** beside `titleVideos`':
  cross-referenced in commit 5, not merged (one is a lookup, one a write).
- **Em dashes older than this initiative**, and the household's copy.
- Anything log 51 put out of scope: Loading states, Scan new folders,
  cleaning up an older library's doubles, every language's season word, the
  Details state's reading of a parsed year, a missing episode, a sweep of
  folders no title names.

## Further Notes

- Groups 1 and 3 are the round's reason to exist: the server's rules named
  as the glossary names them, and a routes file that only routes. Group 5's
  commit 14 is the one change a household could see on an ordinary day.
- Order: commit 2 before 3 (the family is named once the shared unit
  exists); 14 before 15 (both touch the series page's props); 19 before 20
  (the season rule reads the new shape). Groups are otherwise independent.
- Follow-ups this plan already sees, each for the journal, not this round:
  - the routes file's two reserve-or-reuse closures;
  - a shared error-reason helper and a plural helper, server and client;
  - a text-button primitive;
  - from earlier entries: a shared held-response and player-harness test
    helper, the repo-wide em dash pass, the sandbox teardown flake, and the
    lint error in `EnrichmentReview.test.tsx`.
