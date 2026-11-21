# Refactor plan: Video quality, one way to measure, the ladder's SQL named as its siblings, the toggle read once, the pill's cutoffs on the rating's rule, and the docs that close step 52

> Source initiative: `video-quality`, issue 663 (step 52).
> Shipped by issues 664 to 673: eight slices, RED and GREEN each, 665 as a
> RED commit that passed on arrival, the prototype's second half
> (`bf0f84d1`), and the walk and documents slice (`cc8e6a88` to
> `ba1c800b`).
> Design log: `docs/design-logs/70-video-quality.md`.
> PRD: `docs/PRDs/70-video-quality.md` (663). Plan:
> `docs/PRDs/70-video-quality-plan.md`.
> Handoff: `docs/handoff/handoff-video-quality/`, already amended into the
> prototype by 664 and `bf0f84d1`; no prototype changes here.
> This is the initiative's closing round. It ticks **Video quality** and
> closes 663. Filed as issue #674.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._ The maintainer approved every recommendation in advance.

## Problem Statement

`video-quality` shipped every phase of its plan. `probe` reads the picture's
`frameSize`, `qualityOf` puts it on the **Quality ladder** by **Nominal
height**, `Playback.measure` answers the duration and the rung from one
probe, and `derivedVideoFacts` stores both at every site that used to call
`derivedRuntime`. Migration 17 holds the rung; the **Quality sweep** measures
what is left on every start; the **Series quality** is one subquery on every
series read; the **Quality tag**, _Show video quality_ and the **Quality
filter** are drawn; the Library sheet writes and reads _Quality_.

At `ba1c800b` the full suite has **12964 tests across 902 files, all
passing** (one skipped), and `tsc -b --force` is clean (the build's journal
entry).

The design held. What is left is what eight slices built one after another
leave behind: one measuring rule written twice, call sites that spell the
same facts three ways, two SQL builders named unlike their siblings and
filed under one of them, the toggle read two ways, the pill's vocabulary
written twice and not where the rating's lives, a handful of comments, and
the documents. Every finding below was checked against the code at
`ba1c800b`. They fall into six families.

### 1. Measuring a video: one rule, two copies

- **The Quality sweep re-derives what `derivedVideoFacts` already does.**
  Its loop skips a fileless row (`videoPath === ''`), asks `videoFile`,
  passes over anything not `file`, calls `measure` and swallows a throw.
  `derivedVideoFacts` is exactly that sequence, returning `null`s where the
  sweep `continue`s. Log 70's sequence diagram draws the sweep going through
  `derivedVideoFacts`; the code does not, so "what counts as a measurable
  video" is stated in two places.
- **`derivedVideoFacts` asks for the whole `Playback`** although it calls
  only `videoFile` and `measure`, which is what keeps the sweep (whose deps
  are `Pick<Playback, 'videoFile' | 'measure'>`) from calling it.
- **Nothing pins the sweep's "never throws".** Its docblock promises that a
  failure on one row costs that row alone; no test has a probe or a write
  throw.

### 2. The importer spells the facts three ways

- **Ten sites take `derivedVideoFacts`, in three shapes.** The routes'
  adds destructure `{ runtimeMinutes, videoQuality }` and spread each with
  the codebase's `...(x === null ? {} : { x })`. The routes' edits spread
  the facts whole (an edit stores `null`). The importer's two sheet-fallback
  sites keep `facts` and combine it with the sheet's cells, which they need
  to. But its three probe-only sites (Found again's `updateMovie`, the
  Resolve movie add, the Resolve series' episodes) keep `facts`, alias
  `const runtime = facts.runtimeMinutes`, and spell the quality inline as
  `facts.videoQuality === null ? {} : { videoQuality: facts.videoQuality }`,
  a leftover of the `derivedRuntime` lines they replaced.

### 3. The ladder in SQL, named unlike its siblings

- **Every other SQL fragment builder ends in `Sql`**: `shownRatingSql`,
  `highestRatedSql` (`library/browse/`), `detailsStateSql`
  (`library/titles/`). The build's two are `qualityRank` and
  `seriesQuality`, names that read as values (and `seriesQuality` as the
  glossary's **Series quality** itself, not the SQL that derives it).
- **Two units in one folder named for one of them.** `library/qualityRank/`
  holds both. `qualityRank` is the library's (both browses use it);
  `seriesQuality` is the series slice's alone (the series read and the
  series browse), and log 70 Q10 placed it in `library/series/`.

### 4. The toggle, read two ways

- **`useCardPreferences` reads _Show video quality_ for the eight card
  sites; `LibraryFilters`, `useLibraryQuery` and `useSettledLibraryQuery`
  each read it again** as `useContext(DisplayPreferenceContext)?.qualityTags
=== true`. _Fill in ratings from TMDB_ has `useTmdbRatings()` for exactly
  this (the detail pages read it bare); quality has no twin. The journal
  names this as the first follow-up, and records why: 670 avoided
  `useCardPreferences` because its suite pins the files that may call it.
  That pin is on `useCardPreferences`, not on a single-flag hook.
- **The filter's gate is written twice.** `useLibraryQuery` and
  `useSettledLibraryQuery` each destructure `{ minQuality, ...rest }` and
  put it back only while the toggle is on, two copies of one rule with two
  comments saying it.

### 5. The pill's cutoffs, not where the rating's live

- **"The rungs a minimum may name" is written twice on the client**:
  `parseLibraryQuery` finds a rung that is not `SD`, `qualityOptions` builds
  `PILL_RUNGS` as the ladder without `SD`. The journal's second follow-up
  calls the server's acceptance of `?quality=sd` "two vocabularies".
- **The rating already settles this.** `parseMinRating` and
  `RATING_CUTOFFS` live in `src/utils/parseMinRating/`, docblocked as
  _deliberately the control's whole vocabulary rather than the stored
  scale's: the route is a general API over 0 to 10_; `ratingOptions` and
  `parseLibraryQuery` both read them. The server's route accepting the whole
  ladder is that same rule, not a second vocabulary; what is missing is the
  client's cutoffs stated once, in the rating's place and shape.

### 6. Comments and the documents

- **Docblock and comment lines the build added past 80 columns** (Prettier
  leaves comments alone): `orderedShutdown`'s docblock (104), the routes'
  `libraryQueryOr400` docblock (88), `DisplayPreferenceProvider`'s,
  `useDisplayPreference`'s key list, `useMovieRows`' `toSections` (144),
  `PosterCardMovie.quality`, `Series.videoQuality`, `PosterCard`'s
  `StarRow`, `createPlayback`'s `frame` and `useLibraryQuery`'s
  `setQuality`. `DisplaySection`'s docblock leaves _choose the_ alone on a
  line; `SeriesGrid`'s comment was shortened in place and no longer fills
  its lines.
- **The documents**: the feature checklist's row reads _Video quality_, ⬜
  Planned, and step 52 is 🔜; the README's `playback/` line still names
  `derivedRuntime`, and its `App/` line names neither `useCardPreferences`
  nor `saveQualityTags`; the glossary's **Card preferences** and **Quality
  filter** will need the hook and the cutoffs this round adds.

## Solution

One round in seven groups, each commit leaving the suite green and the
typecheck clean:

1. **One way to measure**: the sweep's "never throws" pinned, then
   `derivedVideoFacts` narrowed to what it calls and the sweep measuring
   through it.
2. **The importer's facts destructured** at its probe-only sites, the
   routes' shape.
3. **The ladder's SQL named as its siblings**: `qualityRankSql` in its own
   folder, `seriesQualitySql` in the series slice.
4. **The toggle read once**: `useQualityTags`, `useTmdbRatings`' twin,
   composed by `useCardPreferences` and read by the filter's three readers.
5. **The filter's gate stated once**: one pure util both query hooks call.
6. **The pill's cutoffs on the rating's rule**: `parseMinQuality` and
   `QUALITY_CUTOFFS` in `src/utils/`, read by `parseLibraryQuery` and
   `qualityOptions`.
7. **Comments, then the documents**, closing step 52 and issue 663.

## Commits

Every commit is `refactor:` (or `docs:` / `test:` where it says so), titled
`refactor: [video-quality] issue #<n> <description>` with `<n>` this plan's
issue. Each runs the suites of the units it touches; each group ends on the
full suite and `tsc -b --force`. No test is weakened: where a commit moves a
behaviour, a test pins it at its new home first.

### Group 1: one way to measure

1. **`test:` the sweep never throws.** Two cases in the Quality sweep's
   suite, each passing on arrival (a pin, not a RED): a `measure` that
   throws on the first unmeasured row leaves that row `NULL` and the next
   row measured and written; a `recordVideoQuality` that throws on the
   first row leaves the second written and `start()` resolving. Prior art:
   the suite's own _passes over a missing, an unreachable and a fileless
   video_.

2. **`derivedVideoFacts` takes only what it calls.** Its `playback`
   parameter becomes `Pick<Playback, 'videoFile' | 'measure'>`; its
   docblock names the Quality sweep beside the saves as its callers. Every
   caller passes a whole `Playback`, which still fits; no test changes.

3. **The sweep measures through `derivedVideoFacts`.** The loop's fileless
   check, its `videoFile` lookup and its `kind` test go; each row asks
   `derivedVideoFacts(playback, video)` and writes its `videoQuality` when
   it is not `null`. The `stopped` checks stay where they are (before the
   row and after the measure), and the `try` / `catch` narrows to the write,
   the one call left that can throw. The docblock says the sweep measures
   by the saves' rule. Every sweep test, commit 1's included, stays green.

### Group 2: the importer's facts destructured

4. **The importer's probe-only sites destructure.** Found again's
   `updateMovie`, the Resolve movie add and the Resolve series' episodes
   take `const { runtimeMinutes, videoQuality } = derivedVideoFacts(…)` and
   spread each as `...(x === null ? {} : { x })`, as the routes' adds do;
   the `const runtime = facts.runtimeMinutes` aliases go. The two
   sheet-fallback sites (a movie row, an episode row) keep `facts`, since
   each combines it with the sheet's cell. `createImporter.videoQuality`,
   `sheetQuality` and the Resolve and Found again suites stay green.

### Group 3: the ladder's SQL named as its siblings

5. **`qualityRankSql`.** `qualityRank` is renamed and moves to
   `library/qualityRankSql/`, its docblock saying it is a fragment builder
   as `shownRatingSql` is. Both browses and `seriesQuality` import it from
   there; `seriesQuality` stays in the old file for one commit.

6. **`seriesQualitySql` in the series slice.** `seriesQuality` is renamed
   and moves to `library/series/seriesQualitySql/`, beside the series read
   and the series browse that are its only callers; the old
   `library/qualityRank/` folder goes. `read.seriesQuality` and
   `routes.qualityFilter` stay green.

### Group 4: the toggle read once

7. **`test:` `useQualityTags` pinned.** A suite written before the hook (a
   RED commit, the next commit's pair), the shape of `useTmdbRatings.test`:
   `true` once the read has landed on, `false` once it has landed off,
   `false` while it is `null`, and `false` with no provider at all.

8. **`useQualityTags`.** In `src/App/useQualityTags/`, `useTmdbRatings`'
   twin: the context rather than the throwing `useDisplayPreference()`, so a
   screen rendered without the provider reads as off. Unused by shipping
   code yet; the suite goes GREEN.

9. **`useCardPreferences` composes the two flags.** It reads
   `useTmdbRatings()` and `useQualityTags()` and memoises the pair as now;
   its direct context read and its import of the context go. Its suite,
   the caller pin included, stays green.

10. **The filter's three readers call `useQualityTags()`.**
    `LibraryFilters`, `useLibraryQuery` and `useSettledLibraryQuery` drop
    their `useContext(DisplayPreferenceContext)` lines and the context
    import. `LibraryFilters.quality`, `useLibraryQuery.quality` and
    `useSettledLibraryQuery.quality` stay green.

### Group 5: the filter's gate stated once

11. **`test:` the honoured query pinned.** A suite for a new pure util,
    written before it (RED): given a **Library query** carrying a
    `minQuality` and the toggle on, the query comes back whole; with the
    toggle off, it comes back without `minQuality` and every other field
    untouched; a query with no `minQuality` comes back equal either way.

12. **`honouredLibraryQuery`.** In `src/utils/honouredLibraryQuery/`,
    exported from the `utils` barrel:
    `honouredLibraryQuery(query, qualityTags): LibraryQuery`, the query as
    the browse honours it under _Show video quality_. Its docblock carries
    the rule both hooks' comments say today: `?quality=` is read past while
    the toggle is off and the URL is never rewritten, so turning the toggle
    back on asks again. A util rather than a feature helper for
    `parseMinRating`'s reason: the search feature and the library feature
    read it independently and must agree. GREEN.

13. **Both query hooks call it.** `useLibraryQuery`'s memo and
    `useSettledLibraryQuery`'s settled string each pass the parsed query
    through `honouredLibraryQuery`; the two destructurings and their two
    comments go. Group 4's suites stay green.

### Group 6: the pill's cutoffs on the rating's rule

14. **`test:` `parseMinQuality` pinned.** A suite for a new util (RED),
    `parseMinRating.test`'s shape: `4k`, `1080p`, `720p` and `480p` read
    as their rungs; `sd`, `4K`, `1080P`, an empty value, `null` and a value
    off the ladder read as no minimum; `QUALITY_CUTOFFS` is the ladder
    without `SD`, best first.

15. **`parseMinQuality` and `QUALITY_CUTOFFS`.** In
    `src/utils/parseMinQuality/`, exported from the `utils` barrel beside
    `parseMinRating` and `RATING_CUTOFFS`. The docblock says what
    `RATING_CUTOFFS`' says: deliberately the pill's whole vocabulary rather
    than the ladder's, the route a general API over every rung, so a
    `?quality=sd` that no row can write never narrows the library behind a
    pill reading _All qualities_. GREEN.

16. **`parseLibraryQuery` and `qualityOptions` read it.**
    `parseLibraryQuery` takes its minimum from `parseMinQuality`, as it
    takes its rating from `parseMinRating`, and its inline lookup and
    comment go. `qualityOptions` reads `QUALITY_CUTOFFS` for its rows and
    for `qualityLabel`, and `PILL_RUNGS` goes. The routes' own
    `parseMinQuality` keeps the whole ladder; its docblock names it the
    general API, the routes' `parseMinRating`'s twin.
    `parseLibraryQuery.quality`, `qualityOptions`, `LibraryFilters.quality`
    and `routes.qualityFilter` stay green.

### Group 7: comments, then the documents

17. **Docblocks.** The long lines of family 6 rewrapped; `DisplaySection`'s
    docblock rewrapped whole; `SeriesGrid`'s comment refilled.

18. **`docs:` the glossary and the README.** **Card preferences**: _read
    from `useTmdbRatings` and `useQualityTags`_. **Quality filter**: _its
    pill offers `QUALITY_CUTOFFS`, the ladder without SD; the route takes
    any rung_, and the honoured query named. **Quality sweep**: _measured
    by `derivedVideoFacts`, the saves' rule_. The README's `playback/` line
    names `derivedVideoFacts`, `qualityOf` and the Quality sweep in place
    of `derivedRuntime`; its `App/` line names `useCardPreferences`,
    `useQualityTags` and `saveQualityTags`.

19. **`docs:` step 52 is done.** The feature checklist's row reads ✅ and
    step 52 ✅; the dev journal gains this round's entry (counts before and
    after, what each group changed, the follow-up left alone). The commit
    closes 663.

## Decision Document

- **`derivedVideoFacts` is the one rule for measuring a held video**, for
  a save and for the sweep alike: fileless, `missing` and `unreachable`
  videos and any throw answer `null`s. It asks for `Pick<Playback,
'videoFile' | 'measure'>`, the deps the sweep already declares. The
  sweep keeps its own concerns only: the order, the yield between rows,
  `stop()`, and writing the rung alone through `recordVideoQuality`.
- **`Playback.measure`, `VideoMeasure`, `VideoFacts`, `QualitySweep` and
  `ShutdownWorld` keep their shapes.** No wire, schema or route contract
  changes.
- **At a call site the facts are destructured** wherever they are spread
  as they are; `facts` is kept only where a site combines them with a
  sheet's cells. The null-omitting spread stays the codebase's inline
  idiom; no helper is added for it.
- **SQL fragment builders end in `Sql`.** `qualityRankSql(column)` is the
  library's (`library/qualityRankSql/`); `seriesQualitySql(seriesId)` is
  the series slice's (`library/series/seriesQualitySql/`), log 70 Q10's
  placement. Both keep their signatures and their trusted-identifier
  contract.
- **One hook per display flag.** `useQualityTags()` in `src/App/`, beside
  `useTmdbRatings()`, both reading the context so a screen without the
  provider reads off. `useCardPreferences` composes them; anything that
  needs one flag calls its hook. The caller pin on `useCardPreferences`
  stays as it is.
- **`honouredLibraryQuery(query, qualityTags)`** is a pure `src/utils/`
  function: the toggle off drops `minQuality` and nothing else. The URL is
  never rewritten; `parseLibraryQuery` still reads `?quality=` whatever the
  toggle, so a link keeps its filter for when it is turned back on.
- **The pill's cutoffs follow the rating's rule.** `QUALITY_CUTOFFS`
  (`4K`, `1080p`, `720p`, `480p`) and `parseMinQuality(value)` in
  `src/utils/parseMinQuality/`; the client reads only a cutoff the pill can
  write, lowercased; the server's route reads any rung as a general API,
  `400` off the ladder, as it reads any rating from 0 to 10. This resolves
  the journal's "two vocabularies" as one documented rule, with no
  behaviour change.
- **No route, no wire, no schema, no prototype, no visible change.**

## Testing Decisions

- A good test drives a unit through its public face and checks what the
  household would see or what the library would hold: which rungs are
  stored, which titles a minimum keeps, what the pill offers and reads,
  whether the tag is drawn. It never checks which helper ran or what SQL a
  builder spells.
- **Every existing suite stays green unchanged.** The build's suites
  (`createQualitySweep`, `derivedVideoFacts`, `createImporter.videoQuality`
  and `sheetQuality`, `read.seriesQuality`, `routes.qualityFilter`,
  `useCardPreferences`, `LibraryFilters.quality`, `useLibraryQuery.quality`,
  `useSettledLibraryQuery.quality`, `parseLibraryQuery.quality`,
  `qualityOptions`) are the proof that each move kept the behaviour.
- **New tests**: the sweep's two never-throws pins (commit 1, prior art its
  own suite); `useQualityTags` (prior art `useTmdbRatings.test.tsx`);
  `honouredLibraryQuery` and `parseMinQuality`, as every `src/utils/`
  function has a test (prior art `parseMinRating.test.ts`).
- **The SQL builders** have no suite of their own: they are pinned by
  behaviour through `read.seriesQuality` and `routes.qualityFilter` against
  a real database, and a string test would pin their spelling.
- **No walk.** Nothing drawn or stored changes; the build's walk stands.
  The full suite and `tsc -b --force` close each group.

## Out of Scope

- **Real clips in the dev fixture** (the journal's third follow-up). The
  fixture's placeholder videos are what hundreds of importer tests probe as
  unreadable, and real clips would add binary weight to the repo; the
  walk's scratch copies proved the feature, and `db:seed-series` already
  draws the Series quality. A grill if the dev library should show tags.
- **The Display rows and the boolean settings, three copies each.**
  `DisplaySection`'s three toggle rows, the three `save*` writers' boolean
  echo guards and the three `/settings/<flag>` routes each follow a pattern
  older than this step, which _Show video quality_ joined unchanged; a
  shared toggle row or flag route is a settings-wide round of its own.
- **Four names for _a movie or an episode_**: `WatchedKind`,
  `PlayableKind`, `Playable.kind` and the build's `MeasuredKind`. Three are
  older, across three domains; unifying them is its own round.
- **The case of a rung.** The route reads `?quality=` lowercased exactly,
  the sheet reads a cell in any case: two contracts (a URL the app writes,
  a cell a person types), not one rule written twice.
- **`frame` computing a rung it does not use** through `measureOf`: the
  same one probe, and `qualityOf` is arithmetic.
- **`PosterCardMovie.quality` beside `videoQuality` elsewhere**: log 70
  Q12 named the card's field.
- **Every long comment line the build did not add**: older than this
  initiative.

## Further Notes

- Group 1's commits must land in order: the pins first, then the narrowed
  parameter, then the sweep on it. Group 4 must precede Group 5 (the util
  is called with the hook's value), and commit 5 must precede commit 6.
  Groups 2, 3 and 6 are otherwise independent.
- Each `test:` RED commit and its build commit may be squashed if the pair
  turns out trivial; commit 1 is a pin that passes on arrival, so it is
  `test:` without a RED.
