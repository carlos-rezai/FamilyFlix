# Refactor plan: TMDB ratings — one way to draw a preference, one spelling of each rule, and the docs that close the initiative

> Source initiative: `tmdb-ratings`, issue 367 (step 26).
> Shipped by issue 368 (the prototype amendment, closed on approval) and
> issues 369–374, one RED and one GREEN each: 369 `0daa76f`/`8209dd9`, 370
> `1625256`/`bb767ef`, 371 `b01ac3e`/`e89b1b4`, 372 `17887c8`/`99bd6c8`, 373
> `a228e6a`/`b0b3268`, 374 `84045d9`/`0820116`.
> Design log: `docs/design-logs/43-tmdb-ratings.md`. PRD:
> `docs/PRDs/43-tmdb-ratings.md`. Plan: `docs/PRDs/43-tmdb-ratings-plan.md`.
> This is the initiative's closing round. It ticks **TMDB ratings** and closes 367. Filed as issue 375.
> Planned alone, on the maintainer's standing instruction: _keep the codebase
> consistent with our naming and code conventions, patterns and
> architecture._

## Problem Statement

`tmdb-ratings` shipped every slice of log 43's implementation plan. The full
suite is green at `0820116`: 9491 tests across 564 files. `tsc -b --force`
is clean. `eslint src server electron` reports one error and 99 warnings, and
none of them is in a file this initiative touched for the first time. (The
three warnings in `db.test.ts` are from `b22f6ad`. The error is the
`EnrichmentReview.test.tsx` one the last journal entry already names.)

The six slices were built one at a time by agents that each saw one slice,
and the seams show. Nothing below is a bug a household would see. Every
finding was checked against the code for this plan. They fall into four
families:

- the preference applied three different ways on five screens;
- a rule or a word spelled more than once;
- a docblock displaced or left behind;
- the documents, which still describe step 26 as planned.

### 1. The preference reaches the screens three different ways

Log 43 Q6 decided _"the client draws; … the mappers derive the **Shown
rating** per render — a flip on the Settings page redraws every loaded screen
at once"_. Q8 gave each of the four mappers a `tmdbRatings: boolean`
parameter, and their callers pass the live preference. Two screens do that.
Three do not:

- **The Series tab and the series page map per render.** `SeriesHome` holds
  the `SeriesHomePayload` and maps `seriesCardView(series, tmdbRatings)` in a
  memo. `useSeriesDetail` holds the read (`HeldSeries`) and maps
  `seriesView(detail, tmdbRatings)` per render. The heart and the watched
  mark patch the held record. This is the design's shape.
- **The movie home and the Genre page map once, with `true`, then undo it.**
  `useHomeRows`, `toGenreRow` and `GenreMovies` call `view(movie, true)` as
  the payload lands, so `view`'s parameter is a literal at every shipping
  caller. A new feature module, `features/library/underTmdbRatings/`, then
  takes TMDB's ratings back off the loaded cards while the preference is off.
  The rule is now spelled twice on the client: `shownRating(…, false)`, and
  _"strip a `tmdb`-sourced card"_. The reason is the held state: both hooks
  hold mapped `PosterCardMovie`s, because the heart's helpers in
  `withFavorite/` (`withFavoriteInList`, `withShelved`, `withFavorite`) edit
  cards, not records.
- **The movie page re-maps through two refs and an effect.**
  `useMovieDetail` holds the mapped `MovieDetailModel`, because its three
  edits patch the model. So it keeps the record in a `recordRef`, reads the
  preference through a `tmdbRatingsRef` at load, and runs an effect that
  re-maps `tmdbPercent` whenever the preference changes. That is about forty
  lines to do what `useSeriesDetail` does with one call per render, and no
  test covers it. No suite flips the preference, or lands it late, under a
  loaded film. The series page has no flip test either.

### 2. A context reader filed as a global hook

`useTmdbRatings` lives in `src/hooks/`. It reads `DisplayPreferenceContext`
directly, `SnackbarProvider`'s precedent, so a suite rendered without the
provider reads as off. That is a reader of the app-level context. Every other
reader and owner of `App/`'s contexts lives in `App/`: `useDisplayPreference`,
`useSnackbar`, `ContentFrame`. `src/hooks/` holds hooks with logic of their
own that two features share (`useGoBack`, `useRestoredScroll`,
`useOptimisticEdit`, `useEnrichmentSummary`). Its docblock also says _"Whether
the browse cards draw"_, yet the movie page and the series page read it too.

### 3. A rule or a word spelled more than once

- **The TMDB rating has no spelling of its own.** The glossary defines it as
  _"`round(tmdb_score)` half-star units"_. In the code it exists only inside
  `shownRating`. `detailView`'s `toTmdbPercent` gets it by asking
  `shownRating(null, movie.tmdbScore, tmdbRatings)`, which means pretending
  there is no household Rating to reach the branch it wants.
- **The `TMDB` tag is spelled three times**: a literal in `PosterCard`, and
  a `TMDB_TAG` constant in each of `MetaLine` and `SeriesMetaLine`.
- **The mapping from a source to the marks is written twice.** `PosterCard`
  and `SeriesMetaLine` each write `muted={source === 'tmdb'}` and
  `tag={source === 'tmdb' ? 'TMDB' : undefined}`.
- **_Highest rated_'s body is written twice on the server.** It is
  _the Shown rating `IS NULL`, the Shown rating `DESC`, then the title_.
  `browse`'s `orderBy` spells it over `m`, and the series browse's
  `seriesOrderBy` spells it again over `s`. `shownRatingSql` is spelled once,
  but the order built over it is not.
- **The provider's two setters are one bargain written twice.**
  `setUltrawideMargins` and `setTmdbRatings` match line for line: shown at
  once, posted, the echo kept, the previous value put back. Their state
  setters have unrelated names (`setValue`, `setRatingsValue`).
- **The settings slice reads and writes two flags the same way.**
  `ultrawideMargins()` and `tmdbRatings()` each read `'1'`/`'0'` with a
  default. `setUltrawideMargins` and `setTmdbRatings` each upsert
  `on ? '1' : '0'`.

### 4. Docblocks displaced or left behind

- **`detailView`'s docblock was displaced.** `toTmdbPercent` was inserted
  between `detailView`'s long docblock and the function itself. The page
  mapper's docblock now sits stacked above the helper's, and `detailView` has
  none. This is the fourth initiative to do this (import review's
  `ProblemRow`, link or copy's `writeEpisodes`, review at scale's
  `DECISION_REFUSALS`).
- **`browse`'s `ORDER_BY` docblock was displaced the same way.**
  `orderBy` was inserted under it. The docblock also still says _"the
  compiler is what demands the extra body exists"_, but `ORDER_BY` is now
  `Record<Exclude<ListSort, 'highest-rated'>, string>`, so the compiler no
  longer demands every slug. The series browse's `SERIES_ORDER_BY` has the
  same `Exclude`.
- **The series browse's reader has no docblock.** `createBrowse` documents
  its `tmdbRatings` reader with a `@param`; `createSeriesBrowse` takes the
  same reader undocumented. Its local copy is `tmdbRatingsOn`, a name no
  other caller uses.
- **The provider's docblock** names both preferences, but says _"its setter
  is `useSettings`' bargain"_ in the singular. It is also wrapped mid-phrase
  (_"so the **Content\n frame**"_).
- **`useDisplayPreference`'s docblock** runs one line past the column. Its
  `DisplayPreferenceApi` member for `tmdbRatings` is right.
- **`RatingPicker`'s docblock** does not mention the placeholder. It still
  says _"the label keeps reading the stored value throughout"_, but the label
  now reads the placeholder's `x / 5 TMDB` while unrated.

### 5. The documents and the prototype

- **CLAUDE.md** and the **README** still carry step 26 and its feature row
  as 🔜. CLAUDE.md's folder tree has no `utils/shownRating/`, no
  `App/saveTmdbRatings/`, no context reader, and says `App/` has _"six
  units"_. The **Settings Hub** section's `GET /api/settings` answers two
  fields there, and `POST /api/settings/tmdb-ratings` is missing. The
  `library/settings/` line counts _"two preference keys"_. The
  `DisplayPreferenceProvider` and `useDisplayPreference` lines name
  Ultrawide margins alone.
- **The glossary** already has log 43's section, so it needs only the names
  this round adds.
- **The prototype amendment is not in `docs/handoff/`.** Issue 368 was
  closed on approval with the note _"the amended files are not in
  docs/handoff/ yet"_. `prim.StarRating`, `mol.RatingPicker`, `mol.PosterCard`,
  `page.SettingsPage`, `page.MoviePage`, `page.SeriesPage` and
  `FamilyFlix.dc.html` still draw the pre-log-43 surface. An agent can't
  author Claude Design files, so this round can't fix that.

## Solution

One rule for how a preference reaches a screen, and that rule is log 43's:
**the screen holds the record, and the mapper draws it per render under the
live preference.** The series pages already work this way. The movie home,
the Genre page and the movie page move to it:

- each holds its payload's records, as `SeriesHome` and `useSeriesRead` do;
- its edits patch the record;
- its mapper takes the preference.

`underTmdbRatings`, the `true` literals and the movie page's refs and effect
all retire.

Then each rule gets one spelling:

- `tmdbRating(score)` beside `shownRating`;
- `tmdbMarks(source)` and `TMDB_TAG` in `src/utils/`;
- _Highest rated_'s body beside `shownRatingSql`;
- one bargain for the provider's two setters;
- one flag reader and writer in the settings slice.

The context reader moves into `App/`, where the context lives. The displaced
docblocks go back where they belong. The documents learn the feature shipped.

Nothing a household sees changes. The one exception is the movie page's
watched mark: it now patches the film's record by the movie's watched rule.
The label it shows comes out the same, because a watched film's resume
position is already zero, so unmarking it reads _Play_ as before.

## Commits

Each commit leaves the suite green and `tsc -b --force` clean. Each commit is
`refactor: [tmdb-ratings] issue #375 …`, except where a commit is named
`test:` or `docs:`.

### Group 1 — the safety net

1. **`test: [tmdb-ratings] issue #375 both detail pages follow a flip`.**
   These characterisation cases go in before anything moves. They pass
   against `0820116`:
   - `MovieDetail`: with a film loaded and unrated, flipping the
     preference off brings back `Not rated` over empty stars, and flipping it
     on brings back `3.5 / 5 TMDB`.
   - `MovieDetail`: a preference that lands after the film draws the
     placeholder without a second `fetchMovie`.
   - `SeriesDetail`: with a series loaded and unrated, a flip turns the
     tagged stars to unrated stars and back, without a second read.

   Prior art: `SeriesHome`'s and `GenreMovies`' _"redraws the loaded cards on
   a flip"_ cases, driven through the provider and a mocked `fetch`.

### Group 2 — one spelling of each client rule

2. **`detailView` gets its docblock back.** The page mapper's docblock moves
   back onto `detailView`. `toTmdbPercent`'s own docblock stays above
   `toTmdbPercent`, which moves above it. No behaviour moves.
3. **`tmdbRating` is born.**
   - `utils/shownRating/` exports `tmdbRating(tmdbScore)`, the **TMDB
     rating**: `null` in, `null` out, otherwise the score rounded to
     half-star units, a half rounding up.
   - `shownRating` reads it, and so does `detailView`'s `toTmdbPercent`, so
     nothing asks `shownRating` with a `null` it does not mean.
   - Re-exported from the `utils` barrel.
   - `shownRating.test.ts` gains `tmdbRating`'s rows, including `null`,
     `6.5` → `7` and `7.4` → `7`.
4. **`tmdbMarks` is born.**
   - `src/utils/tmdbMarks/` holds `TMDB_TAG` and
     `tmdbMarks(source: RatingSource | null)` → `{ muted, tag }`: `true` and
     `TMDB_TAG` for `tmdb`; `false` and `undefined` for `household` and
     `null`. Re-exported from the barrel. Its suite covers the three rows.
   - `PosterCard` and `SeriesMetaLine` spread it onto `StarRating`.
   - `MetaLine` passes `TMDB_TAG` as the picker's `placeholderTag`.
   - The two local `TMDB_TAG` constants and the literal go.
   - Covered by `PosterCard`'s, `SeriesMetaLine`'s and `MetaLine`'s tag cases.
5. **The context reader moves into `App/`.**
   - `src/hooks/useTmdbRatings/` becomes `src/App/useTmdbRatings/`, with its
     suite, imported by path like `App/`'s other units.
   - Its docblock says it serves every surface that draws stars, not just the
     browse cards, and keeps the `SnackbarProvider` precedent for reading the
     context directly.
   - Its five callers follow the move.

### Group 3 — the provider

6. **One bargain for both display preferences.**
   - A private hook in `DisplayPreferenceProvider`'s file holds one flag:
     its value (`null` until it lands) and the setter's bargain over the save
     it is handed. The provider holds two of them, one over
     `saveUltrawideMargins` and one over `saveTmdbRatings`. The one
     `fetchSettings` lands both.
   - The provider's docblock is reflowed and names _its setters_.
   - `useDisplayPreference`'s docblock is wrapped to the column.
   - Covered by the provider's suite: each preference's optimistic flip, the
     echo, the put-back and _never rejects_, and _one read lands both_.

### Group 4 — every screen holds its record

7. **The movie loads hold their records.**
   - `withFavorite/`'s three helpers are retyped onto the records the loads
     now hold. `withFavoriteInList` sets `isFavorite` on a `Movie[]`.
     `withShelved` takes the shelf's `Movie[]` and the rows' `HomeRow[]`.
     `withFavorite` sets the flag across `HomeRow[]`.
   - `useHomeRows` holds the payload's rows and favorites as records, and
     its `withHeart` patches them. The genre rows and the shelf are mapped in
     a memo over the held records and the preference. `toGenreRow` takes
     `tmdbRatings` and hands it to `view`.
   - `GenreMovies` holds the payload's movies and maps them the same way.
   - No `view(movie, true)` is left. `underTmdbRatings` has no callers.
   - Covered by `withFavorite.test.ts` (retyped onto `makeMovie`), and by
     `HomeRows`', `useHomeRows`' and `GenreMovies`' suites, which observe
     cards and do not change. The flip and _until it lands_ cases are the
     safety net.
8. **`underTmdbRatings` retires.** The unit and its suite go. Its rows are
   `view`'s and `seriesCardView`'s under both preferences, which those suites
   already hold.
9. **The movie page holds its record.**
   - `useMovieDetail` holds the `Movie` the load answered, and maps
     `detailView(record, tmdbRatings)` per render — `useSeriesDetail`'s shape.
   - `editMovie` patches the record. The three edits patch record fields:
     - the heart patches `isFavorite`;
     - the rating patches `rating` in units — the picker's percent becomes
       units once at the door, and the route's echo is already units, so the
       percent round trip on the echo goes;
     - the watched tick patches `watched`, `status` and
       `resumePositionSeconds` by the movie's watched rule (watched forgets
       the resume position).
   - `recordRef`, `tmdbRatingsRef` and the re-map effect go. So does the
     model-level `withRating`.
   - Covered by `useMovieDetail`'s and `MovieDetail`'s suites, including
     commit 1's cases, and the optimistic, echo and put-back cases for each
     edit.

### Group 5 — the server

10. **`ORDER_BY` gets its docblock back, and the compiler its demand.**
    - The docblock moves back onto the record.
    - `orderBy` builds the record for its call with `highest-rated` filled
      in, checked as a full `Record<ListSort, string>`. Every slug is
      demanded again, as the docblock says.
    - `SERIES_ORDER_BY` gets the same.
    - Covered by both browse suites.
11. **_Highest rated_ is spelled once.** `library/browse/` exports, beside
    `shownRatingSql`, the order body over an alias under the preference: the
    Shown rating `IS NULL`, the Shown rating `DESC`, then the title without
    case. Both browses read it. Covered by both browses' _Highest rated_
    cases under each preference, including `6.5`.
12. **The series browse's reader is documented.** `createSeriesBrowse` gets
    `createBrowse`'s `@param` for `tmdbRatings`. The local `tmdbRatingsOn`
    becomes `on`, read once per query as now.
13. **One flag reading in the settings slice.**
    - A private reader takes a key and its default, and answers `'1'` as
      `true`.
    - A private writer upserts `'1'`/`'0'`.
    - Ultrawide margins and TMDB ratings both go through them, and so does
      `valueOf` underneath.
    - Covered by the settings suite's cases for both preferences.

### Group 6 — the component

14. **`RatingPicker`'s docblock knows the placeholder.**
    - A paragraph covers it: drawn muted while `value` is `null`, the label
      `x / 5 <tag>`, a click on its segment adopting it and never clearing.
    - The sentence about the label reading the stored value throughout is
      corrected.
    - `placeheld` becomes `placeholderShown`.
    - Covered by the picker's placeholder cases.

### Group 7 — the docs that close the initiative

15. **`docs: [tmdb-ratings] issue #375 the docs know TMDB ratings shipped`.**
    - **CLAUDE.md**:
      - step 26 and the Settings hub's **TMDB ratings** row go ✅;
      - the build order says step 26 is done;
      - the folder tree's `App/` line counts its units, adds
        `saveTmdbRatings/` and `useTmdbRatings/`, and widens the
        `DisplayPreferenceProvider` and `useDisplayPreference` lines to both
        preferences;
      - `utils/` gains `shownRating/` (with `tmdbRating`) and `tmdbMarks/`;
      - `types/` names `DEFAULT_TMDB_RATINGS`, `Settings.tmdbRatings` and
        `RatingSource`;
      - `library/settings/` counts three preference keys, and
        `library/browse/` names `shownRatingSql` and the order beside it;
      - the **Settings Hub** section's `GET /api/settings` answers
        `{ subtitleLanguage, ultrawideMargins, tmdbRatings }` and gains
        `POST /api/settings/tmdb-ratings`.
    - **README**: step 26 and the feature table row go ✅.
    - **Glossary**: **TMDB rating** names `tmdbRating`, and **TMDB-marked
      stars** names `tmdbMarks` and `TMDB_TAG`.
16. **`docs: [tmdb-ratings] issue #375 the journal`.** A newest-first
    entry in `docs/dev-journal.md`, in the last entry's shape:
    - what shipped;
    - what each group changed;
    - what was deliberately not changed;
    - the follow-ups.

    The commit closes 367 in words, not with a keyword, and this issue with
    one.

## Decision Document

- **The one rule for a preference on a screen.** The screen holds the
  record the read answered. The mapper takes the preference and draws per
  render, and an edit patches the record. Every screen that draws stars
  follows it: the movie home, the Genre page, the Series tab, the movie page
  and the series page. A screen never holds a mapped model that a preference
  then has to correct.
- **The heart's helpers work on records.** `withFavoriteInList`,
  `withShelved` and `withFavorite` keep their names, their purity and their
  rules: the shelf gains the card at its front, nothing is removed, a row
  holding the movie three times flips all three. Only their element type
  changes, from the card to the `Movie` and `HomeRow` the payload carries.
  `SeriesHome`'s inline heart over `Series` is the precedent.
- **The movie page's edits work on the record.** The rating edit speaks
  units from the door inward. `RatingPicker` still speaks percent, and the
  hook converts once. The watched edit follows the movie's watched rule, the
  one the season page's `marked` follows for an episode. `useOptimisticEdit`
  is unchanged; it is generic over whatever the page holds.
- **`tmdbRating(tmdbScore)`** is the code's spelling of the glossary's
  **TMDB rating**. It lives in `utils/shownRating/` because `shownRating`
  reads it and is its only reason to exist. Its one other reader is the movie
  page's placeholder.
- **`tmdbMarks(source)`** answers `StarRating`'s `muted` and `tag` for a
  **Rating source**. It is a pure util, so the primitive stays domain-free and
  the molecule and the feature that draw stars stop spelling the mapping.
  `TMDB_TAG` beside it is the one spelling of the word.
- **The context reader is `App/`'s.** `useTmdbRatings` reads
  `DisplayPreferenceContext` and answers `true` only once the read has landed
  on, so it lives beside the context. It is imported by path, as
  `useSnackbar` is.
- **One bargain per held preference.** The provider's private hook owns the
  bargain once. The two preferences differ only in their save. The
  `DisplayPreferenceApi` shape is unchanged.
- **Server.** `shownRatingSql` and the _Highest rated_ body sit together in
  `library/browse/`, which the series browse imports (`fullDetails`'
  precedent). The browses' order records are exhaustive again. The settings
  slice's flags share one private reader and one writer. Routes, the wire,
  the schema, migration 13 and `fetchedFields` are unchanged.
- **Nothing on the wire, in the schema or in the prototype's surface
  changes.**

## Testing Decisions

A good test drives a unit through its public interface and asserts what a
caller sees: a rendered name or label, a returned value, a response body,
the rows a query answers. It never asserts which helper ran. This round moves
state and spellings, not behaviour, so almost every commit is carried by
cases that already exist.

- **The safety net comes first** (commit 1). The movie page's re-map is the
  riskiest code this round replaces, and no test covers it. The flip under a
  loaded film and the late landing are written against the current code and
  must pass before and after commit 9. The series page gets the same flip
  case, since it is the shape everything converges on. Prior art: the
  _"redraws the loaded cards on a flip"_ cases in `SeriesHome` and
  `GenreMovies`, and `MovieDetail`'s placeholder cases from 371.
- **New pure units get their own rows.** `tmdbRating` gets them in
  `shownRating.test.ts`. `tmdbMarks` gets its own suite, as every
  `src/utils/` helper must (CLAUDE.md, Code Rules). Prior art:
  `gradientFromId`, `kindFilter`.
- **The retyped heart helpers** keep every case `withFavorite.test.ts` holds,
  rebuilt on `makeMovie` and `HomeRow` fixtures in place of
  `makePosterCardMovie`.
- **The hooks' and screens' suites do not change** in commits 7 and 9. They
  observe cards, labels and calls, which is the point. A suite that has to
  change there is reading an implementation detail and is fixed in the same
  commit, with the reason in the body.
- **Retiring `underTmdbRatings`** retires its suite. Its rows already live in
  `view`'s and `seriesCardView`'s suites under both preferences.
- **Server.** Both browse suites already state the preference each
  _Highest rated_ and minimum-rating case runs under (log 43's rule). The
  settings suite holds each flag's default, round trip and independence.
  None of them needs a new case.
- Every commit runs the full suite and `tsc -b --force`.

## Out of Scope

- **The prototype amendment.** Issue 368's files are not in
  `docs/handoff/`, and an agent can't author them. The maintainer drops them
  in. Until then, the build's inks (`textDim` for the muted stars,
  `textFaint` for the tag) stand as the PRD described them.
- **The two `Tag` styles.** `StarRating`'s tag is sized off the star
  (`0.7 ×`). `RatingPicker`'s is a fixed 10px. On the movie page (20px stars)
  that is 14px against 10px. Whether they should agree is the prototype's
  call, so it waits for the amended files.
- **The settings routes' boolean refusal**, `typeof value !== 'boolean'`
  with _"Body must be { value: boolean }"_, is now written seven times across
  the router. The new route copies the Ultrawide margins one, which is the
  precedent. A shared body reader for every `{ value }` route is a change to
  the route layer as a whole, not to this initiative.
- **`marked` for a movie.** The watched rule commit 9 writes for a film is
  the rule `series/markEpisodes`' `marked` writes for an episode. Moving one
  rule into `src/utils/` for both is a series refactor, not this one.
- **The three mappers' two lines.** `toRatingPercent(shown?.units ?? null)`
  and `shown?.source ?? null` stay in `view`, `seriesCardView` and
  `seriesView`. Each mapper decides its own field names (`rating` against
  `ratingPercent`), and a helper over two lines would hide that.
- Anything log 43 put out of scope: the score as its own number, a
  `vote_count` threshold, an Export column, a picker on the series page, the
  original title.

## Further Notes

- The convergence in Group 4 is the round's one real move. Each of its
  commits is ordered so the screen it touches is covered before it changes:
  commit 1's cases for the movie page, and the existing flip cases for the
  home and the Genre page.
- The fourth displaced docblock in four initiatives is worth naming in the
  journal: each one came from inserting a helper between a function and its
  docblock.
- Follow-ups this plan already sees, each for the journal, not this round:
  - the prototype files from 368;
  - the two `Tag` sizes;
  - one `{ value }` body reader;
  - one watched rule for films and episodes.
