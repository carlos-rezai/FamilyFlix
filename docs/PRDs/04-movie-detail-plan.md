# Plan: Movie Detail (the full detail page against real data)

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/22

Lands the real screen behind `/movie/:id` — the URL 02 registered as a
**Placeholder route** precisely so the browse home's cards would have honest
destinations, and the one 03 pointed the **Continue card** at. No link in the
app changes; the dead end simply stops being one.

Phase 1 is deliberately not end-to-end. `Button`, `Chip`, and `ExpandableText`
have no consumer until Phase 3, and no backend of their own at any point — they
are the handoff's three most-reused pieces, built once here so the four screens
that need them next inherit them. The same bootstrapping shape as 02's first
frontend phase and 03's continue tile, kept as a thin slice rather than folded
into a thicker "primitives + page".

Phase 2 is a backend slice with its client seam attached, verifiable by curling
a seeded database. From Phase 3 onward every phase ends with a working detail
screen: Phase 3 makes it exist, Phase 4 gives its action row a navigation half,
Phase 5 makes its two toggles real.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes** — two new API endpoints and two new **Placeholder routes**:
  - `GET /api/movies/:id` → `200` full `Movie` | `404 { error }`. The page gets
    its movie **by id from the URL**, never from router state. Rejected: passing
    the movie down through navigation state from the card click — it dies on
    reload (normal in an Electron shell), and home rows are capped at 15 per
    genre so most of the library was never in that payload. A page that only
    renders when you arrived by clicking is a modal wearing a URL. Rejected: an
    id filter on `MovieQuery` — it duplicates `getMovie` and returns an array to
    unwrap.
  - `POST /api/movies/:id/watched` → `{ value: boolean }`, echoing what was
    stored, `400` on a non-boolean body, `404` on an unknown id — the exact
    shape the favorite route already has.
  - `/movie/:id/play` (`PlayerPage`) and `/add` (`AddMoviePage`), both
    placeholders. Edit navigates to `/add?movie=<id>`. COMPONENT-SPEC §6 lists
    no `/edit` route; the prototype's `editMovie()` pre-fills the form and jumps
    to the add screen. Rejected: inventing `/movie/:id/edit` mid-build. The
    query param is **provisional** — the movie-form grill owns the real
    contract.
- **Schema**: **no migration.** Nothing new is stored. Every field this screen
  renders — `synopsis`, `director`, `cast`, `backdropPath`, `runtimeMinutes`,
  `genres` — is already on the canonical `Movie` and already assembled by
  `getMovie(id)`. The only data change is the **seed** growing prose.
- **Repository seam**: unchanged. `getMovie`, `markWatched`, `markUnwatched`,
  and `setFavorite` all already exist on `LibraryStorage`; both new handlers stay
  thin parse-call-serialize, so no aggregation leaks into the route layer.
- **Key models**:
  - `MovieDetailModel` — the view model for this screen, built by `detailView()`.
    It carries **nullable values, not finished strings**: the **Meta line**
    cannot collapse into one string because `StarRating` sits _in the middle_ of
    it. The `resumeLabel` precedent ("so the molecule stays logic-free") does not
    transfer — that kept a _molecule_ pure, and `MovieDetail` is a feature
    organism, the rung that owns logic. Rejected: a discriminated segment array
    (`{kind:'text'} | {kind:'rating'}`) — abstraction with no payoff for three
    fixed slots, and the model stops describing a movie.
  - **Load states**: `loading | ready | not-found | error`. Four, not three, and
    the distinction is carried by the **affordance** rather than the copy —
    `error` offers **Retry**, `not-found` offers **Back to library**, because
    Retry on a 404 is a button that can never work. This extends the `HomeRows`
    convention, which already treats "library is empty" as its own situation
    rather than a failure.
- **A new feature folder, `features/movie-detail/`,** mirroring the shape of
  `features/library/` (an `api/`, a view mapper, a hook, an organism, each in its
  own folder with its test). Rejected: folding into `features/library/` — that
  folder is the _browse home's_ domain, and adding a second screen's endpoint,
  view model, and mutation turns it into exactly the catch-all CLAUDE.md's "no
  generic `services/`/`lib/`" rule exists to prevent.
- **`detailView()` owns every absent-field rule**, so the component has no
  display conditionals worth arguing about. The **Meta line** assembles from
  surviving **Meta segments** with separators generated _between_ survivors, so a
  dangling `·` is **unrepresentable** rather than merely avoided. The **Runtime
  label** drops zero units — `42m`, `2h`, never `0h 42m` or `2h 0m`. A null
  synopsis produces no `ExpandableText` at all. Credits show "—" for a missing
  one and the row is omitted only when **both** are missing — rejected: hiding
  each credit independently, which makes the surviving one jump across the page
  between movies.
- **Unrated hides the star segment entirely** on this page, treated as a missing
  **Meta segment**. With `showValue` on, an unrated movie would print "0.0" — the
  household asserting it scored the film zero, the opposite of "nobody has rated
  this". **`PosterCard` is deliberately left unchanged**: its star row is fixed
  furniture in a fixed-height tile, and dropping it would make cards in a row
  uneven.
- **Backdrop and poster are wired now, gradient as fallback.** The overlays
  (`topTag`, title) render **only** on the fallback, following `PosterCard`'s
  existing rule, so artwork is never covered by text duplicating the heading
  beside it. Rejected: backdrop → poster → gradient — a 2:3 poster stretched
  across a 62%-height area crops badly and blurs. Ships **untested against real
  files** until the importer exists, the same bargain `PosterCard.posterUrl`
  already took.
- **`MainLayout` is dropped for this route.** COMPONENT-SPEC §6 already ruled
  that each page owns its own header; the ⋯ trigger's fixed slot
  (`top:24px; right:24px`) is precisely where `MainLayout` puts the gear; and the
  translucent `backdrop-filter: blur(10px)` treatment is only legible floating
  over artwork. Accepted: no Settings route from this page — **Back** is the
  designed escape hatch and returns to a screen that has the gear. The app now
  carries two chrome models, and the player and import screens will follow this
  one.
- **Scrolling happens in an inner container** (`height: 100vh; overflow-y: auto;
position: relative`), matching the prototype's geometry and `MainLayout`'s own
  inner-scrolling body. Rejected: document scroll — the art area's 62% would
  resolve against _content_ height, so a movie with a two-line synopsis and one
  with ten lines would get differently-sized backdrops.
- **Back is `navigate(-1)`, falling back to `/` when `location.key === 'default'`.**
  The faithful translation of the prototype's `detailReturn` flag, which is a
  hand-rolled history stack covering the only two origins it had. Router-agnostic
  — identical under `BrowserRouter`, `HashRouter`, and `MemoryRouter` — so **the
  Electron router decision is not blocked on this**.
- **`saveFavorite` is imported from `features/library/api/`, with a comment
  marking it for re-homing.** CLAUDE.md assigns the Favorites feature both
  surfaces ("mark from card and detail"), so both call sites move together, once.
  Rejected: duplicating it — two copies of the echo-reconcile contract is two
  places to diverge on failure behaviour. Rejected: hoisting to a new `src/api/`
  — that organizes by I/O purity, the exact thing CLAUDE.md rules out
  server-side.
- **`prim.IconButton` is deliberately not built**, and this page's four buttons
  stay hand-styled. Its spec'd surface (size default 46, `ghost|outline`, no
  shape prop) was written against call sites that do not exist yet, and none of
  the four match it: the two toggles are 58px circles with an accent-soft pressed
  fill, the Back pill and ⋯ are 44px translucent-over-artwork. No rule is
  breached — "never build a one-off styled `<div>` when a primitive exists" is
  about primitives that _already exist_. Flagged for `request-refactor-plan` once
  three real screens can be compared.
- **Delete is not built at all** — the prototype never implemented it (its
  `onClick` merely closes the menu) and no confirm dialog is designed anywhere in
  the handoff. Rejected: a disabled row, which reads as "this movie can't be
  deleted" rather than "not built yet".
- **Testing pattern**: assert what a parent or a caller can observe — the text on
  the screen, which button is offered, what the endpoint returns — never how it
  was produced. No test asserts a styled-component's class name, a mapper's
  intermediate value, or that a particular helper was called. Rendering tests
  drive the component the way a user does (query by role and text, click, press
  Escape). Route tests open a real `:memory:` SQLite database and assert through
  the public storage interface. Every `src/utils/` function has a test.
- **Two knowingly-imperfect decisions, recorded rather than hidden.** Marking a
  movie watched **clears its resume position** (a documented repository
  convention shared by every caller) and `?movie=<id>` is a placeholder contract.
  Both are flagged in `docs/ubiquitous-language.md` for the grills that own them
  — the watch-tracking grill and the movie-form grill.

---

## Phase 1: Three shared units

**User stories**: 7, 8, 10, 45

### What to build

The handoff's three most-reused pieces, built once as shared units rather than
inline on the page that first needs them: `prim.Button`, `prim.Chip`, and
`mol.ExpandableText`, plus the `MoreIcon` and `CheckIcon` atoms. Button and Chip
are built to their **full COMPONENT-SPEC surface** — Button with
`primary|secondary|ghost|danger`, `md|lg`, `icon`, `fullWidth`, `disabled`; Chip
with `sm|md`, `selected`, optional `onClick` — even though this feature renders
one combination of each, because MovieForm, SettingsPage, ImportFlow, and
ExportModal all need them and the spec tables are already written. Building once
beats four later widening commits. Note that the prototype's own `data-props`
declares only three Button variants and no boolean props; the spec table is taken
as the fuller statement of the same component.

`ExpandableText` clamps to N lines via `-webkit-line-clamp` (which cuts at a line
boundary), measures `scrollHeight > clientHeight` **while clamped** on mount and
on resize, and renders its toggle **only** when the text actually overflows.
Nothing mounts any of these until Phase 3 — this slice is verified by its tests
and by the primitives' own rendering.

### Acceptance criteria

- [ ] `Button` renders every variant and size 1:1 against `prim.Button.dc.html`;
      `icon="play"` adds the leading glyph, `fullWidth` stretches to its
      container, `disabled` mutes the fill and blocks the click, and an enabled
      click raises the handler.
- [ ] `Chip` renders its label and reflects `selected` with the accent-soft fill;
      given an `onClick` it is an activatable control, and without one it is a
      static tag with no button affordance.
- [ ] `ExpandableText` shows **no toggle at all** for copy that fits, and a
      "Read more" for copy that overflows; toggling swaps the label to "Show
      less" and unclamps the copy.
- [ ] The overflow test drives the _decision_ ("did a toggle appear"), never the
      measurement mechanism — jsdom reports `scrollHeight` and `clientHeight` as
      0, so the layout reads are stubbed.
- [ ] All three live at their spec'd rungs (`primitives/`, `primitives/`,
      `components/`) in the standard three-file folder and are re-exported from
      their category barrel — no per-unit barrel.

---

## Phase 2: The movie by URL

**User stories**: 36, 40 (backend half), 41 (backend half)

### What to build

Make one movie fetchable by id, and give the fixtures something below the fold to
render. `GET /api/movies/:id` returns the fully-assembled movie or a `404`, as a
thin parse-call-serialize handler over the existing `getMovie`. The **seed**
grows `synopsis`, `director`, and `cast`, with synopsis lengths chosen so that
several overflow four lines and at least one comfortably does not — so
`ExpandableText`'s toggle is observable rather than theoretical. It does **not**
grow `posterPath` / `backdropPath`: a stored path with no file behind it 404s
through `/api/images/`, which the seed's own docblock already refuses for that
reason. On the client, `fetchMovie` resolves the parsed movie and **distinguishes
a 404 from any other failure** — that distinction is the whole reason
`not-found` is reachable as a state in Phase 3. Verifiable by curling
`/api/movies/:id` against a seeded database, for both a known and an unknown id.

### Acceptance criteria

- [ ] `GET /api/movies/:id` returns the fully-assembled `Movie` — synopsis,
      director, cast, genres, subtitles, derived `status` — for a known id, and
      `404 { error }` for an unknown one, tested against real `:memory:` SQLite.
- [ ] Re-running the seed still writes the full fixture set idempotently, and
      every fixture still carries the reserved video-path prefix, so the run can
      never touch a movie that arrived any other way.
- [ ] The seeded synopses vary in length: several overflow four lines at the
      page's 560px measure and at least one sits comfortably under, so both
      `ExpandableText` states are observable in the running app.
- [ ] At least one fixture is missing its director, at least one is missing both
      director and cast, and at least one has no synopsis at all — so Phase 3's
      absent-field rules can be checked by looking, not only by unit test.
- [ ] `fetchMovie` resolves the parsed movie, and a 404 is distinguishable by its
      caller from a network failure or any other non-2xx.
- [ ] No migration is added and no repository method changes.

---

## Phase 3: The page renders

**User stories**: 1, 2, 3, 4, 5, 6, 9, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28,
29, 30, 31, 32, 37, 38, 40, 41, 42, 46

### What to build

The screen itself, as a 1:1 translation of `page.MoviePage.dc.html` against real
data. `detailView()` maps a `Movie` to a `MovieDetailModel`, owning every
absent-field decision. `useMovieDetail` loads by id from the URL and holds the
four **Load states**, with `retry` and the same stale-response guard
`useHomeRows` uses. The `MovieDetail` organism renders the full-bleed **Backdrop**
under its three-stop scrim, the 300px **Poster**, the 48px serif title, the
**Meta line** (year · runtime · stars, plus the **Watched** badge), the genre
**Chips**, the clamped **Synopsis**, and the **Credits row**. `MoviePage` drops
`MainLayout`, owns the inner scroll container, and carries the Back pill.

The action row is not built in this phase — the buttons arrive in Phases 4 and 5,
so the space between the chips and the synopsis is empty until then. Everything
else above and below it is final.

### Acceptance criteria

- [ ] Clicking any poster or continue tile opens a real page about that movie,
      and a reload or a pasted deep link renders the identical screen — the page
      loads from the URL, never from navigation state.
- [ ] The page is a 1:1 translation of the prototype: backdrop area and scrim,
      300px poster with its shadow and border, 48px serif title, meta line,
      genre chips, synopsis measure, credits row — same layout, spacing, and
      copy.
- [ ] The **Meta line** never renders a dangling separator: a movie with no year
      shows runtime and stars cleanly, and a movie with neither year nor runtime
      shows the stars alone.
- [ ] The **Runtime label** reads `2h 8m`, `42m`, and `2h` for 128, 42, and 120
      minutes — never `0h 42m` or `2h 0m` — and a null runtime drops the segment
      entirely.
- [ ] An **Unrated** movie shows **no stars at all**, distinct from a movie with
      a stored rating of 0, which still shows an empty row reading 0.0.
- [ ] A movie with no synopsis renders no `ExpandableText` in the tree at all —
      not an empty clamped box, and not a toggle with nothing to toggle.
- [ ] The **Credits row** shows "—" for a missing director while keeping the cast
      beside it, and is omitted entirely only when **both** are missing.
- [ ] A **Watched** badge sits beside the meta line on a finished movie and is
      absent otherwise.
- [ ] A movie with no artwork renders the deterministic gradient from its id —
      the same stops as its card — with the `topTag` and title overlays drawn on
      the poster; a movie **with** a poster or backdrop renders the artwork and
      **no** overlays.
- [ ] The four **Load states** are reached from their real causes: a 404 gives
      `not-found` with a **Back to library** link and **no Retry**; a rejected
      fetch gives `error` with **Retry**, and retrying re-runs the load. A retry
      landing while an earlier load is in flight never lets the stale response
      overwrite it.
- [ ] **Back** returns to exactly where the user was — same row, same scroll
      position — and still lands somewhere sane (`/`) when the page was opened
      by deep link or reload.
- [ ] The page scrolls inside its own container: a movie with a ten-line synopsis
      and one with a two-line synopsis get identically-sized backdrops.
- [ ] `detailView` carries the densest tests in the feature, covering every rule
      above; `MoviePage` is composition-only and is not separately tested, which
      is the reason for choosing that seam.

---

## Phase 4: The action row's navigation half

**User stories**: 11, 12, 25, 33, 34, 35, 47

### What to build

The action row's honest half. The large **Play** button — `prim.Button`,
`variant="primary"`, `size="lg"`, `icon="play"` — as the most obvious thing on
the screen, labelled **Play** or **Resume · 52:00** for an **In-progress** movie
(the label is built in `detailView` alongside every other display decision). It
navigates to `/movie/:id/play` and **writes nothing**: only the player writes
playback state. The ⋯ trigger opens the **Edit menu**, which ships with one item,
**Edit details**, navigating to `/add?movie=<id>`. Two new **Placeholder routes**
are registered — `PlayerPage` and `AddMoviePage` — as documented stubs carrying
no tests, the precedent `MoviePage` itself set in 02. The two circular toggles
are rendered in this phase only insofar as the row's geometry requires; they
become real in Phase 5.

### Acceptance criteria

- [ ] **Play** is the visual anchor of the row, matching the prototype's 58px
      pill with its leading glyph, and sits directly under the genre chips above
      the fold.
- [ ] Its label reads **Play** for an unwatched movie and **Resume · 52:00** for
      an in-progress one, so clicking it never surprises the user about where it
      resumes.
- [ ] Clicking Play navigates to `/movie/:id/play` and changes nothing about the
      movie — no watch state, no resume position written.
- [ ] Clicking **Edit details** navigates to `/add?movie=<id>`; both new routes
      are registered and render a documented placeholder rather than a blank
      screen, so no link in the app is a lie.
- [ ] The ⋯ menu holds **only Edit details** — no Delete row, disabled or
      otherwise.
- [ ] The menu is real `<button>`s with `aria-haspopup` / `aria-expanded`, closes
      on Escape, on an outside pointerdown, and on activation, and returns
      keyboard focus to the ⋯ trigger every time it closes.
- [ ] The whole page is operable by keyboard alone: Back, Play, the ⋯ trigger,
      and the menu item are all reachable and activatable without a mouse.

---

## Phase 5: The two real toggles

**User stories**: 13, 14, 15, 16, 17, 39, 43, 44

### What to build

Make the two circular toggles real, end to end.
`POST /api/movies/:id/watched` takes `{ value: boolean }` and **dispatches to the
dedicated mutators** `markWatched` / `markUnwatched` — not `updateMovie` — so
this page does not invent its own watch semantics to dodge a documented
convention, and echoes the stored value back. The echo is what lets the
optimistic toggle reconcile against what actually persisted, exactly as the
favorite route already does. On the client, `useMovieDetail` grows both toggles:
each shows its new value immediately, reverts when the save rejects, and takes
the server's echo over what it assumed. Favorite reuses `saveFavorite` from
`features/library/api/`, imported with a comment marking it for re-homing when
the Favorites feature lands.

Marking watched **clears the resume position** — a movie at _Resume · 52:00_,
marked watched then unmarked, comes back as **Play** from 0:00. That is a
documented repository convention shared by every caller, accepted here rather
than worked around, and flagged for the watch-tracking grill.

### Acceptance criteria

- [ ] `POST /api/movies/:id/watched` dispatches to `markWatched` for `true` and
      `markUnwatched` for `false`, echoes the stored value, `400`s a non-boolean
      body, and `404`s an unknown id — tested against real `:memory:` SQLite.
- [ ] After marking watched, the movie's resume position is observably zeroed,
      and that behaviour is asserted rather than incidental.
- [ ] Clicking the watched toggle fills it **immediately**, before the save
      confirms, and the **Watched** badge in the meta line agrees with it.
- [ ] Un-marking a movie marked by mistake works and is not permanent.
- [ ] The favorite heart arrives already filled for a movie favorited on the
      shelf, and toggling it here means the shelf agrees when the user goes back.
- [ ] Both toggles **revert** when the save rejects, and take the server's echo
      when it differs from what was assumed — the page never claims something is
      saved that isn't.
- [ ] `saveWatched` returns the echoed value and rejects on a non-2xx;
      `saveFavorite` is imported from the library feature, not duplicated, and
      carries the re-homing comment.
- [ ] The resume-position consequence and the provisional `?movie=<id>` contract
      are both recorded in `docs/ubiquitous-language.md`, flagged for the
      watch-tracking and movie-form grills.
- [ ] CLAUDE.md's feature list moves **Movie detail page** to ✅.
