## Problem Statement

The **Browse home** shows the family everything, in one order, forever. Twenty-one
movies fit; a real library does not. `MainLayout`'s header has carried a logo, a
flex spacer, and a settings gear since `02-browse-grid` — and a docblock admitting
it is "deliberately partial", because the four controls the prototype puts in that
gap belong to a feature that had not been written.

So there is currently no way to answer any of the questions a parent actually
arrives with. _What comedies do we have?_ — scroll to the C's and hope the row is
short enough. _What was that film about the lighthouse?_ — there is no way to ask
at all; the **Synopsis** is on the record, rendered on the **Movie detail page**,
and unreachable from anywhere else. _What have we not seen yet?_ — the
`unwatched-first` **Sort order** has existed in `MovieQuery` and in `ORDER_BY`
since Library Core and has never had a caller. _What's actually good?_ — same for
`minRating`.

That last part is the sharp edge of this: **the backend has been finished for this
feature since 01.** `MovieQuery` already carries `search`, `genre`, `minRating`,
`sort` and `limit`; `buildListQuery` already assembles every one of them into
parameterized SQL; every sort already has its `ORDER BY` body with null-handling
and tiebreaks. What is missing is the two lines that let a request reach it:
`GET /api/movies` parses only `sort`, `genre` and `limit`, and `GET /api/home` —
the endpoint the home screen actually calls — parses nothing at all and hands
`storage.getHome()` no arguments, because `getHome()` takes none.

There are two genuinely hard parts, and neither of them is the controls.

The first is that the prototype does **not** switch to a flat grid when you
search. It re-filters and re-sorts the whole library, then rebuilds _the same genre
rows_ out of the result (`FamilyFlix.dc.html:319–329`), dropping the rows that came
back empty. Our rows arrive from `/api/home` capped at `HOME_ROW_LIMIT` (15) — so
filtering the payload we already hold would search 15 of a genre's 40 movies and
silently, invisibly miss the other 25. Every user-facing symptom of that bug looks
exactly like "we don't own that film."

The second is that the header and the body are two different subtrees. The controls
live in `MainLayout`'s header; the results live in `HomeRows`. `pages/` is
composition-only by the layer rules, so `LibraryPage` cannot hold the state that
joins them — and if it did, it would lose that state on every navigation to a movie
and back, taking `useRestoredScroll`'s offset with it.

## Solution

Build the prototype's four header controls — the **Search bar** and three
**Filter dropdowns** (Genre, rating, Sort) — as a 1:1 translation of
`mol.SearchBar` and `mol.FilterDropdown` ×3, and make them steer the browse home
through the server.

**The query lives in the URL.** `/?q=&genre=&rating=&sort=` is the whole state.
The **Search bar** and the **Filter dropdowns** only ever _write_ it; `HomeRows`
and the dropdowns' own selected values only ever _read_ it. That is what lets
`LibraryPage` stay pure composition — nothing is lifted into it, because the router
already holds it — and it is what makes Back from a movie return to the _filtered_
view with `useRestoredScroll` handing back the offset that belongs to it. Every
parameter is omitted at its default, so an unfiltered home is a clean `/`.

**The filtering happens on the server, through `/api/home`.** `getHome` grows a
`HomeQuery` parameter and threads it into both of its `browse.listMovies` calls, so
the genre rows and the **Continue Watching row** narrow together off one query — as
the prototype does, and as the maintainer insisted: _"One Library query, one Home
payload. Anything else would be the screen disagreeing with itself."_ Rows that
match nothing are dropped; with a **Genre filter** active, exactly one row renders.
A row's `count` still comes from `listGenres()`, so "View all 24" stays the genre's
true total while the row shows the three that matched.

**Search matches title or Synopsis or genre name**, per the prototype's semantics.
`browse`'s `search` term widens from `m.title LIKE ?` to that three-way match — the
genre arm via the same subquery shape the **Genre filter** already uses, so the
result stays one row per movie. Typing "comedy" therefore returns comedies without
touching the Genre dropdown, and the two mechanisms are allowed to overlap.

**`FilterDropdown` is built on `Menu`.** The dismissal contract this needs —
Escape, outside pointerdown, select-to-close, focus back to the trigger — already
exists, and `Menu`'s docblock already names "a filter dropdown" as an intended
client. Taking it also buys the prototype's single-`openDrop` behaviour (only one
dropdown open at a time) for free, with no coordinating state anywhere. The
consequence is deliberate: the prototype's `open` / `onToggle` props are **dropped**,
because `Menu` owns open state. `Menu` gains only what a filter list needs —
`selected` and `trailing` on `MenuItem`, a scroll cap on `Panel`.

**The Genre dropdown's counts never move.** They come from a second endpoint,
`GET /api/genres` → `{ total, genres }`, fetched once per mount and never per
query — a different lifetime from `/home`, which refetches on every settled query.
A list that reshuffles while you are reaching for it is unusable, and the "All
Genres" count is a count of _movies_, which is why `total` needs its own
`countMovies()` rather than a sum that double-counts anything tagged twice.

**The debounce lives in `LibrarySearch` and nowhere else.** Local input state for
instant typing, a 250ms debounced URL write. Everything downstream treats the URL
as the **Settled query** and knows nothing about debouncing — which is also what
keeps `useHomeRows`, in `features/library`, free of any import from
`features/search`.

**The header gets two slots, not one.** The prototype puts the search bar _before_
the header's flex spacer and the three dropdowns _after_ it, so `MainLayout` gains
optional `headerStart` and `headerEnd` **Header slots** with the existing `Spacer`
between them. Every other page is unchanged, and `MainLayout` learns nothing about
the library domain.

**The skeleton does not come back.** Skeleton rows on first load only; after that
the rows already on screen stay until the new ones arrive. Flashing the whole
screen every 250ms of typing would be unreadable, and the maintainer was explicit:
_"she's reading them."_

**`HomeRows` owns the miss.** It already owns loading, empty and error, and its
docblock already anticipates this exact case. It reads `q` for the copy — no import
from `features/search` — and distinguishes two situations the prototype conflates:
a search that matched nothing quotes the search text back; a filter-only miss says
so instead, because the parent didn't type anything and shouldn't be shown empty
quotes.

## User Stories

1. As a parent, I want a search box in the header of the home screen, so that I can
   ask for a film instead of hunting for it.
2. As a parent, I want the rows to narrow as I type, so that I get an answer without
   pressing anything.
3. As a parent, I want to type a few letters of a title and see it, so that I don't
   have to remember the whole name.
4. As a parent, I want to find a film by something I remember from the plot, so that
   "the one about the lighthouse" is a real way to search.
5. As a parent, I want typing "comedy" to show me comedies, so that I don't have to
   know the difference between the search box and the genre menu.
6. As a parent, I want capitalisation not to matter, so that "MATRIX" and "matrix"
   find the same film.
7. As a parent, I want the results still laid out as genre rows, so that the screen I
   know doesn't turn into a different screen when I search.
8. As a parent, I want rows with no matches to disappear rather than sit there empty,
   so that what's left on screen is all answer.
9. As a parent, I want what I'm part-way through to narrow along with everything else,
   so that the top of the screen agrees with the rest of it.
10. As a parent, I want a Genre menu, so that I can browse one kind of film without
    typing.
11. As a parent, I want each genre to show how many films it holds, so that I know
    whether it's worth opening.
12. As a parent, I want those counts to stay put while I'm choosing, so that the list
    doesn't rearrange itself under my finger.
13. As a parent, I want "All Genres" at the top with the library's total, so that
    there is an obvious way back to everything.
14. As a parent, I want the genres ordered by how many films they hold, so that the
    ones I'm most likely to want are nearest the top.
15. As a parent, I want picking a genre to leave just that one row, so that the screen
    is only what I asked for.
16. As a parent, I want "View all 24" to keep saying 24 even when the row is showing
    three matches, so that the link doesn't lie about what's behind it.
17. As a parent, I want a star menu to ask for only the well-rated films, so that I
    can skip the ones we didn't think much of.
18. As a parent, I want the choices written as "4+ stars" rather than in numbers, so
    that I don't have to know how the app stores a rating.
19. As a parent, I want films nobody has rated left out when I ask for 3+ stars, so
    that the filter means what it says.
20. As a parent, I want a Sort menu, so that I can decide what order the rows come in.
21. As a parent, I want to sort by what was added most recently, so that I can find
    what's new.
22. As a parent, I want to sort A–Z, so that I can find a title I already know the
    name of.
23. As a parent, I want to sort by year, so that I can find something from a
    particular era.
24. As a parent, I want to sort by rating, so that the best of what we own comes first.
25. As a parent, I want to sort unwatched first, so that I can see what's still ahead
    of me.
26. As a parent, I want the sort and the filters to work together, so that "highest
    rated comedies" is one question, not two.
27. As a parent, I want the current choice ticked in each menu, so that I can tell what
    I've already asked for.
28. As a parent, I want the pill to show my choice when the menu is shut, so that I can
    read the state of the screen without opening anything.
29. As a parent, I want opening one menu to close the other, so that I never have two
    panels overlapping.
30. As a parent, I want Escape or a click elsewhere to close a menu, so that I'm never
    trapped in one.
31. As a parent, I want a search that finds nothing to tell me so plainly, so that I
    don't think the app is broken.
32. As a parent, I want that message to quote back what I typed, so that I can see
    whether I mistyped it.
33. As a parent, I want a filter that finds nothing to talk about the filters rather
    than quote an empty search, so that the message matches what I actually did.
34. As a parent, I want "no movies match" to read differently from "your library is
    empty", so that I can tell a bad search from an empty shelf.
35. As a parent, I want the rows I'm looking at to stay on screen while the new ones
    load, so that the screen doesn't flash grey at me on every letter.
36. As a parent, I want to open a film and come back to the search I had, so that I
    don't have to type it again.
37. As a parent, I want Back to take one press to get out of a search, so that fourteen
    keystrokes aren't fourteen presses of Back.
38. As a parent, I want the star menu to still be usable when it has no words on it, so
    that a screen reader announces what it does.
39. As a parent, I want to reach and operate all four controls from the keyboard, so
    that the mouse isn't required.
40. As a parent, I want the search box to keep up with my typing, so that it never
    feels like it's lagging behind me.
41. As the maintainer, I want the filtering done by the database rather than in the
    browser, so that a genre with 40 films searches all 40 and not the 15 the row
    happened to load.
42. As the maintainer, I want one definition of what "matches", so that the search on
    the home screen and the search on any later screen can never disagree.
43. As the maintainer, I want the query in the URL, so that I can see exactly what the
    screen was asked for while I'm debugging it.
44. As the maintainer, I want a hand-edited or stale URL to degrade to something sane
    rather than crash, so that a bookmark from an older build still opens.
45. As the maintainer, I want an unfiltered home to be a clean `/`, so that the default
    state has no query string to explain.
46. As the maintainer, I want the genre list fetched once rather than on every
    keystroke, so that typing doesn't re-send the whole unfiltered list each time.
47. As the maintainer, I want the genre list failing to leave the rest of the header
    working, so that one endpoint being down doesn't take out search, rating and sort.
48. As the maintainer, I want `LibraryPage` to stay composition-only, so that the layer
    rule survives the first feature that spans the header and the body.
49. As the maintainer, I want dismissal behaviour written once, so that three dropdowns
    and the ⋯ menu can't drift apart.
50. As the maintainer, I want the search and filter controls built so the genre page
    can reuse them, so that its header is composition rather than a second
    implementation.

## Implementation Decisions

### The query lives in the URL

- The **Library query** is `?q=&genre=&rating=&sort=` on `/`. No component state,
  no context provider. The router is already the mechanism; a second one would
  duplicate it, and component state in `LibraryPage` would be dropped on every
  navigation — taking the restored scroll offset with it.
- **The app URL and the API use the same parameter names** — `q`, `genre`,
  `rating`, `sort`. The route keeps translating to domain names (`q`→`search`,
  `rating`→`minRating`) at the boundary that already does that translation.
- Every parameter is **omitted at its default**. `sort` uses the `MovieSort` slugs
  already on the wire (`recently-added`, `a-z`, `year`, `highest-rated`,
  `unwatched-first`); `rating` is the numeric minimum in stored half-star units.
- Writes use **`replace: true`**. Typing must not stack a history entry per
  keystroke between the home and the movie you open. Accepted consequence: each
  settled query mints a fresh history key, so `useRestoredScroll` starts the changed
  view at the top — correct for a reshuffled list, but a consequence rather than a
  goal.
- A single pure module turns `URLSearchParams` into a `HomeQuery` and is the one
  place a stale or hand-edited URL is made safe: an unknown sort falls back to the
  default, a non-numeric or out-of-range rating is dropped, an empty string is
  treated as absent.

### New types

- `HomeQuery` — `{ sort: MovieSort; search?: string; genre?: string; minRating?: number }`,
  in the browse types. It is deliberately a subset of `MovieQuery` (no `limit`, no
  `favoritesOnly`, no `inProgressOnly`): those belong to the aggregate, which sets
  them itself per section.
- `GenreListPayload` — `{ total: number; genres: GenreCount[] }`, the unfiltered
  payload behind the Genre dropdown's counts.
- `FilterOption` — `{ label: string; count?: number; selected: boolean; onSelect: () => void }`,
  in the view models, since `FilterDropdown` renders it and three different callers
  build it.

### Server

- **`browse`'s `search` widens** from `m.title LIKE ?` to title **or** synopsis
  **or** genre name. The genre arm reuses the `m.id IN (SELECT …)` subquery shape
  the genre filter already uses, so the row set stays one row per movie however many
  genres it carries. The widened `WHERE` is still expressed entirely over the
  `movies m` alias, so `assembleMany` can keep re-running it as a subquery for the
  batched child reads with no change.
- `searchMovies(text)` **widens with it** — it is documented as "equivalent to a
  `listMovies` call with the `search` filter" and should keep meaning that. Its
  docblock, `MovieQuery.search`'s docblock, and the `LibraryStorage` interface
  comment all get corrected from "title substring". Its only caller is its own test.
- **`countMovies(): number`** joins the browse slice — a single `SELECT COUNT(*)`,
  needed because the "All Genres" count is a count of _movies_ and summing genre
  counts double-counts anything tagged twice.
- **`getHome(query: HomeQuery)`** threads the query into both `listMovies` calls,
  merging it with the per-section additions (`genre` + `limit` for a row,
  `inProgressOnly` + `limit` for continue) — with one deliberate precedence rule:
  when the query carries a **Genre filter**, only that genre's row is built.
  Rows whose `movies` came back empty are dropped. A row's `count` still comes from
  `listGenres()`, so it stays the genre's unfiltered total.
- `getHome` stays a **composition over `browse.listMovies`** — no new SQL, no new
  repository primitive, as `createHome`'s docblock promises.
- **`GET /api/home` parses `q` / `genre` / `rating` / `sort`**, reusing the existing
  `queryString` / `isMovieSort` helpers. An unknown `sort` is a 400, matching
  `/api/movies`; an unparseable `rating` is a 400 for the same reason. Empty values
  are treated as absent.
- **`GET /api/genres`** is new: `{ total: countMovies(), genres: listGenres() }`.
  Its own endpoint rather than a field on `HomePayload`, because it has a different
  lifetime — fetched once, where `/home` refetches per query — and because two
  consumers in two subtrees would otherwise need the shared-payload provider that
  was ruled out.
- `LibraryStorage` gains `countMovies`, and `getHome`'s signature changes.

### Frontend — new units

- **`TextField`** (primitive) — `value`, `placeholder?`, `icon?: ReactNode`,
  `onChange`, `aria-label`. The icon is a **slot, not the prototype's enum**:
  COMPONENT-SPEC §3a says the inlined icons are an authoring shortcut and each must
  be lifted into its own component. `mono` / `rounded` / `height` and the
  `folder` / `sheet` icons arrive with MovieForm and ImportFlow; building them now
  is three unused props and two unused icons.
- **`SearchIcon`** (primitive) — the prototype's magnifier, lifted out per §3a.
- **`SearchBar`** (component) — `value`, `placeholder?`, `onChange`, `maxWidth?`
  (default 460). The prototype's `grow` prop lands with its second caller
  (GenrePage), not now.
- **`FilterDropdown`** (component) — `label`, `showLabel?`, `value`, `options`,
  `leadingStar?`, `menuWidth?`. Built on `Menu`, so `open` / `onToggle` are dropped.
  `label` is **always required and always forms the accessible name**
  (`"Minimum rating: 3+ stars"`); `showLabel={false}` hides it visually and
  `leadingStar` puts the prototype's ★ in its place — rather than an `aria-label`
  prop a caller can forget.
- **`Menu` gains**: `MenuItem` `selected` (accent + 600 weight + `aria-current="true"`)
  and `trailing` (the right-floated count); `Panel` gets `max-height: 340px;
overflow-y: auto` for a twelve-genre list, inert for the four-item edit menu.
  `menuWidth` rides in through a styled-components component selector on `Panel`, so
  `Menu` needs no prop for it.
- **`MainLayout` gains** `headerStart?: ReactNode` and `headerEnd?: ReactNode` around
  its existing `Spacer`. Structure only — it learns nothing about the library.

### Frontend — `features/search/`

`CLAUDE.md`'s folder structure reserves `features/search/` for "search-as-you-type,
filters", which outranks COMPONENT-SPEC's `features/library/LibraryHeader`
suggestion. It owns all four controls, not just the text one.

- `parseLibraryQuery` — pure `URLSearchParams` → `HomeQuery`.
- `useLibraryQuery` — `useSearchParams` + parse; setters write `replace: true`.
- `genreOptions` — pure `GenreCount[]` + total + selection → `FilterOption[]`, with
  "All Genres" first, then count descending, alphabetical tiebreak.
- `api` — `fetchGenreList()`.
- `useGenreList` — loads `/api/genres` once per mount. **On failure it resolves to an
  empty list**, so the Genre dropdown renders with "All Genres" alone and the other
  three controls are unaffected. No retry loop, no error surface — the prototype
  designs none.
- `LibrarySearch` — the `headerStart` control. Local input state for instant typing,
  a **250ms debounced URL write**. The only holder of un-settled input in the app.
- `LibraryFilters` — the `headerEnd` control: the Genre, rating and Sort dropdowns.
  It is one component because the three share the header's trailing group, **not**
  because sort is a filter.

### Frontend — `features/library/` changes

- `fetchHomePayload(query: HomeQuery)` serializes the query onto `/api/home`,
  omitting every parameter at its default so the request matches the URL.
- `useHomeRows` reads the URL itself (`useSearchParams` — app-level state, not a
  sibling feature's module, so no import from `features/search`), refetches when the
  settled query changes, and **keeps the current rows on screen during a refetch**.
- `HomeRows` gains the two **No results** messages.

### Option tables

- **Sort**, in the prototype's order: Recently Added · Title (A–Z) · Year ·
  Unwatched First · Highest Rated. (Note this is not the declaration order of
  `MovieSort`; the dropdown follows the prototype.)
- **Rating**: All ratings · 4+ stars · 3+ stars · 2+ stars → `minRating` unset / 8 /
  6 / 4, since ratings are stored in 0–10 half-star units. **Unrated** movies never
  pass a minimum — `m.rating >= ?` already excludes `NULL`.

### Result states — `HomeRows`

| Condition                    | Render                                                                             |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| First load                   | Skeleton rows (unchanged)                                                          |
| Refetch after a query change | Current rows stay — no skeleton flash                                              |
| Empty, no query active       | "Your library is empty" (unchanged)                                                |
| Empty, `q` non-empty         | "Nothing here" / "No movies match “{q}”. Try a different search or genre."         |
| Empty, filters only          | "Nothing here" / "No movies match these filters. Try a different genre or rating." |

The last row is a **deliberate deviation**: the prototype's string always
interpolates the search text, which renders as empty quotes when only a filter
narrowed the list.

## Testing Decisions

A good test here states a fact about **behaviour a user or a caller can observe** —
what comes back from a query, what is on the screen, what is in the URL — and would
still pass if the module were rewritten underneath. It does not assert on the SQL
string, on which hook holds which piece of state, on styled-components class names,
or on the fact that `Menu` uses a context to close itself. Every module in this
feature gets tests.

### Server (prior art: `browse.test.ts`, `home.test.ts`, `routes.test.ts` — real

SQLite temp files, nothing mocked)

- **`browse` search widening** — matches on title; matches on synopsis; matches on
  genre name; is case-insensitive on each; returns one row per movie when a movie's
  title _and_ genre both match; combines with `genre`, `minRating` and each sort;
  returns `[]` for a fragment nothing holds. Plus: the assembled genres/subtitles are
  still correct under a widened search (the `assembleMany` subquery path).
- **`searchMovies`** — its two existing tests renamed and extended to the widened
  semantics.
- **`countMovies`** — counts movies not tags (a movie in three genres counts once);
  `0` on an empty library.
- **`getHome(query)`** — narrows both sections off one query; drops rows that match
  nothing; renders exactly one row under a genre filter; keeps `count` at the
  genre's unfiltered total while the row is narrowed; applies each sort inside the
  rows; still caps at 15 with a filter active; an in-progress movie that fails the
  filter leaves the continue section; an empty query returns exactly what today's
  `getHome()` returns (regression guard on the signature change).
- **`GET /api/home`** — parses each parameter into the query; ignores empty values;
  400s an unknown sort and an unparseable rating; an argument-less request is
  unchanged.
- **`GET /api/genres`** — returns `{ total, genres }`; `total` is a movie count, not
  a sum of genre counts; `{ total: 0, genres: [] }` on an empty library.

### Pure modules (prior art: `view.test.ts`, `continueView.test.ts`, `toGenreRow.test.ts`)

- **`parseLibraryQuery`** — every parameter parsed; defaults when absent; empty
  strings treated as absent; unknown sort → default; non-numeric, negative and
  out-of-range rating dropped; unrelated parameters ignored.
- **`genreOptions`** — "All Genres" first carrying `total`; count descending with an
  alphabetical tiebreak; exactly one option `selected`; "All Genres" selected when
  no genre is set; an empty genre list still yields the single "All Genres" option.

### Hooks (prior art: `useHomeRows.test.ts`)

- **`useLibraryQuery`** — reads the settled query from the URL; each setter writes
  its parameter and preserves the others; a setter at the default value **removes**
  its parameter; every write is `replace`.
- **`useGenreList`** — fetches once per mount, not per query change; a failed fetch
  resolves to an empty list rather than throwing.
- **`useHomeRows`** — refetches when the settled query changes; **keeps the previous
  rows and does not return to `loading` during that refetch**; still shows the
  skeleton on the very first load; a stale in-flight response cannot overwrite a
  newer one; the existing favorite-toggle behaviour is unaffected.

### Components (prior art: `Menu.test.tsx`, `HomeRows.test.tsx`, `MainLayout.test.tsx` — RTL, user-facing queries)

- **`TextField`** / **`SearchBar`** — renders its value; reports typing; the icon
  slot is decorative and stays out of the accessible name.
- **`FilterDropdown`** — the pill shows the current value; opening lists the options;
  choosing one calls `onSelect` and closes; the selected option is marked
  `aria-current`; a count renders when present and nothing renders when absent;
  with `showLabel={false}` the accessible name still carries the label.
- **`Menu` additions** — `selected` marks an item without changing what it does;
  `trailing` renders and is not part of the item's name; existing dismissal tests
  still pass.
- **`MainLayout`** — renders both slots in the right places; renders unchanged when
  neither is given.
- **`LibrarySearch`** — typing updates the field immediately; the URL is written
  **once** after the debounce, not per keystroke (fake timers); clearing the field
  removes `q` rather than writing an empty one.
- **`LibraryFilters`** — reflects the settled query in all three pills; a selection
  writes the URL; **only one dropdown is open at a time**.
- **`HomeRows`** — the search miss quotes the search text; the filter-only miss uses
  the filter copy; the empty library keeps its own message; rows stay visible during
  a refetch.

## Out of Scope

- **The GenrePage header.** `GenrePage` is still a placeholder with no grid to
  filter. `SearchBar`, `FilterDropdown` and the `Menu` extensions are built so it can
  reuse them; `SearchBar`'s `grow` prop lands with that second caller.
- **`/api/movies` gaining `q` / `rating`.** Nothing calls it with those until
  GenrePage exists. Adding untested, uncalled parsing now is speculative surface.
- **The Favorites row.** Its own 🔜 feature, with a second surface on a page that does
  not exist yet.
- **Promoting `Menu` to the full ARIA menu pattern.** `role="menu"` implies arrow-key
  navigation we have not built; `aria-current` is valid and meaningful without
  promising it. A deliberate follow-up issue.
- **Correcting home-row ordering to the prototype's count-descending.** Our rows are
  alphabetical (`listGenres` is `ORDER BY g.name`) where the prototype orders by count
  — a pre-existing `02-browse-grid` divergence. The new Genre dropdown follows the
  prototype (count desc), so the two are knowingly inconsistent for now. A follow-up
  issue, not this feature's to change silently.
- **`/`-to-focus, a clear ✕ in the search field, an `aria-live` result count, and
  filters persisted across restarts.** None are in the prototype; each would be
  inventing design at build time.
- **Back-to-top FAB.** Its own 🔜 System item, visible in the same prototype screen but
  unrelated to the query.
- **Fuzzy matching, stemming, ranking, or anything that would make search "smart".**
  Substring `LIKE` over three columns. FamilyFlix has no AI, and this is not the seam
  to put a scoring function behind.

## Further Notes

- **Known limit: SQLite `LIKE` is case-insensitive for ASCII only.** A title with
  accented characters will not match a differently-cased accented fragment. Recorded
  in the ubiquitous language rather than worked around.
- **The debounce is now load-bearing and lives in a component** rather than in the
  data layer. That is the deliberate price of keeping `useHomeRows` free of any
  import from `features/search`: everything downstream of `LibrarySearch` treats the
  URL as already settled.
- **`getHome` runs one query per genre**, so a library with many genres pays a
  statement each. Sub-millisecond against a local SQLite file, and the seam to batch
  it later is one function.
- **`replace: true` resets scroll to the top on every settled query.** Right for a
  reshuffled list, but it is a consequence of the history strategy, not a design goal
  — worth remembering if scroll behaviour is ever revisited.
- **Two follow-up issues fall out of this work**: home-row ordering (count-desc vs
  alphabetical) and promoting `Menu` to the full ARIA menu pattern with arrow-key
  navigation.
- **The seed matters here.** Search over **Synopsis** is only observable because the
  Movie Detail work grew synopses on the fixtures; ratings are seeded, so the rating
  filter has something to bite on. Nothing further is needed from the seed.
- **The suggested build order** (from the design log) is five slices, each of which
  puts something working on the screen: search end-to-end → sort → genre filter →
  rating filter → docs. Sort lands second on purpose: it needs no new endpoint, so
  `FilterDropdown` gets built against the simplest possible option list.
