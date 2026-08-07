# Plan: Card Carousel (the `continue` variant + Continue Watching row)

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/16

Closes out the **Card carousel** by building the card its `continue` variant was
designed for, and ships it behind its real consumer: the **Continue Watching
row** at the top of the **Browse home**. Everything else the feature lists — the
15-card cap, the auto-hiding arrows, "View all" → genre page — landed with the
browse grid in 02.

Phases 1 and 2 are deliberately not end-to-end. The tile has no backend of its
own: it renders a `Movie` the home aggregate already returns, and the only thing
that mounts it is a row that doesn't exist until Phase 4. The same bootstrapping
shape as 02, kept as thin slices rather than one thick "card + carousel + row".

Phase 3 reshapes `GET /api/home` and adapts the frontend in the same slice, so
every phase ends with a working home screen. The continue section arrives
fetched-but-unrendered, and Phase 4 renders it.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: unchanged set — `GET /api/home` stays the one aggregate the browse
  home loads, in exactly one request. Its **response shape changes** from a bare
  `HomeRow[]` to named sections `{ continueWatching, rows }`, amending the 02
  decision. This is a breaking change to the frontend fetcher and is the last
  reshape: the Favorites row lands in the same envelope later.
- **Schema**: no migration. Nothing new is stored. The continue section is a
  read composed from the existing browse query (`inProgressOnly`,
  `sort: 'recently-added'`, `limit`) — no new SQL and no new repository
  primitive.
- **Repository seam**: `LibraryStorage.listHomeRows()` is **replaced** by
  `getHome(): HomePayload`. Aggregation stays in the repository so the route has
  one call to serve and stays a pure passthrough. Rejected: keeping
  `listHomeRows` and adding a second `listContinueWatching`, which pushes the
  payload shape out into the route layer.
- **Key models**:
  - `HomePayload`: `{ continueWatching: Movie[]; rows: HomeRow[] }` — the shared
    wire contract, in `src/types/`, read by both the repository and the frontend.
    `HomeRow` is unchanged.
  - `ContinueCardMovie` (in the shared view models, beside `PosterCardMovie`):
    `{ id, title, g1, g2, resumeLabel, progress }`. `id` is not in the
    prototype's `data-props` but is required — the carousel keys on it and the
    open handler needs it.
- **`CardCarouselProps` is a discriminated union keyed on `variant`.** One arm
  carries poster items (`movie`, `onOpen`, `onToggleFavorite`), the other
  continue items (`movie`, `onOpen` — no favorite affordance). A continue item
  physically cannot reach a poster row; illegal combinations are compile errors,
  not a runtime narrow inside the component. The exported `CarouselItem` becomes
  `PosterCarouselItem`. Accepted cost: `variant` is load-bearing for narrowing,
  and the per-variant arrow-height / item-width maps are kept in sync with the
  union arms by hand.
- **The continue tile carries no artwork** — gradient-only, 1:1 with the
  prototype, which has no image slot on this card. A **Backdrop** would suit a
  16:10 tile; that is a prototype amendment, raised separately, never improvised
  during build.
- **The prototype's `view()` is not ported** — it is a container simulation
  shortcut (one fat object for every consumer to pick from), not the UI surface.
  Per CLAUDE.md, the surface is translated and the simulation is not.
- **Ordering is `recently-added`, knowingly wrong.** The row wants
  most-recently-_watched_, which needs an `updated_at`-backed sort the enum
  doesn't have. Adding a sort with no writer behind it is worse than the honest
  approximation. The row's name describes _which_ movies appear, not their order.
  Revisit when the player ships.
- **Cap**: the continue section reuses `HOME_ROW_LIMIT` — the same 15 as the
  genre rows, not a second constant.
- **A continue tile opens `/movie/:id`**, not the player, matching the prototype
  and every other tile in the app.
- **Testing pattern**: assert what a parent or a caller can observe — the text on
  the tile, whether the row is on screen, what the aggregate returns — never how
  it was produced. No test asserts a styled-component class name or that a
  particular helper was called. Rendering tests query by role and text and click
  the tile. Repository tests open a real `:memory:` SQLite database and assert
  through the public storage interface. Every `src/utils/` function has a test.

---

## Phase 1: The continue tile

**User stories**: 5, 6, 7, 19, 20, 21, 24, 25, 26, 28

### What to build

The wide 16:10 resume tile from `mol.ContinueCard.dc.html`, plus the two pure
units that feed it. A `formatClock` helper in `utils/` (floor, clamp at zero,
`h:mm:ss` at or past an hour else `m:ss`) and a `continueView` mapper in the
library feature, sibling of the existing `view()`, turning a `Movie` into a
`ContinueCardMovie`. The **Resume label** is built in the mapper and handed to
the card as a finished string, so the molecule stays logic-free; progress reuses
the existing `toProgressPercent` and its unknown-runtime sliver. The card itself
is a molecule in `components/`, added to the barrel, with the standard
three-file folder: gradient fallback, dark scrim, title, resume label, a 4px
accent progress track pinned to the bottom edge, and a circular play badge
top-right. No favorite heart — this tile is read-only.

### Acceptance criteria

- [ ] `ContinueCard` renders 1:1 against `mol.ContinueCard.dc.html`: 16:10
      gradient tile, scrim, serif title, resume label, bottom progress track with
      accent fill, and the circular play badge.
- [ ] The progress fill reflects the model's percent and is clamped, so a
      nonsensical resume position (negative, or past the end) can never render
      garbage.
- [ ] A tile with no artwork looks deliberate — the gradient stops are derived
      deterministically from the movie id, the same as a poster card's fallback.
- [ ] Clicking the tile raises `onOpen`; there is no favorite control anywhere on
      the card.
- [ ] `formatClock` has a test covering the sub-hour and past-hour branches,
      zero-padding of minutes and seconds, flooring of fractional seconds, and
      clamping of a negative input.
- [ ] `continueView` has a test covering the full label with a known runtime
      (`Resume · 1:13 of 1:55`), the truncated label when `runtimeMinutes` is
      `null` (`Resume · 1:13`, no `of --` placeholder), the nominal sliver of
      progress for that same unknown-runtime movie, deterministic gradient stops,
      and that the id survives.

---

## Phase 2: The carousel's second face

**User stories**: 4, 9, 10, 11, 12, 15, 27

### What to build

Make `CardCarousel` honest about the capability its type already advertises.
`CardCarouselProps` becomes a discriminated union keyed on `variant`: the poster
arm keeps `movie` / `onOpen` / `onToggleFavorite`, the continue arm carries
`movie` / `onOpen` and no favorite affordance. The exported `CarouselItem` is
renamed `PosterCarouselItem`, which touches `GenreRow`. The `continue` branch
stops rendering `null` and mounts a `ContinueCard`. The existing geometry — arrow
centre at 0.48 of the card width, tiles 1.55× wider than a poster — already in
place from 02, now has something to sit against.

### Acceptance criteria

- [ ] `variant="continue"` renders one `ContinueCard` per item; `variant="poster"`
      renders poster cards exactly as before (regression guard).
- [ ] Passing a continue item to a poster row — or attaching a favorite handler
      to a continue item — is a **compile error**, not a runtime narrow.
- [ ] The continue tiles are visibly wider than posters, so the row reads as
      different from the genre rows, and the arrows sit centred on the shorter
      tiles rather than floating above or below them.
- [ ] Arrows page the continue row left and right identically to a poster row,
      hide when there is nowhere to scroll, and never intercept wheel/trackpad
      scrolling.
- [ ] The same movie can be rendered as both a poster and a continue tile and
      looks correctly different in each.

---

## Phase 3: Named sections on the home payload

**User stories**: 14, 16, 17, 18, 22, 29, 30, 31

### What to build

Reshape the one home aggregate and carry the change all the way to the screen so
nothing is left broken. `HomePayload` becomes `{ continueWatching, rows }`;
`listHomeRows()` is replaced by `getHome()`; the home module builds both sections
and the route stays a pure passthrough. The continue section composes the
existing browse query — in-progress only, recently-added, capped at
`HOME_ROW_LIMIT` — so no new SQL and no new repository primitive appear. The
frontend fetcher and the home hook adapt to the new envelope in this same slice:
the home screen renders exactly as it does today, still in one request with one
loading transition, with `continueWatching` fetched and not yet rendered.
Verifiable by curling `/api/home` against a seeded database.

### Acceptance criteria

- [ ] The home aggregate returns `{ continueWatching, rows }`; the genre rows are
      unchanged from their 02 behaviour (one row per populated genre,
      alphabetical, capped at 15, true totals).
- [ ] `continueWatching` holds only in-progress movies — a watched movie and an
      unstarted movie are both excluded — ordered recently-added-first and capped
      at the same 15 as the genre rows.
- [ ] A movie that is in progress appears in `continueWatching` **and** still
      appears in its genre row.
- [ ] An in-progress movie with no genre tags appears in `continueWatching`, even
      though it produces no genre row.
- [ ] `continueWatching` is an empty array when nothing has been started; an
      empty library returns both sections empty.
- [ ] Tested against real `:memory:` SQLite through the public storage interface,
      in the existing `library/` domain-module style. The route is not separately
      tested — it is a passthrough by design, which is the reason for that seam.
- [ ] The home screen still loads in **exactly one request** with one loading
      transition, and its failure/retry behaviour is unchanged: one failed request
      still means one error message and one Retry.

---

## Phase 4: Continue Watching on the browse home

**User stories**: 1, 2, 3, 8, 13, 23, 32

### What to build

Render the section. A `ContinueRow` organism in the library feature — the
structural twin of `GenreRow`: serif 24px "Continue Watching" heading, the
prototype's padding and bottom margin, then the carousel at `variant="continue"`.
No "View all", and it renders nothing at all when it has no movies. `GenreRows`
is renamed `HomeRows` (matching the hook, the row type, the repository method,
and the route) and renders the continue section above the genre rows, from the
same fetch and the same load states. Carried in with it: the **empty-library bug
fix** — an untagged in-progress movie produces no genre row, so today the screen
would show "Your library is empty" directly above a populated Continue Watching
row. Verified end to end against a database seeded by a throwaway script in the
scratchpad, since nothing writes a resume position until the player ships.

### Acceptance criteria

- [ ] The Continue Watching row renders above every genre row, labelled
      "Continue Watching", from the same single home request.
- [ ] Clicking a continue tile navigates to `/movie/:id`, the same as clicking a
      poster anywhere else.
- [ ] The row is absent entirely — no heading, no empty shelf — when nothing is
      in progress.
- [ ] "Your library is empty" appears only when there are **no genre rows and
      nothing in progress**; an untagged in-progress movie shows the Continue
      Watching row and no empty-library message.
- [ ] The existing loading, error, and retry behaviour of the home screen is
      unchanged, and the whole screen paints at once — the continue row never
      pops in above rows that had already painted.
- [ ] Verified by hand against a real database seeded through
      `createSqliteStorage` with resume positions, using a throwaway script in
      the scratchpad (not committed): the row appears, matches the prototype, and
      disappears when those positions are cleared.
- [ ] CLAUDE.md's feature list moves **Card carousel** to ✅ and adds **Continue
      Watching row** as ✅.
