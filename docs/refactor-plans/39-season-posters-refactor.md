# Refactor plan: Season posters — one spelling of the season tag, the Still's shape for every season twin, one reading of the row, and the ticks that close the initiative

> Source initiative: `season-posters`, issue 320.
> Shipped by issue 321 (`a1b486d`, the prototype amendment) and issues
> 322–324, one RED and one GREEN each: 322 `ecbd7d9`/`c56880a`, 323
> `1aff322`/`771461a`, 324 `8aa8f4c`/`fbee668`.
> Design log: `docs/design-logs/39-season-posters.md`. Plan:
> `docs/PRDs/39-season-posters-plan.md`.
> This is the initiative's closing round: it ticks **Season posters** and
> closes 320. Filed as issue 325.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`season-posters` shipped all four slices of log 39's implementation plan. The
full suite is green at `fbee668`: 8367 tests across 502 files, with
`tsc -b --force` clean. Every acceptance criterion holds.

Log 39 sold the feature on one promise: _"The Still's rule is reused whole, so
a reader who knows stills knows season posters."_ The behaviour keeps that
promise. The code keeps it only in part. A season poster is planned off a bare
string where a Still is planned off its record, it is carried through the File
plan in a shape of its own where a Still is carried as its record, and its
row is read two different ways. The season tag `S02` is spelled by hand twice,
although log 39 Q2 named the server's one spelling as the rule. Every finding
below was checked against the code for this plan.

### 1. One rule, spelled more than once

- **The season tag `S02`** is written inline as
  `` `S${String(n).padStart(2, '0')}` `` twice: in `writeShow` for the file
  name `S02-poster.jpg`, and in `exportRows` for the File plan's `seasons/S02`.
  Log 39 Q2 says the name is _"the server's `spellEpisodeTag(season)` followed
  by `-poster.jpg`"_, but the server's `spellEpisodeTag` takes a season **and**
  an episode, so neither call site could use it. The client's mirror,
  `formatEpisodeTag`, already spells `S02` on its own. On the server the
  Episode tag has one spelling everywhere except here.
- **One season's poster row is read two ways.** `library/series/read` joins
  `season_posters` into the series page's read, which is
  `SeasonSummary.posterPath`. `library/series/enrich` adds a second reading,
  `seasonPosterOf(seriesId, season)`, a per-season `SELECT` that `writeShow`
  calls once per season to find what is held. That is two queries over one row
  and one more `LibraryStorage` member, for a value the series' own read
  already answers.

### 2. Season twins that don't take the Still's shape

- **The plan.** `planEpisode(episode, theirs, fields)` takes the **Episode**
  and reads `episode.stillPath` itself. `planSeason(held, theirs, fields)`
  takes a bare `string | null` that its caller had to look up. The Still's
  sibling should take the **Season**, a `SeasonSummary`, and read
  `season.posterPath` itself.
- **The loop.** `writeShow` reads `storage.listEpisodes`, rebuilds the seasons
  with `new Set(…)` and filters each season's episodes out again with
  `episodes.filter(…)`. The series page's read already answers the seasons,
  each with its episodes and its poster. With `getSeriesDetail` the loop walks
  `detail.seasons`, and `planSeason` gets its record without a lookup.
- **The File plan.** `PlannedTitle.stills` is `Episode[]`, the records that
  hold a still. `PlannedTitle.seasonPosters` is
  `{ number: number; storedPath: string }[]`, a shape made up for it, built
  with a `flatMap`. The twin is `SeasonSummary[]`, the seasons that hold a
  poster, filtered as stills are and planned off `season.posterPath` as stills
  are off `episode.stillPath`.

### 3. Small things the build left

- **The read's row has no name.** `read.ts` names every row it reads
  (`SeriesRow`, `EpisodeRow`, `GenreRowWithSeries`). The season-poster select
  is cast to an inline `Array<{ season_number: number; poster_path: string }>`.
- **A comment came apart from its code.** In `getSeriesDetail`, _"Already in
  season, then episode order: a season is each run of one `season` number…"_
  describes the `for` loop, but the `posterOf` map was inserted between them.
  The comment on `selectSeasonPosters` says a row for an empty season _"is
  never read"_, but the query reads every row of the series. It is the
  per-season lookup that never reaches one.
- **`seasonPosterOf` types a `NOT NULL` column as nullable**
  (`{ poster_path: string | null }`). This goes away with the member (group 1).
- **`writeShow`'s docblock** still says it writes the show level and then each
  season's episodes. It does not mention the Season poster it now writes
  first.
- **Two hand-reflowed comments** are ragged where a phrase was spliced into an
  existing line: `SeasonCard`'s docblock (_"with the `S02` numeral, the
  StatusBadge when every episode / is watched"_) and `ERASED_TABLES`'
  (_"Season posters before the / titles"_).

### 4. Documentation the ship left

- `CLAUDE.md`'s folder tree doesn't know the initiative shipped. `db/`'s
  migration list stops at 9. `library/series/` doesn't mention the Season
  poster in `read` or `enrich`. `enrichment/` lists `planFields/ planEpisode/`
  without `planSeason/`. `exportRows`' File plan says _"its art and, when
  chosen, its subtitles"_. The `SeasonCard` line says _"`S02` over the
  gradient"_.
- The README's `db/` line stops at migration 7. Migrations 8 and 9 shipped with
  `title-editing` and were never added.
- **Season posters** is still 🔜 in `CLAUDE.md` (the build order's _Next_
  block, and _Browse & discover_) and in the README (the status table and the
  feature list). By the standing rule, a feature is ✅ only after its refactor,
  so this round ticks it.
- The dev journal has no entry for the initiative.

## Solution

One spelling, one reading, one shape:

- `spellEpisodeTag(season, episode?)`. With no episode it spells `S02`, as the
  client's `formatEpisodeTag` already does. `writeShow` and `exportRows` both
  call it.
- `writeShow` walks `storage.getSeriesDetail(series.id).seasons`. Its
  `planSeason(season, theirs, fields)` reads `season.posterPath`, the way
  `planEpisode` reads `episode.stillPath`. `seasonPosterOf` retires from
  `SeriesEnrich` and `LibraryStorage`, so the series page's read is the one
  reading of a Season poster.
- `PlannedTitle.seasonPosters` is `SeasonSummary[]`, filtered and planned the
  way `stills` is.
- The read's row is named, its comments sit on their code, and the docs and
  the ticks close the initiative.

No behaviour changes. No pixel moves. No wire shape changes: `SeasonSummary`,
`SeasonCardSeason` and the HTTP API are exactly as they shipped. The only
interfaces that change are server-internal: `spellEpisodeTag`'s optional
second argument, `planSeason`'s first parameter, and two fewer storage members.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each one is
`refactor: [season-posters] issue #325 …` except the two `docs:` commits at the
end.

### Group 1 — the season tag, spelled once

1. **`spellEpisodeTag` spells a season alone.** Make the `episode` parameter
   optional. With it, the answer is `S01E03` as today. Without it, the answer
   is `S02`. The docblock says so and names the season-alone form's two
   callers. The suite gains the season-alone case (`2` → `S02`, `12` → `S12`,
   `0` → `S00`), and every existing case is unchanged.
2. **`writeShow` names the poster file with it.** Replace the inline
   `` `S${…padStart…}-poster.jpg` `` with `` `${spellEpisodeTag(number)}-poster.jpg` ``.
   The season-poster suite already asserts `S01-poster.jpg` and
   `S02-poster.jpg` byte for byte.
3. **`exportRows` names `seasons/` with it.** Replace the inline spelling in
   the File plan's season loop. The export season-poster suites already assert
   `seasons/S02.<ext>`.

### Group 2 — the Still's shape for every season twin

4. **`writeShow` walks the series' read.** Read
   `storage.getSeriesDetail(series.id)`. A series gone mid-run reads as no
   seasons, which is what `listEpisodes` answered before. Hand `writeSeries`
   the episodes flattened from `detail.seasons` in season and episode order,
   the order `listEpisodes` answered. Loop over the seasons above 0 instead of
   a `Set` of numbers, using `season.episodes` where the loop filtered, and
   `season.posterPath` as `planSeason`'s `held` in place of
   `storage.seasonPosterOf`. `planSeason`'s signature is unchanged in this
   commit. No suite changes: the series, review and season-poster suites carry
   the order, the season-0 rule and the never-replaced rule.
5. **`planSeason` takes the Season.** Change its first parameter from
   `held: string | null` to `season: SeasonSummary`, and read
   `season.posterPath` inside, as `planEpisode` reads `episode.stillPath`. The
   docblock names the record. `writeShow` passes `season`. The `planSeason`
   suite builds a `SeasonSummary` with a small local helper where it passed a
   string. Its cases are the same four rules.
6. **`seasonPosterOf` retires.** Remove it from `SeriesEnrich` (and its
   prepared statement) and from `LibraryStorage` and its wiring in
   `createSqliteStorage`. In `createEnrichment.seasonPosters.test.ts`, every
   `storage.seasonPosterOf(id, n)` becomes the suite's own
   `seasonPosterRead(storage, id, n)`, which already reads through
   `getSeriesDetail`, so the duplicate assertion in the first test collapses
   to one. Fix its header comment, which names `seasonPosterOf`. For a season
   the fixture show holds no episode of, such as season 0 if it has none on
   disk, assert through the images asked rather than through the read: it is
   never asked, so it is never stored. `enrich.test.ts` drops the
   `seasonPosterOf` cases and asserts `setSeasonPoster`'s upsert, and its
   refusal of an unknown series, through `getSeriesDetail`'s `posterPath`, the
   way the read suite already reads it.
7. **The File plan carries seasons as stills are carried.** Make
   `PlannedTitle.seasonPosters` a `SeasonSummary[]`: built as
   `detail.seasons.filter((season) => season.posterPath !== null)`, the
   `stills` line's twin, planned as
   ``plan(season.posterPath, `seasons/${spellEpisodeTag(season.number)}`)``, and
   `[]` for a film, as today. The field's comment reads like `stills`' does.
   The export season-poster suites are unchanged.

### Group 3 — the small things

8. **The read's row is named and its comments sit on their code.** Add a
   `SeasonPosterRow` beside `EpisodeRow` and cast the select to it. Move the
   `posterOf` map above the _"Already in season, then episode order"_ comment,
   so the comment sits on the loop it describes. Reword `selectSeasonPosters`'
   comment to say what is true: each Season poster the series holds, by
   number, and a row for a season with no episodes is simply never looked up.
9. **Three docblocks say what the code does.** `writeShow`'s names the Season
   poster each season is given before its episodes. `SeasonCard`'s and
   `ERASED_TABLES`' are reflowed so no line breaks mid-phrase. The wording
   doesn't change.

### Group 4 — the ticks that close the initiative

10. **`docs: [season-posters] issue #325 the docs know season posters
shipped`.** - In `CLAUDE.md`'s tree, `db/` gains _"10 `season_posters`, a Season's
    poster by `(series_id, season_number)`"_ and `library/series/` names the
    Season poster in `read` and `setSeasonPoster` in `enrich`. - `enrichment/` lists `planFields/ planEpisode/ planSeason/` with
    _"…; whether a Season's **Season poster** is wanted"_. `exportRows`' File
    plan names each Season poster under `seasons/`. The `SeasonCard` line
    reads _"`S02` over its **Season poster**, else the gradient"_. - The README's `db/` line gains migrations 8, 9 and 10. - **Season posters** turns ✅ in `CLAUDE.md` (the build order's _Next_
    block is rewritten as done, the way steps 16–21 were, and _Browse &
    discover_) and in the README (the status table and the feature list).
11. **`docs: [season-posters] issue #325 the journal`.** Add a dev-journal
    entry in the shape the others take: what shipped, what this round changed,
    what was deliberately not changed (below), and follow-ups, if any. Then
    close 320.

## Decision Document

- **The season tag's one spelling is `spellEpisodeTag` with an optional
  episode**, not a new `spellSeasonTag`. Log 39 Q2 already wrote it as
  `spellEpisodeTag(season)`. The glossary and the client's `formatEpisodeTag`
  both treat `S02` as a form of the Episode tag. And `media/episodeTag/` stays
  the server's one place the tag is written.
- **The series page's read is the one reading of a Season poster.**
  `seasonPosterOf` and its per-season query retire. `writeShow` reads
  `getSeriesDetail` once, where it read `listEpisodes`. That costs one join and
  the genres it doesn't use, which is negligible against a TMDB round trip per
  season. In return there is one fewer `LibraryStorage` member and no second
  query over the same row.
- **This amends log 39 Q3 and Q4's sketched interfaces.** Q3 sketched
  `planSeason(held: string | null, …)`, and Q4 sketched `seasonPosterOf` for
  `writeShow` to plan with. Both were sketches of how to reuse the Still's
  rule. The Still's actual shape takes the record, and this round brings the
  code to it. The design log stays immutable. This plan and the journal
  record the change.
- **`planSeason(season: SeasonSummary, theirs: TmdbSeason, fields) →
SeasonPlan`**: the rule is unchanged. A poster is wanted only under Poster,
  only when none is held, and only when TMDB has one.
- **`PlannedTitle.seasonPosters: SeasonSummary[]`**, the twin of
  `stills: Episode[]`.
- **`setSeasonPoster` stays where log 39 put it**, in `library/series/enrich`
  and on `LibraryStorage`. Only the read twin goes.
- **No change** to the migration, `ERASED_TABLES`' membership or order,
  `SeasonSummary`, `SeasonCardSeason`, `seriesView`, `SeasonCard`'s
  rendering, `TmdbSeason`, the `fakeTmdb` builder (its `overrides` parameter
  already matches its four siblings), `storeSeriesImage`, or the log line.

## Testing Decisions

- A good test here asserts what a maintainer or a reader of the series page
  could observe: the file stored, the path the series page reads, the images
  TMDB was asked for, the File plan's paths. It never asserts the query that
  got there. That is why the retired `seasonPosterOf` can go without losing a
  guarantee: every one of its assertions is already, or becomes, an assertion
  on the series page's read.
- **Changed suites:**
  - `episodeTag` gains the season-alone case.
  - `planSeason` builds a `SeasonSummary` where it passed a string, with the
    same four rules.
  - `createEnrichment.seasonPosters` reads through its existing
    `seasonPosterRead` helper.
  - `library/series/enrich` asserts the upsert through the read.
- **Unchanged suites that carry the refactor:**
  - `createEnrichment.series`, `.seriesReview` and `.titleFix` carry
    `writeShow`'s order and season-0 rule.
  - `exportRows.seasonPosters` and `writeExport.seasonPosters` carry the File
    plan.
  - `library/series/read` carries the join.
  - `resetDatabase`'s guard and `db.test` carry the table.
  - `SeasonCard` and `seriesView` carry the card.
- **Prior art:** `planEpisode`'s suite, for a pure plan over a record and
  TMDB's answer. The `stills` cases in `exportRows.images`. The read suite's
  `posterPath` cases.
- Coverage is already thorough: log 39's slices shipped with a suite per
  layer. No new suite is needed, and none is removed.
- Every commit runs the full `vitest run` and `tsc -b --force` (the
  incremental build can miss a spec file's type error).

## Out of Scope

- **Everything log 39 left out**: Season page art (Q7), a Season poster as a
  **Write target** (Q8), an Export column (Q9), a series-poster fallback on the
  card (Q5), season 0, a poster picked in the **Movie form**, and reading a
  season poster off disk during import.
- **`createMedia`'s `season-NN` folder name.** It is a folder spelling with its
  own rule (the **Season folder**), not an Episode tag.
- **`seriesSeed`'s lowercase `s01e01`.** It names mock files under
  `__seed__/`, which is dev-only scaffolding.
- **`exportName`'s `twoDigits`.** It pads a date, which is a different rule
  that happens to pad the same way.
- **`Artwork`'s docblock** still lists the Season card among the surfaces that
  draw the plain gradient. That stays true: the gradient is what it draws with
  no url, as the episode thumbnail does, and it is not a **Poster surface**.

## Further Notes

- **Deliberately not changed:**
  - **`storeSeriesImage` is not renamed.** It stores an image in the Series
    folder, which is exactly what a Season poster is.
  - **The Season poster's log line** comes from `storeSeriesImage`, not from a
    line of its own as the Still's does. That is the series poster's
    precedent, which is the closer twin for where the file lives.
  - **`SeasonCardSeason.posterUrl` stays optional**, the twin of
    `EpisodeRowEpisode.stillUrl`.
- A `getSeriesDetail` that answers `null` mid-run (the series deleted under a
  Sync) is handled as no seasons. That is the same outcome `listEpisodes`
  gave, so it is not new behaviour, and the existing suites never exercise it
  either way.
