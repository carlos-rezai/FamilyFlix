# Plan: Genre page (every movie in one genre, under its own header)

> Source PRD: https://github.com/carlos-rezai/FamilyFlix/issues/42

Closes the last dead end in browse-and-discover. `/genre/:name` has been a
registered placeholder since `03-card-carousel`, and every genre row still ends
in a "View all 214 →" that lands on an `<h1>` and a line of prose. A row caps at
`HOME_ROW_LIMIT` movies, so for a 214-title genre the other 199 are currently
unreachable by any route in the app — not by scrolling, not by search, not by
any filter. `LibraryGrid` is the one feature in `COMPONENT-SPEC.md` with no
implementation at all, and it is literally the unbuilt half of "View all".

Nothing new is stored and no schema moves. `listMovies` already takes every
filter this screen needs, `listGenres` already returns the count "View all 214"
promised, and `createHome` already demonstrates the composition-over-`Browse`
shape the new aggregate copies. What this feature builds is a second screen
over those same primitives, and the header/body split that a screen whose
heading depends on its body's payload forces.

Phase 1 is a server slice with its route attached, verifiable by curling a
seeded database — the same shape 04's Phase 2 and 05's Phase 1 took. Phase 2
adds the URL contract as pure units. Phase 3 builds the surface against fixture
props, so the screen is pixel-correct before data reaches it. Phase 4 is the
point the feature becomes demoable to a parent: "View all" opens a real screen
with every load state. Phase 5 adds the header controls and carries the sort
across the route change. Phase 6 closes the docs and corrects `813b546`.

**Two ordering corrections against the PRD's own phasing sketch**, both closing
a gap where a phase would otherwise depend on something shipping later:

- **`useGoBack` moves from Phase 5 into Phase 3.** `GenreLayout` owns the Back
  pill, so Phase 3 is the rule's first new consumer. Extracting it in Phase 5
  would mean Phases 3–4 carry an inline second copy of the `navigate(-1)` /
  `/`-fallback rule — precisely what story 53 forbids.
- **The prototype amendment moves from Phase 6 into Phase 4.** Story 56 wants
  the "1 titles" copy bug fixed in the prototype _before_ it is fixed in the
  build, and CLAUDE.md says amend first, then build to the amended prototype.
  `genreCountLabel` singularises in Phase 4, so the amendment opens that phase.
  `useSettledText` stays in Phase 5 — `GenreControls` really is its first new
  consumer.

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: `GET /api/genre/:name?q=&sort=` is new, answering the whole screen
  in **one request**. The alternative — `/api/movies` for the list plus
  `/api/genres` for the total — is exactly the fan-out `getHome` was built to
  avoid, and would force `features/library` to import `features/search`'s
  `useGenreList` so one screen could print a number. `GET /api/movies` keeps its
  behaviour exactly and loses only its comment's claim to serve the genre page;
  it stays the generic browse endpoint the CSV exporter will want.
- **The app URL is `/genre/:name?q=&sort=`.** The genre travels in the **path**,
  not as a parameter — it is not a filter here, it is which screen this is, and
  `App.tsx` and every "View all" link already spell it that way. Two parameters,
  each omitted at its default, so a plain genre page is a clean URL. The name
  travels through unnormalised, matched the way `?genre=` already is, encoded on
  the way in and decoded on the way out so "Science Fiction" survives.
- **The query lives in the URL, as it does on the home.** Nothing is held in
  component state, so Back out of a movie lands on the narrowed grid with its
  scroll offset intact — the query was never in a component to lose.
- **The genre page gets its own parser.** `parseGenreQuery` / `toGenreQueryParams`
  read and write two parameters and share `isMovieSort` with their library-query
  siblings. Deliberately **not** a parametrised generalisation of
  `parseLibraryQuery`: a single shared parser would build a screen that silently
  accepts a `rating` and a `genre` it has no control for.
- **The rating filter does not apply here at all.** A deliberate deviation from
  the prototype's _behaviour_ (`genrePageMovies()` calls `passRating`) but not
  its _surface_ (the genre header has no rating pill). It is the rule
  `parseLibraryQuery` already wrote: the URL and the screen must agree, so a
  hand-edited `?rating=7` can never narrow a library behind a control that isn't
  there. Reproduce the surface; never port a filter with no control.
- **The Sort order carries; the Search text does not.** `HomeRows` builds
  `/genre/Action?sort=a-z`, omitted at the default, so the order survives the
  route change **through the link** rather than through hidden global state. The
  search box starts empty and is relabelled "Search in {genre}" — this is a
  fresh, narrower search, and the prototype clears `genreSearch` on entry.
- **Schema: no migration, and no new repository primitive.** `createGenre(browse)`
  sits beside `createHome(browse)` and is built the same way — a composition over
  the existing `Browse` slice. `total` is `listGenres()` matched by name; `movies`
  is `listMovies({ ...query, genre: name })` with **no cap**, because this screen
  _is_ "View all".
- **The header/body split is solved with a feature-local context.**
  `GenreMovies` exports a `GenreMoviesProvider` owning the one fetch, the
  status machine, `retry` and the optimistic `toggleFavorite`, plus a
  `useGenreMovies()` hook the heading and the grid both read. Calling a hook in
  both subtrees would mean two requests; lifting it into `GenrePage` would put
  data logic in a page. This is the reusable answer to "a fixed header and a
  scrolling body over one payload" — the shape Favorites, a flat search-results
  page and a collection all copy later.
- **The chrome is a second layout, not a `MainLayout` variant.** `GenreLayout`
  has no logo and no gear, and its heading is content the body loaded; bending
  `MainLayout` to cover both would make it a component with two unrelated modes,
  and `COMPONENT-SPEC.md:398` already says each page owns its header. The shared
  bits (Back pill styling, scrolling body) cost less duplicated than conditioned.
- **The server owns the order and the filtering**, as 05 decided. No client-side
  re-sorting of a loaded grid, and no filtering of a payload already held.
- **The skeleton does not come back.** First load only; a refetch on a settled
  query change keeps the grid on screen, the same discipline `useHomeRows`
  follows.
- **Key models** (both exported from the shared types barrel, imported by both
  build targets):
  - `GenreQuery` — `{ sort: MovieSort; search?: string }`. Two parts where a
    `LibraryQuery` has four: the genre is in the path, and there is no
    `minRating` because there is no control for one.
  - `GenrePayload` — `{ genre: string; total: number; movies: Movie[] }`, with
    `total` documented as the genre's **unfiltered** count.
- **Two extractions keep single copies of shared behaviour**, each switching its
  existing call site over in the same phase so no interim second copy exists:
  `useSettledText` (the 250ms debounce out of `LibrarySearch`) and `useGoBack`
  (the Back rule out of `MoviePage`). `LibrarySearch`'s docblock claims the
  debounce "lives here and nowhere else" — the extraction is what keeps that
  sentence true rather than letting it become false.
- **`withFavorite` gains a flat-list sibling** in the same module, with the
  existing rows variant expressed in terms of it. One concept, two shapes, one
  folder.
- **Testing pattern**: every test states a fact about behaviour a user or a
  caller can observe — what comes back from a query, what is on the screen, what
  is in the URL — and would still pass if the module were rewritten underneath.
  No test asserts on a SQL string, on styled-components class names, or on the
  fact that `GenreMovies` uses a context rather than props. Server tests use real
  SQLite temp files with nothing mocked, per `browse.test.ts` / `home.test.ts` /
  `routes.test.ts`. **Every module in this feature gets tests** — the bar 05 set.

---

## Phase 1: The genre payload, end to end

**User stories**: 1, 2, 9, 12, 21, 22, 28, 32, 33, 43, 55

### What to build

The whole path from `GET /api/genre/:name` down to SQL, with no UI. A new
aggregate module under `server/src/library/genre/` exposes
`createGenre(browse): Genre` with one method, `getGenre(name, query?)`,
returning a `GenrePayload`. It is a composition over the existing `Browse`
slice — `total` from `listGenres()` matched by name, `movies` from
`listMovies({ ...query, genre: name })` with no `limit` — so no new SQL and no
new repository primitive appear. An omitted query means the genre in the default
order.

The seam gains `getGenre(name, query?)` on `LibraryStorage`, wired in
`createSqliteStorage` beside `getHome`. The route parses `q` → `search` and
`sort`, following the conventions `/home` and `/movies` already set: an empty
value is the absence of the parameter rather than a filter for the empty string,
an unknown sort is a 400, and a genre the library does not hold is a **200 with
`{ genre, total: 0, movies: [] }`** — a stale bookmark for an emptied genre is a
normal "nothing here", not a 404. `q` and `sort` are the only parameters read;
`genre` and `rating` are ignored entirely.

`GET /api/movies` is untouched in behaviour. Only its comment changes: it stops
claiming to be "for the genre page" and is described as the generic browse
endpoint the exporter will use.

Verified by curling a seeded database and by tests; nothing changes on screen.

### Acceptance criteria

- [ ] `GenreQuery` and `GenrePayload` are exported from the shared types barrel,
      with `total` documented as the genre's unfiltered count.
- [ ] `createGenre(browse).getGenre(name)` returns **every** movie in the genre
      with no cap.
- [ ] `total` stays the genre's unfiltered count while a search narrows `movies`.
- [ ] A search narrows the list on title or synopsis, reusing the existing
      `listMovies` search arm unchanged.
- [ ] Each of the five sorts orders the returned list.
- [ ] A genre the library does not hold returns `{ total: 0, movies: [] }`.
- [ ] A movie tagged with several genres appears under each of them.
- [ ] An omitted query is the genre in the default order.
- [ ] The assembled genres and subtitles on each returned movie are complete.
- [ ] `getGenre` on `LibraryStorage` reaches the aggregate and returns the same
      payload `createGenre` does — a guard on the `createSqliteStorage` wiring.
- [ ] `GET /api/genre/:name` serves the payload, parsing `q` into `search` and
      `sort` into the order.
- [ ] Empty parameter values are treated as absent, not as filters.
- [ ] An unknown `sort` is a 400; an unheld genre is a 200 with an empty payload.
- [ ] A genre name with a space in it decodes correctly out of the path.
- [ ] `genre` and `rating` parameters on this route change nothing.
- [ ] `GET /api/movies`' existing tests pass unchanged, and its comment is
      corrected.

---

## Phase 2: The genre query in the URL

**User stories**: 29, 31, 32, 33, 34

### What to build

The URL contract as pure units, with nothing consuming them yet.
`parseGenreQuery` turns `URLSearchParams` into a `GenreQuery`;
`toGenreQueryParams` turns one back into `URLSearchParams`. They are exact
inverses, share `isMovieSort` with their library-query siblings, and carry the
same round-trip property test `toLibraryQueryParams` carries. Every parameter is
omitted at its default, so a default query serializes to the empty string and a
plain genre page is a clean URL. Unknown parameters — `genre` and `rating` among
them — are ignored rather than rejected, so an old bookmark still opens.

`useGenreQuery` (`features/search/`) mirrors `useLibraryQuery`:
`{ query, setSearch, setSort }`, one parameter per setter, each omitted at its
default, every write a `replace` so a hundred keystrokes do not cost a hundred
presses of Back on the way out.

### Acceptance criteria

- [ ] `parseGenreQuery` parses both parameters and falls back to the defaults
      when they are absent.
- [ ] An empty string for either parameter is treated as absent.
- [ ] An unknown sort falls back to the default rather than throwing.
- [ ] `genre`, `rating` and unrelated parameters are ignored.
- [ ] `toGenreQueryParams` omits every part at its default, so a default query
      serializes to the empty string.
- [ ] A search term with a space or an accent encodes correctly.
- [ ] `parse(toParams(q))` equals `q` for every combination — the round-trip
      property test.
- [ ] `useGenreQuery` reads the settled query from the URL.
- [ ] Each setter writes its own parameter and preserves the other one.
- [ ] A setter called with its default **removes** its parameter from the URL.
- [ ] Every write is a `replace`, adding no history entry.
- [ ] Both utils are exported from the utils barrel.

---

## Phase 3: The surface, unwired — and the Back rule extracted

**User stories**: 4, 5, 6, 7, 44, 47, 48, 49, 50, 52

### What to build

The screen made pixel-correct against fixture props, before any data reaches it.
`LibraryGrid` (`features/library/`) is the responsive poster grid from
`feat.LibraryGrid.dc.html` — presentational,
`{ movies, onOpenMovie, onToggleFavorite }`, a `repeat(auto-fill, minmax(…, 1fr))`
grid whose column width **reuses the exported `CARD_WIDTH`** rather than a second
magic number, so the grid and the carousels cannot drift apart. A wide window
gets more columns rather than wider cards; a narrow one reflows without
clipping. The heart reports the value it wants saved rather than a bare toggle,
matching how the rows already do it.

`GenreLayout` (`layouts/`) is the chrome from `page.GenrePage.dc.html`: a Back
pill, a `heading` slot, a `headerEnd` slot, and a scrolling body wired to
`useRestoredScroll` — the fixed header stays reachable down a 214-card shelf,
and only the grid scrolls. Structure only: it learns nothing about the library
from what fills its slots, and renders its body unchanged when a slot is
omitted.

**`useGoBack` (`hooks/`) is extracted here**, because `GenreLayout`'s Back pill
is its first new consumer: `navigate(-1)` with a `/` fallback when
`location.key` is the first entry of the session, so a deep-linked genre page
never shows a dead button. `MoviePage` switches onto it in this same phase, so
no second copy of the rule ever exists. It is a global hook rather than a
feature module because it now has consumers in two features' worth of screens.
Deliberately **not** the prototype's `goBrowse()`, which would discard the
home's filters _and_ its restored scroll.

### Acceptance criteria

- [ ] `LibraryGrid` renders one card per movie and no chrome of its own.
- [ ] Opening a card reports its id; an empty list renders no cards.
- [ ] The heart reports the value it wants saved, not a bare toggle.
- [ ] The grid's column width comes from the exported `CARD_WIDTH`.
- [ ] The grid gains columns on a wide window and reflows to fewer on a narrow
      one without clipping.
- [ ] `GenreLayout` renders both slots in their prototype positions, and renders
      its body unchanged when a slot is omitted.
- [ ] The Back control is reachable by its accessible name and calls back.
- [ ] Only the layout's body scrolls, and it restores its offset on return.
- [ ] `useGoBack` steps back through history when there is history, and
      navigates to `/` when the location is the first entry of the session.
- [ ] `MoviePage` uses `useGoBack` and its existing Back tests pass unchanged.
- [ ] No second copy of the Back rule exists anywhere in the tree.

---

## Phase 4: Real data behind the surface

**User stories**: 1, 2, 3, 8, 9, 10, 11, 13, 14, 30, 35, 36, 37, 38, 39, 40, 41,
42, 43, 45, 46, 56

### What to build

The point "View all" starts keeping its promise. **The prototype is amended
first**: the count label is singularised — "1 title", not
`FamilyFlix.dc.html:490`'s "1 titles" — in `page.GenrePage.dc.html` and
`FamilyFlix.dc.html`, so the build follows an amended prototype rather than
disagreeing with a live one. It is a copy bug rather than a design choice, and
the only amendment this feature needs.

`fetchGenrePayload(name, query)` joins `features/library/api`, building its URL
through `toGenreQueryParams` so the request can only ask for what the header
shows. `GenreMovies` is the deep module: `GenreMoviesProvider` owns the one
fetch, the `loading` / `ready` / `error` status machine, `retry`, and the
optimistic `toggleFavorite` writing through the same favorite endpoint the home
uses; `useGenreMovies()` is what the heading and the grid read, so one request
serves both subtrees. It refetches on a settled-query change but keeps the grid
on screen through that refetch, and a stale in-flight response can never
overwrite a newer one.

`genreCountLabel` is a pure `(shown, all) => string` with its own test — the
same treatment `resumeLabel` got — reading "214 titles" when nothing is
narrowing and "12 of 214 titles" when something is, singularising at one.
`GenreHeading` puts the genre name over that line. `GenreGrid` owns every result
state: the first-load skeleton, the retryable failure, and the **two distinct
empty cases** — "Nothing here — There are no movies in Action." with no Retry
action, and "No matches — Nothing in Action matches “lighthouse”." quoting the
term back so a typo is spottable.

`GenrePage` becomes composition only: the provider around the layout, with the
heading, controls slot and grid in their places, default export as every page
is. `withFavorite` gains its flat-list sibling, the rows variant expressed in
terms of it.

### Acceptance criteria

- [ ] `page.GenrePage.dc.html` and `FamilyFlix.dc.html` are amended to "1 title",
      and this lands **before** the build that follows it.
- [ ] "View all 214" opens a screen showing all 214 movies, uncapped.
- [ ] The genre name renders in large type at the top of the screen.
- [ ] `genreCountLabel` covers all four cases: all, narrowed, singular, and a
      search that matched nothing — plus the zero-total case.
- [ ] The count line reads "214 titles" unnarrowed and "12 of 214 titles" when a
      search is narrowing, with the total always the genre's real total.
- [ ] `fetchGenrePayload` builds its URL through `toGenreQueryParams`.
- [ ] The provider fetches **once** for a given genre and query, not once per
      consumer, and the heading and grid both render from that one request.
- [ ] It refetches when the settled query changes, **keeps the previous movies on
      screen** and does not return to `loading` during that refetch.
- [ ] The skeleton (12 cards) shows on the very first load only.
- [ ] A stale in-flight response cannot overwrite a newer one.
- [ ] A failed load shows "Couldn’t load this genre" with a working Retry.
- [ ] An empty genre shows its own copy with **no** action; a missed search shows
      different copy quoting the term; the two are distinguishable.
- [ ] Opening a card navigates to the movie's detail page.
- [ ] Back from a movie lands on the genre grid with its search, sort and scroll
      offset intact.
- [ ] The heart fills immediately, trusts the value the route echoes back, and
      reverts on failure.
- [ ] `withFavorite`'s flat sibling sets the flag on the matching movie only,
      never mutates its input, and no-ops on an unknown id; the rows-variant
      tests still pass.
- [ ] A deep link to a genre with a space in its name renders that genre.
- [ ] `GenrePage` holds no data logic — composition only, default export.

---

## Phase 5: The header controls, the carried sort, and the debounce extraction

**User stories**: 15, 16, 17, 18, 19, 20, 23, 24, 25, 26, 27, 51, 53

### What to build

The genre header's two controls, and the sort surviving the route change.
`GenreControls` (`features/search/`) is the `SearchBar` (`maxWidth={250}`,
placeholder "Search in {name}") beside the Sort `FilterDropdown`
(`menuWidth={220}`) — the prototype's own numbers. It takes no props and reads
the URL itself, exactly as `LibrarySearch` and `LibraryFilters` do, offering the
same five orders as the home so there is no second vocabulary to learn. The box
starts empty on entry; choosing a sort leaves `q` alone and vice versa.

**`useSettledText` (`features/search/`) is extracted here**, `GenreControls`
being its first new consumer: the value follows every keystroke immediately so
the field never feels broken, and the settled value is written once after 250ms
so the grid follows the typing shortly after it stops rather than thrashing
through it. `LibrarySearch` switches onto it in this same phase — its docblock's
claim that the debounce lives in one place becomes true again rather than false.

`HomeRows` builds `/genre/:name?sort=…`, omitting the parameter at the default
so a copied link to a default-order genre page stays clean. This is the
**Carried sort**: pressing "View all" on a library sorted A–Z opens the genre
page A–Z, through the link rather than through hidden global state.

### Acceptance criteria

- [ ] The genre header shows a search box labelled "Search in {genre}".
- [ ] The box starts empty on entry even when the home carried a search.
- [ ] Typing writes `q` **once** after the debounce, not per keystroke, and the
      field keeps up with the typing meanwhile.
- [ ] A new keystroke abandons the pending write rather than queuing a second.
- [ ] An external change to the settled value resets the field.
- [ ] Clearing the box removes `q` and brings the whole genre back.
- [ ] The Sort pill offers the same five orders as the home screen and shows the
      order the URL is actually carrying.
- [ ] Choosing a sort reorders the grid and leaves `q` untouched.
- [ ] `LibrarySearch` uses `useSettledText` and its existing behavioural tests
      pass unchanged; no second debounce exists in the tree.
- [ ] "View all" navigates to the encoded genre path carrying the current sort.
- [ ] At the default sort, "View all" navigates to a clean path with no query
      string, and `HomeRows`' existing tests still pass.
- [ ] `GenrePage` composed end to end against a stubbed fetch: header and grid
      render from one request, and a genre name with a space round-trips.

---

## Phase 6: Docs, and the Sort correction

**User stories**: 54

### What to build

The paperwork this feature owes. This PRD and its plan land in `docs/PRDs/`, the
design log's 38 resolved questions in `docs/design-logs/06-genre-page.md`, and
every new term in `docs/ubiquitous-language.md`: **Genre page**, **Genre
header**, **Library grid**, **Genre query**, **Genre count label**, **Genre
total**, **Carried sort**, **Settled text**, plus the updated **View all**,
**Header slot** and **Search text** entries. The dev journal gets its entry.

The feature lists get two corrections. The genre page is ticked, and — in its own
docs commit — **Sort is ticked ✅** in `README.md` and `CLAUDE.md`. Commit
`813b546` reverted that row on the premise that "Sort is its own feature and has
not been started", which contradicts both `05-search-filter.md:47` and the
shipped, tested code: `MOVIE_SORTS` / `MovieSort` / `DEFAULT_MOVIE_SORT`, all
five `ORDER BY` bodies, `?sort=` on `/api/home` and `/api/movies`, `setSort` in
`useLibraryQuery`, and the Sort pill itself. It clears the
feature-done-only-after-refactor bar twice over — #35 built it, #41 refactored
it, both closed.

Any follow-ups this work surfaced are filed here, written as bare numbers or
URLs — **never** with a closing keyword in the commit body, per the rule
`0c51aaf` bought the hard way.

### Acceptance criteria

- [ ] The PRD and this plan are committed under `docs/PRDs/`.
- [ ] Every new term is recorded in `docs/ubiquitous-language.md`, and the
      changed entries updated.
- [ ] The dev journal carries this feature's entry.
- [ ] Sort is ✅ in both `README.md` and `CLAUDE.md`, in its own docs commit
      correcting `813b546`'s premise.
- [ ] The genre page is ticked in both feature lists.
- [ ] Follow-ups are filed with bare numbers or URLs, with no closing keyword
      anywhere in a commit body for an issue the commit does not close.
