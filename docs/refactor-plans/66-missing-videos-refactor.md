# Refactor plan: Missing videos, one rule for the paths a removal lets go, one Take out per title shape, the Missing check in its two passes, and the docs that close step 49

> Source initiative: `missing-videos`, issue 633 (step 49).
> Shipped by issues 634 to 639: five slices, RED and GREEN each, and the
> walk and documents slice (`6d39910d` to `f88d54c7`).
> Design log: `docs/design-logs/66-missing-videos.md`.
> PRD: `docs/PRDs/66-missing-videos.md` (633). Plan:
> `docs/PRDs/66-missing-videos-plan.md`.
> Handoff: `docs/handoff/mol.ProblemRow.dc.html` (amended by log 66).
> This is the initiative's closing round. It ticks **Missing videos** and
> closes 633. Filed as issue #641.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`missing-videos` shipped every phase of its plan. A run that walks Library
folders runs the **Missing check** last and lists each held film or show
whose video is gone as one soft `missing` **Problem**; **Take out** on the
row removes the film, the whole show, or only its gone episodes, with no
**Left-out video** recorded; each root folder the **Folder layout** turns
away is a hard `off-layout` **Problem**, _Skip_ only.

At `f88d54c7` the full suite has **12357 tests across 825 files, all
passing** (one skipped). `tsc -b --force` is clean. `eslint src server
electron` reports **1 error and 137 warnings**, as the show-folder-title
round closed on: the build added none.

The design held. What is left is what six slices built one after another
leave behind: one rule written twice in the series write, the Delete's
row-then-folder step written twice in the importer beside two routes that
already spell it, one take-out branch named and the other inline, a 90-line
check with a closure inside it, a sort that sorts what is already sorted,
names that say _film_ for a show, docblocks the build wrapped by hand, and
the documents. Every finding below was checked against the code at
`f88d54c7`. They fall into five families.

### 1. The series write: one rule written twice

- **"The Stored paths no row points at any more" is computed twice.**
  `updateSeriesGraph` collects the paths before (`pathsOf` plus
  `seasonPosterPaths`), then the paths after, and answers the difference as
  `removedPaths`. `removeEpisodeRows` (issue 637) builds the same after-set
  the same way, but reaches its before-set another way: the removed
  episodes' paths alone, through `pathsOf({ ...series, posterPath: null },
…)`, a spread that hides the series poster so it is not offered for
  removal. The edit's own shape needs no such trick: the poster is still
  pointed at after the removal, so the difference never answers it.

### 2. Take out: two shapes, one spelled inline

- **The Delete's step is written twice in the importer.** _Read the
  recorded **Media folder**, delete the rows, then `removeTitleFolder`
  best-effort_ is inline in `takeOutMissing`'s film branch and again in
  `takeOutGoneEpisodes`' whole-show branch. It is the same step the movie
  and series `DELETE` routes take after their `leaveOut`; a Take out is
  that step without the `leaveOut` (log 66 Q9).
- **One take-out has a name, the other has none.** The show's is
  `takeOutGoneEpisodes`, a closure beside `checkMissing`; the film's is
  eight lines inside `takeOutMissing`, which also carries an unreachable
  `movieId === undefined` guard after the `seriesId` branch (a `missing`
  Problem always carries one or the other, log 66 Q6).
- **The press's words are named for a film.** `TAKE_OUT_FILM` is also what
  a show with every episode gone reads, and `takeOutShow` names the words,
  not the act, which leaves no good name for the show's take-out itself.
- **The counts skip `count()`.** `missingEpisodesReason` and the press's
  words write `${total}` and `${gone}`, while `unplacedReason`,
  `failedShowReason` and every other count in the importer's copy goes
  through `count()`.
- **The episode list is one nested ternary.** `missingEpisodesReason` joins
  the first three **Episode tags** with a three-way ternary and two `?? ''`
  fallbacks, mixing _which tags_ with _how a list is spelled_.

### 3. The Missing check in one block

- **`checkMissing` is one 90-line closure holding another.** It builds the
  read folders' paths, defines `listedOnce` inside itself, loops the films,
  then loops the shows; the two loops share nothing but `readPaths`.
  Every other pass of the importer of that size is a named closure per
  concern (`importPlaced`, `placeShows`, `takeOff`).
- **The gone episodes are sorted twice.** `listEpisodes` already answers in
  season and episode order (`ORDER BY season_number, episode_number`), and
  `checkMissing` sorts them again by the same keys.

### 4. The client and the words

- **`ProblemRow`'s _Resolve_ test is three comparisons.** `resolvable` is
  `!differs && kind !== 'missing' && kind !== 'off-layout'`, while the
  feature names its other kind sets as sets: `SOFT_KINDS` in `importView`,
  `DOT_TONE` in the styles.
- **Four docblocks the build wrapped by hand**, each with one line past 80
  columns and the next cut short: `Importer.takeOutMissing`'s (_every
  episode is gone. `false` for an id_ / _not there_), `importPlaced`'s
  (_Reaching review marks every folder the walk `read` as scanned, in_),
  `walkLibraryFolder`'s (_importer files as an `off-layout` **Problem**; the
  root's loose videos one line_) and `ImportReview`'s (_itself: the_ /
  _**Run hook** does_). Prettier leaves comments alone, so they stay as the
  slices left them.

### 5. The documents

- **The feature checklist's row reads _Missing videos_, ⬜ Planned**, and
  step 49 is 🔜.
- **The README** says a film whose file has gone missing is found again,
  and nothing of a scan listing what is gone.
- **The release checklist** has no smoke for a gone video or an off-layout
  folder.
- **The journal's build entry** names no follow-ups; this round's entry
  names issue 640.

## Solution

One round in five groups, each commit leaving the suite green and the
typecheck clean:

1. **The series write's one rule**: a private `removedPathsOf` both
   transactions call.
2. **The press's words**: named for what they say, counted through
   `count()`, the tag list spelled by one private helper.
3. **Take out per title shape**: a private `takeOutTitle` for the
   rows-then-folder step, `takeOutFilm` and `takeOutShow` beside each other,
   and `takeOutMissing` a two-way dispatch.
4. **The Missing check in its two passes**: `checkMissingFilms`,
   `checkMissingShows` and `dropOffLayoutAt`, and no second sort.
5. **The client set, the docblocks, and the docs that close step 49**, then
   the journal.

No behaviour changes. No wire, schema, route, setting, copy, drawn pixel or
prototype state changes. The two edges found while planning (a show with
every episode gone listed twice, and _is missing 1 episode videos_) change
what review and the log show, so they are issue 640, a `fix:` of their own.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [missing-videos] issue #641 …`, except where a commit is named
`docs:`.

### Group 1: the series write's one rule

1. **`removedPathsOf(seriesId, before)`.** A private closure in the series
   write, beside `pathsOf` and `seasonPosterPaths`: given the paths a series
   pointed at before a change, answer each one (once) that no row of the
   series points at now, the series' own poster, its episodes' tracks,
   stills and Managed videos, and its Season posters. Its docblock is the
   one `removedPaths` carries on `SeriesUpdate`. `updateSeriesGraph` calls it
   for its `removedPaths`. `removeEpisodeRows` reads its before-paths as the
   edit does, `pathsOf(series, held)` plus `seasonPosterPaths`, before it
   deletes, and answers `removedPathsOf`; the `posterPath: null` spread
   goes. Guarded by `write.test`'s `removeEpisodes` suite (the shared still
   and track kept, a Linked video never answered) and every `updateSeries`
   suite's `removedPaths` rows, unchanged.

### Group 2: the press's words

2. **`TAKE_OUT_TITLE` and `takeOutWords(gone, total)`.** `TAKE_OUT_FILM`
   becomes `TAKE_OUT_TITLE`, its docblock saying it is a film's press and a
   show's with every episode gone; `takeOutShow` becomes `takeOutWords`,
   named as the copy it answers, which frees `takeOutShow` for group 3. Its
   count goes through `count()`, as `unplacedReason`'s does. Guarded by
   `createImporter.takeOutEpisodes.test`'s press words and
   `createImporter.missingCheck.test`'s `takeOut`, unchanged.
3. **`tagList(tags)`, the gone episodes spelled once.** A private pure
   helper beside `missingEpisodesReason`: the first three tags, joined
   _A, B and C_, then _and N more_ through `count()`. `missingEpisodesReason`
   becomes the every-episode sentence or `tagList` plus _is_ or _are_, and
   its own `total` goes through `count()`. The nested ternary and the two
   `?? ''` fallbacks go. Guarded by `createImporter.missingEpisodes.test`'s
   one, three and five gone rows and its every-episode row, unchanged.

### Group 3: Take out per title shape

4. **`takeOutTitle(kind, id)`.** A private closure in `createImporter`: the
   recorded **Media folder** read first, then `deleteMovie` or
   `deleteSeries`, then `removeTitleFolder` best-effort, the movie and
   series `DELETE` routes' step without their `leaveOut`. Its docblock says
   so and names log 66 Q9. `takeOutMissing`'s film branch and
   `takeOutGoneEpisodes`' whole-show branch call it. Guarded by
   `createImporter.missingCheck.test`'s take-out suite (rows gone, Media
   folder gone, no Left-out video, a title deleted elsewhere passed over),
   `createImporter.takeOutEpisodes.test`'s every-episode suite and
   `routes.importTakeOut.test`, unchanged.
5. **`takeOutFilm` beside `takeOutShow`; `takeOutMissing` dispatches.**
   `takeOutGoneEpisodes` is renamed `takeOutShow(seriesId, recorded)`. A
   new `takeOutFilm(movieId)` beside it holds the film's
   _passed over when already gone, else `takeOutTitle`_. `takeOutMissing`
   reads as its docblock does: the listed Problem found and checked
   `missing`, then `takeOutShow` for a `seriesId`, `takeOutFilm` for a
   `movieId`, then `takeOff`; the unreachable `movieId === undefined` guard
   becomes the dispatch's own narrowing. The interface docblock is
   reflowed in the same words. Guarded as commit 4.

### Group 4: the Missing check in its two passes

6. **No second sort.** `checkMissing`'s `.sort` over the gone episodes goes:
   `listEpisodes` answers them in season and episode order already, and a
   comment says so where the tags are spelled. Guarded by
   `createImporter.missingEpisodes.test`'s season-and-episode order row
   (S02E01, S01E03 and S01E02 deleted, named S01E02, S01E03 and S02E01),
   unchanged.
7. **`checkMissingFilms`, `checkMissingShows` and `dropOffLayoutAt`.**
   `listedOnce` leaves `checkMissing` as a closure of the importer,
   `dropOffLayoutAt(current, dir)`: take the `off-layout` Problem filed for
   that folder off `current`, if there is one, and its source with it. It
   stays a splice on `current`, not a call to `takeOff`, which reads the
   module's `run` and clears `differing` besides. The film loop becomes
   `checkMissingFilms(current, missing, readPaths)`, which resolves its
   title's folder and calls `dropOffLayoutAt`; the show loop becomes
   `checkMissingShows(current, readPaths)`. `checkMissing` keeps its name and
   its docblock, builds `readPaths` and calls the two. Guarded by every
   `missingCheck`, `missingEpisodes`, `missingWalk` and `offLayout` suite,
   unchanged, the walk's _a gone film appears once_ among them.

### Group 5: the client, the words and the docs

8. **`ProblemRow`'s kinds with no _Resolve_ are a set.** A module
   `NO_RESOLVE: ReadonlySet<ProblemKind>` of `differs`, `missing` and
   `off-layout`, its docblock the three reasons the component's docblock
   gives (settled on the row by the diff, settled on the row by Take out,
   fixed only on disk); `resolvable` reads it. The `differs` constant stays
   for the diff face. Guarded by `ProblemRow.test`'s _Resolve_ rows for the
   resolvable kinds and its _offers no Resolve_ rows for `differs`,
   `missing` and `off-layout`, unchanged.
9. **Four docblocks reflowed.** `Importer.takeOutMissing` (if commit 5 has
   not already), `importPlaced`, `walkLibraryFolder` and `ImportReview`
   rewrapped at 80 columns in the words they hold. Comments only.
10. **`docs: [missing-videos] issue #641 the docs know what a scan lists`.**
    - **Feature checklist**: the row reads _Missing videos: a held title
      whose file is gone_, ✅; step 49 goes ✅ in step 48's shape (_Built in
      issues 634 to 639; the closing round in issue #641_), its _Out_ bullet
      naming issue 640 as a bare number.
    - **README**: line 54, after the sentence on a film found again, adds
      that a rescan lists a title whose video is no longer on disk, and a
      folder it could not read, for the family to take out or skip, and that
      nothing leaves on its own.
    - **Release checklist**: a _Missing videos_ smoke after _Rescan a
      folder_: on a sandbox Library folder holding a copy of the dev library,
      delete one film's video and one episode's, and make an empty `Heat/`;
      _Scan all folders_ lists the film and the show under _Missing_, `Heat`
      under _Off layout_; _Take out of library_ and _Take out 1 episode_
      settle their rows and the grid loses the film; the original files are
      untouched.
    - **Glossary**: checked against the round; **Missing check**, **Take
      out**, **Off-layout folder** and the three updated rows already say
      what the code does. `takeOutTitle`, `removedPathsOf`, `tagList` and
      `NO_RESOLVE` are unit names, not terms.
11. **`docs: [missing-videos] issue #641 the journal`.** A newest-first entry
    in `docs/dev-journal.md`, in the last refactor entry's shape: what each
    group changed, where the round left the plan, the test count and lint
    against `f88d54c7`, and the follow-ups: issue 640, as a bare number. The
    commit closes 633 in words, not with a keyword, and this issue with one.

## Decision Document

- **`removedPathsOf` is private to the series write**, beside `pathsOf` and
  `seasonPosterPaths`, named for the `removedPaths` it computes. Both
  transactions read their before-paths the same way. `SeriesWrite`,
  `LibraryStorage` and `removeEpisodes`' signature do not change.
- **`takeOutTitle(kind, id)` is private to `createImporter`.** The routes'
  two `DELETE`s keep their own inline step: lifting it to a shared unit
  means a home that holds both `storage` and `media`, which neither the
  `library` nor the `media` domain is, and the routes are HTTP only. The
  importer already holds both (log 66 Q11).
- **`takeOutFilm` and `takeOutShow`** name the two shapes of a **Take out**,
  in the glossary's word; `takeOutMissing` stays the `Importer`'s method
  and the glossary's code name.
- **`TAKE_OUT_TITLE` and `takeOutWords`** name the copy, which stays on the
  server and travels as `ImportProblem.takeOut` (log 66 Q11).
- **`tagList` is private**, for **Episode tags** only. No shared list-join
  helper: the importer's other lists (the `✓ Updated` line's fields) join with
  commas, and the client spells its own copy.
- **`count()` for every count in the new copy.** No fixture reaches 1,000
  episodes, so no run's text changes.
- **The Missing check keeps its name and its place**, last in
  `importPlaced`. `dropOffLayoutAt` works on the run it is handed, as every
  pass `importPlaced` calls does, not on the module's `run`.
- **`NO_RESOLVE` lives in `ProblemRow`**, the one unit that draws
  _Resolve_; `DOT_TONE` stays in the styles and `SOFT_KINDS` in
  `importView`.
- **Nothing on the wire, the schema, the routes, the sheet, the drawn
  screens or the prototype changes.**

## Testing Decisions

- **A good test asserts what the household or a caller sees**: the rows
  review lists and their words, the press's answer, which rows and files
  are left after a Take out, the log's lines. It never asserts which
  closure ran or how a list was joined.
- **The initiative's suites carry every refactor commit**:
  `createImporter`'s `missingCheck`, `missingEpisodes`, `takeOutEpisodes`,
  `offLayout` and `missingWalk`; `walkLibraryFolder.offLayout.test`;
  `write.test`'s `removeEpisodes` and `updateSeries` suites;
  `routes.importTakeOut.test`; `ProblemRow.test`, `ImportReview.test`,
  `useImportRun.takeOut.test`, `importView.test` and `api.test`. Beside them,
  the importer's `foundAgain`, `folderLayout` and `doubledPlaces` suites
  guard the walk the check runs after.
- **No new tests.** Every unit this round names is private (`removedPathsOf`,
  `takeOutTitle`, `takeOutFilm`, `takeOutShow`, `takeOutWords`, `tagList`,
  `checkMissingFilms`, `checkMissingShows`, `dropOffLayoutAt`) or a module
  constant (`NO_RESOLVE`), and each is driven through an export whose suite
  already tables its every case. Issue 640 brings its own tests.
- **Prior art for the rhythm**: the show-folder-title round (issue 632) and
  the rescan-a-folder round (issue 625).

## Out of Scope

- **Issue 640**: a show with every episode gone is listed under _Missing_
  and again under _Off layout_, since its Season folders now hold no video;
  and one gone episode logs _is missing 1 episode videos_. Both change what
  review and the log show. Commit 7's `dropOffLayoutAt` is the unit 640's
  fix will call from the show pass.
- **The routes' `DELETE`s sharing `takeOutTitle`** (see the Decision
  Document).
- **Found again for episodes, a bulk Take out, remembering a kept title,
  and a missing title drawn in the grid** (log 66, Trade-offs).
- **The `{ row: null, folder: null, candidates: [] }` source literal**,
  written across the importer before this initiative; a named constant is a
  round of its own.
- **The lint error and the warnings that predate the initiative.**

## Further Notes

- **Commit 5 depends on commits 2 and 4** (the freed name, the shared
  step). Commit 7 depends on commit 6 only to keep the diff small. Group 1
  is independent of everything; group 5's commits 8 and 9 of the rest.
- **Every refactor commit is green**; there is no `test:` commit in this
  round.
