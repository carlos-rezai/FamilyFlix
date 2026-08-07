# Ubiquitous Language

## Library entities

| Term         | Definition                                                                                           | Aliases to avoid             |
| ------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------- |
| **Movie**    | A single film in the library — the canonical domain entity, one row in `movies`, one poster card.    | _film_ (informal synonym OK) |
| **Genre**    | A shared, queryable category a **Movie** belongs to; a real entity (junction table), used to browse. | category, tag                |
| **Subtitle** | A subtitle **file asset** owned by a **Movie** — a path + human language label + track order.        | caption, sub track           |
| **Cast**     | The display-only ordered list of actor names on a **Movie** (JSON, never queried).                   | actors list, credits         |
| **Director** | The single display-only director name on a **Movie**.                                                | —                            |
| **Poster**   | The portrait cover image for a **Movie**, downloaded from **TMDB** into the **Managed image cache**. | cover, thumbnail             |
| **Backdrop** | The wide hero image behind the **Movie detail page**, downloaded from **TMDB** into the image cache. | banner, hero, background     |

## Rating & watch state

| Term                | Definition                                                                                             | Aliases to avoid         |
| ------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------ |
| **Rating**          | Household 0–10 half-star score (10 = 5 stars), **seeded from TMDB** at import, maintainer-overridable. | review, score, vote      |
| **Unrated**         | A **Movie** with no **Rating** (`NULL`) — distinct from a literal 0-star rating.                       | zero stars, unscored     |
| **Status**          | A **Movie**'s **derived** watch state: `unwatched` \| `in-progress` \| `watched` (never stored).       | state, watch status      |
| **Watched**         | Explicit boolean flag meaning the maintainer marked a **Movie** finished.                              | seen, completed          |
| **Resume position** | Seconds into a **Movie**'s video where playback last stopped (`resume_position_seconds`).              | progress, playback time  |
| **In-progress**     | Derived **Status** when `resume_position_seconds > 0` and not **Watched**.                             | partially watched        |
| **Favorite**        | Per-movie household boolean (`is_favorite`) surfaced as the Favorites row.                             | liked, starred, bookmark |

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

| Term                            | Definition                                                                                                                            | Aliases to avoid                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| **Browse home**                 | The `/` route (`LibraryPage`) — the parent-facing home screen listing the **Continue Watching row** then the **Genre rows**.          | home page, browse grid, dashboard     |
| **Genre row**                   | A titled horizontal row showing up to 15 **Poster cards** for one **Genre**, with a "View all {count}" link.                          | shelf, carousel row, genre shelf      |
| **Continue Watching row** (new) | The **Browse home**'s top row: up to 15 **Continue cards** for **In-progress** **Movies**; hidden entirely when there are none.       | resume row, keep watching, up next    |
| **Card carousel** (updated)     | The horizontal scroller (prev/next arrows) inside a row, holding **Poster cards** or **Continue cards** per its **Carousel variant**. | slider, scroller                      |
| **Carousel variant** (new)      | Which card shape a **Card carousel** holds — `poster` or `continue`; also sets the tile width and arrow height.                       | mode, type, kind                      |
| **Poster card**                 | The library's primary movie tile: **Poster** (or **Gradient fallback**), title, **Rating** stars, watch state, favorite heart.        | tile, thumbnail, cell                 |
| **Continue card** (new)         | The wide 16:10 resume tile: **Gradient fallback**, title, **Resume label**, progress track, play badge. No **Favorite** heart.        | resume tile, continue tile, hero card |
| **Resume label** (new)          | The human string on a **Continue card** — `Resume · 1:13 of 1:55`, or `Resume · 1:13` when runtime is unknown.                        | timestamp, progress text              |
| **View all**                    | The **Genre row** header link to that **Genre**'s full page (`/genre/:name`); its count is the true total, not the 15 shown.          | see all, more, expand                 |
| **Home payload** (updated)      | The single `GET /api/home` response — named sections: `{ continueWatching: Movie[], rows: HomeRow[] }`.                               | feed, home data                       |
| **Gradient fallback**           | A deterministic per-**Movie** color gradient (hashed from the **Movie** id) drawn on a card when no **Poster** exists.                | placeholder art, gradient stops       |
| **Poster URL**                  | The browser-loadable URL (`/api/images/…`) that resolves a **Movie**'s **Poster path** through the image route.                       | image src, poster link                |
| **Card view model**             | `PosterCardMovie` — the small display shape a **Movie** is mapped to for a **Poster card** (rating→percent, progress→percent).        | card DTO, card props                  |
| **Continue view model** (new)   | `ContinueCardMovie` — the display shape for a **Continue card**: id, title, gradient stops, **Resume label**, progress percent.       | continue DTO, resume model            |
| **Nominal sliver**              | The small fixed **Progress** bar length shown when a **Movie** is **In-progress** but `runtimeMinutes` is unknown.                    | placeholder progress                  |

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

## Example dialogue

> **Dev:** "When the importer reads a folder named `Northwind (2018) 1080p BluRay`,
> what becomes the **Movie**?"
> **Maintainer:** "Strip the release tokens, search **TMDB** by title and year,
> and that one **TMDB** entry is the **Movie**. The video stays where it is —
> we **reference it in place** under the **Library root**, we never copy it."
> **Dev:** "And the **Poster**?"
> **Maintainer:** "That we download from **TMDB** into the **Managed image cache**,
> because it isn't on my disk and I need it offline."
> **Dev:** "If I half-watch it, the card shows **in-progress**?"
> **Maintainer:** "Right — that **Status** is derived from the **Resume position**,
> I never set it directly. I only ever flip **Watched**."
> **Dev:** "So does that **Movie** then show up twice on the **Browse home** — once
> in the **Continue Watching row** and once in its **Genre row**?"
> **Maintainer:** "Yes, and that's correct. The **Continue Watching row** is a
> different question — 'what am I part-way through' — not a **Genre**."
> **Dev:** "Same tile in both?"
> **Maintainer:** "No. The **Genre row** shows a **Poster card**; the **Continue
> Watching row** shows a **Continue card** — wider, with the **Resume label** across
> it. Same **Card carousel** underneath, different **Carousel variant**."
> **Dev:** "Can I heart a **Movie** from the **Continue card**?"
> **Maintainer:** "No — only from the **Poster card**. Clicking a **Continue card**
> opens the **Movie**, same as anywhere else."
> **Dev:** "And when nothing's been started?"
> **Maintainer:** "Then there's no **Continue Watching row** at all — it doesn't sit
> there empty. The **Genre rows** just start at the top."
> **Dev:** "On the Action **Genre row** it says 'View all 214' but I only see 15
> **Poster cards** — bug?"
> **Maintainer:** "No — the **Card carousel** is capped at 15; the **View all**
> count is the real total, and the link opens the full **Genre** page."

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
- **"Rating" on a card:** a **Poster card** renders **Rating** as a 0–100 percent
  (`units × 10`) for the star display. An **Unrated** **Movie** maps to 0 stars,
  which looks identical to a literal 0 on the card — the **Unrated**/zero
  distinction is not surfaced there (flagged for the detail/edit grill).
- **"Progress" is three things (new):** the stored **Resume position** (seconds),
  the 0–100 display percent on a card's bar, and the **Resume label** string. Never
  say bare "progress" across the seam — name which one. The stored value is always
  **Resume position**.
- **"Continue Watching" does not mean most-recently-watched (new):** the row is
  ordered `recently-added`, because no sort exists over "when did playback last
  touch this" and nothing writes **Resume position** until the player ships. The
  name describes _which_ **Movies** appear (**In-progress**), not their order —
  revisit the ordering with the player.
- **The Continue card has no artwork (new):** it is **Gradient fallback**-only by
  the prototype's design — there is no image slot in `mol.ContinueCard`, unlike the
  **Poster card**. A **Movie**'s **Backdrop** would suit the 16:10 tile, but adding
  it is a **prototype amendment**, not an implementation choice.
