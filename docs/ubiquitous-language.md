# Ubiquitous Language

## Library entities

| Term         | Definition                                                                                                             | Aliases to avoid                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| **Movie**    | A single film in the library — the canonical domain entity, one row in `movies`, one poster card.                      | _film_ (informal synonym OK)       |
| **Genre**    | A shared, queryable category a **Movie** belongs to; a real entity (junction table), used to browse.                   | category, tag                      |
| **Subtitle** | A subtitle **file asset** owned by a **Movie** — a path + human language label + track order.                          | caption, sub track                 |
| **Synopsis** | The **Movie**'s long-form plot summary (`synopsis`), shown clamped-and-expandable on the **Movie detail page**.        | description, plot, overview, blurb |
| **Cast**     | The display-only ordered list of actor names on a **Movie** (JSON, never queried).                                     | actors list, credits               |
| **Director** | The single display-only director name on a **Movie**.                                                                  | —                                  |
| **Poster**   | The portrait cover image for a **Movie**, downloaded from **TMDB** into the **Managed image cache**.                   | cover, thumbnail                   |
| **Backdrop** | The wide image behind the **Movie detail page**'s title block, from **TMDB**; falls back to the **Gradient fallback**. | banner, hero, background           |

## Rating & watch state

| Term                   | Definition                                                                                                                                                                                                                                                       | Aliases to avoid              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| **Rating** (updated)   | Household 0–10 half-star score (10 = 5 stars), **seeded from TMDB** at import and set or cleared any time from the **Movie detail page**'s **Rating picker**. A stored `0` can only arrive from a seed — the picker sets 1–10 or clears to **Unrated**.          | review, score, vote           |
| **Unrated** (updated)  | A **Movie** with no **Rating** (`NULL`) — distinct from a literal 0-star rating. Renders as five **empty, clickable** stars labelled `Not rated` on the **Movie detail page**, and as five empty stars with **no numeric value** on a **Poster card**.           | zero stars, unscored, 0 stars |
| **Status**             | A **Movie**'s **derived** watch state: `unwatched` \| `in-progress` \| `watched` (never stored).                                                                                                                                                                 | state, watch status           |
| **Watched**            | Explicit boolean flag meaning the maintainer marked a **Movie** finished; setting it via `markWatched` also clears the **Resume position**.                                                                                                                      | seen, completed               |
| **Resume position**    | Seconds into a **Movie**'s video where playback last stopped (`resume_position_seconds`).                                                                                                                                                                        | progress, playback time       |
| **In-progress**        | Derived **Status** when `resume_position_seconds > 0` and not **Watched**.                                                                                                                                                                                       | partially watched             |
| **Favorite** (updated) | Per-movie household boolean (`is_favorite`), togglable from any **Poster card**'s heart on either browse screen and from the **Movie detail page**, and surfaced as the **Favorites row**. One **Movie**'s **Favorite** is one value however many cards show it. | liked, starred, bookmark      |

## Rating input (new)

Vocabulary for the control that _writes_ a **Rating**. Star **display** is
`StarRating` and has no vocabulary of its own — these three name the interactive
half only, which lives in exactly one component.

| Term                        | Definition                                                                                                                                                                                                                                                                                                                                                                                                              | Aliases to avoid                     |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Rating picker** (new)     | The interactive five-star control that sets or clears a **Movie**'s **Rating** — on the **Movie detail page**'s **Meta line**, and later in `MovieForm`. `RatingPicker` in code; takes and emits a 0–100 percent, `null` for **Unrated**, with a `size` prop (default 30; the **Meta line** passes 20). It can set 1–10 units or clear to **Unrated**, but **never a literal `0`** — its smallest click is half a star. | star input, rate widget, star picker |
| **Half-star segment** (new) | One of a **Rating picker**'s ten clickable regions (the left or right half of a star); the smallest **Rating** it can set is one segment, and clicking the segment that already holds the current value clears back to **Unrated**.                                                                                                                                                                                     | star half, hit area, tick            |
| **Rating preview** (new)    | The fill a **Rating picker** shows while a **Half-star segment** is hovered or focused — never committed, and discarded when the pointer or focus leaves the strip.                                                                                                                                                                                                                                                     | hover state, temp rating, draft      |

## Storage & sourcing

| Term                    | Definition                                                                                                    | Aliases to avoid            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- | --------------------------- |
| **TMDB**                | The Movie Database — external metadata source queried only at import; not AI.                                 | the API, metadata service   |
| **Library root**        | The configured top folder (`FAMILYFLIX_LIBRARY_ROOT`) holding the user's movie folders; not owned by the app. | media folder, source folder |
| **Reference in place**  | Storing a **path** to a video/subtitle where it already lives — the app never copies large media.             | import, copy, ingest        |
| **Managed image cache** | App-owned directory (in OS user-data) holding **Posters**/**Backdrops** downloaded from **TMDB**.             | media store, managed media  |
| **Library storage**     | The repository object from `createSqliteStorage(dbPath)` — the single seam over SQLite.                       | repo, DAO, service          |
| **Edition**             | A specific physical release/cut of a **Movie** (4K, Director's Cut). **Roadmap only** — not modeled in v1.    | version, copy, variant      |
| **Review step**         | The import stage where heuristic folder→**TMDB** matches are confirmed/corrected before committing.           | confirmation, preview       |

## Browse & display (frontend)

| Term                       | Definition                                                                                                                                                                                                                                                                           | Aliases to avoid                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| **Browse home** (updated)  | The `/` route (`LibraryPage`) — the parent-facing home screen listing the **Continue Watching row**, then the **Favorites row**, then the **Genre rows**.                                                                                                                            | home page, browse grid, dashboard     |
| **Genre row**              | A titled horizontal row showing up to 15 **Poster cards** for one **Genre**, with a "View all {count}" link.                                                                                                                                                                         | shelf, carousel row, genre shelf      |
| **Continue Watching row**  | The **Browse home**'s top row: up to 15 **Continue cards** for **In-progress** **Movies**; hidden entirely when there are none.                                                                                                                                                      | resume row, keep watching, up next    |
| **Favorites row** (new)    | The **Browse home**’s shelf of **Favorite** movies — up to 15 **Poster cards** under a 22px heading with an accent heart, between the **Continue Watching row** and the **Genre rows**; hidden entirely when there are none. No **View all**. `FavoritesRow` in code.                | liked row, my list, watchlist         |
| **Home section** (new)     | One named part of a **Home payload** — `continueWatching`, `favorites`, or `rows`. Each is one composition over `browse.listMovies` (a flag plus the shared 15-cap) on top of the same **Library query**, which is what stops the top of the screen disagreeing with the rest of it. | feed section, block, panel            |
| **Card carousel**          | The horizontal scroller (prev/next arrows) inside a row, holding **Poster cards** or **Continue cards** per its **Carousel variant**.                                                                                                                                                | slider, scroller                      |
| **Carousel variant**       | Which card shape a **Card carousel** holds — `poster` or `continue`; also sets the tile width and arrow height.                                                                                                                                                                      | mode, type, kind                      |
| **Poster card**            | The library's primary movie tile: **Poster** (or **Gradient fallback**), title, **Rating** stars, watch state, favorite heart.                                                                                                                                                       | tile, thumbnail, cell                 |
| **Continue card**          | The wide 16:10 resume tile: **Gradient fallback**, title, **Resume label**, progress track, play badge. No **Favorite** heart.                                                                                                                                                       | resume tile, continue tile, hero card |
| **Resume label**           | The human string on a **Continue card** — `Resume · 1:13 of 1:55`, or `Resume · 1:13` when runtime is unknown.                                                                                                                                                                       | timestamp, progress text              |
| **View all** (updated)     | The **Genre row** header link to that **Genre**'s **Genre page** (`/genre/:name`); its count is the **Genre total**, not the 15 shown, and it hands over the **Carried sort**.                                                                                                       | see all, more, expand                 |
| **Home payload** (updated) | The single `GET /api/home` response — three **Home sections**: `{ continueWatching: Movie[], favorites: Movie[], rows: HomeRow[] }` — all built for one **Library query**.                                                                                                           | feed, home data                       |
| **Gradient fallback**      | A deterministic per-**Movie** color gradient (hashed from the **Movie** id) drawn wherever artwork is missing — cards, the detail **Poster**, and the **Backdrop**. Drawn by the `Artwork` primitive, which resolves artwork-or-fallback at every one of those places.               | placeholder art, gradient stops       |
| **Poster URL**             | The browser-loadable URL (`/api/images/…`) that resolves a **Movie**'s **Poster path** through the image route.                                                                                                                                                                      | image src, poster link                |
| **Card view model**        | `PosterCardMovie` — the small display shape a **Movie** is mapped to for a **Poster card** (rating→percent, progress→percent).                                                                                                                                                       | card DTO, card props                  |
| **Continue view model**    | `ContinueCardMovie` — the display shape for a **Continue card**: id, title, gradient stops, **Resume label**, progress percent.                                                                                                                                                      | continue DTO, resume model            |
| **Nominal sliver**         | The small fixed **Progress** bar length shown when a **Movie** is **In-progress** but `runtimeMinutes` is unknown.                                                                                                                                                                   | placeholder progress                  |

## The Movie detail page

| Term                       | Definition                                                                                                                                                                                                           | Aliases to avoid                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Movie detail page**      | The `/movie/:id` route (`MoviePage`) — one **Movie** in full: **Backdrop**, **Poster**, **Meta line**, **Synopsis**, **Credits row**, actions.                                                                       | movie page, detail view, title page  |
| **Detail view model**      | `MovieDetailModel` — the display shape a **Movie** is mapped to for the **Movie detail page**, built by `detailView()`.                                                                                              | detail DTO, page model               |
| **Meta line**              | The inline row under the title assembling the **Meta segments** that exist, separated by `·`.                                                                                                                        | info row, metadata line, subtitle    |
| **Meta segment** (updated) | One item on the **Meta line** — year, **Runtime label**, or the **Rating picker**; an absent one is omitted **with its separator**. The rating segment is the one that is **never** absent, because it is a control. | meta field, detail bit               |
| **Runtime label**          | The human runtime string — `2h 8m`, or `42m` / `2h` when an hour or minute component is zero.                                                                                                                        | duration, length, running time       |
| **Play label**             | The primary button's text — `Play`, or `Resume · 52:00` for an **In-progress** **Movie**, built from the **Resume position**.                                                                                        | play text, CTA label                 |
| **Credits row**            | The **Director** + **Cast** block below the **Synopsis**; a missing one shows `—`, and the row is omitted only when both are absent.                                                                                 | credits block, cast section          |
| **Edit menu**              | The ⋯ overflow menu on the **Movie detail page**; holds Edit details today, Delete movie when that feature ships.                                                                                                    | overflow menu, kebab menu, more menu |
| **Load state**             | Which of `loading` \| `ready` \| `not-found` \| `error` a screen is in; **not-found** and **error** are distinct and offer different actions.                                                                        | status, fetch state                  |
| **Placeholder route**      | A registered route rendering a documented stub, so links have honest destinations before the real screen exists.                                                                                                     | stub page, dummy route, TODO page    |

## Shared UI units

Vocabulary for the units several screens draw from. These name our components,
not anything the prototype adds — `docs/handoff/` gives the visual surface, and
these give the shared code behind it a single agreed name.

| Term                      | Definition                                                                                                                                                                                                                                                                                                                                      | Aliases to avoid                 |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Load message**          | The centred title + body + optional action block a screen shows instead of its content — an empty library, a failed load, a **Movie** that is gone. Named for the **Load state** three of its four uses are in.                                                                                                                                 | empty state, error state, notice |
| **Skeleton**              | One pulsing placeholder block held while content loads. Each screen arranges its own; only the surface and the pulse are shared.                                                                                                                                                                                                                | shimmer, ghost, loader, spinner  |
| **Menu**                  | A popup panel opened by a caller-supplied trigger, closing on Escape, an outside press, or an activated item — returning focus to the trigger every time. The **Edit menu** and every **Filter dropdown** are ones.                                                                                                                             | dropdown, popover, context menu  |
| **Header slot** (updated) | One of a layout's optional places for a screen's own controls — `MainLayout`'s `headerStart` / `headerEnd`, and `GenreLayout`'s `heading` / `headerEnd`. Every screen's chrome is a layout; only what fills the slots is a feature.                                                                                                             | header prop, toolbar, actions    |
| **Row section** (new)     | The chrome every shelf on the **Browse home** shares — a labelled `<section>`, a serif heading at a caller-chosen size, an optional leading icon, an optional trailing action, and the slot a **Card carousel** drops into. `RowSection` in code, and deliberately domain-blind: the **Favorites row** owns its heart’s accent color, not this. | row shell, shelf, section header |
| **Chrome** (new)          | The furniture every full-screen route sits in — the page filling the viewport once, the fixed header strip, the one scrolling body. Shared as styles both layouts extend (`layouts/chrome.styles.ts`), never as one layout extending another.                                                                                                   | shell, frame, wrapper, container |

## The browse load

Vocabulary for the machinery both browse screens run on. These name one hook
apiece, and the policies those hooks hold — policies that were previously stated
twice, in two screens, with nothing holding them together.

| Term                          | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Aliases to avoid                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Browse load** (new)         | One browse screen's request for a **Settled query**, with its **Load state**, its payload and its retry. `useBrowseLoad` in code, at `features/library`'s shared rung. Moves up to `src/hooks/` the day a second feature wants it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | fetch hook, data hook, query hook       |
| **Skeleton latch** (new)      | The rule a **Browse load** holds: once a screen is loaded, a refetch keeps what is painted and only a load with nothing behind it falls back to the **Skeleton**. Flashing the grid every time the typing settles would be unreadable. Stated in exactly one place.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | loading flicker, stale-while-revalidate |
| **Optimistic save** (updated) | The bargain an edit keeps with the server: show the new value at once, take the route's echo over what was assumed, put back what the edit cost if the save is refused. Written twice, for two shapes. `useOptimisticSave` reverts by negating a flag and addresses a **Movie** by id inside a list — the two browse screens' **Favorite** hearts, reaching every **Home section** the **Movie** has a card in. `useOptimisticEdit` is told what to put back rather than deriving it, and edits the one **Movie** a page is holding — all three of the **Movie detail page**'s writes, the watched tick, its own heart and the **Rating picker**. A **Rating** is why the second one exists: eleven values plus an absence, where `!value` can express none of it. | optimistic update, local write, cache   |
| **Single-signal write** (new) | A route that moves exactly one field on one **Movie** and echoes it back: **Favorite**'s, **Watched**'s and the **Rating picker**'s. Three of them, one skeleton — look the **Movie** up, 404 before writing, dispatch to a dedicated mutator, echo `{ value }`. `writeSignal` in code, local to the route layer. What a valid body is stays per-route, because the three disagree.                                                                                                                                                                                                                                                                                                                                                                                | flag route, toggle endpoint, patch      |
| **Wire echo** (new)           | What a **Single-signal write** answers with, and the value an **Optimistic save** reconciles against — the route saying what it actually stored, which beats what the screen assumed. `postValue` at `src/api/` holds the contract for all three saves; each caller says what counts as a usable echo, because for a **Rating** a `null` echo is a cleared **Rating** and for a flag it is nonsense. Only a _missing_ `value` key falls back to what was sent.                                                                                                                                                                                                                                                                                                     | response value, ack, confirmation       |
| **Load key** (new)            | The string that says which **Browse load** a request is — the **Settled query** for the **Browse home**, that plus the **Genre** for a **Genre page**. Change it and the screen reloads; leave it and no amount of re-rendering asks again.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | cache key, dependency, query id         |

## Search, filter & sort

| Term                      | Definition                                                                                                                                                                                                                                      | Aliases to avoid                              |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Library query**         | The **Search text** + **Genre filter** + **Minimum rating** + **Sort order** that together decide what the **Browse home** shows; lives in the URL, never in a component. `LibraryQuery` in code.                                               | home query, filters, criteria, params, search |
| **Search text** (updated) | The free-text fragment of a **Library query** _or_ a **Genre query**, matched against a **Movie**'s title, **Synopsis**, or **Genre** names (`?q=`). Each route carries its own — the **Browse home**'s and a **Genre page**'s never share one. | query, keyword, term, search string           |
| **Genre filter**          | The **Library query**'s restriction to a single **Genre**; `All Genres` is its unset state, not a value.                                                                                                                                        | category filter, genre selection              |
| **Minimum rating**        | The **Library query**'s floor on **Rating** — 8 / 6 / 4 units, shown as `4+ stars` / `3+ stars` / `2+ stars`; **Unrated** **Movies** never pass one.                                                                                            | rating filter, stars, score filter            |
| **Sort order**            | Which of `recently-added` \| `a-z` \| `year` \| `highest-rated` \| `unwatched-first` a **Library query** orders by. Part of the query, but not a filter. The five live once, as `MOVIE_SORTS`.                                                  | ordering, sort by, sorting                    |
| **Settled query**         | The **Library query** as recorded in the URL — what every reader acts on, after the **Search bar**'s 250ms debounce has stopped moving.                                                                                                         | current filters, applied query                |
| **Search bar** (updated)  | A screen header's text control — the **Browse home**'s (`headerStart`, 460px) and the **Genre header**'s (250px, "Search in {genre}"). Always the only holder of un-**settled** input, via **Settled text**.                                    | search box, search field, omnibox             |
| **Filter dropdown**       | One pill-triggered **Menu** presenting the **Filter options** for one part of a **Library query**. The **Browse home** header has three: Genre, rating, Sort.                                                                                   | select, picker, combo box, dropdown           |
| **Filter option**         | One row of a **Filter dropdown** — label, optional count, and whether it is the current selection.                                                                                                                                              | menu item, choice, entry                      |
| **Genre list**            | The **unfiltered** `{ total, genres }` payload from `GET /api/genres` backing the Genre **Filter dropdown**'s counts; fetched once, never per query.                                                                                            | genre counts, facets, genre payload           |
| **No results**            | The **Load message** shown when a **Library query** matches nothing — a different situation from an empty library, with different copy.                                                                                                         | empty state, no matches, zero state           |

## The Genre page (new)

The second browse screen: one **Genre** in full, behind every **Genre row**'s
**View all**. It has its own chrome and its own query, so its vocabulary is
deliberately parallel to the **Browse home**'s rather than shared with it.

| Term                        | Definition                                                                                                                                                                                                                        | Aliases to avoid                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Genre page** (new)        | The `/genre/:name` route (`GenrePage`) — every **Movie** in one **Genre** as a **Library grid**, under a **Genre header**.                                                                                                        | view-all page, category page, genre view  |
| **Genre header** (new)      | The **Genre page**'s own chrome: Back, the **Genre** name over its **Genre count label**, a **Search bar**, and the Sort **Filter dropdown**. Shares nothing with `MainLayout`.                                                   | toolbar, page header, subheader           |
| **Library grid** (new)      | The flat, responsive grid of **Poster cards** that fills the **Genre page** — the whole set, never capped. `LibraryGrid` in code.                                                                                                 | browse grid, gallery, list, results grid  |
| **Genre query** (new)       | The **Search text** + **Sort order** deciding what one **Genre page** shows; lives in that route's URL (`?q=&sort=`). `GenreQuery` in code. Carries no **Genre filter** — the **Genre** is the route — and no **Minimum rating**. | library query, filters, genre filter      |
| **Genre payload** (new)     | The single `{ genre, total, movies }` response from `GET /api/genre/:name` — the **Genre total** and the narrowed list in one request.                                                                                            | genre data, movies payload, results       |
| **Genre total** (new)       | A **Genre**'s **unfiltered** **Movie** count, from `listGenres()` — the same number a **Genre row**'s **View all** promised, unchanged by the **Genre query**.                                                                    | count, result count, matches              |
| **Genre count label** (new) | The **Genre header**'s line under the name — `214 titles`, or `12 of 214 titles` while a **Search text** narrows the grid, or `1 title`.                                                                                          | subtitle, count line, results text        |
| **Carried sort** (new)      | The **Sort order** a **View all** hands from the **Browse home** to the **Genre page** through the link (`/genre/Action?sort=a-z`), omitted at the default.                                                                       | inherited sort, global sort, shared state |
| **Settled text** (new)      | The debounced text behavior shared by every **Search bar**: the field follows each keystroke, the URL is written 250ms after the typing stops. `useSettledText` in code.                                                          | debounce, throttle, input state           |

## Relationships

- A **Movie** has zero-or-more **Genres** (ordered; `genres[0]` is the primary tag) and zero-or-more **Subtitles**.
- The **Browse home** shows the **Continue Watching row**, then the **Favorites row**, then one **Genre row** per **Genre** with ≥1 **Movie**; each row contains one **Card carousel** capped at 15 cards.
- A **Card carousel** holds **Poster cards** or **Continue cards**, never both — decided by its **Carousel variant**.
- A **Poster card** renders one **Movie** via its **Card view model**; it shows the **Poster** when present, else the **Gradient fallback**.
- A **Continue card** renders one **In-progress** **Movie** via its **Continue view model**; it always draws the **Gradient fallback** (it has no image slot) and opens the **Movie detail page**, not the player.
- A **Genre row**'s **View all** count is the **Genre**'s full **Movie** total (`listGenres()`), independent of the 15 cards shown; the **Continue Watching row** has no **View all**.
- A **Movie** has exactly one **video path** (referenced in the **Library root**), and at most one **Poster** and one **Backdrop** (in the **Managed image cache**).
- A **Movie**'s **Status** is derived from **Watched** + **Resume position** — never stored.
- A **Resume label** is derived from **Resume position** + runtime; it is built in the mapper, never inside the **Continue card**.
- A **Rating** belongs to exactly one **Movie**; it is **Unrated** until **TMDB** seeds it or someone sets it from the **Rating picker**.
- A **Rating picker** writes exactly one **Movie**'s **Rating**, through `POST /api/movies/:id/rating` → `setRating` — a **Single-signal write** beside **Favorite**'s and **Watched**'s, never through `updateMovie`.
- A **Half-star segment** is the unit a **Rating picker** sets in; ten of them cover the 0–10 scale, so the picker can express every **Rating** except a literal `0` — clicking the current value's segment means **Unrated**, not nought.
- The out-of-five number beside either star strip is derived from the fill percent, never stored and never computed twice: `toStarLabel` rounds to the nearest **Half-star segment** and prints one decimal, so `StarRating` reading `4.0` and a **Rating picker** reading `4.0 / 5` can never disagree about the same **Movie**.
- A **Rating preview** belongs to one **Rating picker** and never leaves it; nothing outside the component ever sees an uncommitted **Rating**.
- One **Movie** maps to exactly one **TMDB** entry (`tmdb_id`); in v1 one **Movie** = one video file (no **Editions**).
- The **Movie detail page** renders exactly one **Movie** via its **Detail view model**; every display decision (which **Meta segments** survive, the **Runtime label**'s wording, the **Play label**, whether there is a **Credits row**) is made in `detailView()`, never in the component.
- A **Meta segment** that is absent takes its separator with it — the **Meta line** never renders a dangling `·`.
- **Unrated** renders as five empty **Rating picker** stars labelled `Not rated` on the **Movie detail page** (**retracted**: it used to be an absent **Meta segment**), and as five empty stars with no numeric value on a **Poster card**. Neither surface prints `0.0` for it.
- A **Library query** produces exactly one **Home payload**; all three **Home sections** are built from it, so they narrow together.
- A **Favorite** **Movie** appears in the **Favorites row** _and_ in every **Genre row** it is tagged with — several **Poster cards**, one **Favorite**. Toggling any one of those hearts moves all of them, in a single state update.
- The **Favorites row** renders the **Favorite** members of what its **Home section** loaded, not the section itself: un-favoriting hides the card at once while the **Movie** stays in state, which is the only way an **Optimistic save** can put it back when the write is refused.
- The **Favorites row** and the **Continue Watching row** have no **View all**, and no page behind them; only a **Genre row** does.
- The **Continue Watching row**, the **Favorites row** and a **Genre row** are all one **Row section** with a different heading, icon and action — three shelves, one piece of chrome.
- The **Search bar** and the **Filter dropdowns** only ever _write_ a **Library query**; everything that renders reads the **Settled query** from the URL, so no screen owns it.
- A **Filter dropdown** holds one **Filter option** per choice, exactly one of which is selected; `All Genres` and `All ratings` are the options that mean "unset".
- A **Genre row**'s **View all** count comes from the **Genre list**, not the **Library query** — it stays the **Genre**'s true total even when the row shows three matches.
- **No results** and "Your library is empty" are different **Load messages**: the first means a **Library query** matched nothing, the second means there are no **Movies** at all.
- One **Genre page** shows exactly one **Genre**, named by the route rather than by a **Genre filter**; a **Genre query** therefore has two parts where a **Library query** has four.
- A **Genre query** produces exactly one **Genre payload**, and both the **Genre count label** and the **Library grid** are built from it — the header can never disagree with the grid below it.
- A **Genre total** comes from `listGenres()`, never from the **Genre payload**'s `movies.length`; the two are equal only when nothing narrows the grid.
- A **View all** carries the **Sort order** to the **Genre page** as the **Carried sort**, but never the **Search text** — the **Genre header**'s **Search bar** starts empty.
- `features/library` is grouped **by screen**, not by kind: `home/` holds the **Browse home**'s units, `genre/` holds the **Genre page**'s, and what both draw on stays at the top of the feature — the **Browse load**, the **Optimistic save**, the **Card carousel**, the **Library grid**, the shared skeleton card and the retryable failure. A third browse screen gets a third folder, not a third copy.
- Both browse screens run one **Browse load** each, and both hold the **Skeleton latch** and the **Optimistic save** by using the same two hooks rather than by restating them.
- A **Minimum rating** exists only in a **Library query**. The **Genre header** has no rating **Filter dropdown**, so the **Genre page** applies no rating floor at all.
- A **Library grid** holds **Poster cards** only — never **Continue cards**, and never a **Card carousel**; it is the uncapped counterpart of a **Genre row**.
- Every **Search bar** in the app gets its debounce from **Settled text**; there is exactly one such behavior, whatever the screen.

## Example dialogue

> **Dev:** "When the importer reads a folder named `Northwind (2018) 1080p BluRay`,
> what becomes the **Movie**?"
> **Maintainer:** "Strip the release tokens, search **TMDB** by title and year,
> and that one **TMDB** entry is the **Movie**. The video stays where it is —
> we **reference it in place** under the **Library root**, we never copy it."
> **Dev:** "And the **Poster**?"
> **Maintainer:** "That we download from **TMDB** into the **Managed image cache**,
> because it isn't on my disk and I need it offline. Same for the **Backdrop** —
> that's the one behind the title on the **Movie detail page**."
> **Dev:** "If **TMDB** gives us neither?"
> **Maintainer:** "Then both slots draw the **Gradient fallback**. It's the same
> colors either way, hashed off the **Movie** id, so it looks deliberate rather
> than broken."
> **Dev:** "On the detail page I've got a **Movie** with no year and no runtime.
> What does the **Meta line** show?"
> **Maintainer:** "Just the stars. A **Meta segment** we don't have doesn't get a
> placeholder, and it takes its separator with it — I never want to see a bullet
> floating with nothing on either side of it."
> **Dev:** "And if it's **Unrated** too — do the stars go with it?"
> **Maintainer:** "They used to. Not any more, now that they're a **Rating picker** —
> five empty ones and the words 'Not rated'. Empty stars reading '0.0' sounded like
> we'd watched it and scored it nothing; empty stars you can _click_ read as 'go on
> then'. And it's the **Unrated** ones I actually want to rate, so hiding the control
> on exactly those was backwards."
> **Dev:** "How fine can she go? Does clicking the left side of the third star mean
> two and a half?"
> **Maintainer:** "Yes — that's a **Half-star segment**, ten of them across the row.
> Hovering shows you what you'd get before you commit to it."
> **Dev:** "And if she mis-clicks? There's no undo."
> **Maintainer:** "Click the same **Half-star segment** again and it goes back to
> **Unrated**. Same as clicking the heart twice. It can't set a flat zero, mind —
> nought out of ten and 'nobody's said' are different things, and the only one worth
> a click is the second."
> **Dev:** "On the **Poster card**, then — **Unrated** still shows five empty stars?"
> **Maintainer:** "It has to, or the rows go uneven. But drop the '0.0' next to them.
> That's the bit that was making it look like a verdict."
> **Dev:** "I've got one sitting at `Resume · 52:00`. If I mark it **Watched** and
> then change my mind, do I get my 52 minutes back?"
> **Maintainer:** "No — marking it **Watched** clears the **Resume position**. That's
> right for finishing a film and wrong for 'I've seen this before', and we know it.
> Nothing writes a **Resume position** until the player ships anyway."
> **Dev:** "The ⋯ **Edit menu** only has one item in it."
> **Maintainer:** "That's fine. Delete isn't designed yet — there's no confirmation
> anywhere in the prototype, so it isn't shipping as a button that looks like it
> deletes and doesn't."
> **Dev:** "And Play, with no player built?"
> **Maintainer:** "A **Placeholder route**. Same as the detail page itself was until
> now — a real URL with a stub behind it, so the link is honest and the screen
> lands there later without anything having to change."
> **Dev:** "When Mum types 'com' in the **Search bar**, does the **Continue Watching
> row** stay put?"
> **Maintainer:** "No — it narrows with everything else. One **Library query**, one
> **Home payload**. If nothing she's part-way through matches 'com', that row goes
> too. Anything else would be the screen disagreeing with itself."
> **Dev:** "The Genre **Filter dropdown** says 'Drama 6'. Once she's typed 'com',
> does that 6 become 1?"
> **Maintainer:** "No. Those counts come from the **Genre list**, and that's the
> whole library, always. A list that reshuffles while you're reaching for it is
> horrible — and she'd never find the genre she wanted."
> **Dev:** "She picks Drama and **Minimum rating** `4+ stars`, and nothing comes back."
> **Maintainer:** "Then **No results** — but don't quote her back an empty search.
> She didn't type anything; the genre and the stars did it. Say the filters."
> **Dev:** "Last one: does the whole screen go back to skeletons on every keystroke?"
> **Maintainer:** "God, no. Skeletons on the first load only. After that the rows she's
> looking at stay on screen until the new ones are ready — she's reading them."
> **Dev:** "She's sorted the home A–Z and clicks **View all** on Drama. What order
> does the **Genre page** open in?"
> **Maintainer:** "A–Z. If I've just told the app how I want things arranged, going
> one level deeper shouldn't quietly undo it. The link carries it — that's the
> **Carried sort**."
> **Dev:** "Her search too? She'd typed 'com' on the home."
> **Maintainer:** "No. That box says 'Search in Drama' now — it's a different, smaller
> search. Starting it with someone else's word in it would be confusing."
> **Dev:** "The header says '12 of 214 titles'. Where does 214 come from — the 12 are
> what came back."
> **Maintainer:** "214 is the **Genre total**, the same number the row promised on the
> way in. If that shrank every time she typed, the two screens would be telling her
> different things about the same shelf."
> **Dev:** "She had **Minimum rating** `4+ stars` set on the home. Does that follow her
> into Drama?"
> **Maintainer:** "No — there's no star pill on that screen. A filter I can't see and
> can't turn off is worse than no filter. If I'm hiding half her Dramas, there has to
> be something on screen saying so."
> **Dev:** "And `/genre/Westerns` when we own no westerns?"
> **Maintainer:** "Just 'Nothing here'. Not an error — she probably bookmarked it back
> when we had two. Different from 'No matches', which means the **Genre** is there
> and her word missed."
> **Dev:** "New shelf. Can the **Favorites row** just be the hearts I can already see
> in the **Genre rows**?"
> **Maintainer:** "No — those rows stop at 15 each, and a **Movie** with no **Genre**
> gets no row at all. You'd quietly lose favorites. Ask the server for the
> **Home section**."
> **Dev:** "Does it narrow with the **Search bar** and the filters, like the
> **Continue Watching row**?"
> **Maintainer:** "Yes. Same **Library query**, same **Home payload**, same 15-cap.
> One screen, one question."
> **Dev:** "She un-hearts something from that shelf. Does the card go?"
> **Maintainer:** "Straight away — a shelf called Favorites holding something she
> just un-favorited is lying to her. But keep it in memory: if the save fails it
> has to come back."
> **Dev:** "That same film is in the Drama row below. Does its heart move too?"
> **Maintainer:** "It had better. It's one film. Two hearts telling her different
> things about it is exactly the sort of thing that makes her stop trusting the app."
> **Dev:** "And past the fifteenth favorite?"
> **Maintainer:** "Unreachable for now. There's no **View all** on that shelf and no
> page behind it in the prototype — so that's a prototype conversation, not
> something you invent while you're building."

## Flagged ambiguities

- **The Favorites row has no View all, and that strands favorites (new):**
  the prototype (`page.LibraryPage.dc.html:181–219`) gives the shelf no trailing
  action and `docs/handoff/` has no Favorites page, so the 15-cap every **Home
  section** takes has nothing behind it here — a 16th **Favorite** is reachable
  from no route in the app. A **Genre row**'s cap is safe precisely because
  **View all** exists. Recorded as a **prototype amendment**, not built:
  `08-favorites` Q10.
- **"Favorites" is a shelf, not a filter (new):** the **Favorites row** is a
  **Home section**, and there is no favorites **Filter dropdown**, no
  `favoritesOnly` in a **Library query**, and no `/favorites` route. The
  `favoritesOnly` flag exists on the repository's `MovieQuery` only, where
  `getHome` sets it to build that one section — it is not something a URL can
  ask for.
- **What the Favorites row renders is not what its Home section holds (new):**
  the section keeps every **Movie** the payload sent; the row draws the
  **Favorite** ones. The difference is load-bearing rather than cosmetic — an
  **Optimistic save** reverts by flipping the flag back, so a card spliced out of
  state could never return when a write is refused.
- **"Movie" vs "Film":** the maintainer says _film_ conversationally, but **Movie**
  is the single canonical term in code, schema, prototype, and docs. _Film_ is an
  accepted informal synonym; do not introduce a `Film` type or `films` table.
- **"Media folder" / `FAMILYFLIX_MEDIA_PATH`:** historically meant the directory
  films were **copied** into. That model is retired — large media is **referenced
  in place** under the **Library root**, and only **Posters**/**Backdrops** live in
  the **Managed image cache**. Avoid "media folder" for either; name the specific one.
- **"Rating":** means the **household** score only. **TMDB**'s community
  `vote_average` is its _source_ at seed time, not a separate stored concept — there
  is no second "community rating" field.
- **"Edition":** discussed but **deferred to roadmap**. In v1 a **Movie** is one
  video file; do not model **Editions** yet.
- **"Browse grid" vs "Browse home" (updated — now a real collision):** the
  CLAUDE.md feature "Browse grid" names the **Genre row** body specifically, and
  the screen it lives on is the **Browse home** (`LibraryPage`). The **Library
  grid** now exists as an actual flat grid on the **Genre page**, so "grid" is no
  longer merely suggestive of two things — it names two. Prefer **Genre row** for
  the home's rows, **Browse home** for that screen, and **Library grid** only for
  the **Genre page**'s uncapped grid. Never say "browse grid" for either.
- **"Rating" on a card (updated — resolved by Ratings):** an **Unrated** **Movie**
  used to map to `★★★★★ 0.0` on a **Poster card**, identical to a literal 0. The
  star row stays — it is fixed furniture in a fixed-height tile, and removing it
  would make cards in a row uneven — but the **numeric value is omitted** when
  **Unrated**. So **Unrated** reads `★★★★★` and a literal `0` reads `★★★★★ 0.0`.
  `StarRating.rating` and `PosterCardMovie.rating` are `number | null` to carry
  the distinction rather than have each caller re-derive it. **No longer open.**
- **The Unrated Meta segment was retracted (new):** `04-movie-detail` Q10 omitted
  the rating **Meta segment** entirely for an **Unrated** **Movie**, on the
  grounds that empty stars printing `0.0` sound like a verdict — and named this
  feature as the successor that would give **Unrated** "the affordance that acts
  on it". The affordance is here, so the segment comes back: empty stars that are
  visibly a **Rating picker** labelled `Not rated` read as an invitation, and the
  **Movies** most in need of a **Rating** are exactly the ones the old rule left
  with nothing to click. Older commits and `04-movie-detail.md` describe the
  omission; `07-ratings.md` Q5 is the current rule. **Landed under #62 — no
  longer open.**
- **The Rating picker is a prototype amendment (resolved — the project's
  first):** `page.MoviePage.dc.html` rendered `prim.StarRating` display-only, and
  the prototype's only **Rating picker** was inside `feat.MovieForm` — a 🔜
  maintainer screen. The prototype **was amended** so the **Meta line**'s rating
  **Meta segment** is a **Rating picker** at `size=20`, per CLAUDE.md's "amend the
  prototype first, then build to the amended prototype". The reasons are on the
  record in `07-ratings.md` Q2: README files Ratings as parent-facing, `setRating`
  is `setFavorite`'s sibling in one `curation` slice and **Favorite** is settable
  here, and a molecule with no call site is speculative work. The amendment
  (`f8b8f5b`) landed **before** the first line of implementation (`8a14170`), and
  that order — not the outcome — is the precedent: raise it in grill-me, amend the
  prototype, then build to the amended prototype. Never build something different
  and reconcile afterwards, which is how "the prototype is the spec" quietly
  becomes "the prototype is where we started".
- **"Progress" is three things:** the stored **Resume position** (seconds),
  the 0–100 display percent on a card's bar, and the **Resume label** string. Never
  say bare "progress" across the seam — name which one. The stored value is always
  **Resume position**.
- **"Continue Watching" does not mean most-recently-watched:** the row is
  ordered `recently-added`, because no sort exists over "when did playback last
  touch this" and nothing writes **Resume position** until the player ships. The
  name describes _which_ **Movies** appear (**In-progress**), not their order —
  revisit the ordering with the player.
- **The Continue card has no artwork:** it is **Gradient fallback**-only by
  the prototype's design — there is no image slot in `mol.ContinueCard`, unlike the
  **Poster card**. A **Movie**'s **Backdrop** would suit the 16:10 tile, but adding
  it is a **prototype amendment**, not an implementation choice.
- **An empty `?sort=` is the default order, on all three endpoints (resolved):**
  `/home` and `/genre/:name` have always read an empty value as "no sort at all"
  and both have a test saying so. `GET /api/movies?sort=` disagreed and answered
  400 — untested, unused by any client, and contradicted by its own comment.
  Corrected under issue #55: all three now read it the same way, through one
  parser. An **unknown** sort is still a 400 everywhere.
- **"Hero" is still not a term:** the **Movie detail page**'s top art area is
  a slot, not a concept — it shows the **Backdrop** when there is one and the
  **Gradient fallback** otherwise. _Hero_ remains an alias to avoid for **Backdrop**;
  don't reintroduce it for the area either.
- **"Description" vs "Synopsis":** `feat.MovieForm` labels the field
  **Description**, but the column, the model, and the **Movie detail page** all say
  `synopsis`. **Synopsis** is canonical; treat the form's label as UI copy only and
  do not introduce a `description` field.
- **Marking Watched destroys the Resume position:** `markWatched` zeroes
  `resume_position_seconds` by documented convention, so the **Movie detail page**'s
  reversible watched toggle loses the position on a round trip. `inProgressOnly` is
  `watched = 0 AND resume > 0`, so the flag alone already removes the **Movie** from
  the **Continue Watching row** — the zeroing is no longer load-bearing. **Flagged
  for the watch-tracking grill:** should `markWatched` preserve it?
- **"Filter" colloquially swallows sort:** **Sort order** is part of a
  **Library query** but changes _which order_, never _which_ **Movies**. The
  component holding all three dropdowns is `LibraryFilters` for layout reasons
  (they share the header's trailing group), not because sort is a filter. Say
  **Library query** when you mean all four, and never "the filters" for the sort.
- **"Rating" vs "Minimum rating":** a **Rating** belongs to a **Movie**;
  a **Minimum rating** is a floor in a **Library query**. Both are in 0–10 units
  and both are rendered as stars, so name which one. Note the asymmetry: an
  **Unrated** **Movie** shows five empty stars on a **Poster card** but is
  _excluded_ by any **Minimum rating** — it does not behave as a 0. A **Rating
  picker** sets the former and never the latter; the **Minimum rating** has its
  own **Filter dropdown**.
- **The query is the library's, not the home screen's (refactor 05):** the type
  is `LibraryQuery`; it was `HomeQuery` until the search + filter refactor, which
  is why older commits and design logs say the latter. `HomePayload` and
  `HomeRow` keep their home names deliberately — a payload really is one
  screen's, where the query narrows the whole library.
- **One list of Sort orders, and the type is made from it (refactor 05):** the
  five orders are declared once as `MOVIE_SORTS` in `src/types/browse.ts`, and
  `MovieSort` is derived from that tuple. Both build targets import it as a
  value, so a route validator, a URL parser and a **Filter dropdown** cannot come
  to recognise different sets of orders. Adding a sixth means adding it there,
  and the compiler then asks the exhaustive records — `ORDER_BY` and the sort
  **Filter option** rows — for its SQL and its label.
- **"Search" is a feature folder and a field:** `features/search/` owns all
  four controls, not just the text one. The `search` field of a query is the
  **Search text** alone. The URL and the API both say `q` for it; only the domain
  types say `search`.
- **Search matches more than titles:** **Search text** matches title,
  **Synopsis** _or_ **Genre** name, per the prototype. So typing "comedy" returns
  comedies without touching the **Genre filter**, and the two mechanisms can
  overlap.
- **Case-insensitive search is ASCII-only:** SQLite's `LIKE` folds case for
  A–Z and for nothing else, so **Search text** `amélie` finds _Amélie_ while
  `AMÉLIE` does not — the ASCII letters around the accent fold, the `é`/`É` pair
  is compared byte for byte. A **known limit, recorded rather than worked
  around**: every fix (a normalised shadow column, folding at write time, FTS
  with `unicode61`) is schema work this feature had no reason to buy. Worth
  revisiting when a title with an accent is actually in the library.
- **Genre order is one order, count descending (settled #39):** every surface
  that lists **Genres** — the **Browse home**'s **Genre rows** and the Genre
  **Filter dropdown** above them — orders them by movie count descending with an
  alphabetical tiebreak, as the prototype draws them
  (`FamilyFlix.dc.html:328` and `:409`). It is one order because it is one list:
  `listGenres()` is `ORDER BY COUNT(mg.movie_id) DESC, g.name`, and both surfaces
  read it, so the header can never rank the **Genres** differently from the body
  underneath it. The tiebreak is what makes the list learnable — two **Genres**
  holding the same count must not swap places between visits. Resolves the
  alphabetical row order carried since **02**, which was a pre-existing
  browse-grid divergence rather than anything the search work introduced.
- **Edit has no route of its own:** COMPONENT-SPEC lists no `/edit`; the
  prototype reuses the add screen with an `addContext: 'edit'` flag. The **Movie
  detail page** navigates to `/add?movie=<id>` as a **provisional** contract — the
  movie-form grill owns the real one.
- **"Genre" is now three things (new):** the **Genre** entity (a row in `genres`),
  the **Genre filter** (a **Library query** narrowing the **Browse home** to one),
  and the **Genre page** (a route that _is_ one). They behave differently: the
  filter is optional and has an unset state (`All Genres`), the route never does.
  A `?genre=` on `/genre/:name` is meaningless and is ignored. Say which one.
- **Sort carries between screens, search does not (new):** deliberate, and the
  asymmetry is the point — an order is a standing preference, a **Search text** is
  a question just asked. It follows the prototype, which shares `sort` state
  across screens but clears `genreSearch` on entry (`FamilyFlix.dc.html:307`).
  Because our query lives in the URL, "carries" means the **View all** link writes
  it; nothing is shared between routes. See **Carried sort**.
- **The prototype applies a rating filter it does not show (new — deviation):**
  `genrePageMovies()` calls `passRating(m)` (`:320`) while the **Genre header**
  has no rating **Filter dropdown**. We reproduce the surface and drop the
  filter — the same rule `parseLibraryQuery` already records: the URL and the
  screen must agree, so nothing narrows the library behind a control that is not
  there. A **recorded divergence from the prototype's behavior**, not an
  oversight; if a rating floor is ever wanted here, it arrives with a pill and a
  **prototype amendment**.
- **"1 titles" is a prototype copy bug (new):** the **Genre count label** in
  `FamilyFlix.dc.html:490` is `all + ' titles'` unconditionally. The fix is
  singularisation (`1 title`), and per CLAUDE.md it is a **prototype amendment
  made first** — the build then matches the amended prototype rather than
  improving on it in code.
- **Two query parsers, on purpose (new):** `parseLibraryQuery` reads four
  parameters and `parseGenreQuery` reads two. A single parametrised parser would
  make the **Genre page** silently accept a `rating` and a `genre` it cannot show,
  which is exactly the screen-disagrees-with-the-URL failure both were written to
  prevent. They share `isMovieSort`, not their vocabulary.
- **`GET /api/movies` is no longer any screen's endpoint (new):** the **Genre
  page** takes `GET /api/genre/:name` instead, because it needs the **Genre
  total** beside the list and one request rather than a fan-out. `/api/movies`
  stays as the generic browse API the exporter will want; its comment claiming it
  is "for the genre page" is corrected. If nothing has claimed it by the time
  export ships, delete it then.
