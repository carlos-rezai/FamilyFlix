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

| Term                | Definition                                                                                                                                    | Aliases to avoid         |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Rating**          | Household 0–10 half-star score (10 = 5 stars), **seeded from TMDB** at import, maintainer-overridable.                                        | review, score, vote      |
| **Unrated**         | A **Movie** with no **Rating** (`NULL`) — distinct from a literal 0-star rating; renders as **no stars at all** on the **Movie detail page**. | zero stars, unscored     |
| **Status**          | A **Movie**'s **derived** watch state: `unwatched` \| `in-progress` \| `watched` (never stored).                                              | state, watch status      |
| **Watched**         | Explicit boolean flag meaning the maintainer marked a **Movie** finished; setting it via `markWatched` also clears the **Resume position**.   | seen, completed          |
| **Resume position** | Seconds into a **Movie**'s video where playback last stopped (`resume_position_seconds`).                                                     | progress, playback time  |
| **In-progress**     | Derived **Status** when `resume_position_seconds > 0` and not **Watched**.                                                                    | partially watched        |
| **Favorite**        | Per-movie household boolean (`is_favorite`) surfaced as the Favorites row, togglable from the card and the **Movie detail page**.             | liked, starred, bookmark |

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

| Term                       | Definition                                                                                                                                                                                                                                                             | Aliases to avoid                      |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Browse home**            | The `/` route (`LibraryPage`) — the parent-facing home screen listing the **Continue Watching row** then the **Genre rows**.                                                                                                                                           | home page, browse grid, dashboard     |
| **Genre row**              | A titled horizontal row showing up to 15 **Poster cards** for one **Genre**, with a "View all {count}" link.                                                                                                                                                           | shelf, carousel row, genre shelf      |
| **Continue Watching row**  | The **Browse home**'s top row: up to 15 **Continue cards** for **In-progress** **Movies**; hidden entirely when there are none.                                                                                                                                        | resume row, keep watching, up next    |
| **Card carousel**          | The horizontal scroller (prev/next arrows) inside a row, holding **Poster cards** or **Continue cards** per its **Carousel variant**.                                                                                                                                  | slider, scroller                      |
| **Carousel variant**       | Which card shape a **Card carousel** holds — `poster` or `continue`; also sets the tile width and arrow height.                                                                                                                                                        | mode, type, kind                      |
| **Poster card**            | The library's primary movie tile: **Poster** (or **Gradient fallback**), title, **Rating** stars, watch state, favorite heart.                                                                                                                                         | tile, thumbnail, cell                 |
| **Continue card**          | The wide 16:10 resume tile: **Gradient fallback**, title, **Resume label**, progress track, play badge. No **Favorite** heart.                                                                                                                                         | resume tile, continue tile, hero card |
| **Resume label**           | The human string on a **Continue card** — `Resume · 1:13 of 1:55`, or `Resume · 1:13` when runtime is unknown.                                                                                                                                                         | timestamp, progress text              |
| **View all**               | The **Genre row** header link to that **Genre**'s full page (`/genre/:name`); its count is the true total, not the 15 shown.                                                                                                                                           | see all, more, expand                 |
| **Home payload** (updated) | The single `GET /api/home` response — named sections: `{ continueWatching: Movie[], rows: HomeRow[] }` — now built for one **Library query**.                                                                                                                          | feed, home data                       |
| **Gradient fallback**      | A deterministic per-**Movie** color gradient (hashed from the **Movie** id) drawn wherever artwork is missing — cards, the detail **Poster**, and the **Backdrop**. Drawn by the `Artwork` primitive, which resolves artwork-or-fallback at every one of those places. | placeholder art, gradient stops       |
| **Poster URL**             | The browser-loadable URL (`/api/images/…`) that resolves a **Movie**'s **Poster path** through the image route.                                                                                                                                                        | image src, poster link                |
| **Card view model**        | `PosterCardMovie` — the small display shape a **Movie** is mapped to for a **Poster card** (rating→percent, progress→percent).                                                                                                                                         | card DTO, card props                  |
| **Continue view model**    | `ContinueCardMovie` — the display shape for a **Continue card**: id, title, gradient stops, **Resume label**, progress percent.                                                                                                                                        | continue DTO, resume model            |
| **Nominal sliver**         | The small fixed **Progress** bar length shown when a **Movie** is **In-progress** but `runtimeMinutes` is unknown.                                                                                                                                                     | placeholder progress                  |

## The Movie detail page

| Term                  | Definition                                                                                                                                     | Aliases to avoid                     |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **Movie detail page** | The `/movie/:id` route (`MoviePage`) — one **Movie** in full: **Backdrop**, **Poster**, **Meta line**, **Synopsis**, **Credits row**, actions. | movie page, detail view, title page  |
| **Detail view model** | `MovieDetailModel` — the display shape a **Movie** is mapped to for the **Movie detail page**, built by `detailView()`.                        | detail DTO, page model               |
| **Meta line**         | The inline row under the title assembling the **Meta segments** that exist, separated by `·`.                                                  | info row, metadata line, subtitle    |
| **Meta segment**      | One item on the **Meta line** — year, **Runtime label**, or **Rating** stars; an absent one is omitted **with its separator**.                 | meta field, detail bit               |
| **Runtime label**     | The human runtime string — `2h 8m`, or `42m` / `2h` when an hour or minute component is zero.                                                  | duration, length, running time       |
| **Play label**        | The primary button's text — `Play`, or `Resume · 52:00` for an **In-progress** **Movie**, built from the **Resume position**.                  | play text, CTA label                 |
| **Credits row**       | The **Director** + **Cast** block below the **Synopsis**; a missing one shows `—`, and the row is omitted only when both are absent.           | credits block, cast section          |
| **Edit menu**         | The ⋯ overflow menu on the **Movie detail page**; holds Edit details today, Delete movie when that feature ships.                              | overflow menu, kebab menu, more menu |
| **Load state**        | Which of `loading` \| `ready` \| `not-found` \| `error` a screen is in; **not-found** and **error** are distinct and offer different actions.  | status, fetch state                  |
| **Placeholder route** | A registered route rendering a documented stub, so links have honest destinations before the real screen exists.                               | stub page, dummy route, TODO page    |

## Shared UI units

Vocabulary for the units several screens draw from. These name our components,
not anything the prototype adds — `docs/handoff/` gives the visual surface, and
these give the shared code behind it a single agreed name.

| Term                  | Definition                                                                                                                                                                                                          | Aliases to avoid                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Load message**      | The centred title + body + optional action block a screen shows instead of its content — an empty library, a failed load, a **Movie** that is gone. Named for the **Load state** three of its four uses are in.     | empty state, error state, notice |
| **Skeleton**          | One pulsing placeholder block held while content loads. Each screen arranges its own; only the surface and the pulse are shared.                                                                                    | shimmer, ghost, loader, spinner  |
| **Menu** (updated)    | A popup panel opened by a caller-supplied trigger, closing on Escape, an outside press, or an activated item — returning focus to the trigger every time. The **Edit menu** and every **Filter dropdown** are ones. | dropdown, popover, context menu  |
| **Header slot** (new) | One of `MainLayout`'s two optional places for a screen's own controls — `headerStart` (before the spacer) and `headerEnd` (after it, before the gear).                                                              | header prop, toolbar, actions    |

## Search, filter & sort (new)

| Term                      | Definition                                                                                                                                                                                        | Aliases to avoid                              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Library query** (new)   | The **Search text** + **Genre filter** + **Minimum rating** + **Sort order** that together decide what the **Browse home** shows; lives in the URL, never in a component. `LibraryQuery` in code. | home query, filters, criteria, params, search |
| **Search text** (new)     | The free-text fragment of a **Library query**, matched against a **Movie**'s title, **Synopsis**, or **Genre** names (`?q=`).                                                                     | query, keyword, term, search string           |
| **Genre filter** (new)    | The **Library query**'s restriction to a single **Genre**; `All Genres` is its unset state, not a value.                                                                                          | category filter, genre selection              |
| **Minimum rating** (new)  | The **Library query**'s floor on **Rating** — 8 / 6 / 4 units, shown as `4+ stars` / `3+ stars` / `2+ stars`; **Unrated** **Movies** never pass one.                                              | rating filter, stars, score filter            |
| **Sort order** (new)      | Which of `recently-added` \| `a-z` \| `year` \| `highest-rated` \| `unwatched-first` a **Library query** orders by. Part of the query, but not a filter. The five live once, as `MOVIE_SORTS`.    | ordering, sort by, sorting                    |
| **Settled query** (new)   | The **Library query** as recorded in the URL — what every reader acts on, after the **Search bar**'s 250ms debounce has stopped moving.                                                           | current filters, applied query                |
| **Search bar** (new)      | The **Browse home** header's text control (its `headerStart` **Header slot**); the only holder of un-**settled** input.                                                                           | search box, search field, omnibox             |
| **Filter dropdown** (new) | One pill-triggered **Menu** presenting the **Filter options** for one part of a **Library query**. The **Browse home** header has three: Genre, rating, Sort.                                     | select, picker, combo box, dropdown           |
| **Filter option** (new)   | One row of a **Filter dropdown** — label, optional count, and whether it is the current selection.                                                                                                | menu item, choice, entry                      |
| **Genre list** (new)      | The **unfiltered** `{ total, genres }` payload from `GET /api/genres` backing the Genre **Filter dropdown**'s counts; fetched once, never per query.                                              | genre counts, facets, genre payload           |
| **No results** (new)      | The **Load message** shown when a **Library query** matches nothing — a different situation from an empty library, with different copy.                                                           | empty state, no matches, zero state           |

## Relationships

- A **Movie** has zero-or-more **Genres** (ordered; `genres[0]` is the primary tag) and zero-or-more **Subtitles**.
- The **Browse home** shows the **Continue Watching row** above one **Genre row** per **Genre** with ≥1 **Movie**; each row contains one **Card carousel** capped at 15 cards.
- A **Card carousel** holds **Poster cards** or **Continue cards**, never both — decided by its **Carousel variant**.
- A **Poster card** renders one **Movie** via its **Card view model**; it shows the **Poster** when present, else the **Gradient fallback**.
- A **Continue card** renders one **In-progress** **Movie** via its **Continue view model**; it always draws the **Gradient fallback** (it has no image slot) and opens the **Movie detail page**, not the player.
- A **Genre row**'s **View all** count is the **Genre**'s full **Movie** total (`listGenres()`), independent of the 15 cards shown; the **Continue Watching row** has no **View all**.
- A **Movie** has exactly one **video path** (referenced in the **Library root**), and at most one **Poster** and one **Backdrop** (in the **Managed image cache**).
- A **Movie**'s **Status** is derived from **Watched** + **Resume position** — never stored.
- A **Resume label** is derived from **Resume position** + runtime; it is built in the mapper, never inside the **Continue card**.
- A **Rating** belongs to exactly one **Movie**; it is **Unrated** until **TMDB** seeds it or the maintainer sets it.
- One **Movie** maps to exactly one **TMDB** entry (`tmdb_id`); in v1 one **Movie** = one video file (no **Editions**).
- The **Movie detail page** renders exactly one **Movie** via its **Detail view model**; every display decision (which **Meta segments** survive, the **Runtime label**'s wording, the **Play label**, whether there is a **Credits row**) is made in `detailView()`, never in the component.
- A **Meta segment** that is absent takes its separator with it — the **Meta line** never renders a dangling `·`.
- **Unrated** is treated as an absent **Meta segment** on the **Movie detail page**, but still renders as 0 stars on a **Poster card**.
- A **Library query** produces exactly one **Home payload**; both the **Genre rows** and the **Continue Watching row** are built from it, so both narrow together.
- The **Search bar** and the **Filter dropdowns** only ever _write_ a **Library query**; everything that renders reads the **Settled query** from the URL, so no screen owns it.
- A **Filter dropdown** holds one **Filter option** per choice, exactly one of which is selected; `All Genres` and `All ratings` are the options that mean "unset".
- A **Genre row**'s **View all** count comes from the **Genre list**, not the **Library query** — it stays the **Genre**'s true total even when the row shows three matches.
- **No results** and "Your library is empty" are different **Load messages**: the first means a **Library query** matched nothing, the second means there are no **Movies** at all.

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
> **Dev:** "And if it's **Unrated** too — five empty stars?"
> **Maintainer:** "No, nothing. Empty stars with '0.0' next to them says we watched
> it and scored it zero. **Unrated** means nobody's said anything yet. On the
> **Poster card** it still shows as 0 stars, but that's a fixed tile — I'd rather
> have even rows there than be strictly right."
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

## Flagged ambiguities

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
- **"Browse grid" vs "Browse home":** the CLAUDE.md feature "Browse grid" names
  the **Genre row** body specifically. The screen it lives on is the **Browse
  home** (`LibraryPage`). Prefer **Genre row** for the rows and **Browse home**
  for the screen; avoid "grid," which also suggests the flat `LibraryGrid` used on
  the **View all** genre page (a different layout).
- **"Rating" on a card (updated — partly resolved):** an **Unrated** **Movie** maps
  to 0 stars on a **Poster card**, which looks identical to a literal 0. Resolved
  for the **Movie detail page** (the stars are omitted entirely); **still open for
  the Poster card**, where the star row is fixed furniture in a fixed-height tile
  and removing it would make cards in a row uneven. Revisit with the **Ratings**
  feature, which owns the interactive picker and any explicit "Unrated" affordance.
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
- **"Filter" colloquially swallows sort (new):** **Sort order** is part of a
  **Library query** but changes _which order_, never _which_ **Movies**. The
  component holding all three dropdowns is `LibraryFilters` for layout reasons
  (they share the header's trailing group), not because sort is a filter. Say
  **Library query** when you mean all four, and never "the filters" for the sort.
- **"Rating" vs "Minimum rating" (new):** a **Rating** belongs to a **Movie**;
  a **Minimum rating** is a floor in a **Library query**. Both are in 0–10 units
  and both are rendered as stars, so name which one. Note the asymmetry: an
  **Unrated** **Movie** shows 0 stars on a **Poster card** but is _excluded_ by
  any **Minimum rating** — it does not behave as a 0.
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
- **"Search" is a feature folder and a field (new):** `features/search/` owns all
  four controls, not just the text one. The `search` field of a query is the
  **Search text** alone. The URL and the API both say `q` for it; only the domain
  types say `search`.
- **Search matches more than titles (new):** **Search text** matches title,
  **Synopsis** _or_ **Genre** name, per the prototype. So typing "comedy" returns
  comedies without touching the **Genre filter**, and the two mechanisms can
  overlap.
- **Case-insensitive search is ASCII-only (new):** SQLite's `LIKE` folds case for
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
