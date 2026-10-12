> **Initiative:** `season-posters`
> **Design log:** `docs/design-logs/39-season-posters.md`
> **Issue:** #320
> **Build order:** the first 🔜 item after the third chain, not yet numbered into a chain. It reopens log 22's ruling that "offline has no source", and nothing else in log 22. It ships as four thin slices (log 39, _Implementation Plan_)

## Problem Statement

I keep the family library up to date, and every season of a show looks the same. A series page's Seasons grid is a row of identical gradients, and only the `S01`, `S02`, `S03` numeral tells them apart. My parents choose a season by its picture on every streaming service they have used, and here there is no picture to choose by.

TMDB has a poster for nearly every season. A Sync already asks TMDB about every season on disk to fill episode titles, air dates and stills, and that answer carries the season's poster. The app throws it away.

## Solution

A Sync keeps it. Whenever a Sync reads a season, it also fetches that **Season poster**, stores it in the show's own folder, and records it against the season's number. The **Season card** draws it behind the `S02` numeral, and draws the series' gradient as today when there is none.

The rule is the one a **Still** already follows, so it needs nothing new to learn:

- It is fetched only under the Poster chip.
- It is fetched only when that season has none yet, and never replaced, whatever the scope.
- It is never a review row.
- A poster that can't be fetched or stored leaves the gradient.

Season posters travel in an **Export** under _Images_, as `seasons/S02.jpg` in the title's folder. No column is added and the round trip is unchanged. A Factory reset and a series Delete remove them along with everything else.

## User Stories

### The Season card

1. As a family member, I want each Season card on a series page to show that season's own poster, so that I can tell the seasons apart at a glance.
2. As a family member, I want the `S02` numeral to stay over the poster, so that I always know which season a tile is, even when the art doesn't say.
3. As a family member, I want the numeral to stay legible over any poster, so that a bright image never hides it.
4. As a family member, I want a season with no poster to draw the series' gradient exactly as today, so that a show TMDB has no art for still looks finished.
5. As a family member, I want a season without a poster to never show the series' own poster in its place, so that seasons don't all look alike again.
6. As a family member, I want a season without a poster to never show the FamilyFlix default poster, so that a Wordmark doesn't sit under the numeral.
7. As a family member, I want a poster that fails to load in the window to fall back to the gradient, so that a broken image never shows.
8. As a family member, I want the watched badge, the progress bar, the _Season 2_ caption and its "3 of 8 watched" line drawn over and under the poster as they are today, so that only the art changes.
9. As a family member, I want the card's hover, press and focus to behave as they do today, so that nothing new has to be learnt.
10. As a family member, I want each season's poster to stay with that season when I open a different show, so that one show's art never appears on another.

### The Sync fills it

11. As the maintainer, I want a library Sync to fetch a poster for every season on disk of every matched show, so that one run fills the whole Seasons grid.
12. As the maintainer, I want _Fetch from TMDB_ on a series page to fetch its season posters too, so that I can fill one show without syncing the library.
13. As the maintainer, I want a pick on an `ambiguous` or `missing` series row, and _Apply choices_ on a series' conflict row, to fetch the season posters as well, so that every way into a show's write gets them.
14. As the maintainer, I want no extra request per season, so that a Sync takes no longer than it did.
15. As the maintainer, I want season posters fetched only when the Poster chip is on, so that one chip governs every poster a Sync brings.
16. As the maintainer, I want a season that already has a poster left alone, even under _Everything_, so that a Sync never replaces art it already brought.
17. As the maintainer, I want a season TMDB has no poster for left with the gradient and no error, so that a missing image is not a problem.
18. As the maintainer, I want a season poster that can't be downloaded or stored to leave the gradient and let the run carry on, so that one bad image never stops a Sync.
19. As the maintainer, I want season 0 (specials) never asked about, as today, so that the run's requests don't change.
20. As the maintainer, I want each season poster stored to log one line, `↓ S02-poster.jpg  →  <stored path>`, in the Activity log, so that I can see what the Sync brought.
21. As the maintainer, I want a season poster never to appear in the review as a Decision or a field conflict, so that the review lists only what needs me.
22. As the maintainer, I want _Stop_ to keep any season poster already stored and fetch no more, so that a stopped run behaves as it does for stills.
23. As the maintainer, I want season posters not to count toward a title's Full details, so that a show's completeness reads as it does today.
24. As the maintainer, I want the TMDB field chips unchanged, so that the setup screen looks as it does today.

### Where it lives

25. As the maintainer, I want a season's poster stored in the show's own Series folder as `S02-poster.jpg`, so that it sits beside the series' `poster.jpg` and never overwrites it.
26. As the maintainer, I want a season's poster to stay attached to that season number when I renumber or remove episodes in the Series edit job, so that season 2's art stays season 2's.
27. As the maintainer, I want a season with no episodes left to simply not be drawn, its stored poster ignored, so that a renumber never leaves an empty card behind.
28. As the maintainer, I want a season poster refused for a show that is gone, so that no record points at a deleted series.

### Housekeeping

29. As the maintainer, I want deleting a series to remove its season posters' records and their files, so that nothing is left behind.
30. As the maintainer, I want a Factory reset to erase every season poster record, and empty the media directory with them, so that a reset leaves nothing.
31. As the maintainer, I want a season poster never written into my Library folders, so that, as with a series' own poster, the app writes back only what it writes back today.
32. As the maintainer, I want neither the Movie form nor Bulk import to ever set or clear a season poster, so that a Sync stays its only source.
33. As the maintainer, I want a database from before this change to open with no season posters and every card drawing the gradient, so that the upgrade needs nothing from me.

### Export

34. As the maintainer, I want an Export with _Images_ on to carry each season's poster in that show's folder as `seasons/S02.<ext>`, beside `stills/`, so that a season's art leaves with the rest of the show's.
35. As the maintainer, I want an Export with _Images_ off to carry no season posters, so that the toggle means what it says.
36. As the maintainer, I want a show with only season posters (no series poster, backdrop or stills) to still get its folder under _Images_, so that its art is not lost.
37. As the maintainer, I want an unreadable season poster skipped without failing the Export, so that one bad file never costs me the rest.
38. As the maintainer, I want the Titles sheet's sixteen columns and the Episodes sheet's nine unchanged, so that an untouched export fed back to Bulk import still adds nothing.
39. As the maintainer, I want a stored season poster for a season with no episodes left out of the Export, so that the folder holds only art the app draws.

## Implementation Decisions

### Prototype first

- **The prototype is amended before any code draws it** (log 39 Q6). `mol.SeasonCard`'s `season` type gains `posterUrl?: string | null`. Its tile draws the image over the gradient when the url is given, and the numeral and its text shadow are unchanged. `page.SeriesPage`'s sample data gives one season an image so the state is drawn.

### Schema

- **Migration 10** adds `season_posters`: `series_id` (a not-null reference to `series`, cascading on delete), `season_number` (a not-null integer) and `poster_path` (not-null text, a **Stored path**), with `(series_id, season_number)` as the primary key. A row exists only for a season that has a poster, so nothing is backfilled. The name follows `series_genres` and `episode_subtitles`: the owner, then what it holds. No `seasons` table is added, and a season stays a number (log 22 Q3, log 39 Q1).
- **Factory reset**: `season_posters` joins `ERASED_TABLES`. `resetDatabase`'s guard already refuses a table listed in neither list, so the guard's suite fails until it is listed.

### Storage (`library/series/`)

- **`enrich`** gains two members, exposed on the storage seam as the existing series enrich writes are:
  - `setSeasonPoster(seriesId, season, posterPath)`: an upsert of the one row.
  - `seasonPosterOf(seriesId, season) → string | null`: the held Stored path, or `null`.
- **`read`** joins `season_posters` into the series page's read. Each `SeasonSummary` gains `posterPath: string | null`. The join is driven by the seasons that have episodes, so a row for a season with none is never read (log 39 Q10).
- **The Series edit job** does not touch `season_posters`. A renumber or a removal leaves the rows as they are.

### Media

- **No new `Media` member.** A season poster is stored with the existing `storeInSeriesFolder(video, name, source)`, the call the series' `poster.jpg` and `backdrop.jpg` already use, under the name `spellEpisodeTag(season)` followed by `-poster.jpg` (so `S02-poster.jpg`). The Series folder is the one place that stays stable for a season, because a renumber moves no file (log 39 Q2). `removeSeriesFolder` (series Delete) and `emptyRoot` (Factory reset) already take the file.

### Enrichment

- **`TmdbSeason`** gains `poster_path: string | null`. The `/3/tv/{id}/season/{n}` request is the one already made, so there is no new client call.
- **`planSeason`** is a new pure unit beside `planEpisode`, and the deep module of this initiative: `planSeason(held, theirs, fields) → { poster: string | null }`. It returns TMDB's image path when the Poster chip is in `fields`, `held` is `null`, and `theirs.poster_path` is non-empty. Otherwise it returns `null`. It takes no scope, because the answer is the same for every scope.
- **`writeShow`'s season loop** gains one step before `writeEpisodes` for each season `n > 0`. It plans with `seasonPosterOf`'s answer as `held`. When a poster is wanted it calls `client.image`, then `storeInSeriesFolder`, then `setSeasonPoster`, then logs `↓ S02-poster.jpg  →  <stored>` (kind `scan`), matching `storeSeriesImage`. An image outcome that is not `ok`, a thrown store, or an aborted signal writes no row and leaves the gradient. A failed season poster never stops the run. Only `client.season`'s own failure stops it, as today.
- **Every way into `writeShow`** gets this with no extra wiring: the library Sync, a single-series Sync, a series `pick` and a series _Apply choices_.
- **What stays unchanged**: `ENRICH_FIELDS`, the chips, `fullDetails`, the Decision kinds, the Write targets (`writePoster` stays film-only, log 39 Q8) and the review.

### Types and the client

- **`SeasonSummary`** (`src/types/series.ts`, shared by both build targets) gains `posterPath: string | null`, the **Season poster**'s Stored path.
- **`SeasonCardSeason`** (view models) gains `posterUrl?: string | null`, the twin of `EpisodeRowEpisode.stillUrl`.
- **`seriesView`** maps `posterPath` to `posterUrl` through `imageUrl`, the one spelling of the image route in `src/`.
- **`SeasonCard`** passes `season.posterUrl` as `Artwork`'s `url`, over the existing `g1`/`g2` gradient, with the numeral unchanged. It stays a non-**Poster surface**, so `Artwork` never draws the Default poster on it, and `Artwork`'s comment keeps naming it as one. A url that fails to load already shows the gradient, because `Artwork` layers the url over it.
- **Every other caller of `SeasonSummary` stays as it is**, including the Season page header (no art frame, log 39 Q7) and the _Other seasons_ pills. Test builders that make a `SeasonSummary` (`makeSeriesDetail`) gain `posterPath: null` by default.

### Export

- **`exportRows`** reads each series' `SeasonSummary.posterPath` from the `SeriesDetail` it is already given, so its signature does not change. Under _Images_, each season with a stored poster is planned at `seasons/<S02>` plus the stored file's own extension, in the title's folder, beside `stills/`. A show whose only art is season posters still claims its folder.
- **No cell changes.** The sixteen Export columns and the nine Episodes columns are fixed (log 31). There is no Seasons sheet, and the importer reads no season art, so the round trip holds unchanged (log 39 Q9).
- **`writeExport`** copies the new File plan entries through `Media.readStored` exactly as it copies stills. An unreadable file is skipped, and there is no cell to blank.

### Slices (log 39, _Implementation Plan_)

1. **Prototype**: `mol.SeasonCard` and `page.SeriesPage`'s sample.
2. **Thinnest end to end**: migration 10 and `ERASED_TABLES`, `setSeasonPoster` and the read's `posterPath`, `seriesView`'s `posterUrl` and `SeasonCard`'s art. Proven by a row written directly in the storage suite and a card that draws a url.
3. **The Sync fills it**: `TmdbSeason.poster_path`, the `fakeTmdb` season builder, `planSeason`, `seasonPosterOf` and `writeShow`'s loop with its log line.
4. **Export**: `exportRows`' File plan carries `seasons/S02.<ext>` under _Images_, and `writeExport` copies it.

## Testing Decisions

- **A good test here asserts what a caller can observe**: what the read returns, what the card draws, what the Sync stored and logged, and which files an Export plans and writes. It does not assert how a query is written or in what order private helpers run. Each suite drives its unit through its public seam, with the doubles that already exist.
- **`planSeason`** gets its own suite in its folder. It is pure and table-driven, after `planEpisode`'s suite: wanted with Poster on, none held and TMDB has one; `null` with Poster off; `null` when one is held, under every scope's fields; `null` when `poster_path` is `null` or empty.
- **`library/series/enrich`**: `setSeasonPoster` inserts, then upserts over the same key. `seasonPosterOf` answers `null` for none and for another season or another series. Deleting the series cascades the row away.
- **`library/series/read`**: `posterPath` is `null` with no row and the Stored path with one. A row for a season with no episodes leaves no extra season in the read. A renumber through the series `write` leaves the row on its number. Prior art: the existing `read` and `write` suites.
- **`db/resetDatabase`**: the existing guard covers `season_posters` once it is listed. The erase suite gains a season poster row to prove it goes.
- **Migrations**: `db.test.ts`'s pattern, migration 10 applies over a migration-9 database and leaves every existing row alone.
- **`createEnrichment`**, over the existing series suite and `fakeTmdb` (whose season builder gains `poster_path`, `null` by default, so today's suites don't change):
  - A Sync with Poster on stores `S02-poster.jpg` in the Series folder, records it and logs its line.
  - A second Sync over the same show, even under _Everything_, fetches no season image.
  - With Poster off, no season image is asked for.
  - A failed image or a throwing store leaves no row, and the run reaches review.
  - Season 0 is never asked.
  - A single-series run and a series `pick` both store one.
  - A stopped run stores no more.
- **`seriesView`**: `posterUrl` is `imageUrl` of the Stored path, and `null` for none. Prior art: its `stillUrl` mapping in `seasonView`.
- **`SeasonCard`**: with `posterUrl` the art layer carries the url and the numeral is still drawn. Without it, it draws the gradient alone and never the Wordmark. Prior art: `EpisodeRow`'s still tests and `Artwork`'s suite.
- **`exportRows`**: under _Images_, a season poster is planned at `<title folder>/seasons/S02.<ext>`. Nothing is planned with _Images_ off. A show with season posters alone still gets its folder. Rows and columns are unchanged.
- **`writeExport`**: the planned season poster lands on disk, and an unreadable one is skipped without failing.
- **The export round-trip suites stay unchanged and green**, and that is the proof that the round trip holds.
- **The Interaction contract's structural guard and the image-route guard** stay green with no new exemption.

## Out of Scope

- A Season page art frame (log 39 Q7). The card is where seasons are chosen.
- A season poster picked or uploaded by hand in the **Movie form**, which edits no seasons.
- Specials. Season 0 stays unasked, as log 22 left it.
- Writing season posters back into a **Library folder** as a **Write target** (log 39 Q8).
- Reading a `season01-poster.jpg` from disk during Bulk import or a Folder scan.
- An Export column or Seasons sheet for season posters, and reading one back on import (log 39 Q9).
- A `seasons` table, an `episodes` column, a `season-NN/poster.jpg` file, or a series-poster fallback on the card (log 39 Q1, Q2, Q5).
- Replacing a held season poster under any scope.

## Further Notes

- **Vocabulary**: **Season poster** and **Season plan** are new terms in `docs/ubiquitous-language.md`. "Season poster" is no longer an alias to avoid for the card. The **Season card** is the tile and the Season poster is the art, so never call the card a season poster. An unqualified "poster" means a title's Poster.
- **A row can outlive every episode of its season.** That is deliberate (log 39 Q10). The read never draws it, and a series Delete or a Factory reset takes it.
- **When this ships**, `CLAUDE.md`'s and the README's 🔜 **Season posters** entries turn ✅ only after the initiative's refactor, as every feature does. CLAUDE.md's migration list gains migration 10, and the `library/series/enrich` line gains the two members.
