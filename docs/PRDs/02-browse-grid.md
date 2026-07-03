## Problem Statement

My parents open FamilyFlix and see nothing to browse. The library-core
backend is done — movies, genres, ratings, watch state, and favorites all
live in SQLite behind `createSqliteStorage` — but there is no screen. `src/`
is still the Nx welcome scaffold: no design tokens, no primitives, no
components, no router, no way to look at the collection. Everything my
parents will ever touch starts with a home screen that shows them what we
own, organized the way a movie library should be: by genre, as rows of
posters they can glance across and click into.

This is also the **first frontend feature** in the project, so "show a home
screen" really means "stand up the whole front of the app" — the token
system, the theme, the first primitives, the first HTTP route layer, and
routing — without dragging in the five neighbouring features (search,
filter, sort, Continue Watching, Favorites row, back-to-top FAB) that the
prototype happens to draw on the same screen.

## Solution

Build the **Browse home** (`/` → `LibraryPage`): a scrollable screen that
lists one **Genre row** per populated genre, alphabetically. Each Genre row
is a titled horizontal **Card carousel** of up to 15 **Poster cards** with a
"View all {count}" link to that genre's full page. Each Poster card shows the
movie's poster (or a deterministic gradient fallback until posters are
imported), title, star rating, watched badge or in-progress progress bar,
and a working favorite heart.

The screen reads real SQLite data over a real HTTP layer. A single aggregate
`GET /api/home` returns one row per populated genre (`{ genre, count,
movies[≤15] }`); the frontend maps each `Movie` to a small `PosterCardMovie`
view model and renders it. Cards and "View all" links navigate through real
`react-router-dom` routes to placeholder detail/genre/settings pages that
echo their param, so the screen is fully wired and every destination feature
later drops in behind a stable URL.

Scope is drawn tightly around the poster-card render path. We build only the
tokens, theme, primitives, and one molecule (`PosterCard`) that this screen
transitively needs. The header is partial (logo + gear → Settings), and the
Continue Watching row, Favorites row, search/filter/sort controls, and FAB
are deliberately left to their own features. The prototype
(`page.LibraryPage.dc.html`) stays the visual goal; this is the first,
honest slice of it.

## User Stories

1. As a parent, I want to open FamilyFlix and immediately see our movies
   laid out as rows of posters, so that browsing feels like a streaming app,
   not a spreadsheet.
2. As a parent, I want the movies grouped into genre rows, so that I can find
   something in a category I'm in the mood for.
3. As a parent, I want the genre rows in a predictable (alphabetical) order,
   so that the same genre is always in the same place.
4. As a parent, I want each row to scroll horizontally with left/right
   arrows, so that I can page through a genre without a mouse wheel.
5. As a parent, I want the scroll arrows to disappear at the start/end of a
   row and when a row doesn't overflow, so that I'm never offered a dead
   control.
6. As a parent, I want to still scroll a row with my trackpad or mouse wheel,
   so that I'm not forced to use the arrow buttons.
7. As a parent, I want each poster card to show the movie's title and star
   rating, so that I can judge a movie at a glance.
8. As a parent, I want a movie I've finished to show a watched check badge, so
   that I know I've already seen it.
9. As a parent, I want a movie I'm partway through to show a progress bar on
   its poster, so that I can tell what I've started but not finished.
10. As a parent, I want to click a poster and be taken to that movie, so that
    I can read about it or play it.
11. As a parent, I want to mark a movie as a favorite straight from its poster
    by clicking the heart, so that I don't have to open it first.
12. As a parent, I want the heart to fill in immediately when I click it, so
    that the app feels responsive even before it saves.
13. As a parent, I want clicking the heart to NOT open the movie, so that
    favoriting and opening stay separate actions.
14. As a parent, I want a "View all {count}" link on each genre row showing
    the true total, so that I know a genre has more than the 15 posters shown
    and can see them all.
15. As a parent, I want "View all" to take me to that genre's full page, so
    that I can browse the entire genre when 15 isn't enough.
16. As a parent, I want a movie with no imported poster to still show an
    attractive colored tile with its title, so that the library never looks
    broken or empty before posters are downloaded.
17. As a parent, I want the same movie to always get the same fallback color,
    so that the library looks stable, not random, between visits.
18. As a maintainer, I want the gear icon to take me to Settings, so that I
    can reach maintenance tasks from the home screen.
19. As a maintainer, I want clicking the FamilyFlix logo to return me to the
    home screen, so that I always have a way back.
20. As a parent, I want a brief loading state (skeleton rows) while the
    library loads, so that the screen doesn't flash blank.
21. As a maintainer, I want a clear "your library is empty" message the first
    time I run the app before importing anything, so that I understand there's
    nothing wrong — I just haven't added movies yet.
22. As a maintainer, I want the empty-library message to be distinct from a
    search-with-no-results message, so that "nothing imported yet" and
    "nothing matched" don't read as the same problem.
23. As a maintainer, I want a retryable error message if the library fails to
    load, so that a transient backend hiccup doesn't leave me stuck.
24. As a parent, I want a favorite that fails to save to visibly revert, so
    that the heart never lies about what's actually saved.
25. As a parent, I want a movie in more than one genre to appear in each of
    those genre rows, so that a comedy-thriller shows up under both.
26. As a maintainer, I want a genre with zero movies to not appear as an empty
    row, so that the home screen only shows genres I actually own movies in.
27. As a parent, I want the star rating on an unrated movie to render as empty
    stars rather than a crash or a blank, so that every card looks complete.
28. As a parent scrolling a long library, I want the header to stay usable and
    the page to scroll smoothly, so that many genre rows don't make the screen
    feel heavy.
29. As a maintainer, I want the browse home to work fully offline against
    local SQLite, so that the app never depends on the network to show the
    library.
30. As a developer, I want card and "View all" clicks to route to real (if
    placeholder) pages that echo their id/name, so that navigation is
    verifiable now and the real pages slot in behind stable URLs later.

## Implementation Decisions

**Frontend foundation (scoped to the poster-card render path).** This
feature stands up the first real `src/` layers, but only what `PosterCard`
transitively needs:

- `tokens/` — colors, spacing, typography, radius, breakpoints, translated
  from `docs/handoff/tokens.css` into a `theme` object.
- `styles/` — global reset + styled-components `ThemeProvider`.
- `primitives/` — `StarRating`, `StatusBadge`, `ProgressBar`, and the `Icon/`
  set needed here (`IconBase`, `HeartIcon`, `HeartOutlineIcon`, plus the
  carousel/gear chevron + gear glyphs). Header/player/form-only primitives
  (`Button`, `TextField`, `Textarea`, `Chip`, `Toggle`, `IconButton`,
  `SearchBar`, `FilterDropdown`, `ContinueCard`, `Fab`) are **deferred** to
  the features that own them.
- `components/` — `PosterCard` only.
- `features/library/` — `CardCarousel`, `GenreRow`, a `useHomeRows` hook, and
  the `view(movie)` mapper.
- `pages/` — real `LibraryPage`; placeholder `MoviePage` / `GenrePage` /
  `SettingsPage` that render the routed param.
- `types/` — `PosterCardMovie` (promoted from the prototype) and `HomeRow`.
- `utils/` — `gradientFromId`, `toRatingPercent`, `toProgressPercent` (pure).

**Deep module — the view mapper (`Movie` → `PosterCardMovie`).** The one
logic-bearing seam on the frontend, kept pure and tested in isolation:

- `rating = (units ?? 0) * 10` → 0–100 percent for `StarRating`. Unrated
  (`null`) maps to 0 stars — visually identical to a literal 0 on the card
  (accepted, flagged in ubiquitous-language for the detail/edit grill).
- `progress = clamp(resumeSeconds / (runtimeMinutes * 60) * 100, 0, 100)`.
  When `runtimeMinutes` is `null`, render a **nominal sliver** — a small
  fixed progress length that preserves the in-progress signal without
  faking a real percentage.
- `posterUrl = posterPath ? \`${API}/api/images/${posterPath}\` : null`; a
null `posterUrl`triggers the`gradientFromId(id)` fallback (`g1/g2`).
- `favorite`, `watched` map straight through.

**Backend additions (thin routes: parse → domain → JSON).**

- Add `limit?: number` to `MovieQuery`, pushed into SQL as `LIMIT ?` in the
  existing `listMovies` builder. This touches the "done" library-core seam by
  design.
- `GET /api/home` → `[{ genre: string, count: number, movies: Movie[] }]`.
  The handler calls `listGenres()` (already returns genres with ≥1 movie,
  alphabetical, with counts) then, per genre, `listMovies({ genre, sort:
'recently-added', limit: 15 })`. One aggregate request → one loading
  transition; no N+1 from the client.
- `GET /api/movies?genre=&sort=&limit=` → `Movie[]` — generic browse endpoint,
  retained for the future GenrePage. Not consumed by the home screen itself.
- `POST /api/movies/:id/favorite` → `{ value }` — calls `setFavorite`.
- `GET /api/images/*` → static serve of the managed image cache, so a stored
  relative `posterPath` resolves to a browser-loadable URL. Serves gradients
  in practice today (nothing imported yet); lights up automatically when
  import populates the cache — no card rework.

**Data flow.** `LibraryPage` → `useHomeRows` → `GET /api/home` →
`listGenres()` + `listMovies(limit:15)` → SQLite. The hook maps each `Movie`
through `view()` into `PosterCardMovie`, groups into `HomeRow`s, and hands
them to `GenreRow` → `CardCarousel` → `PosterCard`. Poster `<img>` hits
`GET /api/images`; the heart toggles optimistically and calls
`POST /api/movies/:id/favorite`.

**States (reuse the prototype's centered `--color-text-faint` message
layout).**

- **loading** → skeleton genre rows (rarely flashes against local SQLite).
- **empty library** (`listGenres()` returns `[]`) → a dedicated "your library
  is empty" message, distinct copy from the prototype's search-miss text.
- **error** → minimal retryable "Couldn't load your library. Retry."
- The prototype's search-miss "Nothing here" copy is **left for the search
  feature**, not wired here.

**Routing (`react-router-dom` v6).** `/` → real `LibraryPage`.
`/movie/:id`, `/genre/:name`, `/settings` → placeholder pages echoing the
param. Card `onOpen` → `/movie/:id`; "View all" → `/genre/:name`; gear →
`/settings`; logo → `/`.

**Carousel behavior (from the prototype).** Horizontal overflow scroller with
paged left/right arrow buttons (~80% of client width per page). Arrows
auto-hide at the start/end and when the row doesn't overflow; native
wheel/trackpad scroll always works. `CardCarousel` takes a `variant`
(`'poster' | 'continue'`) but only `poster` is exercised here — the
`continue` path exists in the prototype and is left inert until the Continue
Watching feature.

**No TMDB, no image cache population, no global store.** The library-core
schema already _is_ the TMDB cache; browse-grid is a pure offline SQLite
read and touches no TMDB key. TMDB fetch + genre-vocabulary mapping belong to
the media/metadata layer behind Add-movie / Bulk-import (an unowned
feature-list gap — flagged in the design log). A global store/context is
deferred until a second feature shares state.

## Testing Decisions

A good test here asserts **external behavior**, not implementation detail: it
pins what a consumer observes (the mapped view model, the aggregation shape,
the callbacks a card emits) and stays green through refactors of how that
result is produced. Prior art: `server/src/library/browse/browse.test.ts`
(query-builder behavior over a seeded in-memory SQLite `createSqliteStorage`)
and the existing `read`/`watch`/`curation` module tests.

**Backend (confirmed scope — the new logic, not a full REST suite):**

- `MovieQuery.limit` at the `listMovies` seam — a `limit` caps the returned
  rows and combines with genre/sort, tested in the `browse.test.ts` style
  against seeded data. Absent `limit` returns all rows (regression guard).
- The `GET /api/home` handler's aggregation — one row per populated genre,
  each with ≤15 movies sorted recently-added, and `count` reflecting the
  genre's true total from `listGenres()` (not the capped 15). One focused
  test; **no** exhaustive HTTP coverage of `/api/movies`, `/favorite`, or
  `/images` this round.

**Frontend (CLAUDE.md mandates a test for every `src/utils/` function):**

- `gradientFromId` — deterministic (same id → same stops), well-formed
  output, reasonable spread across ids.
- `toRatingPercent` — `units * 10`; `null` → 0.
- `toProgressPercent` — percent of runtime, clamped to [0,100]; `null`
  runtime → the nominal sliver value; already-watched / zero-resume handled.
- `view(movie)` mapper — the edge cases: unrated → 0 stars, null-runtime →
  nominal sliver, poster present → `posterUrl` vs null → gradient, favorite /
  watched pass-through.
- `PosterCard` — interaction callbacks only: `onOpen` fires on card click, and
  the favorite heart calls `onToggleFav` **and stops propagation** so it does
  not also fire `onOpen`.

Presentational-only pieces with no branching (`CardCarousel` arrow
math, `GenreRow`, skeletons) are verified against the prototype this round
rather than unit-tested.

## Out of Scope

- **Search / filter / sort controls** — the header's SearchBar and three
  FilterDropdowns are their own features; the header here is logo + gear only.
- **Continue Watching row** and **Favorites row** — their own features. The
  favorite _heart on the card_ is delivered here; the Favorites row and
  mark-from-detail remain 🔜.
- **Back-to-top FAB** — its own feature.
- **The real MoviePage, GenrePage, SettingsPage** — placeholders only this
  round; the generic `GET /api/movies` endpoint is stood up for the future
  GenrePage but not consumed yet.
- **TMDB fetch + image cache population + genre-vocabulary mapping** (our 12
  seeded genres vs TMDB's 19) — media/metadata layer behind Add-movie /
  Bulk-import; unowned in the feature list (flagged). TMDB columns grow later
  via migration #2 when the writer is built. Every card shows the gradient
  fallback until then — expected.
- **Global store / context** — deferred until a second feature shares state.
- **Electron shell / server-as-utility-process** — dev runs Vite ↔ Express on
  :3001.
- **Full REST test suite** — explicitly deferred (see Testing Decisions).

## Further Notes

- The screen is intentionally **not** a pixel-match of `page.LibraryPage`
  until the neighbouring features land (no search/filter/sort, no
  Continue/Favorites rows, no FAB). This is an honest first slice of the
  prototype, not a redesign — the prototype stays the goal and later features
  fill it in behind the same surface.
- Two card ambiguities are accepted and flagged for the detail/edit grill:
  unrated vs. a literal 0-star rating look identical on the card, and a
  null-runtime in-progress movie shows a nominal sliver rather than a true
  percentage.
- Suggested build order (from the design log): (1) thinnest slice — one real
  card end to end from a hardcoded model (tokens, theme, `PosterCard` + its
  primitives, view mapper + utils, tested); (2) backend seam — `limit` +
  routes; (3) rows + page — `CardCarousel`, `GenreRow`, `LibraryPage` shell +
  partial header + `useHomeRows`, with skeleton/empty/error states; (4)
  routing + interactivity — router, placeholder pages, navigation, optimistic
  favorite toggle.
- Ubiquitous-language terms this feature realizes: **Browse home**, **Genre
  row**, **Card carousel**, **Poster card**, **View all**, **Home payload**,
  **Gradient fallback**, **Poster URL**, **Card view model**, **Nominal
  sliver**.
