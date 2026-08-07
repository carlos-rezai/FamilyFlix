## Problem Statement

The **Card carousel** is listed as 🔜 but is two-thirds shipped. It already
pages left/right with auto-hiding arrows, never intercepts wheel/trackpad
scroll, caps rows at 15 cards (`HOME_ROW_LIMIT`), and renders a real "View all
{count}" link to a real `/genre/:name` route. All of that landed with the
**Browse home** in 02.

What is missing is its second face. `CardCarousel` accepts
`variant: 'poster' | 'continue'`, and the `continue` branch renders `null` —
the geometry is in place (arrow centre at 0.48 of the card width, tiles 1.55×
wider than a poster) but no card was ever built for it. So the component
advertises a capability it does not have: a caller can pass
`variant="continue"` today and get an empty, correctly-sized scroller. That is
dead code with a type signature, and it is why the feature cannot honestly be
ticked ✅.

The reason it was left is that the only thing in the prototype that mounts a
`continue` carousel is the **Continue Watching row** on `page.LibraryPage` —
which CLAUDE.md lists as its own separate feature. Building the variant alone
means shipping a branch nothing renders; it would rot before its consumer
arrives.

There is a second, quieter problem underneath: my parents have no way to pick
up a movie they stopped halfway through. Once the player ships and starts
writing resume positions, the **Browse home** will know a movie is
**In-progress** and still show it buried in its **Genre row**, identical to
every other title, with only a thin bar on the poster to say "you started
this."

## Solution

Close out the **Card carousel** by building the card its `continue` variant
was designed for, and ship it behind its real consumer: the **Continue
Watching row** at the top of the **Browse home**.

A **Continue card** is the prototype's wide 16:10 resume tile — a **Gradient
fallback**, a dark scrim, the title, a **Resume label** (`Resume · 1:13 of
1:55`), a 4px accent progress track pinned to the bottom edge, and a circular
play badge top-right. No **Favorite** heart: this tile is read-only, and
clicking it opens the **Movie detail page**, exactly like a **Poster card**.

`CardCarousel`'s props become a discriminated union keyed on `variant`, so a
continue item physically cannot reach a poster row and no favorite handler can
attach to a tile that has no heart. Illegal combinations become compile
errors rather than a runtime narrow inside the component.

The row gets its data from the aggregate that already exists.
`GET /api/home` stops returning a bare array and starts returning named
sections — `{ continueWatching, rows }` — so the **Browse home** still loads
in one request with one loading transition, and the Favorites row has an
obvious slot to land in later without a second reshaping. `GenreRows` is
renamed `HomeRows` to match what it now renders.

One honest limitation, accepted deliberately: **nothing writes a resume
position yet** — the player is 🔜. So on a real library this row will be
correct and permanently hidden until playback ships. That is the prototype's
own behaviour (`showContinue: continueList.length > 0`), not a degraded state,
and it is verified against a seeded database rather than left unproven.

## User Stories

1. As a parent, I want the movies I'm partway through gathered in one row at
   the top of the home screen, so that I can carry on watching without
   hunting through genres.
2. As a parent, I want that row labelled "Continue Watching", so that I know
   at a glance what it is for.
3. As a parent, I want the Continue Watching row above every genre row, so
   that the thing I most likely want is the first thing I see.
4. As a parent, I want each continue tile to be wider than a poster, so that
   the row reads as different from the genre rows below it.
5. As a parent, I want each continue tile to show how far I got — "Resume ·
   1:13 of 1:55" — so that I know how much is left before I commit to it.
6. As a parent, I want a filled progress bar along the bottom of the tile, so
   that I can judge my progress without reading the numbers.
7. As a parent, I want a play badge on the tile, so that it is obvious the
   tile is something I can resume rather than just information.
8. As a parent, I want clicking a continue tile to take me to the movie, so
   that it behaves the same as clicking a poster anywhere else.
9. As a parent, I want the row to page left and right with the same arrows as
   the genre rows, so that I don't have to learn a second control.
10. As a parent, I want the arrows on the continue row to sit centred on the
    shorter tiles, so that they don't float awkwardly above or below them.
11. As a parent, I want the arrows to disappear when there is nowhere to
    scroll, so that I am never offered a dead control.
12. As a parent, I want to still scroll the row with my trackpad, so that the
    arrows are an addition and not a replacement.
13. As a parent, I want the Continue Watching row to vanish completely when
    I've not started anything, so that I am not staring at an empty shelf.
14. As a parent, I want a movie I started to still appear in its genre row as
    well, so that it doesn't disappear from where I expect to find it.
15. As a parent, I want the same movie to look different in the two places —
    a poster in its genre row, a wide resume tile up top — so that I can tell
    which question each row is answering.
16. As a parent, I want a movie I finished to drop out of Continue Watching,
    so that the row only shows things that are genuinely unfinished.
17. As a parent, I want the Continue Watching row capped like the genre rows,
    so that it never becomes an endless strip.
18. As a parent, I want the whole home screen to appear at once, so that the
    Continue row doesn't pop in above rows that had already painted and shove
    them down the page.
19. As a parent, I want a continue tile with no artwork to still look
    deliberate, so that a missing poster reads as a design and not a broken
    image.
20. As a maintainer, I want a movie whose runtime we never recorded to show
    "Resume · 1:13" rather than "Resume · 1:13 of --", so that a gap in the
    metadata doesn't put a placeholder on my parents' screen.
21. As a maintainer, I want that same unknown-runtime movie to still draw a
    small sliver of progress, so that the tile doesn't claim I'm at zero when
    I'm not.
22. As a maintainer, I want a movie with no genre tags that I've started to
    still appear in Continue Watching, so that untagged imports aren't
    invisible on the home screen.
23. As a maintainer, I want the "Your library is empty" message to appear only
    when there is genuinely nothing — no genre rows _and_ nothing in
    progress — so that the screen never contradicts itself.
24. As a maintainer, I want no favorite heart on a continue tile, so that the
    row stays read-only and I'm not offered an edit the prototype never
    designed.
25. As a maintainer, I want the resume time formatted `h:mm:ss` past an hour
    and `m:ss` below it, so that short and long films both read naturally.
26. As a maintainer, I want a nonsensical resume position (negative, or past
    the end of the film) to clamp rather than render garbage, so that a bad
    write from the player can never produce a broken tile.
27. As a developer, I want `CardCarousel` to reject a continue item in a
    poster row at compile time, so that the two card shapes can't be crossed
    by accident.
28. As a developer, I want the resume string built in the mapper rather than
    inside the card, so that the molecule stays logic-free and testable as
    pure rendering.
29. As a developer, I want the home screen to keep loading in exactly one
    request, so that adding a section doesn't add a second loading state to
    the same screen.
30. As a developer, I want the home payload to have named sections, so that
    the Favorites row can be added later without changing the shape again.
31. As a developer, I want the failure and retry behaviour of the home screen
    unchanged, so that one failed request still means one error message and
    one Retry.
32. As a developer, I want to verify the row against a seeded database, so
    that a feature nothing currently writes to is still proven to work.

## Implementation Decisions

**Scope: the carousel variant _and_ its consumer.** The `continue` variant
ships together with the Continue Watching row that mounts it. Building the
variant alone would leave an unrendered branch in the component; building the
Favorites row too would half-build a separate listed feature whose second
surface (mark-from-detail) has no page yet.

**`CardCarouselProps` becomes a discriminated union keyed on `variant`.** One
arm carries poster items (movie, onOpen, onToggleFavorite), the other carries
continue items (movie, onOpen — no favorite affordance). Rejected: a single
item type with a union'd `movie`, which forces a runtime narrow inside the
component and leaves `onToggleFavorite` optional-and-sometimes-ignored;
rejected: opaque items/children, which deletes `variant` from the spec'd prop
interface and pushes tile geometry onto every caller. The existing exported
`CarouselItem` is renamed `PosterCarouselItem`, which touches `GenreRow`.
Accepted cost: `variant` is now load-bearing for type narrowing, and the
per-variant arrow-height and item-width maps must be kept in sync with the
union arms by hand.

**`ContinueCard` is a molecule** (`components/`), per COMPONENT-SPEC. Props
are `movie` + `onOpen`, no domain knowledge, added to the components barrel.
It gets the standard three-file folder.

**`ContinueCardMovie` view model** joins `PosterCardMovie` in the shared view
models: `id`, `title`, `g1`, `g2`, `resumeLabel`, `progress`. `id` is not in
the prototype's `data-props` but is required — the carousel keys on it and the
open handler needs it.

**The continue tile carries no artwork.** Gradient-only, 1:1 with the
prototype, which has no image slot on this card (and COMPONENT-SPEC annotates
_PosterCard's_ gradient as swappable for a real poster while pointedly not
saying so here). A movie's **Backdrop** would suit a 16:10 tile; adding it is
a **prototype amendment**, raised separately, not improvised during build.

**The prototype's `view()` is not ported.** It returns one fat object carrying
`card`, `continueCard`, `starWrap`, `posterStyle`, `open`, and `toggleFav`
together for every consumer to pick from — a container simulation shortcut,
not the UI surface. Per CLAUDE.md ("1:1 means the UI surface, not the fake
behavior") it is not translated. It also means the prototype offers no
guidance on typing two card shapes, which is why the union above is a
decision rather than a translation.

**Two new pure units.** A `formatClock` helper in `utils/` (mirrors the
prototype's `fmtClock`: floor, clamp at zero, `h:mm:ss` at or past an hour
else `m:ss`), and a `continueView` mapper in the library feature, sibling of
the existing `view()`, turning a `Movie` into a `ContinueCardMovie`. Each in
its own folder with its test.

**The `Resume label` is built in the mapper**, passed to the card as a
finished string — what the prototype's `data-props` declares, and it keeps the
molecule logic-free. When `runtimeMinutes` is null the label drops its second
half (`Resume · 1:13`), which is not an invention: it is the prototype's own
detail-page `playLabel`. Progress percent reuses the existing
`toProgressPercent`, which already handles the unknown-runtime nominal sliver.

**The home aggregate grows named sections.** `HomePayload` becomes
`{ continueWatching: Movie[], rows: HomeRow[] }`, **amending the 02 decision**
that `GET /api/home` returns a bare array. Named sections are what let the
Favorites row slot in later without a second rewrite. Breaking change to the
frontend's `fetchHomePayload`.

**The repository seam collapses to one method.** `LibraryStorage.listHomeRows()`
is replaced by `getHome(): HomePayload`; the home module builds both sections
and the route stays a pure passthrough. This follows the module's own stated
rationale — aggregation lives in the repository so the route has one call to
serve. Rejected: keeping `listHomeRows` and adding a second
`listContinueWatching`, which pushes the payload shape out into the route
layer.

**The continue section is queried, not derived.** It composes the existing
browse query: in-progress only, recently-added, limited to 15 — reusing the
same cap constant as the genre rows. No new SQL, no new repository primitive.

**Ordering is `recently-added`, knowingly wrong.** The correct order is
most-recently-_watched_, which needs an `updated_at`-backed sort the sort
enum doesn't have. Adding a sort with no writer behind it is worse than the
honest approximation; revisit when the player reports positions. The row's
name describes _which_ movies appear (In-progress), not their order.

**`ContinueRow` is an organism** in the library feature, the structural twin
of `GenreRow`: serif 24px "Continue Watching" heading, the prototype's
padding and bottom margin, then the carousel at `variant="continue"`. It has
no "View all". It renders nothing at all when it has no movies. Rejected:
inlining it into `LibraryPage`, which is composition-only.

**`GenreRows` is renamed `HomeRows`** and renders the continue section above
the genre rows. The load states and the continue payload arrive from the same
fetch, so splitting them into siblings under `LibraryPage` would need either
two hooks or a shared context. The name also lines up with the hook, the row
type, the repository method, and the route.

**Bug fix carried in: the empty-library check is wrong today.** A movie with
no genre tags produces no genre row, so an untagged in-progress movie would
render "Your library is empty" directly above a populated Continue Watching
row. The check becomes "no genre rows **and** nothing in progress".

**A continue tile opens the detail page**, `/movie/:id`, not the player —
matching the prototype's handler and every other tile in the app.

**Verification uses a throwaway seed script** in the scratchpad, opening the
real database through `createSqliteStorage` to write resume positions by hand.
Rejected: a committed seeder — it has no home in the folder structure and
would be its own feature.

## Testing Decisions

A good test here asserts what a parent or a caller can observe — the text on
the tile, whether the row is on the screen, what the endpoint returns — and
never how it was produced. No test should assert a styled-component's class
name, the internal shape of a mapper's intermediate value, or that a
particular helper was called. Rendering tests drive the component the way a
user does (query by role and text, click the tile) so that a refactor which
preserves behaviour keeps its tests green.

Prior art already in the repo, to follow rather than reinvent: the pure-unit
tests beside `toProgressPercent` and `view`; the component tests beside
`PosterCard` and `CardCarousel`; the row/loading-state tests beside
`GenreRows`; and the repository tests in the `library/` domain modules, which
open a **real `:memory:` SQLite database** and assert through the public
storage interface rather than mocking the driver.

**Tested modules:**

- **`formatClock`** — mandatory under the "every function in `utils/` has a
  test" rule. Covers the sub-hour and past-hour branches, zero-padding of
  minutes and seconds, flooring of fractional seconds, and clamping of a
  negative input.
- **`continueView`** — `Movie` → `ContinueCardMovie`. Covers the full label
  with a known runtime, the truncated label when runtime is null, the
  gradient stops being derived deterministically from the id, the progress
  percent (including the nominal sliver), and that the id survives.
- **`ContinueCard`** — renders title, resume label, and play badge; the
  progress fill reflects the model; clicking the tile raises `onOpen`; there
  is no favorite control anywhere on it.
- **`CardCarousel` at `variant="continue"`** — renders continue cards rather
  than poster cards, one per item; the arrows behave identically to the
  poster variant (hidden with nowhere to go, paging on click).
- **The home aggregate**, against real `:memory:` SQLite — returns only
  in-progress movies in `continueWatching`, excludes watched and unstarted
  ones, orders recently-added-first, caps at 15, returns an empty array when
  nothing is started, and leaves the genre rows unchanged from their 02
  behaviour.
- **`ContinueRow`** — renders the heading and the cards when populated;
  renders nothing at all when empty; raises the open callback with the right
  movie id.
- **`HomeRows`** — the continue section renders above the genre rows; the
  empty-library message appears only when there are no genre rows **and**
  nothing in progress (the bug above); the existing loading, error, and retry
  behaviour is unchanged.

The route itself is not separately tested beyond the aggregate — it is a
passthrough by design, which is the reason for choosing that seam.

## Out of Scope

- **The Favorites row** — a separately listed feature whose second surface
  (mark-from-detail) has no page to live on yet. `HomePayload`'s named
  sections leave it a slot; it is not filled here.
- **Real artwork on the continue tile** — the movie's backdrop exists in the
  model and would suit the 16:10 tile, but the prototype has no image slot on
  this card. Amend the prototype first.
- **A most-recently-watched sort** — the ordering this row actually wants. No
  writer exists behind it until the player ships.
- **A committed seed script** — verification is a throwaway in the scratchpad.
- **The player, watch tracking, and resume-position writes** — separate 🔜
  features. This row only reads what they will eventually write.
- **Search, filter, sort, and the back-to-top FAB** — still their own
  features, still absent from this screen.
- **Any redesign of the continue tile** — this is a translation of
  `mol.ContinueCard`, not a reinterpretation of it.

## Further Notes

Two of the three things CLAUDE.md lists under "Card carousel" — the 15-card
cap and "View all" → genre page — shipped with the browse grid in 02. This
PRD is the third, and completing it is what lets the feature move to ✅.

The most unusual property of this work is that it is **correct and invisible**
on a real library. Until the player writes a resume position, every movie has
`resumePositionSeconds = 0`, the continue section comes back empty, and the
row hides itself. This is not a defect and not a degraded mode — it is the
prototype's specified behaviour. It does mean the row's only proof before the
player ships is a seeded database, which the plan calls for explicitly rather
than leaving to a hopeful eyeball.

The `recently-added` ordering is a known compromise recorded in the
ubiquitous language: "Continue Watching" describes which movies appear, not
their order. It should be the first thing revisited when the player lands.

Two decisions here amend earlier work and should be read as such: the
`/api/home` payload shape (from 02) and the empty-library condition (a bug in
02's `GenreRows`).
