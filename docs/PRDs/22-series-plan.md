# Plan: Series (TV) — a second kind of thing on the shelves

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/188

The family folder has always held TV shows beside the films, and FamilyFlix
can hold none of them: the importer mistakes a season folder for a film,
there is nowhere to browse a show, the player is keyed on a movie id, and
watch state stops at the film. The prototype revision of 2026-09-22 draws all
of it (COMPONENT-SPEC §5aa). This initiative carries all three parts of build
step 5 — **Series (TV)**, **Episode playback** and **Series import** — because
none is usable alone.

**Everything is additive.** `movies` is not altered, `walkLibraryRoot` and the
`playback/` domain are untouched, and the existing movie suites stay green
without edits — the proof that it is.

The slicing follows the family's path first and then finishes the
maintainer's:

**a show in, a show on the tab** (Phase 1) → **the series page** (Phase 2) →
**the season page** (Phase 3) → **episode playback** (Phase 4) → **Continue
Watching on the Series tab** (Phase 5) → **Up next** (Phase 6) → **import:
loose episodes, subtitles, unplaced** (Phase 7) → **import: re-runs, year
ranges, unnamed shows, the setup panel** (Phase 8) → **the Series tab's
filters** (Phase 9).

Phase 1 is the tracer: from its end a show in the dev fixture's `Season 01/`
shape imports and appears as a poster on the Series tab. Each phase after
adds one screen or one rule end to end — schema to route to surface — and is
demoable over a dev library filled from the fixture. The design log's six
slices become nine: its playback slice splits in two (the player, then the
Continue row), and its import-complete slice in three (the scanner's shapes,
the run's rules, the tab's filters).

There is **no Phase 0**: the prototype already draws every surface here, and
what it does not draw (a series form, a series in Export) is out of scope and
flagged for a prototype amendment rather than improvised.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes (server)**:
  - `GET /api/series?q&genre&rating&sort` → `SeriesHomePayload`, parsed by
    the existing library-query parser.
  - `GET /api/series/genres` → `GenreCount[]` counted in series, with the
    series total.
  - `GET /api/series/:id` → `SeriesDetail`; `404` when absent.
  - `POST /api/series/:id/favorite { value }` — a **Single-signal write**.
  - `POST /api/series/:id/seasons/:n/watched { value }` — every episode of
    the season; watched zeroes the resume position, unwatched clears
    `watched` only.
  - `GET /api/episodes/:id` → `EpisodeRead`.
  - `/api/episodes/:id/{playback,stream,subtitles/:sid,resume,watched}` —
    the movie routes' handlers shared over a lookup of the **Stored path**,
    so `playback/` never learns there are episodes.
- **Routes (client)**:
  - `/?tab=series` — the Series tab; `tab` written as a `replace` by the
    existing query-param writer, omitted at `movies`. ❌ A `/series` route.
  - `/series/:id` — the series page; **Landing** `/?tab=series`.
  - `/series/:id/season/:n` — the season page; **Landing** the series page.
  - `/episode/:id/play` — the same `PlayerPage`, given `kind="episode"` by the
    route table; **Landing** the episode's season page.
  - Two **Sideways moves** (`replace`): the _Other seasons_ pills and Up
    next's move to the next episode.
- **Schema — migration 4**:
  - `series` — `id`, `tmdb_id`, `title`, `year`, `end_year`, `synopsis`,
    `creator`, `cast` (JSON), `rating` (0–10, the movie's `CHECK`),
    `is_favorite`, `poster_path`, `backdrop_path`, `created_at`,
    `updated_at`. No watch columns.
  - `episodes` — `id`, `series_id` (`ON DELETE CASCADE`), `season_number`,
    `episode_number`, `title` (nullable), `air_date` (nullable ISO date),
    `runtime_minutes` (nullable), `watched`, `resume_position_seconds`,
    `last_watched_at`, `video_path`, `created_at`, `updated_at`,
    `UNIQUE (series_id, season_number, episode_number)` — the movie's watch
    trio exactly.
  - `series_genres` mirrors the movie join; `episode_subtitles` mirrors
    `subtitles` with `episode_id`.
  - ❌ A `seasons` table — a season is `season_number` on its episodes.
    ❌ One subtitles table with two nullable owners.
- **Key models** (a new series type module beside the movie's, both build
  targets):
  - `Series`, `Episode`, `SeasonSummary { number, episodes, next }`,
    `SeriesDetail { series, seasons, next }`,
    `SeriesHomePayload { continueWatching, series, episodeCount }`,
    `EpisodeRead` (the episode, its series' id and title, and the next
    episode's `{ id, season, number, title }` or `null`).
  - **Playable** — `{ kind: 'movie' | 'episode'; id }`; the `Player` takes one
    in place of `movieId`. ❌ A second player.
  - `ProblemKind` gains `unplaced` — hard, Skip only, no Resolve.
- **Derived state, never stored**: an episode's `WatchStatus` is the movie's
  derivation; a season is complete when every episode is watched and in
  progress when some are; a series is watched when every episode is.
  **`nextEpisodeOf`** — the first part-watched, else the first unwatched,
  else the first — answered once, on the server, for a series and for each
  season. No client copy.
- **Year range**: `end_year = year` draws `2022`; a later `end_year` draws
  `2019–2023`; `null` draws `2021–`; no `year` drops the segment.
- **Domain placement**: the series' storage is a `series/` area inside the
  library domain, one folder per unit (❌ a fifth domain folder);
  `episodeTag` sits in media beside `fileKinds`; `groupShows` in
  import-export beside `matchRows`, pure over the scans.
- **Storage layout**: a **Series folder** is reserved by the same
  `reserveFolder` from the title and first year — one namespace with Movie
  folders; episodes under `season-01/` by `safeFilename`; poster and backdrop
  at its top.
- **Frontend placement**: the Series tab's body in the library feature; the
  two pages in a new `series` feature; `UpNextCard` in the player feature;
  `SeasonCard`, `EpisodeRow` and the graduated `CreditsRow` in
  `components/`; route helpers `seriesPath`, `seasonPath`, `episodePlayPath`
  in `utils/`; `saveSeriesFavorite` and `saveEpisodeWatched` in `api/`
  (two callers each); every other new wire call stays in its feature.
- **Interaction contract**: `SeasonCard` and `EpisodeRow` are **Cards** on
  `cardLift` / `cardFocus` (❌ `EpisodeRow`'s own −2px and fill); the
  watched box and `LibraryTabs` are **Controls** on `controlStates`.
- **Testing boundary**: behaviour through public interfaces only; jsdom
  computes no `:hover`, `:active` or `:focus-visible`, so no test asserts a
  lift or a ring. Each surface phase is checked visually against its
  prototype file over the fixture library.

---

## Phase 1: A show in, a show on the tab

**User stories**: 1, 2, 3, 4, 5, 6, 8, 9, 18, 75, 76, 79, 81, 82, 83, 90,
91, 99, 100, 101 (the `Season 01/` shape)

### What to build

The tracer. Migration 4 creates the four tables. The media domain learns to
read an **Episode tag** (`S01E03`, `1x03`, and the title after it) from a
filename. After the walk, the importer groups **Season folders** (`Season
01`, `Season 1`, `S01`) under their parent **Show folder** and passes every
other scan through as a film exactly as today. A show matched to a Sheet row
by the movie's **Match rule** takes the row's title, year, genres, synopsis,
rating and cast, and its _Director_ as the creator; it is written as one
**Series** with its **Episodes**, each copied into a Series folder under
`season-NN/`, with runtime derived from the file after the copy. Each episode
is one item on the progress bar, reading `Harbor & Vine · S01E03` as the
current item and in its success line; the console's copy is otherwise
unchanged.

`GET /api/series` answers the series (no filters yet) and the episode count.
The library header gains the Movies / Series pill track first in its start
slot; the Series tab clears the search, keeps genre, rating and sort, reads
_Search your series_, and draws _All series_ as the existing Library grid of
Poster cards — Gradient art when there is no poster, the watched badge when
every episode is watched — under a `N series · M episodes` count line. A
library with no series shows the heading and `0 series · 0 episodes` alone.

The fixture gains one show in the `Season 01/` shape and a row naming it, in
both `library.xlsx` and `library.csv`.

### Acceptance criteria

- [ ] Migration 4 applies to a fresh and to an already-migrated database;
      `movies` is unchanged.
- [ ] `episodeTag` reads both tag shapes in either case and extracts the title
      with dots and underscores as spaces and quality tags dropped; no tag is
      `null`.
- [ ] Season folders group under their Show folder; every non-show scan
      imports as a film exactly as before.
- [ ] Importing the fixture yields one series, with the row's metadata, its
      episodes numbered and copied into its own Series folder, and runtimes
      derived.
- [ ] Each episode advances the bar and logs `Series · SnnEnn`.
- [ ] `GET /api/series` returns every series and the episode total.
- [ ] The Movies / Series switch shows the active tab with the accent pill,
      carries `aria-pressed`, and writes `tab` as a `replace`.
- [ ] Switching clears the search and keeps genre, rating and sort; the
      placeholder reads _Search your series_ on the Series tab.
- [ ] _All series_ draws one Poster card per series with Gradient fallback and
      the watched badge; the count line pluralises episodes.
- [ ] The empty library shows the heading and `0 series · 0 episodes` only.
- [ ] Every existing movie and importer suite stays green untouched.

---

## Phase 2: The series page

**User stories**: 10, 19, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39,
40, 41, 42

### What to build

`GET /api/series/:id` answers a `SeriesDetail`: the series, its seasons each
with their episodes and their next episode, and the series' own next episode,
all through `nextEpisodeOf`. `/series/:id` draws the movie page's hero shape
1:1 — backdrop, poster, title, a meta line of the year range, the season and
episode counts and read-only stars, genre chips, the one _Resume S02E04_ /
_Play S01E01_ button (inert until Phase 4 gives it a route to open), the
heart, the progress line (_Not started_, _5 of 22 episodes watched_, _All 22
episodes watched_), the four-line expandable synopsis, and _Created by_ /
_Starring_ credits — over a grid of **Season cards**, each with the watched
badge when complete, a progress bar when part-watched, and "8 episodes" or
"3 of 8 watched". The movie page's credits row moves to `components/` with the
first credit's label as a prop.

The favorite write works from the page and from the Series tab's grid. A
missing series draws the movie page's not-found face; a page opened with
nothing behind it goes Back to `/?tab=series`, and Back from a series reaches
the tab filtered and scrolled as it was left.

### Acceptance criteria

- [ ] `nextEpisodeOf` answers each arm, across seasons, and an empty list.
- [ ] `GET /api/series/:id` returns the detail with derived season and series
      state; `404` when absent.
- [ ] The hero, meta line, progress line, synopsis and credits match
      `page.SeriesPage`; the year range draws all four shapes.
- [ ] The stars are read-only.
- [ ] The Resume button names the next episode, or _Play S01E01_ when unstarted.
- [ ] `SeasonCard` draws the badge, the bar and both lines, and calls `onOpen`.
- [ ] The heart saves from the page and from the grid; a refusal puts it back.
- [ ] The graduated credits row takes _Director_ or _Created by_; the movie
      page is unchanged.
- [ ] Not-found and the Landing Back both behave as the movie page's do.

---

## Phase 3: The season page

**User stories**: 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
58

### What to build

`/series/:id/season/:n` reads the same series read and derives the season's
view: the show's title over _Season 2_, a _Resume E04_ / _Play E01_ button
(inert until Phase 4), a `8 episodes · 3 watched` count line, _Mark season
watched_ (reading _Mark season unwatched_ once every episode is), one
**Episode row** per episode, and the _Other seasons_ pills. An Episode row
shows the series' gradient as its thumbnail with a resume bar and a hover
play glyph, its `S02E04` code and title (_Untitled episode_ when there is
none), the air date when present, the resume label, and a watched box.

The episode box writes through the episode watched route and the season
button through `POST /api/series/:id/seasons/:n/watched`; both flip at once
and flip back on refusal, and both follow the movie's rule — watched forgets
the resume position, unwatched keeps it. The row is one tab stop that Enter or
Space activates (to play, once Phase 4 exists); the box is a separate stop
that never activates the row. The season pills are a **Sideways move**, so
_Back to series_ reaches the series page however many seasons were looked
at. An unknown season number is the not-found face.

### Acceptance criteria

- [ ] The header, count line, buttons, rows and pills match
      `page.SeasonPage` and `mol.EpisodeRow`.
- [ ] `EpisodeRow` reads _Untitled episode_ with no title; its box does not
      activate the row; Enter and Space activate the row.
- [ ] The episode box and _Mark season watched / unwatched_ are optimistic and
      put back on refusal.
- [ ] The season route marks every episode; watched zeroes resume, unwatched
      keeps it.
- [ ] Episode watched writes follow the movie's semantics.
- [ ] The _Other seasons_ pills navigate with `replace`; Back reaches the
      series page in one step.
- [ ] An unknown season shows the not-found face.

---

## Phase 4: Episode playback

**User stories**: 59, 60, 61, 62, 63, 64, 65

### What to build

The **Player** takes a **Playable** instead of a movie id; `/episode/:id/play`
renders the same page with `kind="episode"`. `GET /api/episodes/:id` answers
the `EpisodeRead`, and the episode's playback, stream, subtitle, resume and
watched routes share the movie handlers over a lookup of the Stored path.
Resume, the **Watch reporter**'s ticks and 95% finish, the missing-file notice
and the Preferred subtitle language all apply unchanged. The title reads
`Harbor & Vine · S02E04 · The Auction`, or `Harbor & Vine · S02E04` without an
episode title. Back from an episode lands on its season page when nothing is
behind it.

The Resume / Play buttons on the series and season pages and a click on an
Episode row now open the player.

### Acceptance criteria

- [ ] `GET /api/episodes/:id` returns the episode, its series and its next
      episode; `404` when absent.
- [ ] The episode routes answer as the movie routes do, over the same
      handlers; `playback/` is unchanged.
- [ ] The Player given an episode chooses the episode wire, draws the title
      line in both shapes, resumes, reports position and marks watched at 95%.
- [ ] A missing episode file shows the missing-file notice.
- [ ] Landing is the season page; a Back after a push steps back.
- [ ] Series Resume, season Resume and a row click open the player on the
      right episode.
- [ ] Every existing player suite stays green untouched.

---

## Phase 5: Continue Watching on the Series tab

**User stories**: 20, 21, 22, 23, 25, 26

### What to build

`SeriesHomePayload`'s `continueWatching` is filled: one entry per series for
its earliest part-watched episode, ordered by `last_watched_at`, capped at 15.
The Series tab draws it as a Continue Watching row of **Episode continue
cards** above _All series_, each reading `Harbor & Vine · S02E04` over the
**Resume label** and opening the player on that episode. The row is absent
when nothing is part-watched. The Movies tab's Continue Watching row stays
films only.

### Acceptance criteria

- [ ] One entry per series, its earliest part-watched episode, most recently
      watched first, at most 15.
- [ ] The card reads `Series · SnnEnn` with the Resume label and opens
      `/episode/:id/play`.
- [ ] The row is not drawn when there is nothing to continue.
- [ ] The Movies tab's Continue row is unchanged.

---

## Phase 6: Up next

**User stories**: 66, 67, 68, 69, 70, 71, 72, 73, 74

### What to build

`UpNextCard`, drawn 1:1 — 372px, 28px from the right, 150px up, `ffPop` — is
shown while there is a next episode, the family has not cancelled, and 15
seconds or less remain; it names the next episode and counts down the time
left, rounded up. _Play now_ marks this episode watched and moves to the next
at once; _Cancel_ hides the card for this episode. When the episode ends: a
next, uncancelled episode plays; no next episode is a **Leaving** to the
season page; a cancelled one stays where it is. The next episode follows on
across a season boundary. Moving to the next episode is a **Sideways move**,
so Back after a run of episodes reaches the season page in one step. A film
never draws the card.

### Acceptance criteria

- [ ] The card appears at 15s remaining and not before; the countdown rounds
      up.
- [ ] _Play now_ marks watched and replaces to the next episode.
- [ ] _Cancel_ hides the card, and the episode ending does not advance.
- [ ] Ending with an uncancelled next plays it; ending the last episode leaves
      to the season page.
- [ ] The last episode of a season leads to the first of the next.
- [ ] Several auto-played episodes leave one history entry; Back reaches the
      season page.
- [ ] A film shows no card.

---

## Phase 7: Import — loose episodes, subtitles, unplaced

**User stories**: 77, 78, 80, 88, 89, 94, 95, 96, 97, 101 (the loose shape)

### What to build

The scanner's second shape: a Source folder whose videos carry an Episode tag
is itself a Show folder. The Season folder's number wins over the tag's; the
episode number comes only from the tag; a multi-episode file (`S01E01E02`)
takes its first. A subtitle beside an episode belongs to the episode whose
video's stem its name begins with, its language through
`detectSubtitleLanguage`; one that matches no stem is a Warning line. An
episode no rule can number, or a second file claiming a taken number, is a
new **`unplaced`** Problem whose reason names the fix (_rename it `S01E03` and
import again_) and offers Skip alone; a show whose every video is unplaced
imports nothing. Two Show folders with one key are the existing `ambiguous`.

The fixture gains the loose shape, in both sheet formats.

### Acceptance criteria

- [ ] A folder of loose tagged episodes imports as one series.
- [ ] The folder's season number overrides the tag's; multi-episode files take
      the first number.
- [ ] Episode subtitles attach by stem with a detected language; a stray
      subtitle is a Warning line, not a Problem.
- [ ] Unnumbered and duplicate-number episodes are `unplaced` Problems with
      Skip and no Resolve; the Review list draws them.
- [ ] An all-unplaced show creates no series.
- [ ] Two Show folders with one Title key are `ambiguous`.
- [ ] `groupShows` passes films through unchanged.

---

## Phase 8: Import — re-runs, year ranges, unnamed shows, the setup panel

**User stories**: 84, 85, 86, 87, 92, 93, 98

### What to build

A show whose Title key and year match a held series is **Already in
library**: only episodes with no held `(season, episode)` are copied in, and
the held metadata is not overwritten — which is how a new season joins. The
Sheet's Year cell accepts `2022`, `2019–2023`, `2019-2023` and `2021–`; a lone
year is a finished run, and a film row with a range keeps its first year. A
show no row names imports under `titleGuess` with a Warning line, never a
`no-row` Problem. A row's _Status_ is never applied to episodes. Import setup
gains _What the scanner accepts_ verbatim: the three shapes in mono with the
prototype's backslashes, and the folder-first rule.

### Acceptance criteria

- [ ] Re-running over a held show adds only missing episodes and leaves its
      metadata; a second run over the unchanged fixture adds nothing.
- [ ] `readSheet` reads the four year shapes; a film row with a range keeps its
      first year.
- [ ] An unnamed show imports under its guessed title with a warning.
- [ ] A watched Status on a show's row marks no episode.
- [ ] The setup panel matches the prototype word for word.

---

## Phase 9: The Series tab's filters

**User stories**: 7, 11, 12, 13, 14, 15, 16, 17, 24

### What to build

`GET /api/series` applies the existing query rules to series — search by
title, genre, minimum rating, and the five **Sort orders** (_Unwatched first_
meaning not fully watched) — and narrows the Continue row by the same query.
`GET /api/series/genres` counts genres in series, with the series total, and
feeds the genre dropdown on the Series tab. The count line counts what the
grid shows after the filters. A search that finds nothing reads _No series
match “q”._; filters that find nothing read _No series match these filters.
Try a different genre or rating._

### Acceptance criteria

- [ ] Search, genre, rating and each sort apply to series.
- [ ] The Continue row is narrowed by the same query.
- [ ] The Series tab's genre dropdown lists series genres counted in series.
- [ ] The count line agrees with the filtered grid.
- [ ] Both no-results faces read as the prototype does.
- [ ] The Movies tab's filters and genre list are unchanged.
