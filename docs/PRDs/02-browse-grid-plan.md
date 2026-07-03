# Plan: Browse Grid (genre-rows home screen)

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/10

The **first frontend feature**: render the genre-rows browse home against real
SQLite over a real HTTP layer. Because `src/` is still the Nx welcome scaffold,
this feature also stands up the frontend foundation (tokens, theme, the first
primitives), the first `server/src/routes/` layer, and routing — scoped strictly
to what the poster-card render path transitively needs. The five neighbouring
features the prototype draws on the same screen (search, filter, sort, Continue
Watching row, Favorites row, back-to-top FAB) are deliberately left to their own
features; `page.LibraryPage.dc.html` stays the visual goal, and this is the
first honest slice of it.

Phases 1 and 2 are intentionally not end-to-end — Phase 1 is UI-only (a
hardcoded model in a harness) and Phase 2 is backend-only. This is the
bootstrapping cost of the first frontend feature: a true tracer bullet only
becomes possible in Phase 3, once both ends exist. They are kept as thin
separate slices rather than one thick "card + backend + page" slice.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes** (`server/src/routes/`, thin — parse → domain → JSON):
  - `GET /api/home` → `[{ genre: string; count: number; movies: Movie[] }]` —
    one row per populated genre, alphabetical; handler calls `listGenres()` then
    per genre `listMovies({ genre, sort: 'recently-added', limit: 15 })`. One
    aggregate request, one loading transition, no client N+1.
  - `GET /api/movies?genre=&sort=&limit=` → `Movie[]` — generic browse endpoint,
    stood up for the future GenrePage; **not consumed** by the home screen.
  - `POST /api/movies/:id/favorite` → `{ value }` — calls `setFavorite`.
  - `GET /api/images/*` → static serve of the managed image cache
    (`posterPath` → browser-loadable URL). Serves gradients in practice today;
    lights up automatically when import populates the cache.
- **Frontend routes** (`react-router-dom` v6): `/` → real `LibraryPage`;
  `/movie/:id`, `/genre/:name`, `/settings` → placeholder pages echoing the
  param. Card `onOpen` → `/movie/:id`; "View all" → `/genre/:name`; gear →
  `/settings`; logo → `/`.
- **Schema**: no migration. Browse-grid is a pure offline SQLite **read**; it
  touches no TMDB key and adds no columns. The only backend seam change is
  additive: `limit?: number` on `MovieQuery`, pushed into SQL as `LIMIT ?` in
  the existing `listMovies` builder (touches the "done" library-core seam by
  design).
- **Key models** (in `src/types/`):
  - `PosterCardMovie` (promoted from the prototype): `{ id, title, posterUrl:
string | null, g1, g2, rating: number /* 0..100 */, watched, progress:
number /* 0..100 */, favorite }`.
  - `HomeRow`: `{ genre, count, movies: PosterCardMovie[] }`.
- **The one logic seam — `view(movie)` mapper** (`Movie` → `PosterCardMovie`),
  pure and tested in isolation:
  - `rating = (units ?? 0) * 10` — unrated (`null`) → 0 stars (flagged:
    visually identical to a literal 0 on the card).
  - `progress = clamp(resumeSeconds / (runtimeMinutes * 60) * 100, 0, 100)`;
    `null` runtime → a **nominal sliver** (small fixed length that keeps the
    in-progress signal without faking a percentage).
  - `posterUrl = posterPath ? \`${API}/api/images/${posterPath}\` : null`; null
triggers the `gradientFromId(id)` (`g1`/`g2`) fallback.
  - `favorite`, `watched` pass straight through.
- **Frontend layers introduced** (scoped to the card render path): `tokens/`,
  `styles/` (reset + `ThemeProvider`), `primitives/` (`StarRating`,
  `StatusBadge`, `ProgressBar`, `Icon/` set), `components/` (`PosterCard`),
  `features/library/` (`CardCarousel`, `GenreRow`, `useHomeRows`, `view`),
  `pages/`, `types/`, `utils/`. Header/player/form-only primitives (`Button`,
  `TextField`, `Textarea`, `Chip`, `Toggle`, `IconButton`, `SearchBar`,
  `FilterDropdown`, `ContinueCard`, `Fab`) are **deferred** to the features that
  own them. No global store/context (deferred until a second feature shares
  state). No TMDB fetch, no image-cache population, no Electron shell (dev runs
  Vite ↔ Express on :3001).
- **Testing pattern**: assert external behavior, not implementation detail.
  Backend seam tests in the `server/src/library/browse/browse.test.ts` style
  against seeded in-memory SQLite; every `src/utils/` function has a test
  (CLAUDE.md); `PosterCard` covers interaction callbacks only. Presentational
  pieces with no branching (carousel arrow math, `GenreRow`, skeletons) are
  verified against the prototype this round, not unit-tested.

---

## Phase 1: One real Poster card, end to end (frontend foundation)

**User stories**: 7, 8, 9, 16, 17, 27

### What to build

Stand up the first real `src/` layers — but only what a single `PosterCard`
transitively needs — and render one card from a hardcoded `PosterCardMovie` in a
harness, with no network. Translate `docs/handoff/tokens.css` into a `theme`
object; add the global reset + `ThemeProvider`; build the primitives the card
composes (`StarRating`, `StatusBadge`, `ProgressBar`, and the `Icon/` set:
`IconBase`, `HeartIcon`, `HeartOutlineIcon`); build the `PosterCard` molecule to
match `mol.PosterCard.dc.html`; and add the pure, tested logic seam — the
`PosterCardMovie` type, the `view()` mapper, and the `gradientFromId` /
`toRatingPercent` / `toProgressPercent` utils. The card shows poster-or-gradient,
title, star rating, and a watched badge or in-progress progress bar.

### Acceptance criteria

- [ ] `tokens/` (colors, spacing, typography, radius, breakpoints) is translated
      from `docs/handoff/tokens.css`; a `ThemeProvider` + global reset wrap the app.
- [ ] `PosterCard` renders 1:1 against `mol.PosterCard.dc.html`: poster/gradient,
      title, star rating, and the watched badge vs. in-progress progress bar.
- [ ] A movie with no `posterUrl` shows the gradient fallback with its title
      overlaid; the same id always yields the same two gradient stops.
- [ ] An unrated movie renders as empty stars (no crash, no blank).
- [ ] `gradientFromId`, `toRatingPercent`, `toProgressPercent`, and `view()` each
      have unit tests, covering: deterministic gradient stops; `units * 10` with
      `null → 0`; progress clamped to `[0,100]` with `null` runtime → nominal
      sliver; and the mapper's poster-vs-gradient / favorite / watched branches.

---

## Phase 2: Backend seam — `limit` + the `/api/home` aggregate

**User stories**: 14, 25, 26, 29

### What to build

Add `limit?: number` to `MovieQuery` and push it into the existing `listMovies`
SQL builder as `LIMIT ?`. Stand up the first `server/src/routes/` layer (thin:
parse → domain → JSON) exposing `GET /api/home` (the per-genre aggregate),
generic `GET /api/movies`, `POST /api/movies/:id/favorite`, and static
`GET /api/images/*`. Verifiable via the aggregation test and by curling `/api/home`
against a seeded database.

### Acceptance criteria

- [ ] `MovieQuery.limit` caps the rows `listMovies` returns and combines with
      genre/sort; absent `limit` returns all rows (regression guard). Tested in the
      `browse.test.ts` style against seeded data.
- [ ] `GET /api/home` returns one row per populated genre, alphabetical, each with
      ≤15 movies sorted recently-added, and a `count` reflecting the genre's **true
      total** from `listGenres()` (not the capped 15). One focused handler test.
- [ ] A movie tagged with multiple genres appears in each of those genre rows.
- [ ] A genre with zero movies produces no row.
- [ ] `POST /api/movies/:id/favorite` calls `setFavorite` and returns `{ value }`;
      `GET /api/images/*` statically serves the managed image cache path.
- [ ] The screen path works fully offline against local SQLite (no network
      dependency, no TMDB key).

---

## Phase 3: Rows + page against real data

**User stories**: 1, 2, 3, 4, 5, 6, 20, 21, 22, 23, 28

### What to build

The first true tracer bullet: real `/api/home` data rendered as genre rows on the
`LibraryPage`. Build `CardCarousel` (horizontal overflow scroller, paged left/
right arrows at ~80% client width, arrows auto-hiding at start/end and when a row
doesn't overflow, native wheel/trackpad scroll preserved), `GenreRow` (title +
"View all {count}" + carousel), the `LibraryPage` shell with a partial header
(logo + gear only), and the `useHomeRows` hook that fetches `/api/home` and maps
each `Movie` through `view()` into `HomeRow`s. Wire the three load states, reusing
the prototype's centered `--color-text-faint` message layout: skeleton genre rows
while loading, a dedicated "Your library is empty" message (distinct copy from the
prototype's search-miss text), and a minimal retryable "Couldn't load your
library. Retry." error. `CardCarousel` takes a `variant` (`'poster' |
'continue'`) but only `poster` is exercised here.

### Acceptance criteria

- [ ] `LibraryPage` renders one `GenreRow` per populated genre, in alphabetical
      order, from real `GET /api/home` data.
- [ ] Each row is a horizontal `CardCarousel` of `PosterCard`s with a
      "View all {count}" label showing the genre's true total.
- [ ] Carousel arrows page the row; they hide at the start, at the end, and when
      the row doesn't overflow; wheel/trackpad scroll always works.
- [ ] Loading shows skeleton genre rows; an empty library shows the dedicated
      empty-library message, worded distinctly from a search-miss; a failed load
      shows a retryable error that recovers on retry.
- [ ] The header (logo + gear) stays usable and the page scrolls smoothly with
      many genre rows; the search-miss "Nothing here" copy is **not** wired here.

---

## Phase 4: Routing + interactivity

**User stories**: 10, 11, 12, 13, 15, 18, 19, 24, 30

### What to build

Make the wired screen navigable and interactive. Add `react-router-dom` v6 with
`/` → real `LibraryPage` and placeholder `MoviePage` / `GenrePage` /
`SettingsPage` that echo their routed param. Route every action: card `onOpen` →
`/movie/:id`, "View all" → `/genre/:name`, gear → `/settings`, logo → `/`. Wire
the favorite heart to `POST /api/movies/:id/favorite` with an optimistic toggle
that fills immediately, stops propagation so it does **not** also open the movie,
and visibly reverts if the save fails.

### Acceptance criteria

- [ ] Clicking a poster navigates to `/movie/:id`; "View all" navigates to
      `/genre/:name`; the gear navigates to `/settings`; the logo returns to `/`.
- [ ] `MoviePage` / `GenrePage` / `SettingsPage` render placeholders that echo
      their routed id/name, so navigation is verifiable now and real pages slot in
      behind stable URLs later.
- [ ] Clicking the heart fills it immediately (optimistic) and calls
      `POST /api/movies/:id/favorite`.
- [ ] Clicking the heart does **not** also open the movie (propagation stopped).
- [ ] A favorite that fails to save visibly reverts, so the heart never lies about
      what is persisted.
