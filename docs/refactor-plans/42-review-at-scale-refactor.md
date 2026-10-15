# Refactor plan: Review at scale — one reading of each new rule, bodies read where bodies are read, required props, and the docs that close the initiative

> Source initiative: `review-at-scale`, issue 352 (step 25).
> Shipped by issue 353 (`0ec51b8`, the prototype amendment) and issues
> 354–365, one RED and one GREEN each: 354 `53ed76a`/`9f808ca`, 355
> `f508e4f`/`8113c1a`, 356 `c18c4bb`/`dca2b15`, 357 `8ee4a6e`/`8a35b0d`,
> 358 `2259a9a`/`197d172`, 359 `b938c20`/`64d4390`, 360 `0b0e8c8`/`170ab5c`,
> 361 `dd62ffc`/`435744d`, 362 `db6ff76`/`010bda4`, 363 `001561c`/`4154e58`,
> 364 `2bf1ee0`/`108c224`, 365 `8b50172`/`d0d13c2`.
> Design log: `docs/design-logs/42-review-at-scale.md`. PRD:
> `docs/PRDs/42-review-at-scale.md`.
> This is the initiative's closing round: it ticks **Review at scale + Season
> art** and closes 352. Filed as issue 366.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`review-at-scale` shipped every slice of log 42's implementation plan. The
full suite is green at `d0d13c2`: 9270 tests across 557 files, with
`tsc -b --force` clean.

The twelve slices were built one at a time by agents that each saw one slice,
and the seams show. Nothing below is a bug a household would see. Every
finding was checked against the code for this plan. They fall into three
families:

- a new rule spelled twice;
- a body read outside the readers that exist for bodies;
- a prop or parameter made optional only so the suites written before it
  would still compile.

Then there are the documents, which still describe step 25 as planned.

### 1. The search: dead folds, a loop twice, a cast

- **`searchQuery` folds curly quotes and dashes to ASCII, then turns every
  non-letter-or-digit into a space.** The three folds are dead: `’` becomes
  `'`, and the next line makes that `'` a space anyway. The docblock and the
  glossary both describe the folds as if they did something.
- **`stripTails` was added and `titleGuess` kept its own copy of the loop.**
  The tail strip is now written twice in one file.
- **The dash class `‐-―` is spelled three times**: `SUBTITLE_MARK` in
  `searchLadder`, `NOISE_EDGE` in `titleKey`, and the dead fold in
  `searchQuery`.
- **`searchTitled` casts.** It picks `client.searchMovie` or
  `client.searchTv` with a ternary, then casts the answer to
  `TmdbOutcome<SearchResults[K][]>`. That is the one cast in the domain. A
  table of searches, typed by the `SearchResults` map the function already
  declares, needs no cast.
- **`TmdbSeasonImage` names a series poster too.** `seriesImages` answers the
  same shape, and `createEnrichment` maps a show's posters through a type that
  says _season_. The shared `posters` helper has no docblock, and it declares
  an inner `posters` that shadows its own name.

### 2. The routes: a displaced docblock, a body read inline, rules in the handler

- **A docblock was displaced again.** `SEASON_POSTER_REFUSALS` was inserted
  under `DECISION_REFUSALS`' docblock (_"Why a review search or pick answered
  nothing, as a status."_). That docblock now sits stacked above the new
  constant's, and `DECISION_REFUSALS` has none. This is the third time an
  initiative has done this (import review's `ProblemRow`, link or copy's
  `writeEpisodes`).
- **The Season choice's body is read in the handler.** `POST
…/seasons/:season/poster` destructures `path` off `req.body` and passes it,
  `unknown`, to `chooseSeasonPoster(season, path: unknown)`. The domain then
  type-checks a request body. Every other enrichment body is read by
  `enrichmentBody` (`startEnrichmentBody`, `conflictChoicesBody`), so the
  domain only ever sees typed values. Log 42 Q17 says so for the bulk routes:
  _"Bodies read in `importBody` / `enrichmentBody`."_
- **Two id-list readers are one reader.** `dismissIdsBody` (import) and
  `decisionIdsBody` (enrichment) are the same twelve lines, differing only in
  their sentence. `dismissIdsBody` also reads the body of
  `…/problems/import-guessed`, which dismisses nothing.
- **The series routes map Season poster changes inline, twice, two ways.**
  `POST /api/series` keeps only a `picked` change. `PATCH` maps `picked` to a
  path and `remove` to `null`. `seriesFormBody` is documented as _"the pure
  field half"_, and this mapping is its job. A `remove` on a new series
  deletes nothing, so one mapping serves both routes.
- **The PATCH handler numbers a free file name itself.**
  `freshSeasonPosterName` is defined inline in the route. It reads the held
  posters' names, then appends `-2`, `-3`… with a regex. That is the stored
  name of a file, which is not HTTP's business. It belongs beside
  `seasonPosterName`, the name it numbers.
- **`EpisodeUploads.seasonPosters` is optional, but always set.**
  `collectEpisodeUploads` initialises it to `[]`. Every reader still writes
  `?? []` or `??=`.

### 3. The library: a stale docblock and an untested write

- `LibraryStorage.enrichmentCounts()` now answers `gaps`, but its docblock
  still lists two counts. The `Enrich` interface's docblock was updated.
- The series write's new `seasonPosters` path has no case in the series
  write suite:
  - the add records them in its transaction;
  - the edit sets, removes or keeps each one;
  - a replaced poster lands in `removedPaths`.

  Only the route suite (`routes.seasonPosterForm`) reaches this path.

### 4. The client: two kind filters, one rule twice, and a colour exported for one dot

- **`kindFilter` and `decisionKindFilter` are one function.** They are 35
  lines in `importView` and 30 in `enrichmentView`. Each draws _All N_, then
  each held kind with its count in a fixed order, none under two kinds, and
  falls back to `'all'`. The only differences are the kind type and the
  labels. A pure helper that two features need is what `src/utils/` holds.
- **The kind orders restate a union.** `importView`'s `KIND_ORDER` is
  `ProblemKind` written again as a list. The codebase's way is an `as const`
  list with the union derived from it (`ENRICH_SCOPES`, `IMPORT_MODES`,
  `IMPORT_FIELDS`). `enrichmentView` derives its own `DecisionKind` as
  `EnrichmentRun['decisions'][number]['kind']`, and `EnrichmentReview` spells
  the same type as `Decision['kind']`.
- **The rule for _does this Resolve open the Series Resolve_ is spelled
  twice.** It reads: `unplaced`, or `failed` with a held series. One copy is
  `ProblemRow`'s `resolveRoute`, the other `loadFormRecord`'s
  `opensSeriesResolve`. They are in two features and can drift apart. The
  route both read is `utils/movieFormPath/`, so the rule belongs beside it.
- **`GOLD` was exported for `KindMark`.** `KindMark` is `ProblemRow`'s `Dot`
  at 8px instead of 10px, rewritten in full. The codebase extends a styled
  component with `styled(X)`.

### 5. The Enrichment flow: an alias import, an optional prop, a cap twice

- **The api call and the hook member share a name.** Both are
  `chooseSeasonPoster`, so the hook imports the call as `postSeasonPoster`.
  No other api call in `features/` is aliased on import.
- **`EnrichmentReview.onChooseSeasonPoster` is optional, defaulting to
  `NO_CHOICE`.** It is the only optional handler on the step. It is optional
  only so the suites written before it compile. Link or copy's refactor made
  the sheet start's `mode` required for the same reason (_"no defaults —
  `startFolderScan`'s shape"_).
- **`SeasonChoices` caps choices at ten, and so does the server.** The
  server's cap is `SEASON_CHOICE_CAP`, and `createEnrichment.seasonChoices`
  already asserts it. The client re-slices what it is handed.
- **Four new wire calls have no wire test.** These are `dismissProblems`,
  `importManyGuessed`, `dismissDecisions` and the Season poster call. Each
  feature's `api.test.ts` covers every other call it holds.

### 6. The Movie form: a set threaded beside the slots, optional everything

- **Whether a season held a poster travels beside the slots, as a separate
  set.** `useMovieForm` holds `heldSeasons`. It passes the set to
  `updateSeries(…, seasonPosters, held)`, and `updateSeries` passes it to
  `seriesFormData(…, seasonPosters, held)`. The only reason for the set is
  to tell _emptied_ from _never filled_, which is a fact about one slot.
- **Every new season-poster parameter is optional:**
  - `createSeries`, `updateSeries` and `seriesFormData` default to `[]` and an
    empty `Set`;
  - `SeriesFormFiles` defaults to `[]` and calls its handlers through `?.`.

  The one caller always passes them.

- **`useMovieForm` grew a third set of state for one list.** The season
  poster state, the held set, two callbacks and a memo add up to about sixty
  lines in a 787-line hook. They also re-spell `useEpisodeList`'s private
  `counted` (`/^\d+$/`) to read a row's season. The series' rows already live
  in their own hook, `useEpisodeList`, and the season posters follow the same
  pattern.
- **`seriesFormData`'s Season poster fields** have no unit case in
  `formValues`' suite. `MovieForm.seasonPosters` reaches them only through
  the screen.

### 7. Documentation the ship left

- **`CLAUDE.md`:**
  - **The tree** has no `enrichment/searchLadder/`, `components/Accordion/`
    or `features/enrichment/SeasonChoices/`. `titleKey/` does not mention
    `searchQuery` or `RELEASE_NOISE`, `library/enrich/` does not mention
    `syncGap`, and `tmdbClient/` lists no `/images` calls.
  - **_Settings Hub_** lists none of the four new routes or the
    `seasonPoster` fields.
  - **Step 25 and its feature line** are still 🔜.
- **The README:** the status table, the step-25 entry and the feature line.
- **The glossary:**
  - the twelve log 42 rows still read _(new)_;
  - **Confident**'s row still says _"when the title has a year, an equal
    year"_, though the invariant below it says it is read over the rung
    that answered, and a yearless rung reads no year;
  - **Search query**'s row describes the dead folds.
- **The dev journal** has no entry for the initiative.

## Solution

Each new rule written once, each body read by its reader, and no optional
parameter that exists only for old suites:

- **The search reads plainly.** `searchQuery` loses its dead folds, and
  `titleGuess` strips its tails through `stripTails`. The dash class is
  written once, as `DASHES` beside `titleKey`. `searchTitled` climbs a typed
  table instead of casting. `TmdbSeasonImage` becomes `TmdbPoster`.
- **The routes are HTTP again:**
  - `idListBody` is born, following the `optionalYear` pattern, and
    `problemIdsBody` and `decisionIdsBody` are each one line over it;
  - `seasonPosterBody` reads the Season choice's `path`, so the domain takes
    a `string`;
  - `seriesFormBody` gains `seasonPosterEdits` and `seasonPosterNamer`, so
    neither series route maps or numbers anything;
  - the displaced docblock goes back where it belongs.
- **The client's shared rules live where shared rules live:**
  - `kindFilter` moves to `src/utils/`;
  - `PROBLEM_KINDS` and `DecisionKind` move to `src/types`;
  - `opensSeriesResolve` sits beside `movieFormPath`;
  - `KindMark` becomes `styled(Dot)`.
- **No parameter is optional for its suites' sake.** The review's handler,
  the form's season-poster parameters and the Files card's props become
  required. A slot carries its own `held` flag. The season posters get their
  own hook, `useSeasonPosters`.
- **The docs, the glossary and the ticks close the initiative.**

Nothing changes on the wire except one sentence: a Season choice posted
without a string `path` is refused by `seasonPosterBody` in its own words,
still a `400`. Today that refusal uses the _not offered_ words. No pixel
moves. The schema does not change.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [review-at-scale] issue #366 …`, except where a commit is
named `test:` or `docs:`.

### Group 1 — the search

1. **One dash class, and no dead folds.**
   - `titleKey` exports `DASHES`, the `‐-―` class, as a regex source.
     `NOISE_EDGE` and `searchLadder`'s `SUBTITLE_MARK` are built from it.
   - `searchQuery` drops its three folds: curly quotes, curly double quotes
     and dashes. The final _"every other non-letter-or-digit a space"_
     already does their work. The docblock says so.
   - `titleKey`'s table rows for curly quotes, dashes and `F'ck That's
Delicious` are unchanged and carry the commit.
2. **`titleGuess` strips through `stripTails`.** Its own copy of the
   tail-strip loop goes. Covered by `titleKey`'s `titleGuess` rows,
   including `Heat.1995.1080p.BluRay.x264-GRP`.
3. **`searchTitled` climbs a typed table.**
   - A module-level `SEARCHES` record holds each kind's client call:
     `movie: searchMovie`, `tv: searchTv`. It is typed by the
     `SearchResults` map, so `SEARCHES[kind]` answers
     `TmdbOutcome<SearchResults[K][]>` with no cast.
   - The ternary and the `as` go.
   - Covered by `createEnrichment.searchLadder` and `.series`.
4. **`TmdbSeasonImage` is `TmdbPoster`.**
   - `seasonImages` and `seriesImages` both answer `TmdbPoster[]`. The
     shared `posters` helper gets a docblock: _ask in English or no
     language, then with no filter_.
   - Its inner `posters` becomes `found`, so it no longer shadows the
     helper's name.
   - `createEnrichment`, `planSeason` and `fakeTmdb` follow the rename.
   - Covered by `tmdbClient.tv` and the season suites.

### Group 2 — the routes

5. **The displaced docblock goes back.** `DECISION_REFUSALS` gets its
   docblock back. `SEASON_POSTER_REFUSALS` keeps only its own. No test moves.
6. **`idListBody` is born.**
   - The new unit is `routes/idListBody/`: `idListBody(body, sentence) →
BodyRead<string[]>`. It accepts `ids` as a non-empty list of strings,
     and refuses anything else with the caller's sentence. This follows the
     `optionalYear` pattern: a route-layer reader shared by two body modules.
   - Its suite covers a missing body, a non-array, an empty list, a
     non-string member, and a good list.
7. **Both id readers stand on it.**
   - `importBody`'s `dismissIdsBody` is renamed `problemIdsBody`, because it
     also reads _Import all as guessed_. `enrichmentBody`'s
     `decisionIdsBody` stays. Each is one line over `idListBody`, in
     today's words.
   - `importBody`'s suite gains `problemIdsBody`'s one case. It has none
     today.
   - `routes.importDismiss`, `routes.importManyGuessed` and
     `routes.enrichmentDismiss` are unchanged.
8. **The Season choice's body is read by `enrichmentBody`.**
   - `seasonPosterBody(body) → BodyRead<{ path: string }>` refuses a missing
     or non-string `path` in a sentence, as a `400` read before the domain
     is asked. The bulk routes read their body in that order too.
   - `chooseSeasonPoster(season: number, path: string)` drops `unknown`.
     `not-offered` now means only a string the season does not offer.
   - `enrichmentBody`'s suite gains the reader's cases.
     `routes.enrichmentSeasonPoster` is unchanged: it asserts each
     refusal's status and that it reads as a sentence.
9. **`EpisodeUploads.seasonPosters` is required.** It is always initialised,
   so the type now says so. The `?? []` in the PATCH rollback and the `??=`
   in `collectEpisodeUploads` go. Covered by `tsc` and
   `routes.seasonPosterForm`.
10. **One mapping from a change to an edit.**
    - `seriesFormBody` gains `seasonPosterEdits(changes, stored) →
SeasonPosterEdit[]`. `picked` maps to `stored(file)`, `remove` to
      `null`, and `keep` to nothing.
    - Both series routes call it. The add passes its rename's `stored`. The
      edit passes the identity, because its folder is never renamed.
    - On an add, a `remove` deletes no row, since there is none. The add's
      comment _"only a picked one means anything"_ goes with the inline
      map.
    - `seriesFormBody`'s suite gains this function's cases, and also
      `readSeasonPosterField`'s and `readSeasonPosters`', which have no unit
      case today.
11. **The free Season poster name leaves the handler.**
    - `seriesFormBody` gains `seasonPosterNamer(heldPaths) → (season,
extension) → string`. It answers `seasonPosterName`'s name when no
      held poster has it, else that name numbered `-2`, `-3`… before the
      extension.
    - The PATCH route passes it the held Season posters' paths. The inline
      `heldNames` and `freshSeasonPosterName` go.
    - Its suite covers a free name, a taken one, two taken, and the
      extension kept.
    - `routes.seasonPosterForm`'s replace-and-roll-back cases are unchanged.

### Group 3 — the library

12. **`test: [review-at-scale] issue #366 the series write's Season
posters`.**
    - The series write suite gains three cases:
      - `addSeries` with Season posters records them in its transaction,
        and records none when the episodes are refused;
      - `updateSeries` sets one, removes one and keeps a season left out;
      - a replaced or removed poster's old path is in `removedPaths`, and a
        kept one's is not.
    - `LibraryStorage.enrichmentCounts()`' docblock names `gaps`, in the
      `Enrich` interface's words.

### Group 4 — the client's shared rules

13. **`PROBLEM_KINDS` and `DecisionKind` live in `src/types`.**
    - `types/import.ts` gains `PROBLEM_KINDS`, an `as const` list in the
      glossary's order, and derives `ProblemKind` from it, as `IMPORT_MODES`
      does.
    - `types/enrichment.ts` exports `DecisionKind`, which is
      `Decision['kind']`.
    - `importView`'s `KIND_ORDER` and `enrichmentView`'s local
      `DecisionKind` retire. `EnrichmentReview` reads the shared type.
    - Covered by `tsc` and the two view suites.
14. **`kindFilter` graduates to `src/utils/`.**
    - The new helper is `kindFilter(items, order, labels, chosen) →
{ options, value }`. It is generic in the kind, and an item is
      anything with a `kind`. It draws _All N_, then each held kind in
      `order` with its count, nothing under two kinds, and falls back to
      `'all'` once the chosen kind is gone. It is exported through the
      `utils` barrel.
    - `importView`'s `kindFilter` and `enrichmentView`'s
      `decisionKindFilter` retire. Their label tables stay with their
      features as `PROBLEM_KIND_LABELS` and `DECISION_KIND_LABELS`, and the
      two review steps call the helper with them.
    - The helper's suite takes the generic cases from both view suites.
      Each view suite keeps one case asserting its own labels and order.
    - `ImportReview`, `EnrichmentReview` and both `.bulk` flow suites are
      unchanged.
15. **`opensSeriesResolve` is spelled once.**
    - `utils/movieFormPath/` exports `opensSeriesResolve({ kind, seriesId })`
      beside `movieFormPath`: `unplaced`, or `failed` with a held series.
    - `ProblemRow`'s `resolveRoute` and `loadFormRecord` both read it.
      `loadFormRecord`'s private copy goes.
    - `movieFormPath`'s suite gains its cases. `ProblemRow` and
      `loadFormRecord` are unchanged.
16. **`KindMark` is `styled(Dot)`.** It is `ProblemRow`'s `Dot` at 8px.
    `GOLD` is private to `ProblemRow.styles.ts` again. No pixel moves.
    Covered by `ImportReview`.

### Group 5 — the Enrichment flow

17. **The Season poster call is `saveSeasonPoster`.** This follows the
    `save*` name every single-value write already has (`saveFavorite`,
    `saveRating`). The hook's member stays `chooseSeasonPoster`, and the
    alias import goes. `useEnrichmentRun.seasonPoster`'s mock follows the
    name.
18. **The review's handler is required.**
    - `EnrichmentReview.onChooseSeasonPoster` is no longer optional, and
      `NO_CHOICE` retires.
    - The `EnrichmentReview` suite's render helper passes a no-op, as it
      does for the step's other handlers.
19. **`SeasonChoices` draws what it is handed.**
    - Its `CHOICE_CAP` and the re-slice go: the server caps at
      `SEASON_CHOICE_CAP`, and `createEnrichment.seasonChoices` asserts it.
    - `SeasonChoices`' _"draws at most ten choices"_ case retires with the
      cap.
20. **`test: [review-at-scale] issue #366 the four new wire
calls`.**
    - The two features' `api.test.ts` suites gain one `describe` per new
      call: the method, the endpoint, the JSON body, the `200` echo
      resolved, and any other status rejecting.
    - In import: `dismissProblems` and `importManyGuessed`. In enrichment:
      `dismissDecisions` and `saveSeasonPoster`.

### Group 6 — the Movie form

21. **A slot says whether it held a poster.**
    - `SeasonPosterSlot` gains `held: boolean`: whether the series edit
      opened with a Season poster for that season.
    - `seriesFormData` reads a slot's `held` where it read the set. The
      `held` parameter retires from `seriesFormData` and `updateSeries`, and
      so does `useMovieForm`'s `heldSeasons`.
    - `formValues`' suite gains `seriesFormData`'s Season poster cases:
      - a picked poster sends the field, then its file;
      - a held poster sends its path;
      - an emptied held poster sends a bare field;
      - an empty slot that never held a poster sends nothing.
    - `MovieForm.seasonPosters` is unchanged.
22. **The season poster parameters are required.**
    - `createSeries(values, episodes, seasonPosters)`,
      `updateSeries(id, values, episodes, seasonPosters)` and
      `seriesFormData(values, episodes, seasonPosters)` lose their defaults.
    - `SeriesFormFiles`' `seasonPosters`, `onPickSeasonPoster` and
      `onRemoveSeasonPoster` become required, and the `?.` goes.
    - The suites that called these without season posters now pass `[]`
      and no-ops.
23. **`useSeasonPosters` is born.** This follows the `useEpisodeList`
    pattern: the series' Season posters in a hook of their own.
    - It takes the episode rows and whether the list is drawn (not in a
      Resolve).
    - It answers `{ slots, pick, remove, hold }`. `hold` is the record's
      held posters, set once the form's reads land, as `holdEpisodes`
      already is.
    - The season is read through `counted`, which moves out of
      `useEpisodeList` into `formValues` as `typedNumber`. Both hooks read
      it, and the second `/^\d+$/` goes.
    - `useMovieForm` composes the hook and forwards its members under
      today's names.
    - The new hook's suite follows `useEpisodeList`'s, covering:
      - one slot per season, sorted;
      - a slot appearing and going with its rows;
      - pick, remove, and a held poster after `hold`;
      - none drawn in a Resolve.
    - `MovieForm.seasonPosters` is unchanged.

### Group 7 — the docs that close the initiative

24. **`docs: [review-at-scale] issue #366 the docs know review at
scale shipped`.**
    - **`CLAUDE.md`:**
      - The tree: `enrichment/searchLadder/`; `titleKey/` with
        `searchQuery`, `RELEASE_NOISE` and `DASHES`; `library/enrich/` with
        `syncGap`; `tmdbClient/` with `seasonImages` and `seriesImages`;
        `routes/idListBody/`; `seriesFormBody/` with the Season poster
        fields; `components/Accordion/`; `features/enrichment/SeasonChoices/`;
        `utils/kindFilter/`; `useSeasonPosters/`; `PROBLEM_KINDS` and
        `SeasonChoice` in `types/`.
      - _Settings Hub_: the two bulk import routes, the Sync's bulk dismiss
        and Season choice routes, and `seasonPoster` / `seasonPosterFile`
        on both series routes.
      - Step 25 and _Review at scale + Season art_ under _Maintainer tools_
        turn ✅.
    - **The README:** the status table, the step-25 entry and the feature
      line.
    - **The glossary:**
      - the log 42 rows lose _(new)_ and _(updated)_;
      - **Confident** reads _an equal year when the rung that answered sent
        one_;
      - **Search query** reads _every character that is not a letter or a
        digit a space — quotes and dashes with them_;
      - `idListBody`, `kindFilter` and `useSeasonPosters` are named where
        their terms are.
25. **`docs: [review-at-scale] issue #366 the journal`.** A
    dev-journal entry in the others' shape, covering:
    - what shipped;
    - what this round changed;
    - what was deliberately not changed (below);
    - the follow-ups named under Out of Scope, by bare number once filed.

    Then close 352.

## Decision Document

- **`DASHES`** lives in `titleKey`, beside `RELEASE_NOISE`. It is the one
  spelling of the curly-dash class, and `searchLadder` reads it.
  `searchQuery`'s rule is: the noise and tails dropped, `&` read as `and`,
  then every non-letter-or-digit a space.
- **`searchTitled`** reads its client call from a `SEARCHES` table typed by
  `SearchResults`. The client seam does not change: one request per call.
- **`TmdbPoster`** is `{ file_path, vote_average }`, the answer of both
  `/images` calls.
- **`idListBody(body, sentence)`** is the route layer's one reader of an
  `ids` list. Over it:
  - `problemIdsBody` (`importBody`) reads both bulk import routes;
  - `decisionIdsBody` (`enrichmentBody`) reads the Sync's.
- **`seasonPosterBody(body)`** reads `{ path: string }`. The season stays a
  route parameter: a malformed or unknown one is still `404`.
  `Enrichment.chooseSeasonPoster(season: number, path: string)`.
- **`seasonPosterEdits(changes, stored)`** and
  **`seasonPosterNamer(heldPaths)`** live in `seriesFormBody`, the series
  body's pure half. Both series routes use the first. The PATCH route uses
  the second.
- **`EpisodeUploads.seasonPosters: (string | undefined)[]`**, required.
- **`PROBLEM_KINDS`** is the `as const` list `ProblemKind` derives from, in
  the glossary's order. **`DecisionKind`** is `Decision['kind']`. Both live
  in `src/types`, for both build targets.
- **`kindFilter(items, order, labels, chosen)`** is a pure helper in
  `src/utils/`. The label tables belong to each feature.
- **`opensSeriesResolve({ kind, seriesId })`** sits beside `movieFormPath`
  in `src/utils/`. The Review step's _Resolve_ and the form's Import context
  read it.
- **`saveSeasonPoster(season, path)`** is the enrichment feature's wire call.
  `useEnrichmentRun.chooseSeasonPoster` is the hook member.
- **`SeasonPosterSlot { season, poster, held }`.** No set travels beside the
  slots.
- **`useSeasonPosters(episodes, drawn)`** answers `{ slots, pick, remove,
hold }`. `typedNumber(text)` in `formValues` is the form's one reading of
  a typed number.
- **No change** to:
  - any route's status, except the reworded `400` above;
  - the schema;
  - the `Accordion`'s props or pixels;
  - the Review groups' order, the bulk buttons' faces, or the Seasons
    section's;
  - the `syncGap` SQL, the Search ladder's rungs, or `confident`.

## Testing Decisions

- **What a good test asserts here** is what the maintainer or the screen
  could observe:
  - the run, its Problems and Decisions, and the records read back through
    `getSeriesDetail`;
  - the route's status and body;
  - the files in the sandbox;
  - the rows, pills and buttons on screen.

  It never asserts which helper read a body or which hook held a slot. That
  is why groups 2, 4 and 6 can move rules between units without losing a
  guarantee: the route, flow and form suites already assert the outcomes.

- **New suites:**
  - **`idListBody`:** a missing body, a non-array, an empty list, a
    non-string member, and a good list.
  - **`kindFilter`** (utils): under two kinds, the counts, the order, the
    fallback, and `All N`.
  - **`useSeasonPosters`:** per commit 23.
- **New cases in existing suites:**
  - **`importBody`:** `problemIdsBody`. **`enrichmentBody`:**
    `seasonPosterBody`.
  - **`seriesFormBody`:** `readSeasonPosterField`, `readSeasonPosters`,
    `seasonPosterEdits` and `seasonPosterNamer`.
  - **The series write:** the Season posters on add and edit, and
    `removedPaths`.
  - **`movieFormPath`:** `opensSeriesResolve`.
  - **`formValues`:** `seriesFormData`'s Season poster fields.
  - **The two `api.test.ts` suites:** the four new calls.
- **Suites whose assertions move with a shape:**
  - `importView` and `enrichmentView`: the generic filter cases leave for
    the helper, and one label-and-order case each stays;
  - `SeasonChoices`: the cap case retires;
  - `EnrichmentReview`, `SeriesFormFiles` and the movie-form `api` suite:
    the required props and parameters;
  - `useEnrichmentRun.seasonPoster`: the renamed call.
- **Unchanged suites that carry the refactor:**
  - routes: `routes.importDismiss`, `routes.importManyGuessed`,
    `routes.enrichmentDismiss`, `routes.enrichmentSeasonPoster`,
    `routes.seasonPosterForm`;
  - enrichment: `createEnrichment.searchLadder`, `.series`,
    `.seasonChoices`, `.seasonPosters`; `tmdbClient.tv`;
  - `titleKey`, `searchLadder`;
  - import: `ImportReview`, `ImportFlow.bulk`, `ProblemRow`;
  - enrichment client: `EnrichmentFlow.bulk`, `EnrichmentFlow.seasons`;
  - movie form: `loadFormRecord`, `MovieForm.seasonPosters`.
- **Prior art:**
  - `optionalYear`, for a route-layer reader shared by body modules;
  - `IMPORT_MODES`, for an `as const` list a union derives from;
  - `useEpisodeList`, for a slice of the form's state in its own hook;
  - `spellYearSpan` beside `yearSpan`, for two exports in one shared unit;
  - each feature's `api.test.ts`, for a wire call's suite.
- **Every commit runs the full `vitest run` and `tsc -b --force`.** The
  incremental build can miss a spec file's type error.

## Out of Scope

Each of these is a follow-up to file, not to fix here: each changes what the
maintainer sees or what the run does, so it goes through grill-me and,
where it draws, the prototype.

- **_Only what's missing_'s line is no longer quite true.** The scope card
  reads _"N titles have no synopsis or artwork"_. N is now the **Sync gap**
  count, which includes Unmatched titles and episode gaps whose synopsis and
  poster are both there. The words are the prototype's (`scopeDefs`), so
  rewording them is a prototype amendment.
- **A refused Season choice stays marked.** `SeasonChoices` marks the
  pressed card `aria-pressed` before the route answers. A `503` leaves the
  held poster drawn and the card still marked.
- **A hyphenated first word hides rung 4.** `SUBTITLE_MARK` cuts at the first
  dash of any kind, so in `Spider-Man: No Way Home` the part before the cut
  is `Spider`, one word, and rung 4 is dropped. Log 42's diagram reads
  _before `:` / `' - '`_. Whether a hyphen inside a word counts is a rule
  question.
- **A bulk _Import all as guessed_ that throws partway** answers `500`. The
  rows already imported are not redrawn until the screen reads the run
  again. Answering the snapshot even on a throw is a contract change.
- **The two reviews' filter-row styles.** `FilterRow`, `FilterScroll` and
  `BulkActions` are written in both review steps. No `mol.*` draws a filter
  row, so graduating one into `components/` waits for the prototype to name
  it.
- **The bulk buttons' faces.** The Import review draws _Skip all_ and _Keep
  all mine_ as raw buttons, the Sync review draws _Skip all_ as the `Button`
  primitive. The prototype draws them exactly so, so this is a prototype
  question.
- **The bulk loops live in the routes.** Each bulk route loops over the
  domain's single-row call. Log 42 Q17 sanctions that, and no second caller
  exists.
- **Everything log 42 left out:** converting a title's kind, a Rematch,
  persisted Decisions, an automatic series-poster fallback, Season page art,
  and grouping the Sync's review.

## Further Notes

- **Deliberately not changed:**
  - `lookUp` and `lookUpSeries` still climb, log and judge Confident side by
    side. The pairing predates this initiative, and the two answer
    different detail types.
  - `SeasonPostersLabel`'s `82px` restates `FileField`'s 70px measure plus
    its 12px gap. It is the prototype's own literal. A shared measure token
    would be the first of its kind, and is not a closing round's change.
  - `ImportFlow` writes `void skipMany(…).catch` and `EnrichmentFlow` writes
    `skipMany(…).catch`. Each file follows its own established style.
- **Planned against `d0d13c2`**, with the suite at 9270 tests across 557
  files and `tsc -b --force` clean.
