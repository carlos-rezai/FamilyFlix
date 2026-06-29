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

## Relationships

- A **Movie** has zero-or-more **Genres** (ordered; `genres[0]` is the primary tag) and zero-or-more **Subtitles**.
- A **Movie** has exactly one **video path** (referenced in the **Library root**), and at most one **Poster** and one **Backdrop** (in the **Managed image cache**).
- A **Movie**'s **Status** is derived from **Watched** + **Resume position** — never stored.
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
> **Dev:** "What about the **Rating** — empty until I set it?"
> **Maintainer:** "No, seed it from the **TMDB** score so there are no blank
> fields. Only leave it **Unrated** if **TMDB** has too few votes to trust."
> **Dev:** "If I half-watch it, the card shows **in-progress**?"
> **Maintainer:** "Right — that **Status** is derived from the **Resume position**,
> I never set it directly. I only ever flip **Watched**."

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
