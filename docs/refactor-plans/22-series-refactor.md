# Refactor plan: Series (TV) — one series storage per concern, one tag spelling, one player address, and the docs that close the initiative

> Source initiative: [`series`, issue #188](https://github.com/carlos-rezai/FamilyFlix/issues/188)
> Shipped by issues 189–199. Design log: `docs/design-logs/22-series.md`.
> Filed as issue 201.
> The docs-and-checks slice filed as 200 is folded in here as Group 0 and
> Group 5, on the precedent of 186 into 187, 176 into 177, 168 into 169, 163
> into 164, 156 into 157, 148 into 149 and 140 into 141. It was closed at
> filing so the initiative has one closing issue rather than two. The feature
> table ticks ✅ when this one closes.

## Problem Statement

`series` is step 5 of the build order and the largest initiative the app has
had: 120 files and about 15,000 lines across eleven slices. It is the first
entity that is not a **Movie**. The maintainer's standing instruction set the
scope: _translate the prototype 1:1 into the codebase, in its naming,
conventions, patterns and architecture_.

What shipped is what the log settled, and it works end to end:

- migration 4, with two tables and two joins
- `episodeTag` and `groupShows`, the importer's episode loop, and `unplaced`
- the **Library tabs** and the Series tab
- the **Series page** and **Season page**
- `SeasonCard` and `EpisodeRow`, both on the card fragments
- the **Playable**, the episode wire and the **Up next card**
- the **Sideways move**

5486 tests pass across 282 files, and `tsc -b` and `eslint src server` are
clean.

What is left is the usual shape of a round that was built one slice at a
time. Each slice made the smallest change that turned its leaf green, and
several of those changes only look wrong when the initiative is read as a
whole.

### 1. The server's series storage is two catch-alls, tested only through the router

Log 22 Q12 put series storage in `library/series/`, one folder per concern
like its movie siblings: `read`, `browse`, `watch`, `curation`, and
`nextEpisodeOf`. What shipped is two files:

- `series/read` is 384 lines holding the detail read, the episode read, the
  episode list, the Series tab's home and its genre list. It is `read`,
  `browse`, `home` and `genre` in one file.
- `series/write` holds the two inserts and the favorite.

The episode and season watch writes went into the **movie's** `watch/`, which
now carries seven methods over two tables.

Neither series unit has a suite beside it. Every storage assertion lives in
`routes.series.test.ts` and `routes.episodes.test.ts`. Every movie storage
unit has its own suite, and the router suites test only the HTTP layer over
them.

One seam method is dead. `markEpisodeWatched` is on `LibraryStorage`, and no
shipping code calls it. The watched route and the player's finish both write
through `setEpisodeWatched`, so a test is its only caller.

### 2. The routes repeat what the movie routes already factored

`movieOr404` exists so that the sentence "a missing movie is a JSON 404
naming it" is written once. The episode routes write
`Unknown episode: <id>` by hand four times. The three routes that open a file
are already one set of handlers mounted under both `/movies` and `/episodes`.
`/episodes/:id/resume`, however, is a line-for-line copy of `/movies/:id/resume`:
the same body check, the same rounding and the same echo, over a different
lookup. `/episodes/:id/watched` is the same kind of copy of the movie's
watched toggle. Inside the shared file handlers, the playable is still named
`movie`.

### 3. The importer makes a directory by hand

`media/` is the only module that touches managed storage. It reserves a Movie
folder, copies a file in under the cancel signal, and removes what a failure
leaves behind. The importer now imports `mkdir` from `node:fs/promises` to make
each `season-NN/` directory itself, and it spells the season folder's name
with its own `twoDigits`. That is a filesystem write outside the media
domain, and the doubles the importer's suites use (`heldCopy`) cannot see
it.

### 4. `S02E04` is spelled eight times

The tag is spelled in eight places:

- the importer's `tagOf` and `episodeLabel`
- `EpisodeRow`'s `episodeCode`
- `SeasonCard`'s inline `S{padStart}`
- `seriesView`'s _Resume S02E04_
- `seasonView`'s _Resume E04_
- `episodeContinueView`'s card title
- the Player's `episodeTitle`
- `UpNextCard`'s code

Five of them declare their own `pad`. It is one rule, the **Episode tag**
spelled two digits a side, written eight times. The server already has the
unit that reads a tag. It has no unit that writes one.

### 5. The view models are not named or placed like the prototype's

The prototype's data-props name the two page models `SeriesPageModel` and
`SeasonPageModel`. The movie page's `MovieDetailModel` is named after its
prototype and lives in `types/viewModels`. What shipped:

- `SeriesDetailModel` in `types/viewModels`.
- `SeasonViewModel` exported from inside `seasonView`.
- `SeasonCardModel` in `types/viewModels`, a field-for-field copy of
  `SeasonCard`'s own `SeasonCardSeason`.

`PosterCard` and `ContinueCard` read their prop models from `@/types`
(`PosterCardMovie`, `ContinueCardMovie`). `SeasonCard` and `EpisodeRow`
declare theirs inside the component.

### 6. The optimistic bargain is written three more times

`useOptimisticEdit` is the movie page's contract for a signal:

1. show the new value at once
2. take the route's echo over what was assumed
3. put back what the edit cost if the save is refused

Log 22 Q39 cites it as the precedent for the season page's writes. It could
not be reached: it lives in `features/movie-detail/` and is typed to
`MovieDetailModel`. So the series feature writes the bargain by hand three
times:

- the series heart in `useSeriesDetail`, which honours the echo
- the episode box in `useSeasonEpisodes`, which ignores the echo
- the season mark in `useSeasonEpisodes`, which also ignores it

Two writes on one page therefore keep a weaker promise than the heart on the
page before it.

`useSeriesDetail` and `useSeasonEpisodes` also each carry a full copy of the
same load: `fetchSeriesDetail`, the four-state **Load state**, the stale-response
guard and the retry counter. Neither hook has a suite. `useMovieDetail` has
one.

### 7. The series page is not drawn as the prototype draws it

- **Back.** `page.SeriesPage` draws a 44px icon-only glass circle. Its border
  is `rgba(255,255,255,.14)`, its hover is `rgba(40,34,27,.85)`, and its glyph
  is white. The page shipped the movie page's text pill instead, and
  `SeriesPage.styles.ts` is a copy of `MoviePage.styles.ts` down to the
  docblock.
- **Its own units.** Q35 and Q49 named `SeriesMetaLine` as its own unit,
  because the movie's `MetaLine` is built around the picker and the Watched
  badge. It shipped as a `metaSegments` function inside the organism. The
  loading face shipped the same way, as `LoadingSeries` inside the organism,
  where the movie page has `LoadingDetail/`.
- **The hover guard.** The motion round settled one spelling,
  `:not(:disabled)`. Five series controls write a bare `&:hover`: the season
  toggle, the _Other seasons_ pill, the episode box, and _Play now_ and
  _Cancel_ on the Up next card.

### 8. The player takes two kinds of address

The plan made "the movie suites stay green without edits" its proof that the
feature was additive. The player satisfied that by accepting both old and new
addresses:

- `Player`, `useOpeningReads`, `useSubtitles` and `useWatchReporter` take
  `Addressed = { movieId } | { playable }`, and `addressOf` normalises it.
- The wire takes `PlayableTarget = Playable | string`, and `routeOf`
  normalises that too.

The only production caller, `PlayerPage`, passes a Playable. The `movieId`
arm exists for the test suites. The proof has done its job, and the shim is
now a second spelling of one address that every future player hook would
have to accept.

The **Up next** rules are inline in the Player organism:

- the cancelled flag
- the seconds-left arithmetic
- _Play now_'s write
- the end-of-file effect, which carries an `exhaustive-deps` suppression

The organism is otherwise made of one hook per concern
(`useControlsVisibility`, `useFullscreen`, `usePlayerKeys`, …).

### 9. The documents that close the initiative (issue 200, folded in here)

- CLAUDE.md's folder map and README's tree name none of the following:
  - `library/series/`, `episodeTag`, `groupShows` or migration 4
  - the `series` feature
  - `SeasonCard`, `EpisodeRow`, the graduated `CreditsRow` or `UpNextCard`
  - the three route utils
  - the two new shared calls

  The `api/` paragraph's list of calls that earned their place stops at five.

- CLAUDE.md's Series entry says "a `series`, `season`, `episode` trio". Q3
  ruled out a `seasons` table.
- The glossary's Series rows have not been checked against the shipped code.
- 200 asks for the series form and series Export to be recorded in log 22 as
  prototype amendments. Log 22 already records both: Q2, and the
  Trade-offs' _flagged for a prototype amendment_. The log is also an
  immutable snapshot. The motion round refused the same request for log 21.
  The glossary and the journal are where the flag lives on.
- The journal has no entry for the build.

## Solution

Six groups, each leaving a working tree after every commit.

0. **The build's record.** This comes first, so the journal describes what
   shipped before this round changes it.
1. **Server.** Series storage becomes one unit per concern, each with its own
   suite. The routes share their handlers and their 404, the media domain
   makes the season folder, and `episodeTag` spells a tag as well as reading
   one.
2. **Shared client units.** One tag formatter, the view models named and
   placed as the prototype and the movie precedent place them, and
   `useOptimisticEdit` lifted to `hooks/` over any held record.
3. **The series feature.** One series load, the three writes on the one
   bargain, the meta line and the loading face as units, the series page's
   Back drawn as the prototype draws it, and one hover guard.
4. **The player.** One address, and **Up next** as a hook.
5. **Documents.** They come last, because the map and the glossary have to
   describe the tree the earlier groups leave behind.

Twenty-six commits in all. Two things change on screen:

- The series page's Back becomes the prototype's circle.
- A season-page mark now takes the route's echo, as the heart already does.
  Today the echo always equals the request, so the family sees no
  difference.

## Commits

### Group 0 — the record of what was built

1. **The journal's series entry.** `docs/dev-journal.md` gets the build's
   entry, dated by the last build commit (2026-09-25). It covers:
   - What shipped across 189–199, slice by slice. The plan turned the log's
     six slices into nine.
   - The judgment calls the slices made on their own:
     - `ContinueRow` and `useBrowseLoad` reused, where the log sketched
       `EpisodeContinueRow` and `useSeriesHome`
     - `series/read` and `series/write`, where Q12 named four units
     - the episode watch writes placed in the movie's `watch/`
     - the `movieId | playable` shim that kept the movie suites unedited
     - `SeriesMetaLine` and the loading face left inline
     - the series page's Back copied from the movie page
     - `resolvedStyle` learning to normalise a `/`, because stylis prints
       `2 / 3` as `2/3`. It did not learn the ancestor-state selector that
       the motion round expected `EpisodeRow` to need.
   - What was deliberately not built, per Q2: the series form, series
     delete, series in Export, season posters and specials.
   - The test count: 5486 across 282.
   - The follow-ups, listed by bare number.

### Group 1 — the server

2. **Series browse is its own unit.** `getSeriesHome` and `listSeriesGenres`,
   together with their `WHERE` builder, sort table and continue cap, move out
   of `series/read` into `series/browse`, created from the reader the way the
   movie's `createBrowse` is. `series/browse.test.ts` takes over the storage
   assertions that `routes.series.test.ts` makes about filtering, sorting,
   the continue row's one-card-per-series rule, the cap and the genre counts.
   The router suite keeps what is HTTP: parsing, the 400s and the payload
   shape.

3. **Series read has its own suite.** `series/read.test.ts` covers
   `getSeriesDetail` (seasons in order, each season's **Next episode**, `null`
   for a movie's id), `getEpisodeRead` (the next episode across a season
   boundary, `null` after the last one) and `listEpisodes` (the order). These
   assertions are copied down from the router suites, which then keep only
   the 404 and the payload.

4. **Series curation is its own unit.** `setSeriesFavorite` moves from
   `series/write` into `series/curation`, beside the movie's `curation`,
   with a suite of its own: it sets, it clears, an unknown id answers
   `false`, and a movie's id is not a series. `series/write` keeps the two
   inserts and gains `write.test.ts`, which covers genres in order, the
   `UNIQUE` refusal of a second episode at one number, subtitles, and an
   episode's default watch state.

5. **Series watch is its own unit, and the dead method goes.**
   `setEpisodeResumePosition`, `setEpisodeWatched` and `setSeasonWatched`
   move from the movie's `watch/` into `series/watch`, with their statements
   and the shared ISO stamp. The movie's `watch/` goes back to its three
   methods over `movies`.

   `markEpisodeWatched` is removed from the unit and from `LibraryStorage`.
   Its one caller is a test, which moves to `setEpisodeWatched(id, true)`.

   `series/watch.test.ts` covers:
   - watched zeroes the resume position and stamps the time
   - unwatched keeps the position and the stamp
   - the season write touches only that season
   - a movie's id is refused

6. **One 404 for an episode.** `episodeOr404` sits beside `movieOr404` in the
   route file, with the same shape: it answers the episode read, or `null`
   having already sent the 404. The four hand-written
   `Unknown episode: <id>` sentences go through it, including the
   `playables` lookup. Inside the shared file handlers, the local `movie`
   becomes `playable`. The router suites stay green unchanged.

7. **Resume and watched are one handler per kind.** The resume route and the
   watched route are mounted twice through the `playables` table, the way
   `/playback`, `/stream` and `/subtitles/:sid` already are. Only the lookup
   and the mutators differ per kind: `setResumePosition` /
   `setEpisodeResumePosition`, and `markWatched` + `markUnwatched` /
   `setEpisodeWatched`. The copied body check, rounding and echo go. No test
   changes. Both router suites already assert the 400s, the rounding and the
   echo for both kinds, and they are the proof.

8. **The media domain makes the season folder.** `Media` gains
   `seasonFolder(seriesFolder, season)`, which makes `season-NN/` under a
   reserved **Series folder** and answers its path. The importer's `mkdir`,
   its `seasonFolderName` and its `node:fs/promises` `mkdir` import go.
   `createMedia`'s suite gains two leaves: the name, and a second call being
   harmless. `heldCopy` spreads the real `Media`, so the new member reaches
   the importer's suites with no change to the double.

9. **`episodeTag` spells what it reads.** `media/episodeTag` gains the
   inverse of its parser, `S01E03` from a season and an episode. Its suite
   gains the round trip: every tag the parser reads is spelled back
   unchanged at two digits. The importer's `twoDigits` and `tagOf` go, and
   `episodeLabel` and `showMatch`'s held-tag set spell through it.

### Group 2 — the shared client units

10. **One tag formatter.** `utils/formatEpisodeTag/` is added with its suite,
    following `formatBytes` and `formatClock`. It spells whichever parts it
    is given, at two digits: `S02E04`, `S02` or `E04`. All seven client
    spellings move onto it in this commit:
    - `EpisodeRow`
    - `SeasonCard`
    - `seriesView`
    - `seasonView`
    - `episodeContinueView`
    - the Player's title line
    - `UpNextCard`

    The five local `pad`s go. No leaf changes. Every surface's suite already
    asserts the string it draws.

11. **The card models live in `types/`.** `SeasonCardSeason` and
    `EpisodeRowEpisode` move from their components into `types/viewModels`,
    beside `PosterCardMovie` and `ContinueCardMovie`, and the components read
    them from `@/types` as `PosterCard` does. `SeasonCardModel` is removed:
    it was a copy of `SeasonCardSeason`, and `seriesView` now answers the
    card's own type.

12. **The page models take the prototype's names.** `SeriesDetailModel`
    becomes `SeriesPageModel`. `SeasonViewModel`, with its
    `SeasonEpisodeModel` and `OtherSeasonModel`, becomes `SeasonPageModel`
    and moves into `types/viewModels`. These are the data-props `tsType`s of
    `page.SeriesPage` and `page.SeasonPage`, named the way `MovieDetailModel`
    is named after `page.MoviePage`. This is a rename only.

13. **`useOptimisticEdit` is shared.** It moves from `features/movie-detail/`
    to `hooks/`, with its suite, and becomes generic over the record the
    page holds: `T extends { id: string }` in place of `MovieDetailModel`.
    Its only caller in this commit is `useMovieDetail`, whose suite is
    untouched. The docblock's argument that it and `useOptimisticSave` "stay
    two" stands unchanged, because it is about which record is edited, not
    about the record's type. `hooks/`' rule, _used across 2+ features_, is
    met by Group 3's first commit that uses it.

### Group 3 — the series feature

14. **One series load.** `features/series/useSeriesRead/` is added with its
    suite. It covers `fetchSeriesDetail`, the four-state **Load state**, the
    stale-response guard, `retry`, and an `editSeries` setter that writes into
    the held `SeriesDetail` if one is still held. The suite covers loading →
    ready, 404 → `not-found`, a rejection → `error`, retry, and a stale
    response dropped after the id changes.
    - `useSeriesDetail` composes it and maps through `seriesView` per
      render.
    - `useSeasonEpisodes` composes it and picks its season per render.

    The two copies of the load go.

15. **The series heart keeps the bargain.** `useSeriesDetail.toggleFavorite`
    becomes one `useOptimisticEdit` call over the held `SeriesDetail`, with
    `saveSeriesFavorite` as its save. The hand-written `applyFavorite` and its
    echo reconcile go. `useSeriesDetail.test.ts` is added: the heart flips at
    once, a differing echo wins, and a refusal puts it back. The heart is now
    on the helper the movie page's heart uses.

16. **The season page's marks keep the bargain.** `toggleEpisode` and
    `toggleSeason` become `useOptimisticEdit` calls:
    - `capture` is the episodes the mark touches.
    - `apply` is the movie's watched rule.
    - `restore` is the snapshot.
    - `save` is `saveEpisodeWatched` or `saveSeasonWatched`.

    A differing echo now wins for both, as it does for the heart. The
    hand-written `restore` goes. `useSeasonEpisodes.test.ts` is added: each
    mark flips at once, a refusal restores exactly what it changed, an echo
    wins, and an unknown season is `not-found` with `seriesFound`.

17. **`SeriesMetaLine` is its own unit.** Q35 named it and it shipped
    inline. `features/series/SeriesMetaLine/` holds the **Year range**, the
    counts and the read-only stars, with separators drawn only between the
    segments that are present. It has three files, `MetaLine/`'s precedent.
    Its suite takes the meta-line leaves from `SeriesDetail.test.tsx`, which
    keeps one leaf proving that the line is composed.

18. **`LoadingSeries` is its own unit.** `features/series/LoadingSeries/`,
    `LoadingDetail/`'s precedent, is the hero's shape held while the series
    loads, as a `status` named _Loading series_. The skeleton pieces move out
    of `SeriesDetail.styles.ts` with it.

19. **The series page's Back is the prototype's circle.** `SeriesPage`'s
    `BackPill` becomes a `styled(IconButton)` glass circle, 1:1 with
    `page.SeriesPage`:
    - 44px, icon-only, the 20px chevron
    - `rgba(20,17,13,.6)` with `blur(10px)`
    - the `rgba(255,255,255,.14)` border, a white glyph, and the
      `rgba(40,34,27,.85)` hover
    - fixed at 24/24, named _Back_ by its label and title

    It inherits the press and the ring from the primitive. `SeriesPage`'s
    suite gains leaves asserting that it is icon-only and that the resolved
    hover matches the prototype. The existing leaf that finds it by the name
    _Back_ stays green. `MoviePage` keeps its pill, as `page.MoviePage` draws
    it.

20. **One hover guard in the series controls.** The five bare `&:hover` rules
    (the season toggle, the _Other seasons_ pill, the episode box, and _Play
    now_ and _Cancel_ on the Up next card) become `&:hover:not(:disabled)`,
    the spelling the motion round settled. The specificity is equal, so no
    winner moves and no test changes.

### Group 4 — the player

21. **The watch reporter takes a Playable.** `useWatchReporter`'s options take
    `playable: Playable` and nothing else. Its suite moves from `movieId`
    to `{ kind: 'movie', id }`, one argument per leaf, and gains no leaf.
    The finish write's per-kind save is unchanged.

22. **Subtitles and the opening reads take a Playable.** `useSubtitles` and
    `useOpeningReads` take a Playable only, and `useSubtitles`' suite moves
    the same way.

23. **One address on the wire.** The player's `api` takes a `Playable` only.
    `PlayableTarget` and the string arm of `routeOf` go, and so do
    `Addressed` and `addressOf`. `Player` takes `{ playable }`, and
    `Player.test.tsx` moves from `movieId` to `playable`. The only
    production caller, `PlayerPage`, already passes one.

24. **Up next is a hook.** `features/player/useUpNext/` holds the cancelled
    flag, the seconds left, whether the card shows, _Play now_ (the
    best-effort watched write, then the **Sideways move**), _Cancel_, and
    the end-of-file rule:
    - a next episode not cancelled plays
    - no next episode leaves
    - a cancelled one stays

    It keys its effect on `ended` through a ref to the latest values rather
    than an `exhaustive-deps` suppression. Its suite covers the 15-second
    window, rounding up, cancel for this episode only, and the three
    end-of-file outcomes with a fake `navigate` and `leave`. The Player
    renders what the hook answers. `Player.upNext.test.tsx` stays green
    unchanged and is the proof.

### Group 5 — the documents that close the initiative

25. **CLAUDE.md's folder map, README's tree and the glossary.**
    - The map gains:
      - `library/series/` (`read`, `browse`, `write`, `watch`, `curation`,
        `nextEpisodeOf`)
      - `media/episodeTag/`, with the spelling beside the reading
      - `seasonFolder` on `createMedia`
      - `import-export/groupShows/`
      - migration 4 in `db/`'s list
      - `test-support/seriesFixture/`
      - `features/library/LibraryTabs/` and `features/library/series/`
      - `features/series/` and its units
      - `features/player/UpNextCard/` and `useUpNext/`
      - `components/SeasonCard/`, `EpisodeRow/` and the graduated
        `CreditsRow/`
      - `utils/seriesPath/`, `seasonPath/`, `episodePlayPath/` and
        `formatEpisodeTag/`
      - `hooks/useOptimisticEdit`
      - `types/series.ts`
    - The `api/` paragraph adds `saveSeriesFavorite` and `saveEpisodeWatched`
      to the calls that earned their place, each with the two features that
      asked. README's tree gets the same changes.
    - The glossary's Series rows are read one by one against the code:
      - **Playable** loses its "in place of a movie id" hedge.
      - **Episode tag** notes that the server spells as well as reads.
      - A **Series page** row is added for the circle Back.
    - The _Flagged ambiguities_ list gains four entries:
      - the series form and series Export, awaiting a prototype amendment
        (Q2; log 22 is not edited, per the precedent above)
      - `PosterCardMovie` carrying series and episodes, kept flagged for its
        own round
      - the one-card-per-series Continue row, the reading Q29 chose between
        the prototype's code and §5aa's prose

26. **The journal's paragraph and the tick.** The round's own journal entry
    covers what each group changed, the test count before and after, and
    what was deliberately left out, in the shape the decision document below
    gives. Then the tick:
    - **Series (TV)**, **Episode playback** and **Series import** ✅ in
      README's and CLAUDE.md's feature lists.
    - CLAUDE.md's Series entry is corrected from "a `series`, `season`,
      `episode` trio" to the two tables and two joins that shipped.
    - The build-order chain in both files loses step 5 ("steps 1–5 … are
      done"). **Enrichment (TMDB)** becomes "next", and the remaining four
      keep their numbers and their gates.

    This commit closes this issue. 188 is closed by a comment at the same
    time, by bare number and never with a closing keyword. 200 was already
    closed as folded in when this plan was filed. _(The closure happens at
    closing time, not as a commit.)_

## Decision Document

- **Series storage mirrors movie storage, one concern per unit.** Q12's
  four units plus `nextEpisodeOf`, each created from the reader the way the
  movie's `createBrowse`/`createHome` are and each with a suite of its own.
  `LibraryStorage`'s method names and signatures do not change, except that
  the dead `markEpisodeWatched` is removed. The router suites keep what is
  HTTP, and the storage suites take what is SQL. That is the split the movie
  side already has.
- **Episode watch state is series storage, not movie storage.** The movie's
  `watch/` owns the `movies` table's trio. The same trio on `episodes` lives
  in `series/watch`. The rules are the same, and the tables and the seam
  owners are different.
- **A route handler is written once and mounted per kind.** The `playables`
  table already does this for the three file routes. Resume and watched join
  it. The 404 sentence per kind is written once, in `movieOr404` and
  `episodeOr404`.
- **Only `media/` touches managed storage.** The season folder is a `Media`
  member. The importer asks for it and never makes it.
- **A tag is read and spelled by one unit per build target.** The server's
  `episodeTag` reads and spells, and the client's `formatEpisodeTag` spells.
  The two targets do not share `utils/` (the server imports `@/types` only),
  so there are two units and not one. Within each target the tag is spelled
  once.
- **View models are named for the prototype's `tsType` and live in
  `types/viewModels`.** That means `SeriesPageModel` and `SeasonPageModel`,
  following `MovieDetailModel`. A molecule's prop model is
  `<Component><Noun>` in `types/`, following `PosterCardMovie`. No model is
  declared twice.
- **The optimistic bargain is one hook.** `useOptimisticEdit` moves to
  `hooks/` when a second feature asks for it, which is the same rule `api/`
  follows. It becomes generic over the held record and keeps its
  capture/apply/restore contract. The series page's heart and the season
  page's two marks keep the movie page's promise, including the echo.
- **The player has one address.** A **Playable**, everywhere and nothing
  else. The shim was scaffolding for an additive build, and this is where it
  comes down.
- **The prototype over the precedent it was built from.** The series page's
  Back is the circle `page.SeriesPage` draws, not the pill the movie page
  draws. Each page keeps its own scroll container, as `MoviePage` does: the
  two pages' chrome differs, so there is no shared layout to extract.
- **Design logs are not edited.** 200 asked for amendments in log 22. Log 22
  already records them (Q2, Trade-offs), and a log is a snapshot. The
  glossary and the journal carry the flag forward.
- **Two things change on screen.** The series page's Back is drawn as the
  prototype draws it, and the season page's marks honour the route's echo.
  Anything else that renders differently after this round is a bug in the
  round.

## Testing Decisions

- **A good test asserts behaviour through the unit's own seam.** For a storage
  unit, that means what a call stores and answers over a real in-memory
  SQLite, the way `browse.test.ts` and `watch.test.ts` do it. For a hook, it
  means what it hands back and what it writes, over `fakeResponse`, the way
  `useMovieDetail.test.ts` and `useOptimisticEdit.test.tsx` do it. For a
  surface, it means what it draws and what `resolvedStyle` resolves it to in a
  named state. No test reaches into another unit's internals.
- **Storage assertions move down and HTTP assertions stay up.** Each Group 1
  split copies the router suite's storage leaves into the new unit suite and
  then trims the router suite to status, parsing and payload shape. The
  combined count may fall where the same fact was asserted at both levels.
  No fact is left unasserted.
- **Pure moves and renames change no leaf.** Commits 6, 7, 10, 11, 12, 13,
  20 and 24 move or rename code under suites that already assert its
  behaviour. A red leaf in any of them means the refactor is wrong, not the
  test.
- **The Playable migration edits arguments, not assertions.** Commits 21–23
  change how each suite addresses the film, from `movieId` to
  `{ kind: 'movie', id }`. No leaf is added, removed or renamed.
- **New suites are written for units that had none.**
  - The five series storage units.
  - `useSeriesRead`, `useSeriesDetail` and `useSeasonEpisodes`.
  - `SeriesMetaLine`, `LoadingSeries` and `useUpNext`.
  - `formatEpisodeTag`, which is required for every function in
    `src/utils/`.
  - The spelling half of `episodeTag`, as a round trip.

  Each is written in the commit that creates the unit.

- **Prior art.**
  - `browse.test.ts`, `curation.test.ts` and `watch.test.ts` for the storage
    suites.
  - `useMovieDetail.test.ts` and `useOptimisticEdit.test.tsx` for the hooks.
  - `MetaLine.test.tsx` and `LoadingDetail.test.tsx` for the extracted
    molecules.
  - `useControlsVisibility.test.ts` for a player hook over fake time.
  - The motion round's extension suites for asserting a `styled(IconButton)`
    face through `resolvedStyle`.
- **The round is finished when `node_modules/.bin/vitest run`,
  `node_modules/.bin/tsc -b tsconfig.json` and
  `node_modules/.bin/eslint src server` are all clean.**

## Out of Scope

- **Renaming `PosterCardMovie`, `ContinueRow`'s `movies` and `LibraryGrid`'s
  `movies`.** The rename would touch the whole movie browse surface. It stays
  flagged for its own round (Q30).
- **A series form, series delete and a series in Export.** These are
  prototype amendments first (Q2), not something to improvise.
- **A shared `layouts/` scroll container for the detail pages.** The movie
  and series pages draw different chrome over it, and one `div` each is not
  a template.
- **`EpisodeRow`'s own −2px lift and fill change, and its empty air-date
  line.** Log 21 and Q38 ruled that the row is a **Card** on the shared
  fragments. The empty line is the molecule's `airDate || ''` with nothing
  in it, and it stays until Enrichment fills it.
- **The importer's `importMatch`/`importShow` parallel.** They share their
  copy-under-the-signal and failure-filing shape, but they write different
  records with different rules for partial progress: a film is all or
  nothing, while a show keeps its copied episodes. Folding them would
  parameterise both over that difference.
- **`seriesInLibrary` reading through `getSeriesHome`.** It reads every
  series once per run, before the first `await`. A dedicated `listSeries`
  can wait until a second caller asks for it.
- **Anything Enrichment will add**: air dates, titles and stills.

## Further Notes

- **What the next initiative inherits.** After this round:
  - series storage whose shape matches movie storage
  - route handlers written once per rule
  - one tag spelling per build target
  - one optimistic-edit hook in `hooks/`
  - a player with one address

  Enrichment (step 6) fills `tmdb_id`, `air_date` and episode titles on both
  kinds of record. It will write through `series/write`, and its per-movie
  run will address a **Playable**-shaped record, not a movie id.

- **Why the slices built it this way.** Every item above was the smallest
  change that made a slice's leaf pass:
  - The watch methods went into the movie's `watch/` because that was where
    the statements were.
  - The Back pill was copied because the movie page was open beside the
    page being built.
  - The `movieId` arm existed because the plan said the movie suites would
    not be edited.

  That these add up to a second spelling of five rules is only visible when
  the initiative is read as a whole.
