# Plan: Search + Filter + Sort (the browse home's header controls)

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/30

Fills the gap `MainLayout`'s header has carried since `02-browse-grid` — the
docblock that calls it "deliberately partial" names the four controls this
feature builds. Nothing new is stored and no schema moves: `MovieQuery` has
carried `search`, `genre`, `minRating` and `sort` since Library Core, and
`buildListQuery` already assembles every one of them into parameterized SQL.
What this feature builds is the path from a header control to that query, and
the two arms of `search` (synopsis, genre name) that the prototype implies and
the repository does not yet have.

Phase 1 is a server slice with its route attached, verifiable by curling a
seeded database — the same shape as 04's Phase 2. Phase 2 puts the first
control on the screen and is the point the feature becomes demoable to a
parent. Phases 3–5 each add one dropdown, in ascending order of what they need:
sort needs no new endpoint, so `FilterDropdown` gets built against the simplest
possible option list; genre needs a new one; rating needs nothing but a table.
Phase 6 closes the docs and files the two follow-ups this work generates.

**One deviation from the design log's build order:** empty-row dropping moves
from the genre slice into Phase 1. A search that narrows the library but leaves
every genre row standing renders a screenful of empty rows — so the drop rule
belongs with the first filter that can empty a row, not the third. Single-row
narrowing (the genre-filter precedence rule) stays in Phase 4, where its filter
lands.

## Architectural decisions

Durable decisions that apply across all phases:

- **The query lives in the URL.** `/?q=&genre=&rating=&sort=` on `/` is the
  entire state of this feature. No component state above the controls, no
  context provider. The router is already the mechanism; a second one would
  duplicate it, and state in `LibraryPage` would breach the composition-only
  layer rule _and_ be dropped on every navigation to a movie and back — taking
  `useRestoredScroll`'s offset with it. The controls only ever **write** the
  URL; `HomeRows` and the dropdowns' own selected values only ever **read** it.
- **The app URL and the API use the same parameter names** — `q`, `genre`,
  `rating`, `sort`. Translation to domain names (`q`→`search`,
  `rating`→`minRating`) happens at the route boundary that already does that
  translation, and nowhere else.
- **Every parameter is omitted at its default**, so an unfiltered home is a
  clean `/`. `sort` uses the `MovieSort` slugs already on the wire
  (`recently-added`, `a-z`, `year`, `highest-rated`, `unwatched-first`);
  `rating` is the numeric minimum in stored half-star units (0–10).
- **URL writes use `replace: true`.** Typing must not stack a history entry per
  keystroke between the home and the movie opened from it. Accepted
  consequence: each settled query mints a fresh history key, so the changed
  view starts at the top — correct for a reshuffled list, but a consequence
  rather than a goal, and worth remembering if scroll behaviour is revisited.
- **One pure module makes a hostile URL safe.** `parseLibraryQuery` turns
  `URLSearchParams` into a `HomeQuery`: unknown sort falls back to the default,
  a non-numeric or out-of-range rating is dropped, an empty string is treated
  as absent. A stale bookmark from an older build opens rather than crashes.
- **Routes**: `GET /api/home` grows `q` / `genre` / `rating` / `sort` parsing,
  reusing the existing `queryString` / `isMovieSort` helpers; an unknown `sort`
  or an unparseable `rating` is a `400`, matching `/api/movies`. `GET /api/genres`
  is new → `{ total, genres }`. Its own endpoint rather than a field on
  `HomePayload`, because it has a **different lifetime** — fetched once per
  mount, where `/home` refetches per settled query — and because two consumers
  in two subtrees would otherwise need the shared-payload provider that the URL
  strategy exists to avoid. Rejected: `/api/movies` gaining `q` / `rating` —
  nothing calls it with those until GenrePage exists.
- **Schema: no migration.** `countMovies()` is the only new SQL in the feature,
  and it is a `SELECT COUNT(*)`. The "All Genres" count is a count of
  **movies**, so it cannot be a sum of genre counts — that double-counts every
  movie tagged twice.
- **`getHome` stays a composition over `browse.listMovies`**, as `createHome`'s
  docblock promises: it grows a `HomeQuery` parameter and merges it with each
  section's own additions (`genre` + `limit` for a row, `inProgressOnly` +
  `limit` for continue). One Library query, one Home payload — the genre rows
  and the Continue Watching row narrow together, so the top of the screen can
  never disagree with the rest of it.
- **The filtering happens on the server.** Filtering the payload already held
  would search 15 of a genre's 40 movies and silently miss the other 25 — and
  every user-facing symptom of that bug looks exactly like "we don't own that
  film."
- **Key models**:
  - `HomeQuery` — `{ sort: MovieSort; search?: string; genre?: string; minRating?: number }`,
    in the browse types. Deliberately a subset of `MovieQuery`: no `limit`, no
    `favoritesOnly`, no `inProgressOnly`, because those belong to the aggregate,
    which sets them itself per section.
  - `GenreListPayload` — `{ total: number; genres: GenreCount[] }`.
  - `FilterOption` — `{ label: string; count?: number; selected: boolean; onSelect: () => void }`,
    in the view models, since `FilterDropdown` renders it and three callers build it.
- **`FilterDropdown` is built on `Menu`.** The dismissal contract this needs —
  Escape, outside pointerdown, select-to-close, focus back to the trigger —
  already exists, and `Menu`'s docblock already names "a filter dropdown" as an
  intended client. It also buys the prototype's single-open behaviour for free,
  with no coordinating state anywhere. **Consequence, deliberate:** the
  prototype's `open` / `onToggle` props are dropped, because `Menu` owns open
  state. `Menu` gains only what a filter list needs.
- **`features/search/` owns all four controls**, not just the text one.
  CLAUDE.md's folder structure reserves it for "search-as-you-type, filters",
  which outranks COMPONENT-SPEC's `features/library/LibraryHeader` suggestion.
  `useHomeRows` stays in `features/library` and reads the URL itself via
  `useSearchParams` — app-level state, not a sibling feature's module — so no
  import ever crosses between the two features.
- **The debounce lives in `LibrarySearch` and nowhere else.** Local input state
  for instant typing, a 250ms debounced URL write. `LibrarySearch` is the only
  holder of un-settled input in the app; everything downstream treats the URL
  as the settled query and knows nothing about debouncing.
- **The skeleton does not come back.** Skeleton rows on first load only; after
  that the rows on screen stay until the new ones arrive. Flashing the whole
  screen every 250ms of typing would be unreadable.
- **`HomeRows` owns the miss**, as its docblock already anticipates. It reads
  `q` for the copy — no import from `features/search` — and distinguishes a
  search miss (quotes the text back) from a filter-only miss (talks about
  filters), which the prototype conflates into a string that renders as empty
  quotes when nobody typed anything.
- **Testing pattern**: every test states a fact about behaviour a user or a
  caller can observe — what comes back from a query, what is on the screen,
  what is in the URL — and would still pass if the module were rewritten
  underneath. No test asserts on a SQL string, on which hook holds which piece
  of state, on styled-components class names, or on `Menu`'s internal context.
  Server tests use real SQLite temp files with nothing mocked, per
  `browse.test.ts` / `home.test.ts` / `routes.test.ts`.

---

## Phase 1: Search on the server, end to end

**User stories**: 3, 4, 5, 6, 8, 41, 42

### What to build

The whole search path from HTTP down to SQL, with no UI. `browse`'s `search`
widens from a title substring to **title or synopsis or genre name**, the genre
arm reusing the `m.id IN (SELECT …)` subquery shape the genre filter already
uses so the row set stays one row per movie however many genres it carries. The
widened `WHERE` stays expressed entirely over the `movies m` alias, so
`assembleMany` keeps re-running it as a subquery for the batched child reads
with no change. `searchMovies(text)` widens with it — it is documented as
"equivalent to a `listMovies` call with the `search` filter" and should keep
meaning that — and the three "title substring" docblocks (`searchMovies`,
`MovieQuery.search`, the `LibraryStorage` interface comment) are corrected.

`getHome` grows a `HomeQuery` parameter and threads it into **both**
`listMovies` calls, so the rows and the continue section narrow off one query.
Rows whose `movies` came back empty are dropped; a row's `count` still comes
from `listGenres()`, so it stays the genre's unfiltered total. `GET /api/home`
parses `q` and passes it through. An argument-less request returns exactly what
it returns today.

Verified by curling a seeded database and by tests; nothing changes on screen.

### Acceptance criteria

- [ ] `listMovies({ search })` matches on title, on synopsis, and on genre
      name, case-insensitively on each, and returns `[]` for a fragment nothing
      holds.
- [ ] A movie whose title **and** genre both match the term comes back exactly
      once.
- [ ] `search` combines correctly with `genre`, with `minRating`, and with each
      of the five sorts.
- [ ] The assembled genres and subtitles are still correct under a widened
      search — the `assembleMany` subquery path is unaffected.
- [ ] `searchMovies`'s existing tests are extended to the widened semantics, and
      all three "title substring" docblocks are corrected.
- [ ] `getHome(query)` narrows both the genre rows and the continue section off
      the one query, and drops rows that matched nothing.
- [ ] A narrowed row's `count` is still the genre's unfiltered total, and rows
      still cap at 15 with a filter active.
- [ ] An in-progress movie that fails the query leaves the continue section.
- [ ] `getHome` with an empty query returns exactly what today's `getHome()`
      returns — a regression guard on the signature change.
- [ ] `GET /api/home?q=` parses the term into the query, treats an empty value
      as absent, and an argument-less request is unchanged.
- [ ] `HomeQuery` is exported from the browse types and `LibraryStorage`'s
      `getHome` signature is updated.

---

## Phase 2: Search in the header

**User stories**: 1, 2, 7, 9, 31, 32, 33, 34, 35, 36, 37, 40, 43, 44, 45, 48

### What to build

The search box on the screen, steering Phase 1 through the URL. `TextField`
(primitive) takes `value`, `placeholder?`, `icon?: ReactNode`, `onChange` and
`aria-label` — the icon is a **slot, not the prototype's enum**, per
COMPONENT-SPEC §3a, and `mono` / `rounded` / `height` arrive with the callers
that need them. `SearchIcon` is lifted out as its own atom by the same rule.
`SearchBar` (component) composes them with a 460px default `maxWidth`; the
prototype's `grow` prop lands with its second caller.

`MainLayout` gains optional `headerStart` and `headerEnd` slots around its
existing `Spacer`, matching where the prototype puts the search bar and the
dropdowns. Structure only — it learns nothing about the library domain, and
every other page renders unchanged.

`features/search/` gets its first four modules: `parseLibraryQuery`,
`useLibraryQuery` (q only this phase), and `LibrarySearch` — the `headerStart`
control, with local input state for instant typing and a 250ms debounced URL
write. `useHomeRows` reads the settled query from the URL, refetches when it
changes, and **keeps the current rows on screen during that refetch**.
`HomeRows` gains both no-results messages.

At the end of this phase a parent can type "lighthouse" and watch the rows
narrow.

### Acceptance criteria

- [ ] `TextField` renders its value, reports typing, and its icon slot is
      decorative — out of the accessible name.
- [ ] `SearchBar` matches `mol.SearchBar` 1:1 in layout, tokens and states.
- [ ] `MainLayout` renders `headerStart` before the spacer and `headerEnd`
      after it, and renders unchanged when neither is given.
- [ ] `parseLibraryQuery` parses `q`, defaults when absent, treats an empty
      string as absent, and ignores unrelated parameters.
- [ ] `useLibraryQuery` reads the settled query from the URL; the setter
      preserves other parameters, **removes** its own at the default value, and
      every write is `replace`.
- [ ] `LibrarySearch` updates the field immediately on every keystroke but
      writes the URL **once** after the debounce settles (fake timers).
- [ ] Clearing the field removes `q` from the URL rather than writing `q=`.
- [ ] `useHomeRows` refetches when the settled query changes, **keeps the
      previous rows and does not return to `loading`** during that refetch, and
      still shows the skeleton on the very first load.
- [ ] A stale in-flight response cannot overwrite a newer one, and the existing
      favorite-toggle behaviour is unaffected.
- [ ] An empty result with `q` set renders "Nothing here" / "No movies match
      “{q}”. Try a different search or genre."
- [ ] An empty result with no query active still renders "Your library is
      empty".
- [ ] Opening a movie and pressing Back returns to the filtered view with the
      search text still in the box, and one press of Back escapes a search of
      any length.
- [ ] An unfiltered home is a clean `/` with no query string.

---

## Phase 3: Sort

**User stories**: 20, 21, 22, 23, 24, 25, 27, 28, 29, 30, 39, 49

### What to build

The first dropdown, and the shared machinery all three need. `Menu` gains
exactly what a filter list requires: `MenuItem` `selected` (accent + 600 weight

- `aria-current="true"`) and `trailing` (the right-floated count), and `Panel`
  gets `max-height: 340px; overflow-y: auto` — sized for a twelve-genre list,
  inert for the four-item edit menu. `menuWidth` rides in through a
  styled-components component selector on `Panel`, so `Menu` needs no prop for it.
  Existing dismissal behaviour is untouched.

`FilterDropdown` (component) takes `label`, `showLabel?`, `value`, `options`,
`leadingStar?`, `menuWidth?`. `label` is **always required and always forms the
accessible name** — rather than an `aria-label` prop a caller can forget.
Because it is built on `Menu`, the prototype's `open` / `onToggle` are dropped
and only one dropdown is ever open at a time, with no coordinating state.

`LibraryFilters` lands as the `headerEnd` control carrying the sort dropdown
alone; `sort` joins the URL query, `parseLibraryQuery` and the route. Sort is
second on purpose: it needs no new endpoint, so `FilterDropdown` is built
against the simplest possible option list.

Options render in the **prototype's order** — Recently Added · Title (A–Z) ·
Year · Unwatched First · Highest Rated — which is deliberately not the
declaration order of `MovieSort`.

### Acceptance criteria

- [ ] `MenuItem` `selected` marks an item with `aria-current` without changing
      what selecting it does; `trailing` renders and is **not** part of the
      item's accessible name.
- [ ] `Menu`'s existing dismissal tests still pass unchanged.
- [ ] `FilterDropdown`'s pill shows the current value when shut; opening lists
      the options; choosing one calls `onSelect` and closes the panel.
- [ ] The selected option is marked `aria-current`; a count renders when
      present and nothing renders when absent.
- [ ] With `showLabel={false}` the accessible name still carries the label.
- [ ] Opening one dropdown closes any other; Escape and an outside click both
      close, returning focus to the trigger.
- [ ] All controls are reachable and operable from the keyboard.
- [ ] `parseLibraryQuery` parses each sort slug and falls back to the default
      for an unknown one.
- [ ] `GET /api/home?sort=` applies each of the five sorts inside the rows, and
      `400`s an unknown sort.
- [ ] Selecting a sort writes the URL and the rows re-order; the default sort
      writes no parameter.
- [ ] Sort and search combine — a sorted search is one query, not two.

---

## Phase 4: Genre filter

**User stories**: 10, 11, 12, 13, 14, 15, 16, 26, 46, 47

### What to build

The Genre dropdown and the second endpoint behind it. `countMovies(): number`
joins the browse slice; `GET /api/genres` returns
`{ total: countMovies(), genres: listGenres() }`.

In `features/search/`: `api.fetchGenreList()`, `useGenreList` (loads once **per
mount**, not per query change — and **on failure resolves to an empty list**, so
the Genre dropdown renders with "All Genres" alone and the other three controls
are unaffected; no retry loop, no error surface, because the prototype designs
none), and `genreOptions` — a pure mapper putting "All Genres" first with the
library total, then genres by count descending with an alphabetical tiebreak.

`genre` joins the URL query and the route, with one deliberate precedence rule
in `getHome`: **when the query carries a genre, only that genre's row is
built.** A row's `count` still comes from `listGenres()`, so "View all 24" keeps
saying 24 while the row shows the three that matched.

The counts are fetched once and never per query precisely so the list cannot
reshuffle under a finger that is already reaching for it.

### Acceptance criteria

- [ ] `countMovies` counts movies, not tags — a movie in three genres counts
      once — and returns `0` on an empty library.
- [ ] `GET /api/genres` returns `{ total, genres }`, with `total` a movie count
      rather than a sum of genre counts, and `{ total: 0, genres: [] }` on an
      empty library.
- [ ] `useGenreList` fetches once per mount, **not** on every query change.
- [ ] A failed `/api/genres` resolves to an empty list rather than throwing, and
      search, rating and sort keep working.
- [ ] `genreOptions` puts "All Genres" first carrying `total`, then orders by
      count descending with an alphabetical tiebreak.
- [ ] Exactly one option is `selected`; "All Genres" is selected when no genre
      is set; an empty genre list still yields the single "All Genres" option.
- [ ] Each genre option shows its count in the dropdown.
- [ ] Selecting a genre leaves **exactly one row** on screen; selecting "All
      Genres" removes the parameter and restores every row.
- [ ] A narrowed row's "View all {count}" still reports the genre's unfiltered
      total.
- [ ] Genre combines with search and with sort in a single query.
- [ ] An empty result from filters alone renders "Nothing here" / "No movies
      match these filters. Try a different genre or rating." — not the search
      copy with empty quotes.

---

## Phase 5: Rating filter

**User stories**: 17, 18, 19, 38

### What to build

The last dropdown, and the smallest slice — everything it needs already exists.
The option table is **All ratings · 4+ stars · 3+ stars · 2+ stars** →
`minRating` unset / 8 / 6 / 4, since ratings are stored in 0–10 half-star units.
The labels are written in stars rather than numbers so nobody has to know how
the app stores a rating.

`FilterDropdown`'s `leadingStar` and `showLabel={false}` get their first real
caller here: the pill wears a ★ instead of a word, and `label` still supplies
the accessible name (`"Minimum rating: 3+ stars"`). `rating` joins the URL
query, `parseLibraryQuery` and the route, translating to `minRating` at the
route boundary.

Unrated movies never pass a minimum — `m.rating >= ?` already excludes `NULL`,
which is exactly what "3+ stars" should mean.

### Acceptance criteria

- [ ] The dropdown offers the four options in order, labelled in stars.
- [ ] Each selection maps to the right `minRating` (unset / 8 / 6 / 4) and
      narrows the rows accordingly.
- [ ] Movies with no rating are excluded whenever a minimum is set.
- [ ] The pill shows a ★ with no visible label, and its accessible name still
      carries the label and the current value.
- [ ] `parseLibraryQuery` drops a non-numeric, negative or out-of-range
      `rating`; `GET /api/home` `400`s an unparseable one.
- [ ] "All ratings" removes the parameter from the URL.
- [ ] Rating combines with search, genre and sort — "highest rated comedies" is
      one question, not two.

---

## Phase 6: Docs and follow-ups

**User stories**: none — maintainer housekeeping that closes the feature out.

### What to build

The written record, and the two issues this work knowingly leaves behind rather
than silently fixing.

`docs/ubiquitous-language.md` gains the feature's terms — **Library query**,
**Settled query**, **Filter dropdown**, **Header slots**, **No results** — and
records the known limit that SQLite `LIKE` is case-insensitive for ASCII only,
so an accented title will not match a differently-cased accented fragment.
CLAUDE.md's feature list ticks **Search + filter** and **Sort** to ✅. The
dev-journal gets its entry.

The two follow-up issues are filed, not fixed: **home-row ordering** (our rows
are alphabetical because `listGenres` is `ORDER BY g.name`, where the prototype
orders by count — a pre-existing `02-browse-grid` divergence that the new Genre
dropdown, which follows the prototype, now sits knowingly inconsistent with),
and **promoting `Menu` to the full ARIA menu pattern** (`role="menu"` implies
arrow-key navigation we have not built; `aria-current` is valid and meaningful
without promising it).

### Acceptance criteria

- [ ] `docs/ubiquitous-language.md` carries the feature's new terms and the
      ASCII-only `LIKE` limit.
- [ ] CLAUDE.md's feature list shows **Search + filter** and **Sort** as ✅.
- [ ] `docs/dev-journal.md` has the entry for this feature.
- [ ] A follow-up issue exists for home-row ordering (count-desc vs
      alphabetical), naming both surfaces that disagree.
- [ ] A follow-up issue exists for promoting `Menu` to the full ARIA menu
      pattern with arrow-key navigation.
- [ ] The full suite passes: `node_modules/.bin/vitest run`,
      `node_modules/.bin/tsc --noEmit`, `node_modules/.bin/eslint`.
