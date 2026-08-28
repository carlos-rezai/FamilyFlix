## Problem Statement

I can favorite a movie from anywhere. I cannot see my favorites anywhere.

Almost all of Favorites already ships, built sideways across five earlier
initiatives. The **Favorite** column has been in the schema since
`01-library-core` (`is_favorite INTEGER NOT NULL DEFAULT 0`, plus a partial
index), `setFavorite(id, value)` sits in the `curation` slice beside
`setRating`, `POST /api/movies/:id/favorite` is a **Single-signal write**
through `writeSignal`, and the heart itself is on every **Poster card** on both
browse screens and on the **Movie detail page**, each one wired through an
**Optimistic save**. CLAUDE.md's "mark from card and detail" is done.

What does not exist is the shelf. The **Favorites row** the prototype draws
(`page.LibraryPage.dc.html:181-219`) and the glossary already names has never
been built, and the `favoritesOnly` flag on `MovieQuery` — added in
`02-browse-grid` specifically for it — has **no caller anywhere in the app**.

So a parent can heart a film and then never find it again. Hearting is a write
into a void: the only way to see what is favorited is to scroll the genre rows
and look at the corner of every card. The one feature that would repay the
gesture is the one piece that was left out.

Two things make this more than "render one more row":

1. **It cannot be derived on the client.** The prototype's `favoritesList` is
   `filteredSorted().filter(m => favorites.includes(m.id)).slice(0,15)`, which
   is trivial because the prototype holds the whole library in memory. Ours does
   not — genre rows arrive capped at 15 by the server, and an **untagged** movie
   earns no genre row at all. Filtering what is already loaded would silently
   drop favorites the client never received.
2. **Un-favoriting from this row is a destructive optimistic edit.** The card
   must leave the shelf at once, but `useOptimisticSave` reverts by calling
   `apply(id, !value)` — if `apply` had removed the movie from state, a refused
   save would have nothing to put back.

## Solution

**A Favorites shelf on the browse home, built by the server like every other
section.**

Between the **Continue Watching row** and the **Genre rows**, a 22px serif
heading with an accent heart beside it, and a poster **Card carousel** of the
household's favorites underneath. When there are none, the row renders nothing
at all — no heading, no empty shelf — the same rule the Continue Watching row
already follows.

The section is built on the server, in `createHome`, as `listFavorites` — the
structural twin of `listContinueWatching`, differing only by which flag it sets:
`browse.listMovies({ ...query, favoritesOnly: true, limit: HOME_ROW_LIMIT })`.
No new SQL, no new repository primitive, no second endpoint. `GET /api/home`
needs no change at all — it already forwards the whole **Library query** to
`storage.getHome(query)`. The **Home payload** simply gains a third section,
declared in the order the screen renders it.

Because it is built from the same **Library query** as everything else, the row
obeys the header: a search term, a genre, a minimum rating and a sort order all
narrow it exactly as they narrow the genre rows. That is the invariant
`getHome` exists to protect — the top of the screen can never disagree with the
rest of it — and it is also what the prototype's `filteredSorted()` does.

**Un-favoriting from the shelf removes the card immediately, without removing
the movie from state.** The hook keeps every movie the payload sent and flips
flags on it; `FavoritesRow` renders `movies.filter((m) => m.favorite)`. The card
leaves at once — a shelf called Favorites holding something you just
un-favorited is lying to you — and if the save is refused the flag flips back
and the card returns. What the row renders is deliberately a _derived view_ of
hook state rather than the state itself, and that difference is load-bearing,
not cosmetic.

**One heart moves every card of that movie.** A favorite is on the Favorites
shelf _and_ in every genre row it is tagged with. Toggling any one of those
hearts updates both sections in a single `setData` — `withFavorite` over the
rows and `withFavoriteInList` over the favorites section. Two cards of one film
telling a parent different things is not a state we ship.

Chrome-wise, `RowSection` gains one optional `icon` slot, and **`FavoritesRow`
owns the heart's accent color, not `RowSection`.** `RowSection`'s docblock
commits it to being domain-blind; it must not learn that its icon is a heart or
that hearts are accent-coloured.

And the empty-library guard changes. It currently reads
`rows.length === 0 && continueWatching.length === 0`. A **watched, untagged**
favorite earns no genre row and no continue tile, so today's guard would print
"Your library is empty" directly above a populated Favorites row.

## User Stories

### Seeing the shelf

1. As a parent, I want a Favorites row on the home screen, so that the films I
   hearted are somewhere I can find them again.
2. As a parent, I want that row between Continue Watching and the genre rows, so
   that what I chose to keep sits above the general library but below what I am
   part-way through.
3. As a parent, I want the row headed "Favorites" with a heart beside it, so
   that I recognise it as the counterpart of the hearts I have been clicking.
4. As a parent, I want the heart in the heading to be the accent colour, so that
   the shelf reads as mine rather than as another genre.
5. As a parent, I want the row to hold poster cards identical to the ones in the
   genre rows, so that nothing about a film looks different for being favorited.
6. As a parent, I want to scroll the row with the same arrows as every other
   shelf, so that no new interaction has to be learned.
7. As a parent, I want a card in the row to open the movie's detail page, so
   that it behaves like every other card in the app.
8. As a parent, I want the row's heading to be the same size as a genre row's
   (22px), not Continue Watching's 24px, so that the screen's hierarchy stays
   the one the prototype drew.

### When there is nothing to show

9. As a parent, I want no Favorites row at all when I have favorited nothing, so
   that I am not shown an empty shelf asking me a question.
10. As a parent, I want no Favorites heading with an empty carousel under it, so
    that the screen does not reserve space for something that is not there.
11. As a parent with a brand-new empty library, I want to see "Your library is
    empty", so that the screen tells me the true reason it is blank.
12. As a parent whose only favorite is a watched, untagged film, I want the
    screen to show me that film's Favorites row rather than telling me my
    library is empty, so that the app never contradicts what it is displaying.
13. As a parent, I want the row hidden when a search or filter has excluded all
    of my favorites, so that a heading with nothing under it never appears.

### Favoriting and un-favoriting

14. As a parent, I want to un-favorite a film from its card in the Favorites
    row, so that I can prune the shelf from the shelf itself.
15. As a parent, I want the card to leave the row the instant I un-heart it, so
    that a shelf called Favorites never holds something I just un-favorited.
16. As a parent, I want the card to come back if the save fails, so that the
    screen never quietly loses a favorite it could not un-save.
17. As a parent, I want the row to reflow immediately when a card leaves, so
    that no gap is left where the card was.
18. As a parent, I want the heart on a film's card in the Drama row to fill when
    I heart that same film from the Favorites row, so that two cards of one film
    never disagree.
19. As a parent, I want a film I heart from a genre row to appear on the
    Favorites shelf's cards as favorited too, so that the state is one state.
20. As a parent, I want hearting a film from a genre row not to make the whole
    home screen reload, so that my place on the page is not lost.
21. As a maintainer, I want the server's echo to win over what the screen
    assumed, so that a save that stored something different is reflected rather
    than hidden.

### Under a query

22. As a parent, I want the Favorites row narrowed by my search term, so that
    the top of the screen agrees with the rest of it.
23. As a parent, I want the Favorites row narrowed when I pick a genre, so that
    choosing "Drama" gives me my favorite dramas rather than all my favorites.
24. As a parent, I want the Favorites row narrowed by the minimum-rating pill,
    so that a 4+ filter applies to my favorites too.
25. As a parent, I want the Favorites row in the sort order I chose, so that A-Z
    sorts my favorites A-Z.
26. As a parent, I want the whole screen — continue, favorites and genre rows —
    to update from a single request when I change the query, so that the
    sections cannot briefly disagree.
27. As a parent, I want a film I am part-way through _and_ have favorited to
    appear in Continue Watching, in Favorites, and in its genre rows, so that
    each shelf answers its own question.

### Loading, errors and limits

28. As a parent, I want the same three skeleton rows while the home loads, so
    that nothing new flashes in during a load.
29. As a parent, I want the Favorites row to arrive in the same paint as the
    rest of the home, so that no shelf pops in above rows that had already
    painted.
30. As a parent, I want a failed load to show one retryable error for the whole
    screen, so that I am not shown a partial home.
31. As a parent, I want the row to come back after a successful retry, so that
    recovery restores the whole screen.
32. As a parent, I want the row capped at 15 cards like every other shelf, so
    that the home screen stays a home screen.
33. As a maintainer, I want the cap applied by the server, so that the client is
    never handed a library-sized payload to trim.
34. As a maintainer, I want the row to have no "View all", matching the
    prototype, so that the build does not invent a page the design does not
    have.

### Accessibility

35. As a screen-reader user, I want the row exposed as a region named
    "Favorites", so that I can jump to it like any other shelf.
36. As a screen-reader user, I want the heart in the heading to be silent, so
    that the region is announced as "Favorites" and not decorated with an
    unlabelled graphic.
37. As a screen-reader user, I want the row's heading to be a level-2 heading
    like every other shelf's, so that the home screen's outline stays flat and
    consistent.
38. As a keyboard user, I want the cards and their hearts reachable exactly as
    they are in a genre row, so that nothing about this shelf needs new keyboard
    knowledge.

### Maintainer

39. As a maintainer, I want the section built from the database rather than
    filtered from what the client happens to hold, so that a favorite in no
    genre row is never silently lost.
40. As a maintainer, I want one request per home screen, so that adding a
    section does not add a round trip.
41. As a maintainer, I want `favoritesOnly` finally to have a caller, so that a
    query flag with no call site stops being dead weight.
42. As a maintainer, I want the dev seed's three favorites to appear on the
    shelf with no extra setup, so that the row can be checked by looking at it.

## Implementation Decisions

### The section is server-built, in the home aggregate

- `HomePayload` gains a third section: `favorites: Movie[]`, declared
  `continueWatching, favorites, rows` — the on-screen order.
- `createHome` gains `listFavorites(query)`, the structural twin of
  `listContinueWatching`: the caller's whole **Library query**, spread first,
  plus `favoritesOnly: true` and `limit: HOME_ROW_LIMIT`. Spreading the query
  first is what makes the row obey `search`, `genre`, `minRating` and `sort`.
- **No new SQL and no new repository primitive.** The home aggregate's own rule
  is that every section is a composition over `browse.listMovies` with a
  different flag; this keeps that true, and `favoritesOnly` already exists on
  `MovieQuery` and is already honoured by `browse.listMovies`.
- **No `/api/favorites` endpoint.** A second request for one screen is exactly
  what `/home` was built to avoid. `GET /api/home` needs no change — it already
  forwards the whole `LibraryQuery` to `storage.getHome(query)`.
- The cap is the shared `HOME_ROW_LIMIT` (15), not a favorites-specific one.
- Rejected: the prototype's `favoritesList` / `showFavorites` names. Those are
  template plumbing, not domain terms; `showFavorites` is `favorites.length > 0`
  computed at render time.

### The hook holds the section; the component derives what it renders

- `useHomeRows`'s internal `HomeSections` gains `favorites: PosterCardMovie[]`,
  mapped through the same `view()` a genre row's movies go through — the
  favorites section carries poster cards, so it maps like poster cards.
- `NO_SECTIONS` gains `favorites: []`, staying one frozen value so a memoised
  consumer is not re-rendered by a hook with nothing new to say.
- `UseHomeRowsResult` exposes `favorites`, empty unless `status` is `ready`.
- **`applyFavorite` reaches both sections in one `setData`** — `withFavorite`
  over `rows` and `withFavoriteInList` over `favorites`. This is the first place
  one optimistic edit has to touch two sections of the same payload, and it is
  the rule `withFavorite`'s docblock already states across rows, now applied
  across sections.
- **The hook never removes a movie from state.** It keeps every movie the
  payload sent and only flips flags. `FavoritesRow` renders
  `movies.filter((m) => m.favorite)`. Splicing the movie out would leave a
  refused save with nothing to restore, because `useOptimisticSave` reverts by
  calling `apply(id, !value)`.
- `useOptimisticSave` is used unchanged — no new hook, no new signature.

### `RowSection` gains one prop, and stays domain-blind

- One new optional prop: `icon?: ReactNode` — "an optional mark shown before the
  heading text".
- `Title` becomes `inline-flex; align-items: center; gap: 10px`. Inline-level,
  so `Header`'s existing `align-items: baseline` still lines a genre row's "View
  all" up with its heading.
- **`RowSection` does not colour the icon.** Its docblock commits it to knowing
  nothing about movies, genres or favorites; it must not learn that its icon is
  a heart or that hearts are accent-coloured. The accent colour and the
  prototype's `margin-top: 2px` optical nudge both live in
  `FavoritesRow.styles.ts`, in a wrapper around the icon.
- `HeartIcon` paints with `currentColor`, so the wrapper setting `color` is all
  the accent needs.

### `FavoritesRow` is its own feature component

- Props: `movies: PosterCardMovie[]`, `onOpenMovie?`, `onToggleFavorite?` — the
  same shape `GenreRow` takes minus the parts only a genre has.
- Composes `RowSection` (title `"Favorites"`, `titleSize` 22, `icon` the accent
  heart) around a `CardCarousel` with `variant="poster"`.
- Returns `null` when the filtered list is empty — no heading, no empty shelf.
  The same "a row with nothing on it is not a row" rule `ContinueRow` follows,
  and what the prototype's `showFavorites` guard does.
- **No "View all" action.** The prototype has none and `docs/handoff/` has no
  Favorites page. See Out of Scope.
- The icon is `<HeartIcon size={20} />` with **no `title`**, so `IconBase`
  renders it `aria-hidden`. `RowSection`'s `aria-labelledby` already names the
  region "Favorites".
- Heading size is 22 — a genre row's size, not Continue Watching's 24. Straight
  from the prototype.

### The screen

- `HomeRows` renders `FavoritesRow` between `ContinueRow` and the mapped genre
  rows, passing `openMovie` and `toggleFavorite`.
- **The empty-library guard gains a third term:** `favorites.length === 0` joins
  `rows.length === 0 && continueWatching.length === 0`. Without it, a watched,
  untagged favorite would print "Your library is empty" above a populated
  Favorites row. The search-miss and filter-miss branches inside the guard are
  unchanged.
- **No Favorites skeleton.** `LoadingRows`' three skeleton sections already
  stand in for the whole body, and the prototype has no favorites-shaped
  placeholder.

### Not reopened

The heart on the **Poster card**, the heart on the **Movie detail page**,
`POST /api/movies/:id/favorite`, `saveFavorite`, `setFavorite`, the
`is_favorite` column and its partial index, `favoritesOnly` in
`browse.listMovies`, `withFavorite` / `withFavoriteInList`, `useOptimisticSave`,
`CardCarousel` and `PosterCard` all ship, are tested, and are unchanged by this
work. The only additions are one payload section, one server function, one
feature component, one `RowSection` prop, and the wiring between them.

## Testing Decisions

A good test here asserts what a parent or a caller can observe: the shelf is on
screen, named, in the right place, holding the right films, and disappearing
when it should. It does not assert that `applyFavorite` was called, that
`setData` received a particular object, or that a styled-component emitted a
particular rule. Where the shelf's behaviour is a _consequence_ of an internal
choice — a filtered view rather than spliced state — the test asserts the
consequence (the card comes back after a refused save), never the mechanism.

Prior art is directly at hand: `home.test.ts`'s `getHome continue watching` and
`getHome under a Library query` blocks are the shape the server tests take;
`ContinueRow.test.tsx` is the shape `FavoritesRow.test.tsx` takes; and
`useHomeRows.test.tsx`'s existing `— the continue section` and
`— the favorite flag` blocks are the shape the hook tests take.

All six suites are in scope.

**`home.test.ts`** (extend) — a new `getHome favorites` block, mirroring the
continue-watching one:

- holds only favorites; a non-favorite is left out
- empty when nothing is favorited
- caps at 15, newest first
- lists a favorite here _and_ still in its genre row
- lists a favorite with no genre tags, which earns no row
- narrows off the same **Library query** (search, genre, minRating), and drops a
  favorite that fails it
- carries fully assembled `Movie` models, matching `getMovie`
- the payload-shape test extends to all three sections empty for an empty
  library

**`routes.test.ts`** (extend) — the wire contract:

- `GET /api/home` returns a `favorites` array alongside `continueWatching` and
  `rows`; the empty-library assertions become
  `{ continueWatching: [], favorites: [], rows: [] }`
- the section narrows under query params on the request

**`useHomeRows.test.tsx`** (extend) — a `— the favorites section` block and
additions to `— the favorite flag`:

- maps the favorites section into render-ready poster cards through `view()`
- reports all three sections in the one ready transition, from the one request
- holds no favorites when the load fails; restores them on retry
- un-favoriting a movie in the favorites section flips its flag but **keeps it
  in state**, observed by the card returning when the save is refused
- one toggle moves the movie's flag in the favorites section **and** in every
  genre row it appears in
- the route's echo wins over the assumed value, in both sections

**`RowSection.test.tsx`** (extend) — the new slot:

- renders the icon before the heading text when given one
- renders no icon at all when not given one
- the region's accessible name is still the title alone, undisturbed by a
  decorative icon
- a trailing action and a leading icon coexist

**`FavoritesRow.test.tsx`** (new) — the component:

- exposes a region and a level-2 heading named "Favorites"
- renders a poster card per favorite
- renders **only** the favorites in the list it is handed — a non-favorite
  passed in does not appear
- renders `null` when handed no movies, and `null` when handed only
  non-favorites (no heading, no region)
- opening a card calls `onOpenMovie` with that movie's id
- clicking a card's heart calls `onToggleFavorite` with the id and the negated
  value
- the heading heart is not announced

**`HomeRows.test.tsx`** (extend) — the screen:

- the Favorites row renders between Continue Watching and the genre rows
- a library whose only content is favorites does **not** show "Your library is
  empty"
- "Your library is empty" still shows when all three sections are empty
- the search-miss and filter-miss copy is unchanged when all three are empty

## Out of Scope

- **A Favorites page behind a "View all".** The prototype's Favorites section
  has no trailing action and `docs/handoff/` has no Favorites page, so the
  15-cap every **Home section** takes has nothing behind it here — a 16th
  favorite is unreachable from any route in the app. Per CLAUDE.md that is a
  prototype amendment, not an improvisation mid-build. **Recorded as a known gap
  and filed as issue 67** for the prototype to be amended first.
- **A Favorites filter pill in the header.** "Favorites" is a shelf, not a
  filter: there is no favorites **Filter dropdown**, no `favoritesOnly` in a
  **Library query**, and no `/favorites` route. The flag stays on the
  repository's `MovieQuery` only.
- **Per-person favorites.** FamilyFlix is one shared household profile.
- **Re-grilling the heart on the Poster card or the Movie detail page.**
  Shipped, tested and refactored.
- **Any change to the favorite write path** — the route, `writeSignal`,
  `saveFavorite`, `setFavorite`, the column or its index.
- **A Favorites skeleton.** `LoadingRows`' three sections cover the whole body.
- **Reordering favorites, or a manual sort of the shelf.** The row takes the
  header's sort like every other section.

## Further Notes

**What gets easier.** Every section of the home becomes one composition over
`browse.listMovies` with a different flag — a fourth shelf would cost one
function. `favoritesOnly` finally has a caller, so a flag with no call site
stops being dead weight. And `RowSection` gets the icon slot its docblock
promised was coming ("the prototype has a third of them coming — Favorites, 22px
with a leading icon"), so nothing about it has to be reopened.

**What gets harder.** This is the first place one optimistic edit has to reach
two sections of the same payload, so `applyFavorite` is correspondingly less
obvious than the single-section version it replaces. And the row's rendered
contents are now a _derived_ view of hook state (`filter`) rather than the state
itself — the price of making the revert possible, and worth stating plainly
because the next person to read `FavoritesRow` will wonder why it filters a list
that is already called `favorites`.

**Checking it by looking.** The dev seed already marks three movies as
favorites, so `npm run db:seed` and the browse home is enough to see the shelf
with real data from the real database.

**Ubiquitous language.** The glossary is already updated for this feature —
**Favorites row**, **Home section**, **Row section** and the amended
**Favorite** and **Home payload** entries all landed with the design log, along
with the three flagged gaps and the invariants covering the two-section edit and
the derived render.

**Design log:** `docs/design-logs/08-favorites.md`.
