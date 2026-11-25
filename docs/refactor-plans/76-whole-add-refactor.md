# Refactor plan: Whole add, the found art in one spelling, the faces the follow-ups left behind, and the docs that close step 58

> Source initiative: `whole-add`, issue 715 (step 58).
> Shipped by issues 716 to 723: five slices RED and GREEN each, the
> prototype amended, the scanner block, and the walk and documents slice
> (`58ab7f79` to `f39f9cc1`); then three follow-ups built inside the
> initiative: 724 (a Frame fill after a Folder scan or a Resolve), 725 (a
> Backdrop on a Resolve, and a `no-folder` row's Backdrop cell) and 726 (a
> movie edit removes what it lets go), `14321aea` to `c74bff3a`.
> Design log: `docs/design-logs/76-whole-add.md`.
> PRD: `docs/PRDs/76-whole-add.md` (715). Plan:
> `docs/PRDs/76-whole-add-plan.md`.
> Handoff: `docs/handoff/handoff-whole-add/README.md`, history since 721
> amended the prototype.
> This is the initiative's closing round. It ticks **Whole add** and closes 715. Filed as issue #728.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`whole-add` shipped every phase of its plan and three follow-ups. The form
draws a **Backdrop** slot on both kinds, on the add, the edit and (since 725) a Resolve; the **Show folder pick** and the **Film folder read** fill
every slot from the **Folder art** they find, never over a hand pick;
`copyFoundArt` and `copyFoundEpisodes` copy it in; the **Frame fill**
gives a show with no TMDB key its Stills after a series add, edit, Folder
scan or Series Resolve, through the one `takeFrameStill` the Sync uses;
and `FolderShapes` says the layout as log 58 reads it.

At `c74bff3a` the full suite has **13440 tests passing across 958 files**
(one skipped), and `tsc -b --force` is clean. `eslint` over every file the
initiative added or changed reports **0 errors and 83 warnings**, every one
of them older than this initiative (checked against `57db64ed`): unused
`root`s and names in `createImporter.series.test.ts`,
`createImporter.test.ts`, `createImporter.sourceFolders.test.ts` and
`routes.import.test.ts`, two non-null assertions in
`routes.clearDetails.test.ts`, and the unused `name` in
`routes.exportSeries.test.ts` from issue 277.

The design held, and the code follows the house in its larger shapes: each
new unit sits in the domain log 76 named, `frameFill` is injected as
`layoutFill` is, no route imports playback, and the fill rule is one
function (`foundArtFill`) for every slot. What is left is the same rule
spelled twice in places, faces the follow-ups made stale, and the
documents. Every finding below was checked against the code at `c74bff3a`.

### 1. The server's found art in one spelling

- **The two Resolves turn a slot into a `ResolveFile` with two local
  twins.** The film Resolve's `slot` (older) and the series Resolve's
  `artSlot` (725) are the same five lines: a part is `{ stored }`, a
  non-empty path `{ found }`, silence `null`.
- **The two adds refuse a found Poster and Backdrop with the same
  map-and-find**, each spelled inline: `POST /series`'s `artRefusal` and
  `POST /movies`'s `foundRefusal`, which then goes on to the tracks.
- **The series add writes its art and Stills through nested ternaries**
  (`uploads.poster === undefined ? copiedArt.poster === null ? {} : … :
…`, and the same for the backdrop and each episode's Still), where the
  movie add settles each path first (`uploads.poster ?? copiedArt.poster ??
undefined`) and spreads it once.
- **"Nothing copied" is a literal written twice.** Both adds open on
  `let copiedArt: CopiedArt = { poster: null, backdrop: null,
seasonPosters: [] }`, where the house names its empties (`EMPTY` in
  `readFilmFolder`, `NO_FILM` in `useFilmFolderPick`).
- **The art shapes restate each other.** `FoundArt` and `CopiedArt` spell
  `poster` and `backdrop` where the media domain's `TitleArt` already names
  the pair, and `readFoundSeasonPosters` spells `{ season: number; path:
string }` twice where `copyFoundArt` exports it as `SeasonPosterPath`,
  the shape it hands on to.
- **`foundPathRefusal` picks its article with a ternary** (`kind ===
'image' ? 'an' : 'a'`) beside a record keyed by kind (`IS_KIND`). The
  house keys what differs by kind in one record (`STILL_KINDS`,
  `REFUSALS`).

### 2. The Sync's names and the Frame fill's wiring

- **`STILL_KINDS.frame.suffix` is dead.** Since `takeFrameStill` names
  `<stem>.frame.jpg`, `writeEpisodes` reads only `STILL_KINDS.frame.mark`,
  and the record still carries the frame's suffix as if it were used.
- **`writeEpisodes` derives an episode's stem twice**, once in the frame
  branch for its _no frame_ line and once in the TMDB branch for its name.
- **`ImporterDeps.frameFill` is `Pick<FrameFill, 'fill'>`**, a pick of the
  only member, where `layoutFill` beside it is `LayoutFill`.
- **The `createFrameFill` imports sit among another domain's.** In
  `main.ts` it lands between two `import-export/` lines, and in
  `createImporter` the `FrameFill` type between two `import-export/` ones.

### 3. The faces the follow-ups left behind

- **`SeriesEdit.backdropPath` is optional** ("omitted, it stays") and
  written by a statement of its own (`setSeriesBackdrop`), where
  `posterPath` beside it is required and written by `updateSeriesRow`. The
  edit is the whole record (log 76 Q5), its one caller always sends it,
  and no suite relies on the omission.
- **The Files cards' backdrop props are optional** ("omitted, the card
  draws no backdrop slot"), with `onPickBackdrop?.()` wrappers. Since 725
  every context draws the slot and `MovieForm` always passes it; the
  optional props are there only for the two cards' suites.
- **`seriesFormData` sends the poster by hand** (a picked part, else
  `posterPath`) one line above the backdrop sent through `appendFile`,
  which is the same encoding.
- **The Show folder row's ✕ offers an inline empty `FolderArt`**, where
  `useFilmFolderPick` beside it names its empty read `NO_FILM`.
- **Stale and ragged docblocks.** `MovieFormValues.backdrop` still says a
  Resolve draws no slot; the Files cards' props say an omitted backdrop
  draws none. Eight comment lines the initiative added run past 80 columns
  (`copyFoundArt`'s `SeasonPosterPath`, `copyFoundEpisodes`' docblock,
  `createImporter`'s `placeArt`, `readFilmFolder`'s docblock,
  `readShowFolder`'s `PickedFolder`, the router's _All eight_ line and its
  _Save & continue_ comment, `Uploads.backdrop`), and
  `SeriesFormFiles`' docblock and `removedPathsOf`'s ("its own poster and
  backdrop, its") were inserted without rewrapping.

### 4. A hook without its suite

- **`useFilmFolderPick` has no suite of its own.** Log 76 Q23 names
  `useFilmFolderPick.test.ts`; the build proved the hook only through
  `MovieForm.filmFolder.test.tsx`. Every other movie-form hook has its own
  (`useShowFolderPick`'s three, `useSeasonPosters`', `useImportMode`'s).

### 5. The documents

- **The spec still says _never on a Resolve_.** 725 drew the Backdrop slot
  on a Resolve without amending the prototype's two comments in
  `feat.MovieForm.dc.html` or `COMPONENT-SPEC.md`'s **MovieForm** row,
  which also counts `FileField ×2` where the movie kind now draws three.
- **The release checklist has no smoke step for this initiative**, where
  each initiative that changed what an add stores added one (prior art:
  _A linked series add_, and Poster pick's, `8b86610a`).
- **The build has no journal entry**, nor do the three follow-ups, and the
  feature checklist's row reads ⬜ Planned with step 58 still 🔜, its full
  description, and its "(never a Resolve)" from before 725.

The README is untouched: no top-level folder or rule changes. CLAUDE.md's
**Movie form** rule was amended by 723 and still reads true. The glossary
already carries the log's rows and the follow-ups' amendments.

### Found while planning, filed apart

One edge changes what lands on disk, so it is issue 727, a `fix:` of its
own, as plan 75 split issue 713 out:

- `POST /series` reads a found `posterPath` / `backdropPath` whatever part
  arrived and copies it in, so a request carrying both leaves an
  unreferenced copy in the Media folder, and it refuses an empty field
  where the movie add and both Resolves read an empty slot. The movie
  add's reading is the rule.

## Solution

One round in five groups, each commit leaving the suite green and the
typecheck clean:

1. **The server's found art in one spelling**: one `resolveFileOf`, one
   `foundArtRefusal`, the series add's paths settled before the row, a
   named `NO_COPIED_ART`, the art shapes built on `TitleArt` and
   `SeasonPosterPath`, and the refusal's noun in the kind record.
2. **The Sync's names and the fill's wiring**: a mark-only record and one
   stem per episode; `frameFill` typed as `layoutFill` is; imports by
   domain.
3. **The faces the follow-ups left behind**: the series edit's backdrop
   required, the Files cards' backdrop props required, the series poster
   through `appendFile`, a named `NO_ART`, and the docblocks.
4. **`useFilmFolderPick`'s suite.**
5. **The documents**: the spec's Resolve, the release checklist's step,
   the build's journal entry, and the entry and ticks that close step 58
   and issue 715.

## Commits

Every commit is `refactor:` (or `test:` / `docs:` where it says so),
titled `refactor: [whole-add] issue #<n> <description>` with `<n>` this
plan's issue. Each runs the suites of the units it touches; each group
ends on the full suite and `tsc -b --force`. Outside group 4, no test is
added, weakened or changes its claim; where a commit touches a suite it is
a call site or a render helper following a face, never an assertion.

### Group 1: the server's found art in one spelling

1. **One `resolveFileOf` for both Resolves.** The film Resolve's `slot`
   and the series Resolve's `artSlot` become one module-level function in
   the router, beside `queryString` and the other parsers:
   `resolveFileOf(stored, path)`, a part as `{ stored }`, a non-empty path
   as `{ found }`, else `null`. Both Resolves call it for every slot they
   read (the film's video, poster and backdrop; the series' poster and
   backdrop). The suites that prove it: `routes.import` (the film
   Resolve), `routes.seriesResolve` and `routes.resolveFrameFill`, with
   725's Resolve backdrop cases among them.

2. **One `foundArtRefusal` for both adds.** A module-level
   `foundArtRefusal(art)` answers the first refusal of a `FoundArt`'s
   Poster and Backdrop by `foundPathRefusal(path, 'image')`, or `null`.
   `POST /series` returns it as `artRefusal` did; `POST /movies` checks it
   before its tracks, so its order of refusals is unchanged (Poster,
   Backdrop, then each track). Proved by `routes.addSeriesFoundArt` and
   `routes.addMovieFoundArt`, which pin each refusal's sentence.

3. **The series add settles its paths before the row.** `posterPath` and
   `backdropPath` are `uploads.x === undefined ? copiedArt.x : stored(
uploads.x)` as plain values and spread once, as the movie add's are;
   each episode's `stillPath` is settled the same way (a picked Still's
   Stored path, else the copied one, else none). The nested ternaries go.
   Which path wins is untouched (issue 727 changes that, not this commit).

4. **`NO_COPIED_ART`.** `copyFoundArt` exports the empty `CopiedArt`, and
   both adds start from it instead of their literal. Both only read it or
   replace it whole with `copyFoundArt`'s answer, so one shared value is
   safe.

5. **The art shapes built on their names.** `FoundArt` and `CopiedArt`
   extend the media domain's `TitleArt` with their Season posters, and
   `readFoundSeasonPosters` answers `SeasonPosterPath[]`. Types only; the
   wire and every value stay.

6. **The refusal's noun in the kind record.** `IS_KIND` becomes
   `FOUND_KINDS: Record<FoundKind, { is, noun }>` (`a video file`, `a
subtitle file`, `an image file`), and the sentence reads `Not
${noun}: …`. Every sentence is word for word what it was;
   `foundPathRefusal`'s suite and the found-path route suites pin them.

### Group 2: the Sync's names and the Frame fill's wiring

7. **A mark per kind, and one stem per episode.** `STILL_KINDS` becomes
   `STILL_MARKS: Record<StillKind, string>`; the TMDB branch names
   `${stem}.still.jpg` where it stores it, as `takeFrameStill` names its
   frame. `writeEpisodes` derives the episode's stem once at the top of
   each episode's turn, and both branches read it. Every log line and file
   name is unchanged; the `createEnrichment` Frame still and still suites
   and `takeFrameStill`'s pin them.

8. **`frameFill` typed as `layoutFill` is, and the imports by domain.**
   `ImporterDeps.frameFill` is `FrameFill`. In `main.ts`,
   `createImporter` and the router, the `createFrameFill` import sits with
   the other `enrichment/` imports. No value moves.

### Group 3: the faces the follow-ups left behind

9. **The series edit's backdrop is required.** `SeriesEdit.backdropPath:
string | null`, as `posterPath` is, written by `updateSeriesRow` with
   `poster_path`; `setSeriesBackdrop` and its branch go. The route already
   sends it on every edit. The storage suites that call `updateSeries`
   (16 calls across 5 files) pass the backdrop each series holds (`null`
   for every one today), so no claim changes; `routes.backdrop` and
   `routes.editSeries` prove the route.

10. **The Files cards' backdrop props are required.** `backdrop`,
    `onPickBackdrop` and `onRemoveBackdrop` on `MovieFormFilesProps` and
    `SeriesFormFilesProps` lose their `?`, as `poster`'s are; the slot is
    drawn always and the `?.()` wrappers go. The two cards' suites' render
    helpers pass `backdrop: null` and two no-op handlers. Proved by those
    suites and `MovieForm.backdrop.test.tsx`.

11. **The series poster through `appendFile`.** `seriesFormData` sends its
    poster as the backdrop below it is sent, by `appendFile(body,
'poster', values.poster)`; the comment it carried (a held or found
    poster travels as its path) moves onto `appendFile`'s docblock, where
    it is true of every slot. The body is byte for byte the same;
    `formValues`' series body suites pin it.

12. **`NO_ART` for the Show folder ✕.** `useShowFolderPick` names its
    empty `FolderArt`, as `useFilmFolderPick` names `NO_FILM`, and the ✕
    offers it. `useShowFolderPick.art` and `.seasonArt` pin the ✕.

13. **The docblocks.** `MovieFormValues.backdrop` says what is true since
    725 (a Resolve prefills it with its found backdrop); the Files cards'
    docblocks drop the omitted-slot clause; the eight over-wide comment
    lines and the two ragged ones are rewrapped to 80 columns, no word
    changed beyond those three stale clauses.

### Group 4: the hook's suite

14. **`test:` `useFilmFolderPick`'s suite.** `useFilmFolderPick.test.ts`
    drives the hook through `renderHook` over a fake `folderBridge` and a
    stubbed `readFilmFolder`, on `useShowFolderPick.art.test.ts`'s
    pattern: a shell plain add reads the picked video and offers the read
    with `picked` `null`; a second pick offers the earlier read as
    `picked`; the ✕ offers the empty read against the last one and a late
    answer after it, or after a later pick, offers nothing; no bridge, an
    edit, or an empty path reads nothing; a refused read offers nothing.
    It passes on its first run: it pins behaviour already shipped (a
    `test:` commit, so the hook gate checks only the shipping projects
    either way).

### Group 5: the documents

15. **`docs:` the spec knows the Resolve's Backdrop.** The two comments in
    `feat.MovieForm.dc.html` read _the add, the edit and a Resolve_, and
    `COMPONENT-SPEC.md`'s **MovieForm** row's Backdrop sentence ends _On
    the add, the edit and a Resolve (#725), a Resolve's prefilled with its
    found backdrop_; its composition reads `FileField ×3`. No drawn pixel
    changes: the prototype draws the slot on every state already.

16. **`docs:` the release checklist knows the Whole add.** One step after
    _Poster pick_: with no TMDB key, add `The Show (2019)` by the Show
    folder pick under **Link**: Poster, Backdrop, each Season poster and
    every Still in the folder fill their slots; save; the series page
    draws them all, and a little later every Still-less row draws a Frame
    still, none of them written into the Title folder. Then pick
    `Heat (1995)\Heat.mkv` on a movie add: its Poster, Backdrop and tracks
    fill, and ✕ on the video takes them back.

17. **`docs:` the build's journal entry.** _2026-11-25: Whole add, the
    build (issues 716 to 726)_, placed before this round's: what each
    slice shipped, the walk's checks as 723's commit records them, the
    three follow-ups (724's Frame fill after a scan and a Resolve, 725's
    Backdrop on a Resolve and the `no-folder` row's Backdrop cell, 726's
    one rule that a movie edit removes each Stored path it lets go), and
    the judgement calls a later session needs: art always copied, a found
    Still stored as `picked`, the fill re-reading the series at its turn
    and an episode's Still source just before it writes, one Late reserve
    per series, and the fill's work lost on quit and queued again by the
    next save. Its counts are the ones this plan records at `c74bff3a`.

18. **`docs:` step 58 is done.** The feature checklist's row reads ✅
    Done; step 58 becomes one line and a link, as the steps before it
    (_58. ✅ **Whole add**: a title added by hand fills every place of the
    Folder layout, movie and series, with or without TMDB
    ([log 76](design-logs/76-whole-add.md))._), and the paragraph that
    introduced it goes. The dev journal gains this round's entry: counts
    before and after, what each group changed, where the round left the
    plan, and the follow-ups below. The commit's body closes 715.

## Decision Document

- **One rule, one function.** A rule two routes share is a module-level
  function in the router (`resolveFileOf`, `foundArtRefusal`), as its
  parsers already are; a function used by one route stays inside it. Not
  a new folder: neither is used outside the router.
- **A path is settled before the row is spread.** The movie add's shape
  (each path a value, spread once) is the house's; nested ternaries inside
  a spread are the same choice spelled harder to read.
- **An empty is named.** `NO_COPIED_ART`, `NO_ART`, like `EMPTY` and
  `NO_FILM`.
- **A shape is named once and built on.** `TitleArt` is the Poster and
  Backdrop pair; `SeasonPosterPath` the season's path; the found and
  copied shapes extend them. The client's `FolderArt` and `FilmFolderRead`
  stay as they are: `src/types/` is both build targets' and must not
  import the media domain.
- **What differs by kind lives in the kind's record.** The refusal's noun
  beside its test; a Still's mark by kind, and its name where it is
  stored (`takeFrameStill` for a frame, the TMDB branch for TMDB's).
- **A whole edit is whole.** The series edit takes every column it writes,
  `backdropPath` as `posterPath`; an optional field on a whole record is a
  second rule a later caller can trip on.
- **A prop that is always passed is required.** The Files cards' backdrop
  is the poster's word for word, now that every context draws it.
- **The spec follows the code.** The prototype's comments and
  `COMPONENT-SPEC.md` say what 725 built; the handoff README is log 76's
  moment and stays as written.
- **Behaviour changes go to their own issue.** The series add's found art
  reading is issue 727, a `fix:` with its own RED test; commit 3 moves no
  winner.
- **Unchanged, as settled by log 76 or as built:** every unit's domain
  and name; `copyFoundArt`'s and `takeFrameStill`'s signatures;
  `createFrameFill`'s queue, its three reads of `unwanted` and the getter
  that throws to keep a gone series from reserving (the Late reserve's own
  idiom, log 75); `foundArtFill` and its callers; `useFilmFolderPick`'s
  counter; the two Files cards' twin `FileField` blocks (the Poster's
  precedent); `FolderShapes` and `scannerBlock`; the copy; CLAUDE.md; the
  glossary; the README.
- **No route, no wire, no schema, no visible change.**

## Testing Decisions

- A good test drives a unit through its public face and checks what comes
  out: the answer and the rows and files after a request, the sentence a
  refused path gets, the body a form sends, what a hook offers the form,
  the slots on screen. It never checks how a helper is shared, how a type
  is spelled or how a docblock wraps.
- **No test changes its claim.** Groups 1 to 3 move no behaviour a suite
  can see, and the suites are the proof: the found-art route suites
  (`routes.addSeriesFoundArt`, `routes.addMovieFoundArt`,
  `routes.addSeriesSeasonArt`), `routes.backdrop`, the Resolve suites,
  `foundPathRefusal`'s, the `createEnrichment` still suites,
  `takeFrameStill`'s, `createFrameFill`'s, `formValues`' body suites and
  the MovieForm backdrop, folder art and film folder suites. Where a
  commit touches a suite (9's `updateSeries` calls, 10's render helpers)
  it follows a face, and the assertions are untouched. Prior art: poster
  pick's group 1 and sheet in sight's group 1, which changed no test.
- **Group 4 adds one suite**, the one log 76 named and the build left to
  the form's suite. Prior art: `useShowFolderPick.art.test.ts` and
  `useShowFolderPick.seasonArt.test.ts` for a prefill hook over a fake
  bridge; `useImportMode`'s for a late answer dropped by a counter.
- **Group 5 touches no shipping code.** The full suite and
  `tsc -b --force` close each group, and `eslint` over the touched files
  ends with no error and no warning from this initiative.
- **No walk.** Nothing drawn, fetched or stored changes; 723's walk
  stands. The release checklist's new step is the next release's to run.

## Out of Scope

- **Issue 727**: the series add's found art read whatever part arrived,
  and its empty field refused.
- **The movie add's `let storedPath`**, reassigned after the rename. It
  reads in order and is the rename's own; a rewrite of the add's rename
  block is older than this initiative.
- **`readTitleFolder`'s inline `posters[0] ?? null`.** It keeps the whole
  lists for its **Doubled place**, which `readTitleArt` does not answer.
- **A shared Files-card art slot.** The Poster and Backdrop `FileField`
  blocks are twinned in both cards, the Poster's precedent; a molecule for
  them touches the Season posters and Stills too.
- **The 83 older lint warnings** and the long `it` titles and test-support
  strings in the initiative's suites.
- **The handoff README and the glossary's earlier sections**, their logs'
  moments.

## Further Notes

- Groups 1 to 4 are independent of one another, and the commits inside
  each are in any order. Group 5's commits 17 and 18 come last, since 18
  records this round's counts. Issue 727 is independent of every commit
  here and lands on commit 3's settled paths more simply than on the
  ternaries, so it is best taken after group 1.
- **Follow-ups for the journal**: issue 727; and the next release runs the
  checklist's new Whole add step on the installed app.
- Eighteen commits; the build was eight issues and three follow-ups, and
  the round is one spelling for the rules they share, the faces the
  follow-ups outgrew, the suite the log promised, and the documents a
  closing round always writes.
