## Problem Statement

I am the maintainer, and my family are the people who use this app. The family
folder has always held TV shows beside the films — a show folder with a
`Season 01/` inside it, or a folder of loose `S01E03.mkv` files — and
FamilyFlix cannot hold any of them:

- **The importer mistakes a show for a film.** A season folder is a folder
  holding a video, so the walk makes it a **Source folder**; its twenty-two
  episodes become one film with twenty-two candidate videos, which is an
  `ambiguous` **Problem** or a single wrongly-titled film.
- **There is nowhere to browse a show.** The browse home is genre rows of
  films; there is no Series tab, no series page, no season, no episode.
- **The player can only play a film.** It is keyed on a movie id and wired to
  `/api/movies/:id/*`; an episode has no route, no resume position and no
  watched state, and when one ends nothing offers the next.
- **Watch state stops at the film.** "Which episode were we on?" is the one
  question a family asks of a show, and the app has no way to answer it.

The prototype revision of 2026-09-22 draws all of it (COMPONENT-SPEC §5aa):
a Movies / Series switch in the library header, a series page, a season page,
the season card and episode row, the episode title and an **Up next** card in
the player, and the scanner's accepted shapes in Import setup. It is step 5 of
the build order, the largest of the five left, and needs nothing Electron
adds.

## Solution

**A Series is the second kind of thing on the shelves, and everything about it
is additive** — the Movie flow, the walker and the `playback/` domain are
untouched.

- **In by import.** A **Show folder** — the parent of **Season folders**, or a
  folder whose videos carry an **Episode tag** — becomes one **Series** with
  its **Episodes**, copied into its own **Series folder** in managed storage.
  Season numbers come from the folder first, then the filename; episode
  numbers from the tag alone. A **Sheet** row whose title matches the show
  describes it; a show no row names still imports. Re-running the import adds
  the episodes the series lacks — that is how a new season joins. An episode
  nothing can number is a new `unplaced` Problem with Skip alone.
- **Browsed on its own tab.** `?tab=series` on the browse home: a Continue
  Watching row of **Episode continue cards** over _All series_, a count line
  and the same **Library grid** of **Poster cards**. The header's search,
  genre, rating and sort all apply.
- **A series page and a season page.** The movie page's hero shape for a
  series, over a grid of **Season cards**; a season page listing **Episode
  rows**, each with a watched box, plus _Mark season watched_ and the _Other
  seasons_ pills.
- **Played by the same player.** The **Player** takes a **Playable** — a movie
  or an episode — and every rule it holds (resume, the **Watch reporter**,
  the preferred subtitle language) applies unchanged. An episode's title reads
  `Show · S02E04 · Title`, and in its last 15 seconds an **Up next card**
  counts down to the next episode; _Cancel_ means it does not play.
- **Resume means one thing.** **Next episode** — the first part-watched, else
  the first unwatched, else the first — is answered once, on the server, for a
  series and for each season.

## User Stories

### Browsing series (the family)

1. As a parent, I want a Movies / Series switch at the top of the library, so that shows are never mixed into the film rows.
2. As a parent, I want the switch to show which tab I am on with the accent-filled pill, so that I always know whether I am looking at films or shows.
3. As a parent, I want switching tabs to clear my search but keep my genre, rating and sort, so that a film title I typed does not hide every show.
4. As a parent, I want the search box to read _Search your series_ on the Series tab, so that I know what it searches.
5. As a parent, I want the Series tab to show every series as a poster in one grid, so that I can see all our shows at once.
6. As a parent, I want a count line such as `3 series · 42 episodes` above the grid, so that I know how much there is to watch.
7. As a parent, I want the count line to count what the grid is showing after my filters, so that it agrees with what I see.
8. As a parent, I want a series with no poster to draw the same gradient art a film without one does, so that the grid never has a hole.
9. As a parent, I want a series every episode of which we have watched to carry the watched badge, so that finished shows stand out.
10. As a parent, I want to heart a series from its poster, so that I can mark the shows we love.
11. As a parent, I want to search series by title, so that I can find one show quickly.
12. As a parent, I want to filter series by genre, so that I can find a comedy when that is what we want.
13. As a parent, I want the genre dropdown on the Series tab to list the genres our series carry, counted in series, so that no choice leads to an empty page.
14. As a parent, I want to filter series by minimum rating, so that I can pick one of our favourites.
15. As a parent, I want the five sort orders to mean for series what they mean for films, so that _Unwatched first_ puts shows we have not finished at the top.
16. As a parent, I want _No series match “q”._ when my search finds nothing, so that I know it was the search and not an empty library.
17. As a parent, I want _No series match these filters. Try a different genre or rating._ when the filters find nothing, so that I know what to change.
18. As a parent, I want a library with no series to show the heading and `0 series · 0 episodes` and nothing else, so that the tab is honest rather than broken.
19. As a parent, I want Back from a series to land me on the Series tab, filtered and scrolled as I left it, so that I do not lose my place.

### Continue Watching on the Series tab

20. As a parent, I want a Continue Watching row on the Series tab with one card per show we are part-way through an episode of, so that I can pick up where we stopped.
21. As a parent, I want each card to read `Harbor & Vine · S02E04` with how far in we are, so that I know which episode it will play.
22. As a parent, I want the card to open the player on that episode directly, so that resuming is one click.
23. As a parent, I want the most recently watched show first, so that the one we were just watching is at the front.
24. As a parent, I want the row to follow my search and filters like every other shelf, so that it never shows a show the grid hides.
25. As a parent, I want the row to disappear when we are in the middle of nothing, so that the tab does not show an empty shelf.
26. As a parent, I want the Continue Watching row on the Movies tab to stay films only, so that the film shelves are unchanged.

### The series page

27. As a parent, I want a series page with the backdrop, the poster, the title, the years, the season and episode count and the stars, so that I can see what the show is at a glance.
28. As a parent, I want a finished show's years to read `2019–2023`, a single-year show `2022`, and a show still running `2021–`, so that I can tell which is which.
29. As a parent, I want the stars on a series drawn read-only, so that I do not change a rating by accident on a page that offers no rating picker.
30. As a parent, I want the series' genres shown as chips, so that I can see what kind of show it is.
31. As a parent, I want one _Resume S02E04_ button, or _Play S01E01_ for a show we have not started, so that I never have to work out which episode is next.
32. As a parent, I want Resume to play the part-watched episode first, else the first unwatched one, so that we pick up exactly where we left off.
33. As a parent, I want to heart the series from its page, so that I can favourite it without going back to the grid.
34. As a parent, I want a progress line — _Not started_, _5 of 22 episodes watched_, _All 22 episodes watched_ — so that I know how far through the show we are.
35. As a parent, I want the synopsis to expand from four lines, so that the page is tidy until I want to read more.
36. As a parent, I want _Created by_ and _Starring_ credits, so that I can see who made the show and who is in it.
37. As a parent, I want a grid of season cards, each reading _Season 2_ with "8 episodes" or "3 of 8 watched", so that I can see our progress season by season.
38. As a parent, I want a finished season to carry the watched badge and a part-watched one a progress bar, so that I can see which seasons are done.
39. As a parent, I want a season card to lift under my pointer and ring under the keyboard like a poster does, so that it feels like every other card.
40. As a parent, I want clicking a season card to open that season, so that I can see its episodes.
41. As a parent, I want a series that no longer exists to show the same not-found face a missing film does, so that a stale link is not a blank page.
42. As a parent, I want a series page opened directly, with nothing behind it, to go Back to the Series tab, so that Back always goes somewhere sensible.

### The season page

43. As a parent, I want a season page headed by the show's title over _Season 2_, so that I know which season I am in.
44. As a parent, I want _Resume E04_, or _Play E01_, for this season, so that I can pick up the season where we left it.
45. As a parent, I want a count line like `8 episodes · 3 watched`, so that I know how far through the season we are.
46. As a parent, I want one row per episode with its `S02E04` code and its title, so that I can find an episode by number or by name.
47. As a parent, I want an episode whose file carries no title to read _Untitled episode_, so that the row is never blank.
48. As a parent, I want each row to show how far into that episode we are, with a bar on its thumbnail, so that I can see which one we stopped in.
49. As a parent, I want clicking an episode row to play it, so that I can watch any episode directly.
50. As a parent, I want a watched box on each row that only marks it and never starts playback, so that I can tick off an episode we saw elsewhere.
51. As a parent, I want the box to flip at once and flip back if the save fails, so that it feels instant but never lies.
52. As a parent, I want _Mark season watched_ to mark every episode at once, and to read _Mark season unwatched_ once they all are, so that I can catch the app up after a binge.
53. As a parent, I want marking watched to forget the resume position, and marking unwatched to keep it, so that the rule is the same one films follow.
54. As a parent, I want _Other seasons_ pills to switch seasons in place, so that I can look through the seasons quickly.
55. As a parent, I want _Back to series_ to reach the series page however many seasons I have looked at, so that the pills never trap me in a history of seasons.
56. As a parent, I want an unknown season number to show the not-found face, so that a stale link is not a blank list.
57. As a keyboard user, I want each episode row to be one tab stop that Enter or Space plays, with its box a separate stop, so that I can play or mark from the keyboard.
58. As a parent, I want an episode row to lift and ring like a card, and its play glyph to appear on hover, so that it feels like the other cards.

### Episode playback

59. As a parent, I want the player to play an episode exactly as it plays a film, so that nothing new has to be learned.
60. As a parent, I want the player's title to read `Harbor & Vine · S02E04 · The Auction`, or `Harbor & Vine · S02E04` with no episode title, so that I know which episode is on.
61. As a parent, I want an episode to resume where we stopped it, so that we never re-watch the start.
62. As a parent, I want the player to save our place in an episode as it plays, and mark it watched near the end, so that the season page and the Continue row are right afterwards.
63. As a parent, I want an episode to pick our preferred subtitle language, so that subtitles behave the same for shows and films.
64. As a parent, I want an episode whose file is gone to show the player's missing-file notice, so that I know why nothing plays.
65. As a parent, I want Back from an episode to land on its season page, or wherever I came from, so that I am never lost after watching.

### Up next

66. As a parent, I want an _Up next_ card in an episode's last 15 seconds naming the next episode, so that I know what comes next.
67. As a parent, I want the card to count down to the end of the episode, so that I know how long before the next one starts.
68. As a parent, I want the next episode to play by itself when the countdown ends, so that we can watch a run of episodes without touching anything.
69. As a parent, I want _Play now_ to mark this episode watched and start the next at once, so that we can skip the credits.
70. As a parent, I want _Cancel_ to hide the card and stop the next episode from playing, so that the evening can end on this one.
71. As a parent, I want the last episode of a show to end and return me to the season, so that the player does not sit on a black screen.
72. As a parent, I want the next episode to follow on across a season boundary, so that the last episode of season 1 leads to the first of season 2.
73. As a parent, I want Back after several episodes played through to reach the season page in one step, so that auto-play never fills my history.
74. As a parent, I want no Up next card on a film, so that films behave as they always have.

### Importing shows (the maintainer)

75. As the maintainer, I want a folder containing `Season 01/`, `Season 02/` folders to import as one series, so that my existing show folders work as they are.
76. As the maintainer, I want `Season 01`, `Season 1` and `S01` all to count as season folders, so that I need not rename them.
77. As the maintainer, I want a folder of loose `S01E03.mkv` files to import as one series too, so that the second shape I use works.
78. As the maintainer, I want the season number from the folder to win over the one in the filename, so that a file named in the wrong season still lands in the folder's.
79. As the maintainer, I want `S01E03` and `1x03` both read as episode tags, so that files from different sources both number.
80. As the maintainer, I want a multi-episode file such as `S01E01E02` to take its first number, so that it imports rather than failing.
81. As the maintainer, I want the episode title read from the filename after the tag, with dots and underscores as spaces and quality tags dropped, so that `Show.S01E03.The.Long.Fare.1080p.mkv` reads _The Long Fare_.
82. As the maintainer, I want every other folder to import as a film exactly as it does today, so that shows change nothing about films.
83. As the maintainer, I want a Sheet row whose title matches a show to describe it — title, years, genres, synopsis, rating, cast and its Director column as the creator — so that my existing spreadsheet needs no new column.
84. As the maintainer, I want the Year cell to accept `2022`, `2019–2023`, `2019-2023` and `2021–`, so that a show's run reads from the sheet.
85. As the maintainer, I want a film row with a year range to keep its first year, so that a range typed on a film is not lost.
86. As the maintainer, I want a show no row names to import anyway under a title guessed from its folder, with a warning, so that a show is never dropped for want of a row.
87. As the maintainer, I want a row's watched Status not applied to a show's episodes, so that a column written for a film does not mark twenty episodes.
88. As the maintainer, I want a subtitle beside an episode whose name begins with that episode's filename to belong to it, with its language detected, so that subtitles carry over.
89. As the maintainer, I want a subtitle that belongs to no episode to be a warning, not a problem, so that the run is not stopped by a stray file.
90. As the maintainer, I want each episode to move the progress bar and read `Harbor & Vine · S01E03` as the current item and in the log, so that a long show is not one long stall.
91. As the maintainer, I want the console's existing copy kept word for word, so that the screen is the one the prototype draws.
92. As the maintainer, I want re-running the import over a show already held to add only the episodes it lacks, so that dropping a new season in the folder and importing again is how a season joins.
93. As the maintainer, I want re-running the import not to overwrite a series' metadata, so that the rule matches films.
94. As the maintainer, I want an episode that no rule can number, or a second file claiming a taken number, listed as _Unplaced_ with a reason telling me to rename it and import again, so that I know the fix.
95. As the maintainer, I want an Unplaced row to offer Skip and no Resolve, so that I am not sent into a form that cannot take an episode.
96. As the maintainer, I want two show folders with the same title to be the existing _Ambiguous_ problem, so that one rule covers both kinds.
97. As the maintainer, I want a show all of whose videos are Unplaced to import nothing and file only those, so that no empty series appears.
98. As the maintainer, I want Import setup to show _What the scanner accepts_ — the three on-disk shapes and the folder-first rule — so that I can check my folders before starting.
99. As the maintainer, I want each series stored in its own folder in managed storage, beside the films and in the same namespace, so that two titles never collide and the storage report counts both.
100.  As the maintainer, I want an episode's runtime derived from its file after the copy, so that resume percentages have something to divide by.
101.  As the maintainer, I want the dev fixture to include one show in both shapes and a row naming it, so that a dev library shows series after one import.

## Implementation Decisions

### Scope

- One initiative, `series`, carrying all three parts of step 5 — **Series
  (TV)**, **Episode playback** and **Series import** — because none is usable
  alone.
- Everything the prototype does not draw is not built (see Out of Scope).

### Schema — migration 4

- **`series`**: `id`, `tmdb_id`, `title`, `year`, `end_year`, `synopsis`,
  `creator`, `cast` (JSON, like the movie's), `rating` (0–10, the movie's
  `CHECK`), `is_favorite`, `poster_path`, `backdrop_path`, `created_at`,
  `updated_at`. No watch columns.
- **`episodes`**: `id`, `series_id` (`ON DELETE CASCADE`), `season_number`,
  `episode_number`, `title` (nullable), `air_date` (nullable ISO date),
  `runtime_minutes` (nullable), `watched`, `resume_position_seconds`,
  `last_watched_at`, `video_path`, `created_at`, `updated_at`,
  `UNIQUE (series_id, season_number, episode_number)` — the movie's watch trio
  exactly, so the Watch reporter's rules transfer untouched.
- **`series_genres`** mirrors the movie join; **`episode_subtitles`** mirrors
  `subtitles` with `episode_id` for `movie_id`.
- ❌ A `seasons` table — a season is `season_number` on its episodes; nothing
  about a season is stored. ❌ One subtitles table with two nullable owners.
- `movies` is not altered.

### Derived state

- An episode's `WatchStatus` is the movie's derivation. A season is complete
  when every episode is watched and in progress when some are; a series is
  watched when every episode is. Never stored.
- **`nextEpisodeOf`** — a pure unit in the library's `series/` area over an
  ordered episode list: the first part-watched, else the first unwatched, else
  the first. Answered once, server-side, for a series and for each season. No
  client copy.
- **Year range**: `end_year = year` draws `2022`; a later `end_year` draws
  `2019–2023`; `null` draws `2021–`; no `year` drops the segment.

### Shared types (both build targets)

- A new series type module beside the movie types: `Series` (id, tmdbId,
  title, year, endYear, synopsis, creator, cast, rating, isFavorite,
  posterPath, backdropPath, genres, createdAt, updatedAt), `Episode` (id,
  seriesId, season, number, title, airDate, runtimeMinutes, watched,
  resumePositionSeconds, status, videoPath, subtitles, lastWatchedAt),
  `SeasonSummary { number, episodes, next }`, `SeriesDetail { series, seasons,
next }`, `SeriesHomePayload { continueWatching, series, episodeCount }` and
  `EpisodeRead` (the episode, its series' title and id, and the next episode's
  `{ id, season, number, title }` or `null`).
- The player's **`Playable`** — `{ kind: 'movie' | 'episode'; id }`.
- `ProblemKind` gains `unplaced`.

### Server — library

- The series' storage lives in a `series/` area inside the library domain,
  one folder per unit like its siblings (read, browse, watch, curation,
  nextEpisodeOf); `LibraryStorage` grows the series methods. ❌ A fifth domain
  folder.
- Browse applies the existing query rules — search, genre, minimum rating, the
  five **Sort orders** (_Unwatched first_ meaning not fully watched) — to
  series. The Continue row is one entry per series for its earliest
  part-watched episode, ordered by `last_watched_at`, capped at 15, narrowed
  by the same query.

### Server — routes (the HTTP layer only)

- `GET /api/series?q&genre&rating&sort` → `SeriesHomePayload`, parsed by the
  existing library-query parser.
- `GET /api/series/genres` → `GenreCount[]` counted in series, with the series
  total.
- `GET /api/series/:id` → `SeriesDetail`; `404` when absent.
- `POST /api/series/:id/favorite { value }` — a **Single-signal write**.
- `POST /api/series/:id/seasons/:n/watched { value }` — every episode of the
  season; watched zeroes the resume position, unwatched clears `watched` only.
- `GET /api/episodes/:id` → `EpisodeRead`.
- `/api/episodes/:id/{playback,stream,subtitles/:sid,resume,watched}` — the
  movie routes' handlers shared over a lookup of the **Stored path**, so the
  `playback/` domain never learns there are episodes.

### Server — media and import

- **`episodeTag`** in the media domain, beside `fileKinds`: a filename →
  `{ season, episode, title } | null`. Reads `S01E03` and `1x03`; a
  multi-episode file takes its first number; the title is the text after the
  tag with dots and underscores as spaces and quality tags dropped, else
  `null`.
- **`groupShows`** in the import-export domain, beside `matchRows`, pure over
  the scans: a Source folder named as a **Season folder** (`Season 01`,
  `Season 1`, `S01`) belongs to its parent **Show folder**; a Source folder
  whose videos carry an Episode tag is itself a Show folder; everything else is
  a movie scan. `walkLibraryRoot` is untouched.
- Numbers: the Season folder's number wins over the tag's; the episode number
  comes only from the tag.
- Subtitles: a subtitle belongs to the episode whose video's stem its name
  begins with, its language through `detectSubtitleLanguage`; one matching no
  stem is a **Warning line**.
- Matching: the movie's **Match rule** over the Show folder's name — Title key
  and `yearInName` against every Sheet row. A matched row supplies title,
  years, genres, synopsis, rating and cast; its _Director_ is the creator; its
  _Status_ is not applied. No new column.
- `readSheet`'s Year cell accepts a lone year, a range with en dash or hyphen,
  and an open range; a lone year is a finished run. A movie row with a range
  keeps its first year.
- A show no row names imports under `titleGuess` with a Warning line. ❌ A
  `no-row` Problem for a show — its Resolve opens a form that cannot take a
  series.
- A show whose Title key and year match a held series is **Already in
  library**: only episodes with no held `(season, episode)` are copied in; held
  metadata is not overwritten.
- **`unplaced`** — a new hard Problem: an episode video no rule can number, or
  a second file claiming a taken number. The reason names the fix (_rename it
  `S01E03` and import again_); Skip only, no Resolve. A show whose every video
  is unplaced imports nothing.
- Two Show folders with one key are the existing `ambiguous`.
- The run counts each episode as one item; the current item and its `success`
  log line read `Harbor & Vine · S01E03`. The console's existing copy is kept
  verbatim.
- A **Series folder** is reserved by the same `reserveFolder` from the series'
  title and first year, one namespace with Movie folders; episodes under
  `season-01/` by `safeFilename`; poster and backdrop at its top.
- Episode runtime is the **Derived runtime** after the copy, best-effort.
- The fixture gains one show in both shapes (`Season 01/` and loose) and a row
  naming it, in both `library.xlsx` and `library.csv`.

### Frontend — the Series tab

- `tab=series` on `/`, written by the existing query-param writer as a
  `replace`, omitted at `movies`. ❌ A `/series` route.
- **`LibraryTabs`** in the library feature: first in the header's start slot,
  the prototype's pill track, two buttons with `aria-pressed` in a group
  labelled _Library_, on `controlStates`. ❌ `role="tablist"`.
- Switching clears the search and keeps genre, rating and sort; the placeholder
  reads _Search your series_ on the Series tab.
- The tab's body lives in the library feature (`SeriesHome`, `useSeriesHome`,
  `EpisodeContinueRow`), chosen off `tab` inside the feature — the page holds
  no logic.
- _All series_ is `LibraryGrid` of unchanged `PosterCard`s fed a
  `PosterCardMovie` built from the series (title, art or Gradient fallback off
  the series id, rating, `watched` when every episode is, `progress` 0,
  `favorite`). The count line counts series (invariant) and episodes
  (pluralised) over what the grid shows. No Favorites row, no genre rows.
- The **Episode continue card** is a Continue card reading `Series · S02E04`
  over the **Resume label**, opening the player.

### Frontend — the series and season pages

- **`/series/:id`** — `SeriesPage` composing the series feature's
  `SeriesDetail` organism (owning `useSeriesDetail`, the movie page's **Load
  state** and not-found face). **Landing** `/?tab=series`.
- **`/series/:id/season/:n`** — `SeasonPage` composing `SeasonEpisodes`,
  reading the same series read; an unknown season is the not-found face.
  **Landing** the series page.
- One read for both pages, each deriving its view through a pure mapper
  (`seriesView`, `seasonView`), the `detailView` precedent.
- The hero is the prototype's 1:1, with its own `SeriesMetaLine` (year range,
  counts, read-only `StarRating showValue`) because the movie's `MetaLine` is
  built around the picker and the Watched badge.
- **`CreditsRow` graduates to `components/`**, the first credit's label a prop
  (_Director_ / _Created by_).
- **`SeasonCard`** in `components/`: the prototype's props (`season { number,
label?, episodeCount, watchedCount }`, `onOpen`) plus the gradient pair; a
  **Card** on `cardLift` / `cardFocus`; `StatusBadge` when complete,
  `ProgressBar` when part-watched. `label` is never filled.
- **`EpisodeRow`** in `components/`: the prototype's props, on `PosterCard`'s
  pattern (`role="button"`, a tab stop, a label, a key handler); a **Card** on
  the shared fragments — ❌ the file's own −2px lift and fill change. The
  watched box is a **Control** (`controlStates('scale(.92)')`, the 1.08 swell
  and accent border) and stops propagation. The play glyph is hover-only; the
  thumbnail is the series' gradient.
- Marking: the episode box and _Mark season watched_ / _unwatched_ are
  optimistic, put back on refusal — the `useOptimisticEdit` precedent.
- _Other seasons_ pills are drawn as the prototype draws them (not a
  primitive) and are a **Sideways move** — a `replace`.
- _Mark season watched_ is `Button` `secondary` `sm` if it measures the
  prototype's 38px, else a `styled(Button)`.
- Air dates are drawn `Mar 4, 2019` when present and empty when `null` (always,
  until Enrichment).

### Frontend — the player

- **`/episode/:id/play`** — the same `PlayerPage` given `kind="episode"` by the
  route table. **Landing** the episode's season page.
- The `Player` takes a **Playable** in place of `movieId`; reads and writes run
  over `/api/movies/:id/*` or `/api/episodes/:id/*`. Resume, the Watch
  reporter's ticks and 95% finish, and the Preferred subtitle language apply
  unchanged. ❌ A second player.
- The title reads `Series · S02E04 · Title`, or `Series · S02E04` without one.
- **`UpNextCard`** in the player feature, drawn 1:1 (372px, 28px from the
  right, 150px up, `ffPop`): shown while there is a next episode, the family
  has not cancelled, and 15s or less remain; the countdown is the time left
  rounded up. _Play now_ marks this episode watched and moves on; _Cancel_
  hides the card for this episode. At `ended`: a next, uncancelled episode
  plays; no next episode is a **Leaving**; a cancelled one stays. ❌ The
  simulation's Cancel that still auto-plays.
- Moving to the next episode is a **Sideways move** — `replace`.

### Shared units

- Route helpers in `utils/`, one per folder, `moviePath`'s precedent:
  `seriesPath`, `seasonPath`, `episodePlayPath`.
- Shared wire in `api/`, because two features ask: `saveSeriesFavorite` (the
  tab's grid and the series page) and `saveEpisodeWatched` (the season page's
  box and the player's _Play now_). `saveSeasonWatched`, `fetchSeriesDetail`,
  `fetchSeriesHome` and `fetchEpisode` have one caller each and stay in their
  feature.

### Import setup panel

- _What the scanner accepts_, verbatim: the three shapes in mono with the
  prototype's backslashes, and "numbers come from the folder first, then the
  filename (`S01E03`, `1x03`)".

## Testing Decisions

- A good test observes behaviour through a unit's public interface — a
  filename in and a tag out, scans in and shows out, a request in and a body
  out, a rendered screen and what the family can click — never the SQL, the
  hook's internals or a component's styles. jsdom computes no `:hover`,
  `:active` or `:focus-visible`, so no test asserts a Card's lift or a
  Control's ring.
- **Pure units, tested exhaustively:**
  - `episodeTag` — both tag shapes, case, multi-episode, title extraction with
    dots, underscores and quality tags, no tag. Prior art: `fileKinds`,
    `detectSubtitleLanguage`.
  - `groupShows` — Season folders under a parent, loose episodes, the folder's
    number winning, subtitles by stem, unplaced files and duplicate numbers,
    films passing through unchanged. Prior art: `matchRows`.
  - `nextEpisodeOf` — each arm, across seasons, an empty list.
  - `readSheet`'s year ranges — the four shapes, a film row with a range.
    Prior art: its existing suite.
  - `seriesView`, `seasonView` — year range, count and progress lines, Resume
    labels, the title line. Prior art: `detailView`, `importView`.
  - `seriesPath`, `seasonPath`, `episodePlayPath` — Prior art: `moviePath`.
- **Storage** — migration 4 on a fresh and a migrated database; browse with
  each filter and sort; the Continue row's one-per-series rule, order and cap;
  season and episode watched writes with the movie's semantics; the detail
  read's derived state. Prior art: the library's existing storage suites over
  an in-memory database.
- **Routes** — every new route's status codes and bodies, and the episode
  playback routes sharing the movie handlers. Prior art: the existing route
  suites with `fixedSlot` and the fixture video.
- **Importer** — end to end over the extended fixture: a show in both shapes
  becomes one series with numbered episodes and subtitles; a show with no row
  imports with a warning; a re-run adds only missing episodes; unplaced
  episodes are Problems with no Resolve. Prior art: `createImporter`'s suite
  over `libraryFixture`.
- **Components** — `SeasonCard` (badge, bar, the two lines, `onOpen`),
  `EpisodeRow` (the box does not open the row, Enter and Space play, _Untitled
  episode_), graduated `CreditsRow` (the label prop). Prior art: `PosterCard`,
  `ContinueCard`.
- **Features** — `LibraryTabs` (`aria-pressed`, the `replace`, search cleared
  and filters kept); the Series tab (sections, count line, empty and
  no-results faces); `SeriesDetail` and `SeasonEpisodes` (load, not-found,
  Resume, optimistic marks put back on refusal, the season pills as a
  `replace`, Back to Landing); the `Player` given an episode (title line,
  Landing, wire chosen by kind); `UpNextCard` (shown at 15s, countdown, Play
  now, Cancel, the three `ended` outcomes, the `replace`). Prior art:
  `MovieDetail`, `Player`, `useGoBack` with `LocationProbe` for navigation
  type.
- The existing movie suites stay green untouched — the proof that everything
  is additive.
- The build's own check is visual: the prototype files side by side with the
  running app, over a dev library filled from the extended fixture.

## Out of Scope

- An Add / Edit / Delete for a series — no series form, no ⋯ menu on the
  series page, no Danger row. **Flagged for a prototype amendment**.
- A series in **Export**.
- Season posters, specials (season 0), air dates and episode stills — nothing
  offline supplies them.
- Skip-intro and an in-player episode list (§5aa rules both out).
- Series in the Movies tab's search, its genre rows or its **Favorites row**; a
  Favorites row on the Series tab.
- A Continue card for an unstarted next episode after a finished one.
- Applying a Sheet row's _Status_ to episodes.
- Resolve on an `unplaced` Problem.
- The Storage report's title count, which stays `movieCount`.
- Renaming `PosterCardMovie` — flagged.
- Anything **Enrichment** adds (step 6): `tmdb_id`, air dates, episode titles
  from TMDB.

## Further Notes

- Design log: `docs/design-logs/22-series.md` (initiative `series`), run
  against prototype revision `1a9a656` and code at `ff9975c`.
- Glossary: the _Series_ section of `docs/ubiquitous-language.md`, and the
  **Sideways move** added to the **Back rule** as its third shape.
- Build order: step 5, after Motion (4), ahead of Enrichment (6) and the
  Electron shell (7).
- Suggested slices, per the log's plan: (1) tracer — migration 4,
  `episodeTag`, `groupShows` for Season folders, the importer writing a series,
  `GET /api/series`, `LibraryTabs` and the _All series_ grid; (2) the series
  page; (3) the season page; (4) episode playback and the Series tab's Continue
  row; (5) Up next; (6) import complete — loose episodes, subtitles, merging,
  `unplaced`, year ranges, the setup panel, and the tab's filters and genre
  list; then the refactor, and only then README and CLAUDE.md ticked.
- Known trade-offs: without a series form, a wrong title is fixed in the sheet
  and re-imported and a series cannot be deleted from the app; an `unplaced`
  episode needs a rename on disk.
