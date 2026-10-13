# Plan: Season posters — each Season card draws its season's own TMDB poster

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/320

Every Season card on a series page is the same gradient, and only the `S02`
numeral tells them apart. A Sync already asks TMDB about every season on disk,
and that answer carries the season's poster, which the app throws away. This
initiative keeps it. It reopens log 22's ruling that "offline has no source",
and nothing else in log 22.

The rule is the **Still**'s rule, reused whole. A season poster is fetched
only under the Poster chip, and only when that season has none. It is never
replaced, never a review row, and a failure leaves the gradient.

## Running the phases

**Phase 0 is HITL and docs-only.** It amends the prototype before any code
draws it (log 39 Q6). `issue-loop` stops there so the maintainer can review
the amendment.

**Phases 1–3 run AFK under `issue-loop`**, in order. They are log 39's
_Implementation Plan_ slices 2–4. Each one works end to end:

- Phase 1 draws a poster that the storage suite writes directly.
- Phase 2 makes a Sync write it.
- Phase 3 makes an Export carry it.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: none new. The series page's read (`GET /api/series/:id`) now
  carries each season's `posterPath`. `POST /api/enrichment` and
  `POST /api/export` keep their bodies.
- **Schema**: migration 10 adds `season_posters`:
  - `series_id`: not null, references `series`, cascades on delete.
  - `season_number`: not null, integer.
  - `poster_path`: not null text, a **Stored path**.
  - `(series_id, season_number)` is the primary key.

  A row exists only for a season that has a poster, and nothing is
  backfilled. There is no `seasons` table, and a season stays a number (log 22
  Q3, log 39 Q1). `season_posters` joins `ERASED_TABLES`.

- **Key models**:
  - `SeasonSummary.posterPath: string | null`: the **Season poster**'s Stored
    path. Both build targets share it.
  - `SeasonCardSeason.posterUrl?: string | null`: the twin of
    `EpisodeRowEpisode.stillUrl`, spelled through `imageUrl`.
  - `TmdbSeason.poster_path: string | null`. It comes on the
    `/3/tv/{id}/season/{n}` request a Sync already makes, so there is no new
    client call.
  - The **Season plan**, `planSeason(held, theirs, fields) → { poster }`. It
    is pure and takes no scope.
- **Where the file lives**: `S02-poster.jpg` in the show's **Series folder**,
  stored through the existing `storeInSeriesFolder`. There is no new `Media`
  member. A renumber moves no file, so the poster stays attached to its season
  number (log 39 Q2). `removeSeriesFolder` and `emptyRoot` already take the
  file.
- **Unchanged throughout**: the following stay as they are.
  - `ENRICH_FIELDS` and the setup screen's chips.
  - `fullDetails`.
  - The Decision kinds and the review.
  - The Write targets (`writePoster` stays film-only, log 39 Q8).
  - The sixteen Export columns and the nine Episodes columns.
  - The Season page header and the _Other seasons_ pills.
  - The Movie form and Bulk import, which never set or clear a season poster.

---

## Phase 0: Prototype amendment (HITL)

**User stories**: 1–10 (the surface they describe)

### What to build

Amend `mol.SeasonCard` in `docs/handoff/` so its `season` gains
`posterUrl?: string | null`. When the url is given, the tile draws the image
over the gradient. The `S02` numeral and its text shadow stay unchanged.
Give one season in `page.SeriesPage`'s sample data an image, so the state is
drawn beside the gradient fallback. Update `COMPONENT-SPEC.md` where it lists
the card's props.

### Acceptance criteria

- [ ] `mol.SeasonCard`'s `data-props` names `posterUrl`, and the tile draws it
      over the gradient with the numeral still legible.
- [ ] A season without `posterUrl` draws exactly as before: the gradient, and
      no series poster or Wordmark.
- [ ] `page.SeriesPage` shows at least one season with art and one without.
- [ ] The badge, the progress bar, the caption and the watched line are
      unchanged.
- [ ] The maintainer has reviewed the amendment before Phase 1 starts.

---

## Phase 1: A stored season poster draws on the card

**User stories**: 1–10, 26–30, 32, 33

### What to build

The thinnest end-to-end path:

- Migration 10 creates `season_posters`, and `ERASED_TABLES` lists it.
- The series storage gains `setSeasonPoster(seriesId, season, posterPath)`,
  an upsert, exposed on the storage seam the way the existing series enrich
  writes are.
- The series page's read joins `season_posters`, driven by the seasons that
  have episodes, so each `SeasonSummary` carries `posterPath`. A row for a
  season with no episodes is never read (log 39 Q10).
- `seriesView` maps `posterPath` to `posterUrl` through `imageUrl`.
- `SeasonCard` passes it to `Artwork` over its `g1`/`g2` gradient. It stays a
  non-Poster surface, so with no url it draws the gradient alone, and a url
  that fails to load falls back to the gradient.

The phase is proven by a row written directly in the storage suite and a card
that draws the url. No Sync writes a poster yet.

### Acceptance criteria

- [ ] Migration 10 applies over a migration-9 database, leaves every existing
      row alone, and adds no rows.
- [ ] `setSeasonPoster` inserts, then upserts over the same
      `(series_id, season_number)`. A series that doesn't exist is refused.
- [ ] Deleting a series cascades its rows away. A Factory reset erases them,
      and `resetDatabase`'s guard stays green.
- [ ] The read answers `posterPath: null` with no row, and the Stored path
      with one. A row for a season with no episodes adds no season to the
      read.
- [ ] A Series edit that renumbers or removes episodes leaves
      `season_posters` untouched. The poster stays on its number.
- [ ] `seriesView` answers `posterUrl` as `imageUrl(posterPath)`, and `null`
      for none.
- [ ] `SeasonCard` with a `posterUrl` puts the url on its art layer and still
      draws the numeral, the badge, the bar and the caption. Without one it
      draws the gradient and never the Wordmark.
- [ ] `makeSeriesDetail` builds `posterPath: null` by default, and every
      existing suite stays green.
- [ ] The image-route guard and the Interaction contract guard stay green
      with no new exemption.

---

## Phase 2: A Sync fetches season posters

**User stories**: 11–25, 31

### What to build

The changes:

- `TmdbSeason` reads `poster_path`, and the `fakeTmdb` season builder gains
  it, `null` by default so today's suites don't move.
- `planSeason` is a new pure unit beside `planEpisode`. It answers TMDB's
  image path only when the Poster chip is on, nothing is held, and TMDB has
  one. Otherwise it answers `null`.
- The series storage gains `seasonPosterOf(seriesId, season)`.

`writeShow`'s season loop gains one step before the episodes for each season
above 0. It plans with the held poster. When a poster is wanted it fetches the
image, stores it as `S02-poster.jpg` in the Series folder, records it with
`setSeasonPoster`, and logs `↓ S02-poster.jpg  →  <stored path>` as a `scan`
line. An image that isn't `ok`, a store that throws, or an aborted signal
writes no row, and the run carries on. Only the season request's own failure
stops a run, as today.

Every way into `writeShow` gets this with no extra wiring: the library Sync, a
single-series Sync, a series `pick` and a series _Apply choices_.

### Acceptance criteria

- [ ] `planSeason`'s table-driven suite covers four cases:
  - It answers TMDB's path with Poster on, none held, and a path from TMDB.
  - It answers `null` with Poster off.
  - It answers `null` when a poster is held, under every scope's fields.
  - It answers `null` for a `null` or empty `poster_path`.
- [ ] `seasonPosterOf` answers the held path, and `null` for none, for another
      season, and for another series.
- [ ] A Sync with Poster on stores `S02-poster.jpg` in the Series folder,
      records it, logs its line, and the series page's read then carries it.
- [ ] A second Sync over the same show fetches no season image, even under
      _Everything_.
- [ ] With Poster off, no season image is asked for.
- [ ] A failed image or a throwing store leaves no row, and the run still
      reaches review. No season poster becomes a Decision or a field
      conflict.
- [ ] Season 0 is never asked, and the run makes no more `season` requests
      than before.
- [ ] A single-series run and a series `pick` each store a season poster.
- [ ] A stopped run keeps what it stored and fetches no more.
- [ ] Nothing is written into a Library folder, and `fullDetails` and the
      chips are unchanged.

---

## Phase 3: Export carries season posters

**User stories**: 34–39

### What to build

`exportRows` reads each series' `SeasonSummary.posterPath` off the
`SeriesDetail` it is already given, so its signature doesn't change. Under
_Images_, each season with a stored poster is planned at
`seasons/S02.<ext>`, using the stored file's own extension, in the title's
folder beside `stills/`. A show whose only art is season posters still claims
its folder. Seasons with no episodes aren't in the read, so they never reach
the plan. `writeExport` copies the new File plan entries through
`Media.readStored` exactly as it copies stills, and skips an unreadable one.
There is no cell to blank.

### Acceptance criteria

- [ ] Under _Images_, a season poster is planned at
      `<title folder>/seasons/S02.<ext>`.
- [ ] With _Images_ off, no season poster is planned.
- [ ] A show with season posters alone (no poster, backdrop or stills) still
      gets its folder under _Images_.
- [ ] `writeExport` puts the planned season poster on disk, and skips an
      unreadable one without failing the Export.
- [ ] The Titles sheet's sixteen columns and the Episodes sheet's nine are
      unchanged, and the round-trip suites stay unchanged and green.
