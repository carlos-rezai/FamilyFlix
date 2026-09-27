# Refactor plan: Enrichment (TMDB) — one domain per concern, the log's molecules as units, one way to raise a notice, and the docs that close the initiative

> Source initiative: [`enrichment`, issue #202](https://github.com/carlos-rezai/FamilyFlix/issues/202)
> Shipped by issues 203–212. Design log: `docs/design-logs/23-enrichment.md`.
> Filed as issue 214.
> The docs-and-checks slice filed as 213 is folded in here as Group 0 and
> Group 6, on the precedent of 200 into 201, 186 into 187, 176 into 177, 168
> into 169, 163 into 164, 156 into 157, 148 into 149 and 140 into 141. It was
> closed at filing so the initiative has one closing issue rather than two.
> The feature table ticks ✅ when this one closes.

## Problem Statement

`enrichment` is step 6 of the build order. It is the first feature that goes
online, and the first caller the **Snackbar stack** has had. It shipped as 150
files and about 20,000 lines across ten slices. The maintainer's standing
instruction set the scope: _translate the prototype 1:1 into the codebase, in
its naming, conventions, patterns and architecture_.

What shipped is what the log settled, and it works end to end:

- migration 5, and three new `settings` keys
- the **Network group**, with the **TMDB key** and its four notices
- `/enrich`, in all three **Enrichment scopes**
- the **Current enrichment run**, polled and re-attachable
- **Decisions** of all three kinds, and their review
- series, episodes and **Stills**
- the **Library root** remembered and every **Source folder** recorded
- the two **Write targets**
- Import's _Also fetch metadata and posters from TMDB_

6175 tests pass across 341 files. `tsc -b` is clean, and `eslint src server`
reports no errors and eight warnings.

What is left is the usual shape of a round built one slice at a time. Each
slice made the smallest change that turned its leaf green, and several of
those changes only look wrong when the initiative is read as a whole.

### 1. `createEnrichment` is a catch-all

Log 23 Q28 gave the domain eight units and made `createEnrichment` "the
domain: … its state machine as closures, `createImporter`'s shape". What
shipped is a 1256-line file, and the state machine is the smaller part of it.
It also holds six pure concerns that were never given units:

- **Reading the start body.** `readOptions` checks the scope, the movie id,
  the fields and the two flags. Every other route parses its own body before it
  calls a domain (`movieFormBody`, `readBody`, and the import's own
  `POST /import`). The start is the one route whose `400` comes back from
  inside the domain as `bad-body`. The pick, the search and the apply routes
  already parse their own bodies.
- **The picker's Candidates.** `candidatesFor`, `decisionFace`,
  `ambiguousReason` and its twenty count words, the poster base and the cap,
  plus the three reason sentences.
- **A title's values now.** `currentFields` and `currentSeriesFields`, in the
  fetched shape `planFields` compares.
- **A plan into columns.** The `if (fill.synopsis) enrichment.synopsis = …`
  block is written twice, once for a film and once for a series with its
  creator and year-range rules. `tmdbSide` is a third, for _Apply choices_.
- **An episode's plan.** Title and air date when empty, runtime under
  Runtime, and whether a still is wanted. It is planned inline in
  `writeEpisodes`, where `planFields` exists as the precedent for a pure plan.
- **TMDB's vocabulary.** `TMDB_GENRE_NAMES` is a second genre table beside
  `tmdbGenres`, and `releaseYear` is a copy of `fetchedFields`' own `yearOf`.

Two of those inline concerns do not do what log 23 settled:

- **The candidate's genre** is the first TMDB name found (_Science Fiction_,
  _Fantasy_). The log's Shapes section says "the first of genre_ids on the
  pool". That is the **Genre pool**'s vocabulary, the one every other genre
  the app draws comes from.
- **The candidate's language** is TMDB's `en`. The log upper-cases it, so the
  line reads `1963 · Drama · EN`.

The copy has drifted in one place too. Q32 and PRD story 52 settle the
conflict's log line as _⚠ Title — differs from what you filled in_. The run
writes _TMDB disagrees with what you filled in_.

### 2. The enrichment domain touches the filesystem

The series refactor settled that "only `media/` touches managed storage". The
enrichment domain does it three times:

- It opens a stored poster with `createReadStream(join(mediaFolder, basename(stored)))`
  to hand it to the poster **Write target**.
- It finds a **Series folder** by taking `dirname` of an episode's season
  folder, after guarding `video.split('/').length < 3` itself.
- It hands that absolute folder to `storeUpload`.

That is path arithmetic over the **Managed media directory** outside the media
domain. The media doubles in the suites cannot see it.

### 3. Series enrichment storage is in the movie's unit

The series refactor put series storage in `library/series/`, one concern per
unit, because "the rules are the same, and the tables and the seam owners are
different". `library/enrich` now holds `enrichSeries`, `enrichEpisode` and
`seriesInScope` beside the movie's writes, and the series half's suite is
`enrich.series.test.ts` in the movie's folder. The **Full details** rule is
spelled three times in one file (`MISSING`, `MISSING_WHERE`, `FULL_DETAILS`).

`library/settings` reads its four keys four ways, each with its own
`selectValue.get(…) as { value: string } | undefined`. Its suite carries the
eight `no-useless-escape` warnings, all in the Library-root leaves, and they
are the whole of eslint's report.

### 4. The eight enrichment suites each build their own TMDB

`fakeTmdb()`, `result()`, `detail()`, `world()` and `reviewed()` are written
out again in each `createEnrichment.*.test.ts`, eight times in all.
`server/src/test-support/` exists for exactly this (`fixedSlot`, `heldCopy`),
and the split in Group 2 would otherwise copy them a ninth time.

### 5. The ten fields are listed four times

- The server's `FIELDS` and `SCOPES` in `createEnrichment`.
- `planFields`' `CONFLICT_LABELS`.
- The client's `ENRICH_FIELDS`, exported from inside `EnrichmentSetup` and
  imported by the organism from there.

`types/export.ts` settled how a list both build targets read is kept:
`EXPORT_FORMATS` and `EXPORT_COLUMNS`, `as const`, with the union derived from
the list.

### 6. The log's molecules shipped inline

Q40 named fifteen frontend units. Five of them shipped as JSX inside another
unit, the way `SeriesMetaLine` and `LoadingSeries` did in the last round:

- `SetupBanner` (both tones), `ScopeCard` and `WriteTargetRow` are inside
  `EnrichmentSetup`, which is 305 lines. Its styles file carries all three
  molecules' pieces.
- `CandidatePicker` is `CandidateButton` plus the dashed card, inside
  `DecisionRow`. `TitleSearch` is also inside `DecisionRow`.

The dashed _Search by title_ card writes a bare `&:hover`. The motion round's
spelling is `:not(:disabled)`, and the series round moved five controls onto
it.

### 7. Seven units have no suite

`useEnrichmentRun`, `useEnrichmentSummary`, `useTmdbKey`, the enrichment
`api/`, and the three steps (`EnrichmentSetup`, `EnrichmentProgress` and
`EnrichmentReview`) are asserted only through `EnrichmentFlow`'s eight suites
and `NetworkSection`'s two. `saveTmdbKey` has no leaf in the settings `api`
suite. Their precedents each have one: `useImportRun`, `useStorageReport`,
`useSettings`, the import-export `api`, `ImportSetup`, `ImportProgress` and
`ImportReview`.

`useEnrichmentRun`'s `pick`, `apply` and `dismiss` each take the settled row
off the snapshot by hand.

### 8. Three spellings the app already factors elsewhere

- **`/enrich`** is spelled by hand in `ImportFlow` (`/enrich?scope=all`),
  `EditMenu` (`/enrich?movie=<id>`, encoded) and `NetworkSection`. The app's
  other routes each have a util: `moviePath`, `seriesPath`, `seasonPath`,
  `episodePlayPath`, `movieFormPath`.
- **The run clock** (`m:ss`, rounded, minutes never rolling into hours) is
  `importView`'s private `clock`, copied into `enrichmentView` word for word.
- **Pure words inside components.** `writtenSummary` (_All done_'s _Saved
  to …_) is a function inside `EnrichmentReview`, and the scope cards'
  descriptions are functions inside `EnrichmentSetup`'s `LIBRARY_SCOPES`.
  Q40 made `enrichmentView` the pure unit for what the flow prints, and it
  already holds the estimate.

### 9. One screen raises its notices around the stack

The **Snackbar stack**'s contract is `useSnackbar()`, which throws outside the
provider and names itself. `useTmdbKey` uses it. `EnrichmentFlow` reads
`SnackbarContext` directly and calls `snackbar?.notify(…)`, "so a flow drawn
with no stack still runs". Three of its eight suites render it without a
provider, and that is the only reason the optional chain exists. This is a
test accommodation in shipping code, and it is the shape the series round took
down in the player's `movieId` arm.

### 10. The Import TMDB box is not the prototype's control

`feat.ImportFlow.dc.html` draws a `<label>` over a clipped
`<input type="checkbox">`, and Q45 says the same: "a `role="checkbox"` over the
clipped input, `visuallyHidden`". It shipped as a `<button role="checkbox">`.
That draws the same pixels, but it is a hand-built checkbox where the
prototype names the native one, and `styles/visuallyHidden.ts` exists for
exactly this (`ComponentDropZone`).

### 11. The documents that close the initiative (issue 213, folded in here)

- CLAUDE.md's folder map and README's tree name none of the following:
  - the fifth server domain, `enrichment/`, and its units
  - `library/enrich/`
  - migration 5 and the three new `settings` keys
  - `storeNamed` on `createMedia`
  - `test-support/offlineTmdb/`
  - `features/enrichment/` and `pages/EnrichmentPage`
  - `NetworkSection`, `useTmdbKey` and `syncLine` in Settings
  - `hooks/useEnrichmentSummary`
  - `api/fetchEnrichmentSummary` and `api/fetchTmdbKey`
  - `types/enrichment.ts`
  - the five new glyphs
- The Architectural Boundaries paragraph still says four domains.
- The `api/` paragraph's list of calls that earned their place stops at seven.
- The Settings Hub paragraph still says four groups and "no screen in the app
  raises a **Snackbar notice** today". It also says the stack's first caller
  will be the **Update offer snackbar**.
- README's Bulk import paragraph still calls Enrichment "planned".
- The glossary's Enrichment rows have not been checked against the shipped
  code.
- The journal has no entry for the build.

## Solution

Seven groups, each leaving a working tree after every commit.

0. **The build's record.** This comes first, so the journal describes what
   shipped before this round changes it.
1. **The shared vocabulary and the shared double.** The ten fields and three
   scopes become one list in `types/`, and one fake TMDB goes into
   `test-support/`, before the domain is split over it.
2. **Server.** The start body is parsed by the route. `createEnrichment`'s
   six pure concerns become units with suites, TMDB's vocabulary lives in one
   place, and the Candidate is shaped as the log shapes it. `media/` reads and
   writes everything under the managed directory. Series enrichment storage
   moves to `library/series/`, and settings reads a key one way.
3. **Shared client units.** One `/enrich` path util, one run clock, and the
   flow's words in its view.
4. **The enrichment feature.** The log's five molecules as units, suites for
   the seven units that had none, and one way to raise a notice.
5. **The prototype's checkbox.**
6. **Documents.** They come last, because the map and the glossary have to
   describe the tree the earlier groups leave behind.

Twenty-eight commits in all. Three things change on screen, and each one is
the log's own wording:

- A **Candidate**'s line reads its genre off the **Genre pool** and its
  language upper-cased: `1982 · Sci-Fi · EN`, where it read
  `1982 · Science Fiction · en`.
- The Activity log's conflict line reads _⚠ Title — differs from what you
  filled in_.
- The Import TMDB box is a native checkbox. It looks the same, and Space now
  toggles it as a checkbox does.

## Commits

### Group 0 — the record of what was built

1. **The journal's enrichment entry.** `docs/dev-journal.md` gets the build's
   entry, dated by the last build commit (2026-09-27). It covers:
   - What shipped across 203–212, slice by slice. The plan turned the log's
     six steps into ten slices.
   - The judgment calls the slices made on their own:
     - `createEnrichment` holding the pure concerns Q28 did not name
     - the series half of the storage placed in the movie's `enrich/`
     - `storeSeriesImage`'s own path arithmetic, where `storeNamed` covered
       only the film
     - `EnrichmentFlow` reading `SnackbarContext` raw
     - the five Q40 molecules left inline
     - the TMDB box built as a `button[role=checkbox]`
     - `useEnrichmentSummary` on the global rung, because Settings and the
       flow both read it. That was right, and it stays.
   - Where the run departed from the log:
     - the Candidate's genre and language
     - the conflict line's wording
     - **an unsettled series** (ambiguous or not found), which is one log
       line and no **Decision**, because the review's pick and apply write a
       film
   - What was deliberately not built, per Q3: a place for the TMDB score or
     the original title, a series _Fetch from TMDB_, a language choice, a
     scheduled sync, and specials.
   - The snackbar milestone: the stack's first callers.
   - The test count: 6175 across 341.
   - The follow-ups, listed by bare number.

### Group 1 — the shared vocabulary and the shared double

2. **The ten fields and three scopes are one list.** `types/enrichment.ts`
   gains `ENRICH_FIELDS` (the ten, in the prototype's chip order, `as const`),
   `ENRICH_FIELD_LABELS` (each field's chip label) and `ENRICH_SCOPES`.
   `EnrichField` and `EnrichScope` are derived from them, as `ExportColumn` is
   from `EXPORT_COLUMNS`. These move onto the lists:
   - the server's `FIELDS` and `SCOPES`
   - `planFields`' `CONFLICT_LABELS`, which becomes a read of the five
     conflictable fields' labels
   - the client's chip list, which the setup and the organism import from
     `@/types`

   No leaf changes. Every surface's suite already asserts the labels it draws.

3. **One fake TMDB.** `server/src/test-support/fakeTmdb/` is added with its
   suite. It is a scripted `TmdbClient`:
   - searches, details, tv, seasons, images, `reachable` and `authenticate`,
     each answered from a table the suite hands in
   - every call recorded in order
   - a request that can be held until released, for the Stop leaves, as
     `heldCopy` holds a copy

   Beside it are `tmdbMovieResult`, `tmdbMovieDetail`, `tmdbTvDetail` and
   `tmdbSeason` builders, and `reviewed(enrichment)`, which waits for the run
   to reach review.

   The eight `createEnrichment.*.test.ts` suites move onto it, and their eight
   local copies go. No leaf is added, removed or renamed.

   `offlineTmdb` stays as it is: it is the one-line double for suites that
   compose the router for something else. The route suites also keep their
   own `fetch` fakes, because they test the real client beneath the router
   and not a scripted one.

### Group 2 — the server

4. **The start body is the route's to read.** `routes/enrichmentBody/` is
   added with its suite, following `movieFormBody/`. It holds two parsers:
   - `startEnrichmentBody` takes over `readOptions`: the scope, a movie id for
     `single` and only for `single`, the fields, and the two booleans. Each
     refusal keeps its sentence.
   - `conflictChoicesBody` takes the apply route's inline check: a map of
     field to `mine`/`tmdb`.

   `Enrichment.start` takes a `StartEnrichment` and answers `started`,
   `busy`, `no-key`, or `no-movie` for an id the library does not hold (which
   the route still answers `400`). `bad-body` leaves the domain's outcome.
   `routes.enrichment*.test.ts` stay green unchanged. They assert every `400`
   and are the proof.

5. **TMDB's vocabulary lives in one place.**
   - `tmdbGenres` gains `tmdbGenreName(id)`, TMDB's movie genre ids to their
     names. `createEnrichment`'s `TMDB_GENRE_NAMES` goes.
   - `fetchedFields` exports its date → year reading as `releaseYear`, and
     the domain's copy goes.

   `tmdbGenres`' suite gains the id leaves, and `fetchedFields`' suite gains
   the year leaves (a date, an empty string, `null`).

6. **The picker's Candidates are a unit, shaped as the log shapes them.**
   `enrichment/decisionFace/` is added with its suite. It is pure and holds:
   - `candidatesFor`
   - `ambiguousReason`, with its count words
   - `decisionFace`
   - the candidate cap and the poster base
   - the three reason sentences (a title matched nothing, a typed query
     matched nothing, the conflict's)

   The Candidate is fixed to log 23's Shapes in the same commit:
   - `genre` is the first of the result's `genre_ids` that `tmdbGenres` puts
     on the **Genre pool**, so _Science Fiction_ is _Sci-Fi_ and _Fantasy_ is
     passed over.
   - `language` is upper-cased.

   The suite covers:
   - the top three by **Match score**
   - the poster URL, or `null`
   - the genre on the pool, and `null` when none is
   - the language
   - the count spelled out to twenty and a numeral past it
   - one release against several
   - the missing face with each of its reasons

   `createEnrichment.decisions.test.ts` has its genre and language
   expectations updated. These are the two on-screen changes Group 2 makes.

7. **A title's values now are a unit.** `enrichment/currentFields/`
   (`currentFields(movie)` and `currentSeriesFields(series)`) is added with
   its suite: every field mapped, a series' creator standing where a film's
   director stands, and a series' runtime `null`. This is a move.

8. **A plan becomes its columns in one unit.** `enrichment/plannedEnrichment/`
   is added with its suite. It is pure:
   - `movieEnrichment(tmdbId, fill)` → `MovieEnrichment`
   - `seriesEnrichment(tmdbId, fill, series, fetched, fields)` →
     `SeriesEnrichment`, with the creator in the director's place and the end
     year only when the Year chip is on and none is held
   - `chosenEnrichment(conflicts, choices, fetched)` → the columns _Apply
     choices_ writes, which takes over `tmdbSide`

   Images are not in it: the domain adds `posterPath` and `backdropPath` once
   they are stored. The two hand-written blocks and `tmdbSide` go. The
   `createEnrichment` suites stay green unchanged.

9. **An episode's plan is a unit.** `enrichment/planEpisode/` is added with its
   suite, beside `planFields`. It is pure: an **Episode** × TMDB's episode ×
   the chips → the `EpisodeEnrichment` to write, and whether a **Still** is
   wanted. The suite covers:
   - title and air date filled only when empty, whatever the chips
   - runtime only under Runtime and only when empty
   - the still only under Poster and only when none is held
   - a blank TMDB name left alone

   `writeEpisodes` keeps only the still's stream and the write.

10. **`media/` reads what it stored, and finds the Series folder.** `Media`
    gains two members:
    - `readStored(storedPath)` streams a **Stored path**'s file, and rejects
      for a path that escapes the root or names no file, the check
      `mediaFilePath` already makes.
    - `storeInSeriesFolder(episodePath, name, source)` writes `name` into the
      **Series folder** above an episode's season folder and answers its
      stored path. It rejects for an episode path with no Series folder
      above it.

    `createEnrichment` drops its `createReadStream`, `join`, `basename` and
    `dirname` over managed storage and its `split('/')` guard. It keeps
    `join` only for `sourcePath`, which is under the **Library root** and not
    managed storage. `createMedia`'s suite gains leaves for both members: the
    bytes, the name, the stored path, and each rejection. The series suite's
    posters and backdrops stay where they were and are the proof.

11. **The conflict line says what the log settled.** The Activity log's line
    for a conflicting title becomes _⚠ Title — differs from what you filled
    in_ (Q32, PRD story 52). `createEnrichment.conflicts.test.ts` gains the
    leaf. None asserted the old sentence.

    After this commit, `createEnrichment` is the run and nothing else: the
    options it is started with, the lookups, the image streams, the
    write-back calls, the Decisions and their settling. The journal records
    its line count before and after.

12. **Series enrichment is series storage.** `enrichSeries`, `enrichEpisode`
    and `seriesInScope` move from `library/enrich/` into
    `library/series/enrich/`, created from the series reader the way
    `series/browse` is. `enrich.series.test.ts` moves beside them as that
    unit's suite.

    `library/enrich/` keeps three things:
    - the film's `enrichMovie` and `moviesInScope`
    - `enrichmentCounts`, which counts both kinds
    - `setSourceFolder` and `sourceFolder`, which are one id space over both
      tables

    The **Full details** rule is spelled once: the two columns a title needs,
    from which the `WHERE` for either table and the count are both built.
    `LibraryStorage`'s names and signatures do not change.

13. **Settings reads a key one way.** `library/settings` gains a private
    `valueOf(key)`, and the subtitle language, the key, the stamp and the
    root read through it. Its suite's Windows paths become `String.raw`, and
    the eight `no-useless-escape` warnings go. `eslint src server` is clean.

### Group 3 — the shared client units

14. **One path to `/enrich`.** `utils/enrichPath/` is added with its suite,
    following `moviePath` and `movieFormPath`. With nothing it answers
    `/enrich`, with `{ scope: 'all' }` it answers `/enrich?scope=all`, and
    with `{ movie: id }` it answers `/enrich?movie=<id>`, with the id encoded.
    `ImportFlow`'s _Finish_, `EditMenu`'s _⟳ Fetch from TMDB_ and
    `NetworkSection`'s sync row move onto it. No leaf changes. Each surface's
    suite already asserts where it lands.

15. **One run clock.** `utils/formatElapsed/` is added with its suite. It
    formats a whole-second `m:ss`: rounded, clamped at zero, and never
    rolling into hours, because a run's clock counts minutes. It is not
    `formatClock`, which floors and grows an hour field for playback, and its
    docblock says so. `importView` and `enrichmentView` lose their `clock`s.
    No view leaf changes.

16. **The flow's words are its view's.** `enrichmentView` gains two
    functions:
    - `writtenSummary(written)`, _All done_'s _Saved to …_, out of
      `EnrichmentReview`
    - `scopeDescription(summary, scope)`, the two scope cards' lines, out of
      `EnrichmentSetup`'s `LIBRARY_SCOPES`

    Its suite gains their leaves: each combination of targets, and each scope
    over a summary.

### Group 4 — the enrichment feature

17. **`SetupBanner` is its own unit.** `features/enrichment/SetupBanner/` is
    one molecule with two tones, 1:1 with the prototype's two banners:
    - `danger` is the 0.1 and 0.32 danger tint, top-aligned, with the 20px
      glyph in the danger ink.
    - `accent` is the accent-soft fill inside the accent line, centre-aligned,
      with no glyph.

    Each tone has its title, its line and its button (Retry as secondary,
    _Open Network settings_ as primary). The banner pieces move out of the
    setup's styles. The suite covers each tone's resolved fill, border and
    alignment, the button's name and variant, and the press.

18. **`ScopeCard` is its own unit.** `features/enrichment/ScopeCard/` is the
    radio card, `scopeCard` and `scopeDot` 1:1: the dot on the left, the 15px
    label, and the line indented 28px. It is `role="radio"` with
    `aria-checked`. `FormatCard` is the precedent for the file set. Q40
    refused to share `FormatCard` itself: its dot is on the right and its
    label is 16px. The suite covers both faces' resolved fill and border, the
    dot, and the press.

19. **`WriteTargetRow` is its own unit.** `features/enrichment/WriteTargetRow/`
    is the glyph tile, the title and one line, which is sans for a plain line
    (_Your library_'s) and mono and clipped for a path. The trailing slot is
    either a `Toggle` named by the title or the _Required_ pill. The three
    rows and their dividers compose it. The suite covers the tile, each kind
    of line, and each trailing control.

20. **`CandidatePicker` is its own unit.** `features/enrichment/CandidatePicker/`
    is the horizontal row of Candidate cards and the dashed _Search by title_
    card. Each Candidate card has its poster over the gradient fallback, its
    title, its meta line and its _% match_, green above 70. The meta line's
    `metaOf` moves with it. The dashed card's hover becomes
    `&:hover:not(:disabled)`, the motion round's spelling. The specificity is
    equal, so no winner moves. `DecisionRow`'s picker leaves move into its
    suite, and `DecisionRow` keeps one leaf proving that the picker is
    composed.

21. **`TitleSearch` is its own unit.** `features/enrichment/TitleSearch/` is
    the 44px input, prefilled, and _Search_ reporting the query as typed. Its
    leaves move out of `DecisionRow`'s suite the same way. `DecisionRow` is
    left with its head (the dot by kind, the title, the reason, the path and
    _Skip_) and the choice of one face.

22. **The three steps have suites.** `EnrichmentSetup.test.tsx`,
    `EnrichmentProgress.test.tsx` and `EnrichmentReview.test.tsx` are added.
    Each drives its step through its props alone:
    - **Setup:** the banners by summary, the scope cards by scope, _Just this
      movie_ in place of the two, the chips, the target rows' absence with no
      root, the source note, and Start's label, variant and estimate.
    - **Progress:** the headline, the elapsed time, the stat line, the bar,
      the current item, the ETA, the log and _Stop_.
    - **Review:** the two tiles, _All done_ against the list, Finish's label,
      and _Sync again_.

    Where a leaf in `EnrichmentFlow`'s suites asserts only a step's pixels,
    it moves down. The organism's suites keep what the organism decides:
    which step is drawn, the Back rule, Start's three outcomes and the
    notices.

23. **The run hook has a suite, and settles a row one way.**
    `useEnrichmentRun.test.ts` is added, following `useImportRun.test.ts`. It
    covers:
    - re-attaching on mount
    - polling at 500 ms while running and not once in review
    - a read from before a start or a cancel dropped
    - a `409` holding the run already going
    - `search` redrawing its row
    - `pick` and `apply` taking the row off and counting it into
      `enriched`, and `dismiss` taking it off without counting
    - each rejecting when the route refuses

    The three hand-written filters become one `settled(run, id, { counted })`.
    The enrichment `api/` gains `api.test.ts`, following the import-export
    one: each call's route, body and statuses, and `EnrichmentBusyError` on a
    `409`.

24. **The key and the summary have suites.**
    - `useTmdbKey.test.ts` covers the stored key filling the field, a key
      typed first not overwritten, **Connected** as a comparison, _Testing…_
      while on the wire, and each of the four notices.
    - `useEnrichmentSummary.test.ts` covers `null` until the read lands,
      `null` still on a refusal, a late read after unmount drawing nothing,
      and _Retry_ keeping the old summary until the new one lands.

    The settings `api` suite gains `saveTmdbKey`'s leaves: `saved` on a
    `200`, and `empty`, `refused` and `unreachable` on the `400`, `422` and
    `503`.

25. **One way to raise a notice.** `EnrichmentFlow` raises through
    `useSnackbar()` as `useTmdbKey` does. The `SnackbarContext` import and
    the four optional chains go. The three suites that rendered it bare
    (`EnrichmentFlow.test`, `.library.test` and `.fromImport.test`) render it
    inside `SnackbarProvider`, the other five suites' wrapper. This is a
    harness edit, not an assertion edit.

### Group 5 — the prototype's checkbox

26. **The TMDB box is a checkbox.** `ImportSetup`'s card becomes the
    prototype's `<label>`:
    - the 22px box, drawn as it is today, `aria-hidden`
    - a native `<input type="checkbox">` clipped with `visuallyHidden`, which
      keeps it in the tab order
    - the label and its hint

    `EnrichCard` becomes a styled `label`, with its pixels unchanged.
    `ImportSetup.enrich.test.tsx` finds it by role and name as before, and
    gains leaves for Space toggling it and for its focus.

### Group 6 — the documents that close the initiative (issue 213)

27. **CLAUDE.md's folder map, README's tree and the glossary.**
    - The map gains:
      - `server/src/enrichment/` and every unit, with a line each:
        `tmdbClient`, `tmdbAuth`, `tmdbGenres`, `matchScore`,
        `fetchedFields`, `currentFields`, `planFields`, `planEpisode`,
        `plannedEnrichment`, `decisionFace`, `writeBack`, `createEnrichment`
      - `routes/enrichmentBody/`
      - `library/enrich/` and `library/series/enrich/`
      - `library/settings/`' three new keys
      - `storeNamed`, `readStored` and `storeInSeriesFolder` on `createMedia`
      - migration 5 in `db/`'s list
      - `test-support/fakeTmdb/` and `offlineTmdb/`
      - `features/enrichment/` and its units
      - `pages/EnrichmentPage`
      - `NetworkSection/`, `useTmdbKey/` and `syncLine/` in Settings
      - `hooks/useEnrichmentSummary`
      - `utils/enrichPath/` and `formatElapsed/`
      - `types/enrichment.ts` with its lists
      - the five new glyphs in `Icon/`
    - The Architectural Boundaries paragraph names `enrichment/` as the fifth
      domain, born by `playback/`'s rule (nothing that existed was a network
      client) and injected as `createApiRouter(…, enrichment)`.
    - The `api/` paragraph adds `fetchEnrichmentSummary` (the Settings row
      and the setup) and `fetchTmdbKey` (the Network group and Import's
      hint), each with the two features that asked.
    - The Settings Hub paragraph says five **Settings groups**, lists the
      Network group's two routes and the enrichment routes, and records the
      **Snackbar stack**'s first callers:
      - the Network group's four notices
      - the flow's _Add your TMDB key here first._, _Match saved._,
        _Details updated._ and _Searching TMDB…_

      "The first caller is the **Update offer snackbar**" becomes history.

    - README's Bulk import paragraph drops "planned". README's tree gets the
      same changes as the map.
    - The glossary's Enrichment rows are read one by one against the code.
      **TMDB key**, **Full details**, **Confident**, **Decision**, **Current
      enrichment run**, **Metadata sheet**, **Source folder**, **Candidate**
      and **Write target** are each confirmed or corrected:
      - **Decision** says it is a film's. An unsettled series is a log line.
      - **Candidate** names the pool genre and the upper-cased language.
    - The _Flagged ambiguities_ list gains three entries:
      - the unsettled series with no review face, awaiting a prototype
        amendment
      - the missing row's reason, amended from the prototype (Q27)
      - the series page's ⋯ menu, still owed from log 22

28. **The journal's paragraph and the tick.** The round's own journal entry
    covers what each group changed, `createEnrichment`'s size before and
    after, the test count before and after, and what was deliberately left
    out, in the shape the decision document below gives. Then the tick:
    - **Enrichment (TMDB)** and **Network group** ✅ in README's and
      CLAUDE.md's feature lists.
    - The build-order chain in both files loses step 6 ("steps 1–6 … are
      done"). **Electron desktop shell** becomes "next", and the remaining
      three keep their numbers and their gates.

    This commit closes this issue. 202 is closed by a comment at the same
    time, by bare number and never with a closing keyword. 213 was already
    closed as folded in when this plan was filed. _(The closure happens at
    closing time, not as a commit.)_

## Decision Document

- **`createEnrichment` is the run's state machine, and nothing pure lives in
  it.** Log 23 Q28 gave it that job, and `createImporter` is the shape. Each
  pure concern becomes a unit beside `planFields` and `fetchedFields`, with a
  suite:
  - `decisionFace`
  - `currentFields`
  - `plannedEnrichment`
  - `planEpisode`

  The closures over the run, the abort controller, the `decided` and
  `disputed` maps, and the lookups stay, for log 13's reason: pulling them out
  would pass all of them across a seam nobody else uses.

- **A route parses its body. A domain is handed typed options.** The start and
  the apply join the pick and the search, and `POST /import`. `bad-body`
  leaves the domain's outcome, and `no-movie` stays, because only the library
  knows whether an id is held. The statuses do not change.
- **TMDB's vocabulary is spelled once.** `tmdbGenres` owns TMDB's genre names
  and ids and their mapping onto the pool. `fetchedFields` owns reading a
  TMDB date.
- **The Candidate is the log's shape.** The genre is on the **Genre pool** and
  the language is upper-cased (Shapes, log 23). Anything the app draws about a
  genre comes from the pool.
- **Only `media/` touches managed storage.** Reading a stored file and writing
  into a **Series folder** are `Media` members. The enrichment domain holds
  stored paths and hands them over. The one path it joins itself is under the
  **Library root**, which the Write targets own.
- **Series enrichment storage is series storage.** It moves to
  `library/series/enrich/`, the series round's rule. The counts and the Source
  folder pair stay in `library/enrich/` because they span both kinds over one
  id space. `LibraryStorage` does not change.
- **A list both build targets read lives in `types/`, `as const`.**
  `ENRICH_FIELDS`, `ENRICH_FIELD_LABELS` and `ENRICH_SCOPES`, following
  `EXPORT_COLUMNS`. The server validates against them and the chips draw
  them.
- **Every route has a path util.** `enrichPath` joins `moviePath` and
  `movieFormPath`. No surface spells `/enrich` by hand.
- **A run's clock is one util and a playback clock is another.**
  `formatElapsed` rounds and counts minutes. `formatClock` floors and grows an
  hour field. They answer different questions, so there are two.
- **Q40's units are units.** `SetupBanner`, `ScopeCard`, `WriteTargetRow`,
  `CandidatePicker` and `TitleSearch` each get the three-file folder.
  `FormatCard` and `StatTile` stay unshared, as Q40 ruled: different pixels,
  and a mode prop for no one.
- **The Snackbar contract has no optional path.** A screen that raises a
  notice uses `useSnackbar()` and is tested inside the provider. A shim that
  exists only for a test harness comes down at the refactor, as the player's
  `movieId` arm did.
- **The prototype's control over a look-alike.** The TMDB box is the native
  checkbox the prototype and Q45 name.
- **Design logs are not edited.** Log 23 records the amendment it made (Q27)
  and the one still owed (log 22's ⋯ menu). The glossary and the journal carry
  the flags forward, and so does the new one: an unsettled series.
- **Three things change on screen.** The Candidate's line, the conflict's log
  line, and the checkbox's keyboard. Each is the log's own wording or control.
  Anything else that renders differently after this round is a bug in the
  round.

## Testing Decisions

- **A good test asserts behaviour through the unit's own seam.**
  - A pure unit: what it answers for what it is handed.
  - A storage unit: what a call stores and answers over a real in-memory
    SQLite.
  - A `Media` member: the bytes on disk under a sandbox, and each rejection.
  - A hook: what it hands back and what it sends, over `fakeResponse`.
  - A molecule: what it draws, and what `resolvedStyle` resolves it to.

  No test reaches into another unit's internals.

- **Pure moves and splits change no leaf.** Commits 2, 3, 7, 8, 9, 12, 14, 15
  and 25 move, extract or rename code under suites that already assert its
  behaviour. A red leaf in any of them means the refactor is wrong, not the
  test.
- **Leaves move down, the organism keeps its decisions.** Commits 20–22 copy a
  molecule's or a step's leaves from `DecisionRow`'s or `EnrichmentFlow`'s
  suites into the unit's own suite. The parent keeps one leaf proving it
  composes the unit, plus what it alone decides. No fact is left unasserted.
- **Behaviour changes are asserted where they happen.** The Candidate's genre
  and language (commit 6), the conflict line (commit 11) and the checkbox's
  keyboard (commit 26) each add or change a leaf in the same commit.
- **New suites for the units that had none:**
  - `fakeTmdb`
  - `enrichmentBody`
  - `decisionFace`
  - `currentFields`
  - `plannedEnrichment`
  - `planEpisode`
  - `enrichPath` and `formatElapsed`, which are required for every function
    in `src/utils/`
  - the five molecules
  - the three steps
  - `useEnrichmentRun` and the enrichment `api`
  - `useTmdbKey` and `useEnrichmentSummary`

  Each is written in the commit that creates or covers the unit.

- **Prior art.**
  - `heldCopy` and `fixedSlot` for `fakeTmdb`.
  - `movieFormBody.test.ts` for `enrichmentBody`.
  - `planFields.test.ts` and `fetchedFields.test.ts` for the pure units.
  - `createMedia.test.ts`' `storeNamed` and `seasonFolder` leaves for the two
    `Media` members.
  - `series/browse.test.ts` for the moved storage suite.
  - `moviePath.test.ts` for `enrichPath`.
  - `importView.test.ts` for `formatElapsed`'s cases.
  - `FormatCard.test.tsx`, `ActionRow.test.tsx` and `DecisionRow.test.tsx` for
    the molecules.
  - `ImportSetup`, `ImportProgress` and `ImportReview`'s suites for the steps.
  - `useImportRun.test.ts` and the import-export `api.test.ts` for the run
    hook and its wire.
  - `useSettings.test.ts` and `useStorageReport.test.ts` for the key and the
    summary.
- **The round is finished when `node_modules/.bin/vitest run`,
  `node_modules/.bin/tsc -b tsconfig.json` and
  `node_modules/.bin/eslint src server` are all clean.** Commit 13 makes eslint
  clean of warnings too.

## Out of Scope

- **A review face for an unsettled series.** An ambiguous or unmatched series
  is logged and left, because the review's pick and apply write a film, and
  the prototype draws no series Decision. That is a behaviour and a prototype
  amendment, not a refactor. It is flagged in the glossary and the journal.
- **Folding `lookUp` and `lookUpSeries`.** They share a search-then-detail
  shape, but a film's unsettled answer is a **Decision** and a series' is a
  reason. Folding them would parameterise both over that difference, the
  series round's argument about `importMatch`/`importShow`.
- **Interaction states on the radio cards and Candidate cards.** `ScopeCard`,
  the Candidate card and `FormatCard` have the prototype's hover-less faces,
  and the motion round's contract did not name radio cards. Giving all three a
  state is its own §2a amendment.
- **Sharing `ActionRow` with the Network group's sync row.** The prototype
  draws one on a card and one bare under a divider: different pixels.
- **The Source folder's separator.** It is stored as `relative()` answers it on
  the machine that imported. It is only ever joined back onto the Library root
  on that same machine, and `join` reads either separator. Changing it would
  migrate rows for no reader.
- **`createImporter`'s own size.** It grew by the Source folder writes only.
  Its shape was settled by log 13 and the import refactor.
- **Everything log 23 Q3 ruled out**: a place the TMDB score or original title
  is drawn, a series _Fetch from TMDB_, a language choice, scheduled syncs,
  and specials.
- **Per-notice durations.** The stack has none (the snackbar round), so the
  prototype's are dropped, as Q9 said.

## Further Notes

- **What the next initiative inherits.** After this round:
  - five server domains, each one concern per unit
  - `media/` the only code that touches managed storage
  - one TMDB double for any future suite
  - route utils for every screen
  - the Snackbar stack with real callers and one way to reach it

  The Electron shell (step 7) will fill `Change…` in Storage, give the Import
  and Enrichment root a native picker, and find `library-root` already
  remembered.

- **Why the slices built it this way.** Every item above was the smallest
  change that made a slice's leaf pass:
  - The pure concerns went into `createEnrichment` because each slice's leaf
    was a domain leaf.
  - The series storage went into `enrich/` because the movie's statements were
    open beside it.
  - The Series folder was found by hand because `storeNamed` answered only for
    a film's folder.
  - The context was read raw because three suites had no provider.

  That these add up to a second spelling of six rules is only visible when the
  initiative is read as a whole.
