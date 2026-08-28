# Plan: Favorites (the shelf the hearts have been feeding)

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/66

Almost all of Favorites already ships. `is_favorite` and its partial index have
been in the schema since `01-library-core`, `curation.setFavorite` beside
`setRating`, `POST /api/movies/:id/favorite` is a **Single-signal write**
through `writeSignal`, and the heart is on every **Poster card** and on the
**Movie detail page**, each wired through an **Optimistic save**. What has never
been built is the shelf those hearts have been feeding, and `favoritesOnly` —
added to `MovieQuery` in `02-browse-grid` for exactly this — still has no caller
anywhere in the app.

**No migration, no new endpoint, no new repository primitive.** The whole
feature is one payload section, one server function that spreads the caller's
query and sets a flag, one feature component, one optional prop on `RowSection`,
and the wiring between them.

Phase 1 is the tracer bullet: it cuts from `browse.listMovies` through the home
aggregate, the wire, the hook and a new row onto the screen, and it is demoable
by seeding and looking at the browse home. Phase 2 puts the prototype's accent
heart in the heading by giving `RowSection` the icon slot its docblock already
promised. Phase 3 makes the shelf prunable, which is where the two interesting
decisions — one edit reaching two sections, and a rendered list that is a
derived view of hook state — actually land. Phase 4 closes the docs.

**Two ordering calls against the PRD's own section order**, both so that no
phase ships a line whose justification arrives later:

- **The empty-library guard's third term rides in Phase 1**, not in a phase of
  its own. Splitting it would have Phase 1 knowingly print "Your library is
  empty" directly above a populated Favorites row whenever the only favorite is
  watched and untagged — story 12's exact contradiction, shipped on purpose and
  fixed later. The guard belongs to the phase that puts the row on screen.
- **`FavoritesRow`'s `movies.filter((m) => m.favorite)` lands in Phase 3**, not
  Phase 1. Until an optimistic un-favorite can flip a flag in place, nothing in
  the list can fail that filter, and a reviewer reading Phase 1 would rightly
  ask why a list called `favorites` is being filtered for favorites. It arrives
  with the revert it exists to make possible.

**One intermediate state worth naming.** Phase 1 renders real poster cards, so
the heart is drawn on them — and until Phase 3 passes `onToggleFavorite` down,
clicking it does nothing. That is the honest cost of slicing the row before the
two-section edit, and it is one phase long.

## Architectural decisions

Durable decisions that apply across all phases:

- **Payload**: `HomePayload` gains a third section, `favorites: Movie[]`,
  declared `continueWatching, favorites, rows` — the order the screen renders
  them in. Named sections were chosen in `02-browse-grid` precisely so a section
  could join without breaking the ones already there; this is the first time
  that is cashed in.
- **Routes: unchanged.** `GET /api/home` already forwards the whole **Library
  query** to `storage.getHome(query)` and serialises whatever comes back. There
  is no `/api/favorites` — a second request for one screen is what `/home` exists
  to avoid — and no `/favorites` route in the app.
- **Schema: unchanged.** No migration, no new SQL, no new repository primitive.
  `favoritesOnly` already exists on `MovieQuery` and is already honoured by
  `browse.listMovies`; this feature is its first caller.
- **Every home section is one composition over `browse.listMovies` with a
  different flag.** `listFavorites(query)` is the structural twin of
  `listContinueWatching(query)`: the caller's whole query spread first, then
  `favoritesOnly: true` and `limit: HOME_ROW_LIMIT`. Spreading first is what
  makes the shelf obey `search`, `genre`, `minRating` and `sort` — the invariant
  `getHome` exists to protect, that the top of the screen can never disagree
  with the rest of it.
- **The cap is the shared `HOME_ROW_LIMIT` (15)**, applied by the server, not a
  favorites-specific limit and never a client-side trim.
- **No "View all", and therefore no Favorites page.** The prototype's section
  has no trailing action and `docs/handoff/` has no Favorites page, so the 16th
  favorite is genuinely unreachable. That is a recorded gap, filed as issue 67
  for the prototype to be amended first — not something this build improvises.
- **The hook holds the section; the component derives what it renders.**
  `useHomeRows` keeps every movie the payload sent and only ever flips flags on
  it; `FavoritesRow` renders `movies.filter((m) => m.favorite)`. Splicing a
  movie out of state would leave a refused save with nothing to restore, because
  `useOptimisticSave` reverts by calling `apply(id, !value)`.
- **One optimistic edit reaches both sections in a single `setData`** —
  `withFavorite` over `rows`, `withFavoriteInList` over `favorites`. Two cards
  of one film telling a parent different things is not a state we ship.
  `useOptimisticSave` itself is used unchanged: no new hook, no new signature.
- **`RowSection` stays domain-blind.** It gains exactly one prop,
  `icon?: ReactNode`, described as an optional mark before the heading text. It
  must not learn that its icon is a heart or that hearts are accent-coloured —
  the colour and the optical nudge live in `FavoritesRow.styles.ts`.
- **Favorites is a shelf, not a filter.** No favorites pill in the header, no
  `favoritesOnly` on a **Library query**; the flag stays on the repository's
  `MovieQuery`. The row takes the header's sort like every other section.
- **Nothing on the write path is reopened** — the route, `writeSignal`,
  `saveFavorite`, `setFavorite`, the column, its index, `withFavorite` /
  `withFavoriteInList`, `CardCarousel` and `PosterCard` all ship and are
  unchanged by this work.

---

## Phase 1: The shelf, from the database to the screen

**User stories**: 1, 2, 5, 6, 7, 8, 9, 10, 11, 12, 13, 22, 23, 24, 25, 26, 27,
28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 39, 40, 41, 42

### What to build

One thin cut through every layer. The home aggregate gains `listFavorites`,
built the way `listContinueWatching` is built and differing only by the flag it
sets, and `getHome` returns its result as the payload's middle section.
`GET /api/home` needs no change to serve it. The hook's internal sections gain
`favorites`, mapped through the same `view()` a genre row's movies go through,
with `NO_SECTIONS` staying one frozen value; the result exposes them, empty
unless `status` is `ready`. `FavoritesRow` composes `RowSection` at 22px around
a poster `CardCarousel`, returns `null` when it has nothing to show, and takes
no "View all". `HomeRows` renders it between `ContinueRow` and the mapped genre
rows.

The empty-library guard gains its third term in the same phase. A watched,
untagged favorite earns no genre row and no continue tile, so without it the
screen would print "Your library is empty" above a populated shelf. The
search-miss and filter-miss branches inside the guard are untouched.

Because the section is built from the same **Library query** as everything else,
obeying the header costs nothing to implement and everything to assert — the
narrowing tests are the point of the phase, not a bonus.

Two things are deliberately absent and arrive later: the heading's heart
(Phase 2) and a working heart on the cards in this row (Phase 3). The cards are
real `PosterCard`s, so their hearts are drawn; with no `onToggleFavorite` passed
down they do nothing for one phase.

### Acceptance criteria

- [ ] `getHome` returns a `favorites` section holding only favorites, newest
      first, with a non-favorite left out
- [ ] The section is `[]` when nothing is favorited, and all three sections are
      `[]` for an empty library
- [ ] It caps at 15
- [ ] A favorite appears in `favorites` **and** still in each of its genre rows,
      and a favorite with no genre tags appears in `favorites` though it earns
      no row at all
- [ ] A movie that is in progress and favorited appears in `continueWatching`,
      in `favorites`, and in its genre rows
- [ ] The section narrows off the same **Library query** — `search`, `genre` and
      `minRating` each drop a favorite that fails it — and comes back in the
      `sort` the query asked for
- [ ] It carries fully assembled `Movie` models, matching what `getMovie`
      returns
- [ ] `GET /api/home` returns `favorites` alongside `continueWatching` and
      `rows`; the empty-library response is
      `{ continueWatching: [], favorites: [], rows: [] }`
- [ ] The section narrows under query params on the request, in one round trip —
      no second endpoint, no second fetch
- [ ] The hook maps the section into render-ready poster cards through `view()`
      and reports all three sections in the one ready transition
- [ ] The hook holds no favorites while loading or after a failed load, and
      restores them on a successful retry
- [ ] `FavoritesRow` exposes a region and a level-2 heading named "Favorites",
      and renders one poster card per movie
- [ ] It returns `null` when handed no movies — no heading, no region, no empty
      carousel
- [ ] Opening a card calls `onOpenMovie` with that movie's id
- [ ] It renders no "View all" control
- [ ] The row's heading is 22px — a genre row's size, not Continue Watching's 24
- [ ] `HomeRows` renders the row between Continue Watching and the genre rows
- [ ] A library whose only content is a watched, untagged favorite shows that
      film's Favorites row and **not** "Your library is empty"
- [ ] "Your library is empty" still shows when all three sections are empty, and
      the search-miss and filter-miss copy is unchanged
- [ ] The row is hidden when a search or filter has excluded every favorite
- [ ] The same three skeleton rows show while the home loads, and one retryable
      error covers the whole screen when it fails
- [ ] `npm run db:seed` then the browse home shows the seed's three favorites on
      the shelf, in the header's sort, narrowing with the search box, the genre
      dropdown and the rating pill

---

## Phase 2: The heart in the heading

**User stories**: 3, 4, 36

### What to build

`RowSection` gains one optional prop, `icon?: ReactNode` — an optional mark
shown before the heading text — and `Title` becomes
`inline-flex; align-items: center; gap: 10px`. Inline-level is load-bearing:
`Header`'s existing `align-items: baseline` must keep lining a genre row's
"View all" up with its heading.

`RowSection` does not colour the icon. Its docblock commits it to knowing
nothing about movies, genres or favorites, and an accent heart is domain
knowledge. `FavoritesRow` passes `<HeartIcon size={20} />` inside a wrapper in
its own styles file that sets the accent colour and the prototype's
`margin-top: 2px` optical nudge; `HeartIcon` paints with `currentColor`, so
setting `color` on the wrapper is all the accent needs.

The icon is passed with no `title`, so `IconBase` renders it `aria-hidden` and
`RowSection`'s `aria-labelledby` keeps naming the region "Favorites" alone.

### Acceptance criteria

- [ ] `RowSection` renders the icon before the heading text when given one, and
      no icon at all when not
- [ ] The region's accessible name is still the title alone, undisturbed by a
      decorative icon
- [ ] A trailing action and a leading icon coexist, with the action still
      baseline-aligned to the heading
- [ ] Every existing `RowSection` caller — `GenreRow` and `ContinueRow` — is
      unchanged and still renders as it did
- [ ] The Favorites heading shows a 20px heart in the accent colour, before the
      word "Favorites"
- [ ] The heading heart is not announced by a screen reader
- [ ] `RowSection` contains no reference to hearts, favorites or the accent
      colour
- [ ] The rendered heading matches `page.LibraryPage.dc.html:181-219` — 22px
      serif, 10px gap, 2px nudge

---

## Phase 3: Pruning the shelf

**User stories**: 14, 15, 16, 17, 18, 19, 20, 21

### What to build

The shelf becomes editable from the shelf. `HomeRows` passes `toggleFavorite`
into `FavoritesRow`, whose cards hand back the id and the negated value exactly
as a genre row's do.

`applyFavorite` reaches both sections in one `setData` — `withFavorite` over
`rows`, `withFavoriteInList` over `favorites` — so a heart clicked anywhere on
the screen moves every card of that film at once, with no reload and no lost
scroll position. This is the first place one optimistic edit has to touch two
sections of the same payload, and it deserves a comment saying so.

The hook still never removes a movie from state. `FavoritesRow` renders
`movies.filter((m) => m.favorite)` instead, so the card leaves the shelf the
instant it is un-hearted and the row reflows — and if the save is refused,
`useOptimisticSave`'s `apply(id, !value)` flips the flag back and the card
returns, which it could not do if the movie had been spliced out. The filter
lands here, with the revert it exists to serve, and its docblock says plainly
why a list called `favorites` is filtered for favorites.

### Acceptance criteria

- [ ] Clicking a card's heart in the Favorites row calls `onToggleFavorite` with
      that movie's id and the negated value
- [ ] The card leaves the row immediately when un-hearted, and the row reflows
      with no gap where it was
- [ ] `FavoritesRow` renders only the favorites in the list it is handed — a
      non-favorite passed in does not appear — and returns `null` when handed
      only non-favorites
- [ ] A refused save brings the card back, proving the movie was never removed
      from state
- [ ] One toggle moves the movie's flag in the favorites section **and** in
      every genre row it appears in, in a single update
- [ ] Hearting a film from a genre row shows it on the Favorites shelf with its
      heart filled, and un-hearting it from the shelf empties the heart on its
      Drama card
- [ ] Neither toggle refetches the home or resets the page's scroll position
- [ ] The route's echo wins over the assumed value, in both sections
- [ ] Cards and their hearts are reachable by keyboard exactly as they are in a
      genre row
- [ ] Checked by hand on the seed: un-heart a film on the shelf, watch it leave,
      reload, and it is still gone

---

## Phase 4: Docs and the tick

**User stories**: none directly — the record the previous three leave behind

### What to build

The dev-journal entry, recorded as what this feature actually was: a shelf that
five earlier initiatives had already built every piece of except the shelf
itself, and the first time a query flag shipped ahead of its only caller. Worth
writing down as the pattern to watch for, not just as a feature that landed.

It also records the two decisions the phases made in passing — one optimistic
edit reaching two sections, and a row whose rendered contents are a derived view
of hook state — since both are precedents the next shelf will follow.

The glossary is already updated (it landed with the design log), so this phase
confirms the shipped vocabulary matches it rather than rewriting it.

Favorites is ticked ✅ in README and CLAUDE.md **only after this feature's
refactor issue closes**, keeping the feature list meaning what it has meant for
the seven features before it. Issue 67 — the missing route past the 15th
favorite — stays open as a recorded prototype gap and does not block the tick.

### Acceptance criteria

- [ ] `docs/dev-journal.md` records the feature, the flag that shipped without a
      caller, and the two precedents Phase 3 set
- [ ] `docs/ubiquitous-language.md` matches what shipped — **Favorites row**,
      **Home section**, **Row section**, and the amended **Favorite** and **Home
      payload** entries
- [ ] Issue 67 is still open and referenced as the known gap behind the 15-cap
- [ ] `request-refactor-plan` has been run and its issue filed
- [ ] README and CLAUDE.md are ticked ✅ for Favorites only once that refactor
      issue is closed
