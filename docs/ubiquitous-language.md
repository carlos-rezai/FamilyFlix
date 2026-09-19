# Ubiquitous Language

## Library entities

| Term                   | Definition                                                                                                                                                                                                                                                         | Aliases to avoid                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| **Movie**              | A single film in the library — the canonical domain entity, one row in `movies`, one poster card.                                                                                                                                                                  | _film_ (informal synonym OK)       |
| **Genre**              | A shared, queryable category a **Movie** belongs to; a real entity (junction table), used to browse.                                                                                                                                                               | category, tag                      |
| **Subtitle**           | A subtitle **file asset** owned by a **Movie** — a path + human language label + track order.                                                                                                                                                                      | caption, sub track                 |
| **Synopsis**           | The **Movie**'s long-form plot summary (`synopsis`), shown clamped-and-expandable on the **Movie detail page**.                                                                                                                                                    | description, plot, overview, blurb |
| **Cast**               | The display-only ordered list of actor names on a **Movie** (JSON, never queried).                                                                                                                                                                                 | actors list, credits               |
| **Director**           | The single display-only director name on a **Movie**.                                                                                                                                                                                                              | —                                  |
| **Poster** (updated)   | The portrait cover image for a **Movie**, living in its **Movie folder** — a file the maintainer picks in the **Movie form**, or the one **Bulk import** found in the **Source folder** (`poster.*`, `folder.*`, `cover.*`, else the first image).                 | cover, thumbnail                   |
| **Backdrop** (updated) | The wide image behind the **Movie detail page**'s title block; filled only by **Bulk import** from a `fanart.*` / `backdrop.*` image in the **Source folder** — the **Movie form** has no slot for one, so a hand-added **Movie** draws the **Gradient fallback**. | banner, hero, background           |

## Rating & watch state

| Term                      | Definition                                                                                                                                                                                                                                                                                                                                                                                     | Aliases to avoid                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Rating** (updated)      | Household 0–10 half-star score (10 = 5 stars), set or cleared any time from a **Rating picker** — on the **Movie detail page** or in the **Movie form** — or read from the spreadsheet's rating column by **Bulk import**. A stored `0` can only arrive from a sheet; a picker sets 1–10 or clears to **Unrated**.                                                                             | review, score, vote                   |
| **Unrated** (updated)     | A **Movie** with no **Rating** (`NULL`) — distinct from a literal 0-star rating. Renders as five **empty, clickable** stars labelled `Not rated` on the **Movie detail page**, and as five empty stars with **no numeric value** on a **Poster card**.                                                                                                                                         | zero stars, unscored, 0 stars         |
| **Status**                | A **Movie**'s **derived** watch state: `unwatched` \| `in-progress` \| `watched` (never stored).                                                                                                                                                                                                                                                                                               | state, watch status                   |
| **Watched** (updated)     | Explicit boolean flag meaning the maintainer marked a **Movie** finished; setting it via `markWatched` also clears the **Resume position** and stamps **Last watched at**.                                                                                                                                                                                                                     | seen, completed                       |
| **Resume position**       | Seconds into a **Movie**'s video where playback last stopped (`resume_position_seconds`).                                                                                                                                                                                                                                                                                                      | progress, playback time               |
| **In-progress**           | Derived **Status** when `resume_position_seconds > 0` and not **Watched**.                                                                                                                                                                                                                                                                                                                     | partially watched                     |
| **Last watched at** (new) | ISO stamp of when a **Movie** was last watched (`last_watched_at`), `null` until it has been. Written only by `setResumePosition` and `markWatched` — never by `markUnwatched`, never by `updateMovie` — so it records watching and nothing else. It is the **Continue Watching row**'s order and is rendered by no screen.                                                                    | updated at, watched date, last played |
| **Favorite** (updated)    | Per-movie household boolean (`is_favorite`), togglable from any **Poster card**'s heart on either browse screen and from the **Movie detail page**, and surfaced as the **Favorites row**. One **Movie**'s **Favorite** is one value however many cards show it. **Spelled in full everywhere in code** — no `Fav` abbreviation at any rung, including props, styled components and constants. | liked, starred, bookmark, fav         |

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

| Term                              | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Aliases to avoid                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| **TMDB** (updated)                | The Movie Database — **not consulted by anything in the app**. `13-bulk-import.md` Q18 took it out of **Bulk import**: what it would add is an **Enrichment** pass over an already-filled library, a future initiative with its own prototype amendment, if ever. `tmdb_id` is `null` on every **Movie**.                                                                                                                                                                       | the API, metadata service           |
| **Library root** (updated)        | The top folder holding the family's own **Source folders** — **not owned by the app**, never written to, and never served from. The **Movie form** picks files from it through a browser picker; **Bulk import** is handed its path and walks it, and copies out of it and nothing else.                                                                                                                                                                                        | media folder, source folder         |
| **Managed media directory** (new) | The app-owned root (`FAMILYFLIX_MEDIA_PATH`, in OS user-data when packaged) holding every file the app can deliver — videos, **Subtitles**, **Posters**, **Backdrops**. Adding a **Movie** copies its files into here, and the app owns that copy: the source folder stops being the source of truth. Replaces **Managed image cache**.                                                                                                                                         | media store, media folder, cache    |
| **Stored path** (new)             | A **Movie**'s path to one of its files, always **relative to the Managed media directory** and never absolute. `mediaFilePath` resolves one to an open file, refusing anything that leaves the root — including via a symlink — which is what makes it a boundary rather than a convention.                                                                                                                                                                                     | file path, absolute path, full path |
| **Movie folder** (new)            | One **Movie**'s own directory under the **Managed media directory**, named from its title and year (`the-lantern-keeper-2019`), suffixed on collision. It is the first segment of every one of that **Movie**'s **Stored paths**, and it is never renamed when the title is edited. A **Delete** removes it by that name — `removeMovieFolder` — whether or not the video is still in it, so a film whose file was taken away by hand does not strand its poster and subtitles. | slug dir, media dir, bucket         |
| **Library storage**               | The repository object from `createSqliteStorage(dbPath)` — the single seam over SQLite.                                                                                                                                                                                                                                                                                                                                                                                         | repo, DAO, service                  |
| **Edition**                       | A specific physical release/cut of a **Movie** (4K, Director's Cut). **Roadmap only** — not modeled in v1.                                                                                                                                                                                                                                                                                                                                                                      | version, copy, variant              |
| **Review step** (updated)         | The third **Import phase**: the screen listing every **Problem** the **Current run** raised, each with **Resolve** and **Skip**, over the two stat tiles. Confident matches are already in the library by the time it shows — it reviews the flagged rows, not the run (`13-bulk-import.md` Q16).                                                                                                                                                                               | confirmation, preview               |
| **Reference in place** (retired)  | ~~Storing a path to a video where it already lives.~~ **Retired** — `01-library-core.md` Q17 chose it over CLAUDE.md's **Managed copy**, and `11-add-movie.md` Q3 reverses that: every read route the app shipped since resolves a **Stored path** under the **Managed media directory**, and a browser file picker cannot supply a path at all.                                                                                                                                | —                                   |

## Browse & display (frontend)

| Term                                | Definition                                                                                                                                                                                                                                                                                                                                                  | Aliases to avoid                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Browse home** (updated)           | The `/` route (`LibraryPage`) — the parent-facing home screen listing the **Continue Watching row**, then the **Favorites row**, then the **Genre rows**.                                                                                                                                                                                                   | home page, browse grid, dashboard     |
| **Genre row**                       | A titled horizontal row showing up to 15 **Poster cards** for one **Genre**, with a "View all {count}" link.                                                                                                                                                                                                                                                | shelf, carousel row, genre shelf      |
| **Continue Watching row** (updated) | The **Browse home**'s top row: up to 15 **Continue cards** for **In-progress** **Movies**, **most-recently-watched first**; hidden entirely when there are none. It is the one **Home section** that pins its own **List sort** (`last-watched`) and ignores the header's **Sort order**, while still narrowing with every filter of the **Library query**. | resume row, keep watching, up next    |
| **Favorites row** (new)             | The **Browse home**’s shelf of **Favorite** movies — up to 15 **Poster cards** under a 22px heading with an accent heart, between the **Continue Watching row** and the **Genre rows**; hidden entirely when there are none. No **View all**. `FavoritesRow` in code.                                                                                       | liked row, my list, watchlist         |
| **Home section** (new)              | One named part of a **Home payload** — `continueWatching`, `favorites`, or `rows`. Each is one composition over `browse.listMovies` (a flag plus the shared 15-cap) on top of the same **Library query**, which is what stops the top of the screen disagreeing with the rest of it.                                                                        | feed section, block, panel            |
| **Card carousel**                   | The horizontal scroller (prev/next arrows) inside a row, holding **Poster cards** or **Continue cards** per its **Carousel variant**.                                                                                                                                                                                                                       | slider, scroller                      |
| **Carousel variant**                | Which card shape a **Card carousel** holds — `poster` or `continue`; also sets the tile width and arrow height.                                                                                                                                                                                                                                             | mode, type, kind                      |
| **Poster card**                     | The library's primary movie tile: **Poster** (or **Gradient fallback**), title, **Rating** stars, watch state, favorite heart.                                                                                                                                                                                                                              | tile, thumbnail, cell                 |
| **Continue card**                   | The wide 16:10 resume tile: **Gradient fallback**, title, **Resume label**, progress track, play badge. No **Favorite** heart.                                                                                                                                                                                                                              | resume tile, continue tile, hero card |
| **Resume label**                    | The human string on a **Continue card** — `Resume · 1:13 of 1:55`, or `Resume · 1:13` when runtime is unknown.                                                                                                                                                                                                                                              | timestamp, progress text              |
| **View all** (updated)              | The **Genre row** header link to that **Genre**'s **Genre page** (`/genre/:name`); its count is the **Genre total**, not the 15 shown, and it hands over the **Carried sort**.                                                                                                                                                                              | see all, more, expand                 |
| **Home payload** (updated)          | The single `GET /api/home` response — three **Home sections**: `{ continueWatching: Movie[], favorites: Movie[], rows: HomeRow[] }` — all built for one **Library query**.                                                                                                                                                                                  | feed, home data                       |
| **Gradient fallback**               | A deterministic per-**Movie** color gradient (hashed from the **Movie** id) drawn wherever artwork is missing — cards, the detail **Poster**, and the **Backdrop**. Drawn by the `Artwork` primitive, which resolves artwork-or-fallback at every one of those places.                                                                                      | placeholder art, gradient stops       |
| **Poster URL**                      | The browser-loadable URL (`/api/images/…`) that resolves a **Movie**'s **Poster path** through the image route.                                                                                                                                                                                                                                             | image src, poster link                |
| **Card view model**                 | `PosterCardMovie` — the small display shape a **Movie** is mapped to for a **Poster card** (rating→percent, progress→percent).                                                                                                                                                                                                                              | card DTO, card props                  |
| **Continue view model**             | `ContinueCardMovie` — the display shape for a **Continue card**: id, title, gradient stops, **Resume label**, progress percent.                                                                                                                                                                                                                             | continue DTO, resume model            |
| **Nominal sliver**                  | The small fixed **Progress** bar length shown when a **Movie** is **In-progress** but `runtimeMinutes` is unknown.                                                                                                                                                                                                                                          | placeholder progress                  |

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
| **Edit menu** (updated)    | The ⋯ overflow menu on the **Movie detail page**: Edit details, and the **Danger row** that opens the **Delete dialog**. It owns whether that dialog is open, because it owns the row.                               | overflow menu, kebab menu, more menu |
| **Load state**             | Which of `loading` \| `ready` \| `not-found` \| `error` a screen is in; **not-found** and **error** are distinct and offer different actions.                                                                        | status, fetch state                  |
| **Placeholder route**      | A registered route rendering a documented stub, so links have honest destinations before the real screen exists.                                                                                                     | stub page, dummy route, TODO page    |

## Shared UI units

Vocabulary for the units several screens draw from. These name our components,
not anything the prototype adds — `docs/handoff/` gives the visual surface, and
these give the shared code behind it a single agreed name.

| Term                         | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Aliases to avoid                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **Load message**             | The centred title + body + optional action block a screen shows instead of its content — an empty library, a failed load, a **Movie** that is gone. Named for the **Load state** three of its four uses are in.                                                                                                                                                                                                                                                                    | empty state, error state, notice                     |
| **Skeleton**                 | One pulsing placeholder block held while content loads. Each screen arranges its own; only the surface and the pulse are shared.                                                                                                                                                                                                                                                                                                                                                   | shimmer, ghost, loader, spinner                      |
| **Menu**                     | A popup panel opened by a caller-supplied trigger, closing on Escape, an outside press, or an activated item — returning focus to the trigger every time. The **Edit menu** and every **Filter dropdown** are ones.                                                                                                                                                                                                                                                                | dropdown, popover, context menu                      |
| **Danger row** (new)         | A `MenuItem` with `danger` set — the danger colour for its ink and a tint of it on hover, as `page.MoviePage` draws `🗑 Delete movie`. A statement about the row's consequence, not a mode: it closes the **Menu** and reports like any other. The only one in the app.                                                                                                                                                                                                            | destructive item, red row, delete option             |
| **Modal** (updated)          | The scrimmed, centred card every dialog in the app is drawn on — `components/Modal`: a header (icon tile, title, subtitle, ✕) over a body slot, rendered through a portal above the whole route. It owns the whole of getting rid of itself — Escape, the scrim, the ✕, focus in on open and back out on close, Tab held inside — the way **Menu** owns dismissal. The **Delete dialog** is one; the **Export dialog** is the second, and its done face is the one **Bare modal**. | dialog, overlay, popup, lightbox, sheet              |
| **Bare modal** (new)         | A **Modal** with `bare`: no header, no ✕, no body padding — the card is whatever the caller draws, and `title` becomes its accessible name instead of a heading. Escape and the scrim still close it. Exactly one exists: the **Export ready** face.                                                                                                                                                                                                                               | headerless modal, plain card, toast                  |
| **Header slot** (updated)    | One of a layout's optional places for a screen's own controls — `MainLayout`'s `headerStart` / `headerEnd`, and `GenreLayout`'s `heading` / `headerEnd`. Every screen's chrome is a layout; only what fills the slots is a feature.                                                                                                                                                                                                                                                | header prop, toolbar, actions                        |
| **Row section** (new)        | The chrome every shelf on the **Browse home** shares — a labelled `<section>`, a serif heading at a caller-chosen size, an optional leading icon, an optional trailing action, and the slot a **Card carousel** drops into. `RowSection` in code, and deliberately domain-blind: the **Favorites row** owns its heart’s accent color, not this.                                                                                                                                    | row shell, shelf, section header                     |
| **Chrome** (new)             | The furniture every full-screen route sits in — the page filling the viewport once, the fixed header strip, the one scrolling body. Shared as styles both layouts extend (`layouts/chrome.styles.ts`), never as one layout extending another.                                                                                                                                                                                                                                      | shell, frame, wrapper, container                     |
| **Chrome icon button** (new) | The face every icon button over the film wears — transparent, white ink, a faint white wash on hover. One `styled(IconButton)` in `PlayerControls.styles`, shared by the transport buttons and the volume slider's speaker. Not a widening of the `IconButton` primitive, whose refusal of an over-artwork variant stands: the app's other translucent call sites differ from each other by accident, and these two do not differ at all.                                          | ghost button, overlay button, transparent IconButton |

## The browse load

Vocabulary for the machinery both browse screens run on. These name one hook
apiece, and the policies those hooks hold — policies that were previously stated
twice, in two screens, with nothing holding them together.

| Term                              | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Aliases to avoid                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Browse load** (new)             | One browse screen's request for a **Settled query**, with its **Load state**, its payload and its retry. `useBrowseLoad` in code, at `features/library`'s shared rung. Moves up to `src/hooks/` the day a second feature wants it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | fetch hook, data hook, query hook       |
| **Skeleton latch** (new)          | The rule a **Browse load** holds: once a screen is loaded, a refetch keeps what is painted and only a load with nothing behind it falls back to the **Skeleton**. Flashing the grid every time the typing settles would be unreadable. Stated in exactly one place.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | loading flicker, stale-while-revalidate |
| **Optimistic save** (updated)     | The bargain an edit keeps with the server: show the new value at once, take the route's echo over what was assumed, put back what the edit cost if the save is refused. Written twice, for two shapes. `useOptimisticSave` reverts by negating a flag and addresses a **Movie** by id inside a list — the two browse screens' **Favorite** hearts, reaching every **Home section** the **Movie** has a card in. `useOptimisticEdit` is told what to put back rather than deriving it, and edits the one **Movie** a page is holding — all three of the **Movie detail page**'s writes, the watched tick, its own heart and the **Rating picker**. A **Rating** is why the second one exists: eleven values plus an absence, where `!value` can express none of it. | optimistic update, local write, cache   |
| **Single-signal write** (updated) | A route that moves exactly one field and echoes it back: **Favorite**'s, **Watched**'s and the **Rating picker**'s on a **Movie**, and since `15-settings-hub` Q14 the **Preferred subtitle language** on the household's **Settings** — one skeleton: look the row up, refuse before writing, dispatch to a dedicated mutator, echo `{ value }`. `writeSignal` in code for the movie ones, local to the route layer. What a valid body is stays per-route.                                                                                                                                                                                                                                                                                                        | flag route, toggle endpoint, patch      |
| **Wire echo** (new)               | What a **Single-signal write** answers with, and the value an **Optimistic save** reconciles against — the route saying what it actually stored, which beats what the screen assumed. `postValue` at `src/api/` holds the contract for all three saves; each caller says what counts as a usable echo, because for a **Rating** a `null` echo is a cleared **Rating** and for a flag it is nonsense. Only a _missing_ `value` key falls back to what was sent.                                                                                                                                                                                                                                                                                                     | response value, ack, confirmation       |
| **Load key** (new)                | The string that says which **Browse load** a request is — the **Settled query** for the **Browse home**, that plus the **Genre** for a **Genre page**. Change it and the screen reloads; leave it and no amount of re-rendering asks again.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | cache key, dependency, query id         |

## Search, filter & sort

| Term                      | Definition                                                                                                                                                                                                                                                                                                                | Aliases to avoid                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Library query**         | The **Search text** + **Genre filter** + **Minimum rating** + **Sort order** that together decide what the **Browse home** shows; lives in the URL, never in a component. `LibraryQuery` in code.                                                                                                                         | home query, filters, criteria, params, search |
| **Search text** (updated) | The free-text fragment of a **Library query** _or_ a **Genre query**, matched against a **Movie**'s title, **Synopsis**, or **Genre** names (`?q=`). Each route carries its own — the **Browse home**'s and a **Genre page**'s never share one.                                                                           | query, keyword, term, search string           |
| **Genre filter**          | The **Library query**'s restriction to a single **Genre**; `All Genres` is its unset state, not a value.                                                                                                                                                                                                                  | category filter, genre selection              |
| **Minimum rating**        | The **Library query**'s floor on **Rating** — 8 / 6 / 4 units, shown as `4+ stars` / `3+ stars` / `2+ stars`; **Unrated** **Movies** never pass one.                                                                                                                                                                      | rating filter, stars, score filter            |
| **Sort order** (updated)  | Which of `recently-added` \| `a-z` \| `year` \| `highest-rated` \| `unwatched-first` a **Library query** orders by. Part of the query, but not a filter. The five live once, as `MOVIE_SORTS` — the vocabulary the wire and the **Filter dropdown** share, not everything the repository can order by. See **List sort**. | ordering, sort by, sorting                    |
| **List sort** (new)       | What `listMovies` can order by — `ListSort`, one member wider than a **Sort order**, adding `last-watched`. Repository-only: no control names it, `parseLibraryQuery` cannot read it, and the route validates against `MOVIE_SORTS`, so it can never arrive from a URL.                                                   | internal sort, order by, sort key             |
| **Settled query**         | The **Library query** as recorded in the URL — what every reader acts on, after the **Search bar**'s 250ms debounce has stopped moving.                                                                                                                                                                                   | current filters, applied query                |
| **Search bar** (updated)  | A screen header's text control — the **Browse home**'s (`headerStart`, 460px) and the **Genre header**'s (250px, "Search in {genre}"). Always the only holder of un-**settled** input, via **Settled text**.                                                                                                              | search box, search field, omnibox             |
| **Filter dropdown**       | One pill-triggered **Menu** presenting the **Filter options** for one part of a **Library query**. The **Browse home** header has three: Genre, rating, Sort.                                                                                                                                                             | select, picker, combo box, dropdown           |
| **Filter option**         | One row of a **Filter dropdown** — label, optional count, and whether it is the current selection.                                                                                                                                                                                                                        | menu item, choice, entry                      |
| **Genre list**            | The **unfiltered** `{ total, genres }` payload from `GET /api/genres` backing the Genre **Filter dropdown**'s counts; fetched once, never per query.                                                                                                                                                                      | genre counts, facets, genre payload           |
| **No results**            | The **Load message** shown when a **Library query** matches nothing — a different situation from an empty library, with different copy.                                                                                                                                                                                   | empty state, no matches, zero state           |

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

## Playback delivery (new)

How a **Movie**'s video reaches the element. Backend vocabulary — `server/src/playback/`.

| Term                             | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Aliases to avoid                      |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Playback path** (new)          | Which of three routes a **Movie**'s video takes to the player — **Direct play**, **Remux** or **Transcode** — decided per request by the pure `choosePlaybackPath` from an **ffprobe** read.                                                                                                                                                                                                                                                                                                                                                                                                               | streaming mode, delivery, strategy    |
| **Direct play** (new)            | The **Playback path** that sends the file untouched (`sendFile` + HTTP Range) because Chromium already reads its container and codecs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | passthrough, native, raw              |
| **Remux** (new)                  | The **Playback path** where only the container is unreadable, so the **Playback component** rewraps the untouched streams into fragmented MP4 (`-c copy`).                                                                                                                                                                                                                                                                                                                                                                                                                                                 | repackage, convert, wrap              |
| **Transcode** (new)              | The **Playback path** where a codec is unreadable, so the **Playback component** re-encodes to H.264/AAC.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | convert, re-encode, compress          |
| **Stream offset** (new)          | The `?t=` seconds a **Remux** or **Transcode** stream is started at (`ffmpeg -ss`) — zero on a fresh open, the seek target after a scrub. Meaningless on **Direct play**, which seeks by byte range.                                                                                                                                                                                                                                                                                                                                                                                                       | seek param, start time, position      |
| **Absolute position** (new)      | Seconds into the **Movie itself** — what the **Scrubber**, the **Resume position** and every **Cue** time mean. On a stream path it is **Stream offset** + **Element time**.                                                                                                                                                                                                                                                                                                                                                                                                                               | currentTime, time, position           |
| **Element time** (new)           | `video.currentTime` — seconds into _what the element was handed_, which equals **Absolute position** only on **Direct play**.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | currentTime, playhead, position       |
| **Playback component** (updated) | The resolved FFmpeg pair that makes **Remux** and **Transcode** possible — the **Uploaded component** in the **Component slot**, then `FAMILYFLIX_FFMPEG_PATH`, then `PATH`, then **absent** (`16-component-upload` Q3). This is what the prototype's "codec pack" actually is. It is the app's **one pack**: every **Installed** row of the **Codec report** comes and goes with it, which is why no codec row has a size or a remove of its own (`15-settings-hub` Q7) and the **Component row** does. Replaced while the app runs by the **Playback component upload**.                                 | codec pack, codec, plugin, ffmpeg     |
| **Format support** (updated)     | What the app can do with a given container/codec: **native** (Chromium reads it), **via component** (the **Playback component** decodes it), or **unsupported**. Probed, never hand-listed. Reported by `capabilities(component)` — behind the component seam since `15-settings-hub` Q4, so the report describes the component the player actually uses — and drawn by the **Codec report**.                                                                                                                                                                                                              | codec status, compatibility, support  |
| **Playback read** (new)          | `GET /api/movies/:id/playback` → `{ path, durationSeconds }`, fetched once when the **Player** opens. The one place the **Scrubber**'s duration and the **Playback path** come from — the probe's answer, not the **Movie** record's `runtimeMinutes`.                                                                                                                                                                                                                                                                                                                                                     | metadata call, info, manifest         |
| **Unknown movie** (new)          | The one answer for an id no **Movie** has: `404 { error: "Unknown movie: <id>" }`, never Express's HTML page. Held in one place per side of the router — `movieOr404` for the reads, `writeSignal` for the writes — because the client tells "this film is gone" from "the request went wrong" by reading that body, and it is what makes the detail page's `not-found` state and the **Player**'s missing-file notice reachable.                                                                                                                                                                          | 404, not found, missing movie         |
| **No video file** (new)          | The one answer for a **Movie** whose row is there and whose file is not: `404 { error: "No video file for movie: <id>" }`. A stored path that escaped the managed media directory gets deliberately the same answer as a file that is simply absent — what is or is not on this disk is not something the API reports back. `noVideoFile` in the router, sent by both the resolver and `sendFile`'s failure callback.                                                                                                                                                                                      | missing file, 404, broken path        |
| **Failed conversion** (new)      | A **Remux** or **Transcode** that was begun and produced no bytes at all — a hardware encoder the build lists but the machine cannot run, a file FFmpeg gives up on, a **Playback component** deleted between the probe and the spawn. The stream route holds its headers until the first byte precisely so this can still be answered: `500 { error: "Could not start playback for movie: <id>" }`, which the element fails its load on and the `could-not-start` **Player notice** draws. Distinct from **cannot-play**, which is known _before_ any bytes and says the format cannot be decoded at all. | broken transcode, ffmpeg error, crash |

## The player screen (new)

| Term                       | Definition                                                                                                                                                                                         | Aliases to avoid                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Player** (new)           | The `/movie/:id/play` route — one self-contained screen owning its own **Chrome**, outside `MainLayout`, as the **Movie detail page** already is.                                                  | video page, watch screen, viewer |
| **Chrome** (new)           | The **Player**'s two overlaid bars — back pill + title above, **Scrubber** + transport below — which fade in and out together as one thing.                                                        | controls, overlay, HUD, toolbar  |
| **Idle** (new)             | The **Player** state 3s after the last mouse movement during playback: **Chrome** fades out and the cursor is hidden. Any movement ends it.                                                        | timeout, inactive, hidden, afk   |
| **Scrubber** (new)         | The **Player**'s seek bar — track, accent fill, knob — clickable _and_ draggable; it takes duration from the **Playback read**, never from the element, which is what makes seeking a stream work. | progress bar, timeline, seek bar |
| **Cue** (new)              | One timed subtitle line — `{ start, end, text }` in **Absolute position** seconds — the single normalized shape every subtitle format is parsed into.                                              | caption, line, subtitle, vtt cue |
| **Cue list** (new)         | The full ordered array of **Cues** for one **Subtitle**, fetched once when subtitles are switched on and held in memory for the session.                                                           | track, vtt, captions file        |
| **Subtitle track** (new)   | The one **Subtitle** currently rendering, chosen by `preferredSubtitle` from the default language then track order — never by the viewer, since no picker ships.                                   | selected sub, language, sub file |
| **Subtitle overlay** (new) | The styled box near the foot of the **Player** drawing the **Cue** that covers the **Absolute position**. Ours, not `::cue`.                                                                       | captions, CC box, subtitle bar   |
| **Player notice** (new)    | The message drawn in the big-play circle's geometry instead of the play glyph: **buffering** while a stream spins up, or **unavailable** (`missing-file` / `cannot-play` / `could-not-start`).     | error, spinner, loader, toast    |

## Watch reporting (new)

| Term                       | Definition                                                                                                                                                                                                                                                                             | Aliases to avoid                |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Watch reporter** (new)   | The one thing in the app that decides when a **Watch tick** happens — `useWatchReporter`. It is handed what is true of the film (position, playing, ended, duration) and hands nothing back but a way to report a settled seek; no component ever writes a **Resume position** itself. | tracker, saver, sync, autosave  |
| **Watch tick** (new)       | One write of the **Absolute position** through `POST /api/movies/:id/resume` — every 10s of playback, plus on pause, on seek-settle and on exit.                                                                                                                                       | ping, heartbeat, autosave, sync |
| **Tick threshold** (new)   | The ≥5s of movement below which a **Watch tick** is skipped, so a paused or nudged **Player** writes nothing and cannot reshuffle the **Continue Watching row**.                                                                                                                       | debounce, throttle, interval    |
| **Finish threshold** (new) | `ended`, or ≥95% of duration on exit — where a **Movie** becomes **Watched** without anyone marking it, so credits do not leave a film **In-progress** forever.                                                                                                                        | completion, end credits, done   |

## The Movie form (new)

The vocabulary of adding and editing a **Movie** by hand. It is the maintainer's
screen, not the family's — the only place in the app where a **Movie** is
written whole rather than one signal at a time.

| Term                          | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Aliases to avoid                           |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Maintainer** (new)          | The one person who fills the library — the author of this project, as distinct from the **Family** who only browse and watch. Every **Maintainer surface** (the **Movie form**, Settings, bulk import) is reached through the gear; nothing on the **Browse home** leads to one.                                                                                                                                                                                                               | admin, owner, user, editor                 |
| **Maintainer surface**        | The sheet every maintainer screen is drawn on — `MaintainerLayout`: a scroll container on the deeper background and a centred column at a measure. It stops at the column; the header row under it is each screen's own until the prototype is amended to one sheet. Not a "sheet": that word is about to mean a spreadsheet for a whole initiative.                                                                                                                                           | sheet, maintainer page, admin layout       |
| **Movie form** (new)          | The single screen at `/add` that writes a **Movie** whole — `MovieForm`, serving both an **Add context** and an **Edit context**. It is the only writer in the app that is not a **Single-signal write**.                                                                                                                                                                                                                                                                                      | add screen, editor, movie editor, wizard   |
| **Form context** (new)        | Which of its two jobs a **Movie form** is doing: **add** (blank, "Add a movie" / "Add to library", ends on the **Browse home**) or **edit** (pre-filled from `?movie=<id>`, "Edit details" / "Save changes", ends back on the **Movie detail page**). One screen, one URL, two contexts — there is no `/edit`.                                                                                                                                                                                 | mode, state, add/edit flag                 |
| **File slot** (new)           | One of a **Movie form**'s file positions — video, **Poster**, or one **Subtitle**. A slot is empty, holds a **Stored file**, or holds a **Picked file**; those three states are the whole of what a save has to reason about.                                                                                                                                                                                                                                                                  | field, upload, attachment                  |
| **Stored file** (new)         | A **File slot** already living in the **Movie folder**, carried by its **Stored path**. On save it travels as that path and no bytes move — which is what makes editing a title cost nothing.                                                                                                                                                                                                                                                                                                  | existing file, old file, saved file        |
| **Picked file** (new)         | A **File slot** chosen this session from the **Library root** through a native file picker — a browser `File`, so **a name and bytes but never a path**. On save its bytes are copied into the **Movie folder** and it becomes a **Stored file**.                                                                                                                                                                                                                                              | selected file, upload, local file, chosen  |
| **File picker**               | The atom that opens a file dialog — `FilePicker`: a dashed "＋ …" box that is the `<label>` of a hidden `<input type="file">`, reporting the **Picked file** and clearing itself after every pick so the same file can be chosen twice. The empty state of a **File field**, and the ＋ under the **Subtitle rows**; it never learns what the file is for.                                                                                                                                     | file input, dropzone, uploader, choose box |
| **File field** (new)          | The molecule drawing one **File slot** — `FileField`: a name beside a **File picker** when empty, a monospace filename row with a ✕ (`RemoveButton`) when filled. The picker owns the hidden input; the field puts a name beside it and draws the row that replaces it. It never learns what a **Movie** is.                                                                                                                                                                                   | file input, picker, dropzone, uploader     |
| **Subtitle row** (new)        | The molecule for one **Subtitle** **File slot** — `SubtitleRow`: filename, a language choice from the **Language pool**, and a remove (`RemoveButton`). It is drawn in the same row a filled **File field** is (`components/fileRow.styles.ts`), because a track _is_ a filled slot with a language on it. Its dropdown is a `Menu` wearing the prototype's own smaller face, so only one is ever open.                                                                                        | sub row, track row, caption row            |
| **Genre pool** (new)          | The 12 **Genre** names migration #1 seeds, in the prototype's order — the whole vocabulary a **Movie form** offers as chips, **including genres no Movie is tagged with yet**. Distinct from the **Genre list**, which is populated genres with counts and exists to draw a **Filter dropdown**.                                                                                                                                                                                               | genres, genre list, categories, all genres |
| **Language pool** (updated)   | The seven human languages a **Subtitle row** offers and the **Preferred subtitle language** is chosen from (English, Spanish, French, German, Portuguese, Italian, Dutch) — `SUBTITLE_LANGUAGES` in `src/types/settings.ts`, read by the form, `detectSubtitleLanguage` and the Settings hub alike since `15-settings-hub` Q12. A display vocabulary, not an entity: a **Subtitle**'s language is stored as the chosen text, and the pool is not a constraint on it. `English` is its default. | locales, languages, i18n, lang codes       |
| **Save gate** (new)           | The condition a **Movie form**'s Save is `disabled` until: a title, and a video **File slot** that is filled. It is a gate rather than a validation message because the prototype designs no error surface — the only "invalid" state the form can reach is one where Save cannot be pressed.                                                                                                                                                                                                  | validation, form errors, required fields   |
| **Managed copy** (new)        | The storage model that replaced **Reference in place**: on save, a **Picked file**'s bytes are copied into the **Movie folder** under the **Managed media directory**, and the app owns its copy from then on. It is not a preference — a browser file picker yields a name and bytes and never a path, so referencing a file where it lies is not a thing this form _can_ do. Duplication and copy time are the accepted cost.                                                                | import, upload, ingest, file copy          |
| **Derived runtime** (new)     | `runtimeMinutes`, read off the film after the **Managed copy** rather than typed — the probe's duration when there is a **Playback component** to ask, the container's own `moov`/`mvhd` when there is not, `null` when neither can say, rounded to the nearest minute. The **Movie form** has no runtime field, and this is why. Distinct from the **Playback read**'s `durationSeconds`, which answers a **Player** and is re-read every time one opens.                                     | duration, length, running time             |
| **Superseded file** (updated) | The **Stored file** a **File slot** held before an edit replaced it. It is unlinked after the row commits — one file at a time, matched by **Stored path** rather than by folder. An emptied slot or a detached **Subtitle** authorises no deletion: those are record changes, and the bytes stay. Was the only deletion of media in the app until **Delete** shipped; now one of two, both under **Best-effort cleanup**.                                                                     | old file, orphan, stale file, leftover     |

## Deleting a Movie (new)

The **Maintainer**'s other write on the **Movie detail page** — the one that is
not an edit. It is reached from the **Edit menu** alone, confirmed in a dialog,
and removes the record first and the bytes second.

| Term                          | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Aliases to avoid                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Delete** (new)              | Removing a **Movie** from the library: its row (and by cascade its **Genre** tags and **Subtitles**), then its **Movie folder** under the **Managed media directory**. `DELETE /api/movies/:id` → `204`. Never touches the **Library root**. The whole action, from the **Danger row** to the bytes; say **Remove** for taking a **File slot** off the **Movie form**.                                                                                                                                                                                                                        | remove, erase, drop, purge, trash, uninstall |
| **Delete dialog** (new)       | The **Modal** that confirms a **Delete** — `DeleteMovieDialog`: the title with the **Movie**'s name in it, "This can’t be undone.", one paragraph saying what goes and what stays, then **Delete movie** (`danger`) and **Cancel** (`secondary`). Opens with focus on the card and nothing pre-chosen. While the request runs the confirming button reads **Deleting…** and is disabled; dismissal stays live, and a dismissal does not cancel the request. A refused delete re-enables the button and changes nothing else — the prototype designs no error state here, so none is invented. | confirm box, are-you-sure, prompt, alert     |
| **Gone is gone** (new)        | The rule `deleteMovie` on the client keeps: a `204` and a `404` both mean done. The goal of a **Delete** is that the **Movie** is not in the library, and a `404` says exactly that — treating it as failure would leave a stale page whose only working button re-asks a question the server has already answered.                                                                                                                                                                                                                                                                           | idempotent delete, 404-as-success            |
| **Best-effort cleanup** (new) | The order every deletion of media in the app follows: the row commits, _then_ the bytes go, and a failure to remove them is swallowed. **Superseded file** and **Delete** both keep it. The library is the source of truth: a stranded folder is a cost nobody can reach, a ghost row is a film the **Family** can open and fail on.                                                                                                                                                                                                                                                          | transactional delete, two-phase, rollback    |
| **Stranded folder** (updated) | A **Movie folder** left under the **Managed media directory** after its row is gone — a locked file, most likely a video the stream route still had open when the **Delete** ran. It surfaces, silently, in the **Storage report**: **Space used** counts its bytes, the title count does not (`15-settings-hub` Q17). Nothing yet names it.                                                                                                                                                                                                                                                  | orphan folder, leak, leftover media          |

## Bulk import (new)

The one pass that fills the library from the family's spreadsheet and folder
tree — `13-bulk-import.md`. It is the only place in the app the server is
handed a folder to walk, which is why folder-path autofill lives here and
nowhere else.

| Term                         | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Aliases to avoid                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Bulk import** (new)        | Reading a **Sheet**, walking a **Library root**, matching each **Sheet row** to a **Source folder**, and copying every confident match into the library as a **Movie** — the whole of `/import`, from _Start import_ to _Finish_. Initiative `bulk-import`.                                                                                                                                                                                                                                                                           | import, ingest, migrate, the importer         |
| **Sheet** (new)              | The spreadsheet a **Bulk import** reads — `.xlsx` or `.csv`, first worksheet, first row the header — whose columns are found by name through a synonym table; only a title column is required.                                                                                                                                                                                                                                                                                                                                        | spreadsheet, Excel, the list, CSV             |
| **Sheet row** (new)          | One line of the **Sheet** as read: a title, and whatever else its recognised columns held (year, genres, director, cast, synopsis, rating, watched). A row with no title is skipped and logged, never a **Problem**.                                                                                                                                                                                                                                                                                                                  | record, entry, line                           |
| **Source folder** (new)      | One film's own directory under the **Library root** — found by the scan rule _a folder holding a video file is a Source folder; one holding none is descended_. Never written to. Distinct from the **Movie folder**, which is the app's copy of it.                                                                                                                                                                                                                                                                                  | movie folder (wrong), film folder, the folder |
| **Title key** (new)          | The normalised form of a title or a **Source folder** name that matching compares — lower-case, diacritics stripped, dots, underscores and hyphens to spaces, every trailing year or quality tag (`1080p`, `720p`, `2160p`, `4K`) dropped for as long as one is there, letters, digits and single spaces only — so `Die.Hard.1988.1080p` and "Die Hard" answer the same key. `titleKey`, pure, in `import-export/`.                                                                                                                   | slug, normalised title, fuzzy key             |
| **Match** (new)              | A **Sheet row** paired with exactly one **Source folder** whose **Title key** equals its own (and whose year agrees, when both carry one), that folder holding exactly one video — two folders is `ambiguous`, none is `no-folder`, and a folder with no video or more than one is `no-video`. Matches import during the **Importing** phase without a human looking; anything short of one is a **Problem**.                                                                                                                         | hit, confident match, auto-match              |
| **Current run** (new)        | The one **Bulk import** the server holds in memory at a time — `GET /api/import/current` — from _Start import_ until cancel or the next start. Its phases are **Scanning**, **Importing** and the **Review step**; a second start while one runs is `409`. A restart of the app forgets it; the **Movies** it added are real rows and stay.                                                                                                                                                                                           | session, job, import id                       |
| **Import phase** (new)       | Where the **Current run** is: **Scanning** (walking the **Library root**, matching, the bar indeterminate), **Importing** (copying each **Match**, the bar counting `done / total`), or the **Review step**. The stepper's _Connect ✓ → Scan → Import_ draws it.                                                                                                                                                                                                                                                                      | step, stage, state                            |
| **Activity log** (new)       | The **Current run**'s last 80 **Log lines**, drawn in the `LogConsole` molecule pinned to its bottom; a snapshot travels with every poll of `current`.                                                                                                                                                                                                                                                                                                                                                                                | console, output, terminal                     |
| **Log line** (new)           | One entry of the **Activity log** — text and a kind (`info`, `scan`, `path`, `success`, `warning`, `error`) that sets its colour. A **Warning line** is the `warning` kind: a missing subtitle or poster, an unknown genre name — noted, never a **Problem**.                                                                                                                                                                                                                                                                         | message, event                                |
| **Problem** (new)            | A row or folder the **Current run** could not settle on its own, listed in the **Review step** with a kind, a title and a reason. **Hard** when the film is not in the library yet (`no-folder`, `ambiguous`, `no-video`, `no-row`, `failed`); **soft** when it is but wants a look (`missing-meta`, no genre).                                                                                                                                                                                                                       | issue, error, conflict, flagged row           |
| **Resolve** (new)            | Opening a **Problem** on the **Movie form** in **Import context** — `/add?problem=<id>`, or `/add?movie=<id>&problem=<pid>` for a soft one — prefilled from the **Sheet row** and the **Source folder**'s **Found files**; _Save & continue_ imports it and closes the **Problem**.                                                                                                                                                                                                                                                   | fix, handle, edit the row                     |
| **Dismiss** (new)            | Closing a **Problem** without importing anything — `DELETE /api/import/current/problems/:id`. The **Review step**'s _Skip_ and the form's _Skip this one_ both do exactly this, and so does the save after a soft **Resolve**.                                                                                                                                                                                                                                                                                                        | skip (as a verb in code), ignore, drop        |
| **Import context** (new)     | The **Movie form** opened by **Resolve**: the accent banner "Resolving import · {title}", the fields prefilled, the labels _Save & continue_ / _Skip this one_, and a save that posts to the **Current run** rather than `/api/movies`. The third of the form's contexts beside add and **Edit context**.                                                                                                                                                                                                                             | import mode, resolve mode                     |
| **Found file** (new)         | A **File slot** filled from a **Source folder** during **Resolve** — `{ kind: 'found'; path; filename }`, an absolute path under the **Library root**. On save it travels as that path and the server copies it **only from under the Current run's root**; beside **Stored file** and **Picked file**, the third and last kind.                                                                                                                                                                                                      | scanned file, matched file, source file       |
| **Copy-in** (new)            | `Media.copyIn(folder, sourcePath, signal)`: a **Found file**'s bytes copied from the **Library root** into a **Movie folder**, answering its **Stored path**. A read stream piped under the run's cancel signal rather than the `fs.copyFile` the session first asked for, because a 12 GB copy has to be stoppable partway with no half-file left for the folder's rollback to miss. The **Bulk import** counterpart of the form's `storeUpload`; **Managed copy** with a path for a source instead of a request part. Never a move. | move, link, ingest, transfer                  |
| **Already in library** (new) | A **Sheet row** whose **Title key** and year match a **Movie** the library already holds — skipped with an `info` **Log line**, neither a **Match** nor a **Problem**. What makes cancelling and re-running a **Bulk import** harmless.                                                                                                                                                                                                                                                                                               | duplicate, dupe, conflict                     |
| **Enrichment** (new)         | The name reserved for a future pass that would fill synopsis, cast, director, a **Backdrop** or a rating seed over an already-imported library from an outside source such as **TMDB**. Not designed, not in the prototype, not part of **Bulk import**.                                                                                                                                                                                                                                                                              | TMDB import, metadata fetch, lookup           |

## Export (new)

The library written back out as one spreadsheet — `14-export.md`. The mirror of
**Bulk import**: what the **Sheet reader** takes in, the **Sheet writer** puts
out, and an exported sheet re-imports.

| Term                       | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Aliases to avoid                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| **Export** (new)           | Writing every **Movie** in the library out as one **Export file** in an **Export format**, A–Z by title — `GET /api/export/:format`, built on the server, saved by the browser. The `⬇ Export to CSV` row of the **Library section** is its one door.                                                                                                                                                                                                                                                       | backup, dump, download library, sync      |
| **Export dialog** (new)    | `feat.ExportModal` → `features/import-export/ExportModal`: the **Modal** the row opens, with two faces — the idle face (the **Format cards**, the filename row with the **Export summary**'s count, the **Export columns** as pills, _Export as CSV / Excel_ and _Cancel_) and **Export ready**. Owns `useExport`; opened and closed by the **Library section**. Closed while a file request is in flight, it drops the redraw and not the file: **Export ready** is never shown, the download still lands. | export modal, export screen, export page  |
| **Export format** (new)    | `csv` or `xlsx` — `EXPORT_FORMATS` in `src/types/export.ts`. Chosen on a **Format card**; `csv` on every open. The row's own label says CSV and means the dialog.                                                                                                                                                                                                                                                                                                                                           | file type, extension, Excel mode          |
| **Format card** (new)      | One selectable **Export format** in the **Export dialog** — a label, a line under it and an 18px radio dot, on the accent-soft fill when selected. `features/import-export/FormatCard`, a `role="radio"` in a group labelled _Format_.                                                                                                                                                                                                                                                                      | format chip, segmented control, toggle    |
| **Export columns** (new)   | The eight columns every **Export file** carries, in order — Title, Year, Genres, Director, Cast, Rating, Status, Subtitles — `EXPORT_COLUMNS`, drawn as the dialog's pills and written by the **Sheet writer**. Genres, Cast and Subtitles are joined with `, `; Rating is the stored 0–10; Status is `Watched`, `In progress` or `Unwatched`. No synopsis, no paths.                                                                                                                                       | fields, headers, column picker            |
| **Export file** (new)      | `family-library.csv` or `family-library.xlsx` — `EXPORT_FILENAME[format]` — named once for the route's `Content-Disposition`, the dialog's filename row and the **Export ready** copy alike. A UTF-8 BOM on the CSV so Excel reads diacritics. Fetched by `fetchExportFile(format)` in the feature's `api/` — a reading call, so a `fetch*` like every other; the hook's action that presses it is `exportLibrary`, the button's verb.                                                                      | the download, the CSV, output             |
| **Export summary** (new)   | `GET /api/export` → `{ movieCount }`: the **Export** described before it is written — the `N movies` label beside the filename, off `countMovies()`. `null` on the client until it lands, and blank on screen if it never does.                                                                                                                                                                                                                                                                             | row count, library size, preview          |
| **Sheet writer** (new)     | `writeSheet(movies, format)` → the bytes of one **Export file** — `server/src/import-export/writeSheet/`, pure over the list, the **Sheet reader**'s mirror. The eight cell rules live inside it, spelled once.                                                                                                                                                                                                                                                                                             | exporter, serializer, CSV builder         |
| **Sheet reader** (new)     | `readSheet(bytes, filename, onBlankTitle)` → **Sheet rows** — the name the glossary owed `server/src/import-export/readSheet/` since log 13; the third parameter is what a row with no title is reported through. Now also reads a `Status` column as its watched column, so an **Export file** round-trips.                                                                                                                                                                                                | parser, importer, sheet loader            |
| **Save to computer** (new) | `saveToComputer(blob, filename)` — the fetched bytes handed to the browser as an anchor download, into the Downloads folder or, under Electron, the shell's save dialog. A DOM side effect in `features/import-export/saveToComputer/`, deliberately not `utils/`. Runs whether or not the **Export dialog** is still open when the bytes arrive — a download the browser has been handed cannot be recalled from a page, and the maintainer asked for it.                                                  | download helper, file save, write to disk |
| **Export ready** (new)     | The **Export dialog**'s done face — a **Bare modal**: the tick in the watched-tinted circle, _Export ready_, "Saved `family-library.csv` with N movies to your computer.", _Done_. When the **Export summary** never landed the clause goes rather than a hole staying: "Saved `family-library.csv` to your computer." Reached only after **Save to computer** ran; a refused request leaves the idle face as it was.                                                                                       | success state, confirmation, done modal   |

## The Settings hub (new)

The **Maintainer**'s hub at `/settings` — `15-settings-hub.md`. Four groups
on one **Maintainer surface**; each group a heading over rows or a card, each
row a fact the app can answer truthfully, and no control drawn whose mechanism
does not exist yet.

| Term                                    | Definition                                                                                                                                                                                                                                                                                                                                                                                                | Aliases to avoid                             |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Settings hub** (new)                  | `page.SettingsPage` → `pages/SettingsPage`: the header, then the **Library**, **Playback**, **Storage** and **About** groups in that order, on `MaintainerLayout` at 780px. The one door to every other maintainer screen.                                                                                                                                                                                | settings page, preferences, admin, config    |
| **Settings group** (new)                | One uppercase **Group heading** and what sits under it — the **Library section**'s rows, or a **Section card** for Playback, Storage and About. `features/settings/<Name>Section/`, furniture in `features/settings/section.styles.ts`.                                                                                                                                                                   | panel, block, category                       |
| **Section card** (new)                  | The surface card a **Settings group** draws its rows in — `Card` in `section.styles.ts`, with `Divider`, `ItemTitle` and `ItemDesc` for the rows inside it. The Library group has none: its rows are **Action rows**.                                                                                                                                                                                     | box, panel, tile                             |
| **Codec report** (updated)              | `feat.CodecManager` → `features/settings/CodecManager`: the **Codec summary** over one **Codec row** per `CodecRowModel`, then the **Component row**, then the **Component drop zone** — read from `GET /api/playback/capabilities` and redrawn from what the two component writes echo. Since `16-component-upload` it installs and removes the one thing it truthfully can: the **Playback component**. | codec manager, codec list, formats panel     |
| **Codec row** (updated)                 | One row of the prototype's row template — the microchip tile, a name, mono chips, the size cell, a **Status pill**, and a ✕ or the 32px spacer — `features/settings/CodecRow` over a `CodecRowModel`, drawn 1:1 since `16-component-upload` Q10. A codec's row has `—` for a size and the spacer; the **Component row** is the same molecule with both filled.                                            | codec item, format line                      |
| **Format catalogue** (new)              | The codecs a family folder is made of — `h264`, `hevc`, `vp9`, `av1`, `mpeg4`, `ac3`, `dts`, `aac` … — each with the prototype's display name and its **Container chips**, in the order the report draws them. Display vocabulary in `features/settings/codecView/`; a decoder the catalogue does not name is not a row, and a catalogued codec nothing decodes is not one either.                        | codec table, known codecs, whitelist         |
| **Container chips** (new)               | The small mono pills on a **Codec row** — `.mkv`, `.mp4` — naming the containers that format usually arrives in. Display only: nothing decides a **Playback path** from them.                                                                                                                                                                                                                             | extensions, ext chips, file types            |
| **Status pill** (updated)               | Four words in the prototype's two colourings: **Built-in** (`native`) and **Default** in the faint one; **Installed** (`via-component`) and **Uploaded** in the watched green. The first pair says how a codec is decoded, the second where the **Playback component** came from.                                                                                                                         | badge, tag, support label                    |
| **Codec summary** (new)                 | The line above the rows: `N formats enabled · M from the playback component`, or `… · no playback component` — `codecSummary` in `codecView`. A copy amendment of the prototype's "added by you", which is false of a bundled build.                                                                                                                                                                      | summary label, count line                    |
| **Settings** (new)                      | The household's preferences — `GET /api/settings` → `{ subtitleLanguage }`, defaults applied on the server. One row per key in the `settings` table (migration 3), behind `Storage.settings()` in `library/`: the one SQLite door, and a preference about the library's own subtitles is the library's. Never `localStorage`, which is a device's and is not backed up.                                   | preferences, config, options, prefs          |
| **Preferred subtitle language** (new)   | The one **Setting** today: which **Subtitle** becomes the **Subtitle track** when CC is pressed. Chosen from the **Language pool** in the Playback group's _Preferred language_ dropdown, written by `POST /api/settings/subtitle-language { value }` (a **Single-signal write**), read by the player and handed to `preferredSubtitle` — the slot log 10 Q8 left. `English` until set.                   | default language, sub lang, language setting |
| **Auto-on toggle** (new)                | The _Turn on automatically_ **Toggle**, drawn `disabled` beside the **Coming soon pill** and storing nothing: auto-on subtitles are 🧭 roadmap (log 10 Q7), and this is the disabled switch that decision named.                                                                                                                                                                                          | subtitles switch, auto subtitles             |
| **Coming soon pill** (new)              | The small uppercase pill beside a row whose control is drawn but not yet live — the **Auto-on toggle**'s. The prototype's own affordance for "designed, not shipped"; the only one this hub has, which is why controls without it are not drawn rather than disabled.                                                                                                                                     | beta tag, disabled label, soon badge         |
| **Toggle** (new)                        | `prim.Toggle` → `primitives/Toggle`: the switch atom — `role="switch"`, `aria-checked`, `aria-disabled`, a 46×26 track and a sliding knob, named by its `label`. Reusable for any on/off **Setting**.                                                                                                                                                                                                     | switch, checkbox, slider                     |
| **Storage report** (new)                | `GET /api/storage` → `{ mediaPath, bytesUsed, movieCount }`: the **Managed media directory** described — its absolute path, **Space used**, and the title count off `countMovies()`. Drawn by `features/settings/StorageSection`.                                                                                                                                                                         | disk usage, storage info, stats              |
| **Space used** (new)                    | The bytes of every file under the **Managed media directory** — `spaceUsed(root)` in `server/src/media/spaceUsed/`, a walk that answers `0` for a root not there yet and never throws — written by `formatBytes` (1024-based, one decimal: `18.4 GB`). Counts a **Stranded folder**; the title count does not.                                                                                            | disk space, size on disk, usage              |
| **App version** (new)                   | `__APP_VERSION__`, `package.json`'s version baked in at build by Vite's `define`, in mono on the About card. `0.0.0` until the packaging initiative sets one — the card says what the build is, not what it will be.                                                                                                                                                                                      | build number, release, semver                |
| **Playback component upload** (updated) | The `component-upload` initiative (`16-component-upload`): the prototype's dashed _Add a codec pack_ zone wired to the **Component slot** — two **Component binaries** in one drop, a **Verified component**, a **Component swap** under the running server, and the **Component row** carrying the size and the remove the codec rows never had.                                                         | codec pack upload, add codec, ffmpeg upload  |

## The Playback component upload (new)

The `component-upload` initiative — `16-component-upload.md`. The one thing on
the **Codec report** that can truthfully be added or removed is the
**Playback component** itself, and this is the vocabulary of adding and
removing it: a slot it lives in, the two files it is made of, a swap that
cannot half-happen, and one row that says which one is live.

| Term                          | Definition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Aliases to avoid                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Component slot** (new)      | The writable directory an **Uploaded component** lives in — `FAMILYFLIX_COMPONENT_PATH`, default `./playback-component`, Electron's `userData/playback-component` — and the object over it: `createComponentSlot(slotDir, env, seams)` in `server/src/playback/componentSlot/` — the third argument carrying `verify` and `rename`, both injected so a machine with no FFmpeg and no Windows lock can still assert the swap — answering `current()`, `info()`, `receive()` and `remove()`. Resolved ahead of the installer's slot and `PATH`. | ffmpeg folder, plugin dir, component path     |
| **Uploaded component** (new)  | The pair at `<slot>/current/`, put there by the maintainer through the zone. The only component a remove can take out; the **Status pill** says **Uploaded** for it.                                                                                                                                                                                                                                                                                                                                                                          | custom ffmpeg, user component, installed pack |
| **Default component** (new)   | The component `ffmpegBinary(env)` resolves when nothing is uploaded — the installer's build on the family's machine, `PATH`'s on a dev one. What a remove falls back to; not removable, because it is not the maintainer's. The pill says **Default**.                                                                                                                                                                                                                                                                                        | bundled, built-in component, system ffmpeg    |
| **Component binary** (new)    | One of the two files a **Playback component** is made of — `ffmpeg` or `ffprobe` — told apart by filename alone: `componentBinary(filename)` in `server/src/playback/componentBinary/` answers `'ffmpeg'`, `'ffprobe'` or `null`: the binary's own word, lowercased, optionally followed by a `-` and whatever the build called itself, optionally under a `.exe` — so a build downloaded as `ffmpeg-7.1.exe` resolves, and `myffmpeg.exe` and `ffmpeg.dll` are halves of nothing. Stored under the platform's own name, never the client's.  | executable, exe, the ffmpeg file              |
| **Incoming component** (new)  | An upload begun and not yet live: `slot.receive()` empties `<slot>/incoming/`, `take(binary, bytes)` pipes each part to its name, and `install()` either becomes the **Component swap** or refuses — `incomplete`, `not-a-component`, `in-use`, and `failed` for a swap stopped by neither the lock nor the pair — and discards the folder.                                                                                                                                                                                                   | pending upload, staging, temp component       |
| **Verified component** (new)  | An incoming pair that `verifyComponent(pair)` has run: `ffmpeg -version` and `ffprobe -version` both exit `0` and open with `ffmpeg version` / `ffprobe version`. The only test the slot applies before a swap; the same trust `FAMILYFLIX_FFMPEG_PATH` already extends.                                                                                                                                                                                                                                                                      | validated, checked, sanity-checked            |
| **Component swap** (new)      | How a **Verified component** goes live: `current/` renamed to `previous/`, `incoming/` renamed to `current/`, `previous/` removed, `current()` recomposed. A directory rename, never a file overwrite, so a Windows lock on a running `ffmpeg.exe` fails the first rename with nothing moved — the **In-use refusal**.                                                                                                                                                                                                                        | overwrite, replace in place, hot swap         |
| **In-use refusal** (new)      | The `409` both component routes answer when the live pair is locked by a conversion in flight — _The playback component is in use. Stop the film that's playing and try again._ A refusal, never a kill: the family's film is not stopped by the maintainer's drop.                                                                                                                                                                                                                                                                           | locked, busy, EBUSY                           |
| **Component info** (new)      | `PlaybackComponentInfo { source, bytes, files }` — `PlaybackCapabilities.component` since this initiative, `null` for a machine with none: where the live component came from (`'default'` / `'uploaded'`), its two files' bytes summed, their basenames. What the **Component row** draws.                                                                                                                                                                                                                                                   | component metadata, component flag            |
| **Component row** (new)       | The prototype's row template drawn once more, last among the rows, for the one thing that has a size and a remove: the microchip tile, _Playback component_, the two basenames as chips, the bytes through `formatBytes`, **Default** or **Uploaded**, and `RemoveButton` on an uploaded one or the spacer on a default one. `componentRow(report)` in `codecView`; absent when the component is.                                                                                                                                             | ffmpeg row, component line, pack row          |
| **Component drop zone** (new) | `ComponentDropZone` in `features/settings/`: the dashed _Add a codec pack_ zone — a `<label>` over a visually hidden `<input type="file" multiple>`, taking a drop or a pick of the two **Component binaries**, drag-over drawn as the prototype's hover. Three faces: **idle**, **busy**, **refused**.                                                                                                                                                                                                                                       | uploader, file drop, codec pack zone          |
| **Upload state** (new)        | `UploadState` on `useCapabilities`: `idle`, `busy` (with `install` or `remove` as its action), or `refused` with the reason the route gave — the server's `error` on `400` / `409` / `422`, a fixed line otherwise. Replaced and removed are not states: the report the route echoes is the feedback.                                                                                                                                                                                                                                         | upload status, progress, error state          |
| **Refused face** (new)        | The zone's third face: the title as drawn and the line in the danger ink carrying the reason — the **Setup step**'s danger line in the zone's own geometry, a prototype amendment. It stays until the next attempt. Silence on a refusal was rejected: a `.dll` dropped by a parent following the old copy must not do nothing.                                                                                                                                                                                                               | error message, validation error, toast        |

## Software update (new)

The `software-update` initiative — `17-software-update.md`. The row the About
card has never drawn, the notifications it pushes, and the feed behind both. The
vocabulary separates three things the word "update" runs together: the
**Release** that exists on GitHub, the **Update offer** that has already been
downloaded onto this machine, and the **Install** that replaces the running
app.

| Term                       | Definition                                                                                                                                                                                                                                                                                             | Aliases to avoid                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| **Software update** (new)  | The About card's first row — the state of this machine's copy of FamilyFlix against the **Release feed**, in four faces: offered, installing, checking, idle. `SoftwareUpdateRow` in `features/software-update/`, mounted by `AboutSection`; absent entirely when there is no **Update bridge**.       | upgrade, patch, version check        |
| **Update offer** (new)     | A **Release** newer than the **App version** that has **already been downloaded** to this machine and is waiting to be installed. The only kind of update any surface announces — auto-download is on, so "available" never means "found but not fetched".                                             | available update, pending update     |
| **Offered version** (new)  | The version string of an **Update offer**, from the updater's own event. Drawn in the row's accent line and the offer snackbar, and never interchanged with the **App version**.                                                                                                                       | new version, latest version          |
| **App version** (updated)  | `__APP_VERSION__`, `package.json`'s version baked in at build by Vite's `define`, in mono on the About card. `0.0.0` until the packaging initiative sets one. What is **running** — the **Offered version** is what is waiting.                                                                        | build number, release, semver        |
| **Update check** (new)     | One ask of the **Release feed**, answering `none` / `found` / `refused` / `unavailable`. Runs once per launch, silently, and again whenever **Check for updates** is pressed — a pressed check always gets an answer, a launch check never speaks.                                                     | poll, sync, refresh                  |
| **Last checked** (new)     | `lastCheckedAt` — an ISO stamp advanced only by an **Update check** that got an answer, so the row's _Last checked just now_ can never mean _last tried_. `null`, and the label absent, until one does.                                                                                                | last sync, last poll                 |
| **Update bridge** (new)    | `window.familyflix.updates` — `current()`, `onOffered()`, `check()`, `install()`: the only way the renderer reaches the updater, read in one unit (`updateBridge/`). `null` in a browser, which is a state and not an error. The shell owns the global; this initiative owns the member.               | IPC, preload API, electron api       |
| **Release feed** (new)     | The GitHub Releases of `carlos-rezai/FamilyFlix`, published by a tag-triggered workflow and read by `electron-updater`. Public, so nothing authenticates; the only network FamilyFlix ever makes, and failing to reach it is silence.                                                                  | update server, CDN, channel          |
| **Seen version** (new)     | The **App version** this machine last ran, kept in `localStorage` (`seenVersion/`) so the launch after an install can say _FamilyFlix updated to 1.1.0._ once. Absent on a fresh install, where there is nothing to have changed from.                                                                 | previous version, last version       |
| **Snackbar** (new)         | The transient bottom-right notice — `components/Snackbar/`, one variant, an optional title, a message, an optional action, a ✕. Presentational: it owns none of its own timing. The app's one channel for something that happened away from where the family is looking.                               | toast, notification, alert, banner   |
| **Snackbar variant** (new) | Which of `info` / `success` / `warning` / `error` a **Snackbar** is, drawn as its bar, glyph and action colour off the matching status token — and as its role: `status` for the first two, `alert` for the last two.                                                                                  | severity, level, type                |
| **Snackbar stack** (new)   | The fixed bottom-right column the **Snackbars** queue in, newest nearest the corner — `App/SnackbarProvider/`, which owns the queue and the one timing rule: a **Snackbar** with an action persists until actioned or dismissed, one without dies at 5s. Pushed through `App/useSnackbar/`'s `notify`. | toast host, snackbar queue, notifier |
| **Update offer snackbar**  | The one actionable **Snackbar** the app pushes: _Update available · FamilyFlix 1.1.0 is ready to install._ with **Update now**, once per launch, anywhere in the app. It reaches the family, which is safe because installing at quit is what would have happened anyway.                              | update banner, update prompt         |

## Relationships

- A **Movie** has zero-or-more **Genres** (ordered; `genres[0]` is the primary tag) and zero-or-more **Subtitles**.
- The **Browse home** shows the **Continue Watching row**, then the **Favorites row**, then one **Genre row** per **Genre** with ≥1 **Movie**; each row contains one **Card carousel** capped at 15 cards.
- A **Card carousel** holds **Poster cards** or **Continue cards**, never both — decided by its **Carousel variant**.
- A **Poster card** renders one **Movie** via its **Card view model**; it shows the **Poster** when present, else the **Gradient fallback**.
- A **Continue card** renders one **In-progress** **Movie** via its **Continue view model**; it always draws the **Gradient fallback** (it has no image slot) and opens the **Movie detail page**, not the player.
- A **Genre row**'s **View all** count is the **Genre**'s full **Movie** total (`listGenres()`), independent of the 15 cards shown; the **Continue Watching row** has no **View all**.
- A **Movie** has exactly one video **Stored path**, and at most one **Poster** and one **Backdrop** — all three under its own **Movie folder** in the **Managed media directory**. (**Retracted**: they used to be **referenced in place** under the **Library root**.)
- A **Movie**'s **Status** is derived from **Watched** + **Resume position** — never stored.
- A **Resume label** is derived from **Resume position** + runtime; it is built in the mapper, never inside the **Continue card**.
- A **Rating** belongs to exactly one **Movie**; it is **Unrated** until someone sets it from a **Rating picker** — on the **Movie detail page** or in the **Movie form** — or until **TMDB** seeds it during bulk import.
- A **Rating picker** in the **Movie form** is the same control with a different destination: on the detail page it is a **Single-signal write**, in the form it is one field of the whole-record save. Same percent, same **Half-star segments**, same **Rating preview**.
- A **Rating picker** writes exactly one **Movie**'s **Rating**, through `POST /api/movies/:id/rating` → `setRating` — a **Single-signal write** beside **Favorite**'s and **Watched**'s, never through `updateMovie`.
- A **Half-star segment** is the unit a **Rating picker** sets in; ten of them cover the 0–10 scale, so the picker can express every **Rating** except a literal `0` — clicking the current value's segment means **Unrated**, not nought.
- The out-of-five number beside either star strip is derived from the fill percent, never stored and never computed twice: `toStarLabel` rounds to the nearest **Half-star segment** and prints one decimal, so `StarRating` reading `4.0` and a **Rating picker** reading `4.0 / 5` can never disagree about the same **Movie**.
- A **Rating preview** belongs to one **Rating picker** and never leaves it; nothing outside the component ever sees an uncommitted **Rating**.
- One **Movie** maps to exactly one **TMDB** entry (`tmdb_id`); in v1 one **Movie** = one video file (no **Editions**).
- The **Movie detail page** renders exactly one **Movie** via its **Detail view model**; every display decision (which **Meta segments** survive, the **Runtime label**'s wording, the **Play label**, whether there is a **Credits row**) is made in `detailView()`, never in the component.
- A **Meta segment** that is absent takes its separator with it — the **Meta line** never renders a dangling `·`.
- **Unrated** renders as five empty **Rating picker** stars labelled `Not rated` on the **Movie detail page** (**retracted**: it used to be an absent **Meta segment**), and as five empty stars with no numeric value on a **Poster card**. Neither surface prints `0.0` for it.
- A **Library query** produces exactly one **Home payload**; all three **Home sections** are built from it, so they **narrow** together. They do not all **order** together: the **Continue Watching row** pins `last-watched` and the other two follow the query's **Sort order**.
- **Last watched at** belongs to exactly one **Movie** and is stamped only by watching it — `setResumePosition` or `markWatched`. It is why the **Continue Watching row** can be ordered by when the family last watched something rather than by when the **Movie** was added, and it is deliberately not `updated_at`: rating or favoriting a **Movie** must not move it up the resume queue.
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
- One **Movie** takes exactly one **Playback path** per request, decided fresh from **ffprobe** rather than stored — the same film can **Direct play** today and **Transcode** tomorrow if the **Playback component** is replaced.
- **Direct play** needs no **Playback component** at all; **Remux** and **Transcode** cannot happen without one, which is why the installer bundles it rather than waiting for the maintainer to supply it. An **absent** component is therefore a reduced app, not a broken one: MP4s still play, and everything else is a **Player notice**.
- A **Stream offset** exists only on **Remux** and **Transcode**. **Absolute position** = **Stream offset** + **Element time** on those; on **Direct play** the two are the same number and the offset is always 0.
- The **Scrubber** reads duration from the **Playback read** and position from **Absolute position** — never from `video.duration` or **Element time**, either of which is a lie on a stream path.
- A **Playback read** is per-open, not per-seek: it is what a **Stream offset** is measured against, so re-fetching it after a scrub would re-anchor the **Scrubber** to the stream instead of to the **Movie**.
- A **Subtitle** is a file on disk; a **Cue list** is what the server parses it into; a **Cue** is one line of that list. Nothing downstream of `parseSubtitle` knows whether the file was `.srt`, `.ass`, `.sub` or `.vtt`.
- One **Movie** has zero-or-more **Subtitles**, of which at most one is the **Subtitle track** at a time, and it renders through exactly one **Subtitle overlay**.
- **Format support** is derived — Chromium's native set ∪ what the **Playback component** reports — never a hand-maintained list, which is what makes the CodecManager rows true rather than decorative.
- Exactly one **Watch reporter** runs per open **Player**, and every **Watch tick** and every crossing of the **Finish threshold** comes from it — the **Scrubber**, the ±10s buttons and the keyboard all report through the **Player** rather than writing anything themselves, which is what keeps "opening a film writes nothing" a single rule rather than one per control.
- A **Watch tick** writes the **Resume position** and therefore stamps **Last watched at**; the first tick is the earliest moment opening the **Player** can affect the **Continue Watching row**.
- Crossing the **Finish threshold** dispatches to `markWatched`, which clears the **Resume position** — so a finished **Movie** leaves the **Continue Watching row** by the same rule a manually-ticked one does.
- **Chrome** and **Idle** are one state, not two: **Idle** _is_ **Chrome** hidden, and any mouse movement ends both.
- One **Movie form** save writes exactly one **Movie**, whole — every field and every **File slot** in one request. It is the only write in the app that is not a **Single-signal write**, and the only one that moves bytes.
- A **Picked file** becomes a **Stored file** exactly once: on save, when its bytes land in the **Movie folder** and its **Stored path** is written to the **Movie**. A save that fails leaves neither — the files that request wrote are removed.
- A **Movie folder** is named once, from the title and year at creation, and is reused by every later edit — so a renamed **Movie** keeps its folder, and the **Managed media directory**'s names can drift from the library's.
- The **Genre pool** is what the **Movie form** offers; the **Genre list** is what the **Filter dropdown** offers. A **Genre** appears in the pool from the moment migration #1 seeds it and in the list only once a **Movie** is tagged with it.
- A **Movie form** in an **Edit context** and the **Movie detail page**'s **Rating picker**, heart and **Watched** toggle can write the same **Movie**; the form's save goes through `updateMovie`, the three controls through their own mutators, and `updateMovie` deliberately applies none of their side-effect conventions.
- A **Delete** removes exactly one **Movie**: the row first (its **Genre** tags and **Subtitles** by cascade), then its **Movie folder** under **Best-effort cleanup**. It is opened only from the **Danger row** of the **Edit menu**, confirmed only in the **Delete dialog**, and lands the **Maintainer** one step back in history.
- The **Delete dialog** is a **Modal**; the **Edit menu** owns whether it is open. **Menu** and **Modal** are the app’s two dismissal contracts, and neither leaks: the menu has closed and returned focus to ⋯ before the dialog takes it.
- A **Library root** is never written by a **Delete**, an edit, or anything else — only the **Managed media directory** is ours to remove from.

- A **Bulk import** reads exactly one **Sheet** and walks exactly one **Library root**; the server holds at most one **Current run**, and _Start import_ while one runs is refused.
- A **Sheet row** ends as exactly one of: a **Match** (imported during **Importing**), **Already in library** (skipped), skipped for having no title, or a **Problem**. A **Source folder** no row claimed is a **Problem** too (`no-row`).
- A **Match** becomes a **Movie** by the **Movie form**'s own sequence — reserve a **Movie folder**, **Copy-in** each file, **Derived runtime**, `addMovie` — and a throw partway rolls the folder back and files a `failed` **Problem**.
- A **Problem** leaves the **Review step** exactly once: by **Resolve** (a hard one imports; a soft one is edited) or by **Dismiss**. _Skip_ and _Skip this one_ are both **Dismiss**.
- A **Found file** exists only inside **Import context** and only under the **Current run**'s **Library root**; the resolve route refuses any path outside it, the way `mediaFilePath` refuses any **Stored path** outside the **Managed media directory**.
- A **Source folder** is read and copied from, never written to or removed; a **Movie folder** is written to and removed, never read from as a source. The two never share a path.
- **Bulk import** commits a **Match** the moment its copy finishes; the **Review step** never holds a confident match back — it lists **Problems** only.

- An **Export** writes every **Movie** and only what the **Export columns** name; the **Sheet writer** and the **Sheet reader** are mirrors, so an **Export file** read back by **Bulk import** yields one **Sheet row** per **Movie** — and every one of them is **Already in library**, so a re-import of an untouched export adds nothing.
- The **Export dialog** is a **Modal** opened by the **Library section**, the way the **Delete dialog** is one opened by the **Edit menu**; the section holds whether it is open, the dialog holds everything else. It is the one place a feature composes another feature's organism — never its hook, never its wire.
- An **Export** has no run and no cancel: one request, one **Export file**, and **Export ready** only once **Save to computer** has handed the bytes over. There is no **Current run** to re-attach to.
- The **Export summary** and the **Export file** are two reads of one library at two moments; the count on the filename row is not a promise, and the done copy repeats it rather than counting the file.

- The **Settings hub** draws four **Settings groups**; the Library group is **Action rows**, the other three are one **Section card** each. A control whose mechanism does not exist — _Change…_, _Software update_ — is not drawn, the way the **Export** row was not drawn until its dialog existed and the _Add a codec pack_ zone was not drawn until `16-component-upload`; only a control the prototype itself marks **Coming soon** is drawn disabled.
- The **Codec report** draws exactly the **Format catalogue** ∩ what `capabilities(component)` reports, in catalogue order; a row is **Built-in** or **Installed** and never "unsupported", because absence is how the report says so.
- Every **Installed** row exists because of the one **Playback component**; none has a size or a remove, and all of them change together when the **Component swap** replaces it. The size and the remove are the **Component row**'s, which is one row because there is one component.
- A **Setting** lives in SQLite beside the **Movies**, is read by the **Settings hub** and the **Player** through one `fetchSettings`, and is written by a **Single-signal write** per key. The **Preferred subtitle language** is the only key today; the **Auto-on toggle**'s is the roadmap's.
- The **Preferred subtitle language** is chosen from the **Language pool** but not constrained to it, exactly as a **Subtitle**'s own language is.
- The **Storage report** and the **Export summary** count the same `countMovies()`; **Space used** counts bytes on disk, so the two can disagree by a **Stranded folder**.
- The **Component slot** is read first, then `FAMILYFLIX_FFMPEG_PATH`, then `PATH`: an **Uploaded component** wins over the **Default component**, and a remove falls back to it — which is why the default is never removable and never overwritten.
- A **Playback component** arrives as two **Component binaries** in one gesture and is refused as a whole if either is missing, stray, or will not run; the **Component swap** happens only for a **Verified component**, and only when nothing is running the pair on its way out.
- `createPlayback(mediaPath, slot)` reads `slot.current()` per request, so the next Play after a **Component swap** decides over the new component with nothing cached to clear; `Playback.capabilities()` reports `slot.info()` beside the rows, and both component routes echo that report.
- The **Codec report** draws the codec rows, then one **Component row**, then the **Component drop zone**; the **Codec summary** counts the codec rows only. The row and the zone are inverses: the zone puts an **Uploaded component** in, the row's ✕ takes it out.

- An **Update check** runs once per launch and on every press of _Check for updates_; only the pressed one ever speaks, and only one that got an answer advances **Last checked**.
- An **Update check** does not produce an **Update offer** — it reports that one is coming. The offer exists when the bytes have landed, which is what `onOffered` announces and what `current()` still says on the next mount.
- The **Software update** row and the **Update offer snackbar** are two views of one **Update offer**: the row is where the maintainer goes, the snackbar is what finds the family. Both press the same `install()`.
- Every **Snackbar** the app pushes today belongs to the **Software update** flow; the **Snackbar stack** is app-level regardless, because the next feature to need one will not be in Settings either.
- The **Offered version** names an **Update offer**; the **App version** names the running build; the **Seen version** names the one before it. Only the middle one is baked into the bundle.
- **Software update** cannot be drawn without an **Update bridge**, and the bridge cannot exist without the Electron shell — the same rule that kept _Change…_ and the _Add a codec pack_ zone off the page, read one initiative ahead.

## Example dialogue

> **Dev:** "I'm adding `Northwind (2018)` by hand in the **Movie form**. I point
> the video **File slot** at the file in my **Library root** — does the **Movie**
> now point there too?"
> **Maintainer:** "No. That's a **Picked file** — the browser gives me its name
> and its bytes and flatly refuses to tell me where it is. On save we copy it
> into its own **Movie folder** and store a **Stored path** relative to the
> **Managed media directory**. After that the app owns its copy and my folder is
> just where it came from."
> **Dev:** "We used to say we **reference in place** and never copy."
> **Maintainer:** "We did, and it's retired. Every read route we've shipped
> resolves a **Stored path** under that one root and refuses anything outside it
> — a symlink out included. Reference-in-place stopped being true the moment the
> player could actually play something."
> **Dev:** "Then what does **TMDB** do here?"
> **Maintainer:** "Nothing. Not on this screen. I type the title, the year, the
> director, the cast. **TMDB** was only ever the answer to 'I can't hand-type
> twelve terabytes', which is a bulk-import problem — one film is thirty seconds
> of typing."
> **Dev:** "So the **Poster** is a **Picked file** too. And the **Backdrop**?"
> **Maintainer:** "There's no slot for one, so it stays empty and the detail page
> draws the **Gradient fallback**. Same colors either way, hashed off the
> **Movie** id, so it looks deliberate rather than broken."
> **Dev:** "The genre chips — do I only get genres that already have films in
> them?"
> **Maintainer:** "God, no — then nothing new could ever be the first of its
> kind. The chips are the **Genre pool**, all twelve. The **Genre list** is the
> other one, with the counts, and that's for the **Filter dropdown**."
> **Dev:** "And if I open the same screen from the ⋯ menu on a film?"
> **Maintainer:** "Same screen, **Edit context** — pre-filled, 'Save changes',
> and it drops me back on the film rather than the **Browse home**. The video's a
> **Stored file** at that point, so fixing a typo in the title moves no bytes at
> all."
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
>
> **Dev:** "The **Continue Watching row** is ordered `recently-added`. Dad started
> something last night that's been in the library for years — it's card fifteen."
> **Maintainer:** "Then it's the wrong order. That row answers 'what were we in the
> middle of', and `recently-added` answers 'what did Carlos import last'. It wants
> **Last watched at**, newest first."
> **Dev:** "Can I order by `updated_at`? It's already there."
> **Maintainer:** "No — I rate and heart things from the sofa. If giving a film four
> stars shoves it to the front of the resume queue, that row is telling me I watched
> something I didn't."
> **Dev:** "So a sixth **Sort order** in the dropdown?"
> **Maintainer:** "God, no. The menu has five and the prototype draws five. Nobody
> should be able to _choose_ this one — it's just how that shelf is."
> **Dev:** "But Mum sorts the home A–Z. Does the resume row go A–Z with everything
> else?"
> **Maintainer:** "It doesn't. Sorting is her saying how she wants to _browse_ —
> the resume row isn't a browse, it's the queue. Filter it with everything else, by
> all means: if she's searching 'com', a film she's part-way through that isn't a
> comedy has no business sitting up there. Narrowing is one question, ordering is
> another."
> **Dev:** "And the **Favorites row**? Does it pin an order too?"
> **Maintainer:** "No — leave that one following the sort. A shelf of favorites has
> no natural order for me to be annoyed you overrode."
>
> **Dev:** "Mum presses Play on an MKV. Chromium can't open the container at all."
> **Maintainer:** "Then it's a **Remux**. The picture and sound inside are fine —
> it's the wrapper it can't read — so the **Playback component** rewraps them
> without touching a frame. It's a file copy's worth of work."
> **Dev:** "And if it's HEVC with DTS?"
> **Maintainer:** "**Transcode**, and it'll cost us. But she gets a picture, which
> is the whole point. She should never learn what a container is."
> **Dev:** "So we upload a `.dll` to make HEVC play, like the prototype shows?"
> **Maintainer:** "You can't — the decoder's compiled into Chromium. What you'd
> actually be dropping in is the **Playback component**, a different FFmpeg build
> with more decoders in it. That's the honest version of that screen, and the rows
> above it should say what **Format support** we really have, not a list I typed."
> **Dev:** "She drags the **Scrubber** to 01:12:00 mid-**Transcode**. There's no file
> to seek in."
> **Maintainer:** "Then start a new one at 01:12:00 — that's the **Stream offset**.
> Just don't let the screen believe the element: the element thinks it's at zero, and
> the **Absolute position** is an hour and twelve minutes in. Everything the family
> sees is the second number."
> **Dev:** "Does that throw the subtitles out by an hour?"
> **Maintainer:** "It would if we let the browser time them, which is exactly why we
> don't. A **Cue** is stamped in **Absolute position**, and we draw it ourselves."
> **Dev:** "Speaking of — are subtitles on when the film starts?"
> **Maintainer:** "No. There's a toggle in Settings for that and it ships switched
> off and disabled. Turning them on by default would be shipping the roadmap by
> accident."
> **Dev:** "But the prototype's player has them on."
> **Maintainer:** "That's so you can _see_ the box in the mockup. Don't build the
> screenshot."
> **Dev:** "Dad opens a film, changes his mind, backs out after three seconds. Does
> that jump to the top of **Continue Watching**?"
> **Maintainer:** "God, no. Nothing's written until the first **Watch tick**, and
> nothing's written then either unless he's actually moved — that's the **Tick
> threshold**. Three seconds isn't watching something."
> **Dev:** "And when the credits roll and he wanders off?"
> **Maintainer:** "**Finish threshold**. Past ninety-five per cent it's watched, and
> it comes off the resume shelf on its own. Leaving a film he's finished sitting
> there at 'Resume · 2:04:00' forever is the thing that makes the shelf useless."
> **Dev:** "The **Scrubber** needs a total. I've got `runtimeMinutes` on the
> **Movie** — 118 minutes."
> **Maintainer:** "And what do you do with the ones where it's blank?"
> **Dev:** "…nothing. There's no total, so there's no bar to drag."
> **Maintainer:** "Then it's the wrong number. **ffprobe** is already reading the
> file to pick a **Playback path** — take the duration off that. That's the
> **Playback read**, and it's right even when the catalogue is."
> **Dev:** "So `runtimeMinutes` is what, then?"
> **Maintainer:** "It's what the **Resume label** says on a card. It's metadata.
> It's not how long the film is."
> **Dev:** "Last one. My machine has no FFmpeg on it at all yet."
> **Maintainer:** "Then MP4s play and everything else says so. That's a **Player
> notice**, not a crash. The app being half-useful is a state we're allowed to
> have — the app refusing to start isn't."
> **Dev:** "The ⋯ **Edit menu** finally has its second row. Red, like the prototype
> draws it. Does it delete on the click?"
> **Maintainer:** "No — it opens the **Delete dialog**. The prototype’s row just
> shuts the menu; that was a placeholder, not a decision. The dialog is the
> prototype’s own **Modal** with its own `danger` button. We amend the handoff
> with that, then build it."
> **Dev:** "And the files? The 12 GB copy we made when it was added?"
> **Maintainer:** "Gone — after the row. **Best-effort cleanup**: if Windows has
> the video locked because someone was mid-stream, the row still goes and the
> folder is **stranded**. A folder nobody can reach beats a film Mum can open
> and watch fail."
> **Dev:** "The family’s own folder — the one I picked the file from?"
> **Maintainer:** "Never touched. That’s the one sentence the dialog exists to say."
> **Dev:** "And if I press Delete twice from two windows, the second gets a 404."
> **Maintainer:** "**Gone is gone.** A 404 on a delete is the answer we wanted."
> **Dev:** "The Excel sheet. Mum's columns aren't going to be called what I
> called them."
> **Maintainer:** "They won't be, and I haven't looked either. Find the columns by
> **name** through a little synonym table, and only insist on a title. Whatever
> else is there is a bonus; whatever isn't recognised is ignored. If the first
> real run needs one more synonym, that's one line."
> **Dev:** "And the folder — do I walk the whole drive?"
> **Maintainer:** "One rule: a folder with a video in it is a **Source folder**,
> stop there. A folder with none, go down a level. That's how `Movies\Action\Die
Hard` gets found and `Die Hard\extras` doesn't become a second film."
> **Dev:** "Then I match rows to folders by name. 'The Lantern Keeper' against
> 'The.Lantern.Keeper.2019.1080p'."
> **Maintainer:** "By **Title key**, both sides. Strip the dots, the year, the
> quality tag, the accents. Equal key and an agreeing year is a **Match**, and a
> **Match** goes straight in. Two folders with that key, or only a folder that
> _starts_ with it — that's a **Problem**, and I look at it."
> **Dev:** "So the **Review step** isn't reviewing the import."
> **Maintainer:** "It's reviewing what the import couldn't do. Twelve hundred
> matches on a screen is a list nobody reads. Four **Problems** is a Saturday
> morning. The tile says 'matched confidently _and imported_' — believe the tile."
> **Dev:** "Ironwood has no subtitle file. Problem?"
> **Maintainer:** "No. A **Warning line** in the **Activity log**. Subtitles are
> optional on the form and half the collection has none — a **Problem** is a film
> that _isn't in the library_ yet. Missing a genre is the one soft exception: it
> goes in, and it's flagged, because a film with no genre is on no row of the
> home screen."
> **Dev:** "**Resolve** opens the form. But the form takes files from a picker —
> it can't be given a path."
> **Maintainer:** "It couldn't be, before. Now there's a run with a root, so a
> **Found file** is a path _under that root_, and the server will copy from
> there and from nowhere else. Same rule as **Stored path**, pointed at the other
> folder."
> **Dev:** "Copy. Twelve terabytes. Not move?"
> **Maintainer:** "Copy. **Copy-in** — `copyFile`, not a stream, so the OS does
> the work. A move is a second storage model, and a bug in it deletes my parents'
> films. Put the managed directory on the big drive and delete the originals by
> hand once you've clicked through the library."
> **Dev:** "I cancel halfway. What's left?"
> **Maintainer:** "Everything that finished is in. The run is gone, you're back at
> setup, and when you run it again the rows already in are **Already in
> library** — one log line each, no problem, no match. Cancelling costs nothing."
> **Dev:** "And TMDB? Every log for a year has said 'at bulk import'."
> **Maintainer:** "The prototype has no key field, no match step, no offline
> state. The sheet holds what I couldn't type and the folder holds the poster.
> Whatever TMDB adds on top is **Enrichment** — a later pass over a full
> library, if it ever earns a prototype. `tmdb_id` stays null."

> **Dev:** "The **Export** row on Settings says _Export to CSV_, but the
> **Export dialog** offers Excel too. Which is it?"
> **Maintainer:** "Both. The row's label is the prototype's and it opens the
> dialog; the **Format card** is where I pick. Whichever I pick, the **Export
> file** is `family-library.csv` or `.xlsx`, every movie A–Z, the eight
> **Export columns** and nothing else — no synopsis, no paths. It's a listing of
> the collection, not a copy of the media folder."
> **Dev:** "And the `12 movies` beside the filename — where does that come from
> before anything is written?"
> **Maintainer:** "The **Export summary**. The dialog asks the server how many
> movies it would write, and the same number is in the **Export ready** copy.
> If the summary never arrives the label is blank; I can still export."
> **Dev:** "So if I open that CSV in Excel, fix twenty years, and run **Bulk
> import** over it?"
> **Maintainer:** "It reads. The **Sheet writer** and the **Sheet reader** are
> mirrors — that's why a `Status` column now counts as the watched column. But
> every row is **Already in library**, so the run imports nothing; Edit is
> still how a stored movie changes. The round trip is a backup that can come
> back, not a bulk editor."

> **Dev:** "The **Codec report** — six rows in the prototype, and `ffmpeg
-decoders` gives me four hundred. Which do I draw?"
> **Maintainer:** "The **Format catalogue**: the codecs my parents' folder is
> actually made of — H.264, HEVC, VP9, AV1, XviD, AC-3, DTS, AAC and their
> friends — each with the name the prototype gives it and its **Container
> chips**. If the report has it, it's a row; if it doesn't, there's no row.
> Nobody needs to see `pcm_s16le`."
> **Dev:** "Each row has a size and a ✕. What's the size of HEVC?"
> **Maintainer:** "It hasn't got one. There's one pack in this app — the
> **Playback component** — and every **Installed** row came with it. A ✕ on
> _DTS_ that quietly took _HEVC_ with it would be a trap, so no row has one,
> and the size cell says what the prototype's built-in cell says: a dash. The
> component's own size and its remove are the **Playback component upload**'s
> to draw, when it draws the zone."
> **Dev:** "So the dashed _Add a codec pack_ zone —"
> **Maintainer:** "Not drawn. Same rule as the **Export** row before the
> dialog existed. The card keeps the prototype's sentence about adding a pack;
> the zone lands right under it."
> **Dev:** "_Preferred language_. The prototype offers four."
> **Maintainer:** "Sample data. It offers the **Language pool** — the same
> seven the **Subtitle row** offers, spelled once now in `src/types` — and
> the choice is a **Setting**: a row in SQLite, not `localStorage`. It's the
> household's preference and it travels with the backup. The player reads it
> and hands it to `preferredSubtitle`, which has been waiting for it since
> log 10."
> **Dev:** "And _Turn on automatically_?"
> **Maintainer:** "Drawn, disabled, **Coming soon** — the prototype's own
> words. It stores nothing. Auto-on is roadmap."
> **Dev:** "Storage says `18.4 GB of movies · 12 titles`. Where from?"
> **Maintainer:** "The **Storage report**: the absolute path of the
> **Managed media directory**, **Space used** as a walk over every file under
> it, and the same `countMovies()` the **Export summary** uses. If a
> **Stranded folder** is in there, the bytes count it and the titles don't —
> that's the first place one shows, exactly as we said it would."
> **Dev:** "_Change…_ and _Software update_?"
> **Maintainer:** "Electron's — a folder dialog and a move of the whole
> directory, and an updater. Neither exists, so neither is drawn. About is the
> brand row and the **App version**, which is `0.0.0` until packaging says
> otherwise. It's not a placeholder; it's the truth about this build."
> **Dev:** "The dashed zone under the **Codec report** — a parent drops a
> `.dll` on it, like the old prototype said."
> **Maintainer:** "Then it's refused, and the zone says so on its own line —
> that's the **Refused face**. What it takes is the **Playback component**:
> `ffmpeg` and `ffprobe`, both, in one drop. The server tells them apart by
> name — a **Component binary** is one or the other or nothing — and runs
> them before anything moves. A **Verified component** is one whose two
> `-version`s answered."
> **Dev:** "Where does it go? Over the installer's ffmpeg?"
> **Maintainer:** "Never. Into the **Component slot** — a folder under
> user-data that's read before the installer's and before `PATH`. An
> **Uploaded component** wins while it's there, and the **Default component**
> comes back the moment it's removed. Overwriting the installer's copy would
> leave nothing to fall back to."
> **Dev:** "And if Mum is mid-film when I drop a new one?"
> **Maintainer:** "The **Component swap** is a folder rename, and Windows
> won't rename a folder holding a running exe — so the first rename fails
> with nothing moved, and the route answers the **In-use refusal**. I stop
> the film and drop again. We don't kill her transcode to make room."
> **Dev:** "The prototype's rows have a size and a ✕. HEVC still hasn't got
> either."
> **Maintainer:** "Right — those belong to the one thing that has them. The
> **Component row** is the same row template, last in the list: _Playback
> component_, the two files as chips, `94.3 MB`, **Default** or **Uploaded**,
> and the ✕ only when it's uploaded. Press it and the rows it added go, no
> dialog — a drop brings it back."
> **Dev:** "So the zone's title still says _Add a codec pack_?"
> **Maintainer:** "On screen, yes — that's the family's word and the
> prototype's. In the code, the wire and this glossary it's a **Playback
> component**, and the **Upload state** is idle, busy or refused. There's no
> 'added' face: the report the route echoes is the feedback."

## Flagged ambiguities

- **"Sort" is now two vocabularies (new):** a **Sort order** (`MovieSort`,
  `MOVIE_SORTS`) is what the wire carries and the **Filter dropdown** draws —
  five of them, exactly the prototype's menu. A **List sort** (`ListSort`) is
  what the repository can order by — those five plus `last-watched`. The wider
  one exists so the **Continue Watching row** can have a correct order without a
  URL being able to name an order no control can show, which is the rule
  `parseLibraryQuery` and `parseGenreQuery` were both written to keep. Say which
  one you mean: a **Library query** holds a **Sort order**, a `MovieQuery` holds
  a **List sort**.
- **Home sections narrow together but do not order together (new):** every
  **Home section** is built from the one **Library query**, and that guarantee is
  about its _filters_. The **Continue Watching row** pins `last-watched`; the
  **Favorites row** and the **Genre rows** follow the query's **Sort order**. The
  asymmetry is deliberate — a resume queue's order is part of what the shelf
  means, a favorites shelf has no intrinsic order — but two `listSection` calls
  passing different sorts look like an oversight to anyone who has not read
  `09-continue-watching` Q7.
- **"Import" now names two unrelated things (new):** the **Movie form** copying
  one film's files into its **Movie folder**, and **bulk import** reading a
  spreadsheet and matching rows to folders. Only the second has a **Review
  step**, a progress console, or any business with **TMDB**. Say **add a
  Movie** for the first and **bulk import** for the second; never just
  "import", and never "ingest" for either.
- **Library root vs. Managed media directory (new):** both are folders full of
  movies and only one is ours. The **Library root** is the family's own folder —
  the app never reads it, and after Add Movie ships it is only the place a
  **Picked file** is chosen _from_. The **Managed media directory** is the app's,
  and it is the only place a **Stored path** can resolve to. A sentence about
  "the media folder" is ambiguous between them; name which.
- **The Movie form is the one whole-record write (new):** every other write in
  the app is a **Single-signal write** that echoes one value back. The form's
  save goes through `updateMovie`, which by design applies none of the
  side-effect conventions the mutators do — patching `watched` there will not
  clear a **Resume position**, and patching anything will not stamp **Last
  watched at**. Two writers, one **Movie**, deliberately different rules.
- **Last watched at is not `updated_at` (new):** both are ISO stamps on a
  **Movie** and only one of them means "watched". `updated_at` moves on any edit
  — a **Rating**, a **Favorite**, a metadata fix — so ordering the **Continue
  Watching row** by it would promote **Movies** nobody has played. It is also not
  cleared by `markUnwatched`: un-marking is not un-watching, and the stamp
  records a fact that happened.
- **The Favorites row has no View all, and that strands favorites (new):**
  the prototype (`page.LibraryPage.dc.html:181–219`) gives the shelf no trailing
  action and `docs/handoff/` has no Favorites page, so the 15-cap every **Home
  section** takes has nothing behind it here — a 16th **Favorite** is reachable
  from no route in the app. A **Genre row**'s cap is safe precisely because
  **View all** exists. Recorded as a **prototype amendment**, not built:
  `08-favorites` Q10. Filed as issue 67 and **closed as not-planned on
  2026-08-29**, so this bullet is now the only record of it: a route past the
  15th **Favorite** wants a grill-me and a prototype amendment first, which is
  what a closed issue does not substitute for.
- **"Favorites" is a shelf, not a filter (new):** the **Favorites row** is a
  **Home section**, and there is no favorites **Filter dropdown**, no
  `favoritesOnly` in a **Library query**, and no `/favorites` route. The
  `favoritesOnly` flag exists on the repository's `MovieQuery` only, where
  `getHome` sets it to build that one section — it is not something a URL can
  ask for.
- **What the Favorites row renders is not what its Home section holds
  (updated):** the section keeps every **Movie** the payload sent; the row draws
  the **Favorite** ones. The difference is load-bearing rather than cosmetic — an
  **Optimistic save** reverts by flipping the flag back, so a card spliced out of
  state could never return when a write is refused. **Anything counting a section
  must count what it draws**, through `shelvedFavorites`, not what it holds: the
  **Browse home**'s empty guard read the raw length and rendered a blank page
  (74). Any future section drawing a derived view of its data inherits the rule.
- **`Movie.isFavorite` beside `PosterCardMovie.favorite` (new):** two spellings
  of two different things, both deliberate and both 1:1 with the prototype's own
  `data-props` — the domain record's field and the card view model's field. The
  `view()` mapper is where they cross. This is the **only** pair of spellings
  Favorite is allowed; it is not an abbreviation to finish tidying up.
- **A Movie's length now has two sources, and only one of them is duration
  (new):** `runtimeMinutes` on the **Movie** record is catalogue metadata —
  rounded, nullable, and what the **Resume label** and the **Poster card**'s
  progress bar are built from. `durationSeconds` on the **Playback read** is what
  the file actually is, and it is the only one the **Scrubber** and the **Finish
  threshold** may use. They disagree by up to half a minute on a normal film and
  completely on a **Movie** that arrived without a runtime, which is the case
  that forced the split (`10-video-player` Q19). Do not reach for
  `toRuntimeSeconds` inside the **Player**; do not put `durationSeconds` on a
  card.
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
- **"Continue Watching" _does_ mean most-recently-watched (resolved):** the row
  used to be ordered `recently-added`, because no sort existed over "when did
  playback last touch this" — so the name described only _which_ **Movies**
  appear (**In-progress**), not their order, and the ambiguity was flagged to be
  revisited with the player. Issue #77 added exactly that sort: **Last watched
  at** is stamped by the watch mutators, `last-watched` is the **List sort** over
  it, and issue #78 pinned the row to it whatever the header's **Sort order**
  says. The name and the order now agree. Nothing writes the stamp through the
  UI until the player ships, and an unstamped library still falls back to
  `recently-added` — which is why the old wording was true when it was written.
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
- **Marking Watched destroys the Resume position (resolved by `10-video-player`):**
  `markWatched` zeroes `resume_position_seconds` by documented convention, so the
  **Movie detail page**'s reversible watched toggle loses the position on a round
  trip. `inProgressOnly` is `watched = 0 AND resume > 0`, so the flag alone already
  removes the **Movie** from the **Continue Watching row** — the zeroing is not
  load-bearing for the shelf. This was flagged for the watch-tracking grill, which
  has now happened: **the zeroing stays** (`10-video-player` Q12). Crossing the
  **Finish threshold** dispatches to the same `markWatched` a hand-tick uses, so a
  film that finishes itself and one ticked by the maintainer leave the shelf by one
  rule rather than two — and a preserved position on a finished film would be a
  number nothing reads and the credits to sit in on the next play. Do not
  re-open it without a grill of its own.
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
- **`GET /api/movies` is no longer any screen's endpoint (resolved by the
  export refactor, 141):** the **Genre page** takes `GET /api/genre/:name`
  instead, because it needs the **Genre total** beside the list and one request
  rather than a fan-out. `/api/movies` stayed as the generic browse API the
  exporter might want; nothing claimed it by the time export shipped — the
  exporter reads `storage.listMovies` on the server — and it went in 141, its
  sort coverage already held by `/home?sort=` and `/genre/:name`, and its
  test-suite readers moved to the repository.
- **"Codec pack" is a fiction we are deliberately replacing (new):** the
  prototype's CodecManager drops a `.dll` / `.so` / `.pak` and a format lights
  up (`FamilyFlix.dc.html:287`, appending a canned row). No such file can change
  what plays — Chromium's decoders are compiled into the binary. The one thing
  that genuinely is uploadable and genuinely does change what plays is the
  **Playback component**. Say **Playback component**, never "codec pack" or
  "codec", and record the copy change as a **prototype amendment**
  (`10-video-player` Q5), not as something invented at build time.
- **"Position" is now three things (new):** **Resume position** is what is
  stored, **Absolute position** is where we are in the **Movie**, and **Element
  time** is what `video.currentTime` reports. On **Direct play** all three agree,
  which is exactly why the bug will not show up in the first thing anyone tests.
  On **Remux** and **Transcode**, **Element time** is short by the **Stream
  offset**. Never write `currentTime` in domain code without saying which.
- **"Chrome" is overloaded (new):** CLAUDE.md's layer table calls `layouts/`
  "page chrome", and the **Player** has no `layouts/` involvement at all — its
  **Chrome** is the two fading overlay bars it owns itself. Both usages are
  staying; qualify it as **player Chrome** when the sentence could go either way.
- **"Track" pulls three ways (new):** a **Subtitle** is the file record in the
  database, a **Cue list** is its parsed contents, and a **Subtitle track** is
  whichever one is currently rendering. The HTML `<track>` element is a fourth
  thing and we do not use it at all (`10-video-player` Q6). Prefer the specific
  term; "track" alone should not appear in code.
- **The prototype plays with subtitles on; we ship them off (new — deviation):**
  `playMovie()` sets `subsOn:true` (`FamilyFlix.dc.html:338`) so the
  **Subtitle overlay** is visible in the mockup. `page.SettingsPage` is the
  product decision, and there "Turn on automatically" ships **disabled** with
  auto-on subtitles marked 🧭 roadmap in CLAUDE.md. Reproducing the mockup's
  default would implement a roadmap item by accident. A **recorded divergence
  from the prototype's behavior**, in the same class as the rating filter the
  **Genre page** does not apply.
- **The fullscreen button is drawn but inert (new):** `feat.PlayerControls`
  gives it a `title` and no handler, the same way the prototype's other
  simulated affordances behave. Wiring it is not a redesign — it moves no pixel —
  so it ships wired (`10-video-player` Q15). Contrast the **CC** button, which
  ships as the plain toggle it is drawn as: adding a **Subtitle track** picker
  behind it _would_ be new UI, and so a **prototype amendment**.
- **The player needs three states the prototype never draws (new):** a
  **Transcode** takes a second or two to produce its first bytes, a video file
  can be missing, and a conversion can begin and then produce nothing at all
  (**Failed conversion**). All three render as a **Player notice** reusing the
  big-play circle's exact geometry rather than as a new element, and all three
  are recorded as **prototype amendments to make before building**, per
  CLAUDE.md — the surface is amended first, then translated, never improvised in
  code. The third was found after the first two shipped, and was amended into
  the prototype the same way rather than being drawn straight into the
  component.
- **“Remove” and “Delete” are two verbs, not one (new):** **Remove** is what a
  `RemoveButton` does to a **File slot** or a **Subtitle row** on the **Movie
  form** — a record change, no bytes touched, until a save makes a **Superseded
  file** of it. **Delete** is what the **Delete dialog** does to a whole
  **Movie** — row and **Movie folder** both. `Media.removeFolder` (a rollback,
  before any commit, throws) and `Media.removeMovieFolder` (a **Delete**, after
  the commit, swallows) are named on the same line: “remove” in the filesystem
  domain, “delete” in the library domain. Do not say “remove a movie”.
- **The prototype’s Delete row is a placeholder, not a design (new):** its
  `onClick` is `onToggleEditMenu`. Log 04 read that as “not designed” and
  deferred; log 12 reads it the same way and composes the confirmation from the
  prototype’s own **Modal** pattern and `danger` **Button** — a **prototype
  amendment** made first, in the handoff, before the build translates it. It is
  the same route the **Player notice** took, and the only route CLAUDE.md
  allows for a surface the prototype leaves blank.
- **"Movie folder" was about to mean two folders (new):** the app's own copy
  under the **Managed media directory** has been the **Movie folder** since log
  11, and the family's per-film directory under the **Library root** had no
  name — CLAUDE.md says "one folder per movie" for both. The family's is the
  **Source folder**. Scan code walks **Source folders**; `Media` writes **Movie
  folders**; nothing does both.
- **"Import" now has a third meaning, and a context (updated):** beside the
  form's add and **Bulk import** there is **Import context** — the form opened
  by **Resolve**. Say **Bulk import** for the run, **Import context** for the
  form's mode, and **add a Movie** for the form's ordinary save. The
  `import-export/` folder and the `bulk-import` initiative are deliberately
  spelled differently so a commit prefix cannot be misread as the folder.
- **"Skip" is one action with two buttons (new):** the **Review step**'s _Skip_
  and the form's _Skip this one_ both **Dismiss** the **Problem** through the
  same `DELETE`. The prototype's labels stay; the code says `dismiss` and never
  `skip`, which the player already uses for ±10 s.
- **"Review step" changed meaning (updated):** it used to be defined as
  confirming matches "before committing"; README and CLAUDE.md said the same.
  Log 13 Q16 sides with the prototype — matches commit during the run, and the
  step reviews **Problems** only. Both documents are amended with the log.
- **"TMDB at bulk import" is retracted everywhere (updated):** logs 01, 02 and
  11 and four rows of this glossary said it. Log 13 Q18 removes TMDB from the
  initiative; the rows above are updated, the older logs stand as the snapshots
  they are. Say **Enrichment** for the idea, and do not say "TMDB" as if it were
  planned.
- **Three file kinds, one form (new):** a **Stored file** travels as its
  **Stored path** (under the managed directory), a **Picked file** as bytes, a
  **Found file** as an absolute path under the **Current run**'s **Library
  root**. The server tells the third from the first by which root the path
  resolves under — a **Found file** that resolves under neither is refused, not
  guessed at.
- **The prototype's `missing-file` kind is retired (new — deviation):**
  `seedProblems` flags "no subtitle file was found" as a **Problem**. A
  subtitle is optional on the form the resolve shares, so that is a **Warning
  line**; the kind that actually blocks is `no-video`. A **prototype
  amendment**, made in `FamilyFlix.dc.html` before the build.
- **One invented line (new — deviation):** the setup step needs to say that a
  typed path would not open, and `prim.TextField` has no error affordance.
  Log 13 Q7 draws one 13px `danger` line under the field — the problem row's
  reason line, recoloured — and records it as a **prototype amendment** rather
  than improvising it in code.
- **"Export to CSV" opens a dialog that also writes Excel (new):** the row's
  label is `page.SettingsPage.dc.html`'s and is kept as drawn; the **Export
  format** is chosen inside the **Export dialog**. Say **Export** for the
  feature and name the format only when it matters.
- **A round trip that changes nothing (new):** README's "bulk-edit externally
  and re-import" reads as though an edited **Export file** amends the library.
  It does not: **Bulk import** skips every **Already in library** row, and only
  the **Movie form** edits a stored **Movie**. What the round trip guarantees is
  that an **Export file** _reads_ — a backup that can rebuild an empty library,
  not an editor for a full one.
- **`bare` is a boolean where a composition would be cleaner (new):** the
  **Bare modal** exists for one face of one dialog. If a third dialog wants a
  third arrangement, `Modal` splits into a header and a body to compose rather
  than growing a second flag — filed then, not now (log 14 Trade-offs).
- **`GET /api/movies` is unclaimed (resolved by the export refactor, 141):**
  export reads `storage.listMovies` on the server, so the endpoint the glossary
  held for "the exporter" had no caller. Removed in 141; the sort coverage its
  route tests carried was found already asserted on `/home?sort=` and
  `/genre/:name` through the same `parseSort`, so nothing moved but the
  tests that read it as an observation seam, which now read the repository.
- **"Codec manager" is a report until upload ships (new):** the prototype's
  file is `feat.CodecManager` and the folder keeps the name, but what
  `15-settings-hub` builds is the **Codec report** — rows read from
  `capabilities(component)`, with nothing on the screen that installs or
  removes. The feature table's "Codec manager" row splits into _view_ (this
  initiative) and _add a playback component_ (the **Playback component
  upload**). Say **Codec report** for the rows, and do not say "codec pack" —
  the glossary retired it with log 10.
- **A row's size and ✕ do not survive the one-pack mechanism (new —
  deviation):** log 10 Q5 said "rows, ext chips, status pills, remove button
  and geometry stay 1:1". Geometry does; the remove button is deferred rather
  than contradicted (`15-settings-hub` Q7), because there is nothing per row
  to remove and no upload yet to invert. The prototype's 32px spacer holds the
  column on every row, and the size cell is a dash on every row until the
  upload initiative decides what a component's size means on one.
- **"added by you" → "from the playback component" (new — deviation):** a
  copy amendment to `FamilyFlix.dc.html`'s `summaryLabel`, log 10
  amendment 1's sibling. "Added by you" is false of the build the installer
  bundles.
- **Not drawn vs. drawn disabled (new):** the hub has one affordance for
  "designed, not shipped" — the **Coming soon pill**, which the prototype
  itself puts on the **Auto-on toggle**. Every other control whose mechanism
  is missing (_Add a codec pack_, _Change…_, _Software update_) is **not
  drawn**, on log 13 Q2's rule, rather than disabled with an invented pill.
  Inventing a second disabled state would be a redesign.
- **"Settings" is a payload and a screen (new):** the **Settings hub** is the
  page; **Settings** is what `GET /api/settings` answers. Say _hub_ for the
  screen and _Setting_ (singular) for one preference; "the settings" alone is
  ambiguous.
- **The Language pool is not a constraint (new):** the dropdown offers seven
  names and the route accepts any non-empty string, exactly as a **Subtitle**'s
  language is "stored as the chosen text". Validating the preference against
  the pool would make a display vocabulary into a rule, and the only writer of
  the value is the dropdown anyway.
- **Two counts of one library (new):** the **Storage report**'s title count
  and **Space used** are read from different places — SQLite and the disk —
  and a **Stranded folder** is precisely the case where they disagree. That is
  a feature of the report, not a bug in it; nothing should "fix" the bytes to
  match the rows.
- **"Format row model" was a sketch, not a name (resolved by the settings-hub
  refactor, 149):** the **Codec report** row said one **Codec row** per
  **Format row model**; the type the build shipped is `CodecRowModel` in
  `codecView`, the name the design log's own sketch gave it. Amended to the
  code's name. Every other Settings-hub row — and the updated
  **Single-signal write**, **Playback component**, **Format support**,
  **Language pool** and **Stranded folder** rows — was read against the code
  for that round and holds.

- **"Codec pack" survives on screen and nowhere else (new):** the zone's
  title _Add a codec pack_ and the Codecs lede's _add a pack_ are the
  prototype's copy and the family's word, kept 1:1 (`16-component-upload`
  Q16). Everything behind the words — the wire, the slot, the row, the hook,
  this glossary — says **Playback component**. Do not "fix" the screen to
  match the code, and do not let the code pick up "pack".
- **"Installed" and "Uploaded" are different claims (new):** **Installed** is
  a codec's **Status pill** — decoded `via-component` — and is true of a
  bundled and an uploaded component alike. **Uploaded** is the **Component
  row**'s pill — the maintainer put this pair here. An Installed codec on a
  Default component is the normal case on the family's machine; say which
  pill you mean.
- **"Default" means "not the maintainer's", not "bundled" (new):** the
  **Default component** is whatever `ffmpegBinary(env)` resolves — the
  installer's build there, `PATH`'s on a dev machine — so the pill is true on
  both and says less than "Bundled" would on one. "Bundled" was rejected
  because it is false on the machine this project is built on.
- **"Upload" in a local app (new):** the **Playback component upload** goes
  from a file dialog to the app's own server on `localhost`, the same hop
  every **Picked file** already makes. Say _upload_ for the gesture and the
  route, never for anything leaving the machine — nothing does.
- **"In use" is a refusal, not a state (new):** the slot has no idea whether a
  film is playing; it learns a pair is locked when the rename fails. There is
  no "playing" flag to consult, no queue, and no retry — the **In-use
  refusal** is the failing syscall, reported.
- **Three rows the build outgrew (resolved by the component-upload refactor,
  157):** the glossary was written by the grill ahead of the build and every
  row of _The Playback component upload_ was read against the code for that
  round. Three lost to it and the code won: **Incoming component** listed
  three install refusals where the build added a fourth, `failed`, for a swap
  stopped by neither the lock nor the pair; **Component slot** wrote
  `createComponentSlot(slotDir, env, verify)` where the third argument is a
  seams object carrying `verify` and `rename`; and **Component binary** said
  "case-insensitively, `.exe` or not" without the rule that actually makes a
  downloaded build work — a `-` and whatever the build called itself. Every
  other row of that section — **Uploaded component**, **Default component**,
  **Verified component**, **Component swap**, **In-use refusal**, **Component
  info**, **Component row**, **Component drop zone**, **Upload state** — and
  the updated **Playback component**, **Codec report**, **Codec row** and
  **Playback component upload** rows hold. **Component row** already said
  `RemoveButton`; the refactor made that true rather than correcting it.

- **"Update" said three ways (new):** a **Release** is what exists on the
  **Release feed**; an **Update offer** is one that has already been
  downloaded onto this machine; an install is what replaces the running app.
  The prototype's copy is careful about this and so is the code — "available
  to install" and "ready to install" both mean the bytes are here. Never write
  "an update is available" for a release nobody has fetched, because with
  auto-download on there is no moment at which that is what the app means.
- **"Available" is not a fourth face (new):** `electron-updater`'s
  `update-available` fires before the download and draws nothing. The
  **Update check**'s `'found'` is the same news, and the row answers it by
  advancing **Last checked** and waiting. The only thing that changes a face
  is `onOffered`.
- **The row is not the snackbar's fallback (new):** the **Software update**
  row answers the maintainer who went looking; the **Update offer snackbar**
  finds whoever did not. Neither is a degraded version of the other, and
  suppressing the snackbar outside Settings was rejected for exactly that.
- **"Up to date" is a claim, and an empty Last checked is the hedge (new):**
  the idle face says _You're up to date_ whether or not a check has ever
  answered — it is the absence of the **Last checked** label that says so. A
  fourth "never checked" face was rejected: the prototype already spells this
  with an empty `lastCheckedLabel`.
- **Snackbar, not toast or banner (new):** the prototype's file is
  `mol.Snackbar`, COMPONENT-SPEC calls the context `useSnackbar()`, and
  Horizon's own `UpdateBanner` is the name to avoid here — nothing in
  FamilyFlix is a banner, and a **Snackbar** that persists is still a
  **Snackbar**.
